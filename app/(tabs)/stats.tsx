import PaywallModal from "@/components/PaywallModal";
import { usePremium } from "@/hooks/usePremium";
import AppListService from "@/services/app-list.service";
import ConnectionLogService, {
  AppLogStats,
  LogEntry,
  LogSummary,
} from "@/services/connection-log.service";
import ProductivityService, {
  ProductivityStats,
} from "@/services/productivity.service";
import WeeklyReportService, {
  WeeklyReport,
} from "@/services/weekly-report.service";
import { Colors, Semantic, useTheme } from "@/theme";
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

type Tab = "overview" | "history" | "apps" | "productivity";

interface LogEntryWithName extends LogEntry {
  appName: string;
}
interface AppStatWithName extends AppLogStats {
  appName: string;
}

// ─── Définition des onglets avec leur accès ───────────────────────────────────
// overview     → GRATUIT  (résumé chiffré, top 5)
// productivity → GRATUIT  (streak, badges, score — viral & motivationnel)
// history      → PRO      (liste complète des événements)
// apps         → PRO      (stats détaillées par app)
const TABS: { key: Tab; label: string; icon: string; free: boolean }[] = [
  { key: "overview", label: "Résumé", icon: "◈", free: true },
  { key: "productivity", label: "Prod.", icon: "🔥", free: true },
  { key: "history", label: "Historique", icon: "◷", free: false },
  { key: "apps", label: "Par app", icon: "◎", free: false },
];

// ─── ProgressBar ──────────────────────────────────────────────────────────────
function ProgressBar({
  pct,
  color,
  trackColor,
  height = 4,
}: {
  pct: number;
  color: string;
  trackColor: string;
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
      style={{
        overflow: "hidden",
        width: "100%",
        height,
        borderRadius: height,
        backgroundColor: trackColor,
      }}
    >
      <Animated.View
        style={{ width, backgroundColor: color, height, borderRadius: height }}
      />
    </View>
  );
}

