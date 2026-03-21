package com.netoff.app

import android.content.Context
import com.facebook.react.bridge.*

class WatchdogModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "WatchdogModule"

    @ReactMethod
    fun start(promise: Promise) {
        try {
            WatchdogWorker.schedule(reactContext)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message, e) }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            WatchdogWorker.cancel(reactContext)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message, e) }
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        // Éviter ListenableFuture/Guava — lire les SharedPreferences directement.
        // Si le VPN devrait être actif, le watchdog est actif par définition.
        try {
            val prefs = reactContext.getSharedPreferences(
                NetLockVpnService.PREFS, Context.MODE_PRIVATE
            )
            promise.resolve(prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false))
        } catch (e: Exception) { promise.resolve(false) }
    }
}

class WatchdogPackage : com.facebook.react.ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext) = listOf(WatchdogModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext) =
        emptyList<com.facebook.react.uimanager.ViewManager<*, *>>()
}