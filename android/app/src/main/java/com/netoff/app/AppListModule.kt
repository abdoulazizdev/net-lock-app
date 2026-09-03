package com.netoff.app

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.LauncherActivityInfo
import android.content.pm.LauncherApps
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

/**
 * Inventaire des applications installées.
 *
 * Deux exigences contradictoires : ne rien manquer, et rester rapide. Le
 * PackageManager ne répond pas de la même façon selon les surcouches
 * constructeur, d'où plusieurs stratégies de collecte complémentaires. Mais
 * chaque appel au PackageManager est une IPC : en interroger une par
 * application (ce que faisait la version précédente pour lire le numéro de
 * version) provoquait plusieurs centaines d'allers-retours et gelait l'app.
 *
 * Règles tenues ici :
 *   • aucune IPC par application dans la boucle de construction du résultat ;
 *   • les icônes sont encodées en WebP (≈ 4× plus léger que le PNG précédent) ;
 *   • un scan complet est mis en cache côté natif pendant quelques secondes,
 *     ce qui absorbe les appels simultanés venant de plusieurs écrans.
 */
class AppListModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppListModule"

    companion object {
        const val TAG = "AppListModule"

        /** Côté du bitmap d'icône, en pixels. */
        const val ICON_SIZE = 84

        /** Qualité WebP — au-delà, le gain visuel ne justifie plus le poids. */
        const val ICON_QUALITY = 78

        /**
         * Durée de validité du dernier scan. Assez longue pour absorber les
         * écrans qui se montent en cascade, assez courte pour qu'une
         * installation soit visible après un simple retour sur la liste.
         */
        const val CACHE_TTL_MS = 10_000L
    }

    /** Application collectée, avant mise en forme pour le pont React. */
    private data class Entry(
        val info: ApplicationInfo,
        val profile: UserHandle?,
        val label: String,
        /** L'app possède une activité lançable — sert à trier l'utile du technique. */
        val launchable: Boolean,
    )

    private class Snapshot(val entries: List<Entry>, val takenAt: Long)

    @Volatile private var snapshot: Snapshot? = null
    private val scanLock = Any()

    // ─────────────────────────────────────────────────────────────────────────
    // API exposée à JavaScript
    // ─────────────────────────────────────────────────────────────────────────

    @ReactMethod
    fun getInstalledApps(includeSystemApps: Boolean, withIcons: Boolean, promise: Promise) {
        Thread {
            try {
                val entries = entries()
                promise.resolve(buildResult(entries, includeSystemApps, withIcons))
            } catch (e: Exception) {
                Log.e(TAG, "getInstalledApps", e)
                promise.reject("APP_LIST_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Icônes d'une sélection d'applications.
     * Permet de charger la liste sans icônes (instantané) puis de ne demander
     * que celles réellement affichées.
     */
    @ReactMethod
    fun getAppIcons(packageNames: ReadableArray, promise: Promise) {
        Thread {
            try {
                val pm = reactContext.packageManager
                val byPackage = entries().associateBy { it.info.packageName }
                val result = Arguments.createMap()

                for (i in 0 until packageNames.size()) {
                    val pkg = packageNames.getString(i) ?: continue
                    val entry = byPackage[pkg]
                    val icon =
                        if (entry != null) loadIcon(pm, entry.info)
                        else runCatching { loadIcon(pm, pm.getApplicationInfo(pkg, 0)) }.getOrNull()
                    if (icon != null) result.putString(pkg, icon)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "getAppIcons", e)
                promise.reject("APP_ICONS_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun getAppByPackage(packageName: String, promise: Promise) {
        Thread {
            try {
                val pm = reactContext.packageManager
                val info = pm.getApplicationInfo(packageName, 0)
                val map = Arguments.createMap()
                map.putString("packageName", packageName)
                map.putString("appName", label(pm, info))
                val isSystem = info.flags and ApplicationInfo.FLAG_SYSTEM != 0
                val isUpdated = info.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP != 0
                map.putBoolean("isSystemApp", isSystem && !isUpdated)
                map.putInt("userId", 0)
                map.putBoolean("isWorkProfile", false)
                val icon = loadIcon(pm, info)
                if (icon != null) map.putString("icon", icon) else map.putNull("icon")
                promise.resolve(map)
            } catch (_: Exception) {
                promise.resolve(null)
            }
        }.start()
    }

    /** Force un nouveau scan au prochain appel (après installation ou désinstallation). */
    @ReactMethod
    fun invalidateCache() {
        snapshot = null
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Collecte
    // ─────────────────────────────────────────────────────────────────────────

    private fun entries(): List<Entry> {
        snapshot?.let {
            if (System.currentTimeMillis() - it.takenAt < CACHE_TTL_MS) return it.entries
        }
        // Un seul scan à la fois : plusieurs écrans peuvent démarrer ensemble,
        // et un scan concurrent coûterait autant que le premier pour rien.
        synchronized(scanLock) {
            snapshot?.let {
                if (System.currentTimeMillis() - it.takenAt < CACHE_TTL_MS) return it.entries
            }
            val scanned = scan()
            snapshot = Snapshot(scanned, System.currentTimeMillis())
            return scanned
        }
    }

    private fun scan(): List<Entry> {
        val pm = reactContext.packageManager
        val collected = LinkedHashMap<String, Entry>()
        val started = System.currentTimeMillis()

        // ── 1. LauncherApps — la seule API qui couvre tous les profils ───────
        // Profil principal, profil professionnel, espace privé Android 15,
        // Dual Space MIUI, Twin Apps Huawei, Secure Folder Samsung.
        val launchablePackages = HashSet<String>()
        try {
            val launcherApps =
                reactContext.getSystemService(Context.LAUNCHER_APPS_SERVICE) as LauncherApps
            val userManager =
                reactContext.getSystemService(Context.USER_SERVICE) as UserManager

            for (profile in userManager.userProfiles) {
                try {
                    val isMain = profile == Process.myUserHandle()
                    val userId = userId(profile)
                    val activities: List<LauncherActivityInfo> =
                        launcherApps.getActivityList(null, profile)

                    for (activity in activities) {
                        val info = activity.applicationInfo
                        launchablePackages.add(info.packageName)
                        val key =
                            if (isMain) info.packageName else "${info.packageName}@$userId"
                        if (collected.containsKey(key)) continue
                        val name = runCatching { activity.label.toString() }
                            .getOrNull()
                            ?.takeIf { it.isNotBlank() }
                            ?: label(pm, info)
                        collected[key] = Entry(info, profile, name, launchable = true)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "LauncherApps profil ignoré : ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "LauncherApps indisponible : ${e.message}")
        }

        // ── 2. Intents ACTION_MAIN — surcouches qui filtrent LauncherApps ────
        for (category in listOf(Intent.CATEGORY_LAUNCHER, Intent.CATEGORY_LEANBACK_LAUNCHER)) {
            try {
                val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
                val flags = PackageManager.MATCH_ALL
                val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.queryIntentActivities(
                        intent,
                        PackageManager.ResolveInfoFlags.of(flags.toLong()),
                    )
                } else {
                    @Suppress("DEPRECATION")
                    pm.queryIntentActivities(intent, flags)
                }
                for (resolveInfo in resolved) {
                    val info = resolveInfo.activityInfo?.applicationInfo ?: continue
                    launchablePackages.add(info.packageName)
                    if (collected.containsKey(info.packageName)) continue
                    val name = runCatching { resolveInfo.loadLabel(pm).toString() }
                        .getOrNull()
                        ?.takeIf { it.isNotBlank() }
                        ?: label(pm, info)
                    collected[info.packageName] = Entry(info, null, name, launchable = true)
                }
            } catch (e: Exception) {
                Log.w(TAG, "queryIntentActivities($category) : ${e.message}")
            }
        }

        // ── 3. Inventaire complet — apps sans activité de lancement ──────────
        // Services purs, apps désactivées, composants constructeur : ils
        // consomment du réseau et doivent donc pouvoir être bloqués.
        try {
            var flags = 0
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                flags = flags or PackageManager.MATCH_DISABLED_COMPONENTS or
                    PackageManager.MATCH_DISABLED_UNTIL_USED_COMPONENTS or
                    PackageManager.MATCH_UNINSTALLED_PACKAGES
            }
            val apps: List<ApplicationInfo> =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.getInstalledApplications(
                        PackageManager.ApplicationInfoFlags.of(flags.toLong()),
                    )
                } else {
                    @Suppress("DEPRECATION")
                    pm.getInstalledApplications(flags)
                }

            for (info in apps) {
                if (collected.containsKey(info.packageName)) continue
                // Écarte les résidus d'applications désinstallées remontés par
                // MATCH_UNINSTALLED_PACKAGES : leurs données existent encore,
                // mais l'app n'est plus là et ne consomme aucun réseau.
                if (info.flags and ApplicationInfo.FLAG_INSTALLED == 0) continue
                collected[info.packageName] = Entry(
                    info,
                    null,
                    label(pm, info),
                    launchable = launchablePackages.contains(info.packageName),
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "getInstalledApplications : ${e.message}")
        }

        val entries = collected.values.toList()
        Log.d(TAG, "Scan : ${entries.size} apps en ${System.currentTimeMillis() - started} ms")
        return entries
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mise en forme
    // ─────────────────────────────────────────────────────────────────────────

    private fun buildResult(
        entries: List<Entry>,
        includeSystem: Boolean,
        withIcons: Boolean,
    ): WritableArray {
        val pm = reactContext.packageManager
        val result = Arguments.createArray()

        for (entry in entries) {
            val info = entry.info
            val isSystem = info.flags and ApplicationInfo.FLAG_SYSTEM != 0
            val isUpdated = info.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP != 0

            // Une app système mise à jour par l'utilisateur (Chrome, Maps…) est
            // traitée comme une app utilisateur : c'est ainsi qu'elle est
            // perçue, et c'est celle qu'on veut voir dans « Mes apps ».
            val systemApp = isSystem && !isUpdated

            // NetOff ne peut pas se bloquer lui-même sans se couper le tunnel.
            if (info.packageName == reactContext.packageName) continue

            if (!includeSystem && systemApp) continue

            val map = Arguments.createMap()
            map.putString("packageName", info.packageName)
            map.putString(
                "appName",
                entry.label.ifBlank { info.packageName.substringAfterLast('.') },
            )
            map.putBoolean("isSystemApp", systemApp)
            map.putBoolean("isLaunchable", entry.launchable)
            map.putBoolean("isEnabled", info.enabled)

            val userId = entry.profile?.let { userId(it) } ?: 0
            map.putInt("userId", userId)
            map.putBoolean("isWorkProfile", userId != 0)

            if (withIcons) {
                val icon = loadIcon(pm, info)
                if (icon != null) map.putString("icon", icon) else map.putNull("icon")
            } else {
                map.putNull("icon")
            }

            result.pushMap(map)
        }
        return result
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utilitaires
    // ─────────────────────────────────────────────────────────────────────────

    private fun label(pm: PackageManager, info: ApplicationInfo): String =
        runCatching { pm.getApplicationLabel(info).toString() }
            .getOrNull()
            ?.takeIf { it.isNotBlank() }
            ?: info.packageName.substringAfterLast('.')

    private fun loadIcon(pm: PackageManager, info: ApplicationInfo): String? = try {
        val drawable: Drawable =
            runCatching { pm.getApplicationIcon(info.packageName) }
                .recoverCatching { pm.getApplicationIcon(info) }
                .getOrElse { pm.defaultActivityIcon }

        val bitmap = toBitmap(drawable)
        val out = ByteArrayOutputStream()
        // WebP plutôt que PNG : à qualité perçue égale, l'icône encodée pèse
        // environ quatre fois moins, ce qui divise d'autant le volume transféré
        // sur le pont React pour plusieurs centaines d'applications.
        val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Bitmap.CompressFormat.WEBP_LOSSY
        } else {
            @Suppress("DEPRECATION")
            Bitmap.CompressFormat.WEBP
        }
        bitmap.compress(format, ICON_QUALITY, out)
        Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    } catch (e: Exception) {
        Log.w(TAG, "Icône indisponible pour ${info.packageName} : ${e.message}")
        null
    }

    /** Rend le drawable directement à la taille cible, sans redimensionnement. */
    private fun toBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable) {
            drawable.bitmap?.let { source ->
                if (source.width == ICON_SIZE && source.height == ICON_SIZE) return source
                return Bitmap.createScaledBitmap(source, ICON_SIZE, ICON_SIZE, true)
            }
        }
        val bitmap = Bitmap.createBitmap(ICON_SIZE, ICON_SIZE, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && drawable is AdaptiveIconDrawable) {
            drawable.setBounds(0, 0, ICON_SIZE, ICON_SIZE)
        } else {
            drawable.setBounds(0, 0, ICON_SIZE, ICON_SIZE)
        }
        drawable.draw(canvas)
        return bitmap
    }

    /** `UserHandle.getIdentifier()` reste masqué : la réflexion est la seule voie. */
    private fun userId(profile: UserHandle): Int = try {
        (profile.javaClass.getMethod("getIdentifier").invoke(profile) as? Int) ?: 0
    } catch (_: Exception) {
        0
    }
}
