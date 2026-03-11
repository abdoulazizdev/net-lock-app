package com.netlock.app

import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream

class NetLockVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false

    companion object {
        var blockedPackages: MutableSet<String> = mutableSetOf()
        var serviceRunning = false
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START" -> startVpn()
            "STOP" -> stopVpn()
            "UPDATE_RULES" -> { stopVpn(); startVpn() }
        }
        return START_STICKY
    }

    private fun startVpn() {
        try {
            val builder = Builder()
            builder.setSession("NetLock VPN")
            builder.addAddress("10.0.0.2", 32)
            builder.addRoute("0.0.0.0", 0)
            builder.setMtu(1500)

            // Toutes les apps sauf les bloquées sont exclues du VPN
            // Les apps bloquées passent par le tunnel qui ne transfère rien → bloquées
            val packages = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
            for (pkg in packages) {
                if (!blockedPackages.contains(pkg.packageName)) {
                    try {
                        builder.addDisallowedApplication(pkg.packageName)
                    } catch (e: PackageManager.NameNotFoundException) { }
                }
            }

            vpnInterface = builder.establish()
            isRunning = vpnInterface != null
            serviceRunning = isRunning

            // Lit et jette les paquets → trafic bloqué
            if (isRunning) {
                Thread {
                    val inputStream = FileInputStream(vpnInterface!!.fileDescriptor)
                    val buffer = ByteArray(32767)
                    while (isRunning) {
                        try {
                            inputStream.read(buffer)
                        } catch (e: Exception) {
                            break
                        }
                    }
                }.start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopVpn() {
        isRunning = false
        serviceRunning = false
        vpnInterface?.close()
        vpnInterface = null
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }
}