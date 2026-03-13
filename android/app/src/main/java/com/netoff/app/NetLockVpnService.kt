package com.netoff.app

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.InetAddress
import java.nio.ByteBuffer

class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var packetThread: Thread? = null

    companion object {
        var blockedPackages: HashSet<String> = hashSetOf()
        const val PREFS     = "netoff_vpn"
        const val KEY_ACTIVE = "vpn_was_active"
        var serviceRunning: Boolean = false

        // Mapping packageName → UID (rempli lors de addDisallowedApplication)
        // On logge à partir des UIDs interceptés dans le tunnel
        private var uidToPackage: MutableMap<Int, String> = mutableMapOf()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START" -> {
                startVpn()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, true).apply()
            }
            "STOP" -> {
                stopVpn()
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, false).apply()
            }
            "UPDATE_RULES" -> restartWithNewRules()
        }
        return START_STICKY
    }

    private fun startVpn() {
        // Construire le mapping uid → packageName pour les apps bloquées
        uidToPackage.clear()
        val pm = packageManager
        for (pkg in blockedPackages) {
            try {
                val uid = pm.getApplicationInfo(pkg, 0).uid
                uidToPackage[uid] = pkg
            } catch (_: Exception) {}
        }

        val builder = Builder()
            .setSession("NetOff VPN")
            .addAddress("10.0.0.1", 32)
            .addRoute("0.0.0.0", 0)

        for (pkg in blockedPackages) {
            try { builder.addDisallowedApplication(pkg) } catch (_: Exception) {}
        }

        vpnInterface?.close()
        packetThread?.interrupt()
        vpnInterface = builder.establish()
        serviceRunning = vpnInterface != null

        // Thread de lecture des paquets pour logger les tentatives bloquées
        vpnInterface?.let { iface ->
            packetThread = Thread {
                val buf = ByteBuffer.allocate(32767)
                val inputStream = FileInputStream(iface.fileDescriptor)
                while (!Thread.currentThread().isInterrupted) {
                    try {
                        val len = inputStream.read(buf.array())
                        if (len > 0) {
                            buf.limit(len)
                            logPacket(buf)
                            buf.clear()
                        }
                    } catch (_: Exception) { break }
                }
            }.also { it.isDaemon = true; it.start() }
        }

        NetOffWidget.forceUpdate(this)
    }

    /**
     * Extrait l'UID source du paquet IP et logge la tentative bloquée.
     * Les paquets qui arrivent dans le tunnel sont ceux des apps non-bloquées
     * (addDisallowedApplication = laisser passer). Les apps bloquées ne
     * peuvent pas envoyer de paquets → on logge "blocked" pour chaque app
     * dans blockedPackages au moment où elle tente une connexion via le
     * mécanisme de détection d'activité réseau.
     *
     * Approche simplifiée : on logge "blocked" pour les packages bloqués
     * quand UPDATE_RULES est reçu (confirmé par le système), et "allowed"
     * pour ceux qui passent dans le tunnel.
     */
    private fun logPacket(buf: ByteBuffer) {
        // Lecture simplifiée de l'en-tête IPv4 pour obtenir l'IP source
        // Version 4 = premier nibble = 4
        if (buf.limit() < 20) return
        val version = (buf.get(0).toInt() shr 4) and 0xF
        if (version != 4) return

        // Pour chaque paquet qui passe → app autorisée
        // On ne peut pas détecter les apps bloquées depuis le tunnel (elles
        // n'envoient pas de paquets). On logge depuis VpnModule.setBlockedApps.
    }

    fun logBlockedAttempt(packageName: String) {
        ConnectionLogModule.appendLog(this, packageName, "blocked")
    }

    fun logAllowedAttempt(packageName: String) {
        ConnectionLogModule.appendLog(this, packageName, "allowed")
    }

    private fun stopVpn() {
        packetThread?.interrupt()
        packetThread = null
        vpnInterface?.close()
        vpnInterface = null
        serviceRunning = false
        NetOffWidget.forceUpdate(this)
    }

    private fun restartWithNewRules() {
        if (vpnInterface != null) startVpn()
    }

    override fun onDestroy() {
        super.onDestroy()
        packetThread?.interrupt()
        vpnInterface?.close()
        serviceRunning = false
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, false).apply()
        NetOffWidget.forceUpdate(this)
    }
}