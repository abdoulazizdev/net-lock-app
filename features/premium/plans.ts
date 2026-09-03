/**
 * features/premium/plans.ts — Offres, avantages et messages du paywall
 *
 * Les prix affichés viennent de RevenueCat (localisés par le store). Les
 * valeurs de `FALLBACK_PLANS` ne servent qu'à afficher quelque chose de
 * crédible quand le SDK n'est pas joignable — jamais à facturer.
 */

import Purchases, { type PurchasesPackage } from "react-native-purchases";

import SubscriptionService, { FREE_LIMITS } from "@/services/subscription.service";
import { plural } from "@/lib/format";
import type { IconName } from "@/ui";
import type { PaywallReason } from "./usePremium";

export type Plan = {
  id: string;
  label: string;
  price: string;
  period: string;
  /** Étiquette mise en avant (« –50 % », « Meilleure offre »). */
  badge: string | null;
  /** Plan présélectionné à l'ouverture. */
  recommended?: boolean;
  rcPackage: PurchasesPackage | null;
};

/** Habillage d'un identifiant de package RevenueCat. */
const PACKAGE_META: Record<
  string,
  { label: string; period: string; badge: string | null; recommended?: boolean }
> = {
  netoff_monthly: { label: "Mensuel", period: "par mois", badge: null },
  netoff_yearly: { label: "Annuel", period: "par an", badge: "–50 %", recommended: true },
  netoff_lifetime: { label: "À vie", period: "paiement unique", badge: "Meilleure offre" },
  $rc_weekly: { label: "Hebdomadaire", period: "par semaine", badge: null },
  $rc_monthly: { label: "Mensuel", period: "par mois", badge: null },
  $rc_annual: { label: "Annuel", period: "par an", badge: "–50 %", recommended: true },
  $rc_lifetime: { label: "À vie", period: "paiement unique", badge: "Meilleure offre" },
};

/** Ordre d'affichage : l'offre la plus engageante en premier. */
const PLAN_ORDER = [
  "netoff_lifetime",
  "$rc_lifetime",
  "netoff_yearly",
  "$rc_annual",
  "netoff_monthly",
  "$rc_monthly",
  "$rc_weekly",
];

export const FALLBACK_PLANS: Plan[] = [
  {
    id: "netoff_lifetime",
    label: "À vie",
    price: "34,99 €",
    period: "paiement unique",
    badge: "Meilleure offre",
    rcPackage: null,
  },
  {
    id: "netoff_yearly",
    label: "Annuel",
    price: "17,99 €",
    period: "par an",
    badge: "–50 %",
    recommended: true,
    rcPackage: null,
  },
  {
    id: "netoff_monthly",
    label: "Mensuel",
    price: "2,99 €",
    period: "par mois",
    badge: null,
    rcPackage: null,
  },
];

function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const ia = PLAN_ORDER.indexOf(a.id);
    const ib = PLAN_ORDER.indexOf(b.id);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/**
 * Récupère les offres du store. Renvoie toujours une liste utilisable :
 * en cas d'échec, les plans de repli, avec `fromStore: false`.
 */
export async function fetchPlans(): Promise<{ plans: Plan[]; fromStore: boolean }> {
  if (!SubscriptionService.isSdkReady()) {
    return { plans: FALLBACK_PLANS, fromStore: false };
  }
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    if (packages.length === 0) return { plans: FALLBACK_PLANS, fromStore: false };

    const plans = packages.map<Plan>((pkg) => {
      const meta = PACKAGE_META[pkg.identifier] ?? {
        label: pkg.product.title || pkg.identifier,
        period: "",
        badge: null,
      };
      return {
        id: pkg.identifier,
        label: meta.label,
        price: pkg.product.priceString,
        period: meta.period,
        badge: meta.badge,
        recommended: meta.recommended,
        rcPackage: pkg,
      };
    });
    return { plans: sortPlans(plans), fromStore: true };
  } catch {
    return { plans: FALLBACK_PLANS, fromStore: false };
  }
}

// ─── Comparatif ──────────────────────────────────────────────────────────────

export type FeatureComparison = {
  icon: IconName;
  label: string;
  free: string;
  premium: string;
};

