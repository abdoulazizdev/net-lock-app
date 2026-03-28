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
 * NetLockVpnService — VPN local NetOff
 *
 * DEUX MODES de blocage, sélectionnés automatiquement :
 *
 * ── MODE NORMAL (blocklist, peu d'apps bloquées) ─────────────────────────────
 *   addAllowedApplication(blockedApp)
 *   → Seules les apps bloquées entrent dans le tunnel → drainées
 *   → Toutes les autres bypassent → ont internet
 *   Avantage : rapide, pas besoin de lister toutes les apps autorisées
 *   Inconvénient Huawei/EMUI : EMUI peut laisser des apps bypasser le tunnel
 *
 * ── MODE ALLOWLIST (whitelist, "tout bloquer sauf...") ───────────────────────
 *   addDisallowedApplication(allowedApp) pour chaque app autorisée
 *   → TOUT le trafic entre dans le tunnel par défaut → drainé
 *   → Les apps autorisées sont explicitement exclues → ont internet
 *   Avantage : Huawei/EMUI ne peut pas bypasser ce mode car c'est le comportement
 *              par défaut du tunnel (pas d'exception réseau à contourner)
 *   Inconvénient : il faut lister toutes les apps qui doivent avoir internet
 *
 * Le mode est déterminé par la SharedPreference KEY_ALLOWLIST_MODE.
 * En mode allowlist, allowedPackages contient les apps qui PEUVENT avoir internet.
 */
class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread:  Thread?              = null
    private var wakeLock:     PowerManager.WakeLock? = null

    companion object {
        const val TAG = "NetLockVpnService"

        // Mode blocklist normal
        var blockedPackages: HashSet<String> = hashSetOf()

        // Mode allowlist (Huawei-safe)
        var allowlistMode:    Boolean         = false
        var allowedPackages:  HashSet<String> = hashSetOf()

        const val PREFS          = "netoff_vpn"
        const val KEY_ACTIVE     = "vpn_was_active"
        const val KEY_ALLOW_MODE = "allowlist_mode"

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
        startForegroundNotification()

        if (intent == null) {
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(KEY_ACTIVE, false)) {
                allowlistMode = prefs.getBoolean(KEY_ALLOW_MODE, false)
                startVpn()
            }
            return START_STICKY
        }

        when (intent.action) {
            "START" -> {
                allowlistMode = intent.getBooleanExtra("allowlist_mode", false)
                startVpn()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putBoolean(KEY_ACTIVE, true)
                    .putBoolean(KEY_ALLOW_MODE, allowlistMode)
                    .apply()
            }
            "STOP" -> {
                if (isFocusActive(this)) return START_STICKY
                stopVpnExplicit()
            }
            "STOP_FORCE"         -> stopVpnExplicit()
            "UPDATE_RULES"       -> {
                if (isFocusActive(this)) return START_STICKY
                if (isVpnEstablished) {
                    allowlistMode = intent.getBooleanExtra("allowlist_mode", allowlistMode)
                    startVpn()
                }
            }
            "UPDATE_RULES_FORCE" -> if (isVpnEstablished) startVpn()
        }
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ACTIVE, false)) return
        Log.w(TAG, "onTaskRemoved — redémarrage dans 1s")
        val restartIntent = Intent(this, NetLockVpnService::class.java).apply { action = "START" }
        val pi = android.app.PendingIntent.getService(this, 1, restartIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
            else android.app.PendingIntent.FLAG_ONE_SHOT
        )
        val am    = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val delay = System.currentTimeMillis() + 1000L
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, delay, pi)
        else
            am.setExact(android.app.AlarmManager.RTC_WAKEUP, delay, pi)
    }

    override fun onDestroy() {
        super.onDestroy()
        releaseWakeLock()
        vpnInterface?.close(); vpnInterface = null
        isVpnEstablished = false; serviceRunning = false
        drainThread?.interrupt(); drainThread = null
        NetOffWidget.forceUpdate(this)
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(NOTIF_CHANNEL, "NetOff VPN", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Service VPN actif"; setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT

        val openPi = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), flags)
        val stopPi = PendingIntent.getService(this, 2, Intent(this, NetLockVpnService::class.java).apply { action = "STOP" }, flags)

        val focusActive = isFocusActive(this)
        val modeLabel   = if (allowlistMode) "Mode liste blanche" else "${blockedPackages.size} app(s) bloquée(s)"

        val notif = NotificationCompat.Builder(this, NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(if (focusActive) "🎯 Mode Focus actif" else "🛡 NetOff VPN actif")
            .setContentText(if (focusActive) "Session en cours — blocage réseau maintenu" else modeLabel)
            .setOngoing(true).setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openPi)
            .apply { if (!focusActive) addAction(android.R.drawable.ic_lock_power_off, "Désactiver", stopPi) }
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else
            startForeground(NOTIF_ID, notif)
    }

    // ── VPN ───────────────────────────────────────────────────────────────────

    private fun startVpn() {
        vpnInterface?.close(); vpnInterface = null
        isVpnEstablished = false; serviceRunning = false
        drainThread?.interrupt(); drainThread = null

        try {
            val builder = Builder()
                .setSession("NetOff VPN")
                .addAddress("10.0.0.1", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .setBlocking(true)

            if (allowlistMode) {
                // ── MODE ALLOWLIST — Robuste sur Huawei/EMUI ─────────────────
                // Tout le trafic entre dans le tunnel par défaut.
                // On exclut explicitement les apps autorisées.
                // Ce mode ne peut pas être bypassé par EMUI car c'est le
                // comportement par défaut du tunnel Android.
                applyAllowlistMode(builder)
            } else if (blockedPackages.isEmpty()) {
                // Aucune règle : tunnel minimal (juste notre app comme sentinelle)
                try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
            } else {
                // ── MODE NORMAL — Blocklist classique ────────────────────────
                applyBlocklistMode(builder)
            }

            val iface = builder.establish()
            if (iface == null) {
                Log.e(TAG, "establish() null")
                getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
                stopForeground(true); stopSelf(); return
            }
            vpnInterface = iface; isVpnEstablished = true; serviceRunning = true
            acquireWakeLock()

            val fd = iface.fileDescriptor
            drainThread = Thread {
                val buf = ByteArray(32767)
                val stream = FileInputStream(fd)
                try {
                    while (!Thread.currentThread().isInterrupted) {
                        val len = stream.read(buf)
                        if (len < 0) break
                    }
                } catch (_: IOException) {
                } finally { Thread.currentThread().interrupt(); releaseWakeLock() }
            }.also { it.isDaemon = true; it.name = "NetOff-VPN-Drain"; it.start() }

            startForegroundNotification()
            Log.d(TAG, "VPN démarré — mode=${if (allowlistMode) "ALLOWLIST" else "BLOCKLIST"}")

        } catch (e: Exception) {
            Log.e(TAG, "startVpn error: ${e.message}", e)
            isVpnEstablished = false; serviceRunning = false
            vpnInterface?.close(); vpnInterface = null; releaseWakeLock()
        }
        NetOffWidget.forceUpdate(this)
    }

    /**
     * MODE BLOCKLIST — Classique, compatible tous appareils normaux.
     * addAllowedApplication(blockedApp) : seules ces apps entrent dans le tunnel.
     */
    private fun applyBlocklistMode(builder: Builder) {
        var ok = 0
        for (pkg in blockedPackages) {
            val clean = pkg.substringBefore("@").trim()
            if (clean.isEmpty()) continue
            try {
                packageManager.getApplicationInfo(clean, 0)
                builder.addAllowedApplication(clean)
                ok++
            } catch (_: Exception) {}
        }
        Log.d(TAG, "BLOCKLIST: $ok/${blockedPackages.size} apps dans le tunnel")
        if (ok == 0) try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
    }

    /**
     * MODE ALLOWLIST — Robuste Huawei/EMUI.
     * addDisallowedApplication(allowedApp) : ces apps bypassent le tunnel.
     * TOUT le reste entre dans le tunnel → drainé → pas d'internet.
     *
     * Pourquoi ça marche mieux sur Huawei :
     * EMUI peut laisser des apps bypasser un tunnel "whitelist" car elles
     * utilisent des chemins réseau alternatifs. En mode "tout dans le tunnel",
     * il n'y a pas de chemin alternatif à exploiter — le paquet entre dans
     * le fd ou il n'est pas envoyé du tout.
     *
     * Apps toujours exclues :
     *   - NetOff lui-même (sinon perd le contrôle du VPN)
     *   - Apps système critiques (téléphone, SMS) si demandé
     */
    private fun applyAllowlistMode(builder: Builder) {
        var excluded = 0

        // Toujours exclure notre propre app du tunnel
        try { builder.addDisallowedApplication(packageName); excluded++ } catch (_: Exception) {}

        for (pkg in allowedPackages) {
            val clean = pkg.substringBefore("@").trim()
            if (clean.isEmpty() || clean == packageName) continue
            try {
                packageManager.getApplicationInfo(clean, 0)
                builder.addDisallowedApplication(clean)
                excluded++
            } catch (_: Exception) {}
        }
        Log.d(TAG, "ALLOWLIST: $excluded apps exclues du tunnel (ont internet), tout le reste est bloqué")
    }

    private fun stopVpnExplicit() {
        releaseWakeLock()
        vpnInterface?.close(); vpnInterface = null
        isVpnEstablished = false; serviceRunning = false
        drainThread?.interrupt(); drainThread = null
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ACTIVE, false)
            .putBoolean(KEY_ALLOW_MODE, false)
            .apply()
        stopForeground(true); stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    // ── WakeLock ──────────────────────────────────────────────────────────────

    private fun acquireWakeLock() {
        try {
            if (wakeLock?.isHeld == true) return
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NetOff:VpnDrain")
                .apply { acquire(8 * 60 * 60 * 1000L) }
        } catch (e: Exception) { Log.w(TAG, "WakeLock: ${e.message}") }
    }

    private fun releaseWakeLock() {
        try { if (wakeLock?.isHeld == true) wakeLock?.release(); wakeLock = null }
        catch (e: Exception) { Log.w(TAG, "releaseWakeLock: ${e.message}") }
    }
}