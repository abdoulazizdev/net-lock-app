import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import { AppStats } from "@/types";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

interface StatWithName extends AppStats {
  appName: string;
}

export default function StatsScreen() {
  const [stats, setStats] = useState<StatWithName[]>([]);
  const [totalBlocked, setTotalBlocked] = useState(0);
  const [totalAllowed, setTotalAllowed] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const raw = await StorageService.getStats();
      const withNames = await Promise.all(
        raw.map(async (s) => {
          const app = await AppListService.getAppByPackage(s.packageName);
          const appName =
            app?.appName ||
            s.packageName.split(".").pop() ||
            s.packageName ||
            "?"; // ← fallback final
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
  };

  const clearStats = async () => {
    await StorageService.clearStats();
    await loadStats();
  };

  const total = totalBlocked + totalAllowed;
  const blockedPct = total > 0 ? totalBlocked / total : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Statistiques</Text>
          <Text style={styles.headerSubtitle}>
            {stats.length} application(s) tracée(s)
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Overview cards */}
        <View style={styles.overviewRow}>
          <View style={[styles.overviewCard, styles.overviewCardBlocked]}>
            <Text style={[styles.overviewNumber, styles.numberBlocked]}>
              {totalBlocked}
            </Text>
            <Text style={styles.overviewLabel}>Bloquées</Text>
          </View>
          <View style={[styles.overviewCard, styles.overviewCardAllowed]}>
            <Text style={[styles.overviewNumber, styles.numberAllowed]}>
              {totalAllowed}
            </Text>
            <Text style={styles.overviewLabel}>Autorisées</Text>
          </View>
          <View style={[styles.overviewCard, styles.overviewCardTotal]}>
            <Text style={styles.overviewNumber}>{total}</Text>
            <Text style={styles.overviewLabel}>Total</Text>
          </View>
        </View>

        {/* Progress */}
        {total > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Taux de blocage</Text>
              <Text style={styles.progressValue}>
                {(blockedPct * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${blockedPct * 100}%` as any },
                ]}
              />
            </View>
          </View>
        )}

        {/* Per app stats */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PAR APPLICATION</Text>

          {stats.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>Aucune statistique</Text>
              <Text style={styles.emptyText}>
                Les statistiques apparaissent lorsque le VPN est actif et que
                des connexions sont tentées.
              </Text>
            </View>
          ) : (
            stats.map((stat) => {
              const appTotal = stat.blockedAttempts + stat.allowedAttempts;
              const appBlockedPct =
                appTotal > 0 ? stat.blockedAttempts / appTotal : 0;

              return (
                <View key={stat.packageName} style={styles.statCard}>
                  <View style={styles.statCardHeader}>
                    <View style={styles.statAppIcon}>
                      <Text style={styles.statAppIconText}>
                        {(stat.appName ?? "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.statAppInfo}>
                      <Text style={styles.statAppName}>{stat.appName}</Text>
                      <Text style={styles.statAppPackage} numberOfLines={1}>
                        {stat.packageName}
                      </Text>
                    </View>
                    <View style={styles.statNumbers}>
                      <Text style={styles.statBlocked}>
                        🚫 {stat.blockedAttempts}
                      </Text>
                      <Text style={styles.statAllowed}>
                        ✅ {stat.allowedAttempts}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statBarBg}>
                    <View
                      style={[
                        styles.statBarFill,
                        { width: `${appBlockedPct * 100}%` as any },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 En mode simulation, utilisez "Simuler une connexion" sur la page
            d'une application pour générer des statistiques.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  headerSubtitle: { fontSize: 13, color: "#555", marginTop: 2 },
  clearBtn: {
    backgroundColor: "#FF4D4D15",
    borderWidth: 1,
    borderColor: "#FF4D4D50",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  clearBtnText: { color: "#FF4D4D", fontSize: 13, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  overviewRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  overviewCardBlocked: {
    backgroundColor: "#FF4D4D10",
    borderColor: "#FF4D4D30",
  },
  overviewCardAllowed: {
    backgroundColor: "#00F5A010",
    borderColor: "#00F5A030",
  },
  overviewCardTotal: { backgroundColor: "#16161E", borderColor: "#1E1E2E" },
  overviewNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  numberBlocked: { color: "#FF4D4D" },
  numberAllowed: { color: "#00F5A0" },
  overviewLabel: {
    fontSize: 10,
    color: "#555",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressSection: {
    backgroundColor: "#16161E",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  progressLabel: { fontSize: 13, color: "#888", fontWeight: "600" },
  progressValue: { fontSize: 13, color: "#FF4D4D", fontWeight: "800" },
  progressBar: {
    height: 6,
    backgroundColor: "#00F5A020",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#FF4D4D", borderRadius: 3 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: "#16161E",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    alignItems: "center",
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
  },
  statCard: {
    backgroundColor: "#16161E",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  statCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statAppIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#1E1E2E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statAppIconText: { fontSize: 16, fontWeight: "800", color: "#00F5A0" },
  statAppInfo: { flex: 1 },
  statAppName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  statAppPackage: { fontSize: 10, color: "#444", fontFamily: "monospace" },
  statNumbers: { alignItems: "flex-end", gap: 2 },
  statBlocked: { fontSize: 12, color: "#FF4D4D", fontWeight: "600" },
  statAllowed: { fontSize: 12, color: "#00F5A0", fontWeight: "600" },
  statBarBg: {
    height: 3,
    backgroundColor: "#00F5A015",
    borderRadius: 2,
    overflow: "hidden",
  },
  statBarFill: { height: "100%", backgroundColor: "#FF4D4D", borderRadius: 2 },
  infoCard: {
    backgroundColor: "#16161E",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  infoText: { fontSize: 13, color: "#555", lineHeight: 20 },
});
