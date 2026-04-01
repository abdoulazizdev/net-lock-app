package com.netoff.app

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * NotificationHelper — Crée les canaux de notification et gère la permission
 * POST_NOTIFICATIONS (requise sur Android 13+).
 *
 * PROBLÈME RÉSOLU : "Toutes les notifications bloquées"
 *
 * Sur Android 8+, si un canal est créé avec IMPORTANCE_LOW ou IMPORTANCE_NONE,
 * le système peut afficher un avertissement global. De plus, si l'app est
 * installée en debug sans avoir demandé la permission POST_NOTIFICATIONS,
 * Android 13+ bloque toutes les notifications par défaut.
 *
 * Solution :
 *   1. Créer les canaux avec des importances correctes dès le démarrage
 *   2. Demander POST_NOTIFICATIONS à la première utilisation
 *   3. Canaux distincts avec des noms clairs pour que l'utilisateur puisse
 *      les gérer individuellement dans Paramètres → Apps → NetOff → Notifications
 */
object NotificationHelper {

    const val TAG = "NotificationHelper"

    // Canaux de notification
    const val CHANNEL_VPN       = "netoff_vpn_channel"        // Service VPN actif
    const val CHANNEL_ALERTS    = "netoff_alerts_channel"     // Alertes importantes
    const val CHANNEL_WATCHDOG  = "netoff_watchdog_channel"   // Watchdog (discret)
    const val CHANNEL_UPDATES   = "netoff_updates_channel"    // Mises à jour disponibles

    // Request code pour la demande de permission
    const val NOTIF_PERMISSION_REQUEST_CODE = 3301

    /**
     * Crée tous les canaux de notification.
     * À appeler dans MainApplication.onCreate() et dans NetLockVpnService.
     * Idempotent — Android ignore si le canal existe déjà.
     */
    fun createAllChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Canal VPN — HIGH pour ne pas être masqué par le système
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_VPN, "Service VPN", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "État du service VPN et blocage réseau"
                setShowBadge(false)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
        )

        // Canal alertes — HIGH pour les alertes critiques
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ALERTS, "Alertes NetOff", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Alertes importantes — redémarrage VPN, Focus terminé"
                setShowBadge(true)
            }
        )

        // Canal watchdog — LOW (discret, pas de son)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_WATCHDOG, "Surveillance automatique", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Notifications silencieuses de la surveillance du VPN"
                setShowBadge(false)
            }
        )

        // Canal mises à jour — DEFAULT
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_UPDATES, "Mises à jour", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Nouvelles versions de NetOff disponibles"
                setShowBadge(true)
            }
        )

        Log.d(TAG, "Canaux de notification créés")
    }

    /**
     * Vérifie si les notifications sont activées pour l'app.
     * Sur Android 13+ : vérifie la permission POST_NOTIFICATIONS.
     * Sur Android < 13  : vérifie que les notifications ne sont pas bloquées.
     */
    fun areNotificationsEnabled(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
    }

    /**
     * Demande la permission POST_NOTIFICATIONS sur Android 13+.
     * Sur les versions antérieures, les notifications sont autorisées par défaut.
     * Retourne true si déjà accordé (pas besoin de dialog).
     */
    fun requestPermissionIfNeeded(activity: Activity): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        if (areNotificationsEnabled(activity)) return true

        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            NOTIF_PERMISSION_REQUEST_CODE
        )
        return false
    }
}