import FocusBanner from "@/components/FocusBanner";
import FocusModal from "@/components/FocusModal";
import HomeScreenSkeleton from "@/components/HomeScreenSkeleton";
import { MoreMenu } from "@/components/MoreMenu";
import PaywallModal from "@/components/PaywallModal";
import QuickTimerModal from "@/components/QuickTimerModal";
import SearchAndFilters, {
  DEFAULT_FILTERS,
  Filters,
} from "@/components/SearchAndFilters";
import TimerBanner from "@/components/TimerBanner";
import { VpnActivationModal } from "@/components/VpnActivationModal";
import { VpnWarningBanner } from "@/components/VpnWarningBanner";
import { usePremium } from "@/hooks/usePremium";
import AllowlistService, { AllowlistState } from "@/services/allowlist.service";
import AppEvents from "@/services/app-events";
import AppListService from "@/services/app-list.service";
import FocusService, { FocusStatus } from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import TimerService, { TimerStatus } from "@/services/timer.service";
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
  Alert,
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
import FocusFullScreen from "../Focusfullscreen";

type AppItem = InstalledApp & { rule?: AppRule };
const CARD_H = 72;
const SORT_DEFER_MS = 1500;

function pkgHue(pkg: string) {
  return pkg.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

// ─── BlockedToast ──────────────────────────────────────────────────────────────
const BlockedToast = React.memo(function BlockedToast({
  appName,
  visible,
  onScrollTop,
  onDismiss,
  bottomInset,
}: {
  appName: string;
  visible: boolean;
  onScrollTop: () => void;
  onDismiss: () => void;
  bottomInset: number;
}) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 320,
          friction: 22,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 80,
          duration: 220,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        toast.wrap,
        { bottom: bottomInset + 100, transform: [{ translateY }], opacity },
      ]}
    >
      <View style={toast.inner}>
        <View style={toast.dot} />
        <Text style={toast.label} numberOfLines={1}>
          <Text style={toast.appName}>{appName}</Text>
          {" bloquée"}
        </Text>
        <TouchableOpacity
          style={toast.cta}
          onPress={() => {
            onScrollTop();
            onDismiss();
          }}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={toast.ctaText}>Voir ↑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={toast.close}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const toast = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99,
    alignItems: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(15,20,35,0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
    maxWidth: 400,
    alignSelf: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#f87171",
    flexShrink: 0,
  },
  label: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.75)" },
  appName: { fontWeight: "700", color: "#fff" },
  cta: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(248,113,113,0.18)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
  },
  ctaText: { fontSize: 11, fontWeight: "700", color: "#f87171" },
  close: { fontSize: 11, color: "rgba(255,255,255,0.35)", paddingLeft: 2 },
});

// ─── PulseDot ─────────────────────────────────────────────────────────────────
const PulseDot = React.memo(function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.9,
            duration: 850,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 850,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 850,
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
          { transform: [{ scale }], opacity, backgroundColor: color + "50" },
        ]}
      />
      <View style={[g.dotCore, { backgroundColor: color }]} />
    </View>
  );
});

// ─── MoreButton ───────────────────────────────────────────────────────────────
const MoreButton = React.memo(function MoreButton({
  active: menuActive,
  allowlistActive,
  onPress,
}: {
  active: boolean;
  allowlistActive: boolean;
  onPress: () => void;
}) {
  const borderAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: allowlistActive ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [allowlistActive]);
  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      menuActive ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.15)",
      "rgba(52,211,153,0.55)",
    ],
  });
  const bgColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      menuActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
      "rgba(52,211,153,0.12)",
    ],
  });
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View
        style={[g.moreBtn, { backgroundColor: bgColor, borderColor }]}
      >
        <View style={g.moreDot} />
        <View style={g.moreDot} />
        <View style={g.moreDot} />
        {allowlistActive && <View style={g.moreBtnIndicator} />}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── VpnToggle ────────────────────────────────────────────────────────────────
