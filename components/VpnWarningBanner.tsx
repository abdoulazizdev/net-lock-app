import React, { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VpnWarningBannerProps {
  blockedCount: number;
  onActivate: () => void;
  onDismiss: () => void;
  t: any; // theme object from useTheme()
}

// ─── VpnWarningBanner ─────────────────────────────────────────────────────────
export const VpnWarningBanner = React.memo(function VpnWarningBanner({
  blockedCount,
  onActivate,
  onDismiss,
  t,
}: VpnWarningBannerProps) {
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
        s.banner,
        { backgroundColor: t.warning.bg, borderColor: t.warning.border },
        { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: t.warning.border + "44" }]}>
        <Text style={s.iconText}>⚠️</Text>
      </View>

      <View style={{ flex: 1, gap: 2, overflow: "hidden" }}>
        <Text
          style={[s.title, { color: t.warning.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          VPN désactivé — blocages inactifs
        </Text>
        <Text
          style={[s.desc, { color: t.warning.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {blockedCount} app{blockedCount > 1 ? "s" : ""} bloquée
          {blockedCount > 1 ? "s" : ""} — réseau non filtré
        </Text>
      </View>

      <TouchableOpacity
        style={[
          s.cta,
          {
            backgroundColor: t.warning.text + "1A",
            borderColor: t.warning.text + "44",
          },
        ]}
        onPress={onActivate}
        activeOpacity={0.75}
      >
        <Text style={[s.ctaText, { color: t.warning.text }]} numberOfLines={1}>
          Activer →
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={s.dismiss}
        activeOpacity={0.6}
      >
        <Text style={[s.dismissText, { color: t.warning.text }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  iconText: { fontSize: 15, lineHeight: 18 },
  title: { fontSize: 12, fontWeight: "700", letterSpacing: -0.1 },
  desc: { fontSize: 10, fontWeight: "500", opacity: 0.72 },
  cta: {
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    flexShrink: 0,
  },
  ctaText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.1 },
  dismiss: { flexShrink: 0, paddingLeft: 2 },
  dismissText: { fontSize: 13, fontWeight: "500", opacity: 0.45 },
});
