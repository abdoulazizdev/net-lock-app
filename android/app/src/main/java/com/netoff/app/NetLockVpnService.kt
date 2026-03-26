package com.netoff.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.FileInputStream
import java.io.IOException

/**
 * NetLockVpnService — Service VPN local pour NetOff
 *
 * Robustesse OEM (Huawei/EMUI, Xiaomi/MIUI, Oppo, Vivo…) :
 *  1. START_STICKY  → Android relance le service si tué par le système
 *  2. startForeground avec PRIORITY_MAX → moins susceptible d'être tué
 *  3. WakeLock CPU PARTIAL → empêche le drain thread d'être suspendu en veille
 *  4. onTaskRemoved → redémarre le service si l'app est balayée du récent
 *  5. onDestroy avec auto-restart si vpn_was_active = true
 *  6. FOREGROUND_SERVICE_TYPE_SPECIAL_USE sur Android 14+
 */
class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread:  Thread?              = null
    private var wakeLock:     PowerManager.WakeLock? = null

    companion object {
        const val TAG         = "NetLockVpnService"
        var blockedPackages: HashSet<String> = hashSetOf()
        const val PREFS       = "netoff_vpn"
        const val KEY_ACTIVE  = "vpn_was_active"
        var serviceRunning    = false
        @Volatile var isVpnEstablished = false

        const val NOTIF_CHANNEL = "netoff_vpn_channel"
        const val NOTIF_ID      = 1001

        fun isFocusActive(context: Context): Boolean {
            val prefs   = context.getSharedPreferences("netoff_focus", Context.MODE_PRIVATE)
            val active  = prefs.getBoolean(FocusModule.KEY_ACTIVE, false)
            val endTime = prefs.getLong(FocusModule.KEY_END_TIME, 0L)
            return active && endTime > System.currentTimeMillis()
        }
    }

    // ── Cycle de vie ──────────────────────────────────────────────────────────

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Toujours en premier : démarrer en foreground avant tout traitement
        startForegroundNotification()

        if (intent == null) {
            // Relance par le système (START_STICKY) → vérifier si on devait être actif
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(KEY_ACTIVE, false)) {
                Log.d(TAG, "Relance système — redémarrage VPN")
                startVpn()
            }
            return START_STICKY
        }

        when (intent.action) {
            "START" -> {
                startVpn()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, true).apply()
            }
            "STOP" -> {
                if (isFocusActive(this)) {
                    Log.w(TAG, "STOP ignoré — session Focus active")
                    return START_STICKY
                }
                stopVpnExplicit()
            }
            "STOP_FORCE"         -> stopVpnExplicit()
            "UPDATE_RULES"       -> {
                if (isFocusActive(this)) {
                    Log.w(TAG, "UPDATE_RULES ignoré — Focus actif")
                    return START_STICKY
                }
                if (isVpnEstablished) startVpn()
            }
            "UPDATE_RULES_FORCE" -> if (isVpnEstablished) startVpn()
        }
        return START_STICKY
    }

    /**
     * Quand l'utilisateur balaie l'app du gestionnaire de tâches (swipe-to-kill),
     * certains OEM tuent les services. On replanifie un redémarrage immédiat.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ACTIVE, false)) return

        Log.w(TAG, "onTaskRemoved — app balayée, redémarrage du VPN dans 1s")
        // Redémarrer le service après un court délai via alarme AlarmManager
        val restartIntent = Intent(this, NetLockVpnService::class.java).apply { action = "START" }
        val pi = android.app.PendingIntent.getService(
            this, 1,
            restartIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
            else android.app.PendingIntent.FLAG_ONE_SHOT
        )
        val am = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val delay = System.currentTimeMillis() + 1000L
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, delay, pi)
        else
            am.setExact(android.app.AlarmManager.RTC_WAKEUP, delay, pi)
    }

    override fun onDestroy() {
        super.onDestroy()
        releaseWakeLock()
        val old = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        old?.close()
        drainThread?.interrupt()
        drainThread = null
        NetOffWidget.forceUpdate(this)
    }

    // ── Notification foreground ───────────────────────────────────────────────

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                NOTIF_CHANNEL,
                "NetOff VPN",
                // IMPORTANCE_DEFAULT (non LOW) → moins susceptible d'être tué sur certains OEM
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description     = "Service VPN actif — protection réseau"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(ch)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT

        val openPi = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            flags
        )

        // Action rapide "Désactiver" dans la notification
        val stopPi = PendingIntent.getService(
            this, 2,
            Intent(this, NetLockVpnService::class.java).apply { action = "STOP" },
            flags
        )

        val focusActive = isFocusActive(this)
        val notif = NotificationCompat.Builder(this, NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(if (focusActive) "🎯 Mode Focus actif" else "🛡 NetOff VPN actif")
            .setContentText(
                if (focusActive) "Session en cours — maintien du blocage réseau"
                else "${blockedPackages.size} app${if (blockedPackages.size > 1) "s" else ""} bloquée${if (blockedPackages.size > 1) "s" else ""}"
            )
            .setOngoing(true)           // Non swipable — survit mieux sur OEM
            .setAutoCancel(false)
            // PRIORITY_MAX (vs LOW) = moins probable d'être reclaimed par Huawei/EMUI
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openPi)
            .apply {
                if (!focusActive) {
                    addAction(android.R.drawable.ic_lock_power_off, "Désactiver", stopPi)
                }
            }
            .build()

        // Android 14+ : FOREGROUND_SERVICE_TYPE requis pour les VPN
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    // ── VPN ───────────────────────────────────────────────────────────────────

    private fun startVpn() {
        val old = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        old?.close()
        drainThread?.interrupt()
        drainThread = null

        try {
            val builder = Builder()
                .setSession("NetOff VPN")
                .addAddress("10.0.0.1", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .setBlocking(true)

            if (blockedPackages.isEmpty()) {
                try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
            } else {
                applyBlockingRules(builder)
            }

            val iface = builder.establish()
            if (iface == null) {
                Log.e(TAG, "establish() null — permission révoquée ou autre VPN actif")
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, false).apply()
                stopForeground(true)
                stopSelf()
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true

            // WakeLock PARTIAL — empêche le CPU de suspendre le drain thread
            acquireWakeLock()

            val fd = iface.fileDescriptor
            drainThread = Thread {
                val buf    = ByteArray(32767)
                val stream = FileInputStream(fd)
                try {
                    while (!Thread.currentThread().isInterrupted) {
                        val len = stream.read(buf)
                        if (len < 0) break
                    }
                } catch (_: IOException) {
                    // fd fermé proprement
                } finally {
                    Thread.currentThread().interrupt()
                    releaseWakeLock()
                }
            }.also { it.isDaemon = true; it.name = "NetOff-VPN-Drain"; it.start() }

            // Rafraîchir la notification avec le bon count
            startForegroundNotification()

        } catch (e: Exception) {
            Log.e(TAG, "startVpn error: ${e.message}", e)
            isVpnEstablished = false
            serviceRunning   = false
            vpnInterface?.close()
            vpnInterface = null
            releaseWakeLock()
        }

        NetOffWidget.forceUpdate(this)
    }

    private fun applyBlockingRules(builder: Builder) {
        var successCount = 0
        val failed = mutableListOf<String>()
        for (pkg in blockedPackages) {
            val cleanPkg = pkg.substringBefore("@").trim()
            if (cleanPkg.isEmpty()) continue
            try {
                packageManager.getApplicationInfo(cleanPkg, 0)
                builder.addAllowedApplication(cleanPkg)
                successCount++
            } catch (e: PackageManager.NameNotFoundException) {
                failed.add(cleanPkg)
            } catch (e: Exception) {
                failed.add(cleanPkg)
            }
        }
        Log.d(TAG, "Règles: $successCount/${blockedPackages.size} ok, ${failed.size} ignorées")
        if (successCount == 0) {
            try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
        }
    }

    private fun stopVpnExplicit() {
        releaseWakeLock()
        val old = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        old?.close()
        drainThread?.interrupt()
        drainThread = null
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, false).apply()
        stopForeground(true)
        stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    // ── WakeLock ──────────────────────────────────────────────────────────────

    private fun acquireWakeLock() {
        try {
            if (wakeLock?.isHeld == true) return
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "NetOff:VpnDrain"
            ).apply {
                // 8h max de sécurité — évite les leaks si stopVpn n'est pas appelé
                acquire(8 * 60 * 60 * 1000L)
            }
            Log.d(TAG, "WakeLock acquis")
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock non disponible: ${e.message}")
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "WakeLock relâché")
            }
            wakeLock = null
        } catch (e: Exception) {
            Log.w(TAG, "releaseWakeLock: ${e.message}")
        }
    }
}