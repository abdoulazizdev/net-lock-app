import { NativeModules } from "react-native";

const { ConnectionLogModule } = NativeModules;

export interface LogEntry {
  packageName: string;
  action: "blocked" | "allowed";
  timestamp: number;
}

export interface AppLogStats {
  packageName: string;
  blockedCount: number;
  allowedCount: number;
  lastAttempt: number;
}

export interface LogSummary {
  totalBlocked: number;
  totalAllowed: number;
  totalEvents: number;
  perApp: AppLogStats[];
}

class ConnectionLogService {
  async getLogs(limit = 200): Promise<LogEntry[]> {
    if (!ConnectionLogModule) return [];
    try {
      return await ConnectionLogModule.getLogs(limit);
    } catch {
      return [];
    }
  }

  async getStats(): Promise<LogSummary> {
    if (!ConnectionLogModule) {
      return { totalBlocked: 0, totalAllowed: 0, totalEvents: 0, perApp: [] };
    }
    try {
      return await ConnectionLogModule.getStats();
    } catch {
      return { totalBlocked: 0, totalAllowed: 0, totalEvents: 0, perApp: [] };
    }
  }

  async clearLogs(): Promise<void> {
    if (!ConnectionLogModule) return;
    await ConnectionLogModule.clearLogs();
  }

  // ── Helpers d'affichage ───────────────────────────────────────────────
  formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD === 1) return "Hier";
    if (diffD < 7) return `Il y a ${diffD} jours`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  formatTimeShort(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Hier";
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  // Groupe les logs par date pour affichage en sections
  groupByDate(logs: LogEntry[]): { date: string; entries: LogEntry[] }[] {
    const groups: Map<string, LogEntry[]> = new Map();
    for (const log of logs) {
      const key = this.formatDate(log.timestamp);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }
    return Array.from(groups.entries()).map(([date, entries]) => ({
      date,
      entries,
    }));
  }
}

export default new ConnectionLogService();
