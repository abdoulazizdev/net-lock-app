package com.netoff.app

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.os.Handler
import android.os.Looper
import java.io.FileInputStream
import java.io.IOException
import java.nio.ByteBuffer

class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread: Thread? = null

    companion object {
        var blockedPackages: HashSet<String> = hashSetOf()
        const val PREFS      = "netoff_vpn"
        const val KEY_ACTIVE = "vpn_was_active"
        var serviceRunning   = false

        @Volatile var isVpnEstablished = false
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            // Redémarrage START_STICKY
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(KEY_ACTIVE, false)) startVpn()
            return START_STICKY
        }
        when (intent.action) {
            "START"        -> {
                startVpn()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, true).apply()
            }
            "STOP"         -> stopVpnExplicit()
            "UPDATE_RULES" -> if (isVpnEstablished) startVpn()
        }
        return START_STICKY
    }

    private fun startVpn() {
        // Arrêter proprement l'ancien tunnel avant d'en créer un nouveau
        drainThread?.interrupt()
        drainThread = null
        vpnInterface?.close()
        vpnInterface = null
        isVpnEstablished = false
        serviceRunning   = false

        try {
            val builder = Builder()
                .setSession("NetOff VPN")
                .addAddress("10.0.0.1", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .setBlocking(true) // lecture bloquante — plus simple et stable

            if (blockedPackages.isEmpty()) {
                // Aucune app bloquée : on ajoute uniquement notre app
                // pour éviter une boucle infinie
                try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
            } else {
                // MODE WHITELIST : seules les apps bloquées entrent dans le tunnel
                // Leur trafic est absorbé (non forwardé) → pas d'internet
                // Les autres apps bypassent complètement → internet normal
                var addedCount = 0
                for (pkg in blockedPackages) {
                    try {
                        builder.addAllowedApplication(pkg)
                        addedCount++
                    } catch (_: Exception) {}
                }
                // Si aucune app n'a pu être ajoutée (ex: toutes désinstallées)
                // on ajoute notre propre app pour que le tunnel soit valide
                if (addedCount == 0) {
                    try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
                }
            }

            val iface = builder.establish()
            if (iface == null) {
                // establish() retourne null si :
                // - permission VPN pas accordée
                // - autre app VPN active
                // On ne crashe pas, on signale juste l'échec
                isVpnEstablished = false
                serviceRunning   = false
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, false).apply()
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true

            // Thread qui draine les paquets entrants
            // Sans ce drain, le buffer TUN se remplit et Android envoie SIGPIPE
            val fd = iface.fileDescriptor
            drainThread = Thread {
                val buf = ByteArray(32767)
                val stream = FileInputStream(fd)
                try {
                    while (!Thread.currentThread().isInterrupted) {
                        // setBlocking(true) → read() bloque jusqu'à un paquet
                        // On lit et on jette — pas de forward → app bloquée
                        val len = stream.read(buf)
                        if (len < 0) break // fd fermé proprement
                    }
                } catch (_: IOException) {
                    // fd fermé par stopVpn() ou onDestroy() — normal
                } catch (_: InterruptedException) {
                    // Thread interrompu volontairement
                } finally {
                    Thread.currentThread().interrupt()
                }
            }
            drainThread!!.isDaemon = true
            drainThread!!.name = "NetOff-VPN-Drain"
            drainThread!!.start()

        } catch (e: Exception) {
            isVpnEstablished = false
            serviceRunning   = false
            vpnInterface?.close()
            vpnInterface = null
        }

        NetOffWidget.forceUpdate(this)
    }

    private fun stopVpnExplicit() {
        drainThread?.interrupt()
        drainThread      = null
        vpnInterface?.close()
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, false).apply()
        stopSelf()
        NetOffWidget.forceUpdate(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        drainThread?.interrupt()
        drainThread      = null
        vpnInterface?.close()
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        // PAS d'écriture false ici — géré uniquement par STOP explicite
        NetOffWidget.forceUpdate(this)
    }
}