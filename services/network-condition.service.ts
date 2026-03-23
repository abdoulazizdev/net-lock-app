import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import StorageService from "./storage.service";

const { NetworkConditionModule } = NativeModules;

export type ConnectionType =
  | "wifi"
  | "mobile"
  | "ethernet"
  | "none"
  | "unknown";
export type NetworkCondition = "always" | "wifi_only" | "mobile_only";

const KEY_NETWORK_RULES = "@netoff_network_rules";

interface NetworkRule {
  packageName: string;
  condition: NetworkCondition;
}

class NetworkConditionService {
  async getConnectionType(): Promise<ConnectionType> {
    try {
      if (!NetworkConditionModule) return "unknown";
      return await NetworkConditionModule.getConnectionType();
    } catch {
      return "unknown";
    }
  }

  async isOnWifi(): Promise<boolean> {
    return (await this.getConnectionType()) === "wifi";
  }

  async isOnMobileData(): Promise<boolean> {
    return (await this.getConnectionType()) === "mobile";
  }

  // ── Règles réseau par app ──────────────────────────────────────────────────
  async getNetworkRules(): Promise<NetworkRule[]> {
    const raw = await AsyncStorage.getItem(KEY_NETWORK_RULES);
    return raw ? JSON.parse(raw) : [];
  }

  async setNetworkRule(
    packageName: string,
    condition: NetworkCondition,
  ): Promise<void> {
    const rules = await this.getNetworkRules();
    const idx = rules.findIndex((r) => r.packageName === packageName);
    if (idx >= 0) rules[idx] = { packageName, condition };
    else rules.push({ packageName, condition });
    await AsyncStorage.setItem(KEY_NETWORK_RULES, JSON.stringify(rules));
    // Réappliquer les règles VPN selon la connexion actuelle
    await this.applyConditionalRules();
  }

  async removeNetworkRule(packageName: string): Promise<void> {
    const rules = (await this.getNetworkRules()).filter(
      (r) => r.packageName !== packageName,
    );
    await AsyncStorage.setItem(KEY_NETWORK_RULES, JSON.stringify(rules));
  }

  async getNetworkRule(packageName: string): Promise<NetworkCondition> {
    const rules = await this.getNetworkRules();
    return (
      rules.find((r) => r.packageName === packageName)?.condition ?? "always"
    );
  }

  /**
   * Réevalue et applique les règles selon la connexion actuelle.
   * À appeler quand la connexion change (AppState "active").
   */
  async applyConditionalRules(): Promise<void> {
    try {
      const connType = await this.getConnectionType();
      const networkRules = await this.getNetworkRules();
      const baseRules = await StorageService.getRules();

      if (networkRules.length === 0) return; // Rien à conditionner

      // Calculer les règles effectives
      const effectiveBlocked = new Set(
        baseRules.filter((r) => r.isBlocked).map((r) => r.packageName),
      );

      for (const nr of networkRules) {
        const shouldBlock = this.shouldBlockForConnection(
          nr.condition,
          connType,
        );
        if (shouldBlock) effectiveBlocked.add(nr.packageName);
        else effectiveBlocked.delete(nr.packageName);
      }

      const { NativeModules } = require("react-native");
      if (NativeModules.VpnModule) {
        await NativeModules.VpnModule.setBlockedApps([...effectiveBlocked]);
      }
    } catch (e) {
      console.warn("applyConditionalRules:", e);
    }
  }

  private shouldBlockForConnection(
    condition: NetworkCondition,
    connType: ConnectionType,
  ): boolean {
    switch (condition) {
      case "always":
        return true;
      case "wifi_only":
        return connType === "wifi";
      case "mobile_only":
        return connType === "mobile";
      default:
        return true;
    }
  }

  labelForCondition(condition: NetworkCondition): string {
    switch (condition) {
      case "always":
        return "Toujours bloquer";
      case "wifi_only":
        return "Sur Wi-Fi uniquement";
      case "mobile_only":
        return "Sur données mobiles uniquement";
    }
  }

  iconForCondition(condition: NetworkCondition): string {
    switch (condition) {
      case "always":
        return "🚫";
      case "wifi_only":
        return "📶";
      case "mobile_only":
        return "📡";
    }
  }
}

export default new NetworkConditionService();
