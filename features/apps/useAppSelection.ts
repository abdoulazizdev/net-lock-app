/**
 * features/apps/useAppSelection.ts — Sélection multiple d'applications
 *
 * Le mode sélection remplace l'action « une ligne à la fois » : tant qu'il est
 * actif, un appui sur une ligne coche ou décoche, et les interrupteurs sont
 * masqués. Sortir du mode vide toujours la sélection — garder des cases
 * cochées invisibles est une source d'actions involontaires.
 */

import { useCallback, useMemo, useState } from "react";

import type { AppEntry } from "./useAppCatalog";

export type AppSelection = {
  active: boolean;
  selected: Set<string>;
  count: number;
  /** Toutes les apps de la liste visible sont sélectionnées. */
  allVisibleSelected: boolean;
  /** Nombre d'apps sélectionnées actuellement bloquées. */
  blockedCount: number;
  enter: (packageName?: string) => void;
  exit: () => void;
  toggle: (packageName: string) => void;
  /** Coche tout ce qui est visible, ou décoche si tout l'était déjà. */
  toggleAllVisible: () => void;
  isSelected: (packageName: string) => boolean;
  packages: string[];
};

export function useAppSelection(visible: AppEntry[]): AppSelection {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const enter = useCallback((packageName?: string) => {
    setActive(true);
    if (packageName) setSelected(new Set([packageName]));
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((packageName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) next.delete(packageName);
      else next.add(packageName);
      return next;
    });
  }, []);

  const visiblePackages = useMemo(
    () => visible.map((app) => app.packageName),
    [visible],
  );

  const allVisibleSelected =
    visiblePackages.length > 0 &&
    visiblePackages.every((packageName) => selected.has(packageName));

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const everySelected =
        visiblePackages.length > 0 &&
        visiblePackages.every((packageName) => prev.has(packageName));
      if (everySelected) {
        const next = new Set(prev);
        visiblePackages.forEach((packageName) => next.delete(packageName));
        return next;
      }
      return new Set([...prev, ...visiblePackages]);
    });
  }, [visiblePackages]);

  const isSelected = useCallback(
    (packageName: string) => selected.has(packageName),
    [selected],
  );

  // Compté sur la liste visible : suffisant pour libeller les actions, et
  // évite de conserver une copie du catalogue entier.
  const blockedCount = useMemo(
    () => visible.filter((app) => selected.has(app.packageName) && app.blocked).length,
    [visible, selected],
  );

  return {
    active,
    selected,
    count: selected.size,
    allVisibleSelected,
    blockedCount,
    enter,
    exit,
    toggle,
    toggleAllVisible,
    isSelected,
    packages: useMemo(() => [...selected], [selected]),
  };
}
