import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";

const { ConnectionLogModule } = NativeModules;

const LAST_REPORT_KEY = "@netoff_last_weekly_report";
const REPORT_DATA_KEY = "@netoff_weekly_report_data";

export interface WeeklyReport {
  weekStart: string; // ISO date lundi
  weekEnd: string; // ISO date dimanche
  totalBlocked: number;
  totalAllowed: number;
  topApps: { packageName: string; appName: string; blockedCount: number }[];
  focusSessions: number;
  focusMinutes: number;
  streakDays: number; // jours consécutifs avec au moins 1 blocage
  savedMinutes: number; // estimation temps économisé
}

class WeeklyReportService {
  // ── Générer le rapport de la semaine écoulée ──────────────────────────────
  async generateReport(): Promise<WeeklyReport | null> {
    try {
      if (!ConnectionLogModule) return null;

      const stats = await ConnectionLogModule.getStats();
      const logs = await ConnectionLogModule.getLogs(1000);

      const now = new Date();
      const weekStart = this.getLastMonday(now);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Filtrer les logs de la semaine
      const weekLogs = (logs as any[]).filter((l) => {
        const ts = new Date(l.timestamp);
        return ts >= weekStart && ts <= weekEnd;
      });

      const blockedThisWeek = weekLogs.filter(
        (l) => l.action === "blocked",
      ).length;
      const allowedThisWeek = weekLogs.filter(
        (l) => l.action === "allowed",
      ).length;

      // Top apps bloquées cette semaine
      const appCounts = new Map<string, number>();
      weekLogs
        .filter((l) => l.action === "blocked")
        .forEach((l) => {
          appCounts.set(l.packageName, (appCounts.get(l.packageName) ?? 0) + 1);
        });
      const topApps = Array.from(appCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pkg, count]) => ({
          packageName: pkg,
          appName: pkg.split(".").pop() ?? pkg,
          blockedCount: count,
        }));

      // Streak — jours consécutifs (simplifié)
      const streak = this.computeStreak(weekLogs);

      // Estimation : chaque blocage = ~2 min économisées (scroll moyen)
      const savedMinutes = Math.round(blockedThisWeek * 2);

      const report: WeeklyReport = {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        totalBlocked: blockedThisWeek,
        totalAllowed: allowedThisWeek,
        topApps,
        focusSessions: 0, // TODO : lire depuis FocusModule
        focusMinutes: 0,
        streakDays: streak,
        savedMinutes,
      };

      await AsyncStorage.setItem(REPORT_DATA_KEY, JSON.stringify(report));
      await AsyncStorage.setItem(LAST_REPORT_KEY, now.toISOString());
      return report;
    } catch (e) {
      console.error("WeeklyReport:", e);
      return null;
    }
  }

  // ── Lire le dernier rapport sauvegardé ────────────────────────────────────
  async getLastReport(): Promise<WeeklyReport | null> {
    try {
      const raw = await AsyncStorage.getItem(REPORT_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ── Vérifier si un nouveau rapport doit être affiché ─────────────────────
  async shouldShowReport(): Promise<boolean> {
    try {
      const lastRaw = await AsyncStorage.getItem(LAST_REPORT_KEY);
      if (!lastRaw) return true;
      const last = new Date(lastRaw);
      const now = new Date();
      const diffMs = now.getTime() - last.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      // Afficher si > 7 jours ET c'est lundi
      return diffDays >= 7 && now.getDay() === 1;
    } catch {
      return false;
    }
  }

  async markReportSeen(): Promise<void> {
    await AsyncStorage.setItem(LAST_REPORT_KEY, new Date().toISOString());
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private getLastMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private computeStreak(logs: any[]): number {
    const days = new Set<string>();
    logs.forEach((l) => {
      days.add(new Date(l.timestamp).toDateString());
    });
    let streak = 0;
    const d = new Date();
    while (days.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  formatSavedTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60),
      m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
}

export default new WeeklyReportService();
