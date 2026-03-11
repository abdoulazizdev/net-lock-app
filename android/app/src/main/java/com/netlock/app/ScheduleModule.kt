package com.netoff.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*
import org.json.JSONArray
import java.util.Calendar

class ScheduleModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ScheduleModule"

    @ReactMethod
    fun scheduleAlarms(schedulesJson: String, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val schedules = JSONArray(schedulesJson)

            for (i in 0 until schedules.length()) {
                val schedule = schedules.getJSONObject(i)
                val id = schedule.getString("id")
                val packageName = schedule.getString("packageName")
                val action = schedule.getString("action")
                val startHour = schedule.getInt("startHour")
                val startMinute = schedule.getInt("startMinute")
                val endHour = schedule.getInt("endHour")
                val endMinute = schedule.getInt("endMinute")
                val days = schedule.getJSONArray("days")

                for (d in 0 until days.length()) {
                    val day = days.getInt(d)

                    // Alarme de début (block/allow)
                    setAlarm(alarmManager, "${id}_start_$d", packageName, action, startHour, startMinute, day)

                    // Alarme de fin (inverse)
                    val endAction = if (action == "block") "allow" else "block"
                    setAlarm(alarmManager, "${id}_end_$d", packageName, endAction, endHour, endMinute, day)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun setAlarm(
        alarmManager: AlarmManager,
        alarmId: String,
        packageName: String,
        action: String,
        hour: Int,
        minute: Int,
        dayOfWeek: Int
    ) {
        val intent = Intent(reactContext, ScheduleReceiver::class.java).apply {
            putExtra("packageName", packageName)
            putExtra("action", action)
        }

        val requestCode = alarmId.hashCode()
        val pendingIntent = PendingIntent.getBroadcast(
            reactContext, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val calendar = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, dayOfWeek + 1) // Calendar: 1=Dim
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) {
                add(Calendar.WEEK_OF_YEAR, 1)
            }
        }

        alarmManager.setRepeating(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            AlarmManager.INTERVAL_DAY * 7,
            pendingIntent
        )
    }
}