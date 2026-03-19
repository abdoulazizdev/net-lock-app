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
  expiresAt?: string; // undefined = à vie
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

// ─── Codes promos ─────────────────────────────────────────────────────────────
// expiresAt: ISO string = expire à cette date | null = à vie
// Pour calculer dynamiquement depuis maintenant, utilisez une fonction helper :
//   addMonths(n)  → maintenant + n mois
//   addYears(n)   → maintenant + n ans
//   null          → permanent (à vie)
//
// La date d'expiration ici est la date jusqu'à laquelle le CODE peut être
// utilisé (pas la durée de l'abonnement résultant — celui-ci est toujours
// "à vie" une fois activé via code promo).

interface PromoCodeDef {
  expiresAt: string | null; // null = code utilisable à vie
  note?: string;
}

const VALID_PROMO_CODES: Record<string, PromoCodeDef> = {
  // Permanent — développeur
  "ABDOULAZIZ-DEV": {
    expiresAt: null,
    note: "Compte développeur — permanent",
  },
  // Permanent — beta testeurs
  "BETA-TESTER": {
    expiresAt: null,
    note: "Beta testeurs saison 1",
  },
  // Campagne 2025 — expire fin 2025
  "NETOFF-PRO-2025": {
    expiresAt: "2025-12-31T23:59:59.000Z",
    note: "Campagne lancement 2025",
  },
  // Exemple : code limité dans le temps (6 mois depuis le 1er jan 2025)
  LAUNCH6M: {
    expiresAt: "2025-07-01T00:00:00.000Z",
    note: "Accès 6 mois post-lancement",
  },
  // Exemple : code partenaire, expire dans 1 an
  PARTNER2026: {
    expiresAt: "2026-12-31T23:59:59.000Z",
    note: "Partenaires — expire fin 2026",
  },
};

// ─── Service ──────────────────────────────────────────────────────────────────
class SubscriptionService {
  private _cache: SubscriptionState | null = null;
  private _sdkConfigured = false;

  // ── Init RevenueCat SDK ─────────────────────────────────────────────────────
  async configure(userId?: string): Promise<void> {
    if (this._sdkConfigured) return;
    try {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      const apiKey =
        Platform.OS === "android"
          ? REVENUECAT_CONFIG.ANDROID_API_KEY
          : REVENUECAT_CONFIG.IOS_API_KEY;

      if (!apiKey || apiKey.includes("xxxxxxx")) {
        console.warn("[RevenueCat] Clé API non configurée — SDK désactivé");
        return;
      }

      await Purchases.configure({ apiKey, appUserID: userId ?? null });
      this._sdkConfigured = true;
      console.log("[RevenueCat] SDK configuré avec succès");
    } catch (e) {
      console.error("[RevenueCat] Erreur configuration:", e);
    }
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
    // Vérifier expiration
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

  // ── Activation depuis un achat vérifié RevenueCat ───────────────────────────
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

  // ── Activation depuis une restauration RevenueCat ───────────────────────────
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

  // ── Achat via RevenueCat (SEUL chemin d'achat réel) ─────────────────────────
  async purchase(
    packageIdentifier: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this._sdkConfigured)
      return { success: false, error: "SDK non configuré." };
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        (p: any) => p.identifier === packageIdentifier,
      );
      if (!pkg) return { success: false, error: "Offre introuvable." };

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
      return { success: false, error: "Achat non confirmé par RevenueCat." };
    } catch (e: any) {
      if (e?.userCancelled) return { success: false, error: "USER_CANCELLED" };
      console.error("[RC] purchase:", e);
      return { success: false, error: "PURCHASE_FAILED" };
    }
  }

  // ── Restauration via RevenueCat ─────────────────────────────────────────────
  async restore(): Promise<{ success: boolean; error?: string }> {
    if (!this._sdkConfigured)
      return { success: false, error: "SDK non configuré." };
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

  // ── Code promo ──────────────────────────────────────────────────────────────
  async activateWithCode(
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    const normalized = code.trim().toUpperCase();
    const def = VALID_PROMO_CODES[normalized];

    if (!def) return { success: false, error: "Code invalide ou inexistant." };

    // Vérifier la date d'expiration du CODE (pas de l'abonnement)
    if (def.expiresAt && new Date(def.expiresAt) < new Date()) {
      return { success: false, error: "Ce code promotionnel a expiré." };
    }

    // Enregistrer l'utilisation (sans bloquer)
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

    // L'abonnement via code promo est toujours "à vie" (pas d'expiresAt sur l'état)
    const state: SubscriptionState = {
      isPremium: true,
      activatedAt: new Date().toISOString(),
      expiresAt: undefined, // à vie
      source: "promo_code",
      promoCode: normalized,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    this._cache = state;
    return { success: true };
  }

  // ── Désactivation (dev / tests) ─────────────────────────────────────────────
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
