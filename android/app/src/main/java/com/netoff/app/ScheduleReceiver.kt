package com.netoff.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ScheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val packageName = intent.getStringExtra("packageName") ?: return
        val action = intent.getStringExtra("action") ?: return
        val isBlocked = action == "block"
        NetLockVpnService.blockedPackages.apply {
            if (isBlocked) add(packageName) else remove(packageName)
        }
        if (NetLockVpnService.serviceRunning) {
            val vpnIntent = Intent(context, NetLockVpnService::class.java)
            vpnIntent.action = "UPDATE_RULES"
            context.startService(vpnIntent)
        }
    }
}