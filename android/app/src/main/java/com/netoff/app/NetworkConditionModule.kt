package com.netoff.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Expose le type de connexion réseau (WiFi / Data mobile) à React Native.
 * Utilisé pour le blocage conditionnel : "bloquer uniquement sur données mobiles"
 * ou "bloquer uniquement sur WiFi".
 */
class NetworkConditionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NetworkConditionModule"

    /** Retourne "wifi", "mobile", "none", ou "unknown" */
    @ReactMethod
    fun getConnectionType(promise: Promise) {
        try {
            promise.resolve(currentConnectionType())
        } catch (e: Exception) {
            promise.resolve("unknown")
        }
    }

    @ReactMethod
    fun isOnWifi(promise: Promise) {
        promise.resolve(currentConnectionType() == "wifi")
    }

    @ReactMethod
    fun isOnMobileData(promise: Promise) {
        promise.resolve(currentConnectionType() == "mobile")
    }

    private fun currentConnectionType(): String {
        val cm = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            as ConnectivityManager

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network     = cm.activeNetwork ?: return "none"
            val capabilities = cm.getNetworkCapabilities(network) ?: return "none"
            when {
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)     -> "wifi"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                else -> "unknown"
            }
        } else {
            @Suppress("DEPRECATION")
            when (cm.activeNetworkInfo?.type) {
                ConnectivityManager.TYPE_WIFI   -> "wifi"
                ConnectivityManager.TYPE_MOBILE -> "mobile"
                else -> "unknown"
            }
        }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}

class NetworkConditionPackage : com.facebook.react.ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext) =
        listOf(NetworkConditionModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext) =
        emptyList<com.facebook.react.uimanager.ViewManager<*, *>>()
}