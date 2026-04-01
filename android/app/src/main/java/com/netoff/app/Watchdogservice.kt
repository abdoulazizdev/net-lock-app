package com.netoff.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.*
import java.util.concurrent.TimeUnit

/**
 * WatchdogWorker — Vérifie toutes les 15 min que le VPN tourne.
 *
 * AMÉLIORATIONS :
 *   1. Lit depuis Device Protected Storage (accessible avant déverrouillage)
 *   2. scheduleOnBoot() utilise REPLACE (pas KEEP) pour forcer un refresh
 *   3. scheduleWithBackupAlarm() planifie WorkManager + alarme AlarmManager
 *      comme double filet sur les appareils OEM qui bloquent WorkManager
 */
class WatchdogWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs       = getBestPrefs(context)
        val shouldBeActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

        if (!shouldBeActive) return Result.success()
        if (NetLockVpnService.isFocusActive(context)) return Result.success()

        if (!NetLockVpnService.isVpnEstablished) {
            Log.w(TAG, "Watchdog: VPN manquant → relance")
            notifyRestarted()
            restartVpn(prefs.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false))
        }
        return Result.success()
    }

    private fun restartVpn(allowlistMode: Boolean) {
        val intent = Intent(context, NetLockVpnService::class.java).apply {
            action = "START"
            putExtra("allowlist_mode", allowlistMode)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(intent)
            else
                context.startService(intent)
        } catch (e: Exception) { Log.e(TAG, "restartVpn: ${e.message}") }
    }

    private fun notifyRestarted() {
        val channelId = "netoff_watchdog"
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(channelId, "Watchdog NetOff", NotificationManager.IMPORTANCE_LOW)
                    .apply { description = "Surveillance du VPN" }
            )
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val pi = PendingIntent.getActivity(
            context, 0, context.packageManager.getLaunchIntentForPackage(context.packageName), flags
        )
        val notif = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("🛡 NetOff — VPN redémarré")
            .setContentText("Le VPN a été relancé automatiquement.")
            .setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_LOW).setContentIntent(pi)
            .build()
        nm.notify(NOTIF_ID, notif)
    }

    companion object {
        const val TAG       = "WatchdogWorker"
        const val NOTIF_ID  = 2001
        const val WORK_NAME = "netoff_watchdog"
        // Alarme backup toutes les 30 min (AlarmManager)
        const val BACKUP_ALARM_REQUEST_CODE = 8877

        /**
         * Lecture depuis Device Protected Storage si disponible.
         * Accessible même avant déverrouillage.
         */
        fun getBestPrefs(context: Context): android.content.SharedPreferences {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
                context.createDeviceProtectedStorageContext()
                    .getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
            else
                context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        }

        /**
         * Planifie WorkManager + alarme AlarmManager comme double filet.
         * À appeler au boot et à chaque démarrage de l'app.
         */
        fun scheduleWithBackupAlarm(context: Context) {
            // WorkManager — REPLACE pour forcer le recalcul après reboot
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
                .build()
            val request = PeriodicWorkRequestBuilder<WatchdogWorker>(15, TimeUnit.MINUTES, 5, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .addTag(WORK_NAME)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.REPLACE, // REPLACE après boot pour garantir la fraîcheur
                request
            )
            Log.d(TAG, "WorkManager watchdog planifié (REPLACE)")

            // Alarme AlarmManager backup toutes les 30 min
            // Survit aux OEM qui bloquent WorkManager
            scheduleBackupAlarm(context)
        }

        /** Planifie WorkManager KEEP (pour l'utilisation normale en cours de session) */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.NOT_REQUIRED).build()
            val request = PeriodicWorkRequestBuilder<WatchdogWorker>(15, TimeUnit.MINUTES, 5, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .addTag(WORK_NAME)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            cancelBackupAlarm(context)
        }

        /** Appel au boot — utilise REPLACE */
        fun scheduleOnBoot(context: Context) {
            val prefs = getBestPrefs(context)
            if (prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)) {
                scheduleWithBackupAlarm(context)
            }
        }

        /** Appel si VPN actif — utilise KEEP pour ne pas perturber un worker en cours */
        fun scheduleIfNeeded(context: Context) {
            val prefs = getBestPrefs(context)
            if (prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)) schedule(context)
        }

        private fun scheduleBackupAlarm(context: Context) {
            try {
                val intent  = Intent(context, WatchdogAlarmReceiver::class.java)
                val flags   = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                else PendingIntent.FLAG_UPDATE_CURRENT
                val pi = PendingIntent.getBroadcast(context, BACKUP_ALARM_REQUEST_CODE, intent, flags)
                val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val interval = 30 * 60 * 1000L // 30 min
                val trigger  = System.currentTimeMillis() + interval
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
                else
                    am.setExact(AlarmManager.RTC_WAKEUP, trigger, pi)
                Log.d(TAG, "Alarme backup planifiée dans 30 min")
            } catch (e: Exception) { Log.w(TAG, "scheduleBackupAlarm: ${e.message}") }
        }

        private fun cancelBackupAlarm(context: Context) {
            try {
                val intent = Intent(context, WatchdogAlarmReceiver::class.java)
                val flags  = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                else PendingIntent.FLAG_NO_CREATE
                val pi = PendingIntent.getBroadcast(context, BACKUP_ALARM_REQUEST_CODE, intent, flags)
                pi?.let { (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(it) }
            } catch (_: Exception) {}
        }
    }
}