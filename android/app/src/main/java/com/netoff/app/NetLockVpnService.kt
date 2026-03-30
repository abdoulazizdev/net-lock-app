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
import org.json.JSONArray
import java.io.FileInputStream
import java.io.IOException

/**
 * NetLockVpnService
 *
 * CORRECTIONS :
 *
 * BUG #1 — blockedPackages perdues au redémarrage
 *   FIX : loadRulesFromPrefs() relit les packages depuis SharedPreferences.
 *   Appelé dans onStartCommand AVANT startVpnTunnel(), quelle que soit la source.
 *
 * BUG #2 — Race condition setBlockedApps vs startVpn
 *   FIX : startVpnTunnel() appelle toujours loadRulesFromPrefs() en premier.
 *   Le JS appelle setBlockedApps (persist les prefs) AVANT startVpn.
 *   Les règles sont donc dans les prefs quand establish() est appelé.
 *
 * BUG #3 — Boucle de restart du drain thread
 *   FIX : chaque tunnel a un ID unique (tunnelGeneration). Le drain thread
 *   mémorise son generation à sa création. Il ne relance que si sa generation
 *   correspond à la generation courante. Teardown incrémente la generation,
 *   invalidant les threads précédents.
 */
class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread:  Thread?               = null
    private var wakeLock:     PowerManager.WakeLock? = null

    @Volatile private var stopRequested   = false
    // Incrémenté à chaque teardown — invalide les drain threads précédents
    @Volatile private var tunnelGeneration = 0

    companion object {
        const val TAG = "NetLockVpnService"

        // Cache statique — utilisé comme fallback si les prefs ne sont pas encore lues
        var blockedPackages: HashSet<String> = hashSetOf()
        var allowlistMode:   Boolean         = false
        var allowedPackages: HashSet<String> = hashSetOf()

        const val PREFS           = "netoff_vpn"
        const val KEY_ACTIVE      = "vpn_was_active"
        const val KEY_ALLOW_MODE  = "allowlist_mode"

        @Volatile var isVpnEstablished = false
        var serviceRunning             = false

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

        // Toujours charger les règles depuis les prefs en premier
        loadRulesFromPrefs()

        if (intent == null) {
            // Relance START_STICKY — les règles viennent d'être chargées depuis les prefs
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(KEY_ACTIVE, false)) {
                Log.d(TAG, "Relance système → tunnel avec règles des prefs")
                stopRequested = false
                startVpnTunnel()
            }
            return START_STICKY
        }

        when (intent.action) {
            "START" -> {
                stopRequested = false
                // allowlist_mode peut être overridé par l'intent
                val intentAllowlist = intent.getBooleanExtra("allowlist_mode", allowlistMode)
                allowlistMode = intentAllowlist
                startVpnTunnel()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putBoolean(KEY_ACTIVE, true)
                    .putBoolean(KEY_ALLOW_MODE, allowlistMode)
                    .apply()
            }
            "STOP" -> {
                if (isFocusActive(this)) { Log.w(TAG, "STOP ignoré — Focus actif"); return START_STICKY }
                stopRequested = true
                stopVpnExplicit()
            }
            "STOP_FORCE" -> { stopRequested = true; stopVpnExplicit() }
            "UPDATE_RULES" -> {
                if (isFocusActive(this)) return START_STICKY
                // Les prefs ont déjà été rechargées en début de cette méthode
                allowlistMode = intent.getBooleanExtra("allowlist_mode", allowlistMode)
                if (isVpnEstablished) {
                    Log.d(TAG, "UPDATE_RULES → reconstruire tunnel")
                    stopRequested = false
                    startVpnTunnel()
                } else {
                    Log.d(TAG, "UPDATE_RULES ignoré — VPN inactif (règles mémorisées pour la prochaine activation)")
                }
            }
            "UPDATE_RULES_FORCE" -> {
                stopRequested = false
                startVpnTunnel()
            }
        }
        return START_STICKY
    }

    /**
     * Relit les packages bloqués/autorisés depuis SharedPreferences.
     * CRITIQUE : à appeler en début de chaque onStartCommand pour que le service
     * ait toujours les bonnes règles, même après un kill/restart du process.
     */
    private fun loadRulesFromPrefs() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        // Recharger le mode
        allowlistMode = prefs.getBoolean(KEY_ALLOW_MODE, false)

        // Recharger les packages bloqués
        val blockedJson  = prefs.getString(VpnModule.KEY_BLOCKED_PKGS, "[]") ?: "[]"
        val allowedJson  = prefs.getString(VpnModule.KEY_ALLOWED_PKGS, "[]") ?: "[]"

        blockedPackages = parseJsonToSet(blockedJson)
        allowedPackages = parseJsonToSet(allowedJson)

        Log.d(TAG, "Règles rechargées: mode=${if (allowlistMode) "ALLOWLIST" else "BLOCKLIST"}, " +
                "blocked=${blockedPackages.size}, allowed=${allowedPackages.size}")
    }

    private fun parseJsonToSet(json: String): HashSet<String> {
        val set = HashSet<String>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val pkg = arr.optString(i, "").trim()
                if (pkg.isNotEmpty()) set.add(pkg)
            }
        } catch (e: Exception) {
            Log.w(TAG, "parseJsonToSet error: ${e.message}")
        }
        return set
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ACTIVE, false)) return
        Log.w(TAG, "onTaskRemoved → redémarrage dans 1s")
        scheduleAlarm("START", 1000L)
    }

    override fun onRevoke() {
        Log.w(TAG, "onRevoke — permission VPN révoquée par l'utilisateur")
        stopRequested = true
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ACTIVE, false).apply()
        teardownTunnel()
        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        teardownTunnel()
        NetOffWidget.forceUpdate(this)
    }

    // ── VPN ───────────────────────────────────────────────────────────────────

    /**
     * Crée ou recrée le tunnel VPN avec les règles courantes.
     * Doit toujours être précédé de loadRulesFromPrefs() ou d'une mise à jour
     * des variables statiques.
     */
    private fun startVpnTunnel() {
        // Incrémenter la génération → invalide tout drain thread en cours
        // Cela évite la boucle de restart (BUG #3)
        tunnelGeneration++
        val myGeneration = tunnelGeneration

        teardownTunnel()

        try {
            val builder = Builder()
                .setSession("NetOff VPN")
                .addAddress("10.0.0.1", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .setBlocking(true)

            when {
                allowlistMode             -> applyAllowlistMode(builder)
                blockedPackages.isEmpty() -> {
                    // Sentinelle minimale — aucune règle, juste notre app
                    try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
                    Log.d(TAG, "Tunnel sentinelle (aucune app à bloquer)")
                }
                else -> applyBlocklistMode(builder)
            }

            val iface = builder.establish()
            if (iface == null) {
                Log.e(TAG, "establish() → null. Permission révoquée ou autre VPN actif.")
                isVpnEstablished = false; serviceRunning = false
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true
            acquireWakeLock()
            startForegroundNotification()
            Log.i(TAG, "Tunnel établi [gen=$myGeneration] — ${if (allowlistMode) "ALLOWLIST" else "BLOCKLIST(${blockedPackages.size})"}")

            startDrainThread(iface, myGeneration)

        } catch (e: Exception) {
            Log.e(TAG, "startVpnTunnel error: ${e.message}", e)
            isVpnEstablished = false; serviceRunning = false
            vpnInterface?.close(); vpnInterface = null
            releaseWakeLock()
            // Réessayer dans 3s seulement si arrêt non intentionnel
            if (!stopRequested && tunnelGeneration == myGeneration) {
                scheduleAlarm("START", 3000L)
            }
        }
        NetOffWidget.forceUpdate(this)
    }

    /**
     * Thread qui draine les paquets du tunnel.
     *
     * FIX BUG #3 : chaque thread mémorise myGeneration.
     * Si tunnelGeneration != myGeneration au moment de la sortie,
     * c'est que teardown() a déjà créé un nouveau tunnel → ne pas relancer.
     */
    private fun startDrainThread(iface: ParcelFileDescriptor, myGeneration: Int) {
        val stream = FileInputStream(iface.fileDescriptor)

        drainThread = Thread {
            val buf = ByteArray(32768)
            var unexpectedExit = false
            Log.d(TAG, "Drain thread démarré [gen=$myGeneration]")

            try {
                while (!Thread.currentThread().isInterrupted) {
                    val len = stream.read(buf)
                    if (len < 0) {
                        // fd fermé par Android (changement réseau, veille, révocation...)
                        unexpectedExit = !stopRequested && (tunnelGeneration == myGeneration)
                        Log.w(TAG, "Drain: read()=$len [gen=$myGeneration] — inattendu=$unexpectedExit")
                        break
                    }
                    // Paquets drainés → apps bloquées sans internet
                }
            } catch (e: IOException) {
                // IOException peut venir d'un interrupt() ou d'une fermeture du fd
                val isOurInterrupt = Thread.currentThread().isInterrupted
                unexpectedExit = !isOurInterrupt && !stopRequested && (tunnelGeneration == myGeneration)
                if (unexpectedExit) Log.w(TAG, "Drain: IOException inattendue [gen=$myGeneration]: ${e.message}")
            } finally {
                try { stream.close() } catch (_: Exception) {}
                if (tunnelGeneration == myGeneration) {
                    // Ce thread correspond encore au tunnel courant
                    isVpnEstablished = false
                    serviceRunning   = false
                }
                releaseWakeLock()
                Log.d(TAG, "Drain thread terminé [gen=$myGeneration, unexpectedExit=$unexpectedExit]")

                if (unexpectedExit && !stopRequested && tunnelGeneration == myGeneration) {
                    // Le tunnel est tombé de façon inattendue et aucun nouveau tunnel n'est en cours
                    Log.w(TAG, "Tunnel tombé → relance dans 800ms [gen=$myGeneration]")
                    // Utiliser une alarme AlarmManager plutôt que postDelayed
                    // car le main thread peut lui-même être suspendu
                    scheduleAlarmFromThread("START", 800L)
                }
            }
        }.also { it.isDaemon = true; it.name = "NetOff-VPN-Drain-$myGeneration"; it.start() }
    }

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

    private fun applyAllowlistMode(builder: Builder) {
        var excluded = 0
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

    /** Arrête le tunnel sans changer KEY_ACTIVE */
    private fun teardownTunnel() {
        drainThread?.interrupt()
        drainThread = null
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        releaseWakeLock()
    }

    /** Arrêt intentionnel — marque KEY_ACTIVE = false */
    private fun stopVpnExplicit() {
        teardownTunnel()
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ACTIVE, false)
            .putBoolean(KEY_ALLOW_MODE, false)
            .apply()
        stopForeground(true)
        stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    // ── Alarmes ───────────────────────────────────────────────────────────────

    private fun scheduleAlarm(action: String, delayMs: Long) {
        val pi  = buildRestartPendingIntent(action)
        val am  = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val at  = System.currentTimeMillis() + delayMs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, at, pi)
        else
            am.setExact(android.app.AlarmManager.RTC_WAKEUP, at, pi)
    }

    /** Variante thread-safe appelable depuis le drain thread */
    private fun scheduleAlarmFromThread(action: String, delayMs: Long) {
        try { scheduleAlarm(action, delayMs) }
        catch (e: Exception) { Log.w(TAG, "scheduleAlarmFromThread: ${e.message}") }
    }

    private fun buildRestartPendingIntent(action: String): android.app.PendingIntent {
        val intent = Intent(this, NetLockVpnService::class.java).apply {
            this.action = action
            putExtra("allowlist_mode", allowlistMode)
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getService(this, 99, intent, flags)
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
        val modeLabel   = when {
            focusActive   -> "Session Focus — blocage actif"
            allowlistMode -> "Liste blanche — tout bloqué sauf exceptions"
            blockedPackages.isEmpty() -> "Aucune app bloquée"
            else -> "${blockedPackages.size} app(s) bloquée(s)"
        }
        val notif = NotificationCompat.Builder(this, NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(if (focusActive) "🎯 Mode Focus actif" else "🛡 NetOff VPN actif")
            .setContentText(modeLabel)
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

    // ── WakeLock ──────────────────────────────────────────────────────────────

    private fun acquireWakeLock() {
        try {
            if (wakeLock?.isHeld == true) return
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NetOff:VpnDrain")
                .apply { acquire(12L * 60 * 60 * 1000) }
        } catch (e: Exception) { Log.w(TAG, "WakeLock: ${e.message}") }
    }

    private fun releaseWakeLock() {
        try { if (wakeLock?.isHeld == true) wakeLock?.release(); wakeLock = null }
        catch (e: Exception) { Log.w(TAG, "releaseWakeLock: ${e.message}") }
    }
}