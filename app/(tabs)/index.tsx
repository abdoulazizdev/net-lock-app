import FocusBanner from "@/components/FocusBanner";
import FocusModal from "@/components/FocusModal";
import HomeScreenSkeleton from "@/components/HomeScreenSkeleton";
import SearchAndFilters, { FilterKey } from "@/components/SearchAndFilters";
import AppListService from "@/services/app-list.service";
import FocusService, { FocusStatus } from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { AppRule, InstalledApp } from "@/types";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
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

// ─── Types ────────────────────────────────────────────────────────────────────
type AppItem = InstalledApp & { rule?: AppRule };

// ─── Card height for getItemLayout ───────────────────────────────────────────
const CARD_H = 76 + 7; // 83

// ─── AppCard — React.memo avec comparateur custom ─────────────────────────────
const AppCard = React.memo(
  ({
    item,
    onToggle,
    onPress,
  }: {
    item: AppItem;
    onToggle: (item: AppItem) => void;
    onPress: (pkg: string) => void;
  }) => {
    const blocked = item.rule?.isBlocked ?? false;
    return (
      <TouchableOpacity
        style={st.appRow}
        onPress={() => onPress(item.packageName)}
        activeOpacity={0.75}
      >
        {/* Accent bar */}
        {blocked && <View style={st.accentBar} />}

        {/* Icon */}
        <View style={st.appIconWrap}>
          {item.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={st.appIconImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={st.appIconText}>
              {item.appName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={st.appInfo}>
          <Text style={st.appName} numberOfLines={1}>
            {item.appName}
          </Text>
          <Text style={st.appPkg} numberOfLines={1}>
            {item.packageName}
          </Text>
        </View>

        {/* Block toggle */}
        <TouchableOpacity
          style={[st.blockBtn, blocked ? st.blockBtnOn : st.blockBtnOff]}
          onPress={() => onToggle(item)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              st.blockBtnText,
              blocked ? st.blockBtnTextOn : st.blockBtnTextOff,
            ]}
          >
            {blocked ? "Bloqué" : "Libre"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.item.packageName === next.item.packageName &&
    prev.item.rule?.isBlocked === next.item.rule?.isBlocked &&
    prev.item.icon === next.item.icon,
);

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vpnActive, setVpnActive] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [systemAppsLoaded, setSystemAppsLoaded] = useState(false);
  const [systemAppsLoading, setSystemAppsLoading] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [focusStatus, setFocusStatus] = useState<FocusStatus | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadInitial();
    checkFocus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && appStateRef.current !== "active") {
        refreshRules();
        checkFocus();
      }
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  // ── Focus status ──────────────────────────────────────────────────────────
  const checkFocus = async () => {
    try {
      const status = await FocusService.getStatus();
      setFocusStatus(status.isActive ? status : null);
    } catch {
      setFocusStatus(null);
    }
  };

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadInitial = async () => {
    setLoading(true);
    try {
      const [rules, isVpn] = await Promise.all([
        StorageService.getRules(),
        VpnService.isVpnActive(),
      ]);
      setVpnActive(isVpn);
      setBlockedCount(rules.filter((r) => r.isBlocked).length);

      // Phase 1 — apps utilisateur uniquement (rapide, depuis le cache)
      const userApps = await AppListService.getNonSystemApps();
      setApps(mergeAppsRules(userApps, rules));
    } finally {
      setLoading(false);
    }

    // Phase 2 — toutes les apps (user + système) en arrière-plan
    setSystemAppsLoading(true);
    try {
      const [allApps, rules] = await Promise.all([
        AppListService.getInstalledApps(),
        StorageService.getRules(),
      ]);
      setApps(mergeAppsRules(allApps, rules));
      setSystemAppsLoaded(true);
    } catch {
      // Silently fail — user apps still visible
    } finally {
      setSystemAppsLoading(false);
    }
  };

  const refreshRules = useCallback(async () => {
    const [rules, isVpn] = await Promise.all([
      StorageService.getRules(),
      VpnService.isVpnActive(),
    ]);
    setVpnActive(isVpn);
    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    setApps((prev) => mergeAppsRules(prev, rules));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshRules(), checkFocus()]);
    setRefreshing(false);
  }, [refreshRules]);

  const mergeAppsRules = (
    appsList: InstalledApp[],
    rules: AppRule[],
  ): AppItem[] => {
    const map = new Map(rules.map((r) => [r.packageName, r]));
    return appsList.map((a) => ({ ...a, rule: map.get(a.packageName) }));
  };

  // ── Filtered list (memoized) ──────────────────────────────────────────────
  const filteredApps = useMemo(() => {
    let list = [...apps];

    // Apps système : visibles UNIQUEMENT si le filtre "system" est actif
    // Quand systemAppsLoaded est false, les apps système ne sont pas encore
    // dans `apps` donc le filtre ne montrera rien — c'est le comportement attendu
    // (le chip est grisé + spinner pendant le chargement)
    if (!activeFilters.includes("system")) {
      list = list.filter((a) => !a.isSystemApp);
    }

    // Filtre texte
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }

    // Filtres blocked / allowed
    // Si les deux sont actifs simultanément → on les annule (on garde tout)
    const wantBlocked = activeFilters.includes("blocked");
    const wantAllowed = activeFilters.includes("allowed");
    if (wantBlocked && !wantAllowed) {
      list = list.filter((a) => a.rule?.isBlocked === true);
    } else if (wantAllowed && !wantBlocked) {
      list = list.filter((a) => !a.rule?.isBlocked);
    }

    return list;
  }, [apps, query, activeFilters]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleVpn = useCallback(async () => {
    if (vpnActive) await VpnService.stopVpn();
    else await VpnService.startVpn();
    setVpnActive((v) => !v);
  }, [vpnActive]);

  const toggleBlock = useCallback(async (item: AppItem) => {
    const nowBlocked = !(item.rule?.isBlocked ?? false);
    // Optimistic update
    setApps((prev) =>
      prev.map((a) =>
        a.packageName === item.packageName
          ? {
              ...a,
              rule: {
                ...(a.rule ?? { packageName: a.packageName }),
                isBlocked: nowBlocked,
              } as AppRule,
            }
          : a,
      ),
    );
    setBlockedCount((c) => c + (nowBlocked ? 1 : -1));
    // Fire-and-forget sync
    VpnService.setRule(item.packageName, nowBlocked);
  }, []);

  const handleAppPress = useCallback((packageName: string) => {
    router.push({ pathname: "/screens/app-detail", params: { packageName } });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: AppItem) => item.packageName, []);
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: CARD_H,
      offset: CARD_H * index,
      index,
    }),
    [],
  );
  const renderItem = useCallback(
    ({ item }: { item: AppItem }) => (
      <AppCard item={item} onToggle={toggleBlock} onPress={handleAppPress} />
    ),
    [toggleBlock, handleAppPress],
  );

  if (loading) return <HomeScreenSkeleton />;

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header ── */}
      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
        <View style={st.headerRow}>
          <View>
            <Text style={st.headerTitle}>NetOff</Text>
            <Text style={st.headerSub}>
              {blockedCount} app{blockedCount > 1 ? "s" : ""} bloquée
              {blockedCount > 1 ? "s" : ""}
            </Text>
          </View>
          <View style={st.headerActions}>
            {/* Focus button */}
            <TouchableOpacity
              style={[st.focusBtn, focusStatus && st.focusBtnActive]}
              onPress={() => {
                if (!focusStatus) setFocusVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[st.focusBtnText, focusStatus && st.focusBtnTextActive]}
              >
                {focusStatus ? "◉ EN COURS" : "◎ Focus"}
              </Text>
            </TouchableOpacity>
            {/* VPN toggle */}
            <TouchableOpacity
              style={[st.vpnBtn, vpnActive ? st.vpnBtnOn : st.vpnBtnOff]}
              onPress={toggleVpn}
              activeOpacity={0.85}
            >
              <View
                style={[
                  st.vpnDot,
                  { backgroundColor: vpnActive ? "#3DDB8A" : "#D04070" },
                ]}
              />
              <Text
                style={[
                  st.vpnBtnText,
                  { color: vpnActive ? "#3DDB8A" : "#D04070" },
                ]}
              >
                {vpnActive ? "ON" : "OFF"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── List ── */}
      <FlatList
        data={filteredApps}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        windowSize={13}
        contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B6EF6"
            colors={["#7B6EF6"]}
            progressBackgroundColor="#0E0E18"
          />
        }
        ListHeaderComponent={
          <View>
            {focusStatus && (
              <FocusBanner
                status={focusStatus}
                onStopped={() => {
                  setFocusStatus(null);
                  refreshRules();
                }}
              />
            )}
            <SearchAndFilters
              query={query}
              onQueryChange={setQuery}
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              systemAppsLoaded={systemAppsLoaded}
              systemAppsLoading={systemAppsLoading}
            />
            <Text style={st.countLabel}>
              {filteredApps.length} application
              {filteredApps.length > 1 ? "s" : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={st.empty}>
            <View style={st.emptyIconWrap}>
              <Text style={st.emptyIconText}>◈</Text>
            </View>
            <Text style={st.emptyTitle}>Aucune application trouvée</Text>
            <Text style={st.emptySubtitle}>
              Modifiez votre recherche ou vos filtres
            </Text>
          </View>
        }
      />

      {/* ── FAB settings ── */}
      <TouchableOpacity
        style={[st.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/settings")}
        activeOpacity={0.85}
      >
        <Text style={st.fabText}>◈</Text>
      </TouchableOpacity>

      {/* ── Focus modal ── */}
      <FocusModal
        visible={focusVisible}
        onClose={() => setFocusVisible(false)}
        onStarted={() => {
          checkFocus();
          refreshRules();
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  // ── Header
  header: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.2,
  },
  headerSub: {
    fontSize: 11,
    color: "#3A3A58",
    marginTop: 2,
    fontWeight: "500",
  },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },

  // ── Focus button
  focusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#2A244A",
  },
  focusBtnActive: { backgroundColor: "#7B6EF620", borderColor: "#7B6EF6" },
  focusBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5A5480",
    letterSpacing: 0.3,
  },
  focusBtnTextActive: { color: "#9B8FFF" },

  // ── VPN button
  vpnBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  vpnBtnOn: { backgroundColor: "#0A0E0C", borderColor: "#1E6A46" },
  vpnBtnOff: { backgroundColor: "#0E0A0C", borderColor: "#251520" },
  vpnDot: { width: 6, height: 6, borderRadius: 3 },
  vpnBtnText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  // ── List
  list: { paddingHorizontal: 22, paddingTop: 14 },
  countLabel: {
    fontSize: 10,
    color: "#2E2E48",
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },

  // ── App card
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 12,
    marginBottom: 7,
    gap: 12,
    height: 76,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: "#D04070",
  },
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#16161E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A3A",
    overflow: "hidden",
  },
  appIconImg: { width: 38, height: 38 },
  appIconText: { fontSize: 18, fontWeight: "700", color: "#5A5A80" },
  appInfo: { flex: 1 },
  appName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 3,
  },
  appPkg: { fontSize: 10, color: "#2E2E48", fontFamily: "monospace" },

  // ── Block button
  blockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 62,
    alignItems: "center",
  },
  blockBtnOn: { backgroundColor: "#14080A", borderColor: "#4A1A2A" },
  blockBtnOff: { backgroundColor: "#0A140A", borderColor: "#1A3A1A" },
  blockBtnText: { fontSize: 11, fontWeight: "700" },
  blockBtnTextOn: { color: "#D04070" },
  blockBtnTextOff: { color: "#3DDB8A" },

  // ── Empty state
  empty: { alignItems: "center", paddingTop: 60 },
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
    fontSize: 15,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 6,
  },
  emptySubtitle: { fontSize: 12, color: "#3A3A58" },

  // ── FAB
  fab: {
    position: "absolute",
    right: 22,
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: { fontSize: 18, color: "#7B6EF6" },
});
