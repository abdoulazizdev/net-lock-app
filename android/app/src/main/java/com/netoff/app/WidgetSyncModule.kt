package com.netoff.app

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Module natif léger exposé à JS pour synchroniser
 * le compteur d'apps bloquées vers le widget.
 * Appeler depuis StorageService.saveRule() côté JS.
 */
class WidgetSyncModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "WidgetSyncModule"

    @ReactMethod
    fun updateBlockedCount(count: Int) {
        ctx.getSharedPreferences("netoff_rules", Context.MODE_PRIVATE)
            .edit().putInt("blocked_count", count).apply()
        NetOffWidget.forceUpdate(ctx)
    }

    @ReactMethod
    fun updateVpnState(isActive: Boolean) {
        ctx.getSharedPreferences(NetLockVpnService.PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(NetLockVpnService.KEY_ACTIVE, isActive).apply()
        NetOffWidget.forceUpdate(ctx)
    }
}