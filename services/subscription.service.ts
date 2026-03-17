import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@netoff_premium";
const CODES_KEY = "@netoff_promo_codes_used";

export interface SubscriptionState {
  isPremium: boolean;
  activatedAt?: string;
  expiresAt?: string; // undefined = lifetime
  source?: "purchase" | "promo_code" | "restore";
  promoCode?: string;
}

// ── Limites de la version gratuite ─────────────────────────────────────────────
export const FREE_LIMITS = {
  MAX_BLOCKED_APPS: 3,
  MAX_PROFILES: 1,
  MAX_SCHEDULES: 1, // par profil
  FOCUS_PRESETS_FREE: [25] as number[],
  STATS_TABS_FREE: ["overview"] as string[],
  EXPORT_IMPORT: false,
  PIN_AUTH: false,
  BIOMETRIC_AUTH: false,
};

// ── Codes promo valides (à gérer côté serveur en prod) ─────────────────────────
// Format : CODE → expiration ISO ou null (permanent)
// ⚠️  En production, vérifier ces codes côté serveur via une Cloud Function
//     pour éviter qu'ils soient reverse-engineerés.
const VALID_PROMO_CODES: Record<string, string | null> = {
  "NETOFF-PRO-2025": null, // permanent
  "BETA-TESTER": null, // permanent
  "ABDOULAZIZ-DEV": null, // permanent (code développeur)
  // Ajouter d'autres codes ici
};

class SubscriptionService {
  private _cache: SubscriptionState | null = null;

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

  // ── Activation via RevenueCat / Google Play Billing ──────────────────────────
  // Appelé après Purchases.purchasePackage() réussi
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

  // ── Activation via code promo ────────────────────────────────────────────────
  async activateWithCode(
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    const normalized = code.trim().toUpperCase();

    // Vérifier si le code existe
    if (!(normalized in VALID_PROMO_CODES)) {
      return { success: false, error: "Code invalide ou inexistant." };
    }

    // Vérifier si le code a expiré
    const expiry = VALID_PROMO_CODES[normalized];
    if (expiry && new Date(expiry) < new Date()) {
      return { success: false, error: "Ce code a expiré." };
    }

    // Vérifier si déjà utilisé sur cet appareil (anti-abus léger)
    try {
      const usedRaw = await AsyncStorage.getItem(CODES_KEY);
      const used: string[] = usedRaw ? JSON.parse(usedRaw) : [];
      if (used.includes(normalized)) {
        // Déjà utilisé → activer quand même si pas encore premium
        // (pour permettre la réinstallation)
      }
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

  // ── Restauration d'achat (RevenueCat) ────────────────────────────────────────
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

  // ── Dev / debug ──────────────────────────────────────────────────────────────
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
