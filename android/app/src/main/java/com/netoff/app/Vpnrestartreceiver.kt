package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log

/**
 * VpnRestartReceiver — Redémarre le VPN sur les événements réseau.
 *
 * Certains OEM (Huawei, Xiaomi) coupe le VPN lors :
 *  - d'un changement réseau (Wifi → 4G, avion → normal)
 *  - d'un retour en veille profonde
 *  - d'un déverrouillage de l'écran après inactivité prolongée
 *
 * Ce receiver écoute ces événements et relance si nécessaire.
 * Enregistré dans AndroidManifest.xml.
 */
class VpnRestartReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        val shouldBeActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

        Log.d(TAG, "onReceive: ${intent.action} — shouldBeActive=$shouldBeActive, isEstablished=${NetLockVpnService.isVpnEstablished}")

        if (!shouldBeActive) return
        if (NetLockVpnService.isFocusActive(context)) return

        when (intent.action) {
            // Écran déverrouillé → vérifier que le VPN tourne encore
            Intent.ACTION_USER_PRESENT,
            Intent.ACTION_SCREEN_ON -> {
                if (!NetLockVpnService.isVpnEstablished) {
                    Log.w(TAG, "VPN absent après déverrouillage → redémarrage")
                    restartVpn(context)
                }
            }

            // Changement de connectivité → certains OEM coupent le VPN à ce moment
            ConnectivityManager.CONNECTIVITY_ACTION -> {
                if (!NetLockVpnService.isVpnEstablished && isNetworkAvailable(context)) {
                    Log.w(TAG, "VPN absent après changement réseau → redémarrage")
                    restartVpn(context)
                }
            }

            // Batterie rechargée / branchée — Huawei peut réactiver des process tués
            Intent.ACTION_POWER_CONNECTED -> {
                if (!NetLockVpnService.isVpnEstablished) {
                    Log.d(TAG, "Chargeur branché — revérification VPN")
                    restartVpn(context)
                }
            }
        }
    }

    private fun restartVpn(context: Context) {
        val intent = Intent(context, NetLockVpnService::class.java).apply { action = "START" }
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
            val net = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(net) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            cm.activeNetworkInfo?.isConnected == true
        }
    }

    companion object { const val TAG = "VpnRestartReceiver" }
}