/**
 * features/stats/useStats.ts — Données statistiques
 *
 * Trois sources se combinent ici :
 *   • le journal natif des connexions (compteurs et historique) ;
 *   • le service de productivité (séries, badges, score) ;
 *   • la liste d'apps, uniquement pour traduire un package en nom lisible.
 *
 * La résolution des noms est mise en cache et limitée aux packages réellement
 * affichés : interroger le PackageManager pour chaque ligne d'historique
 * coûterait bien plus que l'affichage lui-même.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import AppEvents from "@/services/app-events";
import AppListService from "@/services/app-list.service";
import ConnectionLogService, {
  type LogEntry,
  type LogSummary,
} from "@/services/connection-log.service";
import ProductivityService, { type ProductivityStats } from "@/services/productivity.service";

/** Nombre d'entrées d'historique chargées. */
const HISTORY_LIMIT = 300;
/** Nombre de packages dont on résout le nom à chaque passe. */
const NAME_RESOLVE_LIMIT = 60;

const EMPTY_SUMMARY: LogSummary = {
  totalBlocked: 0,
  totalAllowed: 0,
  totalEvents: 0,
  perApp: [],
};

export type StatsData = {
  loading: boolean;
  refreshing: boolean;
  summary: LogSummary;
  history: LogEntry[];
  productivity: ProductivityStats | null;
  /** Nom lisible d'un package, avec repli sur le dernier segment. */
  appName: (packageName: string) => string;
  refresh: () => Promise<void>;
  clearHistory: () => Promise<void>;
};

/** Repli lisible quand le nom de l'app est inconnu : « com.foo.bar » → « bar ». */
function fallbackName(packageName: string): string {
  const last = packageName.split(".").pop() ?? packageName;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export function useStats(): StatsData {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<LogSummary>(EMPTY_SUMMARY);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [productivity, setProductivity] = useState<ProductivityStats | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const [stats, logs, prod] = await Promise.all([
      ConnectionLogService.getStats().catch(() => EMPTY_SUMMARY),
      ConnectionLogService.getLogs(HISTORY_LIMIT).catch(() => []),
      ProductivityService.getStats().catch(() => null),
    ]);

    if (!mounted.current) return;
    setSummary(stats);
    setHistory(logs);
    setProductivity(prod);
    setLoading(false);

    // Les noms arrivent après : l'écran est déjà utilisable avec les packages.
    const wanted = [
      ...new Set([
        ...stats.perApp.map((a) => a.packageName),
        ...logs.slice(0, NAME_RESOLVE_LIMIT).map((l) => l.packageName),
      ]),
    ].slice(0, NAME_RESOLVE_LIMIT);

    const resolved: Record<string, string> = {};
    await Promise.all(
      wanted.map(async (pkg) => {
        const app = await AppListService.getAppByPackage(pkg).catch(() => null);
        if (app?.appName) resolved[pkg] = app.appName;
      }),
    );

    if (mounted.current && Object.keys(resolved).length > 0) {
      setNames((prev) => ({ ...prev, ...resolved }));
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [load]);

  const clearHistory = useCallback(async () => {
    await ConnectionLogService.clearLogs();
    await load();
    AppEvents.emit("stats:refresh", undefined);
  }, [load]);

  const appName = useCallback(
    (packageName: string) => names[packageName] ?? fallbackName(packageName),
    [names],
  );

  useEffect(() => {
    load();
    const unsub = AppEvents.on("stats:refresh", () => load());
    return () => unsub();
  }, [load]);

  return {
    loading,
    refreshing,
    summary,
    history,
    productivity,
    appName,
    refresh,
    clearHistory,
  };
}
