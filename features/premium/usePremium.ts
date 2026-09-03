/**
 * features/premium/usePremium.ts — Abonnement et limites de la version gratuite
 *
 * Centralise « ai-je le droit de faire ça ? ». Les écrans n'ont plus à
 * comparer des compteurs à `FREE_LIMITS` : ils demandent, et reçoivent soit
 * l'autorisation, soit le motif à passer au paywall.
 *
 *   const { limits } = usePremium();
 *   const check = limits.canBlockApp(blockedCount);
 *   if (!check.allowed) return showPaywall(check.reason);
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import AppEvents from "@/services/app-events";
import SubscriptionService, { FREE_LIMITS } from "@/services/subscription.service";

/** Fonctionnalité à l'origine de l'ouverture du paywall. */
export type PaywallReason =
  | "general"
  | "blocked_apps"
  | "profiles"
  | "schedules"
  | "focus_presets"
  | "timer_presets"
  | "stats"
  | "allowlist"
  | "security"
  | "export";

export type LimitCheck = { allowed: true } | { allowed: false; reason: PaywallReason };

const ALLOWED: LimitCheck = { allowed: true };

export type PremiumLimits = {
  canBlockApp: (currentBlockedCount: number) => LimitCheck;
  canCreateProfile: (currentProfileCount: number) => LimitCheck;
  canAddSchedule: (currentScheduleCount: number) => LimitCheck;
  canUseFocusPreset: (minutes: number) => LimitCheck;
  canUseTimerPreset: (minutes: number) => LimitCheck;
  canViewStatsTab: (tab: string) => LimitCheck;
  canUseAllowlist: () => LimitCheck;
  canUseBiometrics: () => LimitCheck;
  canExportImport: () => LimitCheck;
  /** Nombre maximal d'apps bloquées, `Infinity` pour un abonné. */
  maxBlockedApps: number;
  maxProfiles: number;
  maxSchedules: number;
};

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIsPremium(await SubscriptionService.isPremium());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = AppEvents.on("premium:changed", () => {
      SubscriptionService.invalidateCache();
      refresh();
    });
    return () => unsub();
  }, [refresh]);

  const limits = useMemo<PremiumLimits>(() => {
    const deny = (reason: PaywallReason): LimitCheck => ({ allowed: false, reason });

    return {
      maxBlockedApps: isPremium ? Infinity : FREE_LIMITS.MAX_BLOCKED_APPS,
      maxProfiles: isPremium ? Infinity : FREE_LIMITS.MAX_PROFILES,
      maxSchedules: isPremium ? Infinity : FREE_LIMITS.MAX_SCHEDULES,

      canBlockApp: (count) =>
        isPremium || count < FREE_LIMITS.MAX_BLOCKED_APPS ? ALLOWED : deny("blocked_apps"),
      canCreateProfile: (count) =>
        isPremium || count < FREE_LIMITS.MAX_PROFILES ? ALLOWED : deny("profiles"),
      canAddSchedule: (count) =>
        isPremium || count < FREE_LIMITS.MAX_SCHEDULES ? ALLOWED : deny("schedules"),
      canUseFocusPreset: (minutes) =>
        isPremium || FREE_LIMITS.FOCUS_PRESETS_FREE.includes(minutes)
          ? ALLOWED
          : deny("focus_presets"),
      canUseTimerPreset: (minutes) =>
        isPremium || FREE_LIMITS.TIMER_PRESETS_FREE.includes(minutes)
          ? ALLOWED
          : deny("timer_presets"),
      canViewStatsTab: (tab) =>
        isPremium || FREE_LIMITS.STATS_TABS_FREE.includes(tab) ? ALLOWED : deny("stats"),
      canUseAllowlist: () => (isPremium ? ALLOWED : deny("allowlist")),
      canUseBiometrics: () =>
        isPremium || FREE_LIMITS.BIOMETRIC_AUTH ? ALLOWED : deny("security"),
      canExportImport: () =>
        isPremium || FREE_LIMITS.EXPORT_IMPORT ? ALLOWED : deny("export"),
    };
  }, [isPremium]);

  return { isPremium, loading, refresh, limits };
}

/** Ouverture du paywall, à câbler sur `<Paywall />`. */
export function usePaywall() {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<PaywallReason>("general");

  const open = useCallback((next: PaywallReason = "general") => {
    setReason(next);
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  /** Ouvre le paywall si la vérification échoue. Renvoie `true` si autorisé. */
  const enforce = useCallback(
    (check: LimitCheck): boolean => {
      if (check.allowed) return true;
      open(check.reason);
      return false;
    },
    [open],
  );

  return { visible, reason, open, close, enforce };
}
