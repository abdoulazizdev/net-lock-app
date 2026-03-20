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
const CARD_H = 80;

// ─── PulseDot ─────────────────────────────────────────────────────────────────
function PulseDot({ color = Colors.purple[400] }: { color?: string }) {
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
          { transform: [{ scale }], opacity, backgroundColor: color + "40" },
        ]}
      />
      <View style={[st.pulseDotCore, { backgroundColor: color }]} />
    </View>
  );
}

// ─── VPN pill ─────────────────────────────────────────────────────────────────
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
      duration: 280,
      easing: Easing.out(Easing.ease),
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
    <TouchableOpacity onPress={onPress} activeOpacity={locked ? 1 : 0.8}>
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
        {blocked && (
          <View style={[st.accentBar, { backgroundColor: t.blocked.accent }]} />
        )}
        <View
          style={[
            st.appIconWrap,
            { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            blocked && {
              backgroundColor: t.blocked.bg,
              borderColor: t.blocked.border,
            },
          ]}
        >
          {item.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={st.appIconImg}
              resizeMode="contain"
            />
          ) : (
            <Text
              style={[
                st.appIconText,
                { color: blocked ? t.blocked.accent : t.text.muted },
              ]}
            >
              {item.appName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={st.appInfo}>
          <Text
            style={[
              st.appName,
              { color: t.text.primary },
              blocked && { color: t.text.secondary },
            ]}
            numberOfLines={1}
          >
            {item.appName}
          </Text>
          <Text
            style={[st.appPkg, { color: t.border.strong }]}
            numberOfLines={1}
          >
            {item.packageName}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            st.blockBtn,
            blocked
              ? { backgroundColor: t.blocked.bg, borderColor: t.blocked.border }
              : {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
            locked && {
              backgroundColor: t.bg.cardAlt,
              borderColor: t.border.light,
            },
          ]}
          onPress={() => !locked && onToggle(item)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          activeOpacity={locked ? 1 : 0.8}
        >
          <Text
            style={[
              st.blockBtnText,
              blocked ? { color: t.blocked.text } : { color: t.allowed.text },
              locked && { color: t.text.muted, fontSize: 12 },
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
  const { t } = useTheme();
  if (current < max) return null;
  return (
    <TouchableOpacity
      style={[
        st.limitBanner,
        { backgroundColor: t.warning.bg, borderColor: t.warning.border },
      ]}
      onPress={onUpgrade}
      activeOpacity={0.85}
    >
      <View
        style={[
          st.limitBannerIconWrap,
          { backgroundColor: t.warning.bg, borderColor: t.warning.border },
        ]}
      >
        <Text style={[st.limitBannerIcon, { color: t.warning.accent }]}>◈</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.limitBannerTitle, { color: t.warning.text }]}>
          Limite atteinte — {current}/{max} apps
        </Text>
        <Text style={[st.limitBannerSub, { color: t.warning.accent }]}>
          Passez à Premium pour bloquer sans limite
        </Text>
      </View>
      <View
        style={[
          st.limitBannerCta,
          { backgroundColor: t.bg.accent, borderColor: t.border.strong },
        ]}
      >
        <Text style={[st.limitBannerCtaText, { color: t.text.link }]}>
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
  const themeCycleAnim = useRef(new Animated.Value(1)).current;
  const THEME_CYCLE = ["auto", "light", "dark"] as const;
  const THEME_ICONS = { auto: "◑", light: "◎", dark: "◉" } as const;
  const handleThemeCycle = () => {
    const idx = THEME_CYCLE.indexOf(mode as "auto" | "light" | "dark");
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setMode(next);
    Animated.sequence([
      Animated.timing(themeCycleAnim, {
        toValue: 0.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(themeCycleAnim, {
        toValue: 1,
        tension: 200,
        friction: 8,
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

  // Merge apps + rules en PRÉSERVANT les icônes déjà chargées dans le state
  const mergeAppsRules = useCallback(
    (
      incoming: InstalledApp[],
      rules: AppRule[],
      existing?: AppItem[], // state courant — pour récupérer les icônes
    ): AppItem[] => {
      const ruleMap = new Map(rules.map((r) => [r.packageName, r]));
      const iconMap = new Map(
        (existing ?? []).map((a) => [a.packageName, a.icon]),
      );
      return incoming.map((a) => ({
        ...a,
        // Priorité : icône de l'app entrante, sinon icône déjà en state
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

      // Phase 1 — apps utilisateur SANS icônes → affichage immédiat (< 200ms)
      const userAppsLight = await AppListService.getNonSystemApps();
      setApps((prev) => mergeAppsRules(userAppsLight, rules, prev));
      setLoading(false);

      // Phase 2 — apps utilisateur AVEC icônes → enrichissement silencieux
      AppListService.getNonSystemAppsWithIcons()
        .then((userAppsFull) =>
          StorageService.getRules().then((r) =>
            setApps((prev) => mergeAppsRules(userAppsFull, r, prev)),
          ),
        )
        .catch(() => {});
    } catch {
      setLoading(false);
    }

    // Phase 3 — toutes les apps (+ système) AVEC icônes en arrière-plan
    setSystemAppsLoading(true);
    AppListService.getAllAppsWithIcons()
      .then((allApps) =>
        StorageService.getRules().then((rules) => {
          setApps((prev) => mergeAppsRules(allApps, rules, prev));
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
    // Préserve les icônes — ne remplace que les règles
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
    <View style={[st.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* ── Header (toujours bleu) ── */}
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
        {/* ── Ligne 1 : logo à gauche, actions à droite ── */}
        <View style={st.headerRow}>
          {/* Logo + thème + badge — rétrécissable si besoin */}
          <View style={st.headerLeft}>
            <Text style={st.headerTitle}>NetOff</Text>
            <TouchableOpacity
              onPress={handleThemeCycle}
              activeOpacity={0.7}
              style={st.themeCycleBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

          {/* Actions : Focus + VPN — taille fixe, ne rétrécissent jamais */}
          <View style={st.headerActions}>
            <TouchableOpacity
              style={[
                st.focusBtn,
                focusActive && {
                  backgroundColor: Colors.purple[50],
                  borderColor: Colors.purple[200],
                },
              ]}
              onPress={() => {
                if (!focusActive) setFocusVisible(true);
              }}
              activeOpacity={0.85}
            >
              {focusActive ? (
                <PulseDot color={Colors.purple[100]} />
              ) : (
                <Text style={st.focusBtnIcon}>◎</Text>
              )}
              <Text
                style={[
                  st.focusBtnText,
                  focusActive && { color: Colors.purple[600] },
                ]}
              >
                Focus
              </Text>
            </TouchableOpacity>
            <VpnPill
              active={vpnActive}
              locked={focusActive}
              onPress={toggleVpn}
            />
          </View>
        </View>

        {/* ── Ligne 2 : état de session ── */}
        <View style={st.headerSubRow}>
          {focusActive && <PulseDot color={Colors.purple[100]} />}
          <Text
            style={[st.headerSub, focusActive && st.headerSubFocus]}
            numberOfLines={1}
          >
            {focusActive
              ? "Session Focus active"
              : `${blockedCount} app${blockedCount > 1 ? "s" : ""} bloquée${blockedCount > 1 ? "s" : ""}${!isPremium ? ` · max ${FREE_LIMITS.MAX_BLOCKED_APPS}` : ""}`}
          </Text>
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
            tintColor={t.refreshTint}
            colors={[t.refreshTint]}
            progressBackgroundColor={t.bg.card}
          />
        }
        ListHeaderComponent={
          <View>
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
            <Text style={[st.countLabel, { color: t.text.muted }]}>
              {filteredApps.length} application
              {filteredApps.length > 1 ? "s" : ""}
            </Text>
          </View>
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
          { bottom: insets.bottom + 22 },
          focusActive && { backgroundColor: t.bg.cardAlt, shadowOpacity: 0 },
        ]}
        onPress={() => {
          if (!focusActive) router.push("/settings");
        }}
        activeOpacity={focusActive ? 1 : 0.85}
      >
        <Text style={[st.fabText, focusActive && { color: t.text.muted }]}>
          ◈
        </Text>
        {focusActive && (
          <View style={[st.fabLockDot, { backgroundColor: t.border.strong }]} />
        )}
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
      {/* Plein écran Focus — hors FlatList pour éviter le clipping */}
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

// ─── Styles statiques (layout) ────────────────────────────────────────────────
// Les couleurs sont injectées inline via useTheme().t — seul le layout est ici.
const st = StyleSheet.create({
  container: { flex: 1 },

  // Header (toujours bleu — Semantic.bg.header)
  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: Semantic.bg.header,
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  // ── Ligne 1 ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  // Gauche : shrink autorisé — cède de l'espace si les actions en ont besoin
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1, // rétrécit si l'écran est étroit
    marginRight: 8,
    minWidth: 0, // permet au texte de se couper
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -1,
    flexShrink: 0, // "NetOff" ne se compresse jamais
  },
  themeCycleBtn: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  themeCycleIcon: { fontSize: 15, color: "rgba(255,255,255,.65)" },
  freeBadge: {
    backgroundColor: "rgba(255,255,255,.15)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    flexShrink: 0,
  },
  freeBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.blue[100],
    letterSpacing: 1.2,
  },
  premiumBadge: {
    backgroundColor: Colors.purple[50],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.purple[100],
    flexShrink: 0,
  },
  premiumBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: Colors.purple[600],
    letterSpacing: 1.2,
  },
  // Droite : ne rétrécit jamais
  headerActions: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    flexShrink: 0,
  },
  focusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
  },
  focusBtnIcon: { fontSize: 11, color: Colors.blue[100] },
  focusBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.blue[100],
    letterSpacing: 0.2,
  },

  // ── Ligne 2 ──────────────────────────────────────────────────────────────
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerSub: {
    fontSize: 11,
    color: Colors.blue[200],
    fontWeight: "600",
    flexShrink: 1,
  },
  headerSubFocus: { color: Colors.purple[100], fontWeight: "700" },

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

  list: { paddingHorizontal: 16, paddingTop: 16 },
  countLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 6,
  },

  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  limitBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  limitBannerIcon: { fontSize: 16 },
  limitBannerTitle: { fontSize: 12, fontWeight: "800", marginBottom: 2 },
  limitBannerSub: { fontSize: 11 },
  limitBannerCta: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  limitBannerCtaText: { fontSize: 11, fontWeight: "800" },

  appRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 7,
    gap: 12,
    height: CARD_H,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  appIconImg: { width: 38, height: 38 },
  appIconText: { fontSize: 18, fontWeight: "700" },
  appInfo: { flex: 1 },
  appName: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  appPkg: { fontSize: 10, fontFamily: "monospace" },
  blockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 64,
    alignItems: "center",
  },
  blockBtnText: { fontSize: 11, fontWeight: "700" },

  empty: { alignItems: "center", paddingTop: 70 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyIconText: { fontSize: 28 },
  emptyTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  emptySubtitle: { fontSize: 12 },

  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Semantic.bg.header,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontSize: 22, color: Colors.gray[0] },
  fabLockDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
