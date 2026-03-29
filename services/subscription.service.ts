// services/subscription.service.ts
import { REVENUECAT_CONFIG } from "@/config/revenuecat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

const KEY = "@netoff_premium";
const CODES_KEY = "@netoff_promo_codes_used";

export interface SubscriptionState {
  isPremium: boolean;
  activatedAt?: string;
  expiresAt?: string;
  source?: "purchase" | "promo_code" | "restore";
  promoCode?: string;
}

export const FREE_LIMITS = {
  MAX_BLOCKED_APPS: 3,
  MAX_PROFILES: 1,
  MAX_SCHEDULES: 1,
  FOCUS_PRESETS_FREE: [25, 45] as number[],
  TIMER_PRESETS_FREE: [5, 15, 30] as number[],
  STATS_TABS_FREE: ["overview", "productivity"] as string[],
  EXPORT_IMPORT: false,
  PIN_AUTH: true,
  BIOMETRIC_AUTH: false,
};

interface PromoCodeDef {
  expiresAt: string | null;
  note?: string;
}

const VALID_PROMO_CODES: Record<string, PromoCodeDef> = {
  "ABDOULAZIZ-DEV": { expiresAt: null, note: "Compte développeur — permanent" },
  "BETA-TESTER": { expiresAt: null, note: "Beta testeurs saison 1" },
  "NETOFF-PRO-2025": {
    expiresAt: "2025-12-31T23:59:59.000Z",
    note: "Campagne lancement 2025",
  },
  LAUNCH6M: {
    expiresAt: "2025-07-01T00:00:00.000Z",
    note: "Accès 6 mois post-lancement",
  },
  PARTNER2026: {
    expiresAt: "2026-12-31T23:59:59.000Z",
    note: "Partenaires — expire fin 2026",
  },
};

class SubscriptionService {
  private _cache: SubscriptionState | null = null;
  private _sdkConfigured = false;
  // Garde contre les appels simultanés à configure()
  private _configuring = false;

  // ── Vérifie si la clé API est utilisable ───────────────────────────────────
  private _hasValidApiKey(): boolean {
    const key =
      Platform.OS === "android"
        ? REVENUECAT_CONFIG.ANDROID_API_KEY
        : REVENUECAT_CONFIG.IOS_API_KEY;
    return !!(key && key.length > 10 && !key.includes("xxxxxxx"));
  }

  // ── Init RevenueCat SDK ─────────────────────────────────────────────────────
  async configure(userId?: string): Promise<void> {
    if (this._sdkConfigured || this._configuring) return;
    if (!this._hasValidApiKey()) {
      console.warn(
        "[RevenueCat] Clé API manquante ou invalide — SDK désactivé",
      );
      return;
    }
    this._configuring = true;
    try {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      const apiKey =
        Platform.OS === "android"
          ? REVENUECAT_CONFIG.ANDROID_API_KEY
          : REVENUECAT_CONFIG.IOS_API_KEY;
      await Purchases.configure({ apiKey, appUserID: userId ?? null });
      this._sdkConfigured = true;
      console.log("[RevenueCat] SDK configuré avec succès");
    } catch (e) {
      console.error("[RevenueCat] Erreur configuration:", e);
    } finally {
      this._configuring = false;
    }
  }

  // ── Guard : SDK prêt ? ──────────────────────────────────────────────────────
  isSdkReady(): boolean {
    return this._sdkConfigured;
  }

  // ── Sync avec RevenueCat ────────────────────────────────────────────────────
  async syncWithRevenueCat(): Promise<boolean> {
    if (!this._sdkConfigured) return false;
    try {
      const info = await Purchases.getCustomerInfo();
      const isPremium = Object.keys(info.entitlements.active).length > 0;
      if (isPremium) {
        const entitlement = Object.values(info.entitlements.active)[0];
        await this.activateFromPurchase(
          entitlement?.expirationDate ?? undefined,
        );
      }
      return isPremium;
    } catch (e) {
      console.error("[RevenueCat] Erreur sync:", e);
      return false;
    }
  }

