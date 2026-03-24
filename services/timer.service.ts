/**
 * timer.service.ts — Service de Minuterie rapide
 *
 * DIFFÉRENCES vs Focus :
 * - Pas de hold-to-stop : annulable d'un simple tap
 * - Pas de stats ni de badges trackés
 * - Bloque les apps déjà bloquées dans les règles actuelles (pas de profil)
 * - Pas de fullscreen overlay, juste une bannière simple
 * - Le VPN est stoppé dès l'annulation (si il n'était pas actif avant)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import AppEvents from "./app-events";
import VpnService from "./vpn.service";

const KEY_TIMER_ACTIVE = "@netoff_timer_active";
const KEY_TIMER_END = "@netoff_timer_end";
const KEY_TIMER_DURATION = "@netoff_timer_duration_min";
const KEY_VPN_WAS_ACTIVE = "@netoff_timer_vpn_was_active";

export interface TimerStatus {
  isActive: boolean;
  durationMin: number;
  endTime: number; // timestamp ms
  remainingMs: number;
  remainingLabel: string; // "23:45"
}

class TimerService {
  private _intervalId: ReturnType<typeof setInterval> | null = null;

  // ── Démarrer la minuterie ─────────────────────────────────────────────────
  async start(durationMin: number): Promise<void> {
    const endTime = Date.now() + durationMin * 60 * 1000;
    const vpnWasActive = await VpnService.isVpnActive();

    await AsyncStorage.multiSet([
      [KEY_TIMER_ACTIVE, "true"],
      [KEY_TIMER_END, endTime.toString()],
      [KEY_TIMER_DURATION, durationMin.toString()],
      [KEY_VPN_WAS_ACTIVE, vpnWasActive ? "true" : "false"],
    ]);

    // Démarrer le VPN si pas actif
    if (!vpnWasActive) {
      await VpnService.startVpn();
    }

    // Auto-stop quand le temps est écoulé
    this._scheduleAutoStop(endTime);

    AppEvents.emit("timer:changed" as any, true);
  }

  // ── Arrêter la minuterie (tap simple, pas de hold) ────────────────────────
  async stop(): Promise<void> {
    this._clearAutoStop();

    const vpnWasActive = await AsyncStorage.getItem(KEY_VPN_WAS_ACTIVE);

    await AsyncStorage.multiRemove([
      KEY_TIMER_ACTIVE,
      KEY_TIMER_END,
      KEY_TIMER_DURATION,
      KEY_VPN_WAS_ACTIVE,
    ]);

    // Stopper le VPN seulement si il n'était pas actif avant la minuterie
    if (vpnWasActive !== "true") {
      await VpnService.stopVpn();
    }

    AppEvents.emit("timer:changed" as any, false);
  }

  // ── Lire le statut actuel ─────────────────────────────────────────────────
  async getStatus(): Promise<TimerStatus> {
    const [active, endRaw, durationRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_TIMER_ACTIVE),
      AsyncStorage.getItem(KEY_TIMER_END),
      AsyncStorage.getItem(KEY_TIMER_DURATION),
    ]);

    if (active !== "true" || !endRaw) {
      return {
        isActive: false,
        durationMin: 0,
        endTime: 0,
        remainingMs: 0,
        remainingLabel: "0:00",
      };
    }

    const endTime = parseInt(endRaw, 10);
    const durationMin = parseInt(durationRaw ?? "0", 10);
    const remainingMs = Math.max(0, endTime - Date.now());

    // Expiré mais pas encore nettoyé
    if (remainingMs === 0) {
      await this.stop();
      return {
        isActive: false,
        durationMin,
        endTime,
        remainingMs: 0,
        remainingLabel: "0:00",
      };
    }

    return {
      isActive: true,
      durationMin,
      endTime,
      remainingMs,
      remainingLabel: this._formatRemaining(remainingMs),
    };
  }

  // ── Replanifier l'auto-stop (après reboot app) ────────────────────────────
  async rescheduleIfNeeded(): Promise<void> {
    const status = await this.getStatus();
    if (status.isActive && status.remainingMs > 0) {
      this._scheduleAutoStop(status.endTime);
    }
  }

  private _scheduleAutoStop(endTime: number): void {
    this._clearAutoStop();
    const delay = Math.max(0, endTime - Date.now());
    this._intervalId = setTimeout(() => this.stop(), delay);
  }

  private _clearAutoStop(): void {
    if (this._intervalId !== null) {
      clearTimeout(this._intervalId);
      this._intervalId = null;
    }
  }

  private _formatRemaining(ms: number): string {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  }
}

export default new TimerService();
