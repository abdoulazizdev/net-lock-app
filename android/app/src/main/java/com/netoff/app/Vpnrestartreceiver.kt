package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log

/**
 * VpnRestartReceiver — Relance le VPN après interruption.
 *
 * Déclenché par :
 *   - USER_PRESENT / SCREEN_ON  → déverrouillage (Huawei tue le VPN en veille)
 *   - CONNECTIVITY_CHANGE       → changement Wi-Fi/4G (EMUI coupe parfois le VPN)
 *   - ACTION_POWER_CONNECTED    → branchement chargeur
 *
 * Ne fait rien si vpn_was_active = false ou si Focus est actif.
 */
class VpnRestartReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        val shouldBeActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

        if (!shouldBeActive) return
        if (NetLockVpnService.isFocusActive(context)) return

        Log.d(TAG, "onReceive: ${intent.action} — isEstablished=${NetLockVpnService.isVpnEstablished}")

        val needsRestart = when (intent.action) {
            Intent.ACTION_USER_PRESENT,
            Intent.ACTION_SCREEN_ON -> !NetLockVpnService.isVpnEstablished
            ConnectivityManager.CONNECTIVITY_ACTION ->
                !NetLockVpnService.isVpnEstablished && isNetworkAvailable(context)
            Intent.ACTION_POWER_CONNECTED -> !NetLockVpnService.isVpnEstablished
            else -> false
        }

        if (needsRestart) {
            Log.w(TAG, "VPN absent — redémarrage (${intent.action})")
            restartVpn(context, prefs.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false))
        }
    }

    private fun restartVpn(context: Context, allowlistMode: Boolean) {
        val intent = Intent(context, NetLockVpnService::class.java).apply {
            action = "START"
            putExtra("allowlist_mode", allowlistMode)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(intent)
            else
                context.startService(intent)
        } catch (e: Exception) {
            Log.e(TAG, "restartVpn failed: ${e.message}")
        }
    }

    private fun isNetworkAvailable(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val net  = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(net) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            cm.activeNetworkInfo?.isConnected == true
        }
    }

    companion object { const val TAG = "VpnRestartReceiver" }
}