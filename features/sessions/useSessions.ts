/**
 * features/sessions/useSessions.ts — Sessions Focus et minuteries
 *
 * Deux mécanismes de blocage temporaire, volontairement différents :
 *
 *   • Focus   — engagement. Piloté par un service natif, survit à la fermeture
 *               de l'app, et ne s'arrête qu'après un appui maintenu.
 *   • Minuterie — commodité. Purement JS, annulable d'un tap.
 *
 * Tant qu'une session est en cours, les règles sont figées : ce hook expose
 * `locked` pour que les écrans désactivent leurs bascules.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import AppEvents from "@/services/app-events";
import FocusService, { type FocusStatus } from "@/services/focus.service";
import TimerService, { type TimerStatus } from "@/services/timer.service";

/** Fréquence de rafraîchissement du temps restant affiché. */
const TICK_MS = 1000;

export type SessionsState = {
  focus: FocusStatus | null;
  timer: TimerStatus | null;
  focusActive: boolean;
  timerActive: boolean;
  /** Une session est en cours : les règles ne doivent pas être modifiables. */
  locked: boolean;
  /** Millisecondes restantes de la session en cours, 0 sinon. */
  remainingMs: number;
  refresh: () => Promise<void>;
};

export function useSessions(): SessionsState {
  const [focus, setFocus] = useState<FocusStatus | null>(null);
  const [timer, setTimer] = useState<TimerStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    try {
      const status = await FocusService.getStatus();
      setFocus(status.isActive ? status : null);
    } catch {
      setFocus(null);
    }
    try {
      const status = await TimerService.getStatus();
      setTimer(status.isActive ? status : null);
    } catch {
      setTimer(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    TimerService.rescheduleIfNeeded().catch(() => {});

    const unsubFocus = AppEvents.on("focus:changed", (active) => {
      if (active) refresh();
      else setFocus(null);
    });
    const unsubTimer = AppEvents.on("timer:changed", (active) => {
      if (active) refresh();
      else setTimer(null);
    });

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && appStateRef.current !== "active") refresh();
      appStateRef.current = state;
    });

    return () => {
      unsubFocus();
      unsubTimer();
      sub.remove();
    };
  }, [refresh]);

  const focusActive = focus?.isActive ?? false;
  const timerActive = timer?.isActive ?? false;
  const anyActive = focusActive || timerActive;

  // Une seule horloge, et seulement quand une session tourne.
  useEffect(() => {
    if (!anyActive) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [anyActive]);

  const endTime = focus?.endTime ?? timer?.endTime ?? 0;
  const remainingMs = anyActive && endTime > 0 ? Math.max(0, endTime - now) : 0;

  // La session est arrivée à échéance : on resynchronise avec le natif.
  useEffect(() => {
    if (anyActive && endTime > 0 && remainingMs === 0) refresh();
  }, [anyActive, endTime, remainingMs, refresh]);

  return {
    focus,
    timer,
    focusActive,
    timerActive,
    locked: anyActive,
    remainingMs,
    refresh,
  };
}
