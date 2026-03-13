import AppListService from "@/services/app-list.service";
import ConnectionLogService, {
  AppLogStats,
  LogEntry,
  LogSummary,
} from "@/services/connection-log.service";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tab = "overview" | "history" | "apps";

interface LogEntryWithName extends LogEntry {
  appName?: string;
}
interface AppStatWithName extends AppLogStats {
  appName?: string;
}

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
  const [appNames, setAppNames] = useState<Map<string, string>>(new Map());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(tabAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(tabAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        ConnectionLogService.getStats(),
        ConnectionLogService.getLogs(300),
      ]);
      setSummary(s);

      // Charger les noms d'apps en arrière-plan
      const pkgs = [
        ...new Set([
          ...l.map((e) => e.packageName),
          ...s.perApp.map((a) => a.packageName),
        ]),
      ];
      resolveAppNames(pkgs).then((names) => {
        setAppNames(names);
        setLogs(l.map((e) => ({ ...e, appName: names.get(e.packageName) })));
        setAppStats(
          s.perApp.map((a) => ({ ...a, appName: names.get(a.packageName) })),
        );
      });

      setLogs(l);
      setAppStats(s.perApp);
    } finally {
      setLoading(false);
    }
  };

  const resolveAppNames = async (
    pkgs: string[],
  ): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    await Promise.all(
      pkgs.map(async (pkg) => {
        try {
          const app = await AppListService.getAppByPackage(pkg);
          if (app) map.set(pkg, app.appName);
        } catch {}
      }),
    );
    return map;
  };

  const handleClearLogs = () => {
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
  };

  const displayName = (pkg: string, name?: string) =>
    name || pkg.split(".").slice(-1)[0];

  // ── Overview ──────────────────────────────────────────────────────────
  const OverviewTab = () => {
    const blockedPct =
      summary.totalEvents > 0
        ? Math.round((summary.totalBlocked / summary.totalEvents) * 100)
        : 0;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Compteurs principaux */}
        <View style={s.statsGrid}>
          <View style={[s.statBig, s.statBigBlocked]}>
            <Text style={s.statBigNum}>{summary.totalBlocked}</Text>
            <Text style={s.statBigLabel}>Tentatives bloquées</Text>
            <View style={s.statBigBar}>
              <View
                style={[
                  s.statBigFill,
                  { width: `${blockedPct}%`, backgroundColor: "#D04070" },
                ]}
              />
            </View>
            <Text style={s.statBigPct}>{blockedPct}% du total</Text>
          </View>
          <View style={[s.statBig, s.statBigAllowed]}>
            <Text style={[s.statBigNum, { color: "#3DDB8A" }]}>
              {summary.totalAllowed}
            </Text>
            <Text style={s.statBigLabel}>Connexions autorisées</Text>
            <View style={s.statBigBar}>
              <View
                style={[
                  s.statBigFill,
                  { width: `${100 - blockedPct}%`, backgroundColor: "#3DDB8A" },
                ]}
              />
            </View>
            <Text style={[s.statBigPct, { color: "#3DDB8A" }]}>
              {100 - blockedPct}% du total
            </Text>
          </View>
        </View>

        {/* Total */}
        <View style={s.totalCard}>
          <Text style={s.totalNum}>{summary.totalEvents}</Text>
          <Text style={s.totalLabel}>événements enregistrés</Text>
        </View>

        {/* Top apps bloquées */}
        {appStats.length > 0 && (
          <>
            <Text style={s.sectionLabel}>TOP APPS BLOQUÉES</Text>
            {appStats.slice(0, 5).map((app, i) => {
              const total = app.blockedCount + app.allowedCount;
              const pct =
                total > 0 ? Math.round((app.blockedCount / total) * 100) : 0;
              return (
                <View key={app.packageName} style={s.topAppRow}>
                  <View style={s.topRank}>
                    <Text style={s.topRankText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.topAppHeader}>
                      <Text style={s.topAppName} numberOfLines={1}>
                        {displayName(app.packageName, app.appName)}
                      </Text>
                      <Text style={s.topAppBlocked}>
                        {app.blockedCount} bloquées
                      </Text>
                    </View>
                    <View style={s.topBar}>
                      <View style={[s.topBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={s.topAppPkg} numberOfLines={1}>
                      {app.packageName}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {summary.totalEvents === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📊</Text>
            <Text style={s.emptyTitle}>Aucun événement</Text>
            <Text style={s.emptySub}>
              L'historique se remplit automatiquement dès que le VPN est actif
              et que des règles sont configurées.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ── History ───────────────────────────────────────────────────────────
  const grouped = ConnectionLogService.groupByDate(logs);

  const HistoryTab = () => (
    <FlatList
      data={grouped}
      keyExtractor={(item) => item.date}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyTitle}>Aucun historique</Text>
          <Text style={s.emptySub}>
            Les tentatives de connexion apparaîtront ici une fois le VPN actif.
          </Text>
        </View>
      }
      renderItem={({ item: group }) => (
        <View>
          <Text style={s.dateLabel}>{group.date}</Text>
          {group.entries.map((entry, i) => {
            const blocked = entry.action === "blocked";
            return (
              <View
                key={`${entry.packageName}-${entry.timestamp}-${i}`}
                style={s.logRow}
              >
                <View
                  style={[
                    s.logDot,
                    { backgroundColor: blocked ? "#D04070" : "#3DDB8A" },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.logAppName} numberOfLines={1}>
                    {displayName(entry.packageName, entry.appName)}
                  </Text>
                  <Text style={s.logPkg} numberOfLines={1}>
                    {entry.packageName}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View
                    style={[
                      s.logBadge,
                      blocked ? s.logBadgeBlocked : s.logBadgeAllowed,
                    ]}
                  >
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
  );

  // ── Apps tab ──────────────────────────────────────────────────────────
  const AppsTab = () => (
    <FlatList
      data={appStats}
      keyExtractor={(item) => item.packageName}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📱</Text>
          <Text style={s.emptyTitle}>Aucune donnée par app</Text>
          <Text style={s.emptySub}>
            Les statistiques par application s'accumuleront ici.
          </Text>
        </View>
      }
      renderItem={({ item: app }) => {
        const total = app.blockedCount + app.allowedCount;
        const pct =
          total > 0 ? Math.round((app.blockedCount / total) * 100) : 0;
        return (
          <View style={s.appStatCard}>
            <View style={s.appStatHeader}>
              <View style={s.appStatIcon}>
                <Text style={s.appStatIconText}>
                  {displayName(app.packageName, app.appName)
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.appStatName} numberOfLines={1}>
                  {displayName(app.packageName, app.appName)}
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
              <View style={s.appStatCount}>
                <Text style={[s.appStatCountNum, { color: "#3DDB8A" }]}>
                  {app.allowedCount}
                </Text>
                <Text style={s.appStatCountLabel}>autorisées</Text>
              </View>
              <View style={s.appStatCount}>
                <Text style={s.appStatCountNum}>{total}</Text>
                <Text style={s.appStatCountLabel}>total</Text>
              </View>
            </View>
            {/* Barre de ratio bloqué/autorisé */}
            <View style={s.appStatBar}>
              <View
                style={[s.appStatFillBlocked, { flex: app.blockedCount }]}
              />
              <View
                style={[s.appStatFillAllowed, { flex: app.allowedCount }]}
              />
            </View>
            <Text style={s.appStatPct}>{pct}% de tentatives bloquées</Text>
          </View>
        );
      }}
    />
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
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
              <Text style={s.clearBtnText}>🗑</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(
            [
              ["overview", "Vue d'ensemble"],
              ["history", "Historique"],
              ["apps", "Par app"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[s.tab, tab === key && s.tabActive]}
              onPress={() => setTab(key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, tab === key && s.tabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Animated.View style={[{ flex: 1, opacity: tabAnim }, s.content]}>
        {tab === "overview" && <OverviewTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "apps" && <AppsTab />}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
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
  clearBtnText: { fontSize: 16 },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },

  // Tabs
  tabs: { flexDirection: "row", gap: 6, marginBottom: 0, paddingBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3A3A58",
    letterSpacing: 0.3,
  },
  tabTextActive: { color: "#9B8FFF" },

  // Overview
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statBig: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16 },
  statBigBlocked: { backgroundColor: "#0E0A0C", borderColor: "#251520" },
  statBigAllowed: { backgroundColor: "#0A0E0C", borderColor: "#152518" },
  statBigNum: {
    fontSize: 32,
    fontWeight: "800",
    color: "#D04070",
    marginBottom: 4,
    letterSpacing: -1,
  },
  statBigLabel: {
    fontSize: 10,
    color: "#3A3A58",
    fontWeight: "600",
    marginBottom: 10,
  },
  statBigBar: {
    height: 3,
    backgroundColor: "#1C1C2C",
    borderRadius: 2,
    marginBottom: 6,
  },
  statBigFill: { height: 3, borderRadius: 2 },
  statBigPct: { fontSize: 10, color: "#D04070", fontWeight: "700" },
  totalCard: {
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  totalNum: {
    fontSize: 40,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -2,
  },
  totalLabel: {
    fontSize: 12,
    color: "#3A3A58",
    marginTop: 4,
    fontWeight: "600",
  },
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
    marginBottom: 12,
  },
  topRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  topRankText: { fontSize: 12, fontWeight: "800", color: "#3A3A58" },
  topAppHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  topAppName: { fontSize: 13, fontWeight: "700", color: "#E8E8F8", flex: 1 },
  topAppBlocked: { fontSize: 12, color: "#D04070", fontWeight: "700" },
  topBar: {
    height: 4,
    backgroundColor: "#1C1C2C",
    borderRadius: 2,
    marginBottom: 4,
  },
  topBarFill: { height: 4, backgroundColor: "#D04070", borderRadius: 2 },
  topAppPkg: { fontSize: 9, color: "#2E2E48" },

  // History
  dateLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 8,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 12,
    marginBottom: 6,
  },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logAppName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E8E8F8",
    marginBottom: 2,
  },
  logPkg: { fontSize: 10, color: "#2E2E48" },
  logBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  logBadgeBlocked: { backgroundColor: "#14080A", borderColor: "#2A1520" },
  logBadgeAllowed: { backgroundColor: "#0A140A", borderColor: "#1A3A1A" },
  logBadgeText: { fontSize: 10, fontWeight: "700" },
  logTime: { fontSize: 10, color: "#2E2E48" },

  // Apps
  appStatCard: {
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 16,
    marginBottom: 10,
  },
  appStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  appStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#16161E",
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
  appStatPkg: { fontSize: 10, color: "#2E2E48" },
  appStatLast: { fontSize: 10, color: "#3A3A58" },
  appStatCounts: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  appStatCount: { alignItems: "center" },
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

  // Empty
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
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
