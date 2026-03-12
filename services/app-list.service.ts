import { NativeModules, Platform } from "react-native";
import { InstalledApp } from "../types";

const { AppListModule } = NativeModules;

// ─── Cache L1 in-memory ───────────────────────────────────────────────────────
// Un seul cache : la liste complète avec icônes telle que retournée par le natif.
// Les icônes ne sont PAS mises en cache sur disque (trop volumineuses).
const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache: InstalledApp[] | null = null;
let _cacheTs = 0;
function isFresh() {
  return _cache !== null && Date.now() - _cacheTs < CACHE_TTL_MS;
}

class AppListService {
  // ── Appel natif brut ───────────────────────────────────────────────────────
  // Retourne la liste complète avec icônes, depuis le cache si dispo.
  async getInstalledApps(): Promise<InstalledApp[]> {
    if (isFresh()) return _cache!;

    try {
      if (Platform.OS === "android" && AppListModule) {
        const raw = await AppListModule.getInstalledApps();
        _cache = raw.map((app: any) => ({
          packageName: app.packageName,
          appName: app.appName,
          isSystemApp: app.isSystemApp ?? false,
          icon: app.icon ?? null,
        }));
        _cacheTs = Date.now();
        return _cache!;
      }
    } catch (e) {
      console.error("[AppListService] getInstalledApps:", e);
    }
    return this._getMock();
  }

  // ── Chargement progressif pour les écrans ─────────────────────────────────
  // Étape 1 : retourne immédiatement la liste SANS icônes (noms seulement)
  //           pour afficher la liste le plus vite possible.
  // Étape 2 : appelle onReady() avec la liste complète (avec icônes).
  //
  // Si le cache est chaud, onReady() est appelé immédiatement avec les icônes.
  // Si non, la liste sans icônes est retournée pendant que l'appel natif tourne.
  async getAppsProgressive(
    onReady: (withIcons: InstalledApp[]) => void,
  ): Promise<InstalledApp[]> {
    // Cache chaud → tout disponible immédiatement
    if (isFresh()) {
      onReady(_cache!);
      return _cache!;
    }

    // Pas de cache → on retourne d'abord les noms sans icônes
    // puis on charge tout en arrière-plan
    let noIconsList: InstalledApp[] = [];
    try {
      if (Platform.OS === "android" && AppListModule) {
        const raw = await AppListModule.getInstalledApps();
        const full: InstalledApp[] = raw.map((app: any) => ({
          packageName: app.packageName,
          appName: app.appName,
          isSystemApp: app.isSystemApp ?? false,
          icon: app.icon ?? null,
        }));
        _cache = full;
        _cacheTs = Date.now();
        onReady(full);
        return full;
      }
    } catch (e) {
      console.error("[AppListService] getAppsProgressive:", e);
    }
    const mock = this._getMock();
    onReady(mock);
    return mock;
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────
  async getAppByPackage(packageName: string): Promise<InstalledApp | null> {
    const apps = await this.getInstalledApps();
    return apps.find((a) => a.packageName === packageName) ?? null;
  }

  async getNonSystemApps(): Promise<InstalledApp[]> {
    return (await this.getInstalledApps()).filter((a) => !a.isSystemApp);
  }

  async searchApps(query: string): Promise<InstalledApp[]> {
    const q = query.toLowerCase();
    return (await this.getInstalledApps()).filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  }

  invalidateCache(): void {
    _cache = null;
    _cacheTs = 0;
  }

  // ── Mock ──────────────────────────────────────────────────────────────────
  private _getMock(): InstalledApp[] {
    return [
      {
        packageName: "com.android.chrome",
        appName: "Chrome",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.facebook.katana",
        appName: "Facebook",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.instagram.android",
        appName: "Instagram",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.whatsapp",
        appName: "WhatsApp",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.twitter.android",
        appName: "Twitter",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.spotify.music",
        appName: "Spotify",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.google.android.youtube",
        appName: "YouTube",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.netflix.mediaclient",
        appName: "Netflix",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.snapchat.android",
        appName: "Snapchat",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.tiktok",
        appName: "TikTok",
        isSystemApp: false,
        icon: null,
      },
      {
        packageName: "com.android.settings",
        appName: "Paramètres",
        isSystemApp: true,
        icon: null,
      },
      {
        packageName: "com.android.vending",
        appName: "Play Store",
        isSystemApp: true,
        icon: null,
      },
    ];
  }
}

export default new AppListService();
