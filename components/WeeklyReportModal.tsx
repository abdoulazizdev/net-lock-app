import WeeklyReportService, {
    WeeklyReport,
} from "@/services/weekly-report.service";
import { Colors, useTheme } from "@/theme";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Modal,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
}

function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: string;
  label: string;
  color: string;
  icon: string;
}) {
  const { t } = useTheme();
  return (
    <View
      style={[
        wc.statCard,
        { backgroundColor: t.bg.card, borderColor: t.border.light },
      ]}
    >
      <Text style={wc.statIcon}>{icon}</Text>
      <Text style={[wc.statValue, { color }]}>{value}</Text>
      <Text style={[wc.statLabel, { color: t.text.muted }]}>{label}</Text>
    </View>
  );
}

export default function WeeklyReportModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadReport();
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 55,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadReport = async () => {
    setLoading(true);
    const r =
      (await WeeklyReportService.generateReport()) ??
      (await WeeklyReportService.getLastReport());
    setReport(r);
    setLoading(false);
  };

  const handleClose = async () => {
    await WeeklyReportService.markReportSeen();
    onClose();
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const totalEvents = (report?.totalBlocked ?? 0) + (report?.totalAllowed ?? 0);
  const blockedPct =
    totalEvents > 0
      ? Math.round(((report?.totalBlocked ?? 0) / totalEvents) * 100)
      : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[wc.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={handleClose}
        />
        <Animated.View
          style={[
            wc.sheet,
            {
              backgroundColor: t.bg.card,
              borderColor: t.border.light,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[wc.handle, { backgroundColor: t.border.normal }]} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={wc.reportHeader}>
              <View style={wc.reportHeaderLeft}>
                <Text style={wc.reportEmoji}>📊</Text>
                <View>
                  <Text style={[wc.reportTitle, { color: t.text.primary }]}>
                    Rapport hebdomadaire
                  </Text>
                  {report && (
                    <Text style={[wc.reportPeriod, { color: t.text.muted }]}>
                      {fmt(report.weekStart)} — {fmt(report.weekEnd)}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={[wc.closeBtn, { backgroundColor: t.bg.cardAlt }]}
              >
                <Text
                  style={[
                    { fontSize: 12, color: t.text.muted, fontWeight: "700" },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={wc.loadingWrap}>
                <Text style={[{ color: t.text.muted, fontSize: 14 }]}>
                  Génération du rapport…
                </Text>
              </View>
            ) : report ? (
              <>
                {/* Message de motivation */}
                <View
                  style={[
                    wc.motivBox,
                    {
                      backgroundColor: Colors.blue[50],
                      borderColor: Colors.blue[100],
                    },
                  ]}
                >
                  <Text style={wc.motivEmoji}>
                    {report.totalBlocked > 500
                      ? "🔥"
                      : report.totalBlocked > 100
                        ? "💪"
                        : "👋"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[wc.motivTitle, { color: Colors.blue[700] }]}>
                      {report.totalBlocked > 500
                        ? "Semaine exceptionnelle !"
                        : report.totalBlocked > 100
                          ? "Bonne semaine !"
                          : "Vous démarrez bien !"}
                    </Text>
                    <Text style={[wc.motivSub, { color: Colors.blue[500] }]}>
                      {report.savedMinutes > 0
                        ? `Environ ${WeeklyReportService.formatSavedTime(report.savedMinutes)} potentiellement économisées.`
                        : "Continuez à configurer vos règles pour voir vos stats."}
                    </Text>
                  </View>
                </View>

                {/* Stat cards */}
                <View style={wc.statsGrid}>
                  <StatCard
                    value={report.totalBlocked.toString()}
                    label="Connexions bloquées"
                    color={t.blocked.accent}
                    icon="🚫"
                  />
                  <StatCard
                    value={`${blockedPct}%`}
                    label="Taux de blocage"
                    color={Colors.blue[500]}
                    icon="📈"
                  />
                  <StatCard
                    value={`${report.streakDays}j`}
                    label="Streak consécutif"
                    color={Colors.green[400]}
                    icon="🔥"
                  />
                  <StatCard
                    value={WeeklyReportService.formatSavedTime(
                      report.savedMinutes,
                    )}
                    label="Temps économisé"
                    color={Colors.purple[400]}
                    icon="⏱"
                  />
                </View>

                {/* Top apps */}
                {report.topApps.length > 0 && (
                  <>
                    <Text style={[wc.sectionLabel, { color: t.text.muted }]}>
                      APPS LES PLUS BLOQUÉES
                    </Text>
                    {report.topApps.map((app, i) => {
                      const maxCount = report.topApps[0].blockedCount;
                      const pct =
                        maxCount > 0 ? app.blockedCount / maxCount : 0;
                      return (
                        <View
                          key={app.packageName}
                          style={[
                            wc.topAppRow,
                            {
                              backgroundColor: t.bg.cardAlt,
                              borderColor: t.border.light,
                            },
                          ]}
                        >
                          <View
                            style={[
                              wc.topAppRank,
                              {
                                backgroundColor:
                                  i === 0 ? Colors.blue[500] : t.bg.cardSunken,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                wc.topAppRankText,
                                { color: i === 0 ? "#fff" : t.text.muted },
                              ]}
                            >
                              {i + 1}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[wc.topAppName, { color: t.text.primary }]}
                              numberOfLines={1}
                            >
                              {app.appName}
                            </Text>
                            <View
                              style={[
                                wc.topAppBar,
                                { backgroundColor: t.border.light },
                              ]}
                            >
                              <View
                                style={[
                                  wc.topAppBarFill,
                                  {
                                    backgroundColor: t.blocked.accent,
                                    width: `${pct * 100}%` as any,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                          <Text
                            style={[
                              wc.topAppCount,
                              { color: t.blocked.accent },
                            ]}
                          >
                            {app.blockedCount}
                          </Text>
                        </View>
                      );
                    })}
                  </>
                )}

                {/* Conseil de la semaine */}
                <View
                  style={[
                    wc.tipBox,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                  ]}
                >
                  <Text style={wc.tipIcon}>💡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[wc.tipTitle, { color: t.text.primary }]}>
                      Conseil de la semaine
                    </Text>
                    <Text style={[wc.tipText, { color: t.text.secondary }]}>
                      {report.totalBlocked < 10
                        ? "Ajoutez vos apps de réseaux sociaux à la liste de blocage pour commencer à mesurer votre usage."
                        : report.streakDays < 3
                          ? "Essayez le Mode Focus pendant 25 minutes — c'est la durée idéale pour une session de travail concentré."
                          : "Planifiez un blocage automatique le soir après 22h pour améliorer votre qualité de sommeil."}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={wc.loadingWrap}>
                <Text
                  style={[
                    { color: t.text.muted, fontSize: 14, textAlign: "center" },
                  ]}
                >
                  Pas encore assez de données.{"\n"}Revenez après une semaine
                  d'utilisation.
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[wc.closeFullBtn, { backgroundColor: Colors.blue[600] }]}
            onPress={handleClose}
            activeOpacity={0.85}
          >
            <Text style={wc.closeFullBtnText}>Fermer le rapport</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const wc = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "92%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  reportHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  reportEmoji: { fontSize: 32 },
  reportTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  reportPeriod: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingWrap: { paddingVertical: 40, alignItems: "center" },
  motivBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  motivEmoji: { fontSize: 24 },
  motivTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  motivSub: { fontSize: 12, lineHeight: 18 },
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
  statIcon: { fontSize: 22, marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  topAppRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  topAppRank: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  topAppRankText: { fontSize: 11, fontWeight: "800" },
  topAppName: { fontSize: 13, fontWeight: "600", marginBottom: 5 },
  topAppBar: { height: 3, borderRadius: 2, overflow: "hidden" },
  topAppBarFill: { height: "100%", borderRadius: 2 },
  topAppCount: { fontSize: 13, fontWeight: "800" },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 20,
  },
  tipIcon: { fontSize: 20 },
  tipTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  tipText: { fontSize: 12, lineHeight: 18 },
  closeFullBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  closeFullBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
