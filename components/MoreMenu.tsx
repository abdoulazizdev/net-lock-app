// components/MoreMenu.tsx
import { usePremium } from "@/hooks/usePremium";
import AllowlistService from "@/services/allowlist.service";
import AppEvents from "@/services/app-events";
import { FREE_LIMITS } from "@/services/subscription.service";
import { Colors, useTheme } from "@/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text } from "react-native-paper";

interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
  onTimer: () => void;
  onAllowlist: () => void;
}

export const MoreMenu = React.memo(function MoreMenu({
  visible,
  onClose,
  onSettings,
  onTimer,
  onAllowlist,
}: MoreMenuProps) {
  const { t } = useTheme();
  const { isPremium } = usePremium();
  const slideAnim = useRef(new Animated.Value(-12)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  const [allowlistEnabled, setAllowlistEnabled] = useState(false);
  const [allowlistCount, setAllowlistCount] = useState(0);

  // Sync with allowlist:changed event
  useEffect(() => {
    const unsub = AppEvents.on("allowlist:changed" as any, async () => {
      const state = await AllowlistService.getState();
      setAllowlistEnabled(state.enabled);
      setAllowlistCount(state.packages.length);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (visible) {
      AllowlistService.getState().then((state) => {
        setAllowlistEnabled(state.enabled);
        setAllowlistCount(state.packages.length);
      });
      slideAnim.setValue(-12);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.94);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 190,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 280,
          friction: 22,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const freeTimerPresets = FREE_LIMITS.TIMER_PRESETS_FREE.map(
    (m: number) => `${m}min`,
  ).join(" · ");

  const items = [
    {
      key: "timer",
      icon: "⏱",
      iconBg: "rgba(251,191,36,0.15)",
      iconBorder: "rgba(251,191,36,0.32)",
      label: "Minuterie",
      sub: isPremium ? "Jusqu'à 4h · Stop en 1 tap" : freeTimerPresets,
      rightLabel: !isPremium ? "PRO" : null,
      rightColor: Colors.amber[600],
      rightBg: "rgba(251,191,36,0.15)",
      rightBorder: "rgba(251,191,36,0.32)",
      active: false,
      onPress: onTimer,
    },
    {
      key: "allowlist",
      icon: allowlistEnabled ? "✅" : "○",
      iconBg: allowlistEnabled
        ? "rgba(52,211,153,0.15)"
        : "rgba(100,116,139,0.12)",
      iconBorder: allowlistEnabled
        ? "rgba(52,211,153,0.35)"
        : "rgba(100,116,139,0.25)",
      label: "Liste blanche",
      sub: allowlistEnabled
        ? `${allowlistCount} app${allowlistCount > 1 ? "s" : ""} autorisée${allowlistCount > 1 ? "s" : ""}`
        : "Bloquer tout sauf exceptions",
      rightLabel: allowlistEnabled ? "ON" : null,
      rightColor: "#34d399",
      rightBg: "rgba(52,211,153,0.15)",
      rightBorder: "rgba(52,211,153,0.32)",
      active: allowlistEnabled,
      onPress: onAllowlist,
    },
    {
      key: "settings",
      icon: "⚙️",
      iconBg: "rgba(100,116,139,0.15)",
      iconBorder: "rgba(100,116,139,0.30)",
      label: "Paramètres",
      sub: "VPN · Sécurité · Thème",
      rightLabel: null,
      rightColor: null,
      rightBg: null,
      rightBorder: null,
      active: false,
      onPress: onSettings,
    },
  ];

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                mm.card,
                {
                  backgroundColor: t.bg.card,
                  borderColor: t.border.light,
                  opacity: opacityAnim,
                  transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                },
              ]}
            >
              {items.map((item, i) => (
                <React.Fragment key={item.key}>
                  <TouchableOpacity
                    style={[
                      mm.item,
                      item.active && {
                        backgroundColor: "rgba(52,211,153,0.05)",
                      },
                    ]}
                    onPress={() => {
                      onClose();
                      setTimeout(() => item.onPress(), 80);
                    }}
                    activeOpacity={0.68}
                  >
                    <View
                      style={[
                        mm.iconWrap,
                        {
                          backgroundColor: item.iconBg,
                          borderColor: item.iconBorder,
                        },
                      ]}
                    >
                      <Text style={mm.iconText}>{item.icon}</Text>
                    </View>
                    <View style={mm.textBlock}>
                      <Text
                        style={[mm.label, { color: t.text.primary }]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[mm.sub, { color: t.text.muted }]}
                        numberOfLines={1}
                      >
                        {item.sub}
                      </Text>
                    </View>
                    {item.rightLabel ? (
                      <View
                        style={[
                          mm.badge,
                          {
                            backgroundColor: item.rightBg!,
                            borderColor: item.rightBorder!,
                          },
                        ]}
                      >
                        <Text
                          style={[mm.badgeText, { color: item.rightColor! }]}
                        >
                          {item.rightLabel}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[mm.chevron, { color: t.border.normal }]}>
                        ›
                      </Text>
                    )}
                  </TouchableOpacity>
                  {i < items.length - 1 && (
                    <View
                      style={[mm.sep, { backgroundColor: t.border.light }]}
                    />
                  )}
                </React.Fragment>
              ))}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const mm = StyleSheet.create({
  card: {
    position: "absolute",
    top: 96,
    right: 16,
    width: 252,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: 13 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  iconText: { fontSize: 15, lineHeight: 19 },
  textBlock: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 13, fontWeight: "700", letterSpacing: -0.2 },
  sub: { fontSize: 11, lineHeight: 15 },
  badge: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  chevron: { fontSize: 20, fontWeight: "300", flexShrink: 0 },
});