const VpnToggle = React.memo(function VpnToggle({
  active,
  locked,
  danger,
  onPress,
}: {
  active: boolean;
  locked: boolean;
  danger: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active]);
  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      danger ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.07)",
      "rgba(52,211,153,0.16)",
    ],
  });
  const border = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      danger ? "rgba(248,113,113,0.38)" : "rgba(255,255,255,0.14)",
      "rgba(52,211,153,0.42)",
    ],
  });
  const dotColor = locked
    ? "rgba(255,255,255,0.2)"
    : active
      ? "#34d399"
      : danger
        ? "#f87171"
        : "rgba(255,255,255,0.28)";
  const textColor = locked
    ? "rgba(255,255,255,0.28)"
    : active
      ? "#34d399"
      : danger
        ? "#f87171"
        : "rgba(255,255,255,0.5)";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.75}
      disabled={locked}
    >
      <Animated.View
        style={[
          g.controlPill,
          { backgroundColor: bg, borderColor: border },
          locked && { opacity: 0.45 },
        ]}
      >
        {active && !locked ? (
          <PulseDot color="#34d399" />
        ) : danger ? (
          <PulseDot color="#f87171" />
        ) : (
          <View style={[g.pillDot, { backgroundColor: dotColor }]} />
        )}
        <Text style={[g.pillLabel, { color: textColor }]}>VPN</Text>
        <Text style={[g.pillState, { color: textColor }]}>
          {active ? "ON" : "OFF"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── FocusToggle ──────────────────────────────────────────────────────────────
const FocusToggle = React.memo(function FocusToggle({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active]);
  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.07)", "rgba(167,139,250,0.18)"],
  });
  const border = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.14)", "rgba(167,139,250,0.45)"],
  });
  const dotColor = active ? Colors.purple[200] : "rgba(255,255,255,0.28)";
  const textColor = active ? Colors.purple[200] : "rgba(255,255,255,0.5)";
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Animated.View
        style={[g.controlPill, { backgroundColor: bg, borderColor: border }]}
      >
        {active ? (
          <PulseDot color={Colors.purple[300]} />
        ) : (
          <View style={[g.pillDot, { backgroundColor: dotColor }]} />
        )}
        <Text style={[g.pillLabel, { color: textColor }]}>Focus</Text>
        <Text style={[g.pillState, { color: textColor }]}>
          {active ? "ON" : "OFF"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── AppToggle ────────────────────────────────────────────────────────────────
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
      tension: 360,
      friction: 26,
      useNativeDriver: false,
    }).start();
  }, [blocked]);
  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 21],
  });
  if (locked)
    return (
      <View
        style={[
          sw.track,
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
        ]}
      >
        <View
          style={[sw.thumb, { left: 2, backgroundColor: t.border.normal }]}
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
          <Text style={{ fontSize: 11 }}>🔒</Text>
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
              transform: [{ translateX }],
              backgroundColor: blocked ? t.blocked.accent : t.allowed.accent,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
});

