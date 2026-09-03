/**
 * services/app-list.service.ts — Accès à l'inventaire d'applications
 *
 * Deux protections indispensables autour du module natif :
 *
 *   • **Déduplication des appels en vol.** Plusieurs écrans peuvent demander
 *     la liste au même instant (onglet Apps, modèles de profil, détail d'un
 *     profil). Sans partage de la promesse, chaque écran déclenchait un scan
 *     complet du PackageManager — c'était la cause des gels au moment de créer
 *     un profil depuis un modèle, qui en lançait sept d'un coup.
 *
 *   • **Cache par variante.** Le résultat diffère selon que l'on inclut les
 *     apps système et que l'on demande les icônes ; chaque combinaison a donc
 *     sa propre entrée.
 */

import { NativeModules } from "react-native";

import type { InstalledApp } from "@/types";

const { AppListModule } = NativeModules;

interface RawApp {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
  isLaunchable?: boolean;
  isEnabled?: boolean;
  userId?: number;
  isWorkProfile?: boolean;
  icon: string | null;
}

/** Combinaisons possibles d'un appel `getInstalledApps`. */
type Variant = "user" | "user+icons" | "all" | "all+icons";

function variantOf(includeSystem: boolean, withIcons: boolean): Variant {
  if (includeSystem) return withIcons ? "all+icons" : "all";
  return withIcons ? "user+icons" : "user";
}

class AppListService {
  private cache = new Map<Variant, InstalledApp[]>();
  private inFlight = new Map<Variant, Promise<InstalledApp[]>>();

  // ── Chargement ─────────────────────────────────────────────────────────────

  /**
   * Liste des applications.
   * @param includeSystem inclure les applications système
   * @param withIcons     joindre les icônes (nettement plus coûteux)
   */
  async getApps(includeSystem: boolean, withIcons: boolean): Promise<InstalledApp[]> {
    const variant = variantOf(includeSystem, withIcons);

    const cached = this.cache.get(variant);
    if (cached) return cached;

    // Une variante avec icônes déjà chargée satisfait la demande sans icônes.
    if (!withIcons) {
      const richer = this.cache.get(variantOf(includeSystem, true));
      if (richer) return richer;
    }

    const pending = this.inFlight.get(variant);
    if (pending) return pending;

    const request = this.fetch(includeSystem, withIcons)
      .then((apps) => {
        this.cache.set(variant, apps);
        // La variante complète couvre aussi la variante légère.
        if (withIcons) this.cache.set(variantOf(includeSystem, false), apps);
        return apps;
      })
      .finally(() => {
        this.inFlight.delete(variant);
      });

    this.inFlight.set(variant, request);
    return request;
  }

  /** Applications installées par l'utilisateur, sans icônes. */
  getUserApps(): Promise<InstalledApp[]> {
    return this.getApps(false, false);
  }

  getUserAppsWithIcons(): Promise<InstalledApp[]> {
    return this.getApps(false, true);
  }

  /** Toutes les applications, système comprises. */
  getAllApps(): Promise<InstalledApp[]> {
    return this.getApps(true, false);
  }

  getAllAppsWithIcons(): Promise<InstalledApp[]> {
    return this.getApps(true, true);
  }

  // ── Icônes à la demande ────────────────────────────────────────────────────

  /**
   * Icônes d'une sélection de packages.
   * Sert à afficher la liste immédiatement, puis à ne charger que les icônes
   * des lignes réellement visibles.
   */
  async getIcons(packageNames: string[]): Promise<Map<string, string>> {
    if (packageNames.length === 0 || !AppListModule?.getAppIcons) return new Map();
    try {
      const raw: Record<string, string> = await AppListModule.getAppIcons(packageNames);
      return new Map(Object.entries(raw ?? {}));
    } catch {
      return new Map();
    }
  }

  // ── Recherche unitaire ─────────────────────────────────────────────────────

  async getAppByPackage(packageName: string): Promise<InstalledApp | null> {
    for (const list of this.cache.values()) {
      const found = list.find((app) => app.packageName === packageName);
      if (found) return found;
    }
    try {
      const raw: RawApp | null = await AppListModule.getAppByPackage(packageName);
      return raw ? this.normalizeOne(raw) : null;
    } catch {
      return null;
    }
  }

  // ── Cache ──────────────────────────────────────────────────────────────────

  /** Vide les caches JS et natif — après une installation ou une désinstallation. */
  invalidateCache(): void {
    this.cache.clear();
    this.inFlight.clear();
    AppListModule?.invalidateCache?.();
  }

  // ── Interne ────────────────────────────────────────────────────────────────

  private async fetch(includeSystem: boolean, withIcons: boolean): Promise<InstalledApp[]> {
    if (!AppListModule) return [];
    const raw: RawApp[] = await AppListModule.getInstalledApps(includeSystem, withIcons);
    return this.normalize(Array.isArray(raw) ? raw : []);
  }

  private normalize(raw: RawApp[]): InstalledApp[] {
    return raw
      .filter((app) => !!app?.packageName)
      .map((app) => this.normalizeOne(app))
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
      isLaunchable: raw.isLaunchable ?? true,
      isEnabled: raw.isEnabled ?? true,
      isWorkProfile: raw.isWorkProfile ?? false,
      userId: raw.userId ?? 0,
      icon: raw.icon ?? null,
    };
  }
}

export default new AppListService();
