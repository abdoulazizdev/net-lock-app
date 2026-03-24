/**
 * app-events.ts — Bus d'événements global ultra-léger
 * Permet la synchronisation d'état entre écrans sans Redux ni Context lourd.
 *
 * Usage :
 *   import AppEvents from "@/services/app-events";
 *   AppEvents.emit("vpn:changed", true);
 *   const unsub = AppEvents.on("vpn:changed", (active) => setVpnActive(active));
 *   return () => unsub();
 */

type EventMap = {
  "vpn:changed": boolean; // VPN activé / désactivé
  "rules:changed": void; // Une règle de blocage a changé
  "focus:changed": boolean; // Mode Focus activé / désactivé
  "profile:changed": void; // Profil activé / désactivé
  "premium:changed": boolean; // Statut premium changé
  "stats:refresh": void; // Forcer le refresh des stats
};

type EventKey = keyof EventMap;
type Listener<K extends EventKey> = (payload: EventMap[K]) => void;

class AppEventBus {
  private listeners: { [K in EventKey]?: Set<Listener<K>> } = {};

  on<K extends EventKey>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set<Listener<K>>() as never;
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return () => this.off(event, listener);
  }

  off<K extends EventKey>(event: K, listener: Listener<K>): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((l) => {
      try {
        l(payload);
      } catch (e) {
        console.warn(`AppEvents[${event}]:`, e);
      }
    });
  }
}

export default new AppEventBus();
