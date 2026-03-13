package com.netoff.app

import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*

class VpnModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "VpnModule"

    @ReactMethod
    fun startVpn(promise: Promise) {
        try {
            val intent = Intent(reactContext, NetLockVpnService::class.java).apply { action = "START" }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                reactContext.startForegroundService(intent)
            else
                reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("VPN_ERROR", e.message, e) }
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        try {
            reactContext.startService(Intent(reactContext, NetLockVpnService::class.java).apply { action = "STOP" })
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("VPN_ERROR", e.message, e) }
    }

    @ReactMethod
    fun isVpnActive(promise: Promise) {
        promise.resolve(NetLockVpnService.serviceRunning)
    }

    @ReactMethod
    fun setBlockedApps(packages: ReadableArray, promise: Promise) {
        try {
            val set = HashSet<String>()
            for (i in 0 until packages.size()) {
                val pkg = packages.getString(i) ?: continue
                set.add(pkg)
            }

            // Logger les nouvelles apps bloquées
            val newlyBlocked = set - NetLockVpnService.blockedPackages
            val newlyAllowed = NetLockVpnService.blockedPackages - set
            for (pkg in newlyBlocked)
                ConnectionLogModule.appendLog(reactContext, pkg, "blocked")
            for (pkg in newlyAllowed)
                ConnectionLogModule.appendLog(reactContext, pkg, "allowed")

            NetLockVpnService.blockedPackages = set
            reactContext.startService(
                Intent(reactContext, NetLockVpnService::class.java).apply { action = "UPDATE_RULES" }
            )
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("VPN_ERROR", e.message, e) }
    }

    @ReactMethod
    fun getBlockedApps(promise: Promise) {
        val arr = Arguments.createArray()
        NetLockVpnService.blockedPackages.forEach { arr.pushString(it) }
        promise.resolve(arr)
    }
}