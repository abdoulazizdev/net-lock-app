import { InstalledApp } from "@/types";
import { NativeModules } from "react-native";

const { AppListModule } = NativeModules;

interface RawApp {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
  userId: number;
  isWorkProfile: boolean;
  versionName: string;
  icon: string | null;
}

class AppListService {
  private cacheUserLight: InstalledApp[] | null = null;
  private cacheUserFull: InstalledApp[] | null = null;
  private cacheAllLight: InstalledApp[] | null = null;
  private cacheAllFull: InstalledApp[] | null = null;

  // ── Sans icônes (rapide) ───────────────────────────────────────────────────

  async getNonSystemApps(): Promise<InstalledApp[]> {
    if (this.cacheUserLight) return this.cacheUserLight;
    const raw: RawApp[] = await AppListModule.getInstalledApps(false, false);
    this.cacheUserLight = this.normalize(raw);
    return this.cacheUserLight;
  }

  async getUserApps(): Promise<InstalledApp[]> {
    return this.getNonSystemApps();
  }

  async getAllApps(): Promise<InstalledApp[]> {
    if (this.cacheAllLight) return this.cacheAllLight;
    const raw: RawApp[] = await AppListModule.getInstalledApps(true, false);
    this.cacheAllLight = this.normalize(raw);
    return this.cacheAllLight;
  }

  async getInstalledApps(): Promise<InstalledApp[]> {
    return this.getAllApps();
  }

  // ── Avec icônes (arrière-plan) ─────────────────────────────────────────────

  async getNonSystemAppsWithIcons(): Promise<InstalledApp[]> {
    if (this.cacheUserFull) return this.cacheUserFull;
    const raw: RawApp[] = await AppListModule.getInstalledApps(false, true);
    this.cacheUserFull = this.normalize(raw);
    this.cacheUserLight = this.cacheUserFull;
    return this.cacheUserFull;
  }

  async getAllAppsWithIcons(): Promise<InstalledApp[]> {
    if (this.cacheAllFull) return this.cacheAllFull;
    const raw: RawApp[] = await AppListModule.getInstalledApps(true, true);
    this.cacheAllFull = this.normalize(raw);
    this.cacheAllLight = this.cacheAllFull;
    return this.cacheAllFull;
  }

  // ── Compat ─────────────────────────────────────────────────────────────────

  async getAppsProgressive(includeSystem: boolean): Promise<InstalledApp[]> {
    if (includeSystem) {
      this.getAllAppsWithIcons().catch(() => {});
      return this.getAllApps();
    }
    this.getNonSystemAppsWithIcons().catch(() => {});
    return this.getNonSystemApps();
  }

  // ── Par packageName ────────────────────────────────────────────────────────

  async getAppByPackage(packageName: string): Promise<InstalledApp | null> {
    for (const cache of [
      this.cacheUserFull,
      this.cacheAllFull,
      this.cacheUserLight,
      this.cacheAllLight,
    ]) {
      if (!cache) continue;
      const found = cache.find((a) => a.packageName === packageName);
      if (found) return found;
    }
    try {
      const raw: RawApp | null =
        await AppListModule.getAppByPackage(packageName);
      return raw ? this.normalizeOne(raw) : null;
    } catch {
      return null;
    }
  }

  // ── Cache ──────────────────────────────────────────────────────────────────

  invalidateCache() {
    this.cacheUserLight = null;
    this.cacheUserFull = null;
    this.cacheAllLight = null;
    this.cacheAllFull = null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private normalize(raw: RawApp[]): InstalledApp[] {
    return raw
      .filter((a) => a.packageName && a.appName)
      .map((a) => this.normalizeOne(a))
      .sort((a, b) =>
        a.appName.localeCompare(b.appName, "fr", { sensitivity: "base" }),
      );
  }

  private normalizeOne(raw: RawApp): InstalledApp {
    return {
      packageName: raw.packageName,
      appName:
        raw.appName?.trim() ||
        raw.packageName.split(".").pop() ||
        raw.packageName,
      isSystemApp: raw.isSystemApp ?? false,
      isWorkProfile: raw.isWorkProfile ?? false,
      userId: raw.userId ?? 0,
      icon: raw.icon ?? null,
    };
  }
}

export default new AppListService();
