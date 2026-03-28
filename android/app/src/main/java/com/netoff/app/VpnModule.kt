package com.netoff.app

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import android.util.Log

class VpnModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "VpnModule"

    @ReactMethod
    fun startVpn(promise: Promise) {
        try {
            val intent = Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "START"
                putExtra("allowlist_mode", NetLockVpnService.allowlistMode)
            }
            startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
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

    @ReactMethod
    fun isVpnActive(promise: Promise) {
        promise.resolve(NetLockVpnService.isVpnEstablished)
    }

    /** Bloque des apps en mode BLOCKLIST (mode normal) */
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

    /**
     * Active le MODE ALLOWLIST — robuste Huawei/EMUI.
     * allowedPackages = apps qui PEUVENT avoir internet.
     * Tout le reste est bloqué par défaut (entier dans le tunnel).
     */
    @ReactMethod
    fun setAllowlistMode(allowedPackages: ReadableArray, promise: Promise) {
        val set = HashSet<String>()
        for (i in 0 until allowedPackages.size()) allowedPackages.getString(i)?.let { set.add(it) }
        NetLockVpnService.allowedPackages = set
        NetLockVpnService.allowlistMode   = true
        NetLockVpnService.blockedPackages = hashSetOf() // inutilisé en allowlist
        Log.d("VpnModule", "MODE ALLOWLIST activé — ${set.size} apps autorisées")
        if (NetLockVpnService.isVpnEstablished) {
            startService(Intent(reactContext, NetLockVpnService::class.java).apply {
                action = "UPDATE_RULES"
                putExtra("allowlist_mode", true)
            })
        }
        promise.resolve(true)
    }

    /** Désactive le mode allowlist et revient en mode blocklist */
    @ReactMethod
    fun disableAllowlistMode(promise: Promise) {
        NetLockVpnService.allowlistMode   = false
        NetLockVpnService.allowedPackages = hashSetOf()
        Log.d("VpnModule", "MODE ALLOWLIST désactivé — retour en blocklist")
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
            val map = Arguments.createMap().apply {
                putBoolean("canBlock", true)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            val map = Arguments.createMap().apply {
                putBoolean("canBlock", false)
                putString("reason", "app_not_found")
            }
            promise.resolve(map)
        }
    }

    private fun startService(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            reactContext.startForegroundService(intent)
        else
            reactContext.startService(intent)
    }
}