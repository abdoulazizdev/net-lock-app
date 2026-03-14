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

        /**
         * Vérifie si une session Focus est en cours et non expirée.
         * Utilisé pour bloquer les tentatives d'arrêt du VPN pendant le Focus.
         */
        fun isFocusActive(context: Context): Boolean {
            val prefs   = context.getSharedPreferences("netoff_focus", Context.MODE_PRIVATE)
            val active  = prefs.getBoolean(FocusModule.KEY_ACTIVE, false)
            val endTime = prefs.getLong(FocusModule.KEY_END_TIME, 0L)
            return active && endTime > System.currentTimeMillis()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundNotification()

        if (intent == null) {
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
            "STOP" -> {
                // PROTECTION FOCUS : ignorer STOP si session active
                if (isFocusActive(this)) {
                    android.util.Log.w("NetLockVpnService", "STOP ignoré — session Focus active")
                    return START_STICKY
                }
                stopVpnExplicit()
            }
            "STOP_FORCE" -> {
                // Seul le FocusModule peut utiliser STOP_FORCE (fin de session)
                stopVpnExplicit()
            }
            "UPDATE_RULES" -> {
                // PROTECTION FOCUS : ignorer les changements de règles pendant le Focus
                // Le Focus gère ses propres règles
                if (isFocusActive(this)) {
                    android.util.Log.w("NetLockVpnService", "UPDATE_RULES ignoré — session Focus active")
                    return START_STICKY
                }
                if (isVpnEstablished) startVpn()
            }
            "UPDATE_RULES_FORCE" -> {
                // Utilisé par FocusModule pour mettre à jour les règles pendant le Focus
                if (isVpnEstablished) startVpn()
            }
        }
        return START_STICKY
    }

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIF_CHANNEL, "NetOff VPN", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Service VPN actif" }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val openPi = PendingIntent.getActivity(
            this, 0, packageManager.getLaunchIntentForPackage(packageName), flags
        )
        val focusActive = isFocusActive(this)
        val notif = NotificationCompat.Builder(this, NOTIF_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(if (focusActive) "🎯 Mode Focus actif" else "🛡 NetOff VPN actif")
            .setContentText(if (focusActive) "Session en cours — ne peut pas être arrêtée" else "Protection réseau en cours")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openPi)
            .build()
        startForeground(NOTIF_ID, notif)
    }

    private fun startVpn() {
        val oldInterface = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        oldInterface?.close()
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
                var added = 0
                for (pkg in blockedPackages) {
                    try { builder.addAllowedApplication(pkg); added++ } catch (_: Exception) {}
                }
                if (added == 0) try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
            }

            val iface = builder.establish()
            if (iface == null) {
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, false).apply()
                stopForeground(true)
                stopSelf()
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true

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
                } finally {
                    Thread.currentThread().interrupt()
                }
            }.also { it.isDaemon = true; it.name = "NetOff-VPN-Drain"; it.start() }

        } catch (e: Exception) {
            isVpnEstablished = false; serviceRunning = false
            vpnInterface?.close(); vpnInterface = null
        }
        NetOffWidget.forceUpdate(this)
    }

    private fun stopVpnExplicit() {
        val old = vpnInterface
        vpnInterface = null; isVpnEstablished = false; serviceRunning = false
        old?.close(); drainThread?.interrupt(); drainThread = null
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, false).apply()
        stopForeground(true); stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        val old = vpnInterface
        vpnInterface = null; isVpnEstablished = false; serviceRunning = false
        old?.close(); drainThread?.interrupt(); drainThread = null
        NetOffWidget.forceUpdate(this)
    }
}