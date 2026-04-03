import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import StorageService from "./storage.service";

const KEY_ENABLED = "@netoff_parental_enabled";
const KEY_PIN = "netoff_parental_pin";
const KEY_SETTINGS = "@netoff_parental_settings";

export interface ParentalSettings {
  enabled: boolean;
  profileId: string | null;
  maxDailyMinutes: number;
  allowedApps: string[];
  blockAtBedtime: boolean;
  bedtimeHour: number;
  wakeHour: number;
}

/**
 * Actions protégées par le contrôle parental.
 * Toute action listée ici nécessite la saisie du PIN parent avant exécution.
 */
export type ProtectedAction =
  | "toggle_vpn" // activer/désactiver le VPN
  | "toggle_block_app" // bloquer/débloquer une app
  | "open_settings" // ouvrir les paramètres
  | "change_rules" // modifier les règles depuis profile/app-detail
  | "disable_parental"; // désactiver le contrôle parental lui-même

class ParentalControlService {
  // ── Paramètres ──────────────────────────────────────────────────────────────

  async getSettings(): Promise<ParentalSettings> {
    const raw = await AsyncStorage.getItem(KEY_SETTINGS);
    if (raw) return JSON.parse(raw);
    return {
      enabled: false,
      profileId: null,
      maxDailyMinutes: 120,
      allowedApps: [],
      blockAtBedtime: true,
      bedtimeHour: 21,
      wakeHour: 7,
    };
  }

  async saveSettings(s: ParentalSettings): Promise<void> {
    await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  }

  // ── PIN ──────────────────────────────────────────────────────────────────────

  async setParentalPin(pin: string): Promise<void> {
    if (pin.length < 4) throw new Error("PIN trop court.");
    await SecureStore.setItemAsync(KEY_PIN, pin);
    await AsyncStorage.setItem(KEY_ENABLED, "true");
  }

  async verifyParentalPin(pin: string): Promise<boolean> {
    const stored = await SecureStore.getItemAsync(KEY_PIN);
    return stored === pin;
  }

  async isParentalEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(KEY_ENABLED)) === "true";
  }

  async hasPin(): Promise<boolean> {
    return !!(await SecureStore.getItemAsync(KEY_PIN));
  }

  async disableParental(pin: string): Promise<void> {
    if (!(await this.verifyParentalPin(pin))) throw new Error("PIN incorrect.");
    await AsyncStorage.setItem(KEY_ENABLED, "false");
    await SecureStore.deleteItemAsync(KEY_PIN);
  }

  // ── Garde principal ───────────────────────────────────────────────────────────
  /**
   * Vérifie si une action protégée nécessite le PIN.
   * Retourne true si l'action est libre (parental désactivé).
   * Retourne false si le PIN est requis — l'appelant doit afficher le modal.
   */
  async isActionAllowed(_action: ProtectedAction): Promise<boolean> {
    return !(await this.isParentalEnabled());
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────────

  async isBedtime(): Promise<boolean> {
    const s = await this.getSettings();
    if (!s.blockAtBedtime) return false;
    const h = new Date().getHours();
    return h >= s.bedtimeHour || h < s.wakeHour;
  }

  async getDailyReport(): Promise<{
    blockedCount: number;
    topApp: string | null;
  }> {
    try {
      const stats = await StorageService.getStats();
      const total = stats.reduce((sum, s) => sum + s.blockedAttempts, 0);
      const top = [...stats].sort(
        (a, b) => b.blockedAttempts - a.blockedAttempts,
      )[0];
      return { blockedCount: total, topApp: top?.packageName ?? null };
    } catch {
      return { blockedCount: 0, topApp: null };
    }
  }
}

export default new ParentalControlService();
