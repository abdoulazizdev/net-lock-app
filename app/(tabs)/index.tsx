import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreenSkeleton from "@/components/HomeScreenSkeleton";
import SearchAndFilters, { FilterKey } from "@/components/SearchAndFilters";
import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { InstalledApp } from "@/types";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [filteredApps, setFilteredApps] = useState<InstalledApp[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vpnActive, setVpnActive] = useState(false);
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    loadApps();
    checkVpnStatus();
  }, []);
  useEffect(() => {
    filterApps();
  }, [searchQuery, apps, activeFilters]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const loadApps = async () => {
    try {
      setLoading(true);
      const installedApps = await AppListService.getInstalledApps();
      setApps(installedApps);
      const rules = await StorageService.getRules();
      const blocked = new Set(
        rules.filter((r) => r.isBlocked).map((r) => r.packageName),
      );
      setBlockedApps(blocked);
    } catch (error) {
      console.error("Erreur chargement apps:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkVpnStatus = async () => {
    const active = await VpnService.isVpnActive();
    setVpnActive(active);
  };

  const filterApps = () => {
    let filtered = apps;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.appName.toLowerCase().includes(q) ||
          app.packageName.toLowerCase().includes(q),
      );
    }
    if (activeFilters.includes("system")) {
      filtered = filtered.filter((app) => app.isSystemApp);
    } else if (!activeFilters.includes("system") && activeFilters.length > 0) {
      filtered = filtered.filter((app) => !app.isSystemApp);
    }
    if (activeFilters.includes("blocked")) {
      filtered = filtered.filter((app) => blockedApps.has(app.packageName));
    }
    if (activeFilters.includes("allowed")) {
      filtered = filtered.filter((app) => !blockedApps.has(app.packageName));
    }
    setFilteredApps(filtered);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadApps();
    await checkVpnStatus();
    setRefreshing(false);
  }, []);

  const toggleAppBlock = async (
    packageName: string,
    currentBlocked: boolean,
  ) => {
    const newBlocked = !currentBlocked;
    await VpnService.setRule(packageName, newBlocked);
    setBlockedApps((prev) => {
      const updated = new Set(prev);
      newBlocked ? updated.add(packageName) : updated.delete(packageName);
      return updated;
    });
  };

  const toggleVpn = async () => {
    if (vpnActive) {
      await VpnService.stopVpn();
      setVpnActive(false);
    } else {
      const started = await VpnService.startVpn();
      setVpnActive(started);
    }
  };

  const renderAppItem = ({ item }: { item: InstalledApp }) => {
    const isBlocked = blockedApps.has(item.packageName);

    return (
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <TouchableOpacity
          style={[styles.appCard, isBlocked && styles.appCardBlocked]}
          onPress={() =>
            router.push({
              pathname: "/screens/app-detail",
              params: { packageName: item.packageName },
            })
          }
          activeOpacity={0.65}
        >
          {isBlocked && <View style={styles.blockedAccent} />}

          <View style={styles.appIconContainer}>
            {item.icon ? (
              <Image
                source={{ uri: `data:image/png;base64,${item.icon}` }}
                style={styles.appIcon}
              />
            ) : (
              <View
                style={[
                  styles.appIconPlaceholder,
                  item.isSystemApp && styles.systemIconBg,
                ]}
              >
                <Text style={styles.appIconLetter}>
                  {item.appName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isBlocked && (
              <View style={styles.blockedBadge}>
                <Text style={styles.blockedBadgeText}>✕</Text>
              </View>
            )}
          </View>

          <View style={styles.appInfo}>
            <Text
              style={[styles.appName, isBlocked && styles.appNameBlocked]}
              numberOfLines={1}
            >
              {item.appName}
            </Text>
            <Text style={styles.appPackage} numberOfLines={1}>
              {item.packageName}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              isBlocked ? styles.toggleBtnBlocked : styles.toggleBtnAllowed,
            ]}
            onPress={() =>
              vpnActive && toggleAppBlock(item.packageName, isBlocked)
            }
            disabled={!vpnActive}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.toggleThumb,
                isBlocked ? styles.thumbBlocked : styles.thumbAllowed,
              ]}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ── Skeleton while loading
  if (loading) return <HomeScreenSkeleton />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>NetOff</Text>
            <Text style={styles.headerSubtitle}>
              {filteredApps.length} apps • {blockedApps.size} bloquées
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.vpnButton,
              vpnActive ? styles.vpnButtonActive : styles.vpnButtonInactive,
            ]}
            onPress={toggleVpn}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.vpnDot,
                vpnActive ? styles.vpnDotActive : styles.vpnDotInactive,
              ]}
            />
            <Text
              style={[
                styles.vpnButtonText,
                vpnActive ? styles.vpnTextActive : styles.vpnTextInactive,
              ]}
            >
              {vpnActive ? "VPN ACTIF" : "VPN OFF"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search + Filters */}
        <SearchAndFilters
          query={searchQuery}
          onQueryChange={setSearchQuery}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
        />
      </View>

      {/* ── VPN Warning */}
      {!vpnActive && (
        <TouchableOpacity
          style={styles.vpnWarning}
          onPress={toggleVpn}
          activeOpacity={0.8}
        >
          <View style={styles.vpnWarningInner}>
            <Text style={styles.vpnWarningIcon}>⚠</Text>
            <Text style={styles.vpnWarningText}>
              VPN inactif — les règles ne s'appliquent pas
            </Text>
            <Text style={styles.vpnWarningCta}>Activer</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── App List */}
      <FlatList
        data={filteredApps}
        renderItem={renderAppItem}
        keyExtractor={(item) => item.packageName}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B6EF6"
          />
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => router.push("/settings")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>⚙</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  header: {
    paddingTop: 12, // overridden dynamically with insets.top
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: "#080810",
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
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
    letterSpacing: 0.5,
    fontWeight: "500",
  },

  vpnButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    gap: 7,
    borderWidth: 1,
  },
  vpnButtonActive: { backgroundColor: "#0E1F18", borderColor: "#1E8A5A" },
  vpnButtonInactive: { backgroundColor: "#1A0F0F", borderColor: "#5A1E1E" },
  vpnDot: { width: 7, height: 7, borderRadius: 4 },
  vpnDotActive: { backgroundColor: "#3DDB8A" },
  vpnDotInactive: { backgroundColor: "#E05555" },
  vpnButtonText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  vpnTextActive: { color: "#3DDB8A" },
  vpnTextInactive: { color: "#E05555" },

  vpnWarning: {
    marginHorizontal: 22,
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#14080A",
    borderWidth: 1,
    borderColor: "#3A151A",
  },
  vpnWarningInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  vpnWarningIcon: { fontSize: 14, color: "#E05555" },
  vpnWarningText: {
    flex: 1,
    color: "#A04444",
    fontSize: 12,
    fontWeight: "500",
  },
  vpnWarningCta: {
    color: "#E05555",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  list: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 110 },

  appCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 18,
    padding: 14,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    overflow: "hidden",
  },
  appCardBlocked: { backgroundColor: "#0E0A10", borderColor: "#2A1525" },
  blockedAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: "#D04070",
  },

  appIconContainer: { position: "relative", marginRight: 14 },
  appIcon: { width: 48, height: 48, borderRadius: 14 },
  appIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#16162A",
    justifyContent: "center",
    alignItems: "center",
  },
  systemIconBg: { backgroundColor: "#141422" },
  appIconLetter: { fontSize: 20, fontWeight: "700", color: "#7B6EF6" },
  blockedBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#D04070",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#080810",
  },
  blockedBadgeText: { fontSize: 7, color: "#FFF", fontWeight: "900" },

  appInfo: { flex: 1, marginRight: 12 },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E8E8F8",
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  appNameBlocked: { color: "#806080", textDecorationLine: "line-through" },
  appPackage: {
    fontSize: 11,
    color: "#2E2E44",
    fontFamily: "monospace",
    letterSpacing: 0.2,
  },

  toggleBtn: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    padding: 3,
    borderWidth: 1,
  },
  toggleBtnAllowed: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  toggleBtnBlocked: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  thumbAllowed: {
    backgroundColor: "#3DDB8A",
    alignSelf: "flex-end",
    shadowColor: "#3DDB8A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbBlocked: { backgroundColor: "#4A2030", alignSelf: "flex-start" },

  fab: {
    position: "absolute",
    bottom: 16, // overridden dynamically with insets.bottom
    right: 24,
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  fabIcon: { fontSize: 22, color: "#6A6A90" },
});
