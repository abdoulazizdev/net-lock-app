import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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

const CARD_H = 76 + 7;

// ─── AppCard ──────────────────────────────────────────────────────────────────
interface CardProps {
  item: InstalledApp;
  isBlocked: boolean;
  vpnActive: boolean;
  onPress: () => void;
  onToggle: () => void;
}

const AppCard = React.memo(function AppCard({
  item,
  isBlocked,
  vpnActive,
  onPress,
  onToggle,
}: CardProps) {
  return (
    <TouchableOpacity
      style={[styles.appCard, isBlocked && styles.appCardBlocked]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      {isBlocked && <View style={styles.blockedAccent} />}

      <View style={styles.iconWrap}>
        {item.icon ? (
          <Image
            source={{ uri: `data:image/png;base64,${item.icon}` }}
            style={styles.appIcon}
          />
        ) : (
          <View
            style={[
              styles.iconPlaceholder,
              item.isSystemApp && styles.iconSystem,
            ]}
          >
            <Text style={styles.iconLetter}>
              {(item.appName ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {isBlocked && (
          <View style={styles.blockedBadge}>
            <Text style={styles.blockedBadgeText}>✕</Text>
          </View>
        )}
        {item.isSystemApp && (
          <View style={styles.systemBadge}>
            <Text style={styles.systemBadgeText}>⚙</Text>
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
          styles.toggle,
          isBlocked ? styles.toggleBlocked : styles.toggleAllowed,
        ]}
        onPress={vpnActive ? onToggle : undefined}
        disabled={!vpnActive}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View
          style={[
            styles.thumb,
            isBlocked ? styles.thumbBlocked : styles.thumbAllowed,
          ]}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
  const [vpnActive, setVpnActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadState, setLoadState] = useState<"meta" | "done">("meta");
  // État des apps système
  const [systemAppsLoaded, setSystemAppsLoaded] = useState(false);
  const [systemAppsLoading, setSystemAppsLoading] = useState(false);

  // Ref pour éviter les double-chargements
  const loadingSystemRef = useRef(false);

  useEffect(() => {
    boot();
  }, []);

  // Quand le filtre système est activé → charger les apps système si pas encore fait
  useEffect(() => {
    if (
      activeFilters.includes("system") &&
      !systemAppsLoaded &&
      !loadingSystemRef.current
    ) {
      loadSystemApps();
    }
  }, [activeFilters]);

  async function boot() {
    setLoadState("meta");
    try {
      const [rules, vpn] = await Promise.all([
        StorageService.getRules(),
        VpnService.isVpnActive(),
      ]);
      setBlockedApps(
        new Set(rules.filter((r) => r.isBlocked).map((r) => r.packageName)),
      );
      setVpnActive(vpn);

      // Charge uniquement les apps utilisateur au démarrage
      await AppListService.getAppsProgressive((userApps) => {
        const sorted = [...userApps].sort((a, b) => {
          if (a.isSystemApp !== b.isSystemApp) return a.isSystemApp ? 1 : -1;
          return (a.appName ?? "").localeCompare(b.appName ?? "");
        });
        setApps(sorted);
        setLoadState("done");
      }, false); // false = pas d'apps système
    } catch (e) {
      console.error("[HomeScreen] boot error:", e);
      setLoadState("done");
    }
  }

  async function loadSystemApps() {
    if (loadingSystemRef.current) return;
    loadingSystemRef.current = true;
    setSystemAppsLoading(true);
    try {
      await AppListService.getAppsProgressive((allApps) => {
        const sorted = [...allApps].sort((a, b) => {
          if (a.isSystemApp !== b.isSystemApp) return a.isSystemApp ? 1 : -1;
          return (a.appName ?? "").localeCompare(b.appName ?? "");
        });
        setApps(sorted);
        setSystemAppsLoaded(true);
      }, true); // true = inclure les apps système
    } finally {
      setSystemAppsLoading(false);
      loadingSystemRef.current = false;
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    AppListService.invalidateCache();
    setSystemAppsLoaded(false);
    // Rechargement selon l'état courant des filtres
    const includeSystem = activeFilters.includes("system");
    await AppListService.getAppsProgressive((result) => {
      const sorted = [...result].sort((a, b) => {
        if (a.isSystemApp !== b.isSystemApp) return a.isSystemApp ? 1 : -1;
        return (a.appName ?? "").localeCompare(b.appName ?? "");
      });
      setApps(sorted);
      if (includeSystem) setSystemAppsLoaded(true);
    }, includeSystem);
    const rules = await StorageService.getRules();
    setBlockedApps(
      new Set(rules.filter((r) => r.isBlocked).map((r) => r.packageName)),
    );
    setRefreshing(false);
  }, [activeFilters]);

  const toggleVpn = useCallback(async () => {
    if (vpnActive) {
      await VpnService.stopVpn();
      setVpnActive(false);
    } else {
      const ok = await VpnService.startVpn();
      setVpnActive(ok);
    }
  }, [vpnActive]);

  const toggleAppBlock = useCallback(
    async (packageName: string) => {
      setBlockedApps((prev) => {
        const next = new Set(prev);
        prev.has(packageName)
          ? next.delete(packageName)
          : next.add(packageName);
        return next;
      });
      VpnService.setRule(packageName, !blockedApps.has(packageName)).catch(
        console.error,
      );
    },
    [blockedApps],
  );

  const handleFilterChange = useCallback((filters: FilterKey[]) => {
    setActiveFilters(filters);
  }, []);

  // ── Filtrage memoïsé ──────────────────────────────────────────────────────
  const filteredApps = useMemo(() => {
    let list = apps;

    // Filtre système : si pas activé, exclure les apps système
    // (même si elles sont chargées après un refresh)
    if (!activeFilters.includes("system")) {
      list = list.filter((a) => !a.isSystemApp);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }
    if (activeFilters.includes("blocked"))
      list = list.filter((a) => blockedApps.has(a.packageName));
    if (activeFilters.includes("allowed"))
      list = list.filter((a) => !blockedApps.has(a.packageName));

    return list;
  }, [apps, searchQuery, activeFilters, blockedApps]);

  const keyExtractor = useCallback(
    (item: InstalledApp) => item.packageName,
    [],
  );
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: CARD_H,
      offset: CARD_H * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: InstalledApp }) => (
      <AppCard
        item={item}
        isBlocked={blockedApps.has(item.packageName)}
        vpnActive={vpnActive}
        onPress={() =>
          router.push({
            pathname: "/screens/app-detail",
            params: { packageName: item.packageName },
          })
        }
        onToggle={() => toggleAppBlock(item.packageName)}
      />
    ),
    [blockedApps, vpnActive, toggleAppBlock],
  );

  if (loadState === "meta") return <HomeScreenSkeleton />;

  const userAppsCount = apps.filter((a) => !a.isSystemApp).length;
  const displayedCount = filteredApps.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>NetOff</Text>
            <Text style={styles.subtitle}>
              {displayedCount} app{displayedCount !== 1 ? "s" : ""} ·{" "}
              {blockedApps.size} bloquée{blockedApps.size !== 1 ? "s" : ""}
              {systemAppsLoading && (
                <Text style={styles.subtitleLoading}> · ⚙ chargement…</Text>
              )}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.vpnBtn,
              vpnActive ? styles.vpnBtnOn : styles.vpnBtnOff,
            ]}
            onPress={toggleVpn}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.vpnDot,
                vpnActive ? styles.vpnDotOn : styles.vpnDotOff,
              ]}
            />
            <Text
              style={[
                styles.vpnTxt,
                vpnActive ? styles.vpnTxtOn : styles.vpnTxtOff,
              ]}
            >
              {vpnActive ? "VPN ACTIF" : "VPN OFF"}
            </Text>
          </TouchableOpacity>
        </View>

        <SearchAndFilters
          query={searchQuery}
          onQueryChange={setSearchQuery}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          systemAppsLoaded={systemAppsLoaded}
          systemAppsLoading={systemAppsLoading}
        />
      </View>

      {/* Bannière VPN inactif */}
      {!vpnActive && (
        <TouchableOpacity
          style={styles.vpnWarning}
          onPress={toggleVpn}
          activeOpacity={0.8}
        >
          <View style={styles.vpnWarningRow}>
            <Text style={styles.vpnWarnIcon}>⚠</Text>
            <Text style={styles.vpnWarnText}>
              VPN inactif — les règles ne s'appliquent pas
            </Text>
            <Text style={styles.vpnWarnCta}>Activer</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Bannière chargement système */}
      {systemAppsLoading && (
        <View style={styles.systemLoadingBanner}>
          <Text style={styles.systemLoadingText}>
            ⚙ Chargement des apps système…
          </Text>
        </View>
      )}

      {/* Liste */}
      <FlatList
        data={filteredApps}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        style={styles.flatList}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        updateCellsBatchingPeriod={40}
        windowSize={13}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B6EF6"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>◌</Text>
            <Text style={styles.emptyText}>
              {activeFilters.includes("system") && systemAppsLoading
                ? "Chargement en cours…"
                : "Aucune application trouvée"}
            </Text>
          </View>
        }
      />

      {/* FAB */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#3A3A58",
    marginTop: 3,
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  subtitleLoading: { color: "#8880C0" },

  vpnBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    gap: 7,
    borderWidth: 1,
  },
  vpnBtnOn: { backgroundColor: "#0E1F18", borderColor: "#1E8A5A" },
  vpnBtnOff: { backgroundColor: "#1A0F0F", borderColor: "#5A1E1E" },
  vpnDot: { width: 7, height: 7, borderRadius: 4 },
  vpnDotOn: { backgroundColor: "#3DDB8A" },
  vpnDotOff: { backgroundColor: "#E05555" },
  vpnTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  vpnTxtOn: { color: "#3DDB8A" },
  vpnTxtOff: { color: "#E05555" },

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
  vpnWarningRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  vpnWarnIcon: { fontSize: 14, color: "#E05555" },
  vpnWarnText: { flex: 1, color: "#A04444", fontSize: 12, fontWeight: "500" },
  vpnWarnCta: {
    color: "#E05555",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  systemLoadingBanner: {
    marginHorizontal: 22,
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 10,
    backgroundColor: "#141230",
    borderWidth: 1,
    borderColor: "#2A2450",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  systemLoadingText: { fontSize: 12, color: "#8880C0", fontWeight: "500" },

  flatList: { flex: 1 },
  list: { paddingHorizontal: 22, paddingTop: 12 },

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
    height: 76,
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

  iconWrap: { position: "relative", marginRight: 14 },
  appIcon: { width: 48, height: 48, borderRadius: 14 },
  iconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#16162A",
    justifyContent: "center",
    alignItems: "center",
  },
  iconSystem: { backgroundColor: "#141422" },
  iconLetter: { fontSize: 20, fontWeight: "700", color: "#7B6EF6" },

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
  systemBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 15,
    height: 15,
    borderRadius: 7,
    backgroundColor: "#141230",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2450",
  },
  systemBadgeText: { fontSize: 7, color: "#8880C0" },

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

  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    padding: 3,
    borderWidth: 1,
  },
  toggleAllowed: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  toggleBlocked: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  thumb: { width: 18, height: 18, borderRadius: 9 },
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

  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 36, color: "#2A2A3A", marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#3A3A58" },

  fab: {
    position: "absolute",
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
