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
  Animated,
  AppState,
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

// ─── Types ────────────────────────────────────────────────────────────────────
type AppItem = InstalledApp & { rule?: AppRule };
const CARD_H = 83;

// ─── PulseDot — indique le focus actif dans le header ────────────────────────
function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.7,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <View style={st.pulseDotWrap}>
      <Animated.View style={[st.pulseDotGlow, { transform: [{ scale }] }]} />
      <View style={st.pulseDotCore} />
    </View>
  );
}

// ─── AppCard ──────────────────────────────────────────────────────────────────
const AppCard = React.memo(
  ({
    item,
    onToggle,
    onPress,
    locked,
  }: {
    item: AppItem;
    onToggle: (item: AppItem) => void;
    onPress: (pkg: string) => void;
    locked: boolean;
  }) => {
    const blocked = item.rule?.isBlocked ?? false;
    return (
      <TouchableOpacity
        style={[st.appRow, locked && st.appRowLocked]}
        onPress={() => onPress(item.packageName)}
        activeOpacity={0.75}
      >
        {blocked && <View style={st.accentBar} />}

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

        <View style={st.appInfo}>
          <Text style={st.appName} numberOfLines={1}>
            {item.appName}
          </Text>
          <Text style={st.appPkg} numberOfLines={1}>
            {item.packageName}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            st.blockBtn,
            blocked ? st.blockBtnOn : st.blockBtnOff,
            locked && st.blockBtnLocked,
          ]}
          onPress={() => !locked && onToggle(item)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          activeOpacity={locked ? 1 : 0.8}
        >
          <Text
            style={[
              st.blockBtnText,
              blocked ? st.blockBtnTextOn : st.blockBtnTextOff,
              locked && st.blockBtnTextLocked,
            ]}
          >
            {locked ? "◈" : blocked ? "Bloqué" : "Libre"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
  (p, n) =>
    p.item.packageName === n.item.packageName &&
    p.item.rule?.isBlocked === n.item.rule?.isBlocked &&
    p.item.icon === n.item.icon &&
    p.locked === n.locked,
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

  // Animation d'entrée header
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;

  const focusActive = focusStatus?.isActive ?? false;

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    VpnService.isVpnActive().then(setVpnActive);
    loadInitial();
    checkFocus();

    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && appStateRef.current !== "active") {
        refreshRules();
        checkFocus();
      }
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  const checkFocus = async () => {
    try {
      const s = await FocusService.getStatus();
      setFocusStatus(s.isActive ? s : null);
    } catch {
      setFocusStatus(null);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  const loadInitial = async () => {
    setLoading(true);
    try {
      const [rules, isVpn] = await Promise.all([
        StorageService.getRules(),
        VpnService.isVpnActive(),
      ]);
      setVpnActive(isVpn);
      setBlockedCount(rules.filter((r) => r.isBlocked).length);
      const userApps = await AppListService.getNonSystemApps();
      setApps(mergeAppsRules(userApps, rules));
    } finally {
      setLoading(false);
    }

    setSystemAppsLoading(true);
    try {
      const [allApps, rules] = await Promise.all([
        AppListService.getInstalledApps(),
        StorageService.getRules(),
      ]);
      setApps(mergeAppsRules(allApps, rules));
      setSystemAppsLoaded(true);
    } catch {
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
    list: InstalledApp[],
    rules: AppRule[],
  ): AppItem[] => {
    const map = new Map(rules.map((r) => [r.packageName, r]));
    return list.map((a) => ({ ...a, rule: map.get(a.packageName) }));
  };

  // ── Filtres ─────────────────────────────────────────────────────────────
  const filteredApps = useMemo(() => {
    let list = [...apps];
    if (!activeFilters.includes("system"))
      list = list.filter((a) => !a.isSystemApp);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }
    const wb = activeFilters.includes("blocked"),
      wa = activeFilters.includes("allowed");
    if (wb && !wa) list = list.filter((a) => a.rule?.isBlocked === true);
    else if (wa && !wb) list = list.filter((a) => !a.rule?.isBlocked);
    return list;
  }, [apps, query, activeFilters]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const toggleVpn = useCallback(async () => {
    if (focusActive) return;
    if (vpnActive) await VpnService.stopVpn();
    else await VpnService.startVpn();
    setVpnActive((v) => !v);
  }, [vpnActive, focusActive]);

  const toggleBlock = useCallback(
    async (item: AppItem) => {
      if (focusActive) return;
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
      try {
        await VpnService.setRule(item.packageName, nowBlocked);
      } catch {
        // Rollback
        setApps((prev) =>
          prev.map((a) =>
            a.packageName === item.packageName
              ? {
                  ...a,
                  rule: {
                    ...(a.rule ?? { packageName: a.packageName }),
                    isBlocked: !nowBlocked,
                  } as AppRule,
                }
              : a,
          ),
        );
        setBlockedCount((c) => c + (nowBlocked ? -1 : 1));
      }
    },
    [focusActive],
  );

  const handleAppPress = useCallback((pkg: string) => {
    router.push({
      pathname: "/screens/app-detail",
      params: { packageName: pkg },
    });
  }, []);

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
      <AppCard
        item={item}
        onToggle={toggleBlock}
        onPress={handleAppPress}
        locked={focusActive}
      />
    ),
    [toggleBlock, handleAppPress, focusActive],
  );

  if (loading) return <HomeScreenSkeleton />;

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header ── */}
      <Animated.View
        style={[
          st.header,
          {
            paddingTop: insets.top + 12,
            opacity: headerFade,
            transform: [{ translateY: headerSlide }],
          },
        ]}
      >
        <View style={st.headerRow}>
          {/* Left — titre + compteur */}
          <View>
            <Text style={st.headerTitle}>NetOff</Text>
            <View style={st.headerSubRow}>
              {focusActive && <PulseDot />}
              <Text style={[st.headerSub, focusActive && st.headerSubFocus]}>
                {focusActive
                  ? "Session Focus active"
                  : `${blockedCount} app${blockedCount > 1 ? "s" : ""} bloquée${blockedCount > 1 ? "s" : ""}`}
              </Text>
            </View>
          </View>

          {/* Right — actions */}
          <View style={st.headerActions}>
            {/* Focus button */}
            <TouchableOpacity
              style={[st.focusBtn, focusActive && st.focusBtnActive]}
              onPress={() => {
                if (!focusActive) setFocusVisible(true);
              }}
              activeOpacity={0.85}
            >
              {focusActive && <PulseDot />}
              <Text
                style={[st.focusBtnText, focusActive && st.focusBtnTextActive]}
              >
                {focusActive ? "EN COURS" : "◎ Focus"}
              </Text>
            </TouchableOpacity>

            {/* VPN toggle */}
            <TouchableOpacity
              style={[
                st.vpnBtn,
                vpnActive ? st.vpnBtnOn : st.vpnBtnOff,
                focusActive && st.vpnBtnLocked,
              ]}
              onPress={toggleVpn}
              activeOpacity={focusActive ? 1 : 0.85}
            >
              <View
                style={[
                  st.vpnDot,
                  {
                    backgroundColor: focusActive
                      ? "#4A4A6A"
                      : vpnActive
                        ? "#3DDB8A"
                        : "#D04070",
                  },
                ]}
              />
              <Text
                style={[
                  st.vpnBtnText,
                  {
                    color: focusActive
                      ? "#3A3A58"
                      : vpnActive
                        ? "#3DDB8A"
                        : "#D04070",
                  },
                ]}
              >
                {vpnActive ? "ON" : "OFF"}
              </Text>
              {focusActive && <Text style={st.lockGlyph}>◈</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ── List ── */}
      <FlatList
        data={filteredApps}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        windowSize={13}
        contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 80 }]}
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
            {focusActive && focusStatus && (
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
        style={[
          st.fab,
          { bottom: insets.bottom + 20 },
          focusActive && st.fabLocked,
        ]}
        onPress={() => {
          if (!focusActive) router.push("/settings");
        }}
        activeOpacity={focusActive ? 1 : 0.85}
      >
        <Text style={[st.fabText, focusActive && st.fabTextLocked]}>◈</Text>
        {focusActive && <View style={st.fabLockDot} />}
      </TouchableOpacity>

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

  // Header
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
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  headerSub: { fontSize: 11, color: "#3A3A58", fontWeight: "500" },
  headerSubFocus: { color: "#7B6EF6", fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },

  // PulseDot
  pulseDotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseDotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7B6EF6",
    position: "absolute",
  },
  pulseDotGlow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#7B6EF640",
    position: "absolute",
  },

  // Focus button
  focusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#2A244A",
  },
  focusBtnActive: { backgroundColor: "#1C1240", borderColor: "#7B6EF6" },
  focusBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5A5480",
    letterSpacing: 0.3,
  },
  focusBtnTextActive: { color: "#9B8FFF" },

  // VPN button
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
  vpnBtnLocked: {
    backgroundColor: "#0E0E18",
    borderColor: "#1C1C2C",
    opacity: 0.6,
  },
  vpnDot: { width: 6, height: 6, borderRadius: 3 },
  vpnBtnText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  lockGlyph: { fontSize: 10, color: "#3A3A58" },

  // List
  list: { paddingHorizontal: 22, paddingTop: 14 },
  countLabel: {
    fontSize: 10,
    color: "#2E2E48",
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },

  // App card
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
  appRowLocked: { opacity: 0.6 },
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

  // Block button
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
  blockBtnLocked: { backgroundColor: "#14141E", borderColor: "#1C1C2C" },
  blockBtnText: { fontSize: 11, fontWeight: "700" },
  blockBtnTextOn: { color: "#D04070" },
  blockBtnTextOff: { color: "#3DDB8A" },
  blockBtnTextLocked: { color: "#2A2A42", fontSize: 12 },

  // Empty
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

  // FAB
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
    elevation: 8,
  },
  fabLocked: { backgroundColor: "#14141E", borderColor: "#1C1C2C" },
  fabText: { fontSize: 18, color: "#7B6EF6" },
  fabTextLocked: { color: "#2A2A42" },
  fabLockDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7B6EF6",
  },
});
