package com.netoff.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import java.io.FileInputStream
import java.io.IOException

class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread: Thread? = null

    companion object {
        var blockedPackages: HashSet<String> = hashSetOf()
        const val PREFS       = "netoff_vpn"
        const val KEY_ACTIVE  = "vpn_was_active"
        var serviceRunning    = false
        @Volatile var isVpnEstablished = false

        const val NOTIF_CHANNEL = "netoff_vpn_channel"
        const val NOTIF_ID      = 1001
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // ── Démarrer en foreground immédiatement ──────────────────────────────
        // OBLIGATOIRE sur Android 8+ quand lancé avec startForegroundService()
        // Doit être appelé dans les 5 secondes sinon → crash ANR
        startForegroundNotification()

        if (intent == null) {
            // Redémarrage START_STICKY après kill système
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(KEY_ACTIVE, false)) startVpn()
            return START_STICKY
        }

        when (intent.action) {
            "START" -> {
                startVpn()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, true).apply()
            }
            "STOP"         -> stopVpnExplicit()
            "UPDATE_RULES" -> if (isVpnEstablished) startVpn()
        }
        return START_STICKY
    }

    // ── Notification foreground obligatoire ───────────────────────────────────
    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIF_CHANNEL, "NetOff VPN", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Service VPN actif" }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }

        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val pendingOpen = PendingIntent.getActivity(this, 0, openIntent, flags)

        val notif = NotificationCompat.Builder(this, NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("🛡 NetOff VPN actif")
            .setContentText("Protection réseau en cours")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingOpen)
            .build()

        startForeground(NOTIF_ID, notif)
    }

    // ── Démarrer / Redémarrer le tunnel ───────────────────────────────────────
    private fun startVpn() {
        // 1. Arrêter proprement l'ancien tunnel
        //    IMPORTANT : fermer vpnInterface AVANT d'interrompre le thread
        //    FileInputStream.read() est un appel bloquant natif — Thread.interrupt()
        //    seul ne le débloque pas. Fermer le fd lance une IOException → le thread sort.
        val oldInterface = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        oldInterface?.close()          // ← débloque le read() → IOException dans le thread
        drainThread?.interrupt()       // ← signal supplémentaire
        drainThread = null

        try {
            val builder = Builder()
                .setSession("NetOff VPN")
                .addAddress("10.0.0.1", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .setBlocking(true)

            if (blockedPackages.isEmpty()) {
                // Aucune app bloquée → tunnel "vide" : seule notre app est dedans
                // Toutes les autres bypassent → internet normal
                try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
            } else {
                // MODE WHITELIST
                // addAllowedApplication(pkg) = seules ces apps entrent dans le tunnel
                // Le tunnel ne forward rien → leurs paquets sont absorbés → pas d'internet
                // Toutes les autres apps bypassent le tunnel → internet normal
                var added = 0
                for (pkg in blockedPackages) {
                    try { builder.addAllowedApplication(pkg); added++ } catch (_: Exception) {}
                }
                if (added == 0) {
                    try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
                }
            }

            val iface = builder.establish()
            if (iface == null) {
                // establish() = null → permission révoquée ou autre VPN actif
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, false).apply()
                stopForeground(true)
                stopSelf()
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true

            // 2. Thread de drain : lit et jette TOUS les paquets entrants
            //    Sans drain, le buffer TUN se remplit → Android tue le processus (SIGPIPE)
            val fd = iface.fileDescriptor
            drainThread = Thread {
                val buf    = ByteArray(32767)
                val stream = FileInputStream(fd)
                try {
                    while (!Thread.currentThread().isInterrupted) {
                        val len = stream.read(buf)  // bloquant — débloqué par close() du fd
                        if (len < 0) break           // fd fermé proprement
                    }
                } catch (_: IOException) {
                    // Cas normal : vpnInterface.close() a fermé le fd
                } finally {
                    Thread.currentThread().interrupt()
                }
            }.also {
                it.isDaemon = true
                it.name = "NetOff-VPN-Drain"
                it.start()
            }

        } catch (e: Exception) {
            isVpnEstablished = false
            serviceRunning   = false
            vpnInterface?.close()
            vpnInterface = null
        }

        NetOffWidget.forceUpdate(this)
    }

    // ── Arrêt explicite (demandé par l'utilisateur) ───────────────────────────
    private fun stopVpnExplicit() {
        val oldInterface = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        oldInterface?.close()    // débloque le read()
        drainThread?.interrupt()
        drainThread = null

        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, false).apply()

        stopForeground(true)
        stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        val oldInterface = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        oldInterface?.close()
        drainThread?.interrupt()
        drainThread = null
        // PAS d'écriture false ici — uniquement sur STOP explicite
        NetOffWidget.forceUpdate(this)
    }
}