const sw = StyleSheet.create({
  track: { width: 48, height: 26, borderRadius: 13, borderWidth: 1 },
  thumb: {
    position: "absolute",
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 3,
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
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const hue = pkgHue(item.packageName);
    const iconColor = `hsl(${hue}, 60%, 62%)`;
    const pressIn = () =>
      Animated.spring(scaleAnim, {
        toValue: 0.972,
        tension: 400,
        friction: 18,
        useNativeDriver: true,
      }).start();
    const pressOut = () =>
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 400,
        friction: 18,
        useNativeDriver: true,
      }).start();
    return (
      <Animated.View
        style={[{ transform: [{ scale: scaleAnim }] }, { marginBottom: 5 }]}
      >
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
            locked && { opacity: 0.46 },
          ]}
          onPress={() => onPress(item.packageName)}
          onPressIn={pressIn}
          onPressOut={pressOut}
          activeOpacity={1}
        >
          {blocked && (
            <View
              style={[g.cardAccentBar, { backgroundColor: t.blocked.accent }]}
            />
          )}
          <View style={g.iconWrap}>
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
                  {
                    backgroundColor: iconColor + "1A",
                    borderColor: iconColor + "38",
                  },
                ]}
              >
                <Text style={[g.iconLetter, { color: iconColor }]}>
                  {item.appName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {item.isSystemApp && (
              <View
                style={[
                  g.sysBadge,
                  {
                    backgroundColor: t.bg.accent,
                    borderColor: t.border.strong,
                  },
                ]}
              >
                <Text style={[g.sysBadgeText, { color: t.text.muted }]}>
                  SYS
                </Text>
              </View>
            )}
          </View>
          <View style={g.cardInfo}>
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
            {blocked && (
              <View
                style={[
                  g.blockedTag,
                  {
                    backgroundColor: t.blocked.bg,
                    borderColor: t.blocked.border,
                  },
                ]}
              >
                <Text style={[g.blockedTagText, { color: t.blocked.accent }]}>
                  ● Bloquée
                </Text>
              </View>
            )}
          </View>
          <View style={g.cardActions}>
            <AppToggle
              blocked={blocked}
              locked={locked}
              cannotBlock={cannotBlock}
              onToggle={() => !locked && onToggle(item)}
            />
            <Text style={[g.cardChevron, { color: t.border.light }]}>›</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
  (p, n) =>
    p.item.packageName === n.item.packageName &&
    p.item.rule?.isBlocked === n.item.rule?.isBlocked &&
    p.item.icon === n.item.icon &&
    p.locked === n.locked &&
    p.limitReached === n.limitReached,
);

