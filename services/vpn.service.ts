/**
 * vpn.service.ts
 *
 * FLUX CORRECT pour démarrer le VPN Android :
 *
 *   1. prepareVpn()      → vérifie la permission Android
 *      → "granted"          : permission déjà ok, appeler startVpn() directement
 *      → "needs_permission" : dialog système lancé, attendre l'event "vpn:permission"
 *
 *   2. Event "vpn:permission" = "granted" → appeler startVpn()
 *      Event "vpn:permission" = "denied"  → permission refusée, UI à mettre à jour
 *
 *   3. startVpn() → service natif démarre → establish() retourne un vrai fd → VPN actif
 *
 * Sans VpnService.prepare(), establish() retourne null et le service s'arrête seul.
 */
import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import AppEvents from "./app-events";
import StorageService from "./storage.service";

const { VpnModule } = NativeModules;

// NativeEventEmitter pour recevoir les events Kotlin → JS
const vpnEmitter = VpnModule ? new NativeEventEmitter(VpnModule) : null;

export type VpnPermissionResult = "granted" | "denied" | "needs_permission";

class VpnService {
  private _isActive = false;
  private _isNative = !!VpnModule;

  constructor() {
    // Écouter le résultat de la permission système (Dialog Android)
    vpnEmitter?.addListener("vpn:permission", (result: string) => {
      if (result === "granted") {
        // L'utilisateur a accordé la permission → démarrer le VPN
        this._doStartVpn();
      } else {
        // Refusé → s'assurer que l'état JS est cohérent
        this._isActive = false;
        AppEvents.emit("vpn:changed", false);
      }
    });
  }

  // ── Permission ─────────────────────────────────────────────────────────────

  /**
   * Vérifie / demande la permission VPN Android.
   * À appeler AVANT startVpn().
   *
   * Retourne :
   *  "granted"          → permission déjà accordée, appeler startVpn() directement
   *  "needs_permission" → dialog ouvert, attendre l'event "vpn:permission"
   *  "denied"           → erreur ou module absent
   */
  async prepareVpn(): Promise<VpnPermissionResult> {
    if (Platform.OS !== "android" || !VpnModule) return "granted";
    try {
      const result = await VpnModule.prepareVpn();
      return result as VpnPermissionResult;
    } catch (e) {
      console.warn("VpnService.prepareVpn:", e);
      return "denied";
    }
  }

  async isVpnPermissionGranted(): Promise<boolean> {
    if (Platform.OS !== "android" || !VpnModule) return true;
    try {
      return await VpnModule.isVpnPermissionGranted();
    } catch {
      return false;
    }
  }

  // ── Démarrage / Arrêt ──────────────────────────────────────────────────────

  /**
   * Démarre le VPN.
   * Gère automatiquement la permission :
   *  - Si déjà accordée → démarre immédiatement
   *  - Si pas encore accordée → ouvre le dialog, démarre après acceptation
   *
   * Retourne true si le démarrage est initié (pas forcément terminé si dialog).
   */
  async startVpn(): Promise<boolean> {
    if (Platform.OS !== "android") {
      this._isActive = true;
      AppEvents.emit("vpn:changed", true);
      return true;
    }

    try {
      const permResult = await this.prepareVpn();
      if (permResult === "granted") {
        return await this._doStartVpn();
      } else if (permResult === "needs_permission") {
        // Le dialog est ouvert, on attend l'event "vpn:permission"
        // L'état JS sera mis à jour dans le constructor listener
        return true; // initié mais en attente
      } else {
        return false;
      }
    } catch (e) {
      console.warn("VpnService.startVpn:", e);
      return false;
    }
  }

  /** Démarre effectivement le service après que la permission est accordée */
  private async _doStartVpn(): Promise<boolean> {
    try {
      if (VpnModule) {
        await VpnModule.startVpn();
        this._isNative = true;
      }
      this._isActive = true;
      AppEvents.emit("vpn:changed", true);
      // Synchroniser les règles avec le service natif
      await this.syncRules();
      return true;
    } catch (e) {
      console.warn("VpnService._doStartVpn:", e);
      this._isActive = false;
      AppEvents.emit("vpn:changed", false);
      return false;
    }
  }

  async stopVpn(): Promise<void> {
    try {
      if (VpnModule) await VpnModule.stopVpn();
      this._isActive = false;
      AppEvents.emit("vpn:changed", false);
    } catch (e) {
      console.warn("VpnService.stopVpn:", e);
    }
  }

  // ── État ───────────────────────────────────────────────────────────────────

  /**
   * Interroge le service natif pour l'état réel.
   * À utiliser au chargement d'un écran (pas en temps réel).
   */
  async isVpnActive(): Promise<boolean> {
    try {
      if (VpnModule) {
        this._isActive = await VpnModule.isVpnActive();
      }
      return this._isActive;
    } catch {
      return this._isActive;
    }
  }

  getStatus() {
    return {
      isActive: this._isActive,
      isNative: this._isNative,
    };
  }

  // ── Règles ─────────────────────────────────────────────────────────────────

  async setRule(packageName: string, isBlocked: boolean): Promise<void> {
    const cleanPkg = packageName.split("@")[0].trim();
    await StorageService.saveRule({
      packageName: cleanPkg,
      isBlocked,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    try {
      if (VpnModule)
        await VpnModule.setBlockedApps(await this._getBlockedPackages());
    } catch (e) {
      console.warn("VpnService.setRule:", e);
    }
    AppEvents.emit("rules:changed", undefined);
  }

  async syncRules(): Promise<void> {
    try {
      const pkgs = await this._getBlockedPackages();
      if (VpnModule) await VpnModule.setBlockedApps(pkgs);
      AppEvents.emit("rules:changed", undefined);
    } catch (e) {
      console.warn("VpnService.syncRules:", e);
    }
  }

  async canBlockPackage(
    packageName: string,
  ): Promise<{ canBlock: boolean; reason?: string }> {
    try {
      if (VpnModule) return await VpnModule.canBlockPackage(packageName);
      return { canBlock: true };
    } catch {
      return { canBlock: true };
    }
  }

  async simulateConnectionAttempt(
    packageName: string,
  ): Promise<"blocked" | "allowed"> {
    const rules = await StorageService.getRules();
    const rule = rules.find((r) => r.packageName === packageName);
    return rule?.isBlocked ? "blocked" : "allowed";
  }

  private async _getBlockedPackages(): Promise<string[]> {
    const rules = await StorageService.getRules();
    return rules
      .filter((r) => r.isBlocked)
      .map((r) => r.packageName.split("@")[0].trim());
  }
}

export default new VpnService();
