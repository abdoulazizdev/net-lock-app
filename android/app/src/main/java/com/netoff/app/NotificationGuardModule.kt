package com.netoff.app

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import com.facebook.react.bridge.*

/**
 * Pont JS du garde de notifications.
 *
 * Deux états distincts, à ne pas confondre côté interface :
 *   — `granted` : l'accès aux notifications accordé dans les réglages Android
 *     (l'utilisateur doit le donner à la main, aucune API ne le demande) ;
 *   — `enabled` : l'interrupteur NetOff, que l'utilisateur garde la main.
 * Le garde n'agit que si les deux sont vrais.
 */
class NotificationGuardModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NotificationGuardModule"

    private fun component() = ComponentName(reactContext, NotificationGuardService::class.java)

    /** L'accès aux notifications est-il accordé à NetOff ? */
    private fun hasAccess(): Boolean {
        return try {
            val flat = Settings.Secure.getString(
                reactContext.contentResolver,
                "enabled_notification_listeners",
            ) ?: return false
            val mine = component()
            flat.split(":").any { ComponentName.unflattenFromString(it) == mine }
        } catch (e: Exception) {
            false
        }
    }

    @ReactMethod
    fun getState(promise: Promise) {
        try {
            val map = Arguments.createMap().apply {
                putBoolean("granted", hasAccess())
                putBoolean("enabled", NotificationGuardService.isGuardEnabled(reactContext))
                putInt("suppressed", NotificationGuardService.suppressedCount(reactContext))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("STATE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setEnabled(enabled: Boolean, promise: Promise) {
        try {
            NotificationGuardService.setGuardEnabled(reactContext, enabled)
            // Le service peut avoir été délié par le système : on le rappelle
            // pour qu'il reprenne immédiatement, sans attendre un redémarrage.
            if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && hasAccess()) {
                runCatching { NotificationListenerService.requestRebind(component()) }
            }
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("SET_ENABLED_ERROR", e.message)
        }
    }

    /** Ouvre l'écran Android d'accès aux notifications — pas d'API pour le demander. */
    @ReactMethod
    fun openAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun resetStats(promise: Promise) {
        try {
            NotificationGuardService.resetSuppressedCount(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESET_ERROR", e.message)
        }
    }
}
