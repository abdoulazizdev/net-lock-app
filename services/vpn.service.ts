import { NativeModules } from "react-native";
import AppEvents from "./app-events";
import StorageService from "./storage.service";

const { VpnModule } = NativeModules;

class VpnService {
  private _isActive = false;
  private _isNative = false;
  private _platform = "";

  async startVpn(): Promise<boolean> {
    try {
      if (VpnModule) {
        await VpnModule.startVpn();
        this._isActive = true;
        this._isNative = true;
      } else {
        this._isActive = true;
        this._isNative = false;
      }
      AppEvents.emit("vpn:changed", true);
      return true;
    } catch (e) {
      console.warn("VpnService.startVpn:", e);
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
    return {
      isActive: this._isActive,
      isNative: this._isNative,
      platform: this._platform,
    };
  }

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
