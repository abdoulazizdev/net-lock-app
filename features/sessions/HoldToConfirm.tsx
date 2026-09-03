/**
 * features/sessions/HoldToConfirm.tsx — Bouton à appui maintenu
 *
 * Utilisé pour interrompre une session Focus. La friction est volontaire :
 * une session dont on sort d'un tap ne tient pas ses promesses. L'anneau se
 * remplit pendant l'appui et l'action ne part qu'au bout du délai ; relâcher
 * avant annule tout.
 */

import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Radius, Spacing, useTheme } from "@/theme";
import { Icon, Text, type IconName } from "@/ui";

export type HoldToConfirmProps = {
  label: string;
  /** Libellé affiché pendant l'appui. */
  holdingLabel?: string;
  onConfirm: () => void;
  icon?: IconName;
  /** Durée d'appui requise, en ms. */
  duration?: number;
  tone?: "danger" | "warning";
  disabled?: boolean;
};

export function HoldToConfirm({
  label,
  holdingLabel = "Maintenez…",
  onConfirm,
  icon = "lock-open-variant-outline",
  duration = 1800,
  tone = "danger",
  disabled = false,
}: HoldToConfirmProps) {
  const { t } = useTheme();
  const progress = useSharedValue(0);
  const holding = useSharedValue(0);

  const fire = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirm();
  }, [onConfirm]);

  const start = useCallback(() => {
    if (disabled) return;
    holding.value = 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    progress.value = withTiming(1, { duration }, (finished) => {
      if (finished) {
        holding.value = 0;
        progress.value = 0;
        runOnJS(fire)();
      }
    });
  }, [disabled, duration, fire, holding, progress]);

  const cancel = useCallback(() => {
    holding.value = 0;
    progress.value = withTiming(0, { duration: 180 });
  }, [holding, progress]);

  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({ opacity: holding.value ? 0 : 1 }));
  const holdingStyle = useAnimatedStyle(() => ({ opacity: holding.value }));

  const c = t.intent[tone];

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} — maintenir pour confirmer`}
      style={[
        st.button,
        { backgroundColor: c.bg, borderColor: c.border },
        disabled && st.disabled,
      ]}
    >
      <Animated.View
        style={[st.fill, { backgroundColor: c.accent, opacity: 0.22 }, fill]}
      />
      <View style={st.content}>
        <Icon name={icon} size={18} color={c.accent} />
        <View>
          <Animated.View style={labelStyle}>
            <Text variant="headline" color={c.accent} numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
          <Animated.View style={[st.overlayLabel, holdingStyle]}>
            <Text variant="headline" color={c.accent} numberOfLines={1}>
              {holdingLabel}
            </Text>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "left center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  overlayLabel: { ...StyleSheet.absoluteFillObject, justifyContent: "center" },
  disabled: { opacity: 0.5 },
});
