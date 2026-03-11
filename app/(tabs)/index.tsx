import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { InstalledApp } from "@/types";

export default function HomeScreen() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [filteredApps, setFilteredApps] = useState<InstalledApp[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vpnActive, setVpnActive] = useState(false);
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [showSystemApps, setShowSystemApps] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadApps();
    checkVpnStatus();
  }, []);

  useEffect(() => {
    filterApps();
  }, [searchQuery, apps, showSystemApps]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
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
    if (!showSystemApps) filtered = filtered.filter((app) => !app.isSystemApp);
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

  const renderAppItem = ({
    item,
    index,
  }: {
    item: InstalledApp;
    index: number;
  }) => {
    const isBlocked = blockedApps.has(item.packageName);
    const itemAnim = new Animated.Value(0);

    return (
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <TouchableOpacity
          style={styles.appCard}
          onPress={() =>
            router.push({
              pathname: "/screens/app-detail",
              params: { packageName: item.packageName },
            })
          }
          activeOpacity={0.7}
        >
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
            <Text style={styles.appName} numberOfLines={1}>
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
        <View style={styles.loadingPulse} />
        <Text style={styles.loadingText}>Chargement des apps...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      {/* Header */}
      <View style={styles.header}>
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
            activeOpacity={0.8}
          >
            <Text style={styles.vpnButtonIcon}>{vpnActive ? "🛡️" : "⚠️"}</Text>
            <Text style={styles.vpnButtonText}>
              {vpnActive ? "VPN ON" : "VPN OFF"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une application..."
            placeholderTextColor="#555"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              showSystemApps && styles.filterChipActive,
            ]}
            onPress={() => setShowSystemApps(!showSystemApps)}
          >
            <Text
              style={[
                styles.filterChipText,
                showSystemApps && styles.filterChipTextActive,
              ]}
            >
              Apps système
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip]}
            onPress={() => setSearchQuery("")}
          >
            <Text style={styles.filterChipText}>Tout afficher</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VPN Warning */}
      {!vpnActive && (
        <TouchableOpacity style={styles.vpnWarning} onPress={toggleVpn}>
          <Text style={styles.vpnWarningText}>
            ⚠️ VPN inactif — les règles ne s'appliquent pas. Activer →
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={filteredApps}
        renderItem={renderAppItem}
        keyExtractor={(item) => item.packageName}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#00F5A0"
          />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB Settings */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/settings")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#00F5A0",
    opacity: 0.3,
    marginBottom: 16,
  },
  loadingText: { color: "#555", fontSize: 14 },

  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#0A0A0F",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  headerSubtitle: { fontSize: 13, color: "#555", marginTop: 2 },

  vpnButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  vpnButtonActive: {
    backgroundColor: "#00F5A015",
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  vpnButtonInactive: {
    backgroundColor: "#FF4D4D15",
    borderWidth: 1,
    borderColor: "#FF4D4D",
  },
  vpnButtonIcon: { fontSize: 14 },
  vpnButtonText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161E",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  searchClear: { color: "#555", fontSize: 14, paddingLeft: 8 },

  filters: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#16161E",
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  filterChipActive: { backgroundColor: "#00F5A015", borderColor: "#00F5A0" },
  filterChipText: { fontSize: 12, color: "#555", fontWeight: "600" },
  filterChipTextActive: { color: "#00F5A0" },

  vpnWarning: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "#FF4D4D15",
    borderWidth: 1,
    borderColor: "#FF4D4D40",
    borderRadius: 12,
    padding: 12,
  },
  vpnWarningText: {
    color: "#FF4D4D",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 },

  appCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161E",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  appIconContainer: { position: "relative", marginRight: 14 },
  appIcon: { width: 48, height: 48, borderRadius: 12 },
  appIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1E1E2E",
    justifyContent: "center",
    alignItems: "center",
  },
  systemIconBg: { backgroundColor: "#1A1A2E" },
  appIconLetter: { fontSize: 20, fontWeight: "700", color: "#00F5A0" },
  blockedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF4D4D",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0A0A0F",
  },
  blockedBadgeText: { fontSize: 8, color: "#FFFFFF", fontWeight: "800" },

  appInfo: { flex: 1, marginRight: 12 },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  appPackage: { fontSize: 11, color: "#444", fontFamily: "monospace" },

  toggleBtn: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    padding: 3,
  },
  toggleBtnAllowed: {
    backgroundColor: "#00F5A030",
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  toggleBtnBlocked: {
    backgroundColor: "#FF4D4D20",
    borderWidth: 1,
    borderColor: "#FF4D4D50",
  },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  thumbAllowed: { backgroundColor: "#00F5A0", alignSelf: "flex-end" },
  thumbBlocked: { backgroundColor: "#FF4D4D50", alignSelf: "flex-start" },

  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#16161E",
    borderWidth: 1,
    borderColor: "#1E1E2E",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  fabIcon: { fontSize: 24 },
});
