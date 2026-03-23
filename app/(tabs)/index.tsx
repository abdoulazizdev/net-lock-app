import FocusBanner, { FocusFullScreen } from "@/components/FocusBanner";
import FocusModal from "@/components/FocusModal";
import HomeScreenSkeleton from "@/components/HomeScreenSkeleton";
import PaywallModal from "@/components/PaywallModal";
import QuickTimerModal from "@/components/QuickTimerModal";
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
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppItem = InstalledApp & { rule?: AppRule };
const CARD_H = 64;

// ─── PulseDot ─────────────────────────────────────────────────────────────────
const PulseDot = React.memo(function PulseDot({ color }: { color: string }) {
  const s = useRef(new Animated.Value(1)).current;
  const o = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(s, {
            toValue: 2.0,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(s, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(o, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(o, {
            toValue: 0.6,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  }, []);
  return (
    <View style={g.dotWrap}>
      <Animated.View
        style={[
          g.dotRing,
          {
            transform: [{ scale: s }],
            opacity: o,
            backgroundColor: color + "40",
          },
        ]}
      />
      <View style={[g.dotCore, { backgroundColor: color }]} />
    </View>
  );
});

// ─── VPN toggle ───────────────────────────────────────────────────────────────
const VpnToggle = React.memo(function VpnToggle({
  active,
  locked,
  onPress,
}: {
  active: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active]);

  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.vpnOff.bg, t.vpnOn.bg],
  });
  const border = anim.interpolate({
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
    <TouchableOpacity onPress={onPress} activeOpacity={locked ? 1 : 0.7}>
      <Animated.View
        style={[
          g.vpnPill,
          { backgroundColor: bg, borderColor: border },
          locked && { opacity: 0.4 },
        ]}
      >
        <View style={[g.vpnDot, { backgroundColor: dotColor }]} />
        <Text style={[g.vpnLabel, { color: textColor }]}>
          VPN {active ? "ON" : "OFF"}
        </Text>
        {locked && (
          <Text
            style={[{ fontSize: 9, marginLeft: 2 }, { color: t.text.muted }]}
          >
            ◈
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Focus toggle pill ────────────────────────────────────────────────────────
const FocusToggle = React.memo(function FocusToggle({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active]);

  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.06)", "rgba(167,139,250,0.15)"],
  });
  const border = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.12)", "rgba(167,139,250,0.4)"],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Animated.View
        style={[g.focusPill, { backgroundColor: bg, borderColor: border }]}
      >
        {active ? (
          <PulseDot color={Colors.purple[200]} />
        ) : (
          <View style={g.focusCircle} />
        )}
        <Text
          style={[
            g.focusLabel,
            {
              color: active
                ? "rgba(167,139,250,0.9)"
                : "rgba(255,255,255,0.45)",
            },
          ]}
        >
          Focus {active ? "ON" : "OFF"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── More menu ────────────────────────────────────────────────────────────────
const MoreMenu = React.memo(function MoreMenu({
  visible,
  onClose,
  onSettings,
  onTimer,
}: {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
  onTimer: () => void;
}) {
  const { t } = useTheme();
  if (!visible) return null;
  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={g.menuOverlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                g.menuCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <TouchableOpacity
                style={[g.menuItem, { borderBottomColor: t.border.light }]}
                onPress={() => {
                  onClose();
                  onSettings();
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[g.menuIconWrap, { backgroundColor: t.bg.accent }]}
                >
                  <Text style={[g.menuIcon, { color: t.text.link }]}>⚙</Text>
                </View>
                <Text style={[g.menuLabel, { color: t.text.primary }]}>
                  Paramètres
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={g.menuItem}
                onPress={() => {
                  onClose();
                  onTimer();
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[g.menuIconWrap, { backgroundColor: t.bg.accent }]}
                >
                  <Text style={[g.menuIcon, { color: t.text.link }]}>⏱</Text>
                </View>
                <Text style={[g.menuLabel, { color: t.text.primary }]}>
                  Minuterie
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─── App row toggle ────────────────────────────────────────────────────────────
const AppToggle = React.memo(function AppToggle({
  blocked,
  locked,
  cannotBlock,
  onToggle,
}: {
  blocked: boolean;
  locked: boolean;
  cannotBlock: boolean;
  onToggle: () => void;
}) {
  const { t } = useTheme();
  const x = useRef(new Animated.Value(blocked ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(x, {
      toValue: blocked ? 1 : 0,
      tension: 320,
      friction: 24,
      useNativeDriver: false,
    }).start();
  }, [blocked]);

  const left = x.interpolate({ inputRange: [0, 1], outputRange: [3, 22] });

  if (locked)
    return (
      <View
        style={[
          sw.track,
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
        ]}
      >
        <View
          style={[sw.thumb, { left: 3, backgroundColor: t.border.normal }]}
        />
      </View>
    );

  if (cannotBlock)
    return (
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        activeOpacity={0.8}
      >
        <View
          style={[
            sw.track,
            {
              backgroundColor: t.bg.accent,
              borderColor: t.border.strong,
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <Text style={{ fontSize: 10 }}>🔒</Text>
        </View>
      </TouchableOpacity>
    );

  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      activeOpacity={0.85}
    >
      <View
        style={[
          sw.track,
          {
            backgroundColor: blocked ? t.blocked.bg : t.allowed.bg,
            borderColor: blocked ? t.blocked.border : t.allowed.border,
          },
        ]}
      >
        <Animated.View
          style={[
            sw.thumb,
            {
              left,
              backgroundColor: blocked ? t.blocked.accent : t.allowed.accent,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
});

const sw = StyleSheet.create({
  track: { width: 46, height: 25, borderRadius: 13, borderWidth: 1 },
  thumb: {
    position: "absolute",
    top: 3,
    width: 17,
    height: 17,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
});

// ─── AppCard ──────────────────────────────────────────────────────────────────
const AppCard = React.memo(
  function AppCard({
    item,
    onToggle,
    onPress,
    locked,
    limitReached,
  }: {
    item: AppItem;
    onToggle: (i: AppItem) => void;
    onPress: (p: string) => void;
    locked: boolean;
    limitReached: boolean;
  }) {
    const { t } = useTheme();
    const blocked = item.rule?.isBlocked ?? false;
    const cannotBlock = !blocked && limitReached && !locked;

    return (
      <TouchableOpacity
        style={[
          g.card,
          {
            backgroundColor: t.bg.card,
            borderColor: t.border.light,
            shadowColor: t.shadowColor,
            shadowOpacity: t.shadowOpacity,
          },
          blocked && {
            backgroundColor: t.blocked.bg,
            borderColor: t.blocked.border,
          },
          locked && { opacity: 0.52 },
        ]}
        onPress={() => onPress(item.packageName)}
        activeOpacity={0.72}
      >
        {blocked && (
          <View style={[g.accentBar, { backgroundColor: t.blocked.accent }]} />
        )}

        <View style={g.iconBox}>
          {item.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={g.iconImg}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                g.iconFallback,
                { backgroundColor: blocked ? t.blocked.bg : t.bg.accent },
              ]}
            >
              <Text
                style={[
                  g.iconLetter,
                  { color: blocked ? t.blocked.accent : t.text.link },
                ]}
              >
                {item.appName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={g.appInfo}>
          <Text
            style={[
              g.appName,
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
          <Text style={[g.appPkg, { color: t.text.muted }]} numberOfLines={1}>
            {item.packageName}
          </Text>
        </View>

        <AppToggle
          blocked={blocked}
          locked={locked}
          cannotBlock={cannotBlock}
          onToggle={() => !locked && onToggle(item)}
        />
      </TouchableOpacity>
    );
  },
  (p, n) =>
    p.item.packageName === n.item.packageName &&
    p.item.rule?.isBlocked === n.item.rule?.isBlocked &&
    p.item.icon === n.item.icon &&
    p.locked === n.locked &&
    p.limitReached === n.limitReached,
);

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, refresh: refreshPremium } = usePremium();
  const { t } = useTheme();

  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vpnActive, setVpnActive] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sysLoaded, setSysLoaded] = useState(false);
  const [sysLoading, setSysLoading] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [focusStatus, setFocusStatus] = useState<FocusStatus | null>(null);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<any>("general");
  const [menuVisible, setMenuVisible] = useState(false);
  const [timerVisible, setTimerVisible] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const focusActive = focusStatus?.isActive ?? false;
  const limitReached =
    !isPremium && blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS;

  // Mount animation
  const mountFade = useRef(new Animated.Value(0)).current;
  const mountSlide = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountFade, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(mountSlide, {
        toValue: 0,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      !sysLoaded &&
      !sysLoading
    )
      loadSysIfNeeded();
  }, [filters.scope]);

  const merge = useCallback(
    (list: InstalledApp[], rules: AppRule[]): AppItem[] => {
      const map = new Map(rules.map((r) => [r.packageName, r]));
      return list.map((a) => ({ ...a, rule: map.get(a.packageName) }));
    },
    [],
  );

  const loadSysIfNeeded = async () => {
    if (sysLoaded || sysLoading) return;
    setSysLoading(true);
    try {
      const [all, rules] = await Promise.all([
        AppListService.getInstalledApps(),
        StorageService.getRules(),
      ]);
      setApps(merge(all, rules));
      setSysLoaded(true);
    } catch {
    } finally {
      setSysLoading(false);
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
      const user = await AppListService.getNonSystemApps();
      setApps(merge(user, rules));
    } finally {
      setLoading(false);
    }
    setSysLoading(true);
    try {
      const [all, rules] = await Promise.all([
        AppListService.getInstalledApps(),
        StorageService.getRules(),
      ]);
      setApps(merge(all, rules));
      setSysLoaded(true);
    } catch {
    } finally {
      setSysLoading(false);
    }
  };

  const refreshRules = useCallback(async () => {
    const [rules, isVpn] = await Promise.all([
      StorageService.getRules(),
      VpnService.isVpnActive(),
    ]);
    setVpnActive(isVpn);
    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    setApps((prev) => merge(prev, rules));
  }, [merge]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshRules(), checkFocus()]);
    setRefreshing(false);
  }, [refreshRules]);

  const filteredApps = useMemo(() => {
    let list = [...apps];
    if (filters.scope === "user") list = list.filter((a) => !a.isSystemApp);
    if (filters.scope === "system")
      list = list.filter((a) => a.isSystemApp === true);
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

  const handleFocusPress = useCallback(() => {
    if (focusActive) setFocusExpanded(true);
    else setFocusVisible(true);
  }, [focusActive]);

  const showPaywall = (r: any) => {
    setPaywallReason(r);
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
      const patch = (b: boolean) => ({
        ...item,
        rule: {
          ...(item.rule ?? { packageName: item.packageName }),
          isBlocked: b,
        } as AppRule,
      });
      setApps((p) =>
        p.map((a) =>
          a.packageName === item.packageName ? patch(nowBlocked) : a,
        ),
      );
      setBlockedCount((c) => c + (nowBlocked ? 1 : -1));
      try {
        await VpnService.setRule(item.packageName, nowBlocked);
      } catch {
        setApps((p) =>
          p.map((a) =>
            a.packageName === item.packageName ? patch(!nowBlocked) : a,
          ),
        );
        setBlockedCount((c) => c + (nowBlocked ? -1 : 1));
      }
    },
    [focusActive, isPremium, blockedCount],
  );

  const handleAppPress = useCallback(
    (pkg: string) =>
      router.push({
        pathname: "/screens/app-detail",
        params: { packageName: pkg },
      }),
    [],
  );
  const keyExtractor = useCallback((i: AppItem) => i.packageName, []);
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
        limitReached={limitReached}
      />
    ),
    [toggleBlock, handleAppPress, focusActive, limitReached],
  );

  if (loading) return <HomeScreenSkeleton />;

  return (
    <View style={[g.root, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle={t.statusBar}
        backgroundColor="transparent"
        translucent
      />

      {/* ══ HEADER ══════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[
          g.header,
          { paddingTop: insets.top + 10, backgroundColor: Semantic.bg.header },
          { opacity: mountFade, transform: [{ translateY: mountSlide }] },
        ]}
      >
        {/* Gauche — logo + titre */}
        <View style={g.headerLeft}>
          <View
            style={[
              g.logoPill,
              {
                backgroundColor: t.headerBtnBg,
                borderColor: t.headerBtnBorder,
              },
            ]}
          >
            <Text style={g.logoText}>N</Text>
          </View>
          <Text style={g.title}>NetOff</Text>
        </View>

        {/* Centre — VPN + séparateur + Focus */}
        <View style={g.headerCenter}>
          <VpnToggle
            active={vpnActive}
            locked={focusActive}
            onPress={toggleVpn}
          />
          <View style={g.centerSep} />
          <FocusToggle active={focusActive} onPress={handleFocusPress} />
        </View>

        {/* Droite — badge FREE/PRO + séparateur + bouton ··· */}
        <View style={g.headerRight}>
          {isPremium ? (
            <View
              style={[
                g.proBadge,
                {
                  backgroundColor: Colors.purple.dark50,
                  borderColor: Colors.purple.dark100,
                },
              ]}
            >
              <Text style={[g.proBadgeText, { color: Colors.purple[400] }]}>
                PRO
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                g.freeBadge,
                {
                  backgroundColor: t.headerBtnBg,
                  borderColor: t.headerBtnBorder,
                },
              ]}
              onPress={() => showPaywall("general")}
              activeOpacity={0.75}
            >
              <Text style={[g.freeBadgeText, { color: t.headerBtnText }]}>
                FREE
              </Text>
            </TouchableOpacity>
          )}

          <View style={g.rightSep} />

          {/* Bouton ··· */}
          <TouchableOpacity
            style={[
              g.moreBtn,
              {
                backgroundColor: menuVisible ? t.bg.accent : t.headerBtnBg,
                borderColor: menuVisible ? t.border.strong : t.headerBtnBorder,
              },
            ]}
            onPress={() => setMenuVisible((v) => !v)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={g.moreDot} />
            <View style={g.moreDot} />
            <View style={g.moreDot} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ══ SUBHEADER — search + chips ═══════════════════════════════════════════ */}
      <View
        style={[
          g.subHeader,
          { backgroundColor: t.bg.card, borderBottomColor: t.border.light },
        ]}
      >
        {/* Focus banner compact */}
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

        {/* Limit strip */}
        {limitReached && (
          <TouchableOpacity
            style={[
              g.limitStrip,
              { backgroundColor: t.warning.bg, borderColor: t.warning.border },
            ]}
            onPress={() => showPaywall("blocked_apps")}
            activeOpacity={0.85}
          >
            <Text style={[g.limitStripText, { color: t.warning.text }]}>
              🔒 Limite atteinte · {blockedCount}/{FREE_LIMITS.MAX_BLOCKED_APPS}
            </Text>
            <Text style={[g.limitStripCta, { color: t.text.link }]}>Pro →</Text>
          </TouchableOpacity>
        )}

        <SearchAndFilters
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
          systemAppsLoaded={sysLoaded}
          systemAppsLoading={sysLoading}
        />
      </View>

      {/* ══ LIST ══════════════════════════════════════════════════════════════════ */}
      <FlatList
        data={filteredApps}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        windowSize={15}
        contentContainerStyle={[
          g.listContent,
          { paddingBottom: insets.bottom + 88 },
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
          <Text style={[g.listCount, { color: t.text.muted }]}>
            {filteredApps.length} app{filteredApps.length > 1 ? "s" : ""}
          </Text>
        }
        ListEmptyComponent={
          <View style={g.empty}>
            <View
              style={[
                g.emptyIconWrap,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={[g.emptyIcon, { color: t.text.link }]}>◈</Text>
            </View>
            <Text style={[g.emptyTitle, { color: t.text.secondary }]}>
              Aucune application
            </Text>
            <Text style={[g.emptySub, { color: t.text.muted }]}>
              Changez la recherche ou les filtres
            </Text>
          </View>
        }
      />

      {/* ══ MODALS ════════════════════════════════════════════════════════════════ */}
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
        reason={paywallReason}
        onClose={() => setPaywallVisible(false)}
        onUpgraded={() => {
          refreshPremium();
          refreshRules();
          setPaywallVisible(false);
        }}
      />

      {/* ══ MORE MENU ═════════════════════════════════════════════════════════════ */}
      <MoreMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSettings={() => router.push("/settings")}
        onTimer={() => setTimerVisible(true)}
      />

      {/* ══ QUICK TIMER ══════════════════════════════════════════════════════════ */}
      <QuickTimerModal
        visible={timerVisible}
        onClose={() => setTimerVisible(false)}
        onStarted={() => {
          checkFocus();
          refreshRules();
        }}
      />

      {/* FocusFullScreen */}
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
const g = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 14,
    paddingBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0f2d5e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  },

  // Gauche
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },

  // Centre
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 2,
    justifyContent: "center",
  },
  centerSep: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // Droite
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  rightSep: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  logoPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },

  // VPN pill (inchangé fonctionnellement)
  vpnPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  vpnDot: { width: 5, height: 5, borderRadius: 3 },
  vpnLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },

  // Focus pill
  focusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  focusCircle: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  focusLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },

  // Badges
  proBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  proBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  freeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  freeBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },

  // Bouton ···
  moreBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  moreDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  // Menu ···
  menuOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuCard: {
    position: "absolute",
    top: 90,
    right: 14,
    minWidth: 168,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIcon: { fontSize: 13 },
  menuLabel: { fontSize: 13, fontWeight: "600" },

  // PulseDot
  dotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dotCore: { width: 6, height: 6, borderRadius: 3, position: "absolute" },
  dotRing: { width: 10, height: 10, borderRadius: 5, position: "absolute" },

  // Subheader
  subHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  limitStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  limitStripText: { fontSize: 12, fontWeight: "600" },
  limitStripCta: { fontSize: 12, fontWeight: "700" },

  // List
  listContent: { paddingHorizontal: 14, paddingTop: 8 },
  listCount: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 8,
    paddingHorizontal: 2,
    opacity: 0.7,
  },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: CARD_H,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingLeft: 14,
    marginBottom: 6,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 2.5,
    borderRadius: 2,
  },
  iconBox: { marginRight: 11 },
  iconImg: { width: 40, height: 40, borderRadius: 10 },
  iconFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  iconLetter: { fontSize: 16, fontWeight: "800" },
  appInfo: { flex: 1, marginRight: 10 },
  appName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  appPkg: { fontSize: 10, fontFamily: "monospace", opacity: 0.7 },

  // Empty
  empty: { alignItems: "center", paddingTop: 72 },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 26 },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  emptySub: { fontSize: 12, opacity: 0.7 },
});
