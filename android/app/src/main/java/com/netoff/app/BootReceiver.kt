package com.netoff.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONArray

/**
 * BootReceiver — Restaure le VPN et tous les services après un reboot.
 *
 * PROBLÈME RÉSOLU : Device Protected Storage vs Credential Encrypted Storage
 *
 * getSharedPreferences(MODE_PRIVATE) = CE (Credential Encrypted).
 * CE est chiffré et inaccessible avant que l'utilisateur déverrouille.
 *
 * Solution : les données critiques sont stockées dans Device Protected (DE)
 * storage via createDeviceProtectedStorageContext(). DE est accessible dès
 * le boot, même avant déverrouillage.
 *
 * Flux :
 *   LOCKED_BOOT_COMPLETED (avant déverrou) :
 *     → Lire depuis DE storage → démarrer VPN si actif
 *     → Planifier alarme USER_PRESENT comme backup
 *
 *   BOOT_COMPLETED (après déverrouillage) :
 *     → Lire depuis DE et CE → démarrer VPN, Focus, Watchdog
 *     → Planifier alarme backup 2min (si service n'a pas pu démarrer)
 *
 *   USER_PRESENT (déverrouillage écran) :
 *     → Vérifier que le VPN tourne, relancer si besoin
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "BootReceiver"
        const val ACTION_DELAYED_START = "com.netoff.app.DELAYED_VPN_START"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.d(TAG, "onReceive: $action")

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> {
                // Phase 2 : déverrouillé, CE + DE accessibles
                handleBootCompleted(context, isLocked = false)
            }
            Intent.ACTION_LOCKED_BOOT_COMPLETED -> {
                // Phase 1 : chiffré, seul DE accessible
                handleBootCompleted(context, isLocked = true)
            }
            ACTION_DELAYED_START -> {
                // Alarme backup déclenchée après déverrouillage
                handleDelayedStart(context)
            }
            else -> return
        }
    }

    private fun handleBootCompleted(context: Context, isLocked: Boolean) {
        // goAsync() donne jusqu'à 30s au receiver (au lieu de ~5s)
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Lire depuis Device Protected Storage (toujours accessible)
                val dePrefs = getDeviceProtectedPrefs(context)
                val vpnWasActive  = dePrefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)
                val allowlistMode = dePrefs.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false)

                Log.d(TAG, "Boot [locked=$isLocked] — vpnActive=$vpnWasActive, allowlist=$allowlistMode")

                if (vpnWasActive) {
                    // Restaurer les packages bloqués dans les caches statiques
                    restorePackagesFromPrefs(dePrefs)

                    // Démarrer le service VPN
                    startVpnService(context, allowlistMode)
                    Log.i(TAG, "VPN service démarré depuis BootReceiver")
                }

                if (!isLocked) {
                    // Restauration Focus (seulement après déverrouillage)
                    restoreFocusSession(context)

                    // Planifier le Watchdog
                    WatchdogWorker.scheduleOnBoot(context)

                    // Alarme backup dans 2 min : si le service n'a pas démarré,
                    // le VpnRestartReceiver (USER_PRESENT) le relancera de toute façon
                    if (vpnWasActive) {
                        scheduleBackupAlarm(context, 2 * 60 * 1000L)
                    }
                } else {
                    // Avant déverrouillage : planifier une alarme pour USER_PRESENT
                    if (vpnWasActive) {
                        scheduleDelayedStartAlarm(context, 5000L)
                    }
                }

                // Widget
                NetOffWidget.forceUpdate(context)

            } catch (e: Exception) {
                Log.e(TAG, "handleBootCompleted error: ${e.message}", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun handleDelayedStart(context: Context) {
        val dePrefs = getDeviceProtectedPrefs(context)
        val vpnWasActive  = dePrefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)
        val allowlistMode = dePrefs.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false)
        if (vpnWasActive && !NetLockVpnService.isVpnEstablished) {
            restorePackagesFromPrefs(dePrefs)
            startVpnService(context, allowlistMode)
            Log.i(TAG, "VPN relancé depuis alarme delayed start")
        }
    }

    private fun restorePackagesFromPrefs(dePrefs: android.content.SharedPreferences) {
        try {
            val blockedJson = dePrefs.getString(VpnModule.KEY_BLOCKED_PKGS, "[]") ?: "[]"
            val allowedJson = dePrefs.getString(VpnModule.KEY_ALLOWED_PKGS, "[]") ?: "[]"
            NetLockVpnService.blockedPackages = parseJsonToSet(blockedJson)
            NetLockVpnService.allowedPackages = parseJsonToSet(allowedJson)
            NetLockVpnService.allowlistMode   = dePrefs.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false)
            Log.d(TAG, "Packages restaurés: blocked=${NetLockVpnService.blockedPackages.size}, " +
                    "allowed=${NetLockVpnService.allowedPackages.size}")
        } catch (e: Exception) {
            Log.w(TAG, "restorePackagesFromPrefs: ${e.message}")
        }
    }

    private fun restoreFocusSession(context: Context) {
        try {
            // Focus prefs dans CE storage (accessible après déverrouillage)
            val focusPrefs = context.getSharedPreferences("netoff_focus", Context.MODE_PRIVATE)
            val focusActive  = focusPrefs.getBoolean(FocusModule.KEY_ACTIVE, false)
            val focusEndTime = focusPrefs.getLong(FocusModule.KEY_END_TIME, 0L)
            val now          = System.currentTimeMillis()

            if (focusActive && focusEndTime > now) {
                Log.d(TAG, "Restauration session Focus (expire dans ${(focusEndTime - now) / 1000}s)")
                scheduleFocusEndAlarm(context, focusEndTime)
            } else if (focusActive) {
                // Session expirée → nettoyer
                focusPrefs.edit()
                    .putBoolean(FocusModule.KEY_ACTIVE, false)
                    .remove(FocusModule.KEY_END_TIME)
                    .remove(FocusModule.KEY_PACKAGES)
                    .apply()
                Log.d(TAG, "Session Focus expirée nettoyée")
            }
        } catch (e: Exception) {
            Log.w(TAG, "restoreFocusSession: ${e.message}")
        }
    }

    private fun startVpnService(context: Context, allowlistMode: Boolean) {
        val intent = Intent(context, NetLockVpnService::class.java).apply {
            action = "START"
            putExtra("allowlist_mode", allowlistMode)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(intent)
            else
                context.startService(intent)
        } catch (e: Exception) {
            Log.e(TAG, "startVpnService: ${e.message}")
        }
    }

    /** Alarme backup : déclenche ACTION_DELAYED_START après délai */
    private fun scheduleDelayedStartAlarm(context: Context, delayMs: Long) {
        val pi = buildDelayedStartPendingIntent(context)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val at = System.currentTimeMillis() + delayMs
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else
                am.setExact(AlarmManager.RTC_WAKEUP, at, pi)
            Log.d(TAG, "Alarme delayed start dans ${delayMs}ms")
        } catch (e: Exception) {
            Log.w(TAG, "scheduleDelayedStartAlarm: ${e.message}")
        }
    }

    /** Alarme backup plus longue pour s'assurer que tout est stable */
    private fun scheduleBackupAlarm(context: Context, delayMs: Long) {
        val pi = buildDelayedStartPendingIntent(context)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val at = System.currentTimeMillis() + delayMs
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else
                am.setExact(AlarmManager.RTC_WAKEUP, at, pi)
            Log.d(TAG, "Alarme backup dans ${delayMs / 1000}s")
        } catch (e: Exception) {
            Log.w(TAG, "scheduleBackupAlarm: ${e.message}")
        }
    }

    private fun buildDelayedStartPendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, BootReceiver::class.java).apply {
            action = ACTION_DELAYED_START
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getBroadcast(context, 42, intent, flags)
    }

    private fun scheduleFocusEndAlarm(context: Context, endTime: Long) {
        val am    = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val pi = PendingIntent.getBroadcast(
            context, FocusModule.REQUEST_CODE,
            Intent(context, FocusReceiver::class.java).apply { action = FocusModule.ACTION_FOCUS_END },
            flags
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endTime, pi)
        else
            am.setExact(AlarmManager.RTC_WAKEUP, endTime, pi)
    }

    private fun parseJsonToSet(json: String): HashSet<String> {
        val set = HashSet<String>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val pkg = arr.optString(i, "").trim()
                if (pkg.isNotEmpty()) set.add(pkg)
            }
        } catch (_: Exception) {}
        return set
    }

    /** Device Protected Storage — accessible même avant déverrouillage */
    private fun getDeviceProtectedPrefs(context: Context): android.content.SharedPreferences {
        val deContext = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
            context.createDeviceProtectedStorageContext()
        else context
        return deContext.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
    }
}