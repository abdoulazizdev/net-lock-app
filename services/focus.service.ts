import { NativeModules } from "react-native";
import StorageService from "./storage.service";

const { FocusModule } = NativeModules;

export interface FocusStatus {
  isActive: boolean;
  endTime: number;
  remainingMs: number;
  profileName: string;
  packages: string[];
  durationMinutes: number;
}

export interface FocusSession {
  durationMinutes: number;
  profileId: string | null;
  profileName: string;
  blockedPackages: string[];
  startTime: number;
  endTime: number;
}

class FocusService {
  // ── Démarrer ─────────────────────────────────────────────────────────
  async startFocus(
    durationMinutes: number,
    profileId?: string,
  ): Promise<number> {
    let packages: string[] = [];
    let profileName = "Session Focus";

    if (profileId) {
      const profiles = await StorageService.getProfiles();
      const profile = profiles.find((p) => p.id === profileId);
      if (profile) {
        profileName = profile.name;
        packages = profile.rules
          .filter((r) => r.isBlocked)
          .map((r) => r.packageName);
      }
    } else {
      // Utilise les règles globales
      const rules = await StorageService.getRules();
      packages = rules.filter((r) => r.isBlocked).map((r) => r.packageName);
    }

    const durationMs = durationMinutes * 60 * 1000;
    const endTime: number = await FocusModule.startFocus(
      durationMs,
      JSON.stringify(packages),
      profileName,
    );
    return endTime;
  }

  // ── Arrêter (force, 5s hold) ──────────────────────────────────────────
  async stopFocus(): Promise<void> {
    await FocusModule.stopFocus();
  }

  // ── Lire l'état ───────────────────────────────────────────────────────
  async getStatus(): Promise<FocusStatus> {
    const raw = await FocusModule.getFocusStatus();
    return {
      ...raw,
      packages: JSON.parse(raw.packages || "[]"),
    };
  }

  // ── Formater le temps restant ─────────────────────────────────────────
  formatRemaining(ms: number): string {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // ── Durées prédéfinies ────────────────────────────────────────────────
  get presets() {
    return [
      { label: "25 min", value: 25, icon: "🍅", desc: "Pomodoro" },
      { label: "45 min", value: 45, icon: "📚", desc: "Étude" },
      { label: "1h", value: 60, icon: "💼", desc: "Travail" },
      { label: "2h", value: 120, icon: "🔥", desc: "Deep work" },
      { label: "4h", value: 240, icon: "⚡", desc: "Sprint" },
    ];
  }
}

export default new FocusService();
