package com.netoff.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class VpnModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener {

    companion object {
        const val VPN_PERMISSION_REQUEST       = 1001
        const val EVENT_VPN_PERMISSION_GRANTED = "VPN_PERMISSION_GRANTED"
        const val EVENT_VPN_PERMISSION_DENIED  = "VPN_PERMISSION_DENIED"
    }

    private var pendingStartPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = "VpnModule"

    @ReactMethod
    fun startVpn(promise: Promise) {
        try {
            val permIntent = VpnService.prepare(reactContext)
            if (permIntent == null) {
                launchVpnService()
                promise.resolve(true)
            } else {
                val activity = reactContext.currentActivity  // ← via reactContext
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "Activité non disponible")
                    return
                }
                pendingStartPromise = promise
                activity.startActivityForResult(permIntent, VPN_PERMISSION_REQUEST) // ← sur activity
            }
        } catch (e: Exception) {
            promise.reject("VPN_ERROR", e.message, e)
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != VPN_PERMISSION_REQUEST) return
        if (resultCode == Activity.RESULT_OK) {
            launchVpnService()
            pendingStartPromise?.resolve(true)
            sendEvent(EVENT_VPN_PERMISSION_GRANTED)
        } else {
            pendingStartPromise?.reject("PERMISSION_DENIED", "Permission VPN refusée")
            sendEvent(EVENT_VPN_PERMISSION_DENIED)
        }
        pendingStartPromise = null
    }

    override fun onNewIntent(intent: Intent) {}

    private fun launchVpnService() {
        val intent = Intent(reactContext, NetLockVpnService::class.java).apply {
            action = "START"
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            reactContext.startForegroundService(intent)
        else
            reactContext.startService(intent)
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        try {
            reactContext.startService(
                Intent(reactContext, NetLockVpnService::class.java).apply { action = "STOP" }
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VPN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isVpnActive(promise: Promise) {
        try {
            if (NetLockVpnService.isVpnEstablished) {
                promise.resolve(true)
                return
            }
            val active = reactContext
                .getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
                .getBoolean(NetLockVpnService.KEY_ACTIVE, false)
            promise.resolve(active)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setBlockedApps(packages: ReadableArray, promise: Promise) {
        try {
            val newSet = HashSet<String>()
            for (i in 0 until packages.size()) {
                packages.getString(i)?.let { newSet.add(it) }
            }

            val newlyBlocked = newSet - NetLockVpnService.blockedPackages
            val newlyAllowed = NetLockVpnService.blockedPackages - newSet
            for (pkg in newlyBlocked) ConnectionLogModule.appendLog(reactContext, pkg, "blocked")
            for (pkg in newlyAllowed) ConnectionLogModule.appendLog(reactContext, pkg, "allowed")

            NetLockVpnService.blockedPackages = newSet

            if (NetLockVpnService.isVpnEstablished) {
                reactContext.startService(
                    Intent(reactContext, NetLockVpnService::class.java).apply {
                        action = "UPDATE_RULES"
                    }
                )
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("VPN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getBlockedApps(promise: Promise) {
        val arr = Arguments.createArray()
        NetLockVpnService.blockedPackages.forEach { arr.pushString(it) }
        promise.resolve(arr)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun sendEvent(eventName: String) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, null)
        } catch (_: Exception) {}
    }
}