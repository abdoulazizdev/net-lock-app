package com.netoff.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.FileInputStream
import java.io.IOException

class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread: Thread? = null

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

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(NOTIF_CHANNEL, "NetOff VPN", NotificationManager.IMPORTANCE_LOW)
                .apply { description = "Service VPN actif" }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(ch)
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
        // Arrêter proprement l'ancien tunnel
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
                // Aucune app à bloquer → seule notre app dans le tunnel
                try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
            } else {
                applyBlockingRules(builder)
            }

            val iface = builder.establish()
            if (iface == null) {
                Log.e(TAG, "establish() retourné null — permission révoquée ou autre VPN actif")
                getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, false).apply()
                stopForeground(true)
                stopSelf()
                return
            }

            vpnInterface     = iface
            isVpnEstablished = true
            serviceRunning   = true

            // Thread drain — lit et jette les paquets du tunnel
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
                    // fd fermé proprement par stopVpn
                } finally {
                    Thread.currentThread().interrupt()
                }
            }.also { it.isDaemon = true; it.name = "NetOff-VPN-Drain"; it.start() }

        } catch (e: Exception) {
            Log.e(TAG, "startVpn error: ${e.message}", e)
            isVpnEstablished = false
            serviceRunning   = false
            vpnInterface?.close()
            vpnInterface = null
        }

        NetOffWidget.forceUpdate(this)
    }

    /**
     * Applique les règles de blocage sur le Builder.
     *
     * MODE WHITELIST (addAllowedApplication) :
     * Seules les apps BLOQUÉES entrent dans le tunnel → leur trafic est drainé → pas d'internet.
     * Les apps non bloquées bypassent le tunnel → internet normal.
     *
     * Problèmes rencontrés sur certains appareils :
     * 1. addAllowedApplication() throw NameNotFoundException pour les apps du profil clone/travail
     *    → On essaie d'abord le packageName tel quel, sinon on ignore silencieusement
     * 2. Sur Huawei/EMUI : certaines apps système ignorent le VPN (réseau propre)
     *    → Pas de solution sans root, on logge un avertissement
     * 3. Si AUCUNE app n'est ajoutée avec succès → whitelist vide → establish() peut retourner
     *    un tunnel qui ne fait rien → on ajoute notre propre packageName comme sentinelle
     */
    private fun applyBlockingRules(builder: Builder) {
        var successCount = 0
        val failed = mutableListOf<String>()

        for (pkg in blockedPackages) {
            // Nettoyer le packageName : supprimer tout suffixe @userId ajouté par AppListModule
            val cleanPkg = pkg.substringBefore("@").trim()
            if (cleanPkg.isEmpty()) continue

            try {
                // Vérifier que l'app existe bien dans le profil principal avant d'ajouter
                packageManager.getApplicationInfo(cleanPkg, 0)
                builder.addAllowedApplication(cleanPkg)
                successCount++
                Log.d(TAG, "  ✓ bloqué: $cleanPkg")
            } catch (e: PackageManager.NameNotFoundException) {
                // App clonée ou profil secondaire — addAllowedApplication ne peut pas la bloquer
                // Le trafic de cette app (sous userId>0) n'est de toute façon pas intercepté
                // par un VPN lancé depuis le profil principal
                failed.add(cleanPkg)
                Log.w(TAG, "  ✗ introuvable dans profil principal (app clonée ?): $cleanPkg")
            } catch (e: Exception) {
                failed.add(cleanPkg)
                Log.w(TAG, "  ✗ erreur pour $cleanPkg: ${e.message}")
            }
        }

        Log.d(TAG, "Règles appliquées: $successCount/${blockedPackages.size} apps bloquées, ${failed.size} ignorées")

        // Sentinelle : si aucune app valide, ajouter notre propre app pour que le tunnel soit valide
        if (successCount == 0) {
            try { builder.addAllowedApplication(packageName) } catch (_: Exception) {}
            Log.w(TAG, "Whitelist vide — tunnel sentinelle uniquement")
        }
    }

    private fun stopVpnExplicit() {
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

    override fun onDestroy() {
        super.onDestroy()
        val old = vpnInterface
        vpnInterface     = null
        isVpnEstablished = false
        serviceRunning   = false
        old?.close()
        drainThread?.interrupt()
        drainThread = null
        NetOffWidget.forceUpdate(this)
    }
}