import FocusBanner, { FocusFullScreen } from "@/components/FocusBanner";
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
import { Colors, Semantic, useTheme } from "@/theme";
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
// Approximate card height for getItemLayout (padding 12*2 + icon 44 + margin 8)
const CARD_H = 68 + 8;

// ─── PulseDot ─────────────────────────────────────────────────────────────────
function PulseDot({ color = Colors.purple[400] }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 2.4,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 1000,
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

// ─── VPN pill — soft frosted style ───────────────────────────────────────────
function VpnPill({
  active,
  locked,
  onPress,
}: {
  active: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const animVal = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(animVal, {
      toValue: active ? 1 : 0,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active]);

  const bg = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [t.vpnOff.bg, t.vpnOn.bg],
  });
  const border = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [t.vpnOff.border, t.vpnOn.border],
  });
  const dotColor = locked
    ? t.border.normal
    : active
      ? t.vpnOn.dot
      : t.vpnOff.dot;
  const textColor = locked
    ? t.text.muted
    : active
      ? t.vpnOn.text
      : t.vpnOff.text;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={locked ? 1 : 0.75}>
      <Animated.View
        style={[st.vpnPill, { backgroundColor: bg, borderColor: border }]}
      >
        <View style={[st.vpnDot, { backgroundColor: dotColor }]} />
        <Text style={[st.vpnPillText, { color: textColor }]}>
          VPN {active ? "ON" : "OFF"}
        </Text>
        {locked && (
          <Text style={{ fontSize: 9, color: t.text.muted, marginLeft: 2 }}>
            ◈
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── AppSwitch — exact ProfileDetailScreen style + spring on thumb ────────────
function AppSwitch({
  value,
  onToggle,
  locked,
  cannotBlock,
}: {
  value: boolean;
  onToggle: () => void;
  locked: boolean;
  cannotBlock: boolean;
}) {
  const { t } = useTheme();

  // Only the thumb position animates — keeps it simple like ProfileDetailScreen
  const thumbAnim = useRef(new Animated.Value(value ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(thumbAnim, {
      toValue: value ? 0 : 1, // 0 = flex-start (bloqué/gauche), 1 = flex-end (libre/droite)
      tension: 280,
      friction: 24,
      useNativeDriver: false,
    }).start();
  }, [value]);

  // Interpolate marginLeft (flex-start) and marginRight (flex-end) for smooth slide
  const marginLeft = thumbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 19],
  });
  const marginRight = thumbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [19, 2],
  });

  if (locked) {
    return (
      <View
        style={[
          sw.track,
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
        ]}
      >
        <View
          style={[
            sw.thumb,
            { alignSelf: "flex-start", backgroundColor: t.border.normal },
          ]}
        />
      </View>
    );
  }

  if (cannotBlock) {
    return (
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View
          style={[
            sw.track,
            {
              backgroundColor: t.bg.cardAlt,
              borderColor: t.border.light,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Text style={{ fontSize: 12 }}>🔒</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    >
      <View
        style={[
          sw.track,
          value
            ? { backgroundColor: t.blocked.bg, borderColor: t.blocked.border } // bloqué = rouge
            : { backgroundColor: t.allowed.bg, borderColor: t.allowed.border }, // libre = vert
        ]}
      >
        <Animated.View
          style={[
            sw.thumb,
            {
              marginLeft,
              marginRight,
              backgroundColor: value ? t.blocked.accent : t.allowed.accent,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const sw = StyleSheet.create({
  track: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    padding: 2,
    borderWidth: 1,
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});

// ─── AppCard — ProfileDetailScreen card style + soft shadow ──────────────────
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
    const { t } = useTheme();
    const blocked = item.rule?.isBlocked ?? false;
    const cannotBlock = !blocked && isFreeLimitReached && !locked;

    return (
      <TouchableOpacity
        style={[
          st.appRow,
          { backgroundColor: t.bg.card, borderColor: t.border.light },
          blocked && {
            backgroundColor: t.blocked.bg,
            borderColor: t.blocked.border,
          },
          locked && { opacity: 0.5 },
        ]}
        onPress={() => onPress(item.packageName)}
        activeOpacity={0.75}
      >
        {/* Left accent bar when blocked */}
        {blocked && (
          <View style={[st.accentBar, { backgroundColor: t.blocked.accent }]} />
        )}

        {/* Icon + badge overlay */}
        <View style={st.iconWrap}>
          {item.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={st.appIconImg}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                st.appIconFallback,
                {
                  backgroundColor: blocked
                    ? t.blocked.accent + "18"
                    : t.bg.accent,
                },
              ]}
            >
              <Text
                style={[
                  st.appIconLetter,
                  { color: blocked ? t.blocked.accent : t.text.link },
                ]}
              >
                {item.appName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Small dot badge on icon when blocked */}
          {blocked && (
            <View
              style={[
                st.blockedBadge,
                { backgroundColor: t.blocked.accent, borderColor: t.bg.card },
              ]}
            >
              <Text style={st.blockedBadgeText}>✕</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={st.appInfo}>
          <Text
            style={[
              st.appName,
              { color: t.text.primary },
              blocked && {
                color: t.text.secondary,
                textDecorationLine: "line-through",
              },
            ]}
            numberOfLines={1}
          >
            {item.appName}
          </Text>
          <Text style={[st.appPkg, { color: t.text.muted }]} numberOfLines={1}>
            {item.packageName}
          </Text>
        </View>

        {/* Switch */}
        <AppSwitch
          value={blocked}
          onToggle={() => !locked && onToggle(item)}
          locked={locked}
          cannotBlock={cannotBlock}
        />
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

// ─── FreeLimitBanner — soft amber tone ────────────────────────────────────────
function FreeLimitBanner({
  current,
  max,
  onUpgrade,
}: {
  current: number;
  max: number;
  onUpgrade: () => void;
}) {
  const { t } = useTheme();
  if (current < max) return null;
  return (
    <TouchableOpacity
      style={[
        st.limitBanner,
        { backgroundColor: t.warning.bg, borderColor: t.warning.border },
      ]}
      onPress={onUpgrade}
      activeOpacity={0.8}
    >
      <View
        style={[
          st.limitBannerDot,
          {
            backgroundColor: t.warning.accent + "30",
            borderColor: t.warning.border,
          },
        ]}
      >
        <Text style={{ fontSize: 13, color: t.warning.accent }}>◈</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.limitBannerTitle, { color: t.warning.text }]}>
          Limite atteinte · {current}/{max}
        </Text>
        <Text style={[st.limitBannerSub, { color: t.warning.accent }]}>
          Débloquer toutes les apps avec Premium
        </Text>
      </View>
      <View
        style={[
          st.limitBannerCta,
          { backgroundColor: t.bg.accent, borderColor: t.border.focus },
        ]}
      >
        <Text style={[{ fontSize: 10, fontWeight: "800", color: t.text.link }]}>
          ⚡ Pro
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, refresh: refreshPremium } = usePremium();
  const { t, isDark, mode, setMode } = useTheme();

  const THEME_CYCLE = ["auto", "light", "dark"] as const;
  const THEME_ICONS = { auto: "◑", light: "◎", dark: "◉" } as const;
  const themeCycleAnim = useRef(new Animated.Value(1)).current;
  const handleThemeCycle = () => {
    const idx = THEME_CYCLE.indexOf(mode as any);
    setMode(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
    Animated.sequence([
      Animated.timing(themeCycleAnim, {
        toValue: 0.4,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(themeCycleAnim, {
        toValue: 1,
        tension: 280,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

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
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<any>("general");
  const appStateRef = useRef(AppState.currentState);
  const focusActive = focusStatus?.isActive ?? false;
  const limitReached =
    !isPremium && blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS;

  // Mount stagger
  const mountFade = useRef(new Animated.Value(0)).current;
  const mountSlide = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountFade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(mountSlide, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Data ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    VpnService.isVpnActive().then(setVpnActive);
    loadInitial();
    checkFocus();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && appStateRef.current !== "active") {
        refreshRules();
        checkFocus();
      }
      appStateRef.current = s;
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
        AppListService.getAllAppsWithIcons(),
        StorageService.getRules(),
      ]);
      setApps((prev) => mergeAppsRules(allApps, rules, prev));
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

  const mergeAppsRules = useCallback(
    (
      incoming: InstalledApp[],
      rules: AppRule[],
      existing?: AppItem[],
    ): AppItem[] => {
      const ruleMap = new Map(rules.map((r) => [r.packageName, r]));
      const iconMap = new Map(
        (existing ?? []).map((a) => [a.packageName, a.icon]),
      );
      return incoming.map((a) => ({
        ...a,
        icon: a.icon ?? iconMap.get(a.packageName) ?? null,
        rule: ruleMap.get(a.packageName),
      }));
    },
    [],
  );

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [rules, isVpn] = await Promise.all([
        StorageService.getRules(),
        VpnService.isVpnActive(),
      ]);
      setVpnActive(isVpn);
      setBlockedCount(rules.filter((r) => r.isBlocked).length);
      const light = await AppListService.getNonSystemApps();
      setApps((prev) => mergeAppsRules(light, rules, prev));
      setLoading(false);
      AppListService.getNonSystemAppsWithIcons()
        .then((full) =>
          StorageService.getRules().then((r) =>
            setApps((prev) => mergeAppsRules(full, r, prev)),
          ),
        )
        .catch(() => {});
    } catch {
      setLoading(false);
    }
    setSystemAppsLoading(true);
    AppListService.getAllAppsWithIcons()
      .then((all) =>
        StorageService.getRules().then((rules) => {
          setApps((prev) => mergeAppsRules(all, rules, prev));
          setSystemAppsLoaded(true);
        }),
      )
      .catch(() => {})
      .finally(() => setSystemAppsLoading(false));
  };

  const refreshRules = useCallback(async () => {
    const [rules, isVpn] = await Promise.all([
      StorageService.getRules(),
      VpnService.isVpnActive(),
    ]);
    setVpnActive(isVpn);
    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    setApps((prev) => mergeAppsRules(prev, rules, prev));
  }, [mergeAppsRules]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    AppListService.invalidateCache();
    await Promise.all([loadInitial(), checkFocus()]);
    setRefreshing(false);
  }, []);

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
    (_: unknown, i: number) => ({
      length: CARD_H,
      offset: CARD_H * i,
      index: i,
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
    <View style={[st.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── Header — deep blue with soft gradient feel ── */}
      <Animated.View
        style={[
          st.header,
          { paddingTop: insets.top + 14 },
          { opacity: mountFade, transform: [{ translateY: mountSlide }] },
        ]}
      >
        {/* Row 1 */}
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            {/* Logo mark */}
            <View style={st.logoMark}>
              <Text style={st.logoMarkText}>N</Text>
            </View>
            <View>
              <Text style={st.headerTitle}>NetOff</Text>
              <Text style={st.headerEyebrow}>Gestionnaire réseau</Text>
            </View>
            <TouchableOpacity
              onPress={handleThemeCycle}
              activeOpacity={0.7}
              style={st.themeCycleBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Animated.Text
                style={[
                  st.themeCycleIcon,
                  { transform: [{ scale: themeCycleAnim }] },
                ]}
              >
                {THEME_ICONS[mode as keyof typeof THEME_ICONS] ??
                  (isDark ? "◉" : "◎")}
              </Animated.Text>
            </TouchableOpacity>
          </View>

          <View style={st.headerRight}>
            {isPremium ? (
              <View style={st.premiumBadge}>
                <Text style={st.premiumBadgeText}>PRO</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={st.freeBadge}
                onPress={() => showPaywall("general")}
                activeOpacity={0.75}
              >
                <Text style={st.freeBadgeText}>FREE</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Row 2 — stat pills */}
        <View style={st.headerStats}>
          {/* Blocked count pill */}
          <View style={st.statPill}>
            <View
              style={[
                st.statDot,
                {
                  backgroundColor:
                    blockedCount > 0 ? "#f87171" : "rgba(255,255,255,.3)",
                },
              ]}
            />
            <Text style={st.statPillText}>
              {blockedCount} bloquée{blockedCount > 1 ? "s" : ""}
              {!isPremium ? ` · max ${FREE_LIMITS.MAX_BLOCKED_APPS}` : ""}
            </Text>
          </View>

          <View style={st.headerStatsDivider} />

          {/* Focus pill */}
          <TouchableOpacity
            style={[st.statPill, focusActive && st.statPillFocus]}
            onPress={() => {
              if (!focusActive) setFocusVisible(true);
            }}
            activeOpacity={0.8}
          >
            {focusActive ? (
              <PulseDot color={Colors.purple[200]} />
            ) : (
              <Text style={[st.statPillIcon, { opacity: 0.6 }]}>◎</Text>
            )}
            <Text
              style={[
                st.statPillText,
                focusActive && { color: Colors.purple[100], fontWeight: "700" },
              ]}
            >
              {focusActive ? "Focus actif" : "Focus"}
            </Text>
          </TouchableOpacity>

          <View style={st.headerStatsDivider} />

          {/* VPN pill */}
          <VpnPill
            active={vpnActive}
            locked={focusActive}
            onPress={toggleVpn}
          />
        </View>
      </Animated.View>

      {/* ── Sticky bar ── */}
      <View
        style={[
          st.stickyBar,
          { backgroundColor: t.bg.page, borderBottomColor: t.border.light },
        ]}
      >
        {focusActive && focusStatus && (
          <FocusBanner
            status={focusStatus}
            onStopped={() => {
              setFocusStatus(null);
              setFocusExpanded(false);
              refreshRules();
            }}
            expanded={focusExpanded}
            onToggleExpand={() => setFocusExpanded((v) => !v)}
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
        style={st.list}
        contentContainerStyle={[
          st.listContent,
          { paddingBottom: insets.bottom + 96 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={t.refreshTint}
            colors={[t.refreshTint]}
            progressBackgroundColor={t.bg.card}
          />
        }
        ListHeaderComponent={
          <Text style={[st.countLabel, { color: t.text.muted }]}>
            {filteredApps.length} application
            {filteredApps.length > 1 ? "s" : ""}
          </Text>
        }
        ListEmptyComponent={
          <View style={st.empty}>
            <View
              style={[
                st.emptyIconWrap,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={[st.emptyIconText, { color: t.text.link }]}>◈</Text>
            </View>
            <Text style={[st.emptyTitle, { color: t.text.secondary }]}>
              Aucune application
            </Text>
            <Text style={[st.emptySubtitle, { color: t.text.muted }]}>
              Modifiez votre recherche ou vos filtres
            </Text>
          </View>
        }
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[
          st.fab,
          { bottom: insets.bottom + 24 },
          focusActive && { opacity: 0.45 },
        ]}
        onPress={() => {
          if (!focusActive) router.push("/settings");
        }}
        activeOpacity={focusActive ? 1 : 0.8}
      >
        <Text style={st.fabText}>◈</Text>
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
      {focusActive && focusStatus && (
        <FocusFullScreen
          status={focusStatus}
          onStopped={() => {
            setFocusStatus(null);
            setFocusExpanded(false);
            refreshRules();
          }}
          visible={focusExpanded}
          onClose={() => setFocusExpanded(false)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: Semantic.bg.header,
    // Deep diffuse shadow instead of hard line
    shadowColor: "#0f2d5e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },

  // Logo mark — small frosted square
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoMarkText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.5,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.6,
    lineHeight: 22,
  },
  headerEyebrow: {
    fontSize: 9,
    fontWeight: "500",
    color: "rgba(255,255,255,.5)",
    letterSpacing: 0.4,
    marginTop: 1,
  },
  themeCycleBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  themeCycleIcon: { fontSize: 13, color: "rgba(255,255,255,.6)" },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  freeBadge: {
    backgroundColor: "rgba(255,255,255,.12)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
  },
  freeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,.7)",
    letterSpacing: 1.5,
  },
  premiumBadge: {
    backgroundColor: Colors.purple[50],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.purple[200],
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.purple[600],
    letterSpacing: 1.5,
  },

  // Stat pills row
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    backgroundColor: "rgba(255,255,255,.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  headerStatsDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,.18)",
    marginHorizontal: 2,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statPillFocus: {
    backgroundColor: "rgba(167,139,250,.18)",
  },
  statDot: { width: 5, height: 5, borderRadius: 3 },
  statPillIcon: { fontSize: 10, color: "rgba(255,255,255,.8)" },
  statPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,.85)",
    letterSpacing: 0.1,
  },

  vpnPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  vpnDot: { width: 5, height: 5, borderRadius: 3 },
  vpnPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },

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

  // ── Sticky bar ──────────────────────────────────────────────────────────────
  stickyBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // ── List ────────────────────────────────────────────────────────────────────
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  countLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 2,
    paddingHorizontal: 4,
    opacity: 0.6,
  },

  // ── App cards — ProfileDetailScreen style ───────────────────────────────────
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    paddingLeft: 16,
    marginBottom: 8,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  iconWrap: {
    position: "relative",
    marginRight: 12,
  },
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  appIconImg: { width: 44, height: 44, borderRadius: 12 },
  appIconFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  appIconLetter: { fontSize: 18, fontWeight: "800" },
  blockedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  blockedBadgeText: { fontSize: 7, color: "#fff", fontWeight: "800" },
  appInfo: { flex: 1, minWidth: 0, marginRight: 12 },
  appName: { fontSize: 13, fontWeight: "600", marginBottom: 3 },
  appPkg: { fontSize: 10, fontFamily: "monospace", opacity: 0.7 },

  // ── Banners ─────────────────────────────────────────────────────────────────
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  limitBannerDot: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  limitBannerTitle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  limitBannerSub: { fontSize: 10, opacity: 0.8 },
  limitBannerCta: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  empty: { alignItems: "center", paddingTop: 72 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyIconText: { fontSize: 28 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptySubtitle: { fontSize: 12, opacity: 0.6 },

  // ── FAB — pill shape, very soft shadow ──────────────────────────────────────
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Semantic.bg.header,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0f2d5e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  fabText: { fontSize: 22, color: "#fff" },
});
