import AsyncStorage from "@react-native-async-storage/async-storage";
import AppListService from "./app-list.service";
import VpnService from "./vpn.service";

const KEY_ALLOWLIST_MODE = "@netoff_allowlist_mode";
const KEY_ALLOWLIST_PACKAGES = "@netoff_allowlist_packages";

export interface AllowlistState {
  enabled: boolean;
  packages: string[]; // packages AUTORISÉS (tous les autres sont bloqués)
}

/**
 * MODE ALLOWLIST (liste blanche) — l'inverse du mode normal.
 * En mode normal : on bloque explicitement certaines apps.
 * En mode allowlist : TOUT est bloqué SAUF les apps de la liste blanche.
 *
 * Techniquement : on génère des règles isBlocked=true pour toutes les apps
 * SAUF celles dans la whitelist, puis on syncRules() avec le VPN.
 */
class AllowlistService {
  async getState(): Promise<AllowlistState> {
    const [enabled, pkgsRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_ALLOWLIST_MODE),
      AsyncStorage.getItem(KEY_ALLOWLIST_PACKAGES),
    ]);
    return {
      enabled: enabled === "true",
      packages: pkgsRaw ? JSON.parse(pkgsRaw) : [],
    };
  }

  async enable(allowedPackages: string[]): Promise<void> {
    await AsyncStorage.setItem(KEY_ALLOWLIST_MODE, "true");
    await AsyncStorage.setItem(
      KEY_ALLOWLIST_PACKAGES,
      JSON.stringify(allowedPackages),
    );
    await this.applyAllowlist(allowedPackages);
  }

  async disable(): Promise<void> {
    await AsyncStorage.setItem(KEY_ALLOWLIST_MODE, "false");
    // Restaurer les règles normales depuis StorageService
    await VpnService.syncRules();
  }

  async updateAllowedPackages(packages: string[]): Promise<void> {
    const state = await this.getState();
    if (!state.enabled) return;
    await AsyncStorage.setItem(
      KEY_ALLOWLIST_PACKAGES,
      JSON.stringify(packages),
    );
    await this.applyAllowlist(packages);
  }

  async addToAllowlist(packageName: string): Promise<void> {
    const state = await this.getState();
    if (!state.packages.includes(packageName)) {
      await this.updateAllowedPackages([...state.packages, packageName]);
    }
  }

  async removeFromAllowlist(packageName: string): Promise<void> {
    const state = await this.getState();
    await this.updateAllowedPackages(
      state.packages.filter((p) => p !== packageName),
    );
  }

  /** Génère et applique les règles de blocage pour toutes les apps sauf la whitelist */
  private async applyAllowlist(allowedPackages: string[]): Promise<void> {
    const allowed = new Set(allowedPackages);
    const allApps = await AppListService.getNonSystemApps();

    // Créer une règle blocked=true pour chaque app non-autorisée
    const rulesToBlock = allApps
      .filter((app) => !allowed.has(app.packageName))
      .map((app) => app.packageName);

    // Passer directement les packages bloqués au module VPN
    const { NativeModules } = require("react-native");
    if (NativeModules.VpnModule) {
      await NativeModules.VpnModule.setBlockedApps(rulesToBlock);
    }
  }
}

export default new AllowlistService();
