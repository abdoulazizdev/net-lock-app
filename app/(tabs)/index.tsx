import FocusBanner from "@/components/FocusBanner";
import FocusModal from "@/components/FocusModal";
import HomeScreenSkeleton from "@/components/HomeScreenSkeleton";
import PaywallModal from "@/components/PaywallModal";
import SearchAndFilters, {
  DEFAULT_FILTERS,
  Filters,
} from "@/components/SearchAndFilters";
import { usePremium } from "@/hooks/usePremium";
import AppListService from "@/services/app-list.service";
import FocusService, { FocusStatus } from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
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

type AppItem = InstalledApp & { rule?: AppRule };
const CARD_H = 80;

// ─── PulseDot ─────────────────────────────────────────────────────────────────
function PulseDot({ color = "#7B6EF6" }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  }, []);
  return (
    <View style={st.pulseDotWrap}>
      <Animated.View
        style={[
          st.pulseDotGlow,
          { transform: [{ scale }], opacity, backgroundColor: color + "50" },
        ]}
      />
      <View style={[st.pulseDotCore, { backgroundColor: color }]} />
    </View>
  );
}

// ─── VPN status pill ──────────────────────────────────────────────────────────
function VpnPill({
  active,
  locked,
  onPress,
}: {
  active: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const animVal = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(animVal, {
      toValue: active ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [active]);

  const bg = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: ["#120810", "#081210"],
  });
  const border = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: ["#2A1020", "#0E3A28"],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={locked ? 1 : 0.8}>
      <Animated.View
        style={[st.vpnPill, { backgroundColor: bg, borderColor: border }]}
      >
        <View
          style={[
            st.vpnDot,
            {
              backgroundColor: locked
                ? "#3A3A5A"
                : active
                  ? "#3DDB8A"
                  : "#D04070",
            },
          ]}
        />
        <Text
          style={[
            st.vpnPillText,
            { color: locked ? "#3A3A5A" : active ? "#3DDB8A" : "#D04070" },
          ]}
        >
          VPN {active ? "ON" : "OFF"}
        </Text>
        {locked && <Text style={st.vpnLockGlyph}>◈</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── AppCard ──────────────────────────────────────────────────────────────────
const AppCard = React.memo(
  ({
    item,
    onToggle,
    onPress,
    locked,
    isFreeLimitReached,
  }: {
    item: AppItem;
    onToggle: (item: AppItem) => void;
    onPress: (pkg: string) => void;
    locked: boolean;
    isFreeLimitReached: boolean;
  }) => {
    const blocked = item.rule?.isBlocked ?? false;
    const cannotBlock = !blocked && isFreeLimitReached && !locked;

    return (
      <TouchableOpacity
        style={[
          st.appRow,
          blocked && st.appRowBlocked,
          locked && st.appRowLocked,
        ]}
        onPress={() => onPress(item.packageName)}
        activeOpacity={0.75}
      >
        {/* Accent gauche si bloqué */}
        {blocked && <View style={st.accentBar} />}

        {/* Icône */}
        <View style={[st.appIconWrap, blocked && st.appIconWrapBlocked]}>
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

        {/* Infos */}
        <View style={st.appInfo}>
          <Text
            style={[st.appName, blocked && st.appNameBlocked]}
            numberOfLines={1}
          >
            {item.appName}
          </Text>
          <Text style={st.appPkg} numberOfLines={1}>
            {item.packageName}
          </Text>
        </View>

        {/* Toggle */}
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
            {locked ? "◈" : cannotBlock ? "🔒" : blocked ? "Bloqué" : "Libre"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
  (p, n) =>
    p.item.packageName === n.item.packageName &&
    p.item.rule?.isBlocked === n.item.rule?.isBlocked &&
    p.item.icon === n.item.icon &&
    p.locked === n.locked &&
    p.isFreeLimitReached === n.isFreeLimitReached,
);

// ─── FreeLimitBanner ──────────────────────────────────────────────────────────
function FreeLimitBanner({
  current,
  max,
  onUpgrade,
}: {
  current: number;
  max: number;
  onUpgrade: () => void;
}) {
  if (current < max) return null;
  return (
    <TouchableOpacity
      style={st.limitBanner}
      onPress={onUpgrade}
      activeOpacity={0.85}
    >
      <View style={st.limitBannerIconWrap}>
        <Text style={st.limitBannerIcon}>◈</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.limitBannerTitle}>
          Limite atteinte — {current}/{max} apps
        </Text>
        <Text style={st.limitBannerSub}>
          Passez à Premium pour bloquer sans limite
        </Text>
      </View>
      <View style={st.limitBannerCta}>
        <Text style={st.limitBannerCtaText}>⚡ Pro</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, refresh: refreshPremium } = usePremium();

  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vpnActive, setVpnActive] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [systemAppsLoaded, setSystemAppsLoaded] = useState(false);
  const [systemAppsLoading, setSystemAppsLoading] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [focusStatus, setFocusStatus] = useState<FocusStatus | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<any>("general");
  const appStateRef = useRef(AppState.currentState);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-16)).current;
  const focusActive = focusStatus?.isActive ?? false;

  const limitReached =
    !isPremium && blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS;

  useEffect(() => {
    VpnService.isVpnActive().then(setVpnActive);
    loadInitial();
    checkFocus();
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 420,
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

  useEffect(() => {
    if (
      (filters.scope === "system" || filters.scope === "all") &&
      !systemAppsLoaded &&
      !systemAppsLoading
    )
      loadSystemAppsIfNeeded();
  }, [filters.scope]);

  const loadSystemAppsIfNeeded = async () => {
    if (systemAppsLoaded || systemAppsLoading) return;
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

  const checkFocus = async () => {
    try {
      const s = await FocusService.getStatus();
      setFocusStatus(s.isActive ? s : null);
    } catch {
      setFocusStatus(null);
    }
  };

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

  const filteredApps = useMemo(() => {
    let list = [...apps];
    if (filters.scope === "user") list = list.filter((a) => !a.isSystemApp);
    if (filters.scope === "system") list = list.filter((a) => !!a.isSystemApp);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }
    if (filters.state === "blocked")
      list = list.filter((a) => a.rule?.isBlocked === true);
    if (filters.state === "allowed")
      list = list.filter((a) => !a.rule?.isBlocked);
    return list;
  }, [apps, query, filters]);

  const toggleVpn = useCallback(async () => {
    if (focusActive) return;
    if (vpnActive) await VpnService.stopVpn();
    else await VpnService.startVpn();
    setVpnActive((v) => !v);
  }, [vpnActive, focusActive]);

  const showPaywall = (reason: any) => {
    setPaywallReason(reason);
    setPaywallVisible(true);
  };

  const toggleBlock = useCallback(
    async (item: AppItem) => {
      if (focusActive) return;
      const nowBlocked = !(item.rule?.isBlocked ?? false);
      if (
        nowBlocked &&
        !isPremium &&
        blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS
      ) {
        showPaywall("blocked_apps");
        return;
      }
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
    [focusActive, isPremium, blockedCount],
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
        isFreeLimitReached={limitReached}
      />
    ),
    [toggleBlock, handleAppPress, focusActive, limitReached],
  );

  if (loading) return <HomeScreenSkeleton />;

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07070F" />

      {/* ── Header ── */}
      <Animated.View
        style={[
          st.header,
          {
            paddingTop: insets.top + 14,
            opacity: headerFade,
            transform: [{ translateY: headerSlide }],
          },
        ]}
      >
        <View style={st.headerRow}>
          {/* Gauche : titre + sous-titre */}
          <View style={st.headerLeft}>
            <View style={st.titleRow}>
              <Text style={st.headerTitle}>NetOff</Text>
              {isPremium ? (
                <View style={st.premiumBadge}>
                  <Text style={st.premiumBadgeText}>PRO</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={st.freeBadge}
                  onPress={() => showPaywall("general")}
                  activeOpacity={0.8}
                >
                  <Text style={st.freeBadgeText}>FREE</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={st.headerSubRow}>
              {focusActive && <PulseDot />}
              <Text style={[st.headerSub, focusActive && st.headerSubFocus]}>
                {focusActive
                  ? "Session Focus active"
                  : `${blockedCount} bloquée${blockedCount > 1 ? "s" : ""}${!isPremium ? ` / ${FREE_LIMITS.MAX_BLOCKED_APPS}` : ""}`}
              </Text>
            </View>
          </View>

          {/* Droite : focus + VPN */}
          <View style={st.headerActions}>
            {/* Bouton Focus */}
            <TouchableOpacity
              style={[st.focusBtn, focusActive && st.focusBtnActive]}
              onPress={() => {
                if (!focusActive) setFocusVisible(true);
              }}
              activeOpacity={0.85}
            >
              {focusActive ? (
                <PulseDot color="#9B8FFF" />
              ) : (
                <Text style={st.focusBtnIcon}>◎</Text>
              )}
              <Text
                style={[st.focusBtnText, focusActive && st.focusBtnTextActive]}
              >
                {focusActive ? "Focus" : "Focus"}
              </Text>
            </TouchableOpacity>

            {/* Bouton VPN */}
            <VpnPill
              active={vpnActive}
              locked={focusActive}
              onPress={toggleVpn}
            />
          </View>
        </View>
      </Animated.View>

      {/* ── Liste ── */}
      <FlatList
        data={filteredApps}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        windowSize={13}
        contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 90 }]}
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
            {!isPremium && (
              <FreeLimitBanner
                current={blockedCount}
                max={FREE_LIMITS.MAX_BLOCKED_APPS}
                onUpgrade={() => showPaywall("blocked_apps")}
              />
            )}
            <SearchAndFilters
              query={query}
              onQueryChange={setQuery}
              filters={filters}
              onFiltersChange={setFilters}
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
            <Text style={st.emptyTitle}>Aucune application</Text>
            <Text style={st.emptySubtitle}>
              Modifiez votre recherche ou vos filtres
            </Text>
          </View>
        }
      />

      {/* ── FAB Settings ── */}
      <TouchableOpacity
        style={[
          st.fab,
          { bottom: insets.bottom + 22 },
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

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        reason={paywallReason}
        onUpgraded={() => {
          refreshPremium();
          refreshRules();
          setPaywallVisible(false);
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070F" },

  // ── Header
  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#111120",
    backgroundColor: "#07070F",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#EDEDFF",
    letterSpacing: -1.5,
  },
  freeBadge: {
    backgroundColor: "#16161E",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#252535",
  },
  freeBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#3A3A58",
    letterSpacing: 1.5,
  },
  premiumBadge: {
    backgroundColor: "#16103A",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  premiumBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#9B8FFF",
    letterSpacing: 1.5,
  },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerSub: { fontSize: 11, color: "#2E2E48", fontWeight: "600" },
  headerSubFocus: { color: "#7B6EF6", fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },

  // ── Focus button
  focusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#0F0F1A",
    borderWidth: 1,
    borderColor: "#1E1E30",
  },
  focusBtnActive: { backgroundColor: "#16103A", borderColor: "#7B6EF680" },
  focusBtnIcon: { fontSize: 12, color: "#4A4A68" },
  focusBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4A4A68",
    letterSpacing: 0.3,
  },
  focusBtnTextActive: { color: "#9B8FFF" },

  // ── VPN pill
  vpnPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  vpnDot: { width: 6, height: 6, borderRadius: 3 },
  vpnPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  vpnLockGlyph: { fontSize: 9, color: "#3A3A58", marginLeft: 2 },

  // ── PulseDot
  pulseDotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseDotCore: { width: 6, height: 6, borderRadius: 3, position: "absolute" },
  pulseDotGlow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
  },

  // ── List
  list: { paddingHorizontal: 18, paddingTop: 16 },
  countLabel: {
    fontSize: 9,
    color: "#1E1E30",
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 6,
  },

  // ── FreeLimitBanner
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#100C04",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3A2800",
    padding: 14,
    marginBottom: 14,
  },
  limitBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#1E1400",
    borderWidth: 1,
    borderColor: "#4A3400",
    justifyContent: "center",
    alignItems: "center",
  },
  limitBannerIcon: { fontSize: 16, color: "#C07010" },
  limitBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#C07010",
    marginBottom: 2,
  },
  limitBannerSub: { fontSize: 11, color: "#6A4A10" },
  limitBannerCta: {
    backgroundColor: "#7B6EF625",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#7B6EF640",
  },
  limitBannerCtaText: { fontSize: 11, fontWeight: "800", color: "#9B8FFF" },

  // ── AppCard
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0C0C16",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#141428",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 7,
    gap: 12,
    height: CARD_H,
    overflow: "hidden",
  },
  appRowBlocked: { backgroundColor: "#100810", borderColor: "#2A1020" },
  appRowLocked: { opacity: 0.5 },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
    backgroundColor: "#D04070",
  },
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#141420",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1E30",
    overflow: "hidden",
  },
  appIconWrapBlocked: { backgroundColor: "#180A10", borderColor: "#2A1020" },
  appIconImg: { width: 38, height: 38 },
  appIconText: { fontSize: 18, fontWeight: "700", color: "#4A4A68" },
  appInfo: { flex: 1 },
  appName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D8D8F0",
    marginBottom: 3,
  },
  appNameBlocked: { color: "#E8E8F8" },
  appPkg: { fontSize: 10, color: "#222238", fontFamily: "monospace" },

  // Toggle button
  blockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 64,
    alignItems: "center",
  },
  blockBtnOn: { backgroundColor: "#10060A", borderColor: "#3A1020" },
  blockBtnOff: { backgroundColor: "#06100A", borderColor: "#0E2A18" },
  blockBtnLocked: { backgroundColor: "#0E0E18", borderColor: "#161626" },
  blockBtnText: { fontSize: 11, fontWeight: "700" },
  blockBtnTextOn: { color: "#C04060" },
  blockBtnTextOff: { color: "#2DB870" },
  blockBtnTextLocked: { color: "#222238", fontSize: 12 },

  // ── Empty
  empty: { alignItems: "center", paddingTop: 70 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#2A2460",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyIconText: { fontSize: 28, color: "#4A3A9A" },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#C0C0D8",
    marginBottom: 6,
  },
  emptySubtitle: { fontSize: 12, color: "#2A2A48" },

  // ── FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#3A3480",
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
  fabLocked: { backgroundColor: "#0E0E18", borderColor: "#141426" },
  fabText: { fontSize: 20, color: "#7B6EF6" },
  fabTextLocked: { color: "#1E1E30" },
  fabLockDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#3A3480",
  },
});
