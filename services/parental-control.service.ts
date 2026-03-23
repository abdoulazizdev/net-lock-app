import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import StorageService from "./storage.service";

const KEY_PARENTAL_ENABLED = "@netoff_parental_enabled";
const KEY_PARENTAL_PIN = "netoff_parental_pin";
const KEY_PARENTAL_PROFILE = "@netoff_parental_profile";
const KEY_PARENTAL_SETTINGS = "@netoff_parental_settings";

export interface ParentalSettings {
  enabled: boolean;
  profileId: string | null; // profil appliqué aux enfants
  maxDailyMinutes: number; // 0 = illimité
  allowedApps: string[]; // apps toujours autorisées même en mode enfant
  blockAtBedtime: boolean; // bloquer après l'heure du coucher
  bedtimeHour: number;
  wakeHour: number;
}

class ParentalControlService {
  async getSettings(): Promise<ParentalSettings> {
    const raw = await AsyncStorage.getItem(KEY_PARENTAL_SETTINGS);
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

  async saveSettings(settings: ParentalSettings): Promise<void> {
    await AsyncStorage.setItem(KEY_PARENTAL_SETTINGS, JSON.stringify(settings));
  }

  // ── PIN parent ─────────────────────────────────────────────────────────────
  async setParentalPin(pin: string): Promise<void> {
    if (pin.length < 4)
      throw new Error("Le PIN doit contenir au moins 4 chiffres.");
    await SecureStore.setItemAsync(KEY_PARENTAL_PIN, pin);
    await AsyncStorage.setItem(KEY_PARENTAL_ENABLED, "true");
  }

  async verifyParentalPin(pin: string): Promise<boolean> {
    const stored = await SecureStore.getItemAsync(KEY_PARENTAL_PIN);
    return stored === pin;
  }

  async isParentalEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(KEY_PARENTAL_ENABLED)) === "true";
  }

  async disableParental(pin: string): Promise<void> {
    const ok = await this.verifyParentalPin(pin);
    if (!ok) throw new Error("PIN incorrect.");
    await AsyncStorage.setItem(KEY_PARENTAL_ENABLED, "false");
    await SecureStore.deleteItemAsync(KEY_PARENTAL_PIN);
  }

  async hasPin(): Promise<boolean> {
    const pin = await SecureStore.getItemAsync(KEY_PARENTAL_PIN);
    return !!pin;
  }

  // ── Vérifier si on est en heure de coucher ────────────────────────────────
  async isBedtime(): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings.blockAtBedtime) return false;
    const hour = new Date().getHours();
    return hour >= settings.bedtimeHour || hour < settings.wakeHour;
  }

  // ── Rapport journalier ────────────────────────────────────────────────────
  async getDailyReport(): Promise<{
    blockedCount: number;
    topApp: string | null;
  }> {
    try {
      const stats = await StorageService.getStats();
      const today = new Date().toDateString();
      // Filtrer les stats d'aujourd'hui (simplifié)
      const total = stats.reduce((sum, s) => sum + s.blockedAttempts, 0);
      const top = stats.sort(
        (a, b) => b.blockedAttempts - a.blockedAttempts,
      )[0];
      return { blockedCount: total, topApp: top?.packageName ?? null };
    } catch {
      return { blockedCount: 0, topApp: null };
    }
  }
}

export default new ParentalControlService();
