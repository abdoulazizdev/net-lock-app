package com.netoff.app

import android.app.Notification
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray

/**
 * NotificationGuardService — masque les notifications des apps bloquées.
 *
 * Pourquoi un service séparé du VPN : sur Android, une notification push
 * n'emprunte PAS la connexion de l'application. Firebase Cloud Messaging la
 * livre aux Services Google Play, qui la remettent ensuite à l'app par IPC
 * local. Couper le réseau d'une app ne l'empêche donc jamais de sonner — seul
 * un NotificationListenerService peut retirer la notification une fois posée.
 *
 * Trois garde-fous, parce qu'un utilisateur ne doit jamais rater quelque chose
 * d'important à cause de NetOff :
 *   — le garde ne tourne que si l'utilisateur l'a activé ET que la protection
 *     réseau est active ;
 *   — les paquets système (téléphonie, alarmes, interface système) sont
 *     intouchables ;
 *   — un appel entrant ou une alarme passe toujours, même venant d'une app
 *     bloquée.
 */
class NotificationGuardService : NotificationListenerService() {

    companion object {
        const val TAG = "NotifGuard"

        const val PREFS = "netoff_notif_guard"
        const val KEY_ENABLED = "guard_enabled"
        const val KEY_SUPPRESSED = "suppressed_count"

        /** Jamais interceptées : perdre un appel ou une alarme n'est pas une option. */
        private val PROTECTED_PACKAGES = setOf(
            "android",
            "com.android.systemui",
            "com.android.server.telecom",
            "com.android.phone",
            "com.android.dialer",
            "com.google.android.dialer",
            "com.android.deskclock",
            "com.google.android.deskclock",
            "com.android.emergency",
            "com.android.cellbroadcastreceiver",
        )

        /** Préférences lisibles dès le boot, avant déverrouillage. */
        fun prefs(context: Context): SharedPreferences =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                context.createDeviceProtectedStorageContext()
                    .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            } else {
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            }

        fun isGuardEnabled(context: Context): Boolean =
            prefs(context).getBoolean(KEY_ENABLED, false)

        fun setGuardEnabled(context: Context, enabled: Boolean) {
            prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
            // Miroir en stockage chiffré : les deux doivent rester d'accord.
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ENABLED, enabled).apply()
        }

        fun suppressedCount(context: Context): Int =
            prefs(context).getInt(KEY_SUPPRESSED, 0)

        fun resetSuppressedCount(context: Context) {
            prefs(context).edit().putInt(KEY_SUPPRESSED, 0).apply()
        }
    }

    /** Dernier JSON de règles lu, pour ne re-parser que s'il a changé. */
    private var cachedRulesJson: String? = null
    private var cachedRules: Set<String> = emptySet()

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "Garde connecté")
        // Balayage initial : les notifications déjà affichées au moment où
        // l'utilisateur active le garde doivent disparaître elles aussi.
        sweepActiveNotifications()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val notification = sbn ?: return
        try {
            if (!shouldIntercept(notification)) return
            cancelNotification(notification.key)
            bumpCounter()
            Log.d(TAG, "Notification masquée: ${notification.packageName}")
        } catch (e: Exception) {
            // Une exception ici tuerait le listener pour toute la session.
            Log.w(TAG, "Interception impossible: ${e.message}")
        }
    }

    private fun sweepActiveNotifications() {
        try {
            val active = activeNotifications ?: return
            var removed = 0
            for (sbn in active) {
                if (!shouldIntercept(sbn)) continue
                cancelNotification(sbn.key)
                removed++
            }
            if (removed > 0) {
                bumpCounter(removed)
                Log.d(TAG, "Balayage initial: $removed notification(s) masquée(s)")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Balayage impossible: ${e.message}")
        }
    }

    // ── Décision ──────────────────────────────────────────────────────────────

    private fun shouldIntercept(sbn: StatusBarNotification): Boolean {
        if (!isGuardEnabled(this)) return false
        if (!isProtectionActive()) return false

        val pkg = sbn.packageName ?: return false
        if (pkg == packageName) return false            // jamais les nôtres
        if (pkg in PROTECTED_PACKAGES) return false

        // Un appel entrant ou une alarme passe toujours, même d'une app bloquée.
        when (sbn.notification?.category) {
            Notification.CATEGORY_CALL,
            Notification.CATEGORY_ALARM -> return false
        }

        return isBlocked(pkg)
    }

    /** Le garde suit la protection : coupée, les notifications reviennent. */
    private fun isProtectionActive(): Boolean =
        vpnPrefs().getBoolean(NetLockVpnService.KEY_ACTIVE, false)

    private fun isBlocked(pkg: String): Boolean {
        val p = vpnPrefs()
        return if (p.getBoolean(NetLockVpnService.KEY_ALLOW_MODE, false)) {
            // Liste blanche : tout ce qui n'est pas autorisé est bloqué.
            !rules(p.getString(VpnModule.KEY_ALLOWED_PKGS, "[]")).contains(pkg)
        } else {
            rules(p.getString(VpnModule.KEY_BLOCKED_PKGS, "[]")).contains(pkg)
        }
    }

    private fun vpnPrefs(): SharedPreferences =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            createDeviceProtectedStorageContext()
                .getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        } else {
            getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
        }

    /** Parse la liste de paquets, en ne re-parsant que si le JSON a changé. */
    private fun rules(json: String?): Set<String> {
        val raw = json ?: "[]"
        if (raw == cachedRulesJson) return cachedRules
        val set = HashSet<String>()
        try {
            val array = JSONArray(raw)
            for (i in 0 until array.length()) set.add(array.getString(i))
        } catch (e: Exception) {
            Log.w(TAG, "Règles illisibles: ${e.message}")
        }
        cachedRulesJson = raw
        cachedRules = set
        return set
    }

    private fun bumpCounter(by: Int = 1) {
        val p = prefs(this)
        p.edit().putInt(KEY_SUPPRESSED, p.getInt(KEY_SUPPRESSED, 0) + by).apply()
    }
}
