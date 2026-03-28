package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * BootReceiver — Redémarre le VPN et la session Focus après un reboot.
 * directBootAware="true" dans le manifest → s'exécute même avant le déverrouillage.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val intentAction = intent.action
        if (intentAction != Intent.ACTION_BOOT_COMPLETED &&
            intentAction != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            intentAction != "android.intent.action.QUICKBOOT_POWERON" &&
            intentAction != "com.htc.intent.action.QUICKBOOT_POWERON") return

        val vpnPrefs   = context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        val focusPrefs = context.getSharedPreferences("netoff_focus", Context.MODE_PRIVATE)

        // ── 1. Redémarrer le VPN ───────────────────────────────────────────
        val vpnWasActive  = vpnPrefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)
        val allowlistMode = vpnPrefs.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false)

        if (vpnWasActive) {
            val vpnIntent = Intent(context, NetLockVpnService::class.java).apply {
                action = "START"
                putExtra("allowlist_mode", allowlistMode)
            }
            startService(context, vpnIntent)
        }

        // ── 2. Reprendre la session Focus ──────────────────────────────────
        val focusActive  = focusPrefs.getBoolean(FocusModule.KEY_ACTIVE, false)
        val focusEndTime = focusPrefs.getLong(FocusModule.KEY_END_TIME, 0L)
        val now          = System.currentTimeMillis()

        if (focusActive && focusEndTime > now) {
            val packagesJson = focusPrefs.getString(FocusModule.KEY_PACKAGES, "[]") ?: "[]"
            try {
                val arr = org.json.JSONArray(packagesJson)
                val set = HashSet<String>()
                for (i in 0 until arr.length()) set.add(arr.getString(i))
                NetLockVpnService.blockedPackages = set
                startService(context, Intent(context, NetLockVpnService::class.java).apply { action = "UPDATE_RULES" })
            } catch (_: Exception) {}
            scheduleFocusEndAlarm(context, focusEndTime)
        } else if (focusActive) {
            // Session expirée pendant le reboot → nettoyer
            focusPrefs.edit()
                .putBoolean(FocusModule.KEY_ACTIVE, false)
                .remove(FocusModule.KEY_END_TIME)
                .remove(FocusModule.KEY_PACKAGES)
                .apply()
        }

        // ── 3. Watchdog ────────────────────────────────────────────────────
        WatchdogWorker.scheduleIfNeeded(context)

        // ── 4. Widget ──────────────────────────────────────────────────────
        NetOffWidget.forceUpdate(context)
    }

    private fun startService(context: Context, intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            context.startForegroundService(intent)
        else
            context.startService(intent)
    }

    private fun scheduleFocusEndAlarm(context: Context, endTime: Long) {
        val am    = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        else android.app.PendingIntent.FLAG_UPDATE_CURRENT
        val pi = android.app.PendingIntent.getBroadcast(
            context, FocusModule.REQUEST_CODE,
            Intent(context, FocusReceiver::class.java).apply { action = FocusModule.ACTION_FOCUS_END },
            flags
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, endTime, pi)
        else
            am.setExact(android.app.AlarmManager.RTC_WAKEUP, endTime, pi)
    }
}