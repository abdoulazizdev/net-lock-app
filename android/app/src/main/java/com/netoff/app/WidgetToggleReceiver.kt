package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Reçoit l'action de toggle VPN depuis le widget.
 * Lit l'état courant du VPN et l'inverse.
 */
class WidgetToggleReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TOGGLE_VPN = "com.netoff.app.WIDGET_TOGGLE_VPN"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_TOGGLE_VPN) return

        val prefs = context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        val isActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

        val vpnIntent = Intent(context, NetLockVpnService::class.java).apply {
            action = if (isActive) "STOP" else "START"
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(vpnIntent)
        } else {
            context.startService(vpnIntent)
        }

        // Mise à jour immédiate du widget (le service le mettra aussi à jour via onStartCommand)
        NetOffWidget.forceUpdate(context)
    }
}