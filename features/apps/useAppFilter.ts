/**
 * features/apps/useAppFilter.ts — Recherche, filtres et tri de la liste d'apps
 *
 * Le tri place les apps bloquées en tête, mais il est *différé* après un
 * basculement : sans ce délai, l'app que l'on vient de bloquer saute
 * immédiatement en haut de l'écran et l'on perd le fil de ce qu'on faisait.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppEntry } from "./useAppCatalog";

/** Délai avant de réordonner la liste après un changement de règle. */
const RESORT_DELAY_MS = 1600;

export type AppScope = "all" | "user" | "system";
export type AppStateFilter = "any" | "blocked" | "allowed";

export type AppFilters = { scope: AppScope; state: AppStateFilter };

export const DEFAULT_APP_FILTERS: AppFilters = { scope: "user", state: "any" };

export type AppFilterResult = {
  query: string;
  setQuery: (q: string) => void;
  filters: AppFilters;
  setFilters: (f: AppFilters) => void;
  /** Remet la recherche et les filtres à leur valeur par défaut. */
  reset: () => void;
  /** Au moins un filtre diffère du défaut. */
  isFiltered: boolean;
  /** Liste filtrée et triée. */
  results: AppEntry[];
  /** Apps bloquées dans le résultat courant. */
  blockedInResults: number;
  /** À appeler après avoir modifié une règle, pour différer le retri. */
  deferResort: () => void;
};

export function useAppFilter(apps: AppEntry[]): AppFilterResult {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AppFilters>(DEFAULT_APP_FILTERS);
  const [resortPaused, setResortPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const deferResort = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setResortPaused(true);
    timer.current = setTimeout(() => setResortPaused(false), RESORT_DELAY_MS);
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setFilters(DEFAULT_APP_FILTERS);
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = apps.filter((a) => {
      if (filters.scope === "user" && a.isSystemApp) return false;
      if (filters.scope === "system" && !a.isSystemApp) return false;
      if (filters.state === "blocked" && !a.blocked) return false;
      if (filters.state === "allowed" && a.blocked) return false;
      if (needle) {
        return (
          a.appName.toLowerCase().includes(needle) ||
          a.packageName.toLowerCase().includes(needle)
        );
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (!resortPaused && a.blocked !== b.blocked) return a.blocked ? -1 : 1;
      return a.appName.localeCompare(b.appName, "fr", { sensitivity: "base" });
    });
  }, [apps, query, filters, resortPaused]);

  const blockedInResults = useMemo(
    () => results.reduce((n, a) => n + (a.blocked ? 1 : 0), 0),
    [results],
  );

  const isFiltered =
    query.trim().length > 0 ||
    filters.scope !== DEFAULT_APP_FILTERS.scope ||
    filters.state !== DEFAULT_APP_FILTERS.state;

  return {
    query,
    setQuery,
    filters,
    setFilters,
    reset,
    isFiltered,
    results,
    blockedInResults,
    deferResort,
  };
}
