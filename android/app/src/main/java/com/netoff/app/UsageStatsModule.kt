package com.netoff.app

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*

class UsageStatsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "UsageStatsModule"
  }

  @ReactMethod
  fun openUsageAccessSettings() {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
    reactApplicationContext.startActivity(intent)
  }

  @ReactMethod
  fun getUsageStats(promise: Promise) {
    try {
      val usm =
        reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

      val time = System.currentTimeMillis()

      val stats = usm.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        time - 1000 * 60 * 60 * 24,
        time
      )

      val result = Arguments.createArray()

      stats?.forEach {
        val map = Arguments.createMap()
        map.putString("packageName", it.packageName)
        map.putDouble("lastTimeUsed", it.lastTimeUsed.toDouble())
        result.pushMap(map)
      }

      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("ERROR", e)
    }
  }
}