/**
 * allowlist.service.ts
 *
 * MODE ALLOWLIST = liste blanche = "tout bloquer sauf ces apps"
 *
 * Implémentation au niveau VPN :
 *   Mode normal (blocklist) : addAllowedApplication(blockedApp)
 *     → apps bloquées entrent dans le tunnel → drainées
 *     → EMUI peut bypasser via ses propres chemins réseau ← PROBLÈME HUAWEI
 *
 *   Mode allowlist : addDisallowedApplication(allowedApp)
 *     → TOUT entre dans le tunnel par défaut → drainé
 *     → apps autorisées sont explicitement exclues du tunnel
 *     → EMUI ne peut pas bypasser car il n'y a pas de chemin alternatif
 *       à exploiter — c'est le comportement par défaut du VPN Android
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import VpnService from "./vpn.service";

const { VpnModule } = NativeModules;

const KEY_MODE = "@netoff_allowlist_mode";
const KEY_PACKAGES = "@netoff_allowlist_packages";

export interface AllowlistState {
  enabled: boolean;
  packages: string[]; // packages autorisés (internet ok)
}

class AllowlistService {
  async getState(): Promise<AllowlistState> {
    const [mode, pkgsRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_MODE),
      AsyncStorage.getItem(KEY_PACKAGES),
    ]);
    return {
      enabled: mode === "true",
      packages: pkgsRaw ? JSON.parse(pkgsRaw) : [],
    };
  }

  /**
   * Active le mode liste blanche.
   * Utilise VpnModule.setAllowlistMode() → addDisallowedApplication dans le service.
   * Plus robuste sur Huawei/EMUI que le mode blocklist.
   */
  async enable(allowedPackages: string[]): Promise<void> {
    await AsyncStorage.multiSet([
      [KEY_MODE, "true"],
      [KEY_PACKAGES, JSON.stringify(allowedPackages)],
    ]);
    await this._applyAllowlist(allowedPackages);
  }

  /**
   * Désactive le mode liste blanche.
   * Revient au mode blocklist normal (règles StorageService).
   */
  async disable(): Promise<void> {
    await AsyncStorage.multiSet([
      [KEY_MODE, "false"],
      [KEY_PACKAGES, "[]"],
    ]);
    // Désactiver au niveau VPN et revenir aux règles normales
    if (VpnModule?.disableAllowlistMode) {
      await VpnModule.disableAllowlistMode();
    }
    await VpnService.syncRules();
  }

  /** Met à jour la liste blanche (mode déjà actif). */
  async updateAllowedPackages(packages: string[]): Promise<void> {
    const state = await this.getState();
    if (!state.enabled) return;
    await AsyncStorage.setItem(KEY_PACKAGES, JSON.stringify(packages));
    await this._applyAllowlist(packages);
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

  /**
   * Applique le mode allowlist au niveau VPN natif.
   * Utilise setAllowlistMode() → addDisallowedApplication() dans NetLockVpnService.
   * Ce mode route TOUT dans le tunnel sauf les apps autorisées.
   */
  private async _applyAllowlist(allowedPackages: string[]): Promise<void> {
    if (VpnModule?.setAllowlistMode) {
      // Passer directement au module natif — il gère le tunnel en mode ALLOWLIST
      await VpnModule.setAllowlistMode(allowedPackages);
    } else {
      // Fallback si module non disponible : mode blocklist avec toutes les apps
      console.warn(
        "AllowlistService: VpnModule.setAllowlistMode non disponible — fallback blocklist",
      );
      const { default: AppListService } = await import("./app-list.service");
      const allApps = await AppListService.getNonSystemApps();
      const allowed = new Set(allowedPackages);
      const toBlock = allApps
        .filter((app) => !allowed.has(app.packageName))
        .map((app) => app.packageName);
      await VpnModule.setBlockedApps(toBlock);
    }
  }
}

export default new AllowlistService();

// ─── Note iOS ─────────────────────────────────────────────────────────────────
// Cette implémentation est 100% Android.
// iOS n'expose pas d'API permettant à une app tierce de bloquer le trafic
// d'autres apps sans entitlements spéciaux Apple (MDM/enterprise uniquement).
// → NetOff ne peut pas fonctionner sur iOS.
