package com.netoff.app

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.LauncherActivityInfo
import android.content.pm.LauncherApps
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Process
import android.os.UserHandle
import android.os.UserManager
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class AppListModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppListModule"

    companion object {
        const val TAG       = "AppListModule"
        const val ICON_SIZE = 96
    }

    @ReactMethod
    fun getInstalledApps(includeSystemApps: Boolean, withIcons: Boolean, promise: Promise) {
        Thread {
            try {
                promise.resolve(collectAllApps(includeSystemApps, withIcons))
            } catch (e: Exception) {
                Log.e(TAG, "getInstalledApps error", e)
                promise.reject("APP_LIST_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun getAppByPackage(packageName: String, promise: Promise) {
        try {
            val pm   = reactContext.packageManager
            val info = pm.getApplicationInfo(packageName, 0)
            promise.resolve(appInfoToMap(pm, info, withIcon = true, profile = null))
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Collecte principale — 4 stratégies complémentaires
    // ─────────────────────────────────────────────────────────────────────────

    private fun collectAllApps(includeSystem: Boolean, withIcons: Boolean): WritableArray {
        val pm = reactContext.packageManager

        // Map : clé unique → (ApplicationInfo, UserHandle?)
        // La clé inclut le profil pour les apps clone : "pkgName" ou "pkgName@userId"
        data class AppEntry(val info: ApplicationInfo, val profile: UserHandle?, val label: String)
        val collected = LinkedHashMap<String, AppEntry>()

        // ── STRATÉGIE 1 : LauncherApps (API officielle multi-profil) ──────────
        // C'est la seule API qui retourne les apps de TOUS les profils autorisés :
        // profil principal, profil professionnel, espace privé Android 15,
        // MIUI Dual Space, Huawei Twin Apps, Samsung Secure Folder, etc.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                val launcherApps = reactContext.getSystemService(Context.LAUNCHER_APPS_SERVICE)
                    as LauncherApps
                val userManager  = reactContext.getSystemService(Context.USER_SERVICE)
                    as UserManager
                val profiles     = userManager.userProfiles

                for (profile in profiles) {
                    try {
                        val activities: List<LauncherActivityInfo> =
                            launcherApps.getActivityList(null, profile)

                        val isMainProfile = profile == Process.myUserHandle()
                        val userId = getUserId(profile)

                        for (activity in activities) {
                            val ai  = activity.applicationInfo
                            val key = if (isMainProfile) ai.packageName else "${ai.packageName}@$userId"
                            if (!collected.containsKey(key)) {
                                // Utiliser le label de l'activité qui est plus précis
                                val label = try {
                                    activity.label.toString()
                                } catch (_: Exception) {
                                    pm.getApplicationLabel(ai).toString()
                                }
                                collected[key] = AppEntry(ai, profile, label)
                            }
                        }
                        Log.d(TAG, "S1 LauncherApps profile=$userId: ${activities.size} activités")
                    } catch (e: Exception) {
                        Log.w(TAG, "S1 profile failed: ${e.message}")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "S1 LauncherApps failed: ${e.message}")
            }
        }

        // ── STRATÉGIE 2 : getInstalledPackages — apps sans launcher ───────────
        // Capture les apps sans activité LAUNCHER (services purs, apps background,
        // apps désactivées, apps installées via ADB sans activité principale)
        try {
            // Flags combinés pour maximiser la couverture
            val flags = PackageManager.GET_META_DATA or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
                    PackageManager.MATCH_DISABLED_COMPONENTS or PackageManager.MATCH_UNINSTALLED_PACKAGES
                else 0

            val pkgs: List<PackageInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(flags.toLong()))
            } else {
                @Suppress("DEPRECATION")
                pm.getInstalledPackages(flags)
            }

            for (pkg in pkgs) {
                val ai = pkg.applicationInfo ?: continue
                if (!collected.containsKey(ai.packageName)) {
                    val label = pm.getApplicationLabel(ai).toString()
                    collected[ai.packageName] = AppEntry(ai, null, label)
                }
            }
            Log.d(TAG, "S2 getInstalledPackages: ${collected.size} total")
        } catch (e: Exception) {
            Log.w(TAG, "S2 failed: ${e.message}")
        }

        // ── STRATÉGIE 3 : Intent ACTION_MAIN avec flags larges ────────────────
        // Certains OEM (EMUI, ColorOS) filtrent LauncherApps mais répondent
        // aux intents directs. On capture aussi les apps qui répondent à des
        // catégories non-standard (certaines apps constructeur).
        val intentCategories = listOf(
            Intent.CATEGORY_LAUNCHER,
            Intent.CATEGORY_LEANBACK_LAUNCHER, // Android TV
            "android.intent.category.HOME",
        )
        for (category in intentCategories) {
            try {
                val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
                val flags  = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                    PackageManager.MATCH_ALL else 0
                val activities = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(flags.toLong()))
                } else {
                    @Suppress("DEPRECATION")
                    pm.queryIntentActivities(intent, flags)
                }
                for (ri in activities) {
                    val ai = ri.activityInfo?.applicationInfo ?: continue
                    if (!collected.containsKey(ai.packageName)) {
                        val label = ri.loadLabel(pm).toString().ifEmpty {
                            pm.getApplicationLabel(ai).toString()
                        }
                        collected[ai.packageName] = AppEntry(ai, null, label)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "S3 category=$category failed: ${e.message}")
            }
        }
        Log.d(TAG, "S3 Intent queries: ${collected.size} total")

        // ── STRATÉGIE 4 : getInstalledApplications (fallback classique) ───────
        try {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
                PackageManager.MATCH_UNINSTALLED_PACKAGES else 0

            val apps: List<ApplicationInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(flags.toLong()))
            } else {
                @Suppress("DEPRECATION")
                pm.getInstalledApplications(flags)
            }
            for (ai in apps) {
                if (!collected.containsKey(ai.packageName)) {
                    collected[ai.packageName] = AppEntry(ai, null, pm.getApplicationLabel(ai).toString())
                }
            }
            Log.d(TAG, "S4 getInstalledApplications: ${collected.size} total")
        } catch (e: Exception) {
            Log.w(TAG, "S4 failed: ${e.message}")
        }

        // ── Filtrage et construction du résultat ──────────────────────────────
        val result = Arguments.createArray()
        var count  = 0

        for ((_, entry) in collected) {
            val ai    = entry.info
            val flags = ai.flags
            val isSystem        = (flags and ApplicationInfo.FLAG_SYSTEM) != 0
            val isUpdatedSystem = (flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
            val isEnabled       = ai.enabled

            // Exclure les apps purement système (sauf mises à jour par l'user)
            if (!includeSystem && isSystem && !isUpdatedSystem) continue

            // Exclure les apps complètement désactivées ET système
            // (garder les apps utilisateur désactivées — l'user peut vouloir les voir)
            if (!isEnabled && isSystem && !isUpdatedSystem) continue

            try {
                val map = Arguments.createMap()
                map.putString("packageName", ai.packageName)
                map.putString("appName",     entry.label.ifEmpty { ai.packageName.split(".").last() })
                map.putBoolean("isSystemApp", isSystem && !isUpdatedSystem)

                // Profil — pour les apps clone/travail
                val userId = if (entry.profile != null) getUserId(entry.profile) else 0
                map.putInt("userId", userId)
                map.putBoolean("isWorkProfile", userId != 0)

                // Version
                try {
                    val pkgInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        pm.getPackageInfo(ai.packageName, PackageManager.PackageInfoFlags.of(0L))
                    } else {
                        @Suppress("DEPRECATION")
                        pm.getPackageInfo(ai.packageName, 0)
                    }
                    map.putString("versionName", pkgInfo.versionName ?: "")
                } catch (_: Exception) {
                    map.putString("versionName", "")
                }

                // Icône — putNull si null pour éviter putString(key, null)
                if (withIcons) {
                    val icon = loadIcon(pm, ai, entry.profile)
                    if (icon != null) map.putString("icon", icon)
                    else map.putNull("icon")
                } else {
                    map.putNull("icon")
                }

                result.pushMap(map)
                count++
            } catch (e: Exception) {
                Log.w(TAG, "Error processing ${ai.packageName}: ${e.message}")
            }
        }

        Log.d(TAG, "Result: $count apps (includeSystem=$includeSystem, withIcons=$withIcons)")
        return result
    }

    // ─── Chargement d'icône ───────────────────────────────────────────────────

    private fun loadIcon(
        pm: PackageManager,
        info: ApplicationInfo,
        profile: UserHandle?
    ): String? {
        return try {
            // Utiliser PackageManager.getApplicationIcon — fiable sur tous les appareils.
            // getBadgedIcon via LauncherApps peut lancer des SecurityException sur certains OEM.
            val drawable: Drawable = try {
                pm.getApplicationIcon(info.packageName)
            } catch (_: Exception) {
                try { pm.getApplicationIcon(info) }
                catch (_: Exception) { pm.defaultActivityIcon }
            }

            val bitmap = drawableToBitmap(drawable)
            val scaled = Bitmap.createScaledBitmap(bitmap, ICON_SIZE, ICON_SIZE, true)
            val out    = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.PNG, 85, out)
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.w(TAG, "Icon failed for ${info.packageName}: ${e.message}")
            null
        }
    }

    private fun drawableToBitmap(d: Drawable): Bitmap {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && d is AdaptiveIconDrawable) {
            val bmp = Bitmap.createBitmap(ICON_SIZE, ICON_SIZE, Bitmap.Config.ARGB_8888)
            d.setBounds(0, 0, ICON_SIZE, ICON_SIZE); d.draw(Canvas(bmp)); return bmp
        }
        if (d is BitmapDrawable && d.bitmap != null) return d.bitmap
        val w = if (d.intrinsicWidth  > 0) d.intrinsicWidth  else ICON_SIZE
        val h = if (d.intrinsicHeight > 0) d.intrinsicHeight else ICON_SIZE
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        d.setBounds(0, 0, w, h); d.draw(Canvas(bmp)); return bmp
    }

    // Obtenir l'userId depuis un UserHandle sans réflexion (API 33+)
    // ou avec réflexion pour les versions antérieures
    private fun getUserId(profile: UserHandle): Int {
        // UserHandle.identifier est @hide avant API 33 et non accessible via propriété Kotlin
        // même avec compileSdk=35. On utilise la réflexion dans tous les cas.
        return try {
            val m = profile.javaClass.getMethod("getIdentifier")
            (m.invoke(profile) as? Int) ?: 0
        } catch (_: Exception) { 0 }
    }

    // ─── appInfoToMap — pour getAppByPackage ──────────────────────────────────
    private fun appInfoToMap(
        pm: PackageManager,
        info: ApplicationInfo,
        withIcon: Boolean,
        profile: UserHandle?
    ): WritableMap {
        val map = Arguments.createMap()
        map.putString("packageName", info.packageName)
        map.putString("appName",     pm.getApplicationLabel(info).toString())
        val isSystem        = (info.flags and ApplicationInfo.FLAG_SYSTEM) != 0
        val isUpdatedSystem = (info.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
        map.putBoolean("isSystemApp", isSystem && !isUpdatedSystem)
        map.putInt("userId",          if (profile != null) getUserId(profile) else 0)
        map.putBoolean("isWorkProfile", profile != null && getUserId(profile) != 0)
        try {
            val pkgInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(info.packageName, PackageManager.PackageInfoFlags.of(0L))
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(info.packageName, 0)
            }
            map.putString("versionName", pkgInfo.versionName ?: "")
        } catch (_: Exception) { map.putString("versionName", "") }
        if (withIcon) {
            val icon = loadIcon(pm, info, profile)
            if (icon != null) map.putString("icon", icon) else map.putNull("icon")
        } else {
            map.putNull("icon")
        }
        return map
    }
}