// ─── StatGroup ────────────────────────────────────────────────────────────────
const StatGroup = React.memo(function StatGroup({
  value,
  label,
  labelPlural,
  valueStyle,
}: {
  value: number;
  label: string;
  labelPlural?: string;
  valueStyle?: object;
}) {
  return (
    <View style={g.statGroup}>
      <Text
        style={[g.statBig, valueStyle]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text style={g.statTiny} numberOfLines={1}>
        {value > 1 && labelPlural ? labelPlural : label}
      </Text>
    </View>
  );
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────
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
  const [timerStatus, setTimerStatus] = useState<TimerStatus | null>(null);
  const [timerVisible, setTimerVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<any>("general");
  const [menuVisible, setMenuVisible] = useState(false);
  const [vpnWarningDismissed, setVpnWarningDismissed] = useState(false);
  const vpnPopupShown = useRef(false);
  const [vpnPopupVisible, setVpnPopupVisible] = useState(false);
  const [vpnPopupAppName, setVpnPopupAppName] = useState("");
  const appStateRef = useRef(AppState.currentState);
  const mountFade = useRef(new Animated.Value(0)).current;
  const mountSlide = useRef(new Animated.Value(18)).current;

  // ── Allowlist ──────────────────────────────────────────────────────────────
  const [allowlistState, setAllowlistState] = useState<AllowlistState>({
    enabled: false,
    packages: [],
  });

  // ── Deferred-sort ──────────────────────────────────────────────────────────
  const [pendingSort, setPendingSort] = useState(false);
  const sortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastVisible, setToastVisible] = useState(false);
  const [toastAppName, setToastAppName] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatListRef = useRef<FlatList<AppItem>>(null);

  const focusActive = focusStatus?.isActive ?? false;
  const timerActive = timerStatus?.isActive ?? false;
  const anyActive = focusActive || timerActive;
  const limitReached =
    !isPremium && blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS;
  const showVpnWarning =
    !vpnActive && blockedCount > 0 && !anyActive && !vpnWarningDismissed;
  const hasBanners =
    showVpnWarning || focusActive || timerActive || limitReached;
  const vpnDanger = !vpnActive && blockedCount > 0 && !anyActive;

  const TOAST_DURATION_MS = 4000;

  const showBlockedToast = useCallback((name: string) => {
    setToastAppName(name);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToastVisible(false),
      TOAST_DURATION_MS,
    );
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(false);
  }, []);

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const armSortTimer = useCallback(() => {
    if (sortTimerRef.current) clearTimeout(sortTimerRef.current);
    setPendingSort(true);
    sortTimerRef.current = setTimeout(
      () => setPendingSort(false),
      SORT_DEFER_MS,
    );
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountFade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(mountSlide, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      if (sortTimerRef.current) clearTimeout(sortTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

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

  const refreshRules = useCallback(async () => {
    const rules = await StorageService.getRules();
    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    setApps((prev) => mergeAppsRules(prev, rules, prev));
  }, [mergeAppsRules]);

  const refreshAllowlist = useCallback(async () => {
    const state = await AllowlistService.getState();
    setAllowlistState(state);
  }, []);

  const checkFocus = useCallback(async () => {
    try {
      const s = await FocusService.getStatus();
      setFocusStatus(s.isActive ? s : null);
    } catch {
      setFocusStatus(null);
    }
  }, []);

  const checkTimer = useCallback(async () => {
    try {
      const s = await TimerService.getStatus();
      setTimerStatus(s.isActive ? s : null);
    } catch {
      setTimerStatus(null);
    }
  }, []);

  const toggleVpn = useCallback(() => {
    if (anyActive) return;
    if (vpnActive) VpnService.stopVpn();
    else VpnService.startVpn();
  }, [vpnActive, anyActive]);

  // ── Disable allowlist from Home ────────────────────────────────────────────
  const handleDisableAllowlist = useCallback(() => {
    Alert.alert(
      "Désactiver la liste blanche ?",
      "Le blocage reviendra en mode normal (les apps cochées seront bloquées).",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: async () => {
            await AllowlistService.disable();
            const newState = await AllowlistService.getState();
            setAllowlistState(newState);
            AppEvents.emit("allowlist:changed", false);
            AppEvents.emit("rules:changed", undefined);
          },
        },
      ],
    );
  }, []);

  // ── Navigate to allowlist page ─────────────────────────────────────────────
  const handleOpenAllowlist = useCallback(() => {
    router.push("/screens/allowlist");
  }, []);

  useEffect(() => {
    const unsubVpn = AppEvents.on("vpn:changed", (active) => {
      setVpnActive(active);
      if (active) {
        setVpnWarningDismissed(false);
        setVpnPopupVisible(false);
      }
    });
    const unsubRules = AppEvents.on("rules:changed", () => refreshRules());
    const unsubFocus = AppEvents.on("focus:changed", (active) => {
      if (!active) {
        setFocusStatus(null);
        setFocusExpanded(false);
      } else {
        checkFocus();
        setFocusExpanded(true);
      }
    });
    const unsubTimer = AppEvents.on(
      "timer:changed" as any,
      (active: boolean) => {
        if (!active) setTimerStatus(null);
        else checkTimer();
      },
    );
    const unsubPremium = AppEvents.on("premium:changed", () =>
      refreshPremium(),
    );
    // ← Écouter les changements allowlist depuis n'importe quelle page
    const unsubAllowlist = AppEvents.on("allowlist:changed" as any, () =>
      refreshAllowlist(),
    );
    return () => {
      unsubVpn();
      unsubRules();
      unsubFocus();
      unsubTimer();
      unsubPremium();
      unsubAllowlist();
    };
  }, [refreshRules, checkFocus, checkTimer, refreshPremium, refreshAllowlist]);

  useEffect(() => {
    VpnService.isVpnActive().then(setVpnActive);
    loadInitial();
    checkFocus();
    checkTimer();
    refreshAllowlist();
    TimerService.rescheduleIfNeeded();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && appStateRef.current !== "active") {
        VpnService.isVpnActive().then(setVpnActive);
        refreshRules();
        checkFocus();
        checkTimer();
        refreshAllowlist();
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

  const loadSysIfNeeded = async () => {
    if (sysLoaded || sysLoading) return;
    setSysLoading(true);
    try {
      const rules = await StorageService.getRules();
      const all = await AppListService.getAllApps();
      setApps((prev) => mergeAppsRules(all, rules, prev));
      setSysLoaded(true);
      AppListService.getAllAppsWithIcons()
        .then((full) =>
          StorageService.getRules()
            .then((r) => setApps((prev) => mergeAppsRules(full, r, prev)))
            .catch(() => {}),
        )
        .catch(() => {});
    } catch {
    } finally {
      setSysLoading(false);
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
      const light = await AppListService.getNonSystemApps();
      setApps((prev) => mergeAppsRules(light, rules, prev));
      setLoading(false);
      AppListService.getNonSystemAppsWithIcons()
        .then((full) =>
          StorageService.getRules()
            .then((r) => setApps((prev) => mergeAppsRules(full, r, prev)))
            .catch(() => {}),
        )
        .catch(() => {});
    } catch {
      setLoading(false);
    }
    setSysLoading(true);
    AppListService.getAllAppsWithIcons()
      .then((all) =>
        StorageService.getRules()
          .then((rules) => {
            setApps((prev) => mergeAppsRules(all, rules, prev));
            setSysLoaded(true);
          })
          .catch(() => {}),
      )
      .catch(() => {})
      .finally(() => setSysLoading(false));
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPendingSort(false);
    if (sortTimerRef.current) clearTimeout(sortTimerRef.current);
    AppListService.invalidateCache();
    await Promise.all([
      loadInitial(),
      checkFocus(),
      checkTimer(),
      refreshAllowlist(),
    ]);
    setRefreshing(false);
  }, []);

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
    return list.sort((a, b) => {
      if (pendingSort) return a.appName.localeCompare(b.appName);
      const aB = a.rule?.isBlocked ? 1 : 0,
        bB = b.rule?.isBlocked ? 1 : 0;
      if (bB !== aB) return bB - aB;
      return a.appName.localeCompare(b.appName);
    });
  }, [apps, query, filters, pendingSort]);

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
      if (anyActive) return;
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
      setApps((prev) =>
        prev.map((a) =>
          a.packageName === item.packageName ? patch(nowBlocked) : a,
        ),
      );
      setBlockedCount((c) => c + (nowBlocked ? 1 : -1));
      if (nowBlocked) {
        armSortTimer();
        showBlockedToast(item.appName);
      } else {
        armSortTimer();
      }
      if (nowBlocked && !vpnActive && !vpnPopupShown.current) {
        vpnPopupShown.current = true;
        setVpnPopupAppName(item.appName);
        setVpnPopupVisible(true);
      }
      try {
        await VpnService.setRule(item.packageName, nowBlocked);
      } catch {
        setApps((prev) =>
          prev.map((a) =>
            a.packageName === item.packageName ? patch(!nowBlocked) : a,
          ),
        );
        setBlockedCount((c) => c + (nowBlocked ? -1 : 1));
      }
    },
    [
      anyActive,
      isPremium,
      blockedCount,
      vpnActive,
      armSortTimer,
      showBlockedToast,
    ],
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
  const renderItem = useCallback(
    ({ item }: { item: AppItem }) => (
      <AppCard
        item={item}
        onToggle={toggleBlock}
        onPress={handleAppPress}
        locked={anyActive}
        limitReached={limitReached}
      />
    ),
    [toggleBlock, handleAppPress, anyActive, limitReached],
  );

  if (loading) return <HomeScreenSkeleton />;

  const allowedCount = filteredApps.filter((a) => !a.rule?.isBlocked).length;
  const blockedInList = filteredApps.filter((a) => a.rule?.isBlocked).length;
  const blockedPct =
    filteredApps.length > 0
      ? Math.round((blockedInList / filteredApps.length) * 100)
      : 0;

  const ListHeader = (
    <View style={g.listHeader}>
      {/* ── Bannière allowlist — avec bouton désactiver et modifier ── */}
      {allowlistState.enabled && (
        <View style={g.allowlistBanner}>
          <View style={g.allowlistBannerDot} />
          <Text style={g.allowlistBannerText} numberOfLines={1}>
            Liste blanche ·{" "}
            <Text style={g.allowlistBannerCount}>
              {allowlistState.packages.length} app
              {allowlistState.packages.length > 1 ? "s" : ""}
            </Text>
          </Text>
          {/* Bouton Modifier → ouvre la page allowlist */}
          <TouchableOpacity
            onPress={handleOpenAllowlist}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Text style={g.allowlistBannerEdit}>Modifier ›</Text>
          </TouchableOpacity>
          {/* Séparateur */}
          <View style={g.allowlistBannerSep} />
          {/* Bouton Désactiver */}
          <TouchableOpacity
            onPress={handleDisableAllowlist}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Text style={g.allowlistBannerOff}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <SearchAndFilters
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onFiltersChange={setFilters}
        systemAppsLoaded={sysLoaded}
        systemAppsLoading={sysLoading}
      />
      <View style={g.listMeta}>
        <Text style={[g.listCount, { color: t.text.muted }]} numberOfLines={1}>
          {filteredApps.length} APP{filteredApps.length > 1 ? "S" : ""}
        </Text>
        {blockedInList > 0 && (
          <View style={g.blockedChip}>
            <View style={g.blockedChipDot} />
            <Text style={g.blockedChipText} numberOfLines={1}>
              {blockedInList} bloquée{blockedInList > 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={[g.root, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── Header ── */}
      <Animated.View
        style={[
          g.header,
          { paddingTop: insets.top + 10, backgroundColor: Semantic.bg.header },
          { opacity: mountFade, transform: [{ translateY: mountSlide }] },
        ]}
      >
        <View style={g.headerTopRow}>
          <View style={g.brandBlock}>
            <View style={g.logoMark}>
              <Text style={g.logoMarkText}>N</Text>
            </View>
            <View>
              <Text style={g.brandName}>NetOff</Text>
              <Text style={g.brandTagline}>contrôle réseau · local</Text>
            </View>
          </View>

          <View style={g.headerActions}>
            {isPremium ? (
              <View style={g.proBadge}>
                <Text style={g.proBadgeText}>✦ PRO</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={g.upgradeBtn}
                onPress={() => showPaywall("general")}
                activeOpacity={0.78}
              >
                <Text style={g.upgradeBtnIcon}>⚡</Text>
                <Text style={g.upgradeBtnText} numberOfLines={1}>
                  Passer Pro
                </Text>
              </TouchableOpacity>
            )}
            <View style={g.actionSep} />
            <MoreButton
              active={menuVisible}
              allowlistActive={allowlistState.enabled}
              onPress={() => setMenuVisible((v) => !v)}
            />
          </View>
        </View>

        <View style={g.headerBottomRow}>
          <View
            style={[
              g.statsBand,
              {
                backgroundColor: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.1)",
              },
            ]}
          >
            <StatGroup
              value={filteredApps.length}
              label="app"
              labelPlural="apps"
            />
            <View style={g.statDivider} />
            <StatGroup
              value={blockedInList}
              label="bloquée"
              labelPlural="bloquées"
              valueStyle={blockedInList > 0 ? g.statRed : undefined}
            />
            <View style={g.statDivider} />
            <StatGroup
              value={allowedCount}
              label="active"
              labelPlural="actives"
              valueStyle={g.statGreen}
            />
          </View>
          <View style={g.headerMidSep} />
          <View style={g.controlsBlock}>
            <VpnToggle
              active={vpnActive}
              locked={anyActive}
              danger={vpnDanger}
              onPress={toggleVpn}
            />
            <View style={g.pillSep} />
            <FocusToggle active={focusActive} onPress={handleFocusPress} />
          </View>
        </View>

        <View
          style={[
            g.progressTrack,
            { backgroundColor: "rgba(255,255,255,0.08)" },
          ]}
        >
          <Animated.View
            style={[
              g.progressFill,
              {
                width: `${blockedPct}%` as any,
                backgroundColor: blockedInList > 0 ? "#f87171" : "#34d399",
              },
            ]}
          />
          <Text style={g.progressLabel} numberOfLines={1}>
            {blockedInList > 0
              ? `${blockedPct}% du trafic filtré`
              : "Aucune app bloquée"}
          </Text>
        </View>
      </Animated.View>

      {/* ── Banners ── */}
      {hasBanners && (
        <View
          style={[
            g.bannersBar,
            { backgroundColor: t.bg.card, borderBottomColor: t.border.light },
          ]}
        >
          {showVpnWarning && (
            <VpnWarningBanner
              blockedCount={blockedCount}
              onActivate={toggleVpn}
              onDismiss={() => setVpnWarningDismissed(true)}
              t={t}
            />
          )}
          {focusActive && focusStatus && (
            <FocusBanner
              status={focusStatus}
              onStopped={() => {
                setFocusStatus(null);
                setFocusExpanded(false);
                refreshRules();
                AppEvents.emit("focus:changed", false);
              }}
              expanded={focusExpanded}
              onToggleExpand={() => setFocusExpanded((v) => !v)}
            />
          )}
          {timerActive && timerStatus && (
            <TimerBanner
              status={timerStatus}
              onStopped={() => {
                setTimerStatus(null);
                refreshRules();
                AppEvents.emit("timer:changed" as any, false);
              }}
            />
          )}
          {limitReached && (
            <TouchableOpacity
              style={[
                g.limitBanner,
                {
                  backgroundColor: t.warning.bg,
                  borderColor: t.warning.border,
                },
              ]}
              onPress={() => showPaywall("blocked_apps")}
              activeOpacity={0.85}
            >
              <Text
                style={[g.limitText, { color: t.warning.text }]}
                numberOfLines={1}
              >
                🔒 Limite {blockedCount}/{FREE_LIMITS.MAX_BLOCKED_APPS} atteinte
              </Text>
              <View style={[g.limitCta, { borderColor: t.text.link + "55" }]}>
                <Text
                  style={[g.limitCtaText, { color: t.text.link }]}
                  numberOfLines={1}
                >
                  Passer Pro →
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Liste ── */}
      <FlatList
        ref={flatListRef}
        data={filteredApps}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        windowSize={15}
        scrollEventThrottle={16}
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
        ListHeaderComponent={ListHeader}
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
            <Text
              style={[g.emptyTitle, { color: t.text.secondary }]}
              numberOfLines={1}
            >
              Aucune application
            </Text>
            <Text
              style={[g.emptySub, { color: t.text.muted }]}
              numberOfLines={2}
            >
              Modifiez la recherche ou les filtres
            </Text>
          </View>
        }
      />

      {/* ── Toast ── */}
      <BlockedToast
        appName={toastAppName}
        visible={toastVisible}
        onScrollTop={scrollToTop}
        onDismiss={dismissToast}
        bottomInset={insets.bottom}
      />

      {/* ── Modals ── */}
      <FocusModal
        visible={focusVisible}
        onClose={() => setFocusVisible(false)}
        onStarted={() => {
          checkFocus();
          refreshRules();
          setFocusExpanded(true);
          AppEvents.emit("focus:changed", true);
        }}
      />
      <QuickTimerModal
        visible={timerVisible}
        onClose={() => setTimerVisible(false)}
        onStarted={() => {
          checkTimer();
          refreshRules();
          AppEvents.emit("timer:changed" as any, true);
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
          AppEvents.emit("premium:changed", true);
        }}
      />
      <MoreMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSettings={() => router.push("/settings")}
        onTimer={() => setTimerVisible(true)}
        onAllowlist={handleOpenAllowlist}
      />
      <VpnActivationModal
        visible={vpnPopupVisible}
        appName={vpnPopupAppName}
        onActivate={toggleVpn}
        onDismiss={() => setVpnPopupVisible(false)}
      />
      {focusActive && focusStatus && (
        <FocusFullScreen
          status={focusStatus}
          onStopped={() => {
            setFocusStatus(null);
            setFocusExpanded(false);
            refreshRules();
            AppEvents.emit("focus:changed", false);
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
    shadowColor: "#040d1e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoMarkText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.9,
    lineHeight: 21,
  },
  brandTagline: {
    fontSize: 9,
    color: "rgba(255,255,255,0.36)",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  proBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.38)",
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.purple[300],
    letterSpacing: 1.2,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(251,191,36,0.14)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.38)",
    maxWidth: 120,
  },
  upgradeBtnIcon: { fontSize: 10, lineHeight: 14, flexShrink: 0 },
  upgradeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  actionSep: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  moreDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  moreBtnIndicator: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#34d399",
    borderWidth: 1.5,
    borderColor: Semantic.bg.header,
  },
  headerBottomRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statsBand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
  },
  statGroup: { flex: 1, alignItems: "center", gap: 1, minWidth: 0 },
  statBig: {
    fontSize: 19,
    fontWeight: "800",
    color: "rgba(255,255,255,0.82)",
    letterSpacing: -0.8,
    lineHeight: 23,
  },
  statRed: { color: "#f87171" },
  statGreen: { color: "#34d399" },
  statTiny: {
    fontSize: 8,
    fontWeight: "600",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 0.3,
    maxWidth: "100%",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerMidSep: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  controlsBlock: { flexDirection: "row", alignItems: "center", gap: 6 },
  controlPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.1 },
  pillState: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  pillSep: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  progressTrack: {
    height: 22,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    opacity: 0.75,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.52)",
    textAlign: "center",
    letterSpacing: 0.4,
    zIndex: 1,
    paddingHorizontal: 6,
  },
  dotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dotCore: { width: 6, height: 6, borderRadius: 3, position: "absolute" },
  dotRing: { width: 10, height: 10, borderRadius: 5, position: "absolute" },
  bannersBar: {
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
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  limitText: { fontSize: 12, fontWeight: "600", flex: 1 },
  limitCta: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    flexShrink: 0,
  },
  limitCtaText: { fontSize: 11, fontWeight: "700" },
  listContent: { paddingHorizontal: 14 },
  listHeader: { gap: 10, paddingTop: 14, paddingBottom: 6 },

  // ── Bannière allowlist enrichie ──
  allowlistBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(52,211,153,0.10)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.28)",
  },
  allowlistBannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34d399",
    flexShrink: 0,
  },
  allowlistBannerText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(52,211,153,0.75)",
    fontWeight: "500",
  },
  allowlistBannerCount: { fontWeight: "700", color: "#34d399" },
  allowlistBannerEdit: {
    fontSize: 11,
    fontWeight: "700",
    color: "#34d399",
    flexShrink: 0,
  },
  allowlistBannerSep: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(52,211,153,0.3)",
    marginHorizontal: 2,
  },
  allowlistBannerOff: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(248,113,113,0.75)",
    flexShrink: 0,
    paddingLeft: 2,
  },

  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  listCount: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.2,
    opacity: 0.55,
    flexShrink: 1,
  },
  blockedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderColor: "rgba(248,113,113,0.28)",
    flexShrink: 0,
  },
  blockedChipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#f87171",
    flexShrink: 0,
  },
  blockedChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f87171",
    maxWidth: 120,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: CARD_H,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingLeft: 15,
    paddingVertical: 10,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardAccentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  iconWrap: { marginRight: 13, position: "relative" },
  iconImg: { width: 44, height: 44, borderRadius: 12 },
  iconFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  iconLetter: { fontSize: 18, fontWeight: "800" },
  sysBadge: {
    position: "absolute",
    bottom: -3,
    right: -5,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  sysBadgeText: { fontSize: 6, fontWeight: "700", letterSpacing: 0.3 },
  cardInfo: { flex: 1, gap: 2, minWidth: 0 },
  appName: { fontSize: 13, fontWeight: "600", letterSpacing: -0.15 },
  appPkg: { fontSize: 10, fontFamily: "monospace", opacity: 0.55 },
  blockedTag: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
  },
  blockedTagText: { fontSize: 9, fontWeight: "700" },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
  cardChevron: { fontSize: 18, fontWeight: "200" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { fontSize: 15, fontWeight: "700", letterSpacing: -0.3 },
  emptySub: {
    fontSize: 12,
    opacity: 0.65,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
