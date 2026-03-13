package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Redémarre le VPN et la session Focus après un reboot du téléphone.
 * Déclenché par android.intent.action.BOOT_COMPLETED.
 * Les alarmes de planification sont gérées par ScheduleReceiver (déjà enregistré).
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val vpnPrefs = context.getSharedPreferences("netoff_vpn", Context.MODE_PRIVATE)
        val focusPrefs = context.getSharedPreferences("netoff_focus", Context.MODE_PRIVATE)

        // ── 1. Redémarrer le VPN si actif avant le reboot ────────────────────
        val vpnWasActive = vpnPrefs.getBoolean("vpn_was_active", false)
        if (vpnWasActive) {
            val vpnIntent = Intent(context, NetLockVpnService::class.java).apply {
                action = "START"
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(vpnIntent)
            } else {
                context.startService(vpnIntent)
            }
        }

        // ── 2. Reprendre la session Focus si elle n'est pas expirée ──────────
        val focusActive = focusPrefs.getBoolean(FocusModule.KEY_ACTIVE, false)
        val focusEndTime = focusPrefs.getLong(FocusModule.KEY_END_TIME, 0L)
        val now = System.currentTimeMillis()

        if (focusActive && focusEndTime > now) {
            // Reprogrammer l'alarme de fin (elle a été perdue au reboot)
            val packagesJson = focusPrefs.getString(FocusModule.KEY_PACKAGES, "[]") ?: "[]"

            // Réappliquer les règles VPN du focus
            try {
                val arr = org.json.JSONArray(packagesJson)
                val set = HashSet<String>()
                for (i in 0 until arr.length()) set.add(arr.getString(i))
                NetLockVpnService.blockedPackages = set

                val updateIntent = Intent(context, NetLockVpnService::class.java).apply { action = "UPDATE_RULES" }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    context.startForegroundService(updateIntent)
                else
                    context.startService(updateIntent)
            } catch (_: Exception) {}

            // Reprogrammer l'alarme de fin Focus
            scheduleFocusEndAlarm(context, focusEndTime)

        } else if (focusActive && focusEndTime <= now) {
            // Session expirée pendant le reboot → nettoyer
            focusPrefs.edit()
                .putBoolean(FocusModule.KEY_ACTIVE, false)
                .remove(FocusModule.KEY_END_TIME)
                .remove(FocusModule.KEY_PACKAGES)
                .apply()
        }

        // ── 3. Mettre à jour le widget ────────────────────────────────────────
        NetOffWidget.forceUpdate(context)
    }

    private fun scheduleFocusEndAlarm(context: Context, endTime: Long) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        else android.app.PendingIntent.FLAG_UPDATE_CURRENT

        val intent = Intent(context, FocusReceiver::class.java).apply { action = FocusModule.ACTION_FOCUS_END }
        val pi = android.app.PendingIntent.getBroadcast(context, FocusModule.REQUEST_CODE, intent, flags)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, endTime, pi)
        else
            am.setExact(android.app.AlarmManager.RTC_WAKEUP, endTime, pi)
    }
}