/**
 * vpn.service.ts
 *
 * CORRECTIONS :
 *
 * BUG #2 FIX — Race condition setBlockedApps vs startVpn :
 *   _doStartVpn() appelle setBlockedApps AVANT startVpn.
 *   Les règles sont persistées dans les prefs AVANT que le service démarre.
 *   Le service lit les prefs dans loadRulesFromPrefs() → règles correctes dès le début.
 *
 * BUG #4 FIX — syncRules après startVpn race condition :
 *   On ne fait plus syncRules après startVpn. Le service lit directement
 *   les prefs. Pas de race condition possible.
 */
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";
import AppEvents from "./app-events";
import StorageService from "./storage.service";

const { VpnModule } = NativeModules;

class VpnService {
  private _isActive = false;
  private _isNative = !!VpnModule;

  constructor() {
    DeviceEventEmitter.addListener("vpn:permission", (result: string) => {
      if (result === "granted") {
        this._doStartVpn();
      } else {
        this._isActive = false;
        AppEvents.emit("vpn:changed", false);
      }
    });
  }

  async prepareVpn(): Promise<"granted" | "needs_permission" | "denied"> {
    if (Platform.OS !== "android" || !VpnModule) return "granted";
    try {
      return (await VpnModule.prepareVpn()) as
        | "granted"
        | "needs_permission"
        | "denied";
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

  async startVpn(): Promise<boolean> {
    if (Platform.OS !== "android") {
      this._isActive = true;
      AppEvents.emit("vpn:changed", true);
      return true;
    }
    try {
      const perm = await this.prepareVpn();
      if (perm === "granted") return await this._doStartVpn();
      // "needs_permission" → DeviceEventEmitter déclenchera _doStartVpn après accord
      return true;
    } catch (e) {
      console.warn("VpnService.startVpn:", e);
      return false;
    }
  }

  /**
   * Lance effectivement le service VPN.
   *
   * ORDRE CRITIQUE :
   *   1. setBlockedApps() → persiste les règles dans les prefs
   *   2. VpnModule.startVpn() → le service lit les prefs et applique les règles
   *
   * Sans cet ordre, le service démarre avec des règles vides (BUG #2).
   */
  async _doStartVpn(): Promise<boolean> {
    try {
      // 1. Persister les règles en premier
      const pkgs = await this._getBlockedPackages();
      if (VpnModule) await VpnModule.setBlockedApps(pkgs);

      // 2. Démarrer le service (qui lira les règles depuis les prefs)
      if (VpnModule) await VpnModule.startVpn();

      this._isActive = true;
      this._isNative = true;
      AppEvents.emit("vpn:changed", true);
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

  async setRule(packageName: string, isBlocked: boolean): Promise<void> {
    const cleanPkg = packageName.split("@")[0].trim();
    await StorageService.saveRule({
      packageName: cleanPkg,
      isBlocked,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Mettre à jour les règles dans le service natif
    // setBlockedApps persiste dans les prefs ET envoie UPDATE_RULES si VPN actif
    try {
      const pkgs = await this._getBlockedPackages();
      if (VpnModule) await VpnModule.setBlockedApps(pkgs);
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
    return rules.find((r) => r.packageName === packageName)?.isBlocked
      ? "blocked"
      : "allowed";
  }

  private async _getBlockedPackages(): Promise<string[]> {
    const rules = await StorageService.getRules();
    return rules
      .filter((r) => r.isBlocked)
      .map((r) => r.packageName.split("@")[0].trim());
  }
}

export default new VpnService();
