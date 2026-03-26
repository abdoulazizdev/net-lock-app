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
import { usePremium } from "@/hooks/usePremium";
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
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FocusFullScreen from "../Focusfullscreen";

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

// ─── VpnToggle ────────────────────────────────────────────────────────────────
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
  const displayLabel = value > 1 && labelPlural ? labelPlural : label;
  return (
    <View style={g.statGroup}>
      <Text
        style={[g.statBig, valueStyle]}
        numberOfLines={1}
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text style={g.statTiny} numberOfLines={1} ellipsizeMode="tail">
        {displayLabel}
      </Text>
    </View>
  );
});

// ─── VpnWarningBanner ─────────────────────────────────────────────────────────
const VpnWarningBanner = React.memo(function VpnWarningBanner({
  blockedCount,
  onActivate,
  onDismiss,
  t,
}: {
  blockedCount: number;
  onActivate: () => void;
  onDismiss: () => void;
  t: any;
}) {
  const slideAnim = useRef(new Animated.Value(-8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return (
    <Animated.View
      style={[
        g.vpnWarningBanner,
        { backgroundColor: t.warning.bg, borderColor: t.warning.border },
        { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View
        style={[
          g.vpnWarningIconWrap,
          { backgroundColor: t.warning.border + "44" },
        ]}
      >
        <Text style={g.vpnWarningIconText}>⚠️</Text>
      </View>
      <View style={{ flex: 1, gap: 2, overflow: "hidden" }}>
        <Text
          style={[g.vpnWarningTitle, { color: t.warning.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          VPN désactivé — blocages inactifs
        </Text>
        <Text
          style={[g.vpnWarningDesc, { color: t.warning.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {blockedCount} app{blockedCount > 1 ? "s" : ""} bloquée
          {blockedCount > 1 ? "s" : ""} — réseau non filtré
        </Text>
      </View>
      <TouchableOpacity
        style={[
          g.vpnWarningCta,
          {
            backgroundColor: t.warning.text + "1A",
            borderColor: t.warning.text + "44",
          },
        ]}
        onPress={onActivate}
        activeOpacity={0.75}
      >
        <Text
          style={[g.vpnWarningCtaText, { color: t.warning.text }]}
          numberOfLines={1}
        >
          Activer →
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={g.vpnWarningDismiss}
        activeOpacity={0.6}
      >
        <Text style={[g.vpnWarningDismissText, { color: t.warning.text }]}>
          ✕
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── VpnActivationModal ───────────────────────────────────────────────────────
const VpnActivationModal = React.memo(function VpnActivationModal({
  visible,
  appName,
  onActivate,
  onDismiss,
  t,
}: {
  visible: boolean;
  appName: string;
  onActivate: () => void;
  onDismiss: () => void;
  t: any;
}) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      cardScale.setValue(0.88);
      cardOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 260,
          friction: 22,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  const animateOut = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.92,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => cb());
  };
  if (!visible) return null;
  return (
    <TouchableWithoutFeedback onPress={() => animateOut(onDismiss)}>
      <Animated.View style={[pm.backdrop, { opacity: backdropOpacity }]}>
        <TouchableWithoutFeedback>
          <Animated.View
            style={[
              pm.card,
              {
                backgroundColor: t.bg.card,
                borderColor: t.border.light,
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
              },
            ]}
          >
            <View style={pm.iconArea}>
              <View style={pm.haloOuter} />
              <View style={pm.haloMid} />
              <View style={pm.iconBox}>
                <Text style={pm.iconEmoji}>🛡️</Text>
              </View>
            </View>
            <Text style={[pm.title, { color: t.text.primary }]}>
              VPN désactivé
            </Text>
            <Text style={[pm.subtitle, { color: t.text.secondary }]}>
              Vous venez de bloquer{" "}
              <Text style={[pm.subtitleAccent, { color: t.text.primary }]}>
                {appName}
              </Text>
              , mais le VPN est éteint.
            </Text>
            <View
              style={[
                pm.infoBox,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={pm.infoIcon}>ℹ️</Text>
              <Text style={[pm.infoText, { color: t.text.muted }]}>
                Sans VPN actif, les règles de blocage ne sont pas appliquées et
                l'application peut toujours accéder au réseau.
              </Text>
            </View>
            <View style={[pm.sep, { backgroundColor: t.border.light }]} />
            <View style={pm.actions}>
              <TouchableOpacity
                style={[
                  pm.btnSecondary,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.normal,
                  },
                ]}
                onPress={() => animateOut(onDismiss)}
                activeOpacity={0.75}
              >
                <Text
                  style={[pm.btnSecondaryText, { color: t.text.secondary }]}
                >
                  Pas maintenant
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={pm.btnPrimary}
                onPress={() => animateOut(onActivate)}
                activeOpacity={0.82}
              >
                <Text style={pm.btnPrimaryIcon}>⚡</Text>
                <Text style={pm.btnPrimaryText}>Activer maintenant</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
});

const pm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,13,30,0.74)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.38,
    shadowRadius: 48,
    elevation: 28,
    alignItems: "center",
  },
  iconArea: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  haloOuter: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.14)",
  },
  haloMid: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.20)",
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: "rgba(248,113,113,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(248,113,113,0.34)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 26, lineHeight: 32 },
  title: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 14,
  },
  subtitleAccent: { fontWeight: "700" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
  },
  infoIcon: { fontSize: 13, lineHeight: 18, flexShrink: 0, marginTop: 1 },
  infoText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "500" },
  sep: { width: "100%", height: StyleSheet.hairlineWidth, marginVertical: 20 },
  actions: { width: "100%", gap: 10 },
  btnSecondary: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: { fontSize: 14, fontWeight: "600", letterSpacing: -0.1 },
  btnPrimary: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 8,
  },
  btnPrimaryIcon: { fontSize: 15, lineHeight: 20 },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
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

  const focusActive = focusStatus?.isActive ?? false;
  const timerActive = timerStatus?.isActive ?? false;
  const anyActive = focusActive || timerActive;
  const limitReached =
    !isPremium && blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS;

  const showVpnWarning =
    !vpnActive && blockedCount > 0 && !anyActive && !vpnWarningDismissed;
  const hasBanners =
    showVpnWarning || focusActive || timerActive || limitReached;

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
    const [rules, isVpn] = await Promise.all([
      StorageService.getRules(),
      VpnService.isVpnActive(),
    ]);
    setVpnActive(isVpn);
    setBlockedCount(rules.filter((r) => r.isBlocked).length);
    setApps((prev) => mergeAppsRules(prev, rules, prev));
  }, [mergeAppsRules]);

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

  useEffect(() => {
    const unsubVpn = AppEvents.on("vpn:changed", (active) => {
      setVpnActive(active);
      if (active) setVpnWarningDismissed(false);
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
    return () => {
      unsubVpn();
      unsubRules();
      unsubFocus();
      unsubTimer();
      unsubPremium();
    };
  }, [refreshRules, checkFocus, checkTimer, refreshPremium]);

  useEffect(() => {
    VpnService.isVpnActive().then(setVpnActive);
    loadInitial();
    checkFocus();
    checkTimer();
    TimerService.rescheduleIfNeeded();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && appStateRef.current !== "active") {
        refreshRules();
        checkFocus();
        checkTimer();
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
    AppListService.invalidateCache();
    await Promise.all([loadInitial(), checkFocus(), checkTimer()]);
    setRefreshing(false);
  }, []);

  // ── FIX : tri bloquées en tête + suppression getItemLayout ──────────────────
  // Les cartes bloquées affichent un tag supplémentaire ("● Bloquée") qui les
  // rend plus hautes que les cartes normales. getItemLayout supposait une
  // hauteur uniforme → décalages de scroll. On le supprime et on laisse
  // FlatList mesurer chaque item naturellement.
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
    // Apps bloquées toujours en tête, ordre alphabétique dans chaque groupe
    return list.sort((a, b) => {
      const aBlocked = a.rule?.isBlocked ? 1 : 0;
      const bBlocked = b.rule?.isBlocked ? 1 : 0;
      if (bBlocked !== aBlocked) return bBlocked - aBlocked;
      return a.appName.localeCompare(b.appName);
    });
  }, [apps, query, filters]);

  const toggleVpn = useCallback(async () => {
    if (anyActive) return;
    const next = !vpnActive;
    setVpnActive(next);
    if (next) setVpnWarningDismissed(false);
    try {
      if (next) await VpnService.startVpn();
      else await VpnService.stopVpn();
    } catch {
      setVpnActive(!next);
    }
  }, [vpnActive, anyActive]);

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
    [anyActive, isPremium, blockedCount, vpnActive],
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

  // getItemLayout supprimé — hauteurs variables selon état bloqué / badge SYS

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
    <View style={g.listMeta}>
      <Text
        style={[g.listCount, { color: t.text.muted }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {filteredApps.length} APP{filteredApps.length > 1 ? "S" : ""}
      </Text>
      {blockedInList > 0 && (
        <View style={g.blockedChip}>
          <View style={g.blockedChipDot} />
          <Text
            style={g.blockedChipText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {blockedInList} bloquée{blockedInList > 1 ? "s" : ""}
          </Text>
        </View>
      )}
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
          <Text style={g.progressLabel} numberOfLines={1} ellipsizeMode="tail">
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
                ellipsizeMode="tail"
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

      {/* ── Search bar sticky + liste ── */}
      <View style={g.listWrapper}>
        <View style={[g.searchBarFixed, { backgroundColor: t.bg.page }]}>
          <SearchAndFilters
            query={query}
            onQueryChange={setQuery}
            filters={filters}
            onFiltersChange={setFilters}
            systemAppsLoaded={sysLoaded}
            systemAppsLoading={sysLoading}
          />
        </View>

        <FlatList
          data={filteredApps}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          // getItemLayout supprimé : hauteurs variables (tag bloquée, badge SYS)
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
                  {
                    backgroundColor: t.bg.accent,
                    borderColor: t.border.strong,
                  },
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
                ellipsizeMode="tail"
              >
                Modifiez la recherche ou les filtres
              </Text>
            </View>
          }
        />
      </View>

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
      />
      <VpnActivationModal
        visible={vpnPopupVisible}
        appName={vpnPopupAppName}
        onActivate={() => {
          setVpnPopupVisible(false);
          toggleVpn();
        }}
        onDismiss={() => setVpnPopupVisible(false)}
        t={t}
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

  // ── Header ──
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

  // ── Stats + controls ──
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
  statGroup: {
    flex: 1,
    alignItems: "center",
    gap: 1,
    minWidth: 0,
  },
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

  // ── Progress ──
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

  // ── PulseDot ──
  dotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dotCore: { width: 6, height: 6, borderRadius: 3, position: "absolute" },
  dotRing: { width: 10, height: 10, borderRadius: 5, position: "absolute" },

  // ── Banners bar ──
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

  // ── VPN warning banner ──
  vpnWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  vpnWarningIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  vpnWarningIconText: { fontSize: 15, lineHeight: 18 },
  vpnWarningTitle: { fontSize: 12, fontWeight: "700", letterSpacing: -0.1 },
  vpnWarningDesc: { fontSize: 10, fontWeight: "500", opacity: 0.72 },
  vpnWarningCta: {
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    flexShrink: 0,
  },
  vpnWarningCtaText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.1 },
  vpnWarningDismiss: { flexShrink: 0, paddingLeft: 2 },
  vpnWarningDismissText: { fontSize: 13, fontWeight: "500", opacity: 0.45 },

  // ── Limit banner ──
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

  // ── Search bar — sticky ──
  searchBarFixed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 4,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  listWrapper: { flex: 1, position: "relative" },
  listContent: { paddingHorizontal: 14, paddingTop: 70 },

  // ── List meta ──
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 6,
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

  // ── App card ──
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

  // ── Empty state ──
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