export const FEATURE_COMPARISON: FeatureComparison[] = [
  {
    icon: "shield-off-outline",
    label: "Apps bloquées",
    free: plural(FREE_LIMITS.MAX_BLOCKED_APPS, "app"),
    premium: "Illimité",
  },
  {
    icon: "account-multiple-outline",
    label: "Profils",
    free: plural(FREE_LIMITS.MAX_PROFILES, "profil", "profils"),
    premium: "Illimité",
  },
  {
    icon: "calendar-clock",
    label: "Planifications",
    free: `${FREE_LIMITS.MAX_SCHEDULES} par profil`,
    premium: "Illimité",
  },
  {
    icon: "target",
    label: "Sessions Focus",
    free: FREE_LIMITS.FOCUS_PRESETS_FREE.map((m) => `${m} min`).join(", "),
    premium: "Toutes durées",
  },
  {
    icon: "timer-outline",
    label: "Minuterie",
    free: FREE_LIMITS.TIMER_PRESETS_FREE.map((m) => `${m} min`).join(", "),
    premium: "Jusqu'à 4 h",
  },
  {
    icon: "chart-box-outline",
    label: "Statistiques",
    free: "Vue d'ensemble",
    premium: "Historique complet",
  },
  {
    icon: "playlist-check",
    label: "Liste blanche",
    free: "—",
    premium: "Incluse",
  },
  {
    icon: "fingerprint",
    label: "Verrouillage",
    free: FREE_LIMITS.PIN_AUTH ? "Code PIN" : "—",
    premium: "PIN + biométrie",
  },
  {
    icon: "swap-vertical",
    label: "Export / import",
    free: FREE_LIMITS.EXPORT_IMPORT ? "Inclus" : "—",
    premium: "Inclus",
  },
];

// ─── Accroches selon le contexte ─────────────────────────────────────────────

export const REASON_COPY: Record<PaywallReason, { icon: IconName; title: string; message: string }> = {
  general: {
    icon: "shield-star-outline",
    title: "NetOff Pro",
    message: "Débloquez toutes les fonctionnalités, sans limite d'apps ni de profils.",
  },
  blocked_apps: {
    icon: "shield-off-outline",
    title: `Limite de ${FREE_LIMITS.MAX_BLOCKED_APPS} apps atteinte`,
    message: "Passez à Pro pour bloquer autant d'applications que nécessaire.",
  },
  profiles: {
    icon: "account-multiple-plus-outline",
    title: "Profils illimités",
    message: `La version gratuite autorise ${plural(FREE_LIMITS.MAX_PROFILES, "profil", "profils")}. Créez-en autant que vous voulez avec Pro.`,
  },
  schedules: {
    icon: "calendar-clock",
    title: "Planifications illimitées",
    message: `La version gratuite est limitée à ${FREE_LIMITS.MAX_SCHEDULES} planification par profil.`,
  },
  focus_presets: {
    icon: "target",
    title: "Toutes les durées de Focus",
    message: "Les sessions longues et les durées personnalisées demandent Pro.",
  },
  timer_presets: {
    icon: "timer-outline",
    title: "Minuteries longues",
    message: `En gratuit : ${FREE_LIMITS.TIMER_PRESETS_FREE.map((m) => `${m} min`).join(", ")}. Pro débloque 1 h, 2 h et 4 h.`,
  },
  stats: {
    icon: "chart-box-outline",
    title: "Statistiques avancées",
    message: "Historique complet des connexions et détail par application.",
  },
  allowlist: {
    icon: "playlist-check",
    title: "Mode liste blanche",
    message: "Tout bloquer sauf quelques apps — le mode le plus strict, réservé à Pro.",
  },
  security: {
    icon: "fingerprint",
    title: "Déverrouillage biométrique",
    message: "Protégez NetOff par empreinte ou reconnaissance faciale.",
  },
  export: {
    icon: "swap-vertical",
    title: "Export et import",
    message: "Sauvegardez vos règles et profils, puis restaurez-les sur un autre appareil.",
  },
};

// ─── Messages d'erreur ───────────────────────────────────────────────────────

const PURCHASE_ERRORS: Record<string, string> = {
  PURCHASE_FAILED: "Le paiement n'a pas abouti. Vérifiez votre moyen de paiement.",
  RESTORE_FAILED: "La restauration a échoué. Vérifiez votre connexion puis réessayez.",
  SDK_NOT_READY: "Le service de paiement est momentanément indisponible.",
  NO_OFFERING: "Cette offre n'est pas disponible pour le moment.",
  NOT_CONFIRMED:
    "Paiement reçu mais pas encore confirmé par le store. Patientez quelques secondes puis relancez l'app.",
  USER_CANCELLED: "",
};

/** Traduit un code d'erreur d'achat en message affichable. */
export function purchaseErrorMessage(code?: string): string {
  if (!code) return "Une erreur inattendue est survenue.";
  return PURCHASE_ERRORS[code] ?? "Une erreur inattendue est survenue.";
}
