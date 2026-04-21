package com.netoff.app

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import java.io.BufferedReader
import java.io.FileInputStream
import java.io.FileReader
import java.io.IOException
import java.net.InetSocketAddress

/**
 * NetLockVpnService — Service VPN local NetOff
 *
 * Lecture des règles depuis Device Protected Storage quand disponible,
 * fallback sur CE storage. Écrit dans les deux à chaque modification.
 *
 * directBootAware="true" dans le manifest → peut être démarré avant
 * le déverrouillage du téléphone.
 */
class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread:  Thread?               = null
    private var wakeLock:     PowerManager.WakeLock? = null

    @Volatile private var stopRequested    = false
    @Volatile private var tunnelGeneration = 0

    // Throttle logging — max 1 entrée par app toutes les LOG_THROTTLE_MS ms
    private val lastLogTime     = HashMap<String, Long>()
    private val LOG_THROTTLE_MS = 3_000L

    companion object {
        const val TAG = "NetLockVpnService"

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

        // Charger les règles depuis le meilleur storage disponible
        loadRulesFromBestStorage()

        if (intent == null) {
            // Relance START_STICKY
            val prefs = getBestPrefs()
            if (prefs.getBoolean(KEY_ACTIVE, false)) {
                Log.d(TAG, "Relance START_STICKY → démarrage tunnel")
                stopRequested = false
                startVpnTunnel()
            }
            return START_STICKY
        }

        when (intent.action) {
            "START" -> {
                stopRequested = false
                allowlistMode = intent.getBooleanExtra("allowlist_mode", allowlistMode)
                startVpnTunnel()
                // Marquer actif dans les DEUX storages
                saveActiveState(true)
            }
            "STOP" -> {
                if (isFocusActive(this)) return START_STICKY
                stopRequested = true
                stopVpnExplicit()
            }
            "STOP_FORCE" -> { stopRequested = true; stopVpnExplicit() }
            "UPDATE_RULES" -> {
                if (isFocusActive(this)) return START_STICKY
                loadRulesFromBestStorage()
                allowlistMode = intent.getBooleanExtra("allowlist_mode", allowlistMode)
                if (isVpnEstablished) {
                    stopRequested = false
                    startVpnTunnel()
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
     * Charge les règles depuis Device Protected Storage si API >= 24,
     * sinon depuis CE storage.
     */
    private fun loadRulesFromBestStorage() {
        val prefs = getBestPrefs()
        allowlistMode   = prefs.getBoolean(KEY_ALLOW_MODE, false)
        blockedPackages = parseJsonToSet(prefs.getString(VpnModule.KEY_BLOCKED_PKGS, "[]") ?: "[]")
        allowedPackages = parseJsonToSet(prefs.getString(VpnModule.KEY_ALLOWED_PKGS, "[]") ?: "[]")
        Log.d(TAG, "Règles chargées: mode=${if (allowlistMode) "ALLOWLIST" else "BLOCKLIST"}, " +
                "blocked=${blockedPackages.size}, allowed=${allowedPackages.size}")
    }

    /**
     * Sauvegarde KEY_ACTIVE dans CE + DE storage
     */
    private fun saveActiveState(active: Boolean) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, active).apply()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            createDeviceProtectedStorageContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ACTIVE, active).apply()
        }
    }

    /**
     * Retourne Device Protected Prefs si API >= 24, sinon CE prefs.
     * DE est accessible dès le boot, avant déverrouillage.
     */
    private fun getBestPrefs(): SharedPreferences {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            createDeviceProtectedStorageContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        } else {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        }
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

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        if (!getBestPrefs().getBoolean(KEY_ACTIVE, false)) return
        Log.w(TAG, "onTaskRemoved → redémarrage dans 1s")
        scheduleAlarm("START", 1000L)
    }

    override fun onRevoke() {
        Log.w(TAG, "onRevoke — permission VPN révoquée")
        stopRequested = true
        saveActiveState(false)
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

    private fun startVpnTunnel() {
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
                    try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
                    Log.d(TAG, "Tunnel sentinelle (aucune app à bloquer)")
                }
                else -> applyBlocklistMode(builder)
            }

            val iface = builder.establish()
            if (iface == null) {
                Log.e(TAG, "establish() → null [gen=$myGeneration]")
                isVpnEstablished = false; serviceRunning = false
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true
            acquireWakeLock()
            startForegroundNotification()
            Log.i(TAG, "Tunnel VPN établi [gen=$myGeneration] — " +
                    "${if (allowlistMode) "ALLOWLIST" else "BLOCKLIST(${blockedPackages.size})"}")

            startDrainThread(iface, myGeneration)

        } catch (e: Exception) {
            Log.e(TAG, "startVpnTunnel [gen=$myGeneration]: ${e.message}", e)
            isVpnEstablished = false; serviceRunning = false
            vpnInterface?.close(); vpnInterface = null
            releaseWakeLock()
            if (!stopRequested && tunnelGeneration == myGeneration)
                scheduleAlarm("START", 3000L)
        }
        NetOffWidget.forceUpdate(this)
    }

    private fun startDrainThread(iface: ParcelFileDescriptor, myGeneration: Int) {
        val stream = FileInputStream(iface.fileDescriptor)
        drainThread = Thread {
            val buf            = ByteArray(32768)
            var unexpectedExit = false
            Log.d(TAG, "Drain thread démarré [gen=$myGeneration]")

            try {
                while (!Thread.currentThread().isInterrupted) {
                    val len = stream.read(buf)
                    if (len < 0) {
                        unexpectedExit = !stopRequested && (tunnelGeneration == myGeneration)
                        Log.w(TAG, "Drain: EOF [gen=$myGeneration, inattendu=$unexpectedExit]")
                        break
                    }
                    // Logger le paquet intercepté (non-bloquant, throttlé)
                    if (len >= 20) tryLogPacket(buf, len)
                }
            } catch (e: IOException) {
                val interrupted = Thread.currentThread().isInterrupted
                unexpectedExit  = !interrupted && !stopRequested && (tunnelGeneration == myGeneration)
                if (unexpectedExit) Log.w(TAG, "Drain: IOException [gen=$myGeneration]: ${e.message}")
            } finally {
                try { stream.close() } catch (_: Exception) {}
                if (tunnelGeneration == myGeneration) {
                    isVpnEstablished = false; serviceRunning = false
                }
                releaseWakeLock()
                Log.d(TAG, "Drain terminé [gen=$myGeneration, inattendu=$unexpectedExit]")

                if (unexpectedExit && !stopRequested && tunnelGeneration == myGeneration) {
                    Log.w(TAG, "Tunnel tombé → relance dans 800ms")
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
            try { packageManager.getApplicationInfo(clean, 0); builder.addAllowedApplication(clean); ok++ }
            catch (_: Exception) {}
        }
        Log.d(TAG, "BLOCKLIST: $ok/${blockedPackages.size}")
        if (ok == 0) try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
    }

    private fun applyAllowlistMode(builder: Builder) {
        var n = 0
        try { builder.addDisallowedApplication(packageName); n++ } catch (_: Exception) {}
        for (pkg in allowedPackages) {
            val clean = pkg.substringBefore("@").trim()
            if (clean.isEmpty() || clean == packageName) continue
            try { packageManager.getApplicationInfo(clean, 0); builder.addDisallowedApplication(clean); n++ }
            catch (_: Exception) {}
        }
        Log.d(TAG, "ALLOWLIST: $n apps exclues du tunnel")
    }

    /**
     * Identifie l'app qui a envoyé ce paquet IP et logue l'événement.
     *
     * Stratégie :
     *   1. Parser l'en-tête IPv4 → src_ip + src_port + protocole
     *   2. Android 10+ : ConnectivityManager.getConnectionOwnerUid()
     *      Android < 10 : lire /proc/net/tcp ou /proc/net/udp
     *   3. UID → PackageName via PackageManager
     *   4. Throttler : 1 log par app toutes les LOG_THROTTLE_MS ms
     *
     * Cette méthode est appelée dans le drain thread. Elle est O(1) grâce
     * au throttle — le /proc/net n'est lu que si l'app n'a pas encore
     * été loguée récemment.
     */
    private fun tryLogPacket(buf: ByteArray, len: Int) {
        try {
            // IPv4 seulement
            val version = (buf[0].toInt() and 0xF0) shr 4
            if (version != 4 || len < 20) return
            val ihl      = (buf[0].toInt() and 0x0F) * 4
            val protocol = buf[9].toInt() and 0xFF
            if (protocol != 6 && protocol != 17) return  // TCP ou UDP seulement
            if (len < ihl + 4) return

            // Port source de l'app
            val srcPort = ((buf[ihl].toInt() and 0xFF) shl 8) or (buf[ihl + 1].toInt() and 0xFF)
            // IP source
            val srcIp = "${buf[12].toInt() and 0xFF}.${buf[13].toInt() and 0xFF}" +
                        ".${buf[14].toInt() and 0xFF}.${buf[15].toInt() and 0xFF}"

            val uid = findUidForConnection(srcIp, srcPort, protocol)
            if (uid < 0 || uid == 1000) return  // ignorer les UIDs système

            val packages = packageManager.getPackagesForUid(uid) ?: return
            val pkg = packages.firstOrNull { p ->
                if (allowlistMode) !allowedPackages.contains(p)
                else blockedPackages.contains(p)
            } ?: packages.firstOrNull { it != packageName } ?: return

            // Throttle
            val now = System.currentTimeMillis()
            if (now - (lastLogTime[pkg] ?: 0L) < LOG_THROTTLE_MS) return
            lastLogTime[pkg] = now

            val action = if (allowlistMode && !allowedPackages.contains(pkg)) "blocked"
                         else if (!allowlistMode && blockedPackages.contains(pkg)) "blocked"
                         else return  // ne pas logger les paquets autorisés ici

            ConnectionLogModule.appendLog(this, pkg, action)
        } catch (_: Exception) {}
    }

    /**
     * Résout le UID Android propriétaire d'une connexion TCP/UDP.
     * Android 10+ : API système ConnectivityManager.getConnectionOwnerUid()
     * Android < 10 : lecture de /proc/net/tcp ou /proc/net/udp
     */
    private fun findUidForConnection(srcIp: String, srcPort: Int, protocol: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE)
                            as android.net.ConnectivityManager
                return cm.getConnectionOwnerUid(
                    protocol,
                    InetSocketAddress(srcIp, srcPort),
                    InetSocketAddress("0.0.0.0", 0)
                )
            } catch (_: Exception) {}
        }
        return findUidFromProcNet(srcIp, srcPort, protocol)
    }

    /**
     * Fallback Android < 10 : parse /proc/net/tcp ou /proc/net/udp.
     * Format : sl local_address rem_address st ... uid ...
     * local_address = "IIIIIIII:PPPP" (IP hex little-endian, port hex big-endian)
     */
    private fun findUidFromProcNet(srcIp: String, srcPort: Int, protocol: Int): Int {
        val file    = if (protocol == 6) "/proc/net/tcp" else "/proc/net/udp"
        val hexPort = String.format("%04X", srcPort)
        val parts   = srcIp.split(".")
        if (parts.size != 4) return -1
        // Sur Linux ARM (Android) l'IP est stockée en little-endian
        val hexIp = String.format("%02X%02X%02X%02X",
            parts[3].toIntOrNull() ?: return -1,
            parts[2].toIntOrNull() ?: return -1,
            parts[1].toIntOrNull() ?: return -1,
            parts[0].toIntOrNull() ?: return -1)
        val target = "$hexIp:$hexPort"
        try {
            BufferedReader(FileReader(file)).use { br ->
                var line: String?
                while (br.readLine().also { line = it } != null) {
                    val cols = line!!.trim().split("\\s+".toRegex())
                    if (cols.size >= 8 && cols[1].uppercase() == target) {
                        return cols[7].toIntOrNull() ?: -1
                    }
                }
            }
        } catch (_: Exception) {}
        return -1
    }

    private fun teardownTunnel() {
        drainThread?.interrupt(); drainThread = null
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface = null; isVpnEstablished = false; serviceRunning = false
        releaseWakeLock()
    }

    private fun stopVpnExplicit() {
        teardownTunnel()
        saveActiveState(false)
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ALLOW_MODE, false).apply()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            createDeviceProtectedStorageContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ALLOW_MODE, false).apply()
        }
        stopForeground(true); stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    // ── Alarmes ───────────────────────────────────────────────────────────────

    private fun scheduleAlarm(action: String, delayMs: Long) {
        try {
            val intent = Intent(this, NetLockVpnService::class.java).apply {
                this.action = action
                putExtra("allowlist_mode", allowlistMode)
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getService(this, 99, intent, flags)
            val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val at = System.currentTimeMillis() + delayMs
            am.setWindow(AlarmManager.RTC_WAKEUP, at, minOf(delayMs, 60_000L), pi)
        } catch (e: Exception) { Log.w(TAG, "scheduleAlarm: ${e.message}") }
    }

    private fun scheduleAlarmFromThread(action: String, delayMs: Long) {
        try { scheduleAlarm(action, delayMs) }
        catch (e: Exception) { Log.w(TAG, "scheduleAlarmFromThread: ${e.message}") }
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun startForegroundNotification() {
        // Créer tous les canaux via NotificationHelper (idempotent)
        NotificationHelper.createAllChannels(this)
        // Utiliser CHANNEL_VPN avec IMPORTANCE_HIGH pour ne pas être masqué
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val openPi = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), flags)
        val stopPi = PendingIntent.getService(this, 2, Intent(this, NetLockVpnService::class.java).apply { action = "STOP" }, flags)
        val focusActive = isFocusActive(this)
        val label = when {
            focusActive   -> "Session Focus — blocage actif"
            allowlistMode -> "Liste blanche — tout bloqué sauf exceptions"
            blockedPackages.isEmpty() -> "Aucune app bloquée"
            else -> "${blockedPackages.size} app(s) bloquée(s)"
        }
        val notif = NotificationCompat.Builder(this, NotificationHelper.CHANNEL_VPN)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(if (focusActive) "🎯 Mode Focus actif" else "🛡 NetOff VPN actif")
            .setContentText(label)
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