package com.netoff.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*

class FocusModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FocusModule"

    private val prefs get() = reactContext.getSharedPreferences("netoff_focus", Context.MODE_PRIVATE)

    companion object {
        const val KEY_END_TIME       = "focus_end_time"
        const val KEY_ACTIVE         = "focus_active"
        const val KEY_PACKAGES       = "focus_packages"
        const val KEY_PROFILE_NAME   = "focus_profile_name"
        const val KEY_DURATION_MIN   = "focus_duration_min"
        const val ACTION_FOCUS_END   = "com.netoff.app.FOCUS_END"
        const val REQUEST_CODE       = 9001
        const val NOTIF_CHANNEL      = "netoff_focus"
        const val NOTIF_ACTIVE_ID    = 9002
        const val NOTIF_END_ID       = 9003
    }

    // ── Démarrer une session Focus ─────────────────────────────────────────
    @ReactMethod
    fun startFocus(durationMs: Double, blockedPackagesJson: String, profileName: String, promise: Promise) {
        try {
            val endTime = System.currentTimeMillis() + durationMs.toLong()

            prefs.edit()
                .putLong(KEY_END_TIME, endTime)
                .putBoolean(KEY_ACTIVE, true)
                .putString(KEY_PACKAGES, blockedPackagesJson)
                .putString(KEY_PROFILE_NAME, profileName)
                .putInt(KEY_DURATION_MIN, (durationMs / 60000).toInt())
                .apply()

            // Appliquer au VPN
            applyVpnRules(blockedPackagesJson)

            // Alarme de fin
            scheduleEndAlarm(endTime)

            // Notification persistante
            showActiveNotification(profileName, endTime)

            promise.resolve(endTime.toDouble())
        } catch (e: Exception) {
            promise.reject("FOCUS_ERROR", e.message, e)
        }
    }

    // ── Arrêter la session (appelé par JS force-stop ou par FocusReceiver) ─
    @ReactMethod
    fun stopFocus(promise: Promise) {
        try {
            prefs.edit()
                .remove(KEY_END_TIME)
                .putBoolean(KEY_ACTIVE, false)
                .remove(KEY_PACKAGES)
                .remove(KEY_PROFILE_NAME)
                .apply()

            cancelEndAlarm()
            clearVpnRules()
            dismissActiveNotification()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FOCUS_ERROR", e.message, e)
        }
    }

    // ── Lire l'état courant ───────────────────────────────────────────────
    @ReactMethod
    fun getFocusStatus(promise: Promise) {
        try {
            val isActive  = prefs.getBoolean(KEY_ACTIVE, false)
            val endTime   = prefs.getLong(KEY_END_TIME, 0)
            val remaining = endTime - System.currentTimeMillis()

            val result = Arguments.createMap().apply {
                putBoolean("isActive",     isActive && remaining > 0)
                putDouble("endTime",       endTime.toDouble())
                putDouble("remainingMs",   if (remaining > 0) remaining.toDouble() else 0.0)
                putString("profileName",   prefs.getString(KEY_PROFILE_NAME, "") ?: "")
                putString("packages",      prefs.getString(KEY_PACKAGES, "[]") ?: "[]")
                putInt("durationMinutes",  prefs.getInt(KEY_DURATION_MIN, 0))
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("FOCUS_ERROR", e.message, e)
        }
    }

    // ── VPN ───────────────────────────────────────────────────────────────
    private fun applyVpnRules(packagesJson: String) {
        val arr = org.json.JSONArray(packagesJson)
        val set = HashSet<String>()
        for (i in 0 until arr.length()) set.add(arr.getString(i))
        NetLockVpnService.blockedPackages = set
        reactContext.startService(Intent(reactContext, NetLockVpnService::class.java).apply { action = "UPDATE_RULES" })
    }

    private fun clearVpnRules() {
        NetLockVpnService.blockedPackages = hashSetOf()
        reactContext.startService(Intent(reactContext, NetLockVpnService::class.java).apply { action = "UPDATE_RULES" })
    }

    // ── AlarmManager ─────────────────────────────────────────────────────
    private fun scheduleEndAlarm(endTime: Long) {
        val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = buildPendingIntent()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endTime, pi)
        else
            am.setExact(AlarmManager.RTC_WAKEUP, endTime, pi)
    }

    private fun cancelEndAlarm() {
        val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_NO_CREATE
        val intent = Intent(reactContext, FocusReceiver::class.java).apply { action = ACTION_FOCUS_END }
        PendingIntent.getBroadcast(reactContext, REQUEST_CODE, intent, flags)?.let { am.cancel(it); it.cancel() }
    }

    private fun buildPendingIntent(): PendingIntent {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val intent = Intent(reactContext, FocusReceiver::class.java).apply { action = ACTION_FOCUS_END }
        return PendingIntent.getBroadcast(reactContext, REQUEST_CODE, intent, flags)
    }

    // ── Notifications ─────────────────────────────────────────────────────
    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(NOTIF_CHANNEL, "Mode Focus", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Suivi de session Focus"
            }
            nm.createNotificationChannel(ch)
        }
    }

    private fun showActiveNotification(profileName: String, endTime: Long) {
        ensureChannel()
        val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val mins = ((endTime - System.currentTimeMillis()) / 60000).toInt()
        val notif = NotificationCompat.Builder(reactContext, NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("🎯 Session Focus active")
            .setContentText("$profileName — encore $mins min")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        nm.notify(NOTIF_ACTIVE_ID, notif)
    }

    private fun dismissActiveNotification() {
        val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIF_ACTIVE_ID)
    }
}