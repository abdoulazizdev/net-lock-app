package com.netlock.app

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.*

class VpnModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val VPN_REQUEST_CODE = 1001
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = "VpnModule"

    @ReactMethod
    fun startVpn(promise: Promise) {
        val activity = reactContext.currentActivity ?: run {
            promise.reject("ERROR", "No activity")
            return
        }
        val intent = VpnService.prepare(reactContext)
        if (intent != null) {
            pendingPromise = promise
            activity.startActivityForResult(intent, VPN_REQUEST_CODE)
        } else {
            startVpnService()
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        val intent = Intent(reactContext, NetLockVpnService::class.java)
        intent.action = "STOP"
        reactContext.startService(intent)
        promise.resolve(true)
    }

    @ReactMethod
    fun setBlockedApps(packages: ReadableArray, promise: Promise) {
        NetLockVpnService.blockedPackages.clear()
        for (i in 0 until packages.size()) {
            val pkg = packages.getString(i) ?: continue
            NetLockVpnService.blockedPackages.add(pkg)
        }
        if (NetLockVpnService.serviceRunning) {
            val intent = Intent(reactContext, NetLockVpnService::class.java)
            intent.action = "UPDATE_RULES"
            reactContext.startService(intent)
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun isVpnActive(promise: Promise) {
        promise.resolve(NetLockVpnService.serviceRunning)
    }

    @ReactMethod
    fun getBlockedApps(promise: Promise) {
        val array = WritableNativeArray()
        NetLockVpnService.blockedPackages.forEach { array.pushString(it) }
        promise.resolve(array)
    }

    private var pendingPromise: Promise? = null

    private fun startVpnService() {
        val intent = Intent(reactContext, NetLockVpnService::class.java)
        intent.action = "START"
        reactContext.startService(intent)
    }

    // ✅ Signature correcte pour React Native nouvelle architecture
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                startVpnService()
                pendingPromise?.resolve(true)
            } else {
                pendingPromise?.reject("DENIED", "Permission VPN refusée")
            }
            pendingPromise = null
        }
    }

    override fun onNewIntent(intent: Intent) {}
}