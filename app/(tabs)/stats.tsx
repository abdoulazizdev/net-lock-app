import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import { AppStats } from "@/types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface StatWithName extends AppStats {
  appName: string;
}

// ─── Animated progress bar ────────────────────────────────────────────────────
function ProgressBar({
  pct,
  color,
  trackColor,
  height = 5,
}: {
  pct: number;
  color: string;
  trackColor: string;
  height?: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={[
        barStyles.track,
        { backgroundColor: trackColor, height, borderRadius: height },
      ]}
    >
      <Animated.View
        style={[
          barStyles.fill,
          { width, backgroundColor: color, height, borderRadius: height },
        ]}
      />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
  fill: {},
});

// ─── Stat row card ────────────────────────────────────────────────────────────
function StatCard({ stat }: { stat: StatWithName }) {
  const appTotal = stat.blockedAttempts + stat.allowedAttempts;
  const pct = appTotal > 0 ? stat.blockedAttempts / appTotal : 0;
  const initial = (stat.appName ?? "?").charAt(0).toUpperCase();

  return (
    <View style={styles.statCard}>
      <View style={styles.statRow}>
        <View style={styles.statIconWrap}>
          <Text style={styles.statIconText}>{initial}</Text>
        </View>

        <View style={styles.statMeta}>
          <Text style={styles.statAppName} numberOfLines={1}>
            {stat.appName}
          </Text>
          <Text style={styles.statPackage} numberOfLines={1}>
            {stat.packageName}
          </Text>
        </View>

        <View style={styles.statCounts}>
          <View style={styles.countChip}>
            <View style={[styles.countDot, { backgroundColor: "#D04070" }]} />
            <Text style={[styles.countText, { color: "#D04070" }]}>
              {stat.blockedAttempts}
            </Text>
          </View>
          <View style={styles.countChip}>
            <View style={[styles.countDot, { backgroundColor: "#3DDB8A" }]} />
            <Text style={[styles.countText, { color: "#3DDB8A" }]}>
              {stat.allowedAttempts}
            </Text>
          </View>
        </View>
      </View>

      <ProgressBar pct={pct} color="#D04070" trackColor="#0D2218" height={3} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<StatWithName[]>([]);
  const [totalBlocked, setTotalBlocked] = useState(0);
  const [totalAllowed, setTotalAllowed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [stats]);

  const loadStats = useCallback(async () => {
    try {
      const raw = await StorageService.getStats();
      const withNames = await Promise.all(
        raw.map(async (s) => {
          const app = await AppListService.getAppByPackage(s.packageName);
          const appName =
            app?.appName ||
            s.packageName.split(".").pop() ||
            s.packageName ||
            "?";
          return { ...s, appName };
        }),
      );
      const sorted = withNames.sort(
        (a, b) =>
          b.blockedAttempts +
          b.allowedAttempts -
          (a.blockedAttempts + a.allowedAttempts),
      );
      setStats(sorted);
      setTotalBlocked(raw.reduce((sum, s) => sum + s.blockedAttempts, 0));
      setTotalAllowed(raw.reduce((sum, s) => sum + s.allowedAttempts, 0));
    } catch (error) {
      console.error("Erreur stats:", error);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const clearStats = useCallback(async () => {
    await StorageService.clearStats();
    await loadStats();
  }, [loadStats]);

  const total = totalBlocked + totalAllowed;
  const blockedPct = total > 0 ? totalBlocked / total : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Statistiques</Text>
          <Text style={styles.headerSubtitle}>
            {stats.length} app{stats.length > 1 ? "s" : ""} tracée
            {stats.length > 1 ? "s" : ""}
          </Text>
        </View>
        {stats.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={clearStats}
            activeOpacity={0.8}
          >
            <Text style={styles.clearBtnText}>Effacer</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
        style={{ opacity: fadeAnim }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B6EF6"
            colors={["#7B6EF6"]}
            progressBackgroundColor="#0E0E18"
          />
        }
      >
        {/* ── Overview cards */}
        <Animated.View
          style={[
            styles.overviewRow,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={[styles.overviewCard, styles.cardBlocked]}>
            <Text style={[styles.overviewNum, { color: "#D04070" }]}>
              {totalBlocked}
            </Text>
            <View style={styles.overviewLabelRow}>
              <View
                style={[styles.overviewDot, { backgroundColor: "#D04070" }]}
              />
              <Text style={styles.overviewLabel}>Bloquées</Text>
            </View>
          </View>

          <View style={[styles.overviewCard, styles.cardAllowed]}>
            <Text style={[styles.overviewNum, { color: "#3DDB8A" }]}>
              {totalAllowed}
            </Text>
            <View style={styles.overviewLabelRow}>
              <View
                style={[styles.overviewDot, { backgroundColor: "#3DDB8A" }]}
              />
              <Text style={styles.overviewLabel}>Autorisées</Text>
            </View>
          </View>

          <View style={[styles.overviewCard, styles.cardTotal]}>
            <Text style={[styles.overviewNum, { color: "#9B8FFF" }]}>
              {total}
            </Text>
            <View style={styles.overviewLabelRow}>
              <View
                style={[styles.overviewDot, { backgroundColor: "#9B8FFF" }]}
              />
              <Text style={styles.overviewLabel}>Total</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Blocking rate */}
        {total > 0 && (
          <Animated.View
            style={[
              styles.rateCard,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.rateHeader}>
              <Text style={styles.rateLabel}>Taux de blocage</Text>
              <Text style={styles.rateValue}>
                {(blockedPct * 100).toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              pct={blockedPct}
              color="#D04070"
              trackColor="#0D2218"
              height={6}
            />
            <View style={styles.rateFooter}>
              <Text style={styles.rateFooterText}>
                {totalBlocked} bloquées sur {total} tentatives
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Per-app section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PAR APPLICATION</Text>

          {stats.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIconText}>◈</Text>
              </View>
              <Text style={styles.emptyTitle}>Aucune statistique</Text>
              <Text style={styles.emptySubtitle}>
                Les statistiques apparaissent lorsque le VPN est actif et que
                des connexions sont tentées.
              </Text>
            </View>
          ) : (
            stats.map((stat) => <StatCard key={stat.packageName} stat={stat} />)
          )}
        </View>

        {/* ── Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>◎</Text>
          <Text style={styles.infoText}>
            En mode simulation, utilisez "Simuler une connexion" sur la page
            d'une app pour générer des statistiques.
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  // ── Header
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#3A3A58",
    marginTop: 3,
    letterSpacing: 0.4,
    fontWeight: "500",
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#1E0E16",
    borderWidth: 1,
    borderColor: "#4A1A2A",
  },
  clearBtnText: {
    color: "#D04070",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Scroll
  scroll: { paddingHorizontal: 22, paddingTop: 18 },

  // ── Overview
  overviewRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  cardBlocked: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  cardAllowed: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  cardTotal: { backgroundColor: "#16103A", borderColor: "#4A3F8A" },
  overviewNum: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
  },
  overviewLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  overviewDot: { width: 5, height: 5, borderRadius: 3 },
  overviewLabel: {
    fontSize: 10,
    color: "#3A3A58",
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  // ── Rate card
  rateCard: {
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 24,
    gap: 10,
  },
  rateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rateLabel: { fontSize: 13, color: "#5A5A80", fontWeight: "600" },
  rateValue: {
    fontSize: 20,
    color: "#D04070",
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  rateFooter: { marginTop: 2 },
  rateFooterText: { fontSize: 11, color: "#2E2E48", fontWeight: "500" },

  // ── Section
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 12,
  },

  // ── Stat card
  statCard: {
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 14,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    gap: 10,
  },
  statRow: { flexDirection: "row", alignItems: "center" },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#16162A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#2A2A40",
  },
  statIconText: { fontSize: 15, fontWeight: "800", color: "#7B6EF6" },
  statMeta: { flex: 1 },
  statAppName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E8E8F8",
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  statPackage: { fontSize: 10, color: "#2E2E44", fontFamily: "monospace" },
  statCounts: { alignItems: "flex-end", gap: 4 },
  countChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  countDot: { width: 5, height: 5, borderRadius: 3 },
  countText: { fontSize: 12, fontWeight: "700" },

  // ── Empty
  emptyState: {
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 26, color: "#7B6EF6" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#3A3A58",
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Info banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  infoIcon: { fontSize: 14, color: "#3A3A58", marginTop: 1 },
  infoText: { flex: 1, fontSize: 12, color: "#3A3A58", lineHeight: 19 },
});
