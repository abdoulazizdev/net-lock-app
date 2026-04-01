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
 * Persistance dans DEUX storages :
 *   1. CE (Credential Encrypted) — stockage normal, pour le reste de l'app
 *   2. DE (Device Protected)     — pour le BootReceiver (avant déverrouillage)
 *
 * Ainsi, les règles sont disponibles immédiatement au reboot, avant que
 * l'utilisateur ait déverrouillé son téléphone.
 */
class VpnModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG              = "VpnModule"
        const val VPN_REQUEST_CODE = 7481
        const val EVENT_PERMISSION = "vpn:permission"
        const val KEY_BLOCKED_PKGS = "blocked_packages_json"
        const val KEY_ALLOWED_PKGS = "allowed_packages_json"
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
                promise.resolve("granted")
            } else {
                activity.startActivityForResult(intent, VPN_REQUEST_CODE)
                promise.resolve("needs_permission")
            }
        } catch (e: Exception) { promise.reject("VPN_ERROR", e.message) }
    }

    @ReactMethod
    fun startVpn(promise: Promise) {
        try {
            if (VpnService.prepare(reactContext) != null) {
                promise.reject("PERMISSION_REQUIRED", "Appeler prepareVpn() d'abord"); return
            }
            startService(Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "START"
                putExtra("allowlist_mode", NetLockVpnService.allowlistMode)
            })
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("VPN_ERROR", e.message) }
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        try {
            startService(Intent(reactContext, NetLockVpnService::class.java).apply { action = "STOP" })
            // Effacer KEY_ACTIVE dans les deux storages
            saveToPrefs(NetLockVpnService.KEY_ACTIVE, false)
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
     * Persiste dans CE + DE storage, met à jour le cache statique,
     * et envoie UPDATE_RULES au service si actif.
     */
    @ReactMethod
    fun setBlockedApps(packages: ReadableArray, promise: Promise) {
        val set = HashSet<String>()
        for (i in 0 until packages.size()) packages.getString(i)?.let { set.add(it) }

        // Persister dans les deux storages
        val json = setToJson(set)
        saveBothStorages(KEY_BLOCKED_PKGS, json)
        saveBothStorages(KEY_ALLOWED_PKGS, "[]")
        saveBothStorages(NetLockVpnService.KEY_ALLOW_MODE, false)

        // Cache statique
        NetLockVpnService.blockedPackages = set
        NetLockVpnService.allowlistMode   = false
        NetLockVpnService.allowedPackages = hashSetOf()

        // Notifier le service (s'il tourne)
        startService(Intent(reactContext, NetLockVpnService::class.java).apply {
            action = "UPDATE_RULES"
            putExtra("allowlist_mode", false)
        })

        Log.d(TAG, "setBlockedApps: ${set.size} packages")
        promise.resolve(true)
    }

    @ReactMethod
    fun setAllowlistMode(allowedPackages: ReadableArray, promise: Promise) {
        val set = HashSet<String>()
        for (i in 0 until allowedPackages.size()) allowedPackages.getString(i)?.let { set.add(it) }

        val json = setToJson(set)
        saveBothStorages(KEY_ALLOWED_PKGS, json)
        saveBothStorages(KEY_BLOCKED_PKGS, "[]")
        saveBothStorages(NetLockVpnService.KEY_ALLOW_MODE, true)

        NetLockVpnService.allowedPackages = set
        NetLockVpnService.allowlistMode   = true
        NetLockVpnService.blockedPackages = hashSetOf()

        startService(Intent(reactContext, NetLockVpnService::class.java).apply {
            action = "UPDATE_RULES"
            putExtra("allowlist_mode", true)
        })

        Log.d(TAG, "setAllowlistMode: ${set.size} apps autorisées")
        promise.resolve(true)
    }

    @ReactMethod
    fun disableAllowlistMode(promise: Promise) {
        saveBothStorages(NetLockVpnService.KEY_ALLOW_MODE, false)
        saveBothStorages(KEY_ALLOWED_PKGS, "[]")
        NetLockVpnService.allowlistMode   = false
        NetLockVpnService.allowedPackages = hashSetOf()
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

    /** Sauvegarde une String dans CE et DE storage */
    private fun saveBothStorages(key: String, value: String) {
        // CE storage (accès normal)
        reactContext.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
            .edit().putString(key, value).apply()
        // DE storage (accessible avant déverrouillage)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            reactContext.createDeviceProtectedStorageContext()
                .getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
                .edit().putString(key, value).apply()
        }
    }

    /** Sauvegarde un Boolean dans CE et DE storage */
    private fun saveBothStorages(key: String, value: Boolean) {
        reactContext.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(key, value).apply()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            reactContext.createDeviceProtectedStorageContext()
                .getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(key, value).apply()
        }
    }

    /** Surcharge pour backward compat — ne persiste que dans CE */
    private fun saveToPrefs(key: String, value: Boolean) {
        saveBothStorages(key, value)
    }

    private fun setToJson(set: HashSet<String>): String =
        JSONArray().also { arr -> set.forEach { arr.put(it) } }.toString()

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
        } catch (e: Exception) { Log.w(TAG, "startService: ${e.message}") }
    }
}