  // ── État local ──────────────────────────────────────────────────────────────
  async getState(): Promise<SubscriptionState> {
    if (this._cache) return this._cache;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      this._cache = raw ? JSON.parse(raw) : { isPremium: false };
    } catch {
      this._cache = { isPremium: false };
    }
    if (this._cache!.isPremium && this._cache!.expiresAt) {
      if (new Date(this._cache!.expiresAt) < new Date()) {
        this._cache = { isPremium: false };
        await AsyncStorage.setItem(KEY, JSON.stringify(this._cache));
      }
    }
    return this._cache!;
  }

  async isPremium(): Promise<boolean> {
    const s = await this.getState();
    return s.isPremium;
  }

  async activateFromPurchase(expiresAt?: string): Promise<void> {
    const state: SubscriptionState = {
      isPremium: true,
      activatedAt: new Date().toISOString(),
      expiresAt,
      source: "purchase",
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    this._cache = state;
  }

  async activateFromRestore(expiresAt?: string): Promise<void> {
    const state: SubscriptionState = {
      isPremium: true,
      activatedAt: new Date().toISOString(),
      expiresAt,
      source: "restore",
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    this._cache = state;
  }

  async purchase(
    packageIdentifier: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this._sdkConfigured) return { success: false, error: "SDK_NOT_READY" };
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        (p: any) => p.identifier === packageIdentifier,
      );
      if (!pkg) return { success: false, error: "NO_OFFERING" };
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPremium =
        Object.keys(customerInfo.entitlements.active).length > 0;
      if (isPremium) {
        const entitlement = Object.values(
          customerInfo.entitlements.active,
        )[0] as any;
        await this.activateFromPurchase(
          entitlement?.expirationDate ?? undefined,
        );
        return { success: true };
      }
      return { success: false, error: "NOT_CONFIRMED" };
    } catch (e: any) {
      if (e?.userCancelled) return { success: false, error: "USER_CANCELLED" };
      console.error("[RC] purchase:", e);
      return { success: false, error: "PURCHASE_FAILED" };
    }
  }

  async restore(): Promise<{ success: boolean; error?: string }> {
    if (!this._sdkConfigured) return { success: false, error: "SDK_NOT_READY" };
    try {
      const info = await Purchases.restorePurchases();
      const isPremium = Object.keys(info.entitlements.active).length > 0;
      if (isPremium) {
        const entitlement = Object.values(info.entitlements.active)[0] as any;
        await this.activateFromRestore(
          entitlement?.expirationDate ?? undefined,
        );
        return { success: true };
      }
      return { success: false, error: "Aucun achat à restaurer." };
    } catch (e: any) {
      console.error("[RC] restore:", e);
      return { success: false, error: "RESTORE_FAILED" };
    }
  }

  async activateWithCode(
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    const normalized = code.trim().toUpperCase();
    const def = VALID_PROMO_CODES[normalized];
    if (!def) return { success: false, error: "Code invalide ou inexistant." };
    if (def.expiresAt && new Date(def.expiresAt) < new Date()) {
      return { success: false, error: "Ce code promotionnel a expiré." };
    }
    try {
      const usedRaw = await AsyncStorage.getItem(CODES_KEY);
      const used: string[] = usedRaw ? JSON.parse(usedRaw) : [];
      if (!used.includes(normalized)) {
        await AsyncStorage.setItem(
          CODES_KEY,
          JSON.stringify([...used, normalized]),
        );
      }
    } catch {}
    const state: SubscriptionState = {
      isPremium: true,
      activatedAt: new Date().toISOString(),
      expiresAt: undefined,
      source: "promo_code",
      promoCode: normalized,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    this._cache = state;
    return { success: true };
  }

  async deactivate(): Promise<void> {
    const state: SubscriptionState = { isPremium: false };
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    this._cache = state;
  }

  invalidateCache() {
    this._cache = null;
  }
}

export default new SubscriptionService();
