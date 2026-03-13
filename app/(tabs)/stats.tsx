import AppListService from "@/services/app-list.service";
import ConnectionLogService, {
  AppLogStats,
  LogEntry,
  LogSummary,
} from "@/services/connection-log.service";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types enrichis (nom résolu en local, jamais sur LogEntry) ────────────────
type Tab = "overview" | "history" | "apps";

interface LogEntryWithName extends LogEntry {
  appName: string; // toujours défini après résolution
}
interface AppStatWithName extends AppLogStats {
  appName: string;
}

// ─── Animated progress bar ────────────────────────────────────────────────────
function ProgressBar({
  pct,
  color,
  trackColor = "#1C1C2C",
  height = 4,
}: {
  pct: number;
  color: string;
  trackColor?: string;
  height?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct / 100,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  return (
    <View
      style={[
        pb.track,
        { backgroundColor: trackColor, height, borderRadius: height },
      ]}
    >
      <Animated.View
        style={[
          pb.fill,
          { width, backgroundColor: color, height, borderRadius: height },
        ]}
      />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
  fill: {},
});

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Vue d'ensemble", icon: "◈" },
  { key: "history", label: "Historique", icon: "◷" },
  { key: "apps", label: "Par app", icon: "◎" },
];

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<LogSummary>({
    totalBlocked: 0,
    totalAllowed: 0,
    totalEvents: 0,
    perApp: [],
  });
  const [logs, setLogs] = useState<LogEntryWithName[]>([]);
  const [appStats, setAppStats] = useState<AppStatWithName[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadAll();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Tab cross-fade
  const switchTab = useCallback((next: Tab) => {
    Animated.sequence([
      Animated.timing(tabAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(tabAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setTab(next);
  }, []);

  // ── Résolution des noms d'apps ──────────────────────────────────────────
  const resolveAppNames = async (
    pkgs: string[],
  ): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    await Promise.all(
      pkgs.map(async (pkg) => {
        try {
          const app = await AppListService.getAppByPackage(pkg);
          if (app?.appName) map.set(pkg, app.appName);
        } catch {}
      }),
    );
    return map;
  };

  const displayName = useCallback(
    (pkg: string, name?: string) => name || pkg.split(".").slice(-1)[0] || pkg,
    [],
  );

  // ── Chargement ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        ConnectionLogService.getStats(),
        ConnectionLogService.getLogs(300),
      ]);
      setSummary(s);
      // Affichage immédiat sans noms
      setLogs(l.map((e) => ({ ...e, appName: displayName(e.packageName) })));
      setAppStats(
        s.perApp.map((a) => ({ ...a, appName: displayName(a.packageName) })),
      );
      // Résolution en arrière-plan
      const pkgs = [
        ...new Set([
          ...l.map((e) => e.packageName),
          ...s.perApp.map((a) => a.packageName),
        ]),
      ];
      resolveAppNames(pkgs).then((names) => {
        setLogs(
          l.map((e) => ({
            ...e,
            appName: names.get(e.packageName) ?? displayName(e.packageName),
          })),
        );
        setAppStats(
          s.perApp.map((a) => ({
            ...a,
            appName: names.get(a.packageName) ?? displayName(a.packageName),
          })),
        );
      });
    } finally {
      setLoading(false);
    }
  }, [displayName]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleClearLogs = useCallback(() => {
    Alert.alert(
      "Effacer l'historique ?",
      "Toutes les entrées de connexion seront supprimées. Action irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: async () => {
            await ConnectionLogService.clearLogs();
            loadAll();
          },
        },
      ],
    );
  }, [loadAll]);

  const grouped = useMemo(() => ConnectionLogService.groupByDate(logs), [logs]);

  // ────────────────────────────────────────────────────────────────────────────
  // ── Overview Tab
  // ────────────────────────────────────────────────────────────────────────────
  const OverviewTab = useCallback(() => {
    const blockedPct =
      summary.totalEvents > 0
        ? Math.round((summary.totalBlocked / summary.totalEvents) * 100)
        : 0;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B6EF6"
            colors={["#7B6EF6"]}
            progressBackgroundColor="#0E0E18"
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {summary.totalEvents === 0 ? (
          <EmptyState
            icon="◈"
            title="Aucun événement"
            sub="L'historique se remplit automatiquement dès que le VPN est actif et que des règles sont configurées."
          />
        ) : (
          <>
            {/* ── Big counters */}
            <View style={s.statsGrid}>
              <View style={[s.statBig, s.statBigBlocked]}>
                <View style={s.statBigAccent} />
                <Text style={[s.statBigNum, { color: "#D04070" }]}>
                  {summary.totalBlocked}
                </Text>
                <Text style={s.statBigLabel}>Bloquées</Text>
                <ProgressBar
                  pct={blockedPct}
                  color="#D04070"
                  trackColor="#2A0E16"
                />
                <Text style={[s.statBigPct, { color: "#D04070" }]}>
                  {blockedPct}%
                </Text>
              </View>
              <View style={[s.statBig, s.statBigAllowed]}>
                <View
                  style={[s.statBigAccent, { backgroundColor: "#3DDB8A" }]}
                />
                <Text style={[s.statBigNum, { color: "#3DDB8A" }]}>
                  {summary.totalAllowed}
                </Text>
                <Text style={s.statBigLabel}>Autorisées</Text>
                <ProgressBar
                  pct={100 - blockedPct}
                  color="#3DDB8A"
                  trackColor="#0A1E14"
                />
                <Text style={[s.statBigPct, { color: "#3DDB8A" }]}>
                  {100 - blockedPct}%
                </Text>
              </View>
            </View>

            {/* ── Total */}
            <View style={s.totalCard}>
              <View style={s.totalLeft}>
                <Text style={s.totalNum}>{summary.totalEvents}</Text>
                <Text style={s.totalLabel}>événements enregistrés</Text>
              </View>
              <View style={s.totalRight}>
                {/* Split bar */}
                <View style={s.splitBar}>
                  <View
                    style={[
                      s.splitFill,
                      {
                        flex: summary.totalBlocked,
                        backgroundColor: "#D04070",
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.splitFill,
                      {
                        flex: summary.totalAllowed,
                        backgroundColor: "#3DDB8A",
                      },
                    ]}
                  />
                </View>
                <Text style={s.splitLabel}>{blockedPct}% bloquées</Text>
              </View>
            </View>

            {/* ── Top 5 */}
            {appStats.length > 0 && (
              <>
                <Text style={s.sectionLabel}>TOP APPS BLOQUÉES</Text>
                {appStats
                  .slice()
                  .sort((a, b) => b.blockedCount - a.blockedCount)
                  .slice(0, 5)
                  .map((app, i) => {
                    const total = app.blockedCount + app.allowedCount;
                    const pct =
                      total > 0
                        ? Math.round((app.blockedCount / total) * 100)
                        : 0;
                    return (
                      <View key={app.packageName} style={s.topAppRow}>
                        <View style={s.topRank}>
                          <Text style={s.topRankText}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.topAppHeader}>
                            <Text style={s.topAppName} numberOfLines={1}>
                              {app.appName}
                            </Text>
                            <Text style={s.topAppBlocked}>
                              {app.blockedCount} bloquées
                            </Text>
                          </View>
                          <ProgressBar
                            pct={pct}
                            color="#D04070"
                            trackColor="#1C1C2C"
                            height={3}
                          />
                          <Text style={s.topAppPkg} numberOfLines={1}>
                            {app.packageName}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  }, [summary, appStats, refreshing, insets]);

  // ────────────────────────────────────────────────────────────────────────────
  // ── History Tab
  // ────────────────────────────────────────────────────────────────────────────
  const HistoryTab = useCallback(
    () => (
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B6EF6"
            colors={["#7B6EF6"]}
            progressBackgroundColor="#0E0E18"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="◷"
            title="Aucun historique"
            sub="Les tentatives de connexion apparaîtront ici une fois le VPN actif."
          />
        }
        renderItem={({ item: group }) => (
          <View>
            <Text style={s.dateLabel}>{group.date}</Text>
            {(group.entries as LogEntryWithName[]).map((entry, i) => {
              const blocked = entry.action === "blocked";
              return (
                <View
                  key={`${entry.packageName}-${entry.timestamp}-${i}`}
                  style={s.logRow}
                >
                  {/* Accent bar */}
                  <View
                    style={[
                      s.logAccent,
                      { backgroundColor: blocked ? "#D04070" : "#3DDB8A" },
                    ]}
                  />
                  <View style={{ flex: 1, paddingLeft: 4 }}>
                    <Text style={s.logAppName} numberOfLines={1}>
                      {entry.appName}
                    </Text>
                    <Text style={s.logPkg} numberOfLines={1}>
                      {entry.packageName}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View
                      style={[
                        s.logBadge,
                        blocked ? s.logBadgeBlocked : s.logBadgeAllowed,
                      ]}
                    >
                      <View
                        style={[
                          s.logBadgeDot,
                          { backgroundColor: blocked ? "#D04070" : "#3DDB8A" },
                        ]}
                      />
                      <Text
                        style={[
                          s.logBadgeText,
                          { color: blocked ? "#D04070" : "#3DDB8A" },
                        ]}
                      >
                        {blocked ? "Bloqué" : "Autorisé"}
                      </Text>
                    </View>
                    <Text style={s.logTime}>
                      {ConnectionLogService.formatTimeShort(entry.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      />
    ),
    [grouped, refreshing, insets],
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ── Apps Tab
  // ────────────────────────────────────────────────────────────────────────────
  const AppsTab = useCallback(
    () => (
      <FlatList
        data={appStats
          .slice()
          .sort(
            (a, b) =>
              b.blockedCount +
              b.allowedCount -
              (a.blockedCount + a.allowedCount),
          )}
        keyExtractor={(item) => item.packageName}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B6EF6"
            colors={["#7B6EF6"]}
            progressBackgroundColor="#0E0E18"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="◎"
            title="Aucune donnée par app"
            sub="Les statistiques par application s'accumuleront ici."
          />
        }
        renderItem={({ item: app }) => {
          const total = app.blockedCount + app.allowedCount;
          const pct =
            total > 0 ? Math.round((app.blockedCount / total) * 100) : 0;
          return (
            <View style={s.appStatCard}>
              {/* Accent bar left */}
              <View
                style={[
                  s.appStatAccent,
                  { backgroundColor: pct > 50 ? "#D04070" : "#3DDB8A" },
                ]}
              />
              <View style={s.appStatHeader}>
                <View style={s.appStatIcon}>
                  <Text style={s.appStatIconText}>
                    {app.appName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.appStatName} numberOfLines={1}>
                    {app.appName}
                  </Text>
                  <Text style={s.appStatPkg} numberOfLines={1}>
                    {app.packageName}
                  </Text>
                </View>
                <Text style={s.appStatLast}>
                  {ConnectionLogService.formatTime(app.lastAttempt)}
                </Text>
              </View>
              <View style={s.appStatCounts}>
                <View style={s.appStatCount}>
                  <Text style={[s.appStatCountNum, { color: "#D04070" }]}>
                    {app.blockedCount}
                  </Text>
                  <Text style={s.appStatCountLabel}>bloquées</Text>
                </View>
                <View style={s.appStatDivider} />
                <View style={s.appStatCount}>
                  <Text style={[s.appStatCountNum, { color: "#3DDB8A" }]}>
                    {app.allowedCount}
                  </Text>
                  <Text style={s.appStatCountLabel}>autorisées</Text>
                </View>
                <View style={s.appStatDivider} />
                <View style={s.appStatCount}>
                  <Text style={s.appStatCountNum}>{total}</Text>
                  <Text style={s.appStatCountLabel}>total</Text>
                </View>
              </View>
              {/* Split bar bloqué / autorisé */}
              <View style={s.appStatBar}>
                <View
                  style={[
                    s.appStatFillBlocked,
                    { flex: app.blockedCount || 0.001 },
                  ]}
                />
                <View
                  style={[
                    s.appStatFillAllowed,
                    { flex: app.allowedCount || 0.001 },
                  ]}
                />
              </View>
              <Text style={s.appStatPct}>{pct}% de tentatives bloquées</Text>
            </View>
          );
        }}
      />
    ),
    [appStats, refreshing, insets],
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ── Render
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* Header */}
      <Animated.View
        style={[s.header, { paddingTop: insets.top + 12, opacity: fadeAnim }]}
      >
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Statistiques</Text>
            <Text style={s.headerSub}>
              {summary.totalEvents > 0
                ? `${summary.totalEvents} événements • ${summary.totalBlocked} bloqués`
                : "Aucun événement enregistré"}
            </Text>
          </View>
          {summary.totalEvents > 0 && (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={handleClearLogs}
              activeOpacity={0.8}
            >
              <Text style={s.clearBtnText}>⌫</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab bar */}
        <View style={s.tabs}>
          {TABS.map(({ key, label, icon }) => (
            <TouchableOpacity
              key={key}
              style={[s.tab, tab === key && s.tabActive]}
              onPress={() => switchTab(key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabIcon, tab === key && s.tabIconActive]}>
                {icon}
              </Text>
              <Text style={[s.tabText, tab === key && s.tabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.View style={[s.content, { opacity: tabAnim }]}>
        {tab === "overview" && <OverviewTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "apps" && <AppsTab />}
      </Animated.View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIconWrap}>
        <Text style={s.emptyIconText}>{icon}</Text>
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  // Header
  header: {
    paddingHorizontal: 22,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
  },
  headerSub: {
    fontSize: 11,
    color: "#3A3A58",
    marginTop: 3,
    fontWeight: "500",
  },
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#14080A",
    borderWidth: 1,
    borderColor: "#2A1520",
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 16, color: "#D04070" },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },

  // Tabs
  tabs: { flexDirection: "row", gap: 6, paddingBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    alignItems: "center",
    gap: 2,
  },
  tabActive: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  tabIcon: { fontSize: 13, color: "#2E2E48" },
  tabIconActive: { color: "#7B6EF6" },
  tabText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3A3A58",
    letterSpacing: 0.2,
  },
  tabTextActive: { color: "#9B8FFF" },

  // Overview — big counters
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statBig: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  statBigBlocked: { backgroundColor: "#0E0A0C", borderColor: "#251520" },
  statBigAllowed: { backgroundColor: "#0A0E0C", borderColor: "#152518" },
  statBigAccent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
    backgroundColor: "#D04070",
  },
  statBigNum: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 3,
  },
  statBigLabel: {
    fontSize: 10,
    color: "#3A3A58",
    fontWeight: "600",
    marginBottom: 8,
  },
  statBigPct: { fontSize: 10, fontWeight: "700", marginTop: 4 },

  // Total card
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 16,
    marginBottom: 22,
  },
  totalLeft: {},
  totalNum: {
    fontSize: 36,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
  },
  totalLabel: {
    fontSize: 11,
    color: "#3A3A58",
    marginTop: 2,
    fontWeight: "500",
  },
  totalRight: { alignItems: "flex-end", gap: 6 },
  splitBar: {
    flexDirection: "row",
    height: 5,
    width: 80,
    borderRadius: 3,
    overflow: "hidden",
  },
  splitFill: { height: 5 },
  splitLabel: { fontSize: 10, color: "#5A5A80", fontWeight: "600" },

  // Top apps
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 12,
  },
  topAppRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  topRank: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  topRankText: { fontSize: 11, fontWeight: "800", color: "#3A3A58" },
  topAppHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  topAppName: { fontSize: 13, fontWeight: "700", color: "#E8E8F8", flex: 1 },
  topAppBlocked: { fontSize: 12, color: "#D04070", fontWeight: "700" },
  topAppPkg: { fontSize: 9, color: "#2E2E48", marginTop: 3 },

  // History
  dateLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 12,
    marginBottom: 6,
    overflow: "hidden",
  },
  logAccent: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  logAppName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E8E8F8",
    marginBottom: 2,
  },
  logPkg: { fontSize: 10, color: "#2E2E48", fontFamily: "monospace" },
  logBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  logBadgeBlocked: { backgroundColor: "#14080A", borderColor: "#2A1520" },
  logBadgeAllowed: { backgroundColor: "#0A140A", borderColor: "#1A3A1A" },
  logBadgeDot: { width: 5, height: 5, borderRadius: 3 },
  logBadgeText: { fontSize: 10, fontWeight: "700" },
  logTime: { fontSize: 10, color: "#2E2E48" },

  // App stat card
  appStatCard: {
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 16,
    marginBottom: 10,
    overflow: "hidden",
  },
  appStatAccent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  appStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  appStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#16161E",
    borderWidth: 1,
    borderColor: "#2A2A3A",
    justifyContent: "center",
    alignItems: "center",
  },
  appStatIconText: { fontSize: 17, fontWeight: "700", color: "#5A5A80" },
  appStatName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 2,
  },
  appStatPkg: { fontSize: 10, color: "#2E2E48", fontFamily: "monospace" },
  appStatLast: { fontSize: 10, color: "#3A3A58" },
  appStatCounts: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 12,
  },
  appStatCount: { alignItems: "center", flex: 1 },
  appStatDivider: { width: 1, height: 28, backgroundColor: "#1C1C2C" },
  appStatCountNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  appStatCountLabel: {
    fontSize: 9,
    color: "#3A3A58",
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 2,
  },
  appStatBar: {
    flexDirection: "row",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  appStatFillBlocked: { backgroundColor: "#D04070" },
  appStatFillAllowed: { backgroundColor: "#3DDB8A" },
  appStatPct: { fontSize: 10, color: "#3A3A58", textAlign: "right" },

  // Empty state
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 28, color: "#7B6EF6" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3A3A58",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 12,
    color: "#2E2E48",
    textAlign: "center",
    lineHeight: 18,
  },
});
