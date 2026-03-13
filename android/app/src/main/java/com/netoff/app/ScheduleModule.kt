package com.netoff.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class ScheduleModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "ScheduleModule"
        // Base pour les requestCode des PendingIntents (début = 10000, fin = 10000+n)
        const val REQUEST_CODE_BASE = 10_000
    }

    override fun getName() = "ScheduleModule"

    /**
     * Reçoit un JSON array de planifications.
     * Chaque entrée :
     * {
     *   id: string,
     *   days: number[],          // 0=Dim … 6=Sam
     *   startHour: number,
     *   startMinute: number,
     *   endHour: number,
     *   endMinute: number,
     *   action: "activate"|"deactivate",
     *   blockedPackages: string[]   // ← NEW : packages à passer au VPN
     * }
     *
     * Passer un tableau vide [] annule toutes les alarmes.
     */
    @ReactMethod
    fun scheduleAlarms(schedulesJson: String, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val entries = JSONArray(schedulesJson)

            // ── 1. Annuler toutes les alarmes existantes (jusqu'à 200) ────────
            cancelAllAlarms(alarmManager)

            if (entries.length() == 0) {
                Log.d(TAG, "scheduleAlarms: liste vide → toutes les alarmes annulées")
                promise.resolve(null)
                return
            }

            // ── 2. Créer une alarme par (schedule × heure de début + heure de fin) ──
            var alarmIndex = 0

            for (i in 0 until entries.length()) {
                val entry = entries.getJSONObject(i)
                val scheduleId      = entry.getString("id")
                val daysArray       = entry.getJSONArray("days")
                val startHour       = entry.getInt("startHour")
                val startMinute     = entry.getInt("startMinute")
                val endHour         = entry.getInt("endHour")
                val endMinute       = entry.getInt("endMinute")
                val action          = entry.getString("action")
                val packagesJson    = entry.getJSONArray("blockedPackages").toString()

                val days = (0 until daysArray.length()).map { daysArray.getInt(it) }

                for (day in days) {
                    // Alarme de DÉBUT (action = ce que l'entrée demande)
                    scheduleWeeklyAlarm(
                        alarmManager   = alarmManager,
                        requestCode    = REQUEST_CODE_BASE + alarmIndex++,
                        dayOfWeek      = day,
                        hour           = startHour,
                        minute         = startMinute,
                        action         = action,
                        scheduleId     = scheduleId,
                        packagesJson   = packagesJson,
                    )

                    // Alarme de FIN (action inversée)
                    val endAction = if (action == "activate") "deactivate" else "activate"
                    // Pour la fin d'une plage "activate" → packages vides (tout autoriser)
                    val endPackages = if (action == "activate") "[]" else packagesJson

                    scheduleWeeklyAlarm(
                        alarmManager   = alarmManager,
                        requestCode    = REQUEST_CODE_BASE + alarmIndex++,
                        dayOfWeek      = day,
                        hour           = endHour,
                        minute         = endMinute,
                        action         = endAction,
                        scheduleId     = "${scheduleId}_end",
                        packagesJson   = endPackages,
                    )
                }

                Log.d(TAG, "Planifié : $scheduleId action=$action ${days.size} jours")
            }

            Log.d(TAG, "scheduleAlarms: $alarmIndex alarme(s) enregistrée(s)")
            promise.resolve(alarmIndex)

        } catch (e: Exception) {
            Log.e(TAG, "Erreur scheduleAlarms : ${e.message}", e)
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    // ─── Programmer une alarme hebdomadaire ────────────────────────────────────
    private fun scheduleWeeklyAlarm(
        alarmManager: AlarmManager,
        requestCode: Int,
        dayOfWeek: Int,   // 0=Dim … 6=Sam  (standard JS)
        hour: Int,
        minute: Int,
        action: String,
        scheduleId: String,
        packagesJson: String,
    ) {
        // Convertir jour JS (0=Dim) -> Calendar.DAY_OF_WEEK (Dim=1 ... Sam=7)
        val calDay = dayOfWeek + 1  // Calendar.SUNDAY=1, Calendar.SATURDAY=7

        val intent = Intent(reactContext, ScheduleReceiver::class.java).apply {
            this.action = "com.netoff.app.SCHEDULE_TRIGGER"
            putExtra(ScheduleReceiver.EXTRA_ACTION,           action)
            putExtra(ScheduleReceiver.EXTRA_SCHEDULE_ID,      scheduleId)
            putExtra(ScheduleReceiver.EXTRA_BLOCKED_PACKAGES, packagesJson)
            // Extras pour que le Receiver puisse reprogrammer J+7
            putExtra(ScheduleReceiver.EXTRA_REQUEST_CODE,     requestCode)
            putExtra(ScheduleReceiver.EXTRA_DAY_OF_WEEK,      calDay)
            putExtra(ScheduleReceiver.EXTRA_HOUR,             hour)
            putExtra(ScheduleReceiver.EXTRA_MINUTE,           minute)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_UPDATE_CURRENT

        val pendingIntent = PendingIntent.getBroadcast(reactContext, requestCode, intent, flags)


        val trigger = nextWeeklyTrigger(calDay, hour, minute)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)
        }

        // Note : sur Android, les alarmes setExact ne se répètent pas automatiquement.
        // Le ScheduleReceiver doit reprogrammer l'alarme suivante (même jour, +7 jours)
        // après chaque déclenchement. Voir handleScheduleTrigger dans ScheduleReceiver.kt.
    }

    // ─── Calcule le prochain déclenchement (this week or next week) ────────────
    private fun nextWeeklyTrigger(calDay: Int, hour: Int, minute: Int): Long {
        val cal = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, calDay)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        // Si le moment est déjà passé cette semaine, décaler d'une semaine
        if (cal.timeInMillis <= System.currentTimeMillis()) {
            cal.add(Calendar.WEEK_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }

    // ─── Annuler les alarmes existantes (jusqu'à 200) ─────────────────────────
    private fun cancelAllAlarms(alarmManager: AlarmManager) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_NO_CREATE

        for (i in 0 until 200) {
            val intent = Intent(reactContext, ScheduleReceiver::class.java)
            intent.action = "com.netoff.app.SCHEDULE_TRIGGER"
            val pi = PendingIntent.getBroadcast(
                reactContext, REQUEST_CODE_BASE + i, intent, flags
            ) ?: continue
            alarmManager.cancel(pi)
            pi.cancel()
        }
    }
}