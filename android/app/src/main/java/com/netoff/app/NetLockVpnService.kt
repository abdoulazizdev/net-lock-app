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
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.FileInputStream
import java.io.IOException

/**
 * NetLockVpnService — Service VPN local NetOff
 *
 * CAUSE DU BUG "apps débloquées après un moment" :
 *   Le drain thread lit le fd VPN. Quand Android ferme ce fd (changement de
 *   réseau, veille, autre VPN, révocation...), stream.read() retourne -1 ou
 *   lève une IOException. Le thread s'arrêtait silencieusement → le tunnel
 *   n'existait plus → les apps bypassaient → internet retrouvé.
 *   isVpnEstablished restait true donc rien ne relançait.
 *
 * FIX :
 *   1. Le drain thread détecte sa propre mort (read = -1 ou IOException)
 *   2. Si l'arrêt n'est PAS intentionnel (stopRequested = false), il
 *      programme un redémarrage immédiat du tunnel via Handler(mainLooper)
 *   3. @Volatile stopRequested empêche la boucle de redémarrage infinie
 *      lors d'un arrêt voulu (STOP, STOP_FORCE)
 */
class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread:  Thread?               = null
    private var wakeLock:     PowerManager.WakeLock? = null

    // Flag explicite : true uniquement quand l'arrêt est VOULU (STOP/STOP_FORCE)
    // Empêche le drain thread de relancer le VPN lors d'un arrêt intentionnel
    @Volatile private var stopRequested = false

    // Handler sur le main thread pour relancer le VPN depuis le drain thread
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        const val TAG = "NetLockVpnService"

        var blockedPackages: HashSet<String> = hashSetOf()
        var allowlistMode:   Boolean         = false
        var allowedPackages: HashSet<String> = hashSetOf()

        const val PREFS          = "netoff_vpn"
        const val KEY_ACTIVE     = "vpn_was_active"
        const val KEY_ALLOW_MODE = "allowlist_mode"

        var serviceRunning               = false
        @Volatile var isVpnEstablished   = false

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
            // Relance START_STICKY par Android
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(KEY_ACTIVE, false)) {
                allowlistMode = prefs.getBoolean(KEY_ALLOW_MODE, false)
                Log.d(TAG, "Relance système → redémarrage VPN")
                startVpnTunnel()
            }
            return START_STICKY
        }

        when (intent.action) {
            "START" -> {
                stopRequested = false
                allowlistMode = intent.getBooleanExtra("allowlist_mode", false)
                startVpnTunnel()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putBoolean(KEY_ACTIVE, true)
                    .putBoolean(KEY_ALLOW_MODE, allowlistMode)
                    .apply()
            }
            "STOP" -> {
                if (isFocusActive(this)) {
                    Log.w(TAG, "STOP ignoré — Focus actif")
                    return START_STICKY
                }
                stopRequested = true
                stopVpnExplicit()
            }
            "STOP_FORCE" -> {
                stopRequested = true
                stopVpnExplicit()
            }
            "UPDATE_RULES" -> {
                if (isFocusActive(this)) return START_STICKY
                allowlistMode = intent.getBooleanExtra("allowlist_mode", allowlistMode)
                // Relancer le tunnel avec les nouvelles règles
                stopRequested = false
                startVpnTunnel()
            }
            "UPDATE_RULES_FORCE" -> {
                stopRequested = false
                startVpnTunnel()
            }
            "RESTART_TUNNEL" -> {
                // Relance interne depuis le drain thread
                if (!stopRequested) startVpnTunnel()
            }
        }
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ACTIVE, false)) return
        Log.w(TAG, "onTaskRemoved → redémarrage dans 1s")
        scheduleRestart(1000L)
    }

    override fun onRevoke() {
        // Android révoque la permission VPN (ex: l'utilisateur désactive depuis les paramètres)
        Log.w(TAG, "onRevoke — permission VPN révoquée")
        stopRequested = true
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ACTIVE, false).apply()
        teardownTunnel()
        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        // Annuler les restarts planifiés
        mainHandler.removeCallbacksAndMessages(null)
        teardownTunnel()
        NetOffWidget.forceUpdate(this)
    }

    // ── VPN ───────────────────────────────────────────────────────────────────

    /**
     * Démarre ou redémarre le tunnel VPN.
     * Appelé depuis onStartCommand (main thread) et depuis le drain thread
     * via mainHandler.post() en cas de chute inattendue.
     */
    private fun startVpnTunnel() {
        // Arrêter proprement l'ancien tunnel avant d'en créer un nouveau
        teardownTunnel()

        try {
            val builder = Builder()
                .setSession("NetOff VPN")
                .addAddress("10.0.0.1", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                // setBlocking(false) : read() retourne -1 immédiatement si pas de paquet
                // → permet de détecter la fermeture du fd rapidement
                // setBlocking(true) : read() bloque → moins de CPU mais moins réactif
                // On garde true mais avec détection de chute dans le thread
                .setBlocking(true)

            when {
                allowlistMode          -> applyAllowlistMode(builder)
                blockedPackages.isEmpty() -> {
                    try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
                }
                else                   -> applyBlocklistMode(builder)
            }

            val iface = builder.establish()
            if (iface == null) {
                Log.e(TAG, "establish() → null (permission révoquée ou autre VPN actif)")
                // Ne pas mettre KEY_ACTIVE = false ici — c'est peut-être transitoire
                // Le watchdog / VpnRestartReceiver tentera de relancer
                isVpnEstablished = false
                serviceRunning   = false
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true
            acquireWakeLock()
            startForegroundNotification()
            Log.i(TAG, "Tunnel VPN établi — mode=${if (allowlistMode) "ALLOWLIST" else "BLOCKLIST"}")

            // Démarrer le drain thread avec auto-restart en cas de chute
            startDrainThread(iface)

        } catch (e: Exception) {
            Log.e(TAG, "startVpnTunnel error: ${e.message}", e)
            isVpnEstablished = false
            serviceRunning   = false
            vpnInterface?.close()
            vpnInterface = null
            releaseWakeLock()
            // Réessayer dans 3s si l'arrêt n'est pas intentionnel
            if (!stopRequested) scheduleRestartVia("RESTART_TUNNEL", 3000L)
        }
        NetOffWidget.forceUpdate(this)
    }

    /**
     * Thread qui vide le tunnel (les paquets drainés ne sont pas retransmis
     * → les apps bloquées n'ont pas internet).
     *
     * CRITIQUE : quand read() retourne -1 ou lève IOException sans interruption
     * explicite, c'est que le fd a été fermé par Android (changement réseau,
     * veille, révocation...). Dans ce cas on relance le tunnel.
     */
    private fun startDrainThread(iface: ParcelFileDescriptor) {
        val fd     = iface.fileDescriptor
        val stream = FileInputStream(fd)

        drainThread = Thread {
            val buf = ByteArray(32768)
            Log.d(TAG, "Drain thread démarré")
            var unexpectedExit = false

            try {
                while (!Thread.currentThread().isInterrupted) {
                    val len = stream.read(buf)
                    if (len < 0) {
                        // fd fermé par Android — pas une interruption volontaire
                        Log.w(TAG, "Drain: read()=$len → tunnel fermé par Android")
                        unexpectedExit = !stopRequested
                        break
                    }
                    // len == 0 : pas de paquet (ne devrait pas arriver avec setBlocking(true))
                    // Paquets drainés : on ne fait rien → apps bloquées perdent internet
                }
            } catch (e: IOException) {
                if (!Thread.currentThread().isInterrupted && !stopRequested) {
                    Log.w(TAG, "Drain: IOException inattendue → ${e.message}")
                    unexpectedExit = true
                }
            } finally {
                try { stream.close() } catch (_: Exception) {}
                releaseWakeLock()
                isVpnEstablished = false
                serviceRunning   = false
                Log.d(TAG, "Drain thread terminé (unexpectedExit=$unexpectedExit, stopRequested=$stopRequested)")

                if (unexpectedExit && !stopRequested) {
                    // Le tunnel est tombé de façon inattendue → relancer depuis le main thread
                    Log.w(TAG, "Tunnel tombé → relance dans 500ms")
                    mainHandler.postDelayed({
                        if (!stopRequested) {
                            Log.i(TAG, "Relance du tunnel VPN après chute inattendue")
                            startVpnTunnel()
                        }
                    }, 500L)
                }
            }
        }.also {
            it.isDaemon = true
            it.name     = "NetOff-VPN-Drain"
            it.start()
        }
    }

    /** Applique le mode BLOCKLIST : seules les apps bloquées entrent dans le tunnel */
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
        // Sentinelle : si aucune app valide, au moins notre app → tunnel non vide
        if (ok == 0) try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
    }

    /** Applique le mode ALLOWLIST : tout entre dans le tunnel sauf les apps autorisées */
    private fun applyAllowlistMode(builder: Builder) {
        var excluded = 0
        // Notre propre app doit toujours bypasser (sinon on perd le contrôle)
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
        Log.d(TAG, "ALLOWLIST: $excluded apps exclues du tunnel")
    }

    /** Démonte le tunnel proprement sans changer KEY_ACTIVE */
    private fun teardownTunnel() {
        drainThread?.interrupt()
        drainThread = null
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        releaseWakeLock()
    }

    /** Arrêt intentionnel — met KEY_ACTIVE = false et s'auto-détruit */
    private fun stopVpnExplicit() {
        mainHandler.removeCallbacksAndMessages(null)
        teardownTunnel()
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ACTIVE, false)
            .putBoolean(KEY_ALLOW_MODE, false)
            .apply()
        stopForeground(true)
        stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun scheduleRestart(delayMs: Long) {
        scheduleRestartVia("START", delayMs)
    }

    private fun scheduleRestartVia(action: String, delayMs: Long) {
        val restartIntent = Intent(this, NetLockVpnService::class.java).apply {
            this.action = action
            putExtra("allowlist_mode", allowlistMode)
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_ONE_SHOT

        val pi = PendingIntent.getService(this, 99, restartIntent, flags)
        val am = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val at = System.currentTimeMillis() + delayMs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, at, pi)
        else
            am.setExact(android.app.AlarmManager.RTC_WAKEUP, at, pi)
    }

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                NOTIF_CHANNEL, "NetOff VPN", NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Service VPN actif"
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
            this, 0, packageManager.getLaunchIntentForPackage(packageName), flags
        )
        val stopPi = PendingIntent.getService(
            this, 2,
            Intent(this, NetLockVpnService::class.java).apply { action = "STOP" },
            flags
        )
        val focusActive = isFocusActive(this)
        val modeLabel   = when {
            focusActive  -> "Session Focus — blocage réseau maintenu"
            allowlistMode-> "Liste blanche — tout bloqué sauf exceptions"
            else         -> "${blockedPackages.size} app(s) bloquée(s)"
        }
        val notif = NotificationCompat.Builder(this, NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(if (focusActive) "🎯 Mode Focus actif" else "🛡 NetOff VPN actif")
            .setContentText(modeLabel)
            .setOngoing(true)
            .setAutoCancel(false)
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

    // ── WakeLock ──────────────────────────────────────────────────────────────

    private fun acquireWakeLock() {
        try {
            if (wakeLock?.isHeld == true) return
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NetOff:VpnDrain")
                .apply { acquire(12L * 60 * 60 * 1000) } // 12h max
            Log.d(TAG, "WakeLock acquis")
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock non disponible: ${e.message}")
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            wakeLock = null
        } catch (e: Exception) {
            Log.w(TAG, "releaseWakeLock: ${e.message}")
        }
    }
}