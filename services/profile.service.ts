/**
 * ProfileService
 *
 * Centralise toute la logique d'activation/désactivation de profil.
 * Garantit que le VPN ET les alarmes AlarmManager sont toujours synchronisés.
 *
 * Règle métier :
 *   - Si le profil n'a PAS de planification active  → blocage immédiat dès l'activation
 *   - Si le profil a des planifications             → AlarmManager gère les transitions
 *       + si on est DÉJÀ dans une fenêtre "activate" → blocage immédiat aussi
 */

import { NativeModules } from "react-native";
import { Profile, ProfileSchedule } from "../types";
import StorageService from "./storage.service";

const { VpnModule, ScheduleModule } = NativeModules;

// ─── Types internes passés au ScheduleModule natif ─────────────────────────────
interface NativeScheduleEntry {
  id: string;
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  action: "activate" | "deactivate";
  /** Packages à bloquer quand l'alarme se déclenche */
  blockedPackages: string[];
}

class ProfileService {
  // ─── Activer un profil ──────────────────────────────────────────────────────
  async activateProfile(profileId: string): Promise<void> {
    const profiles = await StorageService.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error(`Profil introuvable : ${profileId}`);

    // 1. Marquer comme profil actif dans le storage
    await StorageService.setActiveProfile(profileId);

    const activeSchedules = (profile.schedules ?? []).filter((s) => s.isActive);
    const hasActiveSchedules = activeSchedules.length > 0;

    if (!hasActiveSchedules) {
      // ── Pas de planification : blocage immédiat ────────────────────────────
      await this._applyProfileRules(profile);
      await this._syncVpn(profile);
    } else {
      // ── Avec planifications ────────────────────────────────────────────────
      // 2. Programmer les alarmes AlarmManager (avec les packages embarqués)
      await this._scheduleAlarms(profile, activeSchedules);

      // 3. Si on est DÉJÀ dans une fenêtre "activate", appliquer immédiatement
      if (this._isCurrentlyInActivateWindow(activeSchedules)) {
        await this._applyProfileRules(profile);
        await this._syncVpn(profile);
      } else {
        // Hors fenêtre → vider le VPN (sécurité)
        await this._pushToVpn([]);
      }
    }
  }

  // ─── Désactiver le profil actif ────────────────────────────────────────────
  async deactivateProfile(): Promise<void> {
    await StorageService.setActiveProfile(null);
    await StorageService.clearRules();

    // Annuler toutes les alarmes planifiées
    await this._cancelAlarms();

    // VPN : tout autoriser
    await this._pushToVpn([]);
  }

  // ─── Appeler après avoir modifié les règles / planifications d'un profil ───
  // Si le profil modifié EST le profil actif → resync complet
  async onProfileChanged(profile: Profile): Promise<void> {
    const activeProfile = await StorageService.getActiveProfile();
    if (activeProfile?.id !== profile.id) return;

    // Re-activer avec la nouvelle version (reprogramme alarmes + VPN)
    await this.activateProfile(profile.id);
  }

  // ─── Synchronisation complète (appelée par ScheduleReceiver côté natif) ────
  async syncActiveProfileNow(): Promise<void> {
    const profile = await StorageService.getActiveProfile();
    if (!profile) {
      await this._pushToVpn([]);
      return;
    }
    await this._applyProfileRules(profile);
    await this._syncVpn(profile);
  }

  // ─── Privé : vérifier si on est dans une fenêtre "activate" en ce moment ──
  private _isCurrentlyInActivateWindow(schedules: ProfileSchedule[]): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    return schedules.some((s) => {
      if (s.action !== "activate") return false;
      if (!s.days.includes(currentDay)) return false;
      const startMins = s.startHour * 60 + s.startMinute;
      const endMins = s.endHour * 60 + s.endMinute;
      return nowMins >= startMins && nowMins < endMins;
    });
  }

  // ─── Privé : programmer les alarmes avec les packages inclus ───────────────
  private async _scheduleAlarms(
    profile: Profile,
    schedules: ProfileSchedule[],
  ): Promise<void> {
    if (!ScheduleModule) {
      console.warn("[ProfileService] ScheduleModule non disponible");
      return;
    }

    const blockedPackages = (profile.rules ?? [])
      .filter((r) => r.isBlocked)
      .map((r) => r.packageName);

    // Chaque entrée embarque blockedPackages pour que ScheduleReceiver
    // sache quoi passer à VpnModule.setBlockedApps() sans relire le storage
    const nativeEntries: NativeScheduleEntry[] = schedules.map((s) => ({
      id: s.id,
      days: s.days,
      startHour: s.startHour,
      startMinute: s.startMinute,
      endHour: s.endHour,
      endMinute: s.endMinute,
      action: s.action,
      blockedPackages: s.action === "activate" ? blockedPackages : [],
    }));

    try {
      await ScheduleModule.scheduleAlarms(JSON.stringify(nativeEntries));
      console.log(
        `[ProfileService] ${nativeEntries.length} alarme(s) programmée(s)`,
      );
    } catch (e) {
      console.error("[ProfileService] Erreur scheduleAlarms:", e);
    }
  }

  // ─── Privé : annuler toutes les alarmes ────────────────────────────────────
  private async _cancelAlarms(): Promise<void> {
    if (!ScheduleModule) return;
    try {
      await ScheduleModule.scheduleAlarms(JSON.stringify([]));
      console.log("[ProfileService] Alarmes annulées");
    } catch (e) {
      console.error("[ProfileService] Erreur annulation alarmes:", e);
    }
  }

  // ─── Privé : écrire les règles du profil dans le storage global ────────────
  private async _applyProfileRules(profile: Profile): Promise<void> {
    await StorageService.clearRules();
    for (const rule of profile.rules ?? []) {
      await StorageService.saveRule({
        ...rule,
        profileId: profile.id,
        updatedAt: new Date(),
      });
    }
  }

  // ─── Privé : envoyer les packages bloqués au VPN ──────────────────────────
  private async _syncVpn(profile: Profile): Promise<void> {
    const blocked = (profile.rules ?? [])
      .filter((r) => r.isBlocked)
      .map((r) => r.packageName);
    await this._pushToVpn(blocked);
  }

  private async _pushToVpn(blockedPackages: string[]): Promise<void> {
    if (!VpnModule) {
      console.warn("[ProfileService] VpnModule non disponible — simulation");
      return;
    }
    try {
      await VpnModule.setBlockedApps(blockedPackages);
      console.log(
        `[ProfileService] VPN ← ${blockedPackages.length} app(s) bloquée(s)`,
      );
    } catch (e) {
      console.error("[ProfileService] Erreur VPN sync:", e);
    }
  }
}

export default new ProfileService();
