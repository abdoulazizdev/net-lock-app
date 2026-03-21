package com.netoff.app

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*

class AppInfoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppInfoModule"

    // ── Infos complètes d'une app ──────────────────────────────────────────────
    @ReactMethod
    fun getAppDetails(packageName: String, promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                PackageManager.PackageInfoFlags.of(
                    (PackageManager.GET_PERMISSIONS or
                     PackageManager.GET_META_DATA).toLong()
                )
            else null

            val pkgInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && flags != null) {
                pm.getPackageInfo(packageName, flags)
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(packageName,
                    PackageManager.GET_PERMISSIONS or PackageManager.GET_META_DATA)
            }

            val ai   = pkgInfo.applicationInfo
                ?: throw PackageManager.NameNotFoundException("applicationInfo null for $packageName")
            val map  = Arguments.createMap()

            // Infos de base
            map.putString("packageName",   packageName)
            map.putString("appName",       pm.getApplicationLabel(ai).toString())
            map.putString("versionName",   pkgInfo.versionName ?: "—")
            map.putInt("versionCode",
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                    pkgInfo.longVersionCode.toInt()
                else @Suppress("DEPRECATION") pkgInfo.versionCode
            )
            map.putBoolean("isSystemApp",
                (ai.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0)
            map.putBoolean("isEnabled", ai.enabled)

            // Dates
            map.putDouble("firstInstallTime", pkgInfo.firstInstallTime.toDouble())
            map.putDouble("lastUpdateTime",   pkgInfo.lastUpdateTime.toDouble())

            // Taille (APK sur disque)
            try {
                val sourceDir = ai.sourceDir
                val apkFile   = java.io.File(sourceDir)
                map.putDouble("apkSizeBytes", apkFile.length().toDouble())
            } catch (_: Exception) {
                map.putDouble("apkSizeBytes", 0.0)
            }

            // Permissions déclarées
            val permsArray = Arguments.createArray()
            pkgInfo.requestedPermissions?.forEach { permsArray.pushString(it) }
            map.putArray("permissions", permsArray)

            // Notifications activées
            val notifEnabled = areNotificationsEnabled(packageName)
            map.putBoolean("notificationsEnabled", notifEnabled)

            // Peut être lancée
            val launchIntent = pm.getLaunchIntentForPackage(packageName)
            map.putBoolean("isLaunchable", launchIntent != null)

            // Chemin APK
            map.putString("sourceDir", ai.sourceDir ?: "")

            promise.resolve(map)
        } catch (e: PackageManager.NameNotFoundException) {
            promise.reject("NOT_FOUND", "App introuvable: $packageName")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    // ── Vérifier si les notifs sont activées ──────────────────────────────────
    private fun areNotificationsEnabled(packageName: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE)
                    as NotificationManager
                val importanceNone = NotificationManager.IMPORTANCE_NONE
                // Vérifier si toutes les chaînes de notif sont silenciées
                val channels = nm.getNotificationChannelsCompat(packageName)
                if (channels.isEmpty()) {
                    // Pas de channels → utiliser la méthode globale
                    notificationsEnabledGlobal(packageName)
                } else {
                    channels.any { it.importance != importanceNone }
                }
            } else {
                notificationsEnabledGlobal(packageName)
            }
        } catch (_: Exception) { true }
    }

    private fun notificationsEnabledGlobal(packageName: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                // Utiliser la méthode areNotificationsEnabled sur l'app courante
                // Pour les autres apps, on ne peut que ouvrir les paramètres
                nm.areNotificationsEnabled()
            } else true
        } catch (_: Exception) { true }
    }

    private fun NotificationManager.getNotificationChannelsCompat(packageName: String):
        List<android.app.NotificationChannel> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try { notificationChannels ?: emptyList() } catch (_: Exception) { emptyList() }
        } else emptyList()
    }

    // ── Ouvrir les paramètres système de l'app ────────────────────────────────
    @ReactMethod
    fun openAppSettings(packageName: String, promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    // ── Ouvrir les paramètres de notifications ────────────────────────────────
    @ReactMethod
    fun openNotificationSettings(packageName: String, promise: Promise) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    // ── Lancer l'application ──────────────────────────────────────────────────
    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val intent = reactContext.packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.reject("NOT_LAUNCHABLE", "Cette app ne peut pas être lancée directement")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    // ── Désinstaller l'application ────────────────────────────────────────────
    @ReactMethod
    fun uninstallApp(packageName: String, promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_DELETE).apply {
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    // ── Ouvrir gestion stockage (vider cache/données) ─────────────────────────
    @ReactMethod
    fun openStorageSettings(packageName: String, promise: Promise) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }
}