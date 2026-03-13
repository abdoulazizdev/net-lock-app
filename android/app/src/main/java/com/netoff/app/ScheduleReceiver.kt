package com.netoff.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import java.util.Calendar

class ScheduleReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "ScheduleReceiver"
        const val EXTRA_ACTION           = "action"           // "activate" | "deactivate"
        const val EXTRA_BLOCKED_PACKAGES = "blockedPackages"  // JSON array de strings
        const val EXTRA_SCHEDULE_ID      = "scheduleId"
        const val EXTRA_REQUEST_CODE     = "requestCode"      // pour reprogrammer
        const val EXTRA_DAY_OF_WEEK      = "dayOfWeek"        // Calendar.DAY_OF_WEEK
        const val EXTRA_HOUR             = "hour"
        const val EXTRA_MINUTE           = "minute"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "com.netoff.app.SCHEDULE_TRIGGER" -> handleScheduleTrigger(context, intent)
            Intent.ACTION_BOOT_COMPLETED       -> handleBoot(context)
            else -> Log.w(TAG, "Intent non géré : ${intent.action}")
        }
    }

    // ─── Traitement d'une alarme planifiée ────────────────────────────────────
    private fun handleScheduleTrigger(context: Context, intent: Intent) {
        val scheduleId   = intent.getStringExtra(EXTRA_SCHEDULE_ID)      ?: "?"
        val action       = intent.getStringExtra(EXTRA_ACTION)            ?: "activate"
        val packagesJson = intent.getStringExtra(EXTRA_BLOCKED_PACKAGES)  ?: "[]"
        val requestCode  = intent.getIntExtra(EXTRA_REQUEST_CODE, -1)
        val dayOfWeek    = intent.getIntExtra(EXTRA_DAY_OF_WEEK, -1)
        val hour         = intent.getIntExtra(EXTRA_HOUR, 0)
        val minute       = intent.getIntExtra(EXTRA_MINUTE, 0)

        Log.d(TAG, "Alarme déclenchée — id=$scheduleId action=$action")

        try {
            val packagesArray = JSONArray(packagesJson)
            val packageList = (0 until packagesArray.length()).map { packagesArray.getString(it) }

            // ── Mettre à jour le VPN ──────────────────────────────────────────
            when (action) {
                "activate" -> {
                    NetLockVpnService.blockedPackages = packageList.toHashSet()
                    Log.d(TAG, "Activation : ${packageList.size} app(s) bloquée(s)")
                }
                "deactivate" -> {
                    NetLockVpnService.blockedPackages = hashSetOf()
                    Log.d(TAG, "Désactivation : tout autorisé")
                }
            }

            // Demander au service VPN de reconstruire l'interface réseau
            val updateIntent = Intent(context, NetLockVpnService::class.java).apply {
                this.action = "UPDATE_RULES"
            }
            context.startService(updateIntent)

            // ── Reprogrammer l'alarme pour la semaine prochaine ───────────────
            // Android ne répète pas automatiquement les alarmes setExact
            if (requestCode != -1 && dayOfWeek != -1) {
                rescheduleNextWeek(context, intent, requestCode, dayOfWeek, hour, minute)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Erreur handleScheduleTrigger : ${e.message}", e)
        }
    }

    // ─── Reprogrammer l'alarme à J+7 ─────────────────────────────────────────
    private fun rescheduleNextWeek(
        context: Context,
        originalIntent: Intent,
        requestCode: Int,
        dayOfWeek: Int,
        hour: Int,
        minute: Int,
    ) {
        val cal = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, dayOfWeek)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            add(Calendar.WEEK_OF_YEAR, 1) // toujours la semaine prochaine
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_UPDATE_CURRENT

        val pi = PendingIntent.getBroadcast(context, requestCode, originalIntent, flags)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi)
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi)
        }

        Log.d(TAG, "Alarme reprogrammée à J+7 : ${cal.time}")
    }

    // ─── Redémarrage : log seulement (extension possible) ────────────────────
    private fun handleBoot(context: Context) {
        Log.d(TAG, "Boot reçu — les alarmes doivent être reprogrammées par l'app")
    }
}