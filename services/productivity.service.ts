import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";

const { ConnectionLogModule } = NativeModules;

const KEY_STREAK = "@netoff_streak";
const KEY_LAST_ACTIVE = "@netoff_streak_last_active";
const KEY_TOTAL_BLOCKED = "@netoff_total_blocked_all_time";
const KEY_FOCUS_LOG = "@netoff_focus_log";

export interface ProductivityStats {
  // Streak
  currentStreak: number; // jours consécutifs avec activité
  longestStreak: number;
  // Globaux
  totalBlockedAllTime: number;
  totalSavedMinutes: number; // estimation
  // Semaine
  weeklyBlocked: number;
  weeklyScore: number; // 0-100
  // Sessions Focus
  totalFocusSessions: number;
  totalFocusMinutes: number;
  // Badges
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
}

export interface FocusLogEntry {
  startedAt: string;
  durationMin: number;
  appsBlocked: number;
}

const ALL_BADGES: Omit<Badge, "earned" | "earnedAt">[] = [
  {
    id: "first_block",
    name: "Premier blocage",
    description: "Bloquez votre première app.",
    icon: "🎯",
  },
  {
    id: "rookie",
    name: "Débutant",
    description: "100 connexions bloquées.",
    icon: "🏅",
  },
  {
    id: "focused",
    name: "Concentré",
    description: "Complétez votre première session Focus.",
    icon: "🎯",
  },
  {
    id: "streak_3",
    name: "3 jours de suite",
    description: "Maintenez le blocage 3 jours consécutifs.",
    icon: "🔥",
  },
  {
    id: "streak_7",
    name: "Une semaine !",
    description: "7 jours consécutifs. Impressionnant !",
    icon: "⭐",
  },
  {
    id: "streak_30",
    name: "Un mois !",
    description: "30 jours consécutifs. Vous êtes un pro.",
    icon: "🏆",
  },
  {
    id: "thousand",
    name: "1000 blocages",
    description: "1000 connexions bloquées au total.",
    icon: "💪",
  },
  {
    id: "detox_hour",
    name: "1h de détox",
    description: "Cumulez 1 heure de sessions Focus.",
    icon: "🧘",
  },
  {
    id: "detox_day",
    name: "Journée sans distractions",
    description: "24h de sessions Focus cumulées.",
    icon: "🌟",
  },
  {
    id: "night_owl",
    name: "Discipline nocturne",
    description: "Aucune app débloquée après 22h pendant une semaine.",
    icon: "🦉",
  },
];

class ProductivityService {
  async getStats(): Promise<ProductivityStats> {
    const [streak, longestStreak, totalBlocked, focusLog] = await Promise.all([
      this.getCurrentStreak(),
      this.getLongestStreak(),
      this.getTotalBlockedAllTime(),
      this.getFocusLog(),
    ]);

    const weeklyBlocked = await this.getWeeklyBlocked();
    const totalFocusMinutes = focusLog.reduce(
      (sum, e) => sum + e.durationMin,
      0,
    );
    const weeklyScore = this.computeWeeklyScore(
      weeklyBlocked,
      streak,
      focusLog.length,
    );
    const badges = await this.computeBadges({ streak, totalBlocked, focusLog });

    return {
      currentStreak: streak,
      longestStreak,
      totalBlockedAllTime: totalBlocked,
      totalSavedMinutes: Math.round(totalBlocked * 1.8), // ~1.8 min par blocage
      weeklyBlocked,
      weeklyScore,
      totalFocusSessions: focusLog.length,
      totalFocusMinutes,
      badges,
    };
  }

  // ── Streak ────────────────────────────────────────────────────────────────
  async updateStreak(): Promise<void> {
    const today = new Date().toDateString();
    const lastRaw = await AsyncStorage.getItem(KEY_LAST_ACTIVE);

    if (lastRaw === today) return; // Déjà mis à jour aujourd'hui

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let streak = parseInt((await AsyncStorage.getItem(KEY_STREAK)) ?? "0", 10);

    if (lastRaw === yesterday.toDateString()) {
      // Hier → on continue le streak
      streak++;
    } else if (lastRaw !== null) {
      // On a raté un jour → reset
      streak = 1;
    } else {
      streak = 1;
    }

    const longest = Math.max(
      streak,
      parseInt(
        (await AsyncStorage.getItem("@netoff_longest_streak")) ?? "0",
        10,
      ),
    );

    await AsyncStorage.multiSet([
      [KEY_STREAK, streak.toString()],
      [KEY_LAST_ACTIVE, today],
      ["@netoff_longest_streak", longest.toString()],
    ]);
  }

