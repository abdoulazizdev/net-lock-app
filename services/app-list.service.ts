import { NativeModules, Platform } from "react-native";
import { InstalledApp } from "../types";

const { AppListModule } = NativeModules;

const CACHE_TTL_MS = 5 * 60 * 1000;

// Cache séparé : apps utilisateur / apps complètes (avec système)
let _cacheUser: InstalledApp[] | null = null;
let _cacheAll: InstalledApp[] | null = null;
let _cacheTsUser = 0;
let _cacheTsAll = 0;

function isFresh(ts: number) {
  return Date.now() - ts < CACHE_TTL_MS;
}

class AppListService {
  // ── Appel natif brut ───────────────────────────────────────────────────────
  private async _fetchAll(): Promise<InstalledApp[]> {
    if (_cacheAll && isFresh(_cacheTsAll)) return _cacheAll;
    try {
      if (Platform.OS === "android" && AppListModule) {
        const raw = await AppListModule.getInstalledApps();
        _cacheAll = raw.map((app: any) => ({
          packageName: app.packageName,
          appName: app.appName ?? app.packageName,
          isSystemApp: app.isSystemApp ?? false,
          icon: app.icon ?? null,
        }));
        _cacheTsAll = Date.now();
        // Mettre à jour le cache user aussi
        _cacheUser = _cacheAll!.filter((a) => !a.isSystemApp);
        _cacheTsUser = Date.now();
        return _cacheAll!;
      }
    } catch (e) {
      console.error("[AppListService] _fetchAll:", e);
    }
    return this._getMock(true);
  }

  // ── Apps utilisateur uniquement (défaut) ──────────────────────────────────
  async getUserApps(): Promise<InstalledApp[]> {
    if (_cacheUser && isFresh(_cacheTsUser)) return _cacheUser;
    const all = await this._fetchAll();
    return all.filter((a) => !a.isSystemApp);
  }

  // ── Toutes les apps (avec système) ────────────────────────────────────────
  async getAllApps(): Promise<InstalledApp[]> {
    return this._fetchAll();
  }

  // ── Chargement progressif ─────────────────────────────────────────────────
  // includeSystem = false → liste user rapide
  // includeSystem = true  → tout charger (peut prendre quelques secondes)
  async getAppsProgressive(
    onReady: (withIcons: InstalledApp[]) => void,
    includeSystem = false,
  ): Promise<InstalledApp[]> {
    // Cache chaud → immédiat
    if (includeSystem && _cacheAll && isFresh(_cacheTsAll)) {
      onReady(_cacheAll);
      return _cacheAll;
    }
    if (!includeSystem && _cacheUser && isFresh(_cacheTsUser)) {
      onReady(_cacheUser);
      return _cacheUser;
    }

    try {
      if (Platform.OS === "android" && AppListModule) {
        const raw = await AppListModule.getInstalledApps();
        const full: InstalledApp[] = raw.map((app: any) => ({
          packageName: app.packageName,
          appName: app.appName ?? app.packageName,
          isSystemApp: app.isSystemApp ?? false,
          icon: app.icon ?? null,
        }));
        _cacheAll = full;
        _cacheTsAll = Date.now();
        _cacheUser = full.filter((a) => !a.isSystemApp);
        _cacheTsUser = Date.now();

        const result = includeSystem ? full : _cacheUser;
        onReady(result);
        return result;
      }
    } catch (e) {
      console.error("[AppListService] getAppsProgressive:", e);
    }

    const mock = this._getMock(includeSystem);
    onReady(mock);
    return mock;
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────
  async getInstalledApps(): Promise<InstalledApp[]> {
    return this._fetchAll();
  }

  async getAppByPackage(packageName: string): Promise<InstalledApp | null> {
    const apps = await this._fetchAll();
    return apps.find((a) => a.packageName === packageName) ?? null;
  }

  async getNonSystemApps(): Promise<InstalledApp[]> {
    return this.getUserApps();
  }

  async searchApps(
    query: string,
    includeSystem = false,
  ): Promise<InstalledApp[]> {
    const q = query.toLowerCase();
    const apps = includeSystem
      ? await this._fetchAll()
      : await this.getUserApps();
    return apps.filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  }

  invalidateCache(): void {
    _cacheUser = null;
    _cacheAll = null;
    _cacheTsUser = 0;
    _cacheTsAll = 0;
  }

  // ── Mock ──────────────────────────────────────────────────────────────────
  private _getMock(includeSystem: boolean): InstalledApp[] {
    const userApps: InstalledApp[] = [
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
    ];
    const systemApps: InstalledApp[] = [
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
      {
        packageName: "com.google.android.gms",
        appName: "Services Google",
        isSystemApp: true,
        icon: null,
      },
    ];
    return includeSystem ? [...userApps, ...systemApps] : userApps;
  }
}

export default new AppListService();
