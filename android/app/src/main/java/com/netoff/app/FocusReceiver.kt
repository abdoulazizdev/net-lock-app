package com.netoff.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class FocusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != FocusModule.ACTION_FOCUS_END) return

        val prefs = context.getSharedPreferences("netoff_focus", Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(FocusModule.KEY_ACTIVE, false)
            .remove(FocusModule.KEY_END_TIME)
            .remove(FocusModule.KEY_PACKAGES)
            .apply()

        // Libérer le VPN
        NetLockVpnService.blockedPackages = hashSetOf()
        context.startService(Intent(context, NetLockVpnService::class.java).apply { action = "UPDATE_RULES" })

        // Retirer la notification active
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(FocusModule.NOTIF_ACTIVE_ID)

        // Notification de fin
        showEndNotification(context, nm, prefs.getString(FocusModule.KEY_PROFILE_NAME, "Focus") ?: "Focus")
    }

    private fun showEndNotification(context: Context, nm: NotificationManager, profileName: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(FocusModule.NOTIF_CHANNEL, "Mode Focus", NotificationManager.IMPORTANCE_HIGH)
            nm.createNotificationChannel(ch)
        }
        val notif = androidx.core.app.NotificationCompat.Builder(context, FocusModule.NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("✅ Session Focus terminée !")
            .setContentText("$profileName — Bien joué, toutes les apps sont débloquées.")
            .setAutoCancel(true)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .build()
        nm.notify(FocusModule.NOTIF_END_ID, notif)
    }
}