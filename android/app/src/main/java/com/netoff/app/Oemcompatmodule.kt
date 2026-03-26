package com.netoff.app

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*

class OemCompatModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "OemCompatModule"

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        try {
            val map = Arguments.createMap().apply {
                putString("manufacturer",   Build.MANUFACTURER.lowercase())
                putString("brand",          Build.BRAND.lowercase())
                putString("model",          Build.MODEL)
                putString("androidVersion", Build.VERSION.RELEASE)
                putInt   ("sdkInt",         Build.VERSION.SDK_INT)
                putString("oem",            detectOem())
                putBoolean("isBatteryOptimized",   checkBatteryOptimized())
                putBoolean("hasAutoStartSetting",  hasAutoStartSetting())
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun isBatteryOptimized(promise: Promise) {
        promise.resolve(checkBatteryOptimized())
    }

    @ReactMethod
    fun openBatteryOptimizationSettings(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Pas d'activité active")
            return
        }
        val oem    = detectOem()
        val intents = buildBatteryIntents(oem)
        if (tryStartActivity(intents)) {
            promise.resolve(oem)
        } else {
            promise.reject("NO_SETTING", "Paramètre batterie introuvable")
        }
    }

    @ReactMethod
    fun openAutoStartSettings(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Pas d'activité active")
            return
        }
        val oem     = detectOem()
        val intents = buildAutoStartIntents(oem)
        Log.d(TAG, "openAutoStartSettings OEM=$oem, ${intents.size} candidats")
        if (tryStartActivity(intents)) {
            promise.resolve(oem)
        } else {
            // Fallback universel : paramètres de l'app
            val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (tryStartActivity(listOf(fallback))) {
                promise.resolve("fallback_app_settings")
            } else {
                promise.reject("FAILED", "Impossible d'ouvrir les paramètres")
            }
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimization(promise: Promise) {
        if (reactContext.currentActivity == null) {
            promise.reject("NO_ACTIVITY", "")
            return
        }
        val pkg = reactContext.packageName
        val intents = mutableListOf<Intent>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            intents.add(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$pkg")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }
        intents.add(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        intents.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:$pkg")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        if (tryStartActivity(intents)) promise.resolve(true)
        else promise.reject("FAILED", "Impossible d'ouvrir les paramètres batterie")
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        if (reactContext.currentActivity == null) {
            promise.reject("NO_ACTIVITY", "")
            return
        }
        val intents = mutableListOf<Intent>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intents.add(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }
        intents.add(Intent("android.settings.APP_NOTIFICATION_SETTINGS").apply {
            putExtra("app_package", reactContext.packageName)
            putExtra("app_uid", reactContext.applicationInfo.uid)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        intents.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${reactContext.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        if (tryStartActivity(intents)) promise.resolve(true)
        else promise.reject("FAILED", "Impossible d'ouvrir les paramètres notifications")
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun detectOem(): String {
        val m = Build.MANUFACTURER.lowercase()
        val b = Build.BRAND.lowercase()
        return when {
            m.contains("huawei") || b.contains("huawei") || b.contains("honor") -> "huawei"
            m.contains("xiaomi") || b.contains("xiaomi") || b.contains("redmi") || b.contains("poco") -> "xiaomi"
            m.contains("oppo")   || b.contains("oppo")   || b.contains("realme") || b.contains("oneplus") -> "oppo"
            m.contains("vivo")   || b.contains("vivo")   || b.contains("iqoo") -> "vivo"
            m.contains("samsung")|| b.contains("samsung") -> "samsung"
            m.contains("sony")   || b.contains("sony") -> "sony"
            m.contains("motorola")|| b.contains("motorola") -> "motorola"
            m.contains("lenovo") || b.contains("lenovo") -> "lenovo"
            m.contains("asus")   || b.contains("asus") -> "asus"
            else -> "generic"
        }
    }

    private fun checkBatteryOptimized(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
        val service = reactContext.getSystemService(Context.POWER_SERVICE) ?: return false
        val pm = service as PowerManager
        return !pm.isIgnoringBatteryOptimizations(reactContext.packageName)
    }

    private fun hasAutoStartSetting(): Boolean {
        return detectOem() in setOf("huawei", "xiaomi", "oppo", "vivo", "asus")
    }

    /**
     * Essaie chaque Intent dans la liste via reactContext (FLAG_ACTIVITY_NEW_TASK).
     * Retourne true dès qu'une Intent réussit.
     */
    private fun tryStartActivity(intents: List<Intent>): Boolean {
        for (intent in intents) {
            try {
                val resolved = reactContext.packageManager
                    .queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
                if (resolved.isNotEmpty()) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactContext.startActivity(intent)
                    Log.d(TAG, "Intent résolue: ${intent.component ?: intent.action}")
                    return true
                }
            } catch (e: Exception) {
                Log.w(TAG, "Intent échouée (${intent.action}): ${e.message}")
            }
        }
        return false
    }

    private fun buildBatteryIntents(oem: String): List<Intent> {
        val pkg  = reactContext.packageName
        val list = mutableListOf<Intent>()
        when (oem) {
            "huawei" -> {
                list.add(componentIntent("com.huawei.systemmanager",
                    "com.huawei.systemmanager.startemission.AppStartEmissionActivity"))
                list.add(componentIntent("com.huawei.systemmanager",
                    "com.huawei.systemmanager.optimize.process.ProtectActivity"))
                list.add(Intent("com.huawei.systemmanager.ACTION_BATTERY_MANAGER"))
            }
            "xiaomi" -> {
                list.add(componentIntent("com.miui.powerkeeper",
                    "com.miui.powerkeeper.ui.HiddenAppsContainerManagementActivity"))
                list.add(componentIntent("com.miui.securitycenter",
                    "com.miui.powercenter.PowerSettings"))
            }
            "oppo" -> {
                list.add(componentIntent("com.coloros.oppoguardelf",
                    "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity"))
                list.add(componentIntent("com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity"))
            }
            "vivo" -> {
                list.add(componentIntent("com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"))
            }
            "samsung" -> {
                list.add(componentIntent("com.samsung.android.lool",
                    "com.samsung.android.sm.battery.ui.BatteryActivity"))
                list.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$pkg")
                })
            }
            "asus" -> {
                list.add(componentIntent("com.asus.mobilemanager",
                    "com.asus.mobilemanager.autostart.AutoStartActivity"))
            }
        }
        // Fallbacks universels
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            list.add(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$pkg")
            })
            list.add(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
        list.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:$pkg")
        })
        return list
    }

    private fun buildAutoStartIntents(oem: String): List<Intent> {
        val list = mutableListOf<Intent>()
        when (oem) {
            "huawei" -> {
                list.add(componentIntent("com.huawei.systemmanager",
                    "com.huawei.systemmanager.startemission.AppStartEmissionActivity"))
                list.add(componentIntent("com.huawei.systemmanager",
                    "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"))
            }
            "xiaomi" -> {
                list.add(componentIntent("com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"))
            }
            "oppo" -> {
                list.add(componentIntent("com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity"))
                list.add(componentIntent("com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity"))
            }
            "vivo" -> {
                list.add(componentIntent("com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"))
                list.add(componentIntent("com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"))
            }
            "asus" -> {
                list.add(componentIntent("com.asus.mobilemanager",
                    "com.asus.mobilemanager.autostart.AutoStartActivity"))
            }
            "lenovo" -> {
                list.add(componentIntent("com.lenovo.security",
                    "com.lenovo.security.purebackground.PureBackgroundActivity"))
            }
        }
        return list
    }

    /** Crée une Intent par ComponentName avec FLAG_ACTIVITY_NEW_TASK. */
    private fun componentIntent(pkg: String, cls: String): Intent =
        Intent().apply {
            component = ComponentName(pkg, cls)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

    companion object { const val TAG = "OemCompatModule" }
}