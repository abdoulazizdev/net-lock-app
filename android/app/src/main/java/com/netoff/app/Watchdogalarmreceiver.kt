package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * WatchdogAlarmReceiver — Backup AlarmManager pour le watchdog.
 *
 * Déclenché toutes les 30 min par l'AlarmManager.
 * Si WorkManager a été tué ou bloqué par l'OEM, ce receiver
 * vérifie et relance le VPN si nécessaire.
 *
 * Aussi déclenché sur USER_PRESENT (déverrouillage) par VpnRestartReceiver
 * pour couvrir le cas où le VPN a été tué pendant la veille.
 */
class WatchdogAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "onReceive: ${intent.action}")

        val prefs         = WatchdogWorker.getBestPrefs(context)
        val shouldBeActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

        if (!shouldBeActive) {
            Log.d(TAG, "VPN inactif — pas d'action")
            return
        }
        if (NetLockVpnService.isFocusActive(context)) return

        if (!NetLockVpnService.isVpnEstablished) {
            Log.w(TAG, "VPN absent → relance depuis WatchdogAlarmReceiver")
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
            } catch (e: Exception) {
                Log.e(TAG, "startVpn depuis alarm: ${e.message}")
            }
        }

        // Replanifier l'alarme pour la prochaine vérification
        WatchdogWorker.scheduleIfNeeded(context)
    }

    companion object { const val TAG = "WatchdogAlarmReceiver" }
}