  async getCurrentStreak(): Promise<number> {
    return parseInt((await AsyncStorage.getItem(KEY_STREAK)) ?? "0", 10);
  }

  async getLongestStreak(): Promise<number> {
    return parseInt(
      (await AsyncStorage.getItem("@netoff_longest_streak")) ?? "0",
      10,
    );
  }

  // ── Compteurs ─────────────────────────────────────────────────────────────
  async incrementTotalBlocked(count: number): Promise<void> {
    const current = await this.getTotalBlockedAllTime();
    await AsyncStorage.setItem(KEY_TOTAL_BLOCKED, (current + count).toString());
    await this.updateStreak();
  }

  async getTotalBlockedAllTime(): Promise<number> {
    return parseInt((await AsyncStorage.getItem(KEY_TOTAL_BLOCKED)) ?? "0", 10);
  }

  async getWeeklyBlocked(): Promise<number> {
    try {
      if (!ConnectionLogModule) return 0;
      const stats = await ConnectionLogModule.getStats();
      return stats.totalBlocked ?? 0;
    } catch {
      return 0;
    }
  }

  // ── Focus log ─────────────────────────────────────────────────────────────
  async logFocusSession(
    durationMin: number,
    appsBlocked: number,
  ): Promise<void> {
    const log = await this.getFocusLog();
    log.push({ startedAt: new Date().toISOString(), durationMin, appsBlocked });
    // Garder seulement les 100 dernières sessions
    const trimmed = log.slice(-100);
    await AsyncStorage.setItem(KEY_FOCUS_LOG, JSON.stringify(trimmed));
  }

  async getFocusLog(): Promise<FocusLogEntry[]> {
    const raw = await AsyncStorage.getItem(KEY_FOCUS_LOG);
    return raw ? JSON.parse(raw) : [];
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  private computeWeeklyScore(
    blocked: number,
    streak: number,
    focusSessions: number,
  ): number {
    let score = 0;
    if (blocked > 0) score += Math.min(40, (blocked / 100) * 40); // max 40 pts
    if (streak >= 7) score += 30;
    else if (streak >= 3) score += 20;
    else if (streak >= 1) score += 10;
    if (focusSessions >= 5) score += 30;
    else if (focusSessions >= 2) score += 20;
    else if (focusSessions >= 1) score += 10;
    return Math.min(100, Math.round(score));
  }

  // ── Badges ────────────────────────────────────────────────────────────────
  async computeBadges(stats: {
    streak: number;
    totalBlocked: number;
    focusLog: FocusLogEntry[];
  }): Promise<Badge[]> {
    const earnedRaw = await AsyncStorage.getItem("@netoff_badges_earned");
    const earned: Record<string, string> = earnedRaw
      ? JSON.parse(earnedRaw)
      : {};

    const totalFocusMin = stats.focusLog.reduce(
      (sum, e) => sum + e.durationMin,
      0,
    );

    const conditions: Record<string, boolean> = {
      first_block: stats.totalBlocked >= 1,
      rookie: stats.totalBlocked >= 100,
      thousand: stats.totalBlocked >= 1000,
      focused: stats.focusLog.length >= 1,
      streak_3: stats.streak >= 3,
      streak_7: stats.streak >= 7,
      streak_30: stats.streak >= 30,
      detox_hour: totalFocusMin >= 60,
      detox_day: totalFocusMin >= 1440,
      night_owl: false, // TODO : calculer depuis l'historique
    };

    const newEarned = { ...earned };
    for (const [id, met] of Object.entries(conditions)) {
      if (met && !newEarned[id]) newEarned[id] = new Date().toISOString();
    }
    await AsyncStorage.setItem(
      "@netoff_badges_earned",
      JSON.stringify(newEarned),
    );

    return ALL_BADGES.map((b) => ({
      ...b,
      earned: !!newEarned[b.id],
      earnedAt: newEarned[b.id],
    }));
  }

  scoreLabel(score: number): string {
    if (score >= 90) return "Exceptionnel 🔥";
    if (score >= 70) return "Excellent 💪";
    if (score >= 50) return "Bon travail ⭐";
    if (score >= 30) return "En progression 📈";
    return "Débutant 🌱";
  }
}

export default new ProductivityService();
