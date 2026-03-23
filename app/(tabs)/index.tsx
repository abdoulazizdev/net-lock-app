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
const CARD_H = 72;

function pkgHue(pkg: string) {
  return pkg.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

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

// ─── VPN pill ─────────────────────────────────────────────────────────────────
const VpnToggle = React.memo(function VpnToggle({
  active,
  locked,
  onPress,
}: {
  active: boolean;
  locked: boolean;
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
    outputRange: ["rgba(255,255,255,0.07)", "rgba(52,211,153,0.16)"],
  });
  const border = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.14)", "rgba(52,211,153,0.42)"],
  });
  const dotColor = locked
    ? "rgba(255,255,255,0.2)"
    : active
      ? "#34d399"
      : "rgba(255,255,255,0.28)";
  const textColor = locked
    ? "rgba(255,255,255,0.28)"
    : active
      ? "#34d399"
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

// ─── Focus pill ───────────────────────────────────────────────────────────────
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
  const slideAnim = useRef(new Animated.Value(-10)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(-10);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 170,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  const items = [
    {
      icon: "⚙",
      label: "Paramètres",
      sub: "Config & sécurité",
      onPress: onSettings,
    },
    {
      icon: "⏱",
      label: "Minuterie",
      sub: "Session focus rapide",
      onPress: onTimer,
    },
  ];
  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                g.menuCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
                {
                  opacity: opacityAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    g.menuItem,
                    i < items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: t.border.light,
                    },
                  ]}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      g.menuIconWrap,
                      {
                        backgroundColor: t.bg.accent,
                        borderColor: t.border.strong,
                      },
                    ]}
                  >
                    <Text style={[g.menuIcon, { color: t.text.link }]}>
                      {item.icon}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[g.menuLabel, { color: t.text.primary }]}>
                      {item.label}
                    </Text>
                    <Text style={[g.menuSub, { color: t.text.muted }]}>
                      {item.sub}
                    </Text>
                  </View>
                  <Text style={[g.menuChevron, { color: t.border.normal }]}>
                    ›
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─── App switch ───────────────────────────────────────────────────────────────
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

          {/* ── Icône ── */}
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
    p.item.icon === n.item.icon && // ← préserve le re-render quand l'icône arrive
    p.locked === n.locked &&
    p.limitReached === n.limitReached,
);

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  const mountFade = useRef(new Animated.Value(0)).current;
  const mountSlide = useRef(new Animated.Value(18)).current;
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

  // ── merge avec préservation des icônes ───────────────────────────────────
  // existing = état actuel pour récupérer les icônes déjà chargées
  const mergeAppsRules = useCallback(
    (
      incoming: InstalledApp[],
      rules: AppRule[],
      existing?: AppItem[],
    ): AppItem[] => {
      const ruleMap = new Map(rules.map((r) => [r.packageName, r]));
      // Map d'icônes depuis l'état existant pour ne pas les perdre lors d'un refresh
      const iconMap = new Map(
        (existing ?? []).map((a) => [a.packageName, a.icon]),
      );
      return incoming.map((a) => ({
        ...a,
        // Priorité : icône de l'app entrante → icône conservée → null
        icon: a.icon ?? iconMap.get(a.packageName) ?? null,
        rule: ruleMap.get(a.packageName),
      }));
    },
    [],
  );

  const checkFocus = async () => {
    try {
      const s = await FocusService.getStatus();
      setFocusStatus(s.isActive ? s : null);
    } catch {
      setFocusStatus(null);
    }
  };

  const loadSysIfNeeded = async () => {
    if (sysLoaded || sysLoading) return;
    setSysLoading(true);
    try {
      const rules = await StorageService.getRules();
      // Phase légère sans icônes
      const all = await AppListService.getAllApps();
      setApps((prev) => mergeAppsRules(all, rules, prev));
      setSysLoaded(true);
      // Phase enrichissement avec icônes en arrière-plan
      AppListService.getAllAppsWithIcons()
        .then((full) => {
          StorageService.getRules()
            .then((r) => setApps((prev) => mergeAppsRules(full, r, prev)))
            .catch(() => {});
        })
        .catch(() => {});
    } catch {
    } finally {
      setSysLoading(false);
    }
  };

  // ── Chargement en 3 phases pour afficher quelque chose immédiatement ──────
  const loadInitial = async () => {
    setLoading(true);
    try {
      const [rules, isVpn] = await Promise.all([
        StorageService.getRules(),
        VpnService.isVpnActive(),
      ]);
      setVpnActive(isVpn);
      setBlockedCount(rules.filter((r) => r.isBlocked).length);

      // Phase 1 — apps utilisateur SANS icônes → affichage immédiat
      const light = await AppListService.getNonSystemApps();
      setApps((prev) => mergeAppsRules(light, rules, prev));
      setLoading(false);

      // Phase 2 — apps utilisateur AVEC icônes → enrichissement silencieux
      AppListService.getNonSystemAppsWithIcons()
        .then((full) => {
          StorageService.getRules()
            .then((r) => setApps((prev) => mergeAppsRules(full, r, prev)))
            .catch(() => {});
        })
        .catch(() => {});
    } catch {
      setLoading(false);
    }

    // Phase 3 — TOUTES les apps avec icônes en arrière-plan
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

  // ── refreshRules préserve les icônes ──────────────────────────────────────
  const refreshRules = useCallback(async () => {
    const [rules, isVpn] = await Promise.all([
      StorageService.getRules(),
      VpnService.isVpnActive(),
    ]);
    setVpnActive(isVpn);
    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    // On passe prev comme existing pour préserver les icônes déjà chargées
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
      length: CARD_H + 5,
      offset: (CARD_H + 5) * i,
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

  const allowedCount = filteredApps.filter((a) => !a.rule?.isBlocked).length;
  const blockedInList = filteredApps.filter((a) => a.rule?.isBlocked).length;
  const blockedPct =
    filteredApps.length > 0
      ? Math.round((blockedInList / filteredApps.length) * 100)
      : 0;

  return (
    <View style={[g.root, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
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
        {/* Ligne 1 : brand + badge + ··· */}
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
                <Text style={g.proBadgeText}>PRO</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={g.freeBadge}
                onPress={() => showPaywall("general")}
                activeOpacity={0.75}
              >
                <Text style={g.freeBadgeText}>FREE</Text>
              </TouchableOpacity>
            )}
            <View style={g.actionSep} />
            <TouchableOpacity
              style={[g.moreBtn, menuVisible && g.moreBtnActive]}
              onPress={() => setMenuVisible((v) => !v)}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={g.moreDot} />
              <View style={g.moreDot} />
              <View style={g.moreDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Ligne 2 : stats + contrôles */}
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
            <View style={g.statGroup}>
              <Text style={g.statBig}>{filteredApps.length}</Text>
              <Text style={g.statTiny}>apps</Text>
            </View>
            <View style={g.statDivider} />
            <View style={g.statGroup}>
              <Text style={[g.statBig, blockedInList > 0 && g.statRed]}>
                {blockedInList}
              </Text>
              <Text style={g.statTiny}>bloquées</Text>
            </View>
            <View style={g.statDivider} />
            <View style={g.statGroup}>
              <Text style={[g.statBig, g.statGreen]}>{allowedCount}</Text>
              <Text style={g.statTiny}>actives</Text>
            </View>
          </View>
          <View style={g.headerMidSep} />
          <View style={g.controlsBlock}>
            <VpnToggle
              active={vpnActive}
              locked={focusActive}
              onPress={toggleVpn}
            />
            <View style={g.pillSep} />
            <FocusToggle active={focusActive} onPress={handleFocusPress} />
          </View>
        </View>

        {/* Ligne 3 : barre de progression */}
        <View
          style={[
            g.progressTrack,
            { backgroundColor: "rgba(255,255,255,0.08)" },
          ]}
        >
          <View
            style={[
              g.progressFill,
              {
                width: `${blockedPct}%`,
                backgroundColor: blockedInList > 0 ? "#f87171" : "#34d399",
              },
            ]}
          />
          <Text style={g.progressLabel}>
            {blockedInList > 0
              ? `${blockedPct}% du trafic filtré`
              : "Aucune app bloquée pour l'instant"}
          </Text>
        </View>
      </Animated.View>

      {/* ══ SUBHEADER ══════════════════════════════════════════════════════════ */}
      <View
        style={[
          g.subHeader,
          { backgroundColor: t.bg.card, borderBottomColor: t.border.light },
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
        {limitReached && (
          <TouchableOpacity
            style={[
              g.limitBanner,
              { backgroundColor: t.warning.bg, borderColor: t.warning.border },
            ]}
            onPress={() => showPaywall("blocked_apps")}
            activeOpacity={0.85}
          >
            <Text style={[g.limitText, { color: t.warning.text }]}>
              🔒 Limite {blockedCount}/{FREE_LIMITS.MAX_BLOCKED_APPS} atteinte
            </Text>
            <View style={[g.limitCta, { borderColor: t.text.link + "55" }]}>
              <Text style={[g.limitCtaText, { color: t.text.link }]}>
                Passer Pro →
              </Text>
            </View>
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

      {/* ══ LIST ════════════════════════════════════════════════════════════════ */}
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
          <View style={g.listHeader}>
            <Text style={[g.listCount, { color: t.text.muted }]}>
              {filteredApps.length} APPLICATION
              {filteredApps.length > 1 ? "S" : ""}
            </Text>
            {blockedInList > 0 && (
              <View style={g.blockedChip}>
                <View style={g.blockedChipDot} />
                <Text style={g.blockedChipText}>
                  {blockedInList} bloquée{blockedInList > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>
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
              Modifiez la recherche ou les filtres
            </Text>
          </View>
        }
      />

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}
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
      <MoreMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSettings={() => router.push("/settings")}
        onTimer={() => setTimerVisible(true)}
      />
      <QuickTimerModal
        visible={timerVisible}
        onClose={() => setTimerVisible(false)}
        onStarted={() => {
          checkFocus();
          refreshRules();
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.purple[300],
    letterSpacing: 1.4,
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  freeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.48)",
    letterSpacing: 1.4,
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  moreBtnActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.32)",
  },
  moreDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: "rgba(255,255,255,0.65)",
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
  },
  statGroup: { flex: 1, alignItems: "center", gap: 1 },
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
    letterSpacing: 0.4,
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
  },

  dotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dotCore: { width: 6, height: 6, borderRadius: 3, position: "absolute" },
  dotRing: { width: 10, height: 10, borderRadius: 5, position: "absolute" },

  menuCard: {
    position: "absolute",
    top: 96,
    right: 16,
    minWidth: 196,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 24,
    elevation: 18,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIcon: { fontSize: 14 },
  menuLabel: { fontSize: 14, fontWeight: "700", marginBottom: 1 },
  menuSub: { fontSize: 11 },
  menuChevron: { fontSize: 18, fontWeight: "300" },

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
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  limitText: { fontSize: 12, fontWeight: "600" },
  limitCta: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
  },
  limitCtaText: { fontSize: 11, fontWeight: "700" },

  listContent: { paddingHorizontal: 14, paddingTop: 10 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listCount: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.2,
    opacity: 0.55,
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
  },
  blockedChipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#f87171",
  },
  blockedChipText: { fontSize: 10, fontWeight: "700", color: "#f87171" },

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
  cardInfo: { flex: 1, gap: 2 },
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
  emptySub: { fontSize: 12, opacity: 0.65 },
});
