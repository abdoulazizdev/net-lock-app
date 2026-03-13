import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AppRule, AppStats, AuthConfig, Profile } from "../types";

const STORAGE_KEYS = {
  RULES: "@app_rules",
  PROFILES: "@profiles",
  STATS: "@app_stats",
  AUTH_CONFIG: "@auth_config",
  ACTIVE_PROFILE: "@active_profile",
};

class StorageService {
  // ============= RÈGLES =============

  async getRules(): Promise<AppRule[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RULES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveRule(rule: AppRule): Promise<void> {
    const rules = await this.getRules();
    const index = rules.findIndex((r) => r.packageName === rule.packageName);
    if (index >= 0) rules[index] = { ...rule, updatedAt: new Date() };
    else rules.push({ ...rule, createdAt: new Date(), updatedAt: new Date() });
    await AsyncStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
  }

  async deleteRule(packageName: string): Promise<void> {
    const rules = await this.getRules();
    await AsyncStorage.setItem(
      STORAGE_KEYS.RULES,
      JSON.stringify(rules.filter((r) => r.packageName !== packageName)),
    );
  }

  async getRuleByPackage(packageName: string): Promise<AppRule | null> {
    const rules = await this.getRules();
    return rules.find((r) => r.packageName === packageName) || null;
  }

  async clearRules(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.RULES);
  }

  // ============= PROFILS =============

  async getProfiles(): Promise<Profile[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveProfile(profile: Profile): Promise<void> {
    const profiles = await this.getProfiles();
    const index = profiles.findIndex((p) => p.id === profile.id);
    if (index >= 0) profiles[index] = profile;
    else profiles.push(profile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  async deleteProfile(profileId: string): Promise<void> {
    const profiles = await this.getProfiles();
    await AsyncStorage.setItem(
      STORAGE_KEYS.PROFILES,
      JSON.stringify(profiles.filter((p) => p.id !== profileId)),
    );
  }

  async getActiveProfile(): Promise<Profile | null> {
    try {
      const profileId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
      if (!profileId) return null;
      const profiles = await this.getProfiles();
      return profiles.find((p) => p.id === profileId) || null;
    } catch {
      return null;
    }
  }

  async setActiveProfile(profileId: string | null): Promise<void> {
    if (profileId) {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
      const profiles = await this.getProfiles();
      const profile = profiles.find((p) => p.id === profileId);
      if (profile) for (const rule of profile.rules) await this.saveRule(rule);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
    }
  }

  async clearProfiles(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PROFILES,
      STORAGE_KEYS.ACTIVE_PROFILE,
    ]);
  }

  // ============= STATISTIQUES =============

  async getStats(): Promise<AppStats[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async incrementStat(
    packageName: string,
    type: "blocked" | "allowed",
  ): Promise<void> {
    const stats = await this.getStats();
    let stat = stats.find((s) => s.packageName === packageName);
    if (!stat) {
      stat = { packageName, blockedAttempts: 0, allowedAttempts: 0 };
      stats.push(stat);
    }
    if (type === "blocked") stat.blockedAttempts++;
    else stat.allowedAttempts++;
    stat.lastAttempt = new Date();
    await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  async clearStats(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.STATS);
  }

  // ============= AUTHENTIFICATION =============

  async getAuthConfig(): Promise<AuthConfig> {
    try {
      const pin = await SecureStore.getItemAsync("user_pin");
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_CONFIG);
      const config = data ? JSON.parse(data) : {};
      return {
        isPinEnabled: !!pin,
        isBiometricEnabled: config.isBiometricEnabled || false,
        pin: pin || undefined,
      };
    } catch {
      return { isPinEnabled: false, isBiometricEnabled: false };
    }
  }

  async savePin(pin: string): Promise<void> {
    await SecureStore.setItemAsync("user_pin", pin);
    await this.updateAuthConfig({ isPinEnabled: true });
  }

  // ✅ NOUVEAU — désactive complètement le verrouillage PIN
  async disablePin(): Promise<void> {
    await SecureStore.deleteItemAsync("user_pin");
    await this.updateAuthConfig({
      isPinEnabled: false,
      isBiometricEnabled: false,
    });
  }

  async verifyPin(pin: string): Promise<boolean> {
    try {
      const storedPin = await SecureStore.getItemAsync("user_pin");
      return storedPin === pin;
    } catch {
      return false;
    }
  }

  async updateAuthConfig(partial: Partial<AuthConfig>): Promise<void> {
    const current = await this.getAuthConfig();
    const updated = { ...current, ...partial };
    await AsyncStorage.setItem(
      STORAGE_KEYS.AUTH_CONFIG,
      JSON.stringify(updated),
    );
  }

  // ============= EXPORT / IMPORT =============

  async exportData(): Promise<string> {
    const rules = await this.getRules();
    const profiles = await this.getProfiles();
    const stats = await this.getStats();
    return JSON.stringify(
      {
        rules,
        profiles,
        stats,
        exportDate: new Date().toISOString(),
        version: "1.0",
      },
      null,
      2,
    );
  }

  async importData(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);
    if (
      !data ||
      typeof data !== "object" ||
      (!data.rules && !data.profiles && !data.stats)
    )
      throw new Error("Format JSON invalide");
    if (data.rules && Array.isArray(data.rules))
      await AsyncStorage.setItem(
        STORAGE_KEYS.RULES,
        JSON.stringify(data.rules),
      );
    if (data.profiles && Array.isArray(data.profiles))
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROFILES,
        JSON.stringify(data.profiles),
      );
    if (data.stats && Array.isArray(data.stats))
      await AsyncStorage.setItem(
        STORAGE_KEYS.STATS,
        JSON.stringify(data.stats),
      );
  }
}

export default new StorageService();
