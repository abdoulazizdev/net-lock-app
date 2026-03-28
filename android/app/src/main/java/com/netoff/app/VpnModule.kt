package com.netoff.app

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * VpnModule — Bridge React Native ↔ NetLockVpnService
 *
 * FLUX CORRECT pour démarrer le VPN :
 *   1. JS appelle prepareVpn()
 *   2. Kotlin vérifie VpnService.prepare(context)
 *      → null  : permission déjà accordée, résout immédiatement avec "granted"
 *      → Intent : lance le dialog système Android (startActivityForResult)
 *   3. L'utilisateur accepte → onActivityResult → émet "vpn:permission" = "granted"
 *   4. JS reçoit l'event, appelle startVpn()
 *   5. establish() retourne un vrai fd → VPN actif
 *
 * Sans ce flux, establish() retourne null et le service s'arrête seul.
 */
class VpnModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG             = "VpnModule"
        const val VPN_REQUEST_CODE = 7481
        // Nom de l'event JS pour le résultat de la permission
        const val EVENT_PERMISSION = "vpn:permission"
    }

    // Listener enregistré dans MainActivity pour recevoir onActivityResult
    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity, requestCode: Int, resultCode: Int, data: Intent?
        ) {
            if (requestCode != VPN_REQUEST_CODE) return
            if (resultCode == Activity.RESULT_OK) {
                Log.d(TAG, "Permission VPN accordée → émission event")
                emitToJS(EVENT_PERMISSION, "granted")
            } else {
                Log.w(TAG, "Permission VPN refusée")
                emitToJS(EVENT_PERMISSION, "denied")
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName() = "VpnModule"

    /**
     * Vérifie si la permission VPN est accordée.
     * Si non, ouvre le dialog système Android.
     * Résout avec "granted" ou "needs_permission".
     * Si "needs_permission" → JS doit attendre l'event "vpn:permission".
     */
    @ReactMethod
    fun prepareVpn(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "Pas d'activité active")
                return
            }
            // VpnService.prepare() retourne null si déjà accordé, Intent sinon
            val intent = VpnService.prepare(reactContext)
            if (intent == null) {
                // Déjà accordé — pas besoin de dialog
                Log.d(TAG, "Permission VPN déjà accordée")
                promise.resolve("granted")
            } else {
                // Lancer le dialog système
                Log.d(TAG, "Demande de permission VPN → startActivityForResult")
                activity.startActivityForResult(intent, VPN_REQUEST_CODE)
                promise.resolve("needs_permission")
            }
        } catch (e: Exception) {
            Log.e(TAG, "prepareVpn: ${e.message}", e)
            promise.reject("VPN_ERROR", e.message)
        }
    }

    /** Démarre le service VPN (appeler seulement APRÈS prepareVpn → "granted") */
    @ReactMethod
    fun startVpn(promise: Promise) {
        try {
            // Double-check permission avant de démarrer
            val permIntent = VpnService.prepare(reactContext)
            if (permIntent != null) {
                // Permission pas encore accordée — ne pas démarrer
                promise.reject("PERMISSION_REQUIRED", "Appeler prepareVpn() d'abord")
                return
            }
            val intent = Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "START"
                putExtra("allowlist_mode", NetLockVpnService.allowlistMode)
            }
            startService(intent)
            Log.d(TAG, "VPN service démarré")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "startVpn: ${e.message}", e)
            promise.reject("VPN_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        try {
            startService(Intent(reactContext, NetLockVpnService::class.java).apply { action = "STOP" })
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VPN_ERROR", e.message)
        }
    }

    /** Retourne l'état réel du VPN depuis le service natif */
    @ReactMethod
    fun isVpnActive(promise: Promise) {
        promise.resolve(NetLockVpnService.isVpnEstablished)
    }

    /** Vérifie si la permission VPN est déjà accordée (sans ouvrir de dialog) */
    @ReactMethod
    fun isVpnPermissionGranted(promise: Promise) {
        try {
            val intent = VpnService.prepare(reactContext)
            promise.resolve(intent == null) // null = déjà accordé
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setBlockedApps(packages: ReadableArray, promise: Promise) {
        val set = HashSet<String>()
        for (i in 0 until packages.size()) packages.getString(i)?.let { set.add(it) }
        NetLockVpnService.blockedPackages = set
        NetLockVpnService.allowlistMode   = false
        if (NetLockVpnService.isVpnEstablished) {
            startService(Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "UPDATE_RULES"
                putExtra("allowlist_mode", false)
            })
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun setAllowlistMode(allowedPackages: ReadableArray, promise: Promise) {
        val set = HashSet<String>()
        for (i in 0 until allowedPackages.size()) allowedPackages.getString(i)?.let { set.add(it) }
        NetLockVpnService.allowedPackages = set
        NetLockVpnService.allowlistMode   = true
        NetLockVpnService.blockedPackages = hashSetOf()
        Log.d(TAG, "MODE ALLOWLIST — ${set.size} apps autorisées")
        if (NetLockVpnService.isVpnEstablished) {
            startService(Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "UPDATE_RULES"
                putExtra("allowlist_mode", true)
            })
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun disableAllowlistMode(promise: Promise) {
        NetLockVpnService.allowlistMode   = false
        NetLockVpnService.allowedPackages = hashSetOf()
        if (NetLockVpnService.isVpnEstablished) {
            startService(Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "UPDATE_RULES"
                putExtra("allowlist_mode", false)
            })
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun canBlockPackage(packageName: String, promise: Promise) {
        try {
            reactContext.packageManager.getApplicationInfo(packageName, 0)
            promise.resolve(Arguments.createMap().apply { putBoolean("canBlock", true) })
        } catch (e: Exception) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("canBlock", false)
                putString("reason", "app_not_found")
            })
        }
    }

    // Nécessaire pour NativeEventEmitter côté JS
    @ReactMethod
    fun addListener(eventName: String) {}
    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun emitToJS(event: String, payload: String) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, payload)
    }

    private fun startService(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            reactContext.startForegroundService(intent)
        else
            reactContext.startService(intent)
    }
}