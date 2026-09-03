/**
 * features/apps/useAppCatalog.ts — Catalogue d'applications et règles
 *
 * Source unique pour « la liste des apps installées et leur état de blocage ».
 * Utilisé par l'onglet Apps, le détail d'un profil, la liste blanche et
 * l'onboarding.
 *
 * Chargement en deux temps, à chaque périmètre : d'abord la liste **sans
 * icônes**, qui revient en quelques dizaines de millisecondes et permet un
 * premier rendu complet ; puis les icônes, qui viennent se greffer dessus.
 * Une liste affichée sans icônes reste utilisable — une liste vide, non.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import AppEvents from "@/services/app-events";
import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import type { InstalledApp } from "@/types";

/** Une app installée, enrichie de son état de blocage. */
export type AppEntry = InstalledApp & { blocked: boolean };

export type AppCatalog = {
  apps: AppEntry[];
  /** Nombre total d'apps bloquées, y compris hors de la liste chargée. */
  blockedCount: number;
  loading: boolean;
  refreshing: boolean;
  /** Les apps système sont présentes dans `apps`. */
  systemLoaded: boolean;
  systemLoading: boolean;
  /** Recharge tout en invalidant les caches. */
  refresh: () => Promise<void>;
  /** Déclenche le chargement des apps système si ce n'est pas déjà fait. */
  loadSystemApps: () => void;
  /**
   * Applique une règle de blocage. Optimiste : l'interface répond
   * immédiatement et revient en arrière si le natif échoue.
   */
  setBlocked: (packageName: string, blocked: boolean) => Promise<boolean>;
  /** Applique la même règle à plusieurs apps, en une seule écriture. */
  setBlockedMany: (packageNames: string[], blocked: boolean) => Promise<boolean>;
};

function withRules(
  apps: InstalledApp[],
  blockedPackages: Set<string>,
  previous?: AppEntry[],
): AppEntry[] {
  // Les icônes déjà chargées sont conservées : un rechargement des règles ne
  // doit pas faire disparaître les icônes obtenues par la passe complète.
  const icons = previous?.length
    ? new Map(previous.map((a) => [a.packageName, a.icon]))
    : null;
  return apps.map((a) => ({
    ...a,
    icon: a.icon ?? icons?.get(a.packageName) ?? null,
    blocked: blockedPackages.has(a.packageName),
  }));
}

async function readBlockedPackages(): Promise<Set<string>> {
  const rules = await StorageService.getRules();
  return new Set(rules.filter((r) => r.isBlocked).map((r) => r.packageName));
}

export function useAppCatalog(): AppCatalog {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemLoaded, setSystemLoaded] = useState(false);
  const [systemLoading, setSystemLoading] = useState(false);

  const mounted = useRef(true);
  const systemRequested = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyRules = useCallback(async () => {
    const blocked = await readBlockedPackages();
    if (!mounted.current) return;
    setBlockedCount(blocked.size);
    setApps((prev) => withRules(prev, blocked, prev));
  }, []);

  /** Fusionne une liste fraîchement chargée avec l'état courant. */
  const merge = useCallback(async (incoming: InstalledApp[]) => {
    const blocked = await readBlockedPackages();
    if (!mounted.current) return;
    setBlockedCount(blocked.size);
    setApps((prev) => {
      // Une passe « apps utilisateur » ne doit pas effacer les apps système
      // déjà chargées : on repart de l'union des deux.
      const merged = new Map(prev.map((a) => [a.packageName, a as InstalledApp]));
      for (const app of incoming) {
        const existing = merged.get(app.packageName);
        merged.set(app.packageName, {
          ...existing,
          ...app,
          icon: app.icon ?? existing?.icon ?? null,
        });
      }
      return withRules([...merged.values()], blocked, prev);
    });
  }, []);

  const loadUserApps = useCallback(async () => {
    try {
      await merge(await AppListService.getUserApps());
    } finally {
      if (mounted.current) setLoading(false);
    }
    AppListService.getUserAppsWithIcons().then(merge).catch(() => {});
  }, [merge]);

  const loadSystemApps = useCallback(() => {
    if (systemRequested.current) return;
    systemRequested.current = true;
    setSystemLoading(true);

    (async () => {
      try {
        // Passe légère d'abord : les apps système apparaissent tout de suite,
        // au lieu d'attendre plusieurs secondes le chargement des icônes.
        await merge(await AppListService.getAllApps());
        if (mounted.current) {
          setSystemLoaded(true);
          setSystemLoading(false);
        }
        await merge(await AppListService.getAllAppsWithIcons());
      } catch {
        systemRequested.current = false;
        if (mounted.current) setSystemLoading(false);
      }
    })();
  }, [merge]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    AppListService.invalidateCache();
    const hadSystem = systemRequested.current;
    systemRequested.current = false;
    setSystemLoaded(false);
    try {
      await loadUserApps();
      if (hadSystem) loadSystemApps();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [loadUserApps, loadSystemApps]);

  const setBlocked = useCallback(
    async (packageName: string, blocked: boolean): Promise<boolean> => {
      const patch = (value: boolean) =>
        setApps((prev) =>
          prev.map((a) =>
            a.packageName === packageName ? { ...a, blocked: value } : a,
          ),
        );

      patch(blocked);
      setBlockedCount((c) => Math.max(0, c + (blocked ? 1 : -1)));

      try {
        await VpnService.setRule(packageName, blocked);
        return true;
      } catch {
        patch(!blocked);
        setBlockedCount((c) => Math.max(0, c + (blocked ? -1 : 1)));
        return false;
      }
    },
    [],
  );

  const setBlockedMany = useCallback(
    async (packageNames: string[], blocked: boolean): Promise<boolean> => {
      if (packageNames.length === 0) return true;
      const targets = new Set(packageNames);

      setApps((prev) =>
        prev.map((a) => (targets.has(a.packageName) ? { ...a, blocked } : a)),
      );

      try {
        // Une seule écriture puis une seule synchronisation du tunnel, quel
        // que soit le nombre d'applications sélectionnées.
        await StorageService.setBlockedPackages(packageNames, blocked);
        await VpnService.syncRules();
        await applyRules();
        return true;
      } catch {
        await applyRules();
        return false;
      }
    },
    [applyRules],
  );

  // Chargement initial + resynchronisation au retour au premier plan.
  useEffect(() => {
    loadUserApps();

    const unsubRules = AppEvents.on("rules:changed", () => applyRules());
    const unsubProfile = AppEvents.on("profile:changed", () => applyRules());
    const unsubAllowlist = AppEvents.on("allowlist:changed", () => applyRules());

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && appStateRef.current !== "active") applyRules();
      appStateRef.current = state;
    });

    return () => {
      unsubRules();
      unsubProfile();
      unsubAllowlist();
      sub.remove();
    };
  }, [loadUserApps, applyRules]);

  return {
    apps,
    blockedCount,
    loading,
    refreshing,
    systemLoaded,
    systemLoading,
    refresh,
    loadSystemApps,
    setBlocked,
    setBlockedMany,
  };
}
