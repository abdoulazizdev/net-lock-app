/**
 * features/home/useDashboard.ts — Données de l'écran d'accueil
 *
 * L'accueil ne charge délibérément *pas* la liste des applications : c'est
 * l'appel le plus lourd de l'app (plusieurs centaines d'entrées avec icônes)
 * et il n'est pas nécessaire pour afficher un état de protection. On ne lit
 * que des compteurs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import AllowlistService, { type AllowlistState } from "@/services/allowlist.service";
import AppEvents from "@/services/app-events";
import ConnectionLogService, { type LogSummary } from "@/services/connection-log.service";
import OemCompatService from "@/services/oem-compat.service";
import ParentalControlService from "@/services/parental-control.service";
import ProductivityService from "@/services/productivity.service";
import StorageService from "@/services/storage.service";
import type { Profile } from "@/types";

export type DashboardData = {
  loading: boolean;
  refreshing: boolean;
  /** Nombre d'apps avec une règle de blocage active. */
  blockedCount: number;
  activeProfile: Profile | null;
  profileCount: number;
  allowlist: AllowlistState;
  logs: LogSummary;
  currentStreak: number;
  savedMinutes: number;
  /** L'OS restreint NetOff en arrière-plan : le blocage peut sauter. */
  batteryRestricted: boolean;
  parentalEnabled: boolean;
  refresh: () => Promise<void>;
};

const EMPTY_LOGS: LogSummary = {
  totalBlocked: 0,
  totalAllowed: 0,
  totalEvents: 0,
  perApp: [],
};

export function useDashboard(): DashboardData {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [profileCount, setProfileCount] = useState(0);
  const [allowlist, setAllowlist] = useState<AllowlistState>({
    enabled: false,
    packages: [],
  });
  const [logs, setLogs] = useState<LogSummary>(EMPTY_LOGS);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [savedMinutes, setSavedMinutes] = useState(0);
  const [batteryRestricted, setBatteryRestricted] = useState(false);
  const [parentalEnabled, setParentalEnabled] = useState(false);

  const mounted = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    // Tout en parallèle : ces lectures sont indépendantes et l'accueil ne doit
    // pas attendre la plus lente en série.
    const [rules, profiles, active, allow, summary, streak, blockedAllTime, restricted, parental] =
      await Promise.all([
        StorageService.getRules().catch(() => []),
        StorageService.getProfiles().catch(() => []),
        StorageService.getActiveProfile().catch(() => null),
        AllowlistService.getState().catch(() => ({ enabled: false, packages: [] })),
        ConnectionLogService.getStats().catch(() => EMPTY_LOGS),
        ProductivityService.getCurrentStreak().catch(() => 0),
        ProductivityService.getTotalBlockedAllTime().catch(() => 0),
        OemCompatService.isBatteryOptimized().catch(() => false),
        ParentalControlService.isParentalEnabled().catch(() => false),
      ]);

    if (!mounted.current) return;

    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    setProfileCount(profiles.length);
    setActiveProfile(active);
    setAllowlist(allow);
    setLogs(summary);
    setCurrentStreak(streak);
    // Même estimation que le service de productivité : ~1,8 min par blocage.
    setSavedMinutes(Math.round(blockedAllTime * 1.8));
    setBatteryRestricted(restricted);
    setParentalEnabled(parental);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();

    const unsubs = [
      AppEvents.on("rules:changed", () => load()),
      AppEvents.on("profile:changed", () => load()),
      AppEvents.on("allowlist:changed", () => load()),
      AppEvents.on("stats:refresh", () => load()),
    ];

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && appStateRef.current !== "active") load();
      appStateRef.current = state;
    });

    return () => {
      unsubs.forEach((off) => off());
      sub.remove();
    };
  }, [load]);

  return {
    loading,
    refreshing,
    blockedCount,
    activeProfile,
    profileCount,
    allowlist,
    logs,
    currentStreak,
    savedMinutes,
    batteryRestricted,
    parentalEnabled,
    refresh,
  };
}
