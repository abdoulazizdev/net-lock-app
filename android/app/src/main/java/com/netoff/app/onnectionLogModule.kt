package com.netoff.app

import android.content.Context
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

class ConnectionLogModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "ConnectionLogModule"

    companion object {
        const val PREFS         = "netoff_conn_log"
        const val KEY_LOGS      = "logs"
        const val MAX_ENTRIES   = 500

        /**
         * Appelé depuis NetLockVpnService à chaque tentative interceptée.
         * Thread-safe : synchronized sur le fichier prefs.
         */
        fun appendLog(context: Context, packageName: String, action: String) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val raw   = prefs.getString(KEY_LOGS, "[]") ?: "[]"
            val arr   = try { JSONArray(raw) } catch (_: Exception) { JSONArray() }

            val entry = JSONObject().apply {
                put("packageName", packageName)
                put("action",      action)          // "blocked" | "allowed"
                put("timestamp",   System.currentTimeMillis())
            }

            // Insérer en tête (index 0 = plus récent)
            val newArr = JSONArray()
            newArr.put(entry)
            val limit = minOf(arr.length(), MAX_ENTRIES - 1)
            for (i in 0 until limit) newArr.put(arr.get(i))

            prefs.edit().putString(KEY_LOGS, newArr.toString()).apply()
        }

        fun clearLogs(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().remove(KEY_LOGS).apply()
        }
    }

    // ── Exposé à JS ───────────────────────────────────────────────────────

    @ReactMethod
    fun getLogs(limit: Int, promise: Promise) {
        try {
            val raw  = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                          .getString(KEY_LOGS, "[]") ?: "[]"
            val arr  = try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
            val result = Arguments.createArray()
            val count  = minOf(arr.length(), if (limit > 0) limit else arr.length())
            for (i in 0 until count) {
                val obj = arr.getJSONObject(i)
                result.pushMap(Arguments.createMap().apply {
                    putString("packageName", obj.getString("packageName"))
                    putString("action",      obj.getString("action"))
                    putDouble("timestamp",   obj.getLong("timestamp").toDouble())
                })
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("LOG_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearLogs(promise: Promise) {
        clearLogs(ctx)
        promise.resolve(true)
    }

    @ReactMethod
    fun getStats(promise: Promise) {
        try {
            val raw   = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                           .getString(KEY_LOGS, "[]") ?: "[]"
            val arr   = try { JSONArray(raw) } catch (_: Exception) { JSONArray() }

            var blocked = 0; var allowed = 0
            val perApp  = mutableMapOf<String, JSONObject>()

            for (i in 0 until arr.length()) {
                val obj  = arr.getJSONObject(i)
                val pkg  = obj.getString("packageName")
                val act  = obj.getString("action")
                val ts   = obj.getLong("timestamp")

                if (act == "blocked") blocked++ else allowed++

                val entry = perApp.getOrPut(pkg) {
                    JSONObject().apply {
                        put("packageName",    pkg)
                        put("blockedCount",   0)
                        put("allowedCount",   0)
                        put("lastAttempt",    0L)
                    }
                }
                if (act == "blocked") entry.put("blockedCount", entry.getInt("blockedCount") + 1)
                else                  entry.put("allowedCount", entry.getInt("allowedCount") + 1)
                if (ts > entry.getLong("lastAttempt")) entry.put("lastAttempt", ts)
            }

            val appStats = Arguments.createArray()
            perApp.values
                .sortedByDescending { it.getInt("blockedCount") }
                .forEach { obj ->
                    appStats.pushMap(Arguments.createMap().apply {
                        putString("packageName",  obj.getString("packageName"))
                        putInt("blockedCount",    obj.getInt("blockedCount"))
                        putInt("allowedCount",    obj.getInt("allowedCount"))
                        putDouble("lastAttempt",  obj.getLong("lastAttempt").toDouble())
                    })
                }

            promise.resolve(Arguments.createMap().apply {
                putInt("totalBlocked", blocked)
                putInt("totalAllowed", allowed)
                putInt("totalEvents",  arr.length())
                putArray("perApp",     appStats)
            })
        } catch (e: Exception) {
            promise.reject("LOG_ERROR", e.message, e)
        }
    }
}