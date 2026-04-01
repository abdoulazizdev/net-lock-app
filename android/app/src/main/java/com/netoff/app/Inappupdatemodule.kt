package com.netoff.app

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * InAppUpdateModule — Mises à jour in-app via Google Play Core
 *
 * Deux modes selon l'urgence :
 *
 *   FLEXIBLE (recommandé pour la plupart des mises à jour) :
 *     → Téléchargement en arrière-plan pendant que l'utilisateur utilise l'app
 *     → Une notification apparaît quand le téléchargement est prêt
 *     → L'utilisateur choisit quand installer
 *     → Idéal pour les mises à jour non critiques
 *
 *   IMMEDIATE (forcé pour les mises à jour critiques) :
 *     → Couvre l'app avec un plein écran système obligatoire
 *     → L'utilisateur DOIT mettre à jour pour continuer
 *     → À utiliser seulement pour les mises à jour de sécurité majeures
 *
 * Events JS émis :
 *   "update:available"    → { updateAvailable: bool, priority: int, staleDays: int }
 *   "update:progress"     → { status: string, bytesDownloaded: long, totalBytes: long }
 *   "update:downloaded"   → prêt à installer
 *   "update:installed"    → installation terminée
 *   "update:failed"       → échec
 */
class InAppUpdateModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    private val appUpdateManager: AppUpdateManager =
        AppUpdateManagerFactory.create(reactContext)

    private var installStateListener: InstallStateUpdatedListener? = null

    // Listener pour onActivityResult (IMMEDIATE update)
    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != UPDATE_REQUEST_CODE) return
            if (resultCode != Activity.RESULT_OK) {
                Log.w(TAG, "Mise à jour refusée ou échouée (code=$resultCode)")
                emitEvent("update:failed", Arguments.createMap().apply {
                    putString("reason", "user_cancelled_or_failed")
                })
            }
        }
    }

    init { reactContext.addActivityEventListener(activityEventListener) }

    override fun getName() = "InAppUpdateModule"

    /**
     * Vérifie si une mise à jour est disponible sur le Play Store.
     * Résout avec { updateAvailable, priority, staleDays, versionCode }.
     *
     * priority : 0-5, 5 = critique (recommande IMMEDIATE)
     * staleDays : nombre de jours depuis que la mise à jour est disponible
     */
    @ReactMethod
    fun checkForUpdate(promise: Promise) {
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
            val map = Arguments.createMap().apply {
                putBoolean("updateAvailable",  available)
                putInt("priority",             info.updatePriority())
                putInt("staleDays",            info.clientVersionStalenessDays() ?: 0)
                putInt("availableVersionCode", info.availableVersionCode())
                putBoolean("flexibleAllowed",  info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
                putBoolean("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
            }
            Log.d(TAG, "checkForUpdate: available=$available, priority=${info.updatePriority()}, stale=${info.clientVersionStalenessDays()}")
            emitEvent("update:available", map)
            promise.resolve(map)
        }.addOnFailureListener { e ->
            Log.w(TAG, "checkForUpdate failed: ${e.message}")
            val map = Arguments.createMap().apply { putBoolean("updateAvailable", false) }
            promise.resolve(map) // Résoudre (pas rejeter) — l'app fonctionne sans mises à jour
        }
    }

    /**
     * Démarre une mise à jour FLEXIBLE (téléchargement en arrière-plan).
     * L'utilisateur peut continuer à utiliser l'app pendant le téléchargement.
     * Émet des events "update:progress" pendant le téléchargement.
     * Émet "update:downloaded" quand prêt à installer.
     */
    @ReactMethod
    fun startFlexibleUpdate(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) { promise.reject("NO_ACTIVITY", ""); return }

        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
                !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                promise.resolve(false); return@addOnSuccessListener
            }
            // Enregistrer le listener de progression
            registerInstallListener()

            try {
                appUpdateManager.startUpdateFlowForResult(
                    info,
                    activity,
                    AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
                    UPDATE_REQUEST_CODE
                )
                Log.d(TAG, "Mise à jour flexible démarrée")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "startFlexibleUpdate: ${e.message}", e)
                promise.reject("UPDATE_ERROR", e.message)
            }
        }.addOnFailureListener { e -> promise.reject("UPDATE_ERROR", e.message) }
    }

    /**
     * Démarre une mise à jour IMMEDIATE (plein écran obligatoire).
     * À utiliser uniquement pour les mises à jour critiques (priority >= 4).
     */
    @ReactMethod
    fun startImmediateUpdate(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) { promise.reject("NO_ACTIVITY", ""); return }

        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
                !info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                promise.resolve(false); return@addOnSuccessListener
            }
            try {
                appUpdateManager.startUpdateFlowForResult(
                    info,
                    activity,
                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                    UPDATE_REQUEST_CODE
                )
                Log.d(TAG, "Mise à jour immédiate démarrée")
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("UPDATE_ERROR", e.message)
            }
        }.addOnFailureListener { e -> promise.reject("UPDATE_ERROR", e.message) }
    }

    /**
     * Complète l'installation d'une mise à jour FLEXIBLE téléchargée.
     * À appeler quand l'événement "update:downloaded" est reçu et
     * que l'utilisateur a confirmé l'installation.
     * L'app se redémarre automatiquement.
     */
    @ReactMethod
    fun completeFlexibleUpdate(promise: Promise) {
        try {
            appUpdateManager.completeUpdate()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message)
        }
    }

    /**
     * Vérifie si une mise à jour flexible est en attente d'installation
     * (téléchargée mais pas encore installée). Utile au redémarrage de l'app.
     */
    @ReactMethod
    fun checkDownloadedUpdate(promise: Promise) {
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            val downloaded = info.installStatus() == InstallStatus.DOWNLOADED
            promise.resolve(downloaded)
            if (downloaded) {
                Log.d(TAG, "Mise à jour téléchargée en attente d'installation")
                emitEvent("update:downloaded", Arguments.createMap())
            }
        }.addOnFailureListener { promise.resolve(false) }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun registerInstallListener() {
        // Supprimer l'ancien listener pour éviter les doublons
        installStateListener?.let { appUpdateManager.unregisterListener(it) }

        installStateListener = InstallStateUpdatedListener { state ->
            val progress = Arguments.createMap().apply {
                putString("status", when (state.installStatus()) {
                    InstallStatus.DOWNLOADING  -> "downloading"
                    InstallStatus.DOWNLOADED   -> "downloaded"
                    InstallStatus.INSTALLING   -> "installing"
                    InstallStatus.INSTALLED    -> "installed"
                    InstallStatus.FAILED       -> "failed"
                    InstallStatus.CANCELED     -> "canceled"
                    else -> "pending"
                })
                putDouble("bytesDownloaded", state.bytesDownloaded().toDouble())
                putDouble("totalBytes",      state.totalBytesToDownload().toDouble())
            }
            Log.d(TAG, "Install state: ${state.installStatus()}")
            emitEvent("update:progress", progress)

            when (state.installStatus()) {
                InstallStatus.DOWNLOADED -> emitEvent("update:downloaded", Arguments.createMap())
                InstallStatus.INSTALLED  -> {
                    emitEvent("update:installed", Arguments.createMap())
                    installStateListener?.let { appUpdateManager.unregisterListener(it) }
                    installStateListener = null
                }
                InstallStatus.FAILED -> {
                    emitEvent("update:failed", Arguments.createMap().apply { putString("reason", "install_failed") })
                    installStateListener?.let { appUpdateManager.unregisterListener(it) }
                    installStateListener = null
                }
                else -> {}
            }
        }.also { appUpdateManager.registerListener(it) }
    }

    private fun emitEvent(event: String, payload: WritableMap) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, payload)
        } catch (e: Exception) {
            Log.w(TAG, "emitEvent $event: ${e.message}")
        }
    }

    companion object {
        const val TAG = "InAppUpdateModule"
        const val UPDATE_REQUEST_CODE = 9901
    }
}