// ─── BadgeChip ────────────────────────────────────────────────────────────────
function BadgeChip({
  icon,
  name,
  earned,
}: {
  icon: string;
  name: string;
  earned: boolean;
}) {
  const { t } = useTheme();
  return (
    <View
      style={[
        pg.badgeChip,
        {
          backgroundColor: earned ? t.bg.card : t.bg.cardAlt,
          borderColor: earned ? Colors.blue[200] : t.border.light,
          opacity: earned ? 1 : 0.4,
        },
      ]}
    >
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[pg.badgeName, { color: t.text.primary }]} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

// ─── ProBlurOverlay ───────────────────────────────────────────────────────────
// Affiché par-dessus les onglets Pro quand l'utilisateur est gratuit.
// Montre un aperçu flou + CTA "Débloquer".
function ProBlurOverlay({
  tab,
  onUpgrade,
}: {
  tab: Tab;
  onUpgrade: () => void;
}) {
  const { t } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab]);

  const meta = {
    history: {
      icon: "◷",
      title: "Historique complet",
      sub: "Consultez chaque tentative de connexion bloquée ou autorisée, filtrée par date.",
      preview: [
        "14:32  Instagram  ● Bloqué",
        "14:28  TikTok  ● Bloqué",
        "13:55  Chrome  ○ Autorisé",
        "13:40  Twitter  ● Bloqué",
        "12:18  YouTube  ● Bloqué",
      ],
    },
    apps: {
      icon: "◎",
      title: "Stats par application",
      sub: "Découvrez quelles apps tentent le plus souvent d'accéder au réseau et leur taux de blocage.",
      preview: [
        "Instagram  · 184 bloquées · 92%",
        "TikTok  · 97 bloquées · 88%",
        "Twitter  · 61 bloquées · 100%",
        "YouTube  · 44 bloquées · 71%",
      ],
    },
  };

  const m = meta[tab as keyof typeof meta];
  if (!m) return null;

  return (
    <Animated.View style={[pbo.root, { opacity: fadeAnim }]}>
      {/* Aperçu fantôme — derrière le flou */}
      <View style={pbo.ghostList} pointerEvents="none">
        {m.preview.map((line, i) => (
          <View
            key={i}
            style={[
              pbo.ghostRow,
              {
                backgroundColor: t.bg.card,
                borderColor: t.border.light,
                opacity: 1 - i * 0.18,
              },
            ]}
          >
            <View
              style={[
                pbo.ghostDot,
                {
                  backgroundColor: line.includes("Bloqué")
                    ? "#f87171"
                    : "#34d399",
                },
              ]}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <View
                style={[
                  pbo.ghostBar,
                  { width: "65%", backgroundColor: t.border.normal },
                ]}
              />
              <View
                style={[
                  pbo.ghostBar,
                  { width: "40%", backgroundColor: t.border.light },
                ]}
              />
            </View>
            <View
              style={[
                pbo.ghostBadge,
                {
                  backgroundColor: line.includes("Bloqué")
                    ? "rgba(248,113,113,0.12)"
                    : "rgba(52,211,153,0.12)",
                  borderColor: line.includes("Bloqué")
                    ? "rgba(248,113,113,0.3)"
                    : "rgba(52,211,153,0.3)",
                },
              ]}
            >
              <View
                style={[
                  pbo.ghostBadgeDot,
                  {
                    backgroundColor: line.includes("Bloqué")
                      ? "#f87171"
                      : "#34d399",
                  },
                ]}
              />
              <View
                style={[
                  pbo.ghostBar,
                  {
                    width: 36,
                    backgroundColor: line.includes("Bloqué")
                      ? "rgba(248,113,113,0.4)"
                      : "rgba(52,211,153,0.4)",
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Overlay dégradé */}
      <View style={pbo.gradient} pointerEvents="none" />

      {/* Carte CTA centrale */}
      <View
        style={[
          pbo.card,
          { backgroundColor: t.bg.card, borderColor: t.border.light },
        ]}
      >
        <View
          style={[
            pbo.iconWrap,
            {
              backgroundColor: Colors.purple[50],
              borderColor: Colors.purple[100],
            },
          ]}
        >
          <Text style={{ fontSize: 24 }}>{m.icon}</Text>
        </View>

        <View
          style={[
            pbo.proBadge,
            {
              backgroundColor: Colors.purple[50],
              borderColor: Colors.purple[100],
            },
          ]}
        >
          <Text style={[pbo.proBadgeText, { color: Colors.purple[600] }]}>
            ◎ NETOFF PRO
          </Text>
        </View>

        <Text style={[pbo.cardTitle, { color: t.text.primary }]}>
          {m.title}
        </Text>
        <Text style={[pbo.cardSub, { color: t.text.secondary }]}>{m.sub}</Text>

        {/* Mini aperçu texte */}
        <View
          style={[
            pbo.previewBox,
            { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          ]}
        >
          {m.preview.slice(0, 3).map((line, i) => (
            <View key={i} style={pbo.previewRow}>
              <View
                style={[
                  pbo.previewDot,
                  {
                    backgroundColor:
                      line.includes("Bloqué") || line.includes("bloquées")
                        ? "#f87171"
                        : "#34d399",
                  },
                ]}
              />
              <Text
                style={[pbo.previewText, { color: t.text.muted }]}
                numberOfLines={1}
              >
                {line}
              </Text>
            </View>
          ))}
          <Text style={[pbo.previewMore, { color: t.text.muted }]}>
            + bien plus…
          </Text>
        </View>

        <TouchableOpacity
          style={[pbo.ctaBtn, { backgroundColor: Colors.purple[600] }]}
          onPress={onUpgrade}
          activeOpacity={0.85}
        >
          <Text style={pbo.ctaBtnText}>Débloquer avec Pro ◎</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub: string;
}) {
  const { t } = useTheme();
  return (
    <View style={s.empty}>
      <View
        style={[
          s.emptyIconWrap,
          { backgroundColor: t.bg.accent, borderColor: t.border.strong },
        ]}
      >
        <Text style={[s.emptyIconText, { color: t.text.link }]}>{icon}</Text>
      </View>
      <Text style={[s.emptyTitle, { color: t.text.secondary }]}>{title}</Text>
      <Text style={[s.emptySub, { color: t.text.muted }]}>{sub}</Text>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<LogSummary>({
    totalBlocked: 0,
    totalAllowed: 0,
    totalEvents: 0,
    perApp: [],
  });
  const [logs, setLogs] = useState<LogEntryWithName[]>([]);
  const [appStats, setAppStats] = useState<AppStatWithName[]>([]);
  const [prodStats, setProdStats] = useState<ProductivityStats | null>(null);
  const [weekReport, setWeekReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallTab, setPaywallTab] = useState<Tab | null>(null);
  const { isPremium, refresh: refreshPremium } = usePremium();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadAll();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, []);

  const switchTab = useCallback((next: Tab) => {
    Animated.sequence([
      Animated.timing(tabAnim, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(tabAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    setTab(next);
    // Si non-premium tente d'aller sur un onglet pro → on navigue quand même
    // mais on affiche le ProBlurOverlay par-dessus (voir rendu ci-dessous)
  }, []);

  const handlePaywallFromOverlay = useCallback(() => {
    setPaywallVisible(true);
  }, []);

  const displayName = useCallback(
    (pkg: string) => pkg.split(".").slice(-1)[0] || pkg,
    [],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sv, l, prod, report] = await Promise.all([
        ConnectionLogService.getStats(),
        ConnectionLogService.getLogs(300),
        ProductivityService.getStats(),
        WeeklyReportService.getLastReport(),
      ]);
      setSummary(sv);
      setLogs(l.map((e) => ({ ...e, appName: displayName(e.packageName) })));
      setAppStats(
        sv.perApp.map((a) => ({ ...a, appName: displayName(a.packageName) })),
      );
      setProdStats(prod);
      setWeekReport(report);

      const pkgs = [
        ...new Set([
          ...l.map((e) => e.packageName),
          ...sv.perApp.map((a) => a.packageName),
        ]),
      ];
      const map = new Map<string, string>();
      await Promise.all(
        pkgs.map(async (pkg) => {
          try {
            const app = await AppListService.getAppByPackage(pkg);
            if (app?.appName) map.set(pkg, app.appName);
          } catch {}
        }),
      );
      setLogs(
        l.map((e) => ({
          ...e,
          appName: map.get(e.packageName) ?? displayName(e.packageName),
        })),
      );
      setAppStats(
        sv.perApp.map((a) => ({
          ...a,
          appName: map.get(a.packageName) ?? displayName(a.packageName),
        })),
      );
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
      "Toutes les entrées seront supprimées. Action irréversible.",
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
  const rc = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={t.refreshTint}
      colors={[t.refreshTint]}
      progressBackgroundColor={t.bg.card}
    />
  );

  // ── Overview ──────────────────────────────────────────────────────────────
  const OverviewTab = useCallback(() => {
    const blockedPct =
      summary.totalEvents > 0
        ? Math.round((summary.totalBlocked / summary.totalEvents) * 100)
        : 0;
    const fmt = (min: number) =>
      min < 60
        ? `${min}min`
        : `${Math.floor(min / 60)}h${min % 60 ? (min % 60) + "m" : ""}`;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={rc}
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
            {weekReport && (
              <View
                style={[
                  s.reportCard,
                  {
                    backgroundColor: Colors.blue[50],
                    borderColor: Colors.blue[100],
                  },
                ]}
              >
                <Text style={s.reportEmoji}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.reportTitle, { color: Colors.blue[700] }]}>
                    Cette semaine
                  </Text>
                  <Text style={[s.reportSub, { color: Colors.blue[500] }]}>
                    {weekReport.totalBlocked} bloquées · ~
                    {fmt(weekReport.savedMinutes)} économisées ·{" "}
                    {weekReport.streakDays}j de streak
                  </Text>
                </View>
              </View>
            )}

            <View style={s.statsGrid}>
              {[
                {
                  num: summary.totalBlocked,
                  label: "Bloquées",
                  pct: blockedPct,
                  color: t.blocked.accent,
                  track: t.blocked.bg,
                },
                {
                  num: summary.totalAllowed,
                  label: "Autorisées",
                  pct: 100 - blockedPct,
                  color: t.allowed.accent,
                  track: t.allowed.bg,
                },
              ].map((item) => (
                <View
                  key={item.label}
                  style={[
                    s.statBig,
                    {
                      backgroundColor: item.track,
                      borderColor: t.border.light,
                    },
                  ]}
                >
                  <View
                    style={[s.statBigAccent, { backgroundColor: item.color }]}
                  />
                  <Text style={[s.statBigNum, { color: item.color }]}>
                    {item.num}
                  </Text>
                  <Text style={[s.statBigLabel, { color: t.text.muted }]}>
                    {item.label}
                  </Text>
                  <ProgressBar
                    pct={item.pct}
                    color={item.color}
                    trackColor={t.border.light}
                  />
                  <Text style={[s.statBigPct, { color: item.color }]}>
                    {item.pct}%
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={[
                s.totalCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <View>
                <Text style={[s.totalNum, { color: t.text.primary }]}>
                  {summary.totalEvents}
                </Text>
                <Text style={[s.totalLabel, { color: t.text.secondary }]}>
                  événements enregistrés
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={s.splitBar}>
                  <View
                    style={[
                      s.splitFill,
                      {
                        flex: summary.totalBlocked || 0.001,
                        backgroundColor: t.blocked.accent,
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.splitFill,
                      {
                        flex: summary.totalAllowed || 0.001,
                        backgroundColor: t.allowed.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={[s.splitLabel, { color: t.text.secondary }]}>
                  {blockedPct}% bloquées
                </Text>
              </View>
            </View>

            {appStats.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { color: t.text.muted }]}>
                  TOP APPS BLOQUÉES
                </Text>
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
                        <View
                          style={[
                            s.topRank,
                            {
                              backgroundColor: t.bg.cardAlt,
                              borderColor: t.border.light,
                            },
                          ]}
                        >
                          <Text
                            style={[s.topRankText, { color: t.text.muted }]}
                          >
                            {i + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.topAppHeader}>
                            <Text
                              style={[s.topAppName, { color: t.text.primary }]}
                              numberOfLines={1}
                            >
                              {app.appName}
                            </Text>
                            <Text
                              style={[
                                s.topAppBlocked,
                                { color: t.blocked.text },
                              ]}
                            >
                              {app.blockedCount} bloquées
                            </Text>
                          </View>
                          <ProgressBar
                            pct={pct}
                            color={t.blocked.accent}
                            trackColor={t.border.light}
                            height={3}
                          />
                          <Text
                            style={[s.topAppPkg, { color: t.text.muted }]}
                            numberOfLines={1}
                          >
                            {app.packageName}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              </>
            )}

            {/* Teaser Pro discret en bas de l'overview */}
            {!isPremium && (
              <TouchableOpacity
                style={[
                  s.proTeaser,
                  {
                    backgroundColor: Colors.purple[50],
                    borderColor: Colors.purple[100],
                  },
                ]}
                onPress={() => setPaywallVisible(true)}
                activeOpacity={0.82}
              >
                <Text style={{ fontSize: 15 }}>◎</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.proTeaserTitle, { color: Colors.purple[700] }]}
                  >
                    Historique complet & Stats par app
                  </Text>
                  <Text style={[s.proTeaserSub, { color: Colors.purple[500] }]}>
                    Passez à Pro pour débloquer ces 2 onglets
                  </Text>
                </View>
                <View
                  style={[
                    s.proTeaserBadge,
                    { backgroundColor: Colors.purple[100] },
                  ]}
                >
                  <Text
                    style={[
                      s.proTeaserBadgeText,
                      { color: Colors.purple[700] },
                    ]}
                  >
                    Pro →
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    );
  }, [summary, appStats, weekReport, refreshing, insets, t, isPremium]);

  // ── History ───────────────────────────────────────────────────────────────
  const HistoryTab = useCallback(
    () => (
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={rc}
        ListEmptyComponent={
          <EmptyState
            icon="◷"
            title="Aucun historique"
            sub="Les tentatives de connexion apparaîtront ici une fois le VPN actif."
          />
        }
        renderItem={({ item: group }) => (
          <View>
            <Text style={[s.dateLabel, { color: t.text.muted }]}>
              {group.date}
            </Text>
            {(group.entries as LogEntryWithName[]).map((entry, i) => {
              const blocked = entry.action === "blocked";
              return (
                <View
                  key={`${entry.packageName}-${entry.timestamp}-${i}`}
                  style={[
                    s.logRow,
                    { backgroundColor: t.bg.card, borderColor: t.border.light },
                  ]}
                >
                  <View
                    style={[
                      s.logAccent,
                      {
                        backgroundColor: blocked
                          ? t.blocked.accent
                          : t.allowed.accent,
                      },
                    ]}
                  />
                  <View style={{ flex: 1, paddingLeft: 4 }}>
                    <Text
                      style={[s.logAppName, { color: t.text.primary }]}
                      numberOfLines={1}
                    >
                      {entry.appName}
                    </Text>
                    <Text
                      style={[s.logPkg, { color: t.text.muted }]}
                      numberOfLines={1}
                    >
                      {entry.packageName}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View
                      style={[
                        s.logBadge,
                        {
                          backgroundColor: blocked
                            ? t.blocked.bg
                            : t.allowed.bg,
                          borderColor: blocked
                            ? t.blocked.border
                            : t.allowed.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.logBadgeDot,
                          {
                            backgroundColor: blocked
                              ? t.blocked.accent
                              : t.allowed.accent,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          s.logBadgeText,
                          { color: blocked ? t.blocked.text : t.allowed.text },
                        ]}
                      >
                        {blocked ? "Bloqué" : "Autorisé"}
                      </Text>
                    </View>
                    <Text style={[s.logTime, { color: t.text.muted }]}>
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
    [grouped, refreshing, insets, t],
  );

  // ── Apps ──────────────────────────────────────────────────────────────────
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
        refreshControl={rc}
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
            <View
              style={[
                s.appStatCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <View
                style={[
                  s.appStatAccent,
                  {
                    backgroundColor:
                      pct > 50 ? t.blocked.accent : t.allowed.accent,
                  },
                ]}
              />
              <View style={s.appStatHeader}>
                <View
                  style={[
                    s.appStatIcon,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                  ]}
                >
                  <Text style={[s.appStatIconText, { color: t.text.muted }]}>
                    {app.appName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.appStatName, { color: t.text.primary }]}
                    numberOfLines={1}
                  >
                    {app.appName}
                  </Text>
                  <Text
                    style={[s.appStatPkg, { color: t.text.muted }]}
                    numberOfLines={1}
                  >
                    {app.packageName}
                  </Text>
                </View>
                <Text style={[s.appStatLast, { color: t.text.muted }]}>
                  {ConnectionLogService.formatTime(app.lastAttempt)}
                </Text>
              </View>
              <View style={s.appStatCounts}>
                {[
                  {
                    num: app.blockedCount,
                    label: "bloquées",
                    color: t.blocked.text,
                  },
                  null,
                  {
                    num: app.allowedCount,
                    label: "autorisées",
                    color: t.allowed.text,
                  },
                  null,
                  { num: total, label: "total", color: t.text.link },
                ].map((item, i) =>
                  item === null ? (
                    <View
                      key={i}
                      style={[
                        s.appStatDivider,
                        { backgroundColor: t.border.light },
                      ]}
                    />
                  ) : (
                    <View key={i} style={s.appStatCount}>
                      <Text style={[s.appStatCountNum, { color: item.color }]}>
                        {item.num}
                      </Text>
                      <Text
                        style={[s.appStatCountLabel, { color: t.text.muted }]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  ),
                )}
              </View>
              <View style={s.appStatBar}>
                <View
                  style={[
                    s.appStatFillBlocked,
                    {
                      flex: app.blockedCount || 0.001,
                      backgroundColor: t.blocked.accent,
                    },
                  ]}
                />
                <View
                  style={[
                    s.appStatFillAllowed,
                    {
                      flex: app.allowedCount || 0.001,
                      backgroundColor: t.allowed.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[s.appStatPct, { color: t.text.muted }]}>
                {pct}% de tentatives bloquées
              </Text>
            </View>
          );
        }}
      />
    ),
    [appStats, refreshing, insets, t],
  );

  // ── Productivity ──────────────────────────────────────────────────────────
  const ProductivityTab = useCallback(() => {
    if (!prodStats)
      return (
        <EmptyState
          icon="🔥"
          title="Chargement…"
          sub="Calcul des statistiques de productivité en cours."
        />
      );
    const fmt = (min: number) =>
      min < 60
        ? `${min}min`
        : `${Math.floor(min / 60)}h${min % 60 ? (min % 60) + "" : ""}`;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={rc}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Score */}
        <View
          style={[
            pg.scoreCard,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <View style={pg.scoreRing}>
            <Text style={pg.scoreNum}>{prodStats.weeklyScore}</Text>
            <Text style={[pg.scoreLabel, { color: t.text.muted }]}>/ 100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pg.scoreTitle, { color: t.text.primary }]}>
              Score hebdomadaire
            </Text>
            <Text style={[pg.scoreSub, { color: Colors.blue[500] }]}>
              {ProductivityService.scoreLabel(prodStats.weeklyScore)}
            </Text>
            <View style={pg.scoreItems}>
              {[
                {
                  label: `Streak ${prodStats.currentStreak}j`,
                  color: Colors.blue[500],
                },
                {
                  label: `Focus ×${prodStats.totalFocusSessions}`,
                  color: Colors.purple[400],
                },
                {
                  label: `${prodStats.weeklyBlocked} bloquées`,
                  color: Colors.red[500] ?? t.blocked.accent,
                },
              ].map((item) => (
                <View key={item.label} style={pg.scoreItem}>
                  <View
                    style={[pg.scoreDot, { backgroundColor: item.color }]}
                  />
                  <Text style={[pg.scoreItemLabel, { color: t.text.muted }]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Streak */}
        <Text style={[s.sectionLabel, { color: t.text.muted }]}>STREAK</Text>
        <View
          style={[
            pg.streakCard,
            {
              backgroundColor:
                prodStats.currentStreak >= 7
                  ? (Colors.red[50] ?? t.blocked.bg)
                  : t.bg.card,
              borderColor:
                prodStats.currentStreak >= 7
                  ? t.blocked.border
                  : t.border.light,
            },
          ]}
        >
          <Text style={{ fontSize: 32 }}>
            {prodStats.currentStreak >= 1 ? "🔥" : "💤"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[pg.streakDays, { color: t.text.primary }]}>
              {prodStats.currentStreak} jour
              {prodStats.currentStreak !== 1 ? "s" : ""} de suite
            </Text>
            <Text style={[pg.streakBest, { color: t.text.muted }]}>
              Record : {prodStats.longestStreak} jour
              {prodStats.longestStreak !== 1 ? "s" : ""}
            </Text>
          </View>
          {prodStats.currentStreak >= 3 && (
            <View
              style={[
                pg.streakBadge,
                {
                  backgroundColor: t.blocked.bg,
                  borderColor: t.blocked.border,
                },
              ]}
            >
              <Text style={[pg.streakBadgeText, { color: t.blocked.accent }]}>
                En feu !
              </Text>
            </View>
          )}
        </View>

        {/* Stats globales */}
        <Text style={[s.sectionLabel, { color: t.text.muted }]}>GLOBAL</Text>
        <View style={pg.statsGrid}>
          {[
            {
              icon: "🚫",
              value: prodStats.totalBlockedAllTime.toString(),
              label: "Total bloquées",
              color: t.blocked.accent,
              bg: t.blocked.bg,
              border: t.blocked.border,
            },
            {
              icon: "⏱",
              value: fmt(prodStats.totalSavedMinutes),
              label: "Temps économisé",
              color: Colors.blue[500],
              bg: Colors.blue[50],
              border: Colors.blue[100],
            },
            {
              icon: "🎯",
              value: prodStats.totalFocusSessions.toString(),
              label: "Sessions Focus",
              color: Colors.purple[400],
              bg: Colors.purple[50],
              border: Colors.purple[100],
            },
            {
              icon: "⏰",
              value: fmt(prodStats.totalFocusMinutes),
              label: "En focus",
              color: Colors.green[500],
              bg: Colors.green[50],
              border: Colors.green[100],
            },
          ].map((item) => (
            <View
              key={item.label}
              style={[
                pg.statCard,
                { backgroundColor: item.bg, borderColor: item.border },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <Text style={[pg.statValue, { color: item.color }]}>
                {item.value}
              </Text>
              <Text style={[pg.statLabel, { color: t.text.muted }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Badges */}
        <Text style={[s.sectionLabel, { color: t.text.muted }]}>
          BADGES ({prodStats.badges.filter((b) => b.earned).length}/
          {prodStats.badges.length})
        </Text>
        <View style={pg.badgesGrid}>
          {prodStats.badges.map((badge) => (
            <BadgeChip
              key={badge.id}
              icon={badge.icon}
              name={badge.name}
              earned={badge.earned}
            />
          ))}
        </View>

        {/* Conseil */}
        <View
          style={[
            pg.tipCard,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <Text style={{ fontSize: 18 }}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={[pg.tipTitle, { color: t.text.primary }]}>
              Prochain objectif
            </Text>
            <Text style={[pg.tipText, { color: t.text.secondary }]}>
              {prodStats.currentStreak < 3
                ? "Maintenez le blocage 3 jours de suite pour le badge '3 jours' 🔥"
                : prodStats.currentStreak < 7
                  ? `Plus que ${7 - prodStats.currentStreak}j pour 'Une semaine !' ⭐`
                  : prodStats.totalBlockedAllTime < 1000
                    ? `${1000 - prodStats.totalBlockedAllTime} blocages pour '1000 blocages' 💪`
                    : "Maintenez votre discipline — vous avez tout débloqué 🏆"}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }, [prodStats, refreshing, insets, t]);

  // Détermine si l'onglet courant est verrouillé pour l'utilisateur
  const currentTabLocked = !isPremium && !TABS.find((t) => t.key === tab)?.free;

  return (
    <View style={[s.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* ── Header ── */}
      <Animated.View
        style={[s.header, { paddingTop: insets.top + 14, opacity: fadeAnim }]}
      >
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <View style={s.headerIconWrap}>
              <Text style={s.headerIconText}>◈</Text>
            </View>
            <View>
              <Text style={s.headerTitle}>Statistiques</Text>
              <Text style={s.headerSub}>
                {summary.totalEvents > 0
                  ? `${summary.totalEvents} événements · ${summary.totalBlocked} bloqués`
                  : "Aucun événement enregistré"}
              </Text>
            </View>
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

        {/* ── Tabs ── */}
        <View style={s.tabs}>
          {TABS.map(({ key, label, icon, free }) => {
            const locked = !isPremium && !free;
            const active = tab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.tab, active && s.tabActive, locked && s.tabLocked]}
                onPress={() => switchTab(key)}
                activeOpacity={0.75}
              >
                {locked && !active && (
                  <View style={s.tabLockBadge}>
                    <Text style={s.tabLockBadgeText}>PRO</Text>
                  </View>
                )}
                <Text
                  style={[
                    s.tabIcon,
                    {
                      color: active
                        ? Colors.blue[100]
                        : locked
                          ? "rgba(255,255,255,.35)"
                          : "rgba(255,255,255,.6)",
                    },
                  ]}
                >
                  {icon}
                </Text>
                <Text
                  style={[
                    s.tabText,
                    {
                      color: active
                        ? Colors.gray[0]
                        : locked
                          ? "rgba(255,255,255,.35)"
                          : "rgba(255,255,255,.5)",
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* ── Contenu ── */}
      <View style={s.contentWrapper}>
        <Animated.View style={[s.content, { opacity: tabAnim }]}>
          {tab === "overview" && <OverviewTab />}
          {tab === "history" && <HistoryTab />}
          {tab === "apps" && <AppsTab />}
          {tab === "productivity" && <ProductivityTab />}
        </Animated.View>

        {/* Overlay Pro — monté par-dessus le contenu si onglet verrouillé */}
        {currentTabLocked && (
          <ProBlurOverlay tab={tab} onUpgrade={handlePaywallFromOverlay} />
        )}
      </View>

      <PaywallModal
        visible={paywallVisible}
        reason="stats"
        onClose={() => setPaywallVisible(false)}
        onUpgraded={() => {
          refreshPremium();
          setPaywallVisible(false);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    backgroundColor: Semantic.bg.header,
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconText: { fontSize: 20, color: Colors.gray[0] },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -1,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.blue[200],
    marginTop: 2,
    fontWeight: "500",
  },
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 16, color: Colors.gray[0] },

  // Tabs
  tabs: { flexDirection: "row", gap: 4, paddingBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.15)",
    alignItems: "center",
    gap: 2,
    position: "relative",
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,.25)",
    borderColor: "rgba(255,255,255,.35)",
  },
  tabLocked: {
    backgroundColor: "rgba(255,255,255,.05)",
    borderColor: "rgba(255,255,255,.08)",
  },
  tabLockBadge: {
    position: "absolute",
    top: -5,
    right: -3,
    backgroundColor: Colors.purple[600],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tabLockBadgeText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  tabIcon: { fontSize: 12 },
  tabText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.2 },

  // Layout
  contentWrapper: { flex: 1, position: "relative" },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },

  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 12,
    marginTop: 4,
  },
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  reportEmoji: { fontSize: 24 },
  reportTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  reportSub: { fontSize: 11, lineHeight: 16 },
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statBig: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  statBigAccent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  statBigNum: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 3,
  },
  statBigLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  statBigPct: { fontSize: 10, fontWeight: "700", marginTop: 4 },
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  totalNum: { fontSize: 36, fontWeight: "800", letterSpacing: -1.5 },
  totalLabel: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  splitBar: {
    flexDirection: "row",
    height: 5,
    width: 80,
    borderRadius: 3,
    overflow: "hidden",
  },
  splitFill: { height: 5 },
  splitLabel: { fontSize: 10, fontWeight: "600" },
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topRankText: { fontSize: 11, fontWeight: "800" },
  topAppHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  topAppName: { fontSize: 13, fontWeight: "700", flex: 1 },
  topAppBlocked: { fontSize: 12, fontWeight: "700" },
  topAppPkg: { fontSize: 9, marginTop: 3 },

  // Teaser Pro dans Overview
  proTeaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
  },
  proTeaserTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  proTeaserSub: { fontSize: 11 },
  proTeaserBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  proTeaserBadgeText: { fontSize: 11, fontWeight: "800" },

  // History
  dateLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
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
  logAppName: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  logPkg: { fontSize: 10, fontFamily: "monospace" },
  logBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  logBadgeDot: { width: 5, height: 5, borderRadius: 3 },
  logBadgeText: { fontSize: 10, fontWeight: "700" },
  logTime: { fontSize: 10 },

  // Apps
  appStatCard: {
    borderRadius: 16,
    borderWidth: 1,
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  appStatIconText: { fontSize: 17, fontWeight: "700" },
  appStatName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  appStatPkg: { fontSize: 10, fontFamily: "monospace" },
  appStatLast: { fontSize: 10 },
  appStatCounts: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 12,
  },
  appStatCount: { alignItems: "center", flex: 1 },
  appStatDivider: { width: 1, height: 28 },
  appStatCountNum: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  appStatCountLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  appStatBar: {
    flexDirection: "row",
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  appStatFillBlocked: {},
  appStatFillAllowed: {},
  appStatPct: { fontSize: 10, textAlign: "right" },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 28 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  emptySub: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});

// ─── Styles ProBlurOverlay ────────────────────────────────────────────────────
const pbo = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  ghostList: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    gap: 6,
    paddingTop: 8,
  },
  ghostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  ghostDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  ghostBar: { height: 8, borderRadius: 4 },
  ghostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  ghostBadgeDot: { width: 5, height: 5, borderRadius: 2.5 },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 18,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  proBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  proBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  cardSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  previewBox: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  previewText: { fontSize: 12, fontFamily: "monospace", flex: 1 },
  previewMore: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 2,
  },
  ctaBtn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});

// ─── Styles productivité ──────────────────────────────────────────────────────
const pg = StyleSheet.create({
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  scoreRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.blue[50],
    borderWidth: 3,
    borderColor: Colors.blue[400],
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.blue[600],
    letterSpacing: -1,
  },
  scoreLabel: { fontSize: 9, fontWeight: "600" },
  scoreTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  scoreSub: { fontSize: 11, fontWeight: "700", marginBottom: 8 },
  scoreItems: { gap: 4 },
  scoreItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreDot: { width: 6, height: 6, borderRadius: 3 },
  scoreItemLabel: { fontSize: 10, fontWeight: "600" },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
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
    marginBottom: 20,
  },
  statCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  badgeChip: {
    width: "22%",
    aspectRatio: 0.85,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    alignItems: "center",
    justifyContent: "space-around",
  },
  badgeName: {
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 11,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  tipTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  tipText: { fontSize: 12, lineHeight: 18 },
});
