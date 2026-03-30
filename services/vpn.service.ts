/**
 * vpn.service.ts
 *
 * FLUX PERMISSION VPN ANDROID :
 *   1. startVpn() → prepareVpn()
 *   2a. "granted"          → _doStartVpn() immédiatement
 *   2b. "needs_permission" → dialog Android ouvert
 *       → onActivityResult → Kotlin émet "vpn:permission" via RCTDeviceEventEmitter
 *       → DeviceEventEmitter reçoit l'event → _doStartVpn()
 *
 * IMPORTANT : utiliser DeviceEventEmitter (pas NativeEventEmitter) pour recevoir
 * les events émis par getJSModule(RCTDeviceEventEmitter::class.java) côté Kotlin.
 */
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";
import AppEvents from "./app-events";
import StorageService from "./storage.service";

const { VpnModule } = NativeModules;

class VpnService {
  private _isActive = false;
  private _isNative = !!VpnModule;

  constructor() {
    // DeviceEventEmitter reçoit les events émis par RCTDeviceEventEmitter côté Kotlin.
    // Doit être enregistré une seule fois au démarrage du service (singleton).
    DeviceEventEmitter.addListener("vpn:permission", (result: string) => {
      if (result === "granted") {
        // L'utilisateur a accordé la permission dans le dialog Android
        // → démarrer le VPN maintenant
        this._doStartVpn();
      } else {
        // Refusé
        this._isActive = false;
        AppEvents.emit("vpn:changed", false);
      }
    });
  }

  // ── Permission ─────────────────────────────────────────────────────────────

  /**
   * Vérifie / demande la permission VPN Android.
   * Retourne :
   *   "granted"          → permission déjà accordée
   *   "needs_permission" → dialog ouvert, attendre DeviceEventEmitter "vpn:permission"
   *   "denied"           → erreur
   */
  async prepareVpn(): Promise<"granted" | "needs_permission" | "denied"> {
    if (Platform.OS !== "android" || !VpnModule) return "granted";
    try {
      const result = await VpnModule.prepareVpn();
      return result as "granted" | "needs_permission" | "denied";
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
   *  - Déjà accordée → démarre immédiatement, émet vpn:changed
   *  - Pas encore     → ouvre le dialog → après accord → démarre + émet vpn:changed
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
      }
      // "needs_permission" : dialog ouvert, DeviceEventEmitter s'en occupe
      return true;
    } catch (e) {
      console.warn("VpnService.startVpn:", e);
      return false;
    }
  }

  /** Lance effectivement le service VPN natif */
  async _doStartVpn(): Promise<boolean> {
    try {
      if (VpnModule) await VpnModule.startVpn();
      this._isActive = true;
      this._isNative = true;
      AppEvents.emit("vpn:changed", true);
      // Synchroniser les règles bloquées avec le service
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

  /** Interroge l'état réel du service natif */
  async isVpnActive(): Promise<boolean> {
    try {
      if (VpnModule) this._isActive = await VpnModule.isVpnActive();
      return this._isActive;
    } catch {
      return this._isActive;
    }
  }

  getStatus() {
    return { isActive: this._isActive, isNative: this._isNative };
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
