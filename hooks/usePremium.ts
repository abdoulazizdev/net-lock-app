import SubscriptionService from "@/services/subscription.service";
import { useCallback, useEffect, useState } from "react";

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await SubscriptionService.isPremium();
    setIsPremium(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isPremium, loading, refresh };
}
