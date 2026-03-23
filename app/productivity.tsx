import ProductivityService, {
    Badge,
    ProductivityStats,
} from "@/services/productivity.service";
import { Colors, useTheme } from "@/theme";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    RefreshControl,
    StatusBar,
    StyleSheet,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Animated progress ring ───────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: score / 100,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);
  const label = ProductivityService.scoreLabel(score);
  return (
    <View style={pr.ringWrap}>
      <View style={pr.ring}>
        <Text style={pr.ringScore}>{score}</Text>
        <Text style={pr.ringUnit}>/ 100</Text>
      </View>
      <Text style={pr.ringLabel}>{label}</Text>
    </View>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  value,
  label,
  color,
  bg,
  border,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={[pr.statCard, { backgroundColor: bg, borderColor: border }]}>
      <Text style={pr.statIcon}>{icon}</Text>
      <Text style={[pr.statValue, { color }]}>{value}</Text>
      <Text style={pr.statLabel}>{label}</Text>
    </View>
  );
}

// ─── BadgeCard ────────────────────────────────────────────────────────────────
function BadgeCard({ badge }: { badge: Badge }) {
  const { t } = useTheme();
  return (
    <View
      style={[
        pr.badgeCard,
        {
          backgroundColor: badge.earned ? t.bg.card : t.bg.cardAlt,
          borderColor: badge.earned ? Colors.blue[200] : t.border.light,
          opacity: badge.earned ? 1 : 0.45,
        },
      ]}
    >
      <Text style={[pr.badgeIcon, !badge.earned && { filter: undefined }]}>
        {badge.icon}
      </Text>
      <Text style={[pr.badgeName, { color: t.text.primary }]} numberOfLines={2}>
        {badge.name}
      </Text>
      {badge.earned && badge.earnedAt && (
        <Text style={[pr.badgeDate, { color: t.text.muted }]}>
          {new Date(badge.earnedAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      )}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProductivityScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [stats, setStats] = useState<ProductivityStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    load();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const load = async () => {
    const s = await ProductivityService.getStats();
    setStats(s);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  return (
    <View style={[pr.container, { backgroundColor: t.bg.page }]}>
      <StatusBar barStyle="light-content" />
      <View style={[pr.header, { paddingTop: insets.top + 14 }]}>
        <Text style={pr.headerTitle}>Productivité</Text>
        <Text style={[pr.headerSub, { color: Colors.blue[200] }]}>
          Votre progression digitale
        </Text>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[
          pr.scroll,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={t.refreshTint}
            colors={[t.refreshTint]}
          />
        }
      >
        {stats ? (
          <>
            {/* Score hebdomadaire */}
            <View
              style={[
                pr.scoreCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <ScoreRing score={stats.weeklyScore} />
              <View style={pr.scoreRight}>
                <Text style={[pr.scoreTitle, { color: t.text.primary }]}>
                  Score cette semaine
                </Text>
                <Text style={[pr.scoreSub, { color: t.text.muted }]}>
                  Basé sur vos blocages, streak et sessions Focus
                </Text>
                <View style={pr.scoreBreakdown}>
                  {[
                    {
                      label: `Streak: ${stats.currentStreak}j`,
                      color: Colors.blue[500],
                    },
                    {
                      label: `Focus: ${stats.totalFocusSessions}`,
                      color: Colors.purple[400],
                    },
                    {
                      label: `Blocages: ${stats.weeklyBlocked}`,
                      color: Colors.red[500],
                    },
                  ].map((item) => (
                    <View key={item.label} style={pr.scoreBreakdownItem}>
                      <View
                        style={[
                          pr.scoreBreakdownDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <Text
                        style={[
                          pr.scoreBreakdownLabel,
                          { color: t.text.muted },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Streak */}
            <Text style={[pr.sectionLabel, { color: t.text.muted }]}>
              STREAK
            </Text>
            <View
              style={[
                pr.streakCard,
                {
                  backgroundColor:
                    stats.currentStreak >= 7 ? Colors.red[50] : t.bg.card,
                  borderColor:
                    stats.currentStreak >= 7 ? Colors.red[100] : t.border.light,
                },
              ]}
            >
              <Text style={pr.streakBig}>
                {stats.currentStreak >= 1 ? "🔥" : "💤"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[pr.streakDays, { color: t.text.primary }]}>
                  {stats.currentStreak} jour
                  {stats.currentStreak !== 1 ? "s" : ""} de suite
                </Text>
                <Text style={[pr.streakBest, { color: t.text.muted }]}>
                  Record : {stats.longestStreak} jour
                  {stats.longestStreak !== 1 ? "s" : ""}
                </Text>
              </View>
              {stats.currentStreak >= 3 && (
                <View
                  style={[
                    pr.streakBadge,
                    {
                      backgroundColor: Colors.red[50],
                      borderColor: Colors.red[100],
                    },
                  ]}
                >
                  <Text
                    style={[pr.streakBadgeText, { color: Colors.red[500] }]}
                  >
                    En feu !
                  </Text>
                </View>
              )}
            </View>

            {/* Stats globales */}
            <Text style={[pr.sectionLabel, { color: t.text.muted }]}>
              GLOBAL
            </Text>
            <View style={pr.statsGrid}>
              <StatCard
                icon="🚫"
                value={stats.totalBlockedAllTime.toString()}
                label="Bloquées au total"
                color={t.blocked.accent}
                bg={t.blocked.bg}
                border={t.blocked.border}
              />
              <StatCard
                icon="⏱"
                value={fmt(stats.totalSavedMinutes)}
                label="Temps économisé"
                color={Colors.blue[500]}
                bg={Colors.blue[50]}
                border={Colors.blue[100]}
              />
              <StatCard
                icon="🎯"
                value={stats.totalFocusSessions.toString()}
                label="Sessions Focus"
                color={Colors.purple[400]}
                bg={Colors.purple[50]}
                border={Colors.purple[100]}
              />
              <StatCard
                icon="⏰"
                value={fmt(stats.totalFocusMinutes)}
                label="En focus total"
                color={Colors.green[500]}
                bg={Colors.green[50]}
                border={Colors.green[100]}
              />
            </View>

            {/* Badges */}
            <Text style={[pr.sectionLabel, { color: t.text.muted }]}>
              BADGES ({stats.badges.filter((b) => b.earned).length}/
              {stats.badges.length})
            </Text>
            <View style={pr.badgesGrid}>
              {stats.badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </View>

            {/* Conseil */}
            <View
              style={[
                pr.tipCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <Text style={pr.tipIcon}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={[pr.tipTitle, { color: t.text.primary }]}>
                  Prochain objectif
                </Text>
                <Text style={[pr.tipText, { color: t.text.secondary }]}>
                  {stats.currentStreak < 3
                    ? "Maintenez le blocage 3 jours de suite pour débloquer le badge '3 jours' 🔥"
                    : stats.currentStreak < 7
                      ? `Plus que ${7 - stats.currentStreak} jour${7 - stats.currentStreak !== 1 ? "s" : ""} pour le badge 'Une semaine !' ⭐`
                      : stats.totalBlockedAllTime < 1000
                        ? `${1000 - stats.totalBlockedAllTime} blocages pour le badge '1000 blocages' 💪`
                        : "Vous avez tout débloqué ! Maintenez votre discipline 🏆"}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={pr.loading}>
            <Text style={[{ color: t.text.muted, fontSize: 14 }]}>
              Chargement des statistiques…
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

function fmt(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

const pr = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: Colors.blue[600],
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
  },
  headerSub: { fontSize: 12, marginTop: 2 },
  scroll: { paddingHorizontal: 18, paddingTop: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 4,
  },

  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  ringWrap: { alignItems: "center", gap: 6 },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.blue[50],
    borderWidth: 3,
    borderColor: Colors.blue[400],
    justifyContent: "center",
    alignItems: "center",
  },
  ringScore: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.blue[600],
    letterSpacing: -1,
  },
  ringUnit: { fontSize: 9, color: Colors.blue[400], fontWeight: "600" },
  ringLabel: { fontSize: 10, fontWeight: "700", color: Colors.blue[500] },
  scoreRight: { flex: 1 },
  scoreTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  scoreSub: { fontSize: 11, lineHeight: 16, marginBottom: 10 },
  scoreBreakdown: { gap: 4 },
  scoreBreakdownItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreBreakdownDot: { width: 6, height: 6, borderRadius: 3 },
  scoreBreakdownLabel: { fontSize: 11, fontWeight: "600" },

  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 24,
  },
  streakBig: { fontSize: 36 },
  streakDays: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  streakBest: { fontSize: 12 },
  streakBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  streakBadgeText: { fontSize: 11, fontWeight: "800" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },

  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  badgeCard: {
    width: "22%",
    aspectRatio: 0.9,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeIcon: { fontSize: 22 },
  badgeName: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 12,
  },
  badgeDate: { fontSize: 8 },

  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  tipIcon: { fontSize: 20 },
  tipTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  tipText: { fontSize: 12, lineHeight: 18 },
  loading: { paddingTop: 60, alignItems: "center" },
});
