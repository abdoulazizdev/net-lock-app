/**
 * features/vpn/useVpn.ts — État de la protection réseau
 *
 * Le VPN local est la pièce centrale : sans lui, les règles sont enregistrées
 * mais rien n'est bloqué. Ce hook expose son état, sa bascule, et le signal
 * « des apps sont bloquées mais la protection est coupée » — l'incohérence à
 * signaler en priorité à l'utilisateur.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import AppEvents from "@/services/app-events";
import VpnService from "@/services/vpn.service";

export type VpnState = {
  active: boolean;
  /** Une bascule est en cours (attente de la permission système incluse). */
  busy: boolean;
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
  toggle: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useVpn(): VpnState {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    try {
      setActive(await VpnService.isVpnActive());
    } catch {
      // Module natif absent (web, émulateur sans VPN) : on garde l'état connu.
    }
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      // `startVpn` peut n'aboutir qu'après la boîte de dialogue système ;
      // l'état réel arrive alors par l'événement "vpn:changed".
      return await VpnService.startVpn();
    } finally {
      setBusy(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setBusy(true);
    try {
      await VpnService.stopVpn();
      setActive(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (active) await stop();
    else await start();
  }, [active, start, stop]);

  useEffect(() => {
    refresh();
    const unsub = AppEvents.on("vpn:changed", setActive);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && appStateRef.current !== "active") refresh();
      appStateRef.current = state;
    });
    return () => {
      unsub();
      sub.remove();
    };
  }, [refresh]);

  return { active, busy, start, stop, toggle, refresh };
}
