// hooks/useAllowlist.ts
import AllowlistService, { AllowlistState } from "@/services/allowlist.service";
import AppEvents from "@/services/app-events";
import { useCallback, useEffect, useState } from "react";

export function useAllowlist() {
  const [allowlistState, setAllowlistState] = useState<AllowlistState>({
    enabled: false,
    packages: [],
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const state = await AllowlistService.getState();
    setAllowlistState(state);
  }, []);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      await AllowlistService.disable();
      const newState = await AllowlistService.getState();
      setAllowlistState(newState);
      AppEvents.emit("allowlist:changed", false);
      AppEvents.emit("rules:changed", undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (pkgs: string[]) => {
    setLoading(true);
    try {
      const state = await AllowlistService.getState();
      if (state.enabled) {
        await AllowlistService.updateAllowedPackages(pkgs);
      } else {
        await AllowlistService.enable(pkgs);
      }
      const newState = await AllowlistService.getState();
      setAllowlistState(newState);
      AppEvents.emit("allowlist:changed", newState.enabled);
      AppEvents.emit("rules:changed", undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = AppEvents.on("allowlist:changed", () => refresh());
    return () => unsub();
  }, [refresh]);

  return { allowlistState, loading, refresh, disable, save };
}
