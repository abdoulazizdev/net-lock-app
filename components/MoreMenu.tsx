// ─── More menu — version corrigée & améliorée ─────────────────────────────────
// Fixes :
//   • Suppression de overflow:"hidden" qui coupait le 2e item sur certains appareils
//   • Modal avec visible={visible} explicite (pas de guard if (!visible) return null)
//   • setTimeout 80ms avant onPress pour laisser l'animation de fermeture se lancer
//   • Séparateur rendu avec Fragment + View au lieu de borderBottom conditionnel
// Améliorations :
//   • Scale + slide + fade à l'ouverture
//   • Icônes colorées distinctes (ambre pour timer, slate pour settings)
//   • Badge "PRO pour +" si non-premium
//   • minWidth 240, borderRadius 18

import { usePremium } from "@/hooks/usePremium";
import { FREE_LIMITS } from "@/services/subscription.service";
import { Colors, useTheme } from "@/theme";
import React, { useEffect, useRef } from "react";
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
}

export const MoreMenu = React.memo(function MoreMenu({
  visible,
  onClose,
  onSettings,
  onTimer,
}: MoreMenuProps) {
  const { t } = useTheme();
  const { isPremium } = usePremium();
  const slideAnim = useRef(new Animated.Value(-12)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (visible) {
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
    (m: number) => `${m} min`,
  ).join(", ");

  const items = [
    {
      key: "timer",
      icon: "⏱",
      iconBg: "rgba(251,191,36,0.15)",
      iconBorder: "rgba(251,191,36,0.32)",
      label: "Minuterie",
      sub: isPremium
        ? "Blocage jusqu'à 4h · Stop en 1 tap"
        : `Gratuit : ${freeTimerPresets} · Stop en 1 tap`,
      badge: !isPremium
        ? {
            label: "PRO pour +",
            color: Colors.amber[600],
            bg: Colors.amber[50],
            border: Colors.amber[200],
          }
        : null,
      onPress: onTimer,
    },
    {
      key: "settings",
      icon: "⚙️",
      iconBg: "rgba(100,116,139,0.15)",
      iconBorder: "rgba(100,116,139,0.30)",
      label: "Paramètres",
      sub: "VPN · Sécurité · Profils · Thème",
      badge: null,
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
                    style={mm.item}
                    onPress={() => {
                      onClose();
                      setTimeout(() => item.onPress(), 80);
                    }}
                    activeOpacity={0.68}
                  >
                    {/* Icône colorée */}
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

                    {/* Texte */}
                    <View style={mm.textBlock}>
                      <View style={mm.labelRow}>
                        <Text style={[mm.label, { color: t.text.primary }]}>
                          {item.label}
                        </Text>
                        {item.badge && (
                          <View
                            style={[
                              mm.badge,
                              {
                                backgroundColor: item.badge.bg,
                                borderColor: item.badge.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                mm.badgeText,
                                { color: item.badge.color },
                              ]}
                            >
                              {item.badge.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[mm.sub, { color: t.text.muted }]}
                        numberOfLines={1}
                      >
                        {item.sub}
                      </Text>
                    </View>

                    {/* Chevron */}
                    <Text style={[mm.chevron, { color: t.border.normal }]}>
                      ›
                    </Text>
                  </TouchableOpacity>

                  {/* Séparateur entre les items */}
                  {i < items.length - 1 && (
                    <View
                      style={[
                        mm.separator,
                        { backgroundColor: t.border.light },
                      ]}
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
    minWidth: 240,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    // ⚠️ PAS de overflow:"hidden" — c'est lui qui coupait le 2e item
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  iconText: { fontSize: 16, lineHeight: 20 },
  textBlock: { flex: 1, gap: 3 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  label: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  sub: { fontSize: 11, lineHeight: 15 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  chevron: { fontSize: 20, fontWeight: "300", flexShrink: 0 },
});
