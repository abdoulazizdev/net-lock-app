package com.netoff.app

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor

class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null

    companion object {
        var blockedPackages: HashSet<String> = hashSetOf()
        const val PREFS = "netoff_vpn"
        const val KEY_ACTIVE = "vpn_was_active"
        // Maintenu pour compatibilité avec VpnModule.kt (isVpnActive / serviceRunning)
        var serviceRunning: Boolean = false
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
        val builder = Builder()
            .setSession("NetOff VPN")
            .addAddress("10.0.0.1", 32)
            .addRoute("0.0.0.0", 0)

        for (pkg in blockedPackages) {
            try { builder.addDisallowedApplication(pkg) } catch (_: Exception) {}
        }

        vpnInterface?.close()
        vpnInterface = builder.establish()
        serviceRunning = vpnInterface != null

        NetOffWidget.forceUpdate(this)
    }

    private fun stopVpn() {
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
        vpnInterface?.close()
        serviceRunning = false
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, false).apply()
        NetOffWidget.forceUpdate(this)
    }
}