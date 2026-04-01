package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log

/**
 * VpnRestartReceiver — Relance le VPN sur événements réseau/écran.
 *
 * Déclenché par :
 *   USER_PRESENT / SCREEN_ON  → déverrouillage (OEM tue le VPN en veille)
 *   CONNECTIVITY_CHANGE       → changement Wi-Fi ↔ 4G
 *   POWER_CONNECTED           → branchement chargeur
 *
 * Lit depuis Device Protected Storage pour fonctionner avant déverrouillage.
 */
class VpnRestartReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val prefs          = WatchdogWorker.getBestPrefs(context)
        val shouldBeActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

        if (!shouldBeActive) return
        if (NetLockVpnService.isFocusActive(context)) return

        Log.d(TAG, "onReceive: ${intent.action} — established=${NetLockVpnService.isVpnEstablished}")

        val needsRestart = when (intent.action) {
            Intent.ACTION_USER_PRESENT,
            Intent.ACTION_SCREEN_ON        -> !NetLockVpnService.isVpnEstablished
            ConnectivityManager.CONNECTIVITY_ACTION ->
                !NetLockVpnService.isVpnEstablished && isNetworkAvailable(context)
            Intent.ACTION_POWER_CONNECTED  -> !NetLockVpnService.isVpnEstablished
            else -> false
        }

        if (needsRestart) {
            Log.w(TAG, "VPN absent après ${intent.action} → relance")
            val allowlistMode = prefs.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false)
            val vpnIntent = Intent(context, NetLockVpnService::class.java).apply {
                action = "START"
                putExtra("allowlist_mode", allowlistMode)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    context.startForegroundService(vpnIntent)
                else
                    context.startService(vpnIntent)
            } catch (e: Exception) { Log.e(TAG, "restart VPN: ${e.message}") }
        }
    }

    private fun isNetworkAvailable(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION") cm.activeNetworkInfo?.isConnected == true
        }
    }

    companion object { const val TAG = "VpnRestartReceiver" }
}