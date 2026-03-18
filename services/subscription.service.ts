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
  FOCUS_PRESETS_FREE: [25] as number[],
  STATS_TABS_FREE: ["overview"] as string[],
  EXPORT_IMPORT: false,
  PIN_AUTH: false,
  BIOMETRIC_AUTH: false,
};

const VALID_PROMO_CODES: Record<string, string | null> = {
  "NETOFF-PRO-2025": null,
  "BETA-TESTER": null,
  "ABDOULAZIZ-DEV": null,
};

class SubscriptionService {
  private _cache: SubscriptionState | null = null;
  private _sdkConfigured = false;

  // ── Init RevenueCat SDK ───────────────────────────────────────────────────────
  async configure(userId?: string): Promise<void> {
    if (this._sdkConfigured) return;

    try {
      // En développement, activer les logs pour débugger
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      const apiKey =
        Platform.OS === "android"
          ? REVENUECAT_CONFIG.ANDROID_API_KEY
          : REVENUECAT_CONFIG.IOS_API_KEY;

      // ✅ Vérification basique avant d'appeler SDK
      if (!apiKey || apiKey.includes("xxxxxxx")) {
        console.warn("[RevenueCat] Clé API non configurée — SDK désactivé");
        return;
      }

      await Purchases.configure({
        apiKey,
        appUserID: userId ?? null, // null = ID anonyme généré par RevenueCat
      });

      this._sdkConfigured = true;
      console.log("[RevenueCat] SDK configuré avec succès");
    } catch (e) {
      console.error("[RevenueCat] Erreur configuration:", e);
    }
  }

  // ── Vérifier le statut premium via RevenueCat ─────────────────────────────────
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

  async activateWithCode(
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    const normalized = code.trim().toUpperCase();

    if (!(normalized in VALID_PROMO_CODES)) {
      return { success: false, error: "Code invalide ou inexistant." };
    }

    const expiry = VALID_PROMO_CODES[normalized];
    if (expiry && new Date(expiry) < new Date()) {
      return { success: false, error: "Ce code a expiré." };
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
      expiresAt: expiry ?? undefined,
      source: "promo_code",
      promoCode: normalized,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    this._cache = state;
    return { success: true };
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

  // ── Achat via RevenueCat ──────────────────────────────────────────────────────
  async purchase(
    packageIdentifier: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this._sdkConfigured) {
      return { success: false, error: "SDK non configuré." };
    }
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        (p) => p.identifier === packageIdentifier,
      );
      if (!pkg) return { success: false, error: "Offre introuvable." };

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPremium =
        Object.keys(customerInfo.entitlements.active).length > 0;

      if (isPremium) {
        const entitlement = Object.values(customerInfo.entitlements.active)[0];
        await this.activateFromPurchase(
          entitlement?.expirationDate ?? undefined,
        );
        return { success: true };
      }
      return { success: false, error: "Achat non confirmé." };
    } catch (e: any) {
      if (e?.userCancelled) return { success: false, error: "Annulé." };
      return { success: false, error: e?.message ?? "Erreur inconnue." };
    }
  }

  // ── Restauration ──────────────────────────────────────────────────────────────
  async restore(): Promise<{ success: boolean; error?: string }> {
    if (!this._sdkConfigured) {
      return { success: false, error: "SDK non configuré." };
    }
    try {
      const info = await Purchases.restorePurchases();
      const isPremium = Object.keys(info.entitlements.active).length > 0;
      if (isPremium) {
        const entitlement = Object.values(info.entitlements.active)[0];
        await this.activateFromRestore(
          entitlement?.expirationDate ?? undefined,
        );
        return { success: true };
      }
      return { success: false, error: "Aucun achat à restaurer." };
    } catch (e: any) {
      return { success: false, error: e?.message ?? "Erreur de restauration." };
    }
  }

  async activate(): Promise<void> {
    await this.activateFromPurchase();
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
