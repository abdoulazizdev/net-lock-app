/**
 * features/system/useBootstrap.ts — Démarrage de l'application
 *
 * Rassemble tout ce qui doit être fait une fois, avant le premier écran, et
 * décide de la destination initiale. Chaque étape est isolée : une erreur
 * d'abonnement ou de watchdog ne doit jamais empêcher l'app de s'ouvrir.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import StorageService from "@/services/storage.service";
import SubscriptionService from "@/services/subscription.service";
import WatchdogService from "@/services/watchdog.service";
import WeeklyReportService from "@/services/weekly-report.service";

export const ONBOARDING_KEY = "@netoff_onboarding_done";

/** Écran à afficher au lancement. */
export type BootRoute = "/onboarding" | "/lock" | "/(tabs)";

export type BootState = {
  ready: boolean;
  route: BootRoute;
  /** Le bilan hebdomadaire doit être proposé. */
  showWeeklyReport: boolean;
  dismissWeeklyReport: () => void;
};

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
  } catch {
    return false;
  }
}

export function useBootstrap(): BootState {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<BootRoute>("/(tabs)");
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  const dismissWeeklyReport = useCallback(() => {
    setShowWeeklyReport(false);
    WeeklyReportService.markReportSeen().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Destination initiale — c'est le seul résultat bloquant.
      let target: BootRoute = "/(tabs)";
      try {
        if (!(await isOnboardingDone())) {
          target = "/onboarding";
        } else {
          const auth = await StorageService.getAuthConfig();
          if (auth.isPinEnabled || auth.isBiometricEnabled) target = "/lock";
        }
      } catch {
        // En cas de doute, on n'enferme pas l'utilisateur dehors.
        target = "/(tabs)";
      }

      if (cancelled) return;
      setRoute(target);
      setReady(true);

      // 2. Le reste tourne en arrière-plan : rien ici ne doit retarder
      //    l'affichage du premier écran.
      SubscriptionService.configure()
        .then(() => SubscriptionService.syncWithRevenueCat())
        .catch(() => {});

      if (target !== "/onboarding") {
        WatchdogService.start().catch(() => {});
        WeeklyReportService.shouldShowReport()
          .then((should) => {
            if (should && !cancelled) setShowWeeklyReport(true);
          })
          .catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, route, showWeeklyReport, dismissWeeklyReport };
}
