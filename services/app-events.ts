/**
 * app-events.ts — Bus d'événements global
 */
type EventMap = {
  "vpn:changed": boolean;
  "rules:changed": void;
  "focus:changed": boolean;
  "timer:changed": boolean;
  "profile:changed": void;
  "premium:changed": boolean;
  "stats:refresh": void;
};

type EventKey = keyof EventMap;
type Listener<K extends EventKey> = (payload: EventMap[K]) => void;

class AppEventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<EventKey, Set<Listener<any>>>();

  on<K extends EventKey>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends EventKey>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((l) => {
      try {
        l(payload);
      } catch (e) {
        console.warn(`AppEvents[${event}]:`, e);
      }
    });
  }
}

export default new AppEventBus();
