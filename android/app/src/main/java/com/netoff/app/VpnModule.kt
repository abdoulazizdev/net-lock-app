package com.netoff.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray

/**
 * VpnModule — Bridge React Native ↔ NetLockVpnService
 *
 * CORRECTION BUG #1 : setBlockedApps persiste maintenant les packages dans
 * SharedPreferences (KEY_BLOCKED_PKGS en JSON). Le service les relit au démarrage.
 * Les variables statiques restent comme cache mais ne sont plus la source de vérité.
 *
 * CORRECTION BUG #2 : UPDATE_RULES est envoyé TOUJOURS (pas seulement si
 * isVpnEstablished). Le service l'applique s'il tourne, l'ignore sinon.
 * startVpn() reçoit maintenant les packages en extra → les applique AVANT
 * d'appeler establish(), éliminant la race condition.
 */
class VpnModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG              = "VpnModule"
        const val VPN_REQUEST_CODE = 7481
        const val EVENT_PERMISSION = "vpn:permission"

        // Clés SharedPreferences pour persister les règles
        const val KEY_BLOCKED_PKGS  = "blocked_packages_json"
        const val KEY_ALLOWED_PKGS  = "allowed_packages_json"
    }

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity, requestCode: Int, resultCode: Int, data: Intent?
        ) {
            if (requestCode != VPN_REQUEST_CODE) return
            if (resultCode == Activity.RESULT_OK) {
                Log.d(TAG, "Permission VPN accordée")
                emitToJS(EVENT_PERMISSION, "granted")
            } else {
                Log.w(TAG, "Permission VPN refusée")
                emitToJS(EVENT_PERMISSION, "denied")
            }
        }
    }

    init { reactContext.addActivityEventListener(activityEventListener) }

    override fun getName() = "VpnModule"

    @ReactMethod
    fun prepareVpn(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity == null) { promise.reject("NO_ACTIVITY", "Pas d'activité active"); return }
            val intent = VpnService.prepare(reactContext)
            if (intent == null) {
                Log.d(TAG, "Permission VPN déjà accordée")
                promise.resolve("granted")
            } else {
                Log.d(TAG, "Ouverture dialog permission VPN")
                activity.startActivityForResult(intent, VPN_REQUEST_CODE)
                promise.resolve("needs_permission")
            }
        } catch (e: Exception) {
            Log.e(TAG, "prepareVpn: ${e.message}", e)
            promise.reject("VPN_ERROR", e.message)
        }
    }

    /**
     * Démarre le VPN.
     * IMPORTANT : appeler setBlockedApps/setAllowlistMode AVANT startVpn
     * pour que les règles soient dans les prefs avant que le service démarre.
     */
    @ReactMethod
    fun startVpn(promise: Promise) {
        try {
            val permIntent = VpnService.prepare(reactContext)
            if (permIntent != null) {
                promise.reject("PERMISSION_REQUIRED", "Appeler prepareVpn() d'abord")
                return
            }
            val intent = Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "START"
                putExtra("allowlist_mode", NetLockVpnService.allowlistMode)
            }
            startService(intent)
            Log.d(TAG, "VPN service démarré (allowlist=${NetLockVpnService.allowlistMode})")
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
        } catch (e: Exception) { promise.reject("VPN_ERROR", e.message) }
    }

    @ReactMethod
    fun isVpnActive(promise: Promise) {
        promise.resolve(NetLockVpnService.isVpnEstablished)
    }

    @ReactMethod
    fun isVpnPermissionGranted(promise: Promise) {
        try { promise.resolve(VpnService.prepare(reactContext) == null) }
        catch (e: Exception) { promise.resolve(false) }
    }

    /**
     * Persiste les packages bloqués dans SharedPreferences ET dans la variable statique.
     * Envoie UPDATE_RULES au service (il l'applique s'il tourne).
     * FIX BUG #1 + BUG #2.
     */
    @ReactMethod
    fun setBlockedApps(packages: ReadableArray, promise: Promise) {
        val set = HashSet<String>()
        for (i in 0 until packages.size()) packages.getString(i)?.let { set.add(it) }

        // 1. Persister dans SharedPreferences → survivra aux redémarrages du process
        savePackagesToPrefs(KEY_BLOCKED_PKGS, set)
        savePackagesToPrefs(KEY_ALLOWED_PKGS, hashSetOf()) // vider allowed en mode blocklist

        // 2. Mettre à jour le cache statique
        NetLockVpnService.blockedPackages = set
        NetLockVpnService.allowlistMode   = false
        NetLockVpnService.allowedPackages = hashSetOf()

        // 3. Envoyer UPDATE_RULES TOUJOURS (plus de condition isVpnEstablished)
        //    Le service applique si actif, ignore si inactif
        startService(Intent(reactContext, NetLockVpnService::class.java).apply {
            action = "UPDATE_RULES"
            putExtra("allowlist_mode", false)
        })

        Log.d(TAG, "setBlockedApps: ${set.size} packages persistés")
        promise.resolve(true)
    }

    @ReactMethod
    fun setAllowlistMode(allowedPackages: ReadableArray, promise: Promise) {
        val set = HashSet<String>()
        for (i in 0 until allowedPackages.size()) allowedPackages.getString(i)?.let { set.add(it) }

        savePackagesToPrefs(KEY_ALLOWED_PKGS, set)
        savePackagesToPrefs(KEY_BLOCKED_PKGS, hashSetOf())

        NetLockVpnService.allowedPackages = set
        NetLockVpnService.allowlistMode   = true
        NetLockVpnService.blockedPackages = hashSetOf()

        startService(Intent(reactContext, NetLockVpnService::class.java).apply {
            action = "UPDATE_RULES"
            putExtra("allowlist_mode", true)
        })

        Log.d(TAG, "setAllowlistMode: ${set.size} apps autorisées persistées")
        promise.resolve(true)
    }

    @ReactMethod
    fun disableAllowlistMode(promise: Promise) {
        NetLockVpnService.allowlistMode   = false
        NetLockVpnService.allowedPackages = hashSetOf()
        savePackagesToPrefs(KEY_ALLOWED_PKGS, hashSetOf())

        startService(Intent(reactContext, NetLockVpnService::class.java).apply {
            action = "UPDATE_RULES"
            putExtra("allowlist_mode", false)
        })
        promise.resolve(true)
    }

    @ReactMethod
    fun canBlockPackage(packageName: String, promise: Promise) {
        try {
            reactContext.packageManager.getApplicationInfo(packageName, 0)
            promise.resolve(Arguments.createMap().apply { putBoolean("canBlock", true) })
        } catch (e: Exception) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("canBlock", false); putString("reason", "app_not_found")
            })
        }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun savePackagesToPrefs(key: String, packages: HashSet<String>) {
        val json = JSONArray().also { arr -> packages.forEach { arr.put(it) } }.toString()
        reactContext.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
            .edit().putString(key, json).apply()
    }

    private fun emitToJS(event: String, payload: String) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, payload)
    }

    private fun startService(intent: Intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                reactContext.startForegroundService(intent)
            else
                reactContext.startService(intent)
        } catch (e: Exception) {
            Log.w(TAG, "startService: ${e.message}")
        }
    }
}