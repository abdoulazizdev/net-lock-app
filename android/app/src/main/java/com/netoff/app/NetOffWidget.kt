package com.netoff.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

/**
 * Widget écran d'accueil NetOff.
 * Affiche le statut VPN + bouton toggle + compteur apps bloquées.
 * Layout : res/layout/widget_netoff.xml
 */
class NetOffWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(context, manager, it) }
    }

    override fun onEnabled(context: Context) {
        forceUpdate(context)
    }

    companion object {
        /** Appelé depuis VpnService, BootReceiver, WidgetToggleReceiver pour rafraîchir tous les widgets. */
        fun forceUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, NetOffWidget::class.java))
            ids.forEach { updateWidget(context, manager, it) }
        }

        private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
            val isActive = prefs.getBoolean(NetLockVpnService.KEY_ACTIVE, false)

            // Lire le nombre d'apps bloquées depuis les prefs partagées
            val rulesPrefs = context.getSharedPreferences("netoff_rules", Context.MODE_PRIVATE)
            val blockedCount = rulesPrefs.getInt("blocked_count", 0)

            val views = RemoteViews(context.packageName, R.layout.widget_netoff)

            // ── Statut de la protection ───────────────────────────────────────
            // `setBackgroundResource` et non `setBackgroundColor` : ce dernier
            // remplace le drawable et faisait perdre les coins arrondis.
            if (isActive) {
                views.setTextViewText(R.id.widget_status, "Protection active")
                views.setTextColor(R.id.widget_status, context.getColor(R.color.widget_success))
                views.setTextViewText(R.id.widget_toggle_btn, "Désactiver")
                views.setInt(R.id.widget_toggle_btn, "setBackgroundResource", R.drawable.widget_btn_bg_active)
                views.setTextColor(R.id.widget_toggle_btn, context.getColor(R.color.widget_danger))
                views.setInt(R.id.widget_bg, "setBackgroundResource", R.drawable.widget_bg_active)
            } else {
                views.setTextViewText(R.id.widget_status, "Protection coupée")
                views.setTextColor(R.id.widget_status, context.getColor(R.color.widget_danger))
                views.setTextViewText(R.id.widget_toggle_btn, "Activer")
                views.setInt(R.id.widget_toggle_btn, "setBackgroundResource", R.drawable.widget_btn_bg)
                views.setTextColor(R.id.widget_toggle_btn, context.getColor(R.color.widget_brand))
                views.setInt(R.id.widget_bg, "setBackgroundResource", R.drawable.widget_bg)
            }

            // ── Compteur apps bloquées ────────────────────────────────────────
            views.setTextViewText(R.id.widget_blocked_count,
                if (blockedCount > 0) "$blockedCount app${if (blockedCount > 1) "s" else ""} bloquée${if (blockedCount > 1) "s" else ""}"
                else "Aucune règle active"
            )

            // ── PendingIntent toggle ──────────────────────────────────────────
            val toggleIntent = Intent(context, WidgetToggleReceiver::class.java).apply {
                action = WidgetToggleReceiver.ACTION_TOGGLE_VPN
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT

            val togglePi = PendingIntent.getBroadcast(context, widgetId, toggleIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_toggle_btn, togglePi)

            // ── PendingIntent tap sur le widget → ouvre l'app ────────────────
            val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val openPi = PendingIntent.getActivity(context, 0, openIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_root, openPi)

            manager.updateAppWidget(widgetId, views)
        }
    }
}