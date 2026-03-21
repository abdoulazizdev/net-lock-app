package com.netoff.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.*
import java.util.concurrent.TimeUnit

// ─── WatchdogWorker ───────────────────────────────────────────────────────────
// Vérifie toutes les 15 min que le VPN est actif si il devrait l'être.
// WorkManager survive aux redémarrages et aux kills agressifs OEM.
class WatchdogWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs = context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        val shouldBeActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

        if (!shouldBeActive) return Result.success()

        // Focus actif → ne pas interférer
        if (NetLockVpnService.isFocusActive(context)) return Result.success()

        val isEstablished = NetLockVpnService.isVpnEstablished

        if (!isEstablished) {
            Log.w(TAG, "Watchdog: VPN devrait être actif mais ne l'est pas — redémarrage")
            notifyVpnRestarted()
            restartVpn()
        } else {
            Log.d(TAG, "Watchdog: VPN OK")
        }
        return Result.success()
    }

    private fun restartVpn() {
        val intent = Intent(context, NetLockVpnService::class.java).apply {
            action = "START"
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            context.startForegroundService(intent)
        else
            context.startService(intent)
    }

    private fun notifyVpnRestarted() {
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

        val openIntent = PendingIntent.getActivity(
            context, 0,
            context.packageManager.getLaunchIntentForPackage(context.packageName),
            flags
        )

        val notif = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("🛡 NetOff — VPN redémarré")
            .setContentText("Le VPN a été relancé automatiquement après une interruption.")
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openIntent)
            .build()

        nm.notify(NOTIF_ID, notif)
    }

    companion object {
        const val TAG     = "WatchdogWorker"
        const val NOTIF_ID = 2001
        const val WORK_NAME = "netoff_watchdog"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
                .build()

            val request = PeriodicWorkRequestBuilder<WatchdogWorker>(
                15, TimeUnit.MINUTES,
                5,  TimeUnit.MINUTES   // flex — Android peut décaler dans cette fenêtre
            )
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .addTag(WORK_NAME)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            Log.d(TAG, "Watchdog planifié (15 min)")
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Watchdog annulé")
        }

        fun scheduleIfNeeded(context: Context) {
            val prefs = context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)) schedule(context)
        }
    }
}