/**
 * ui/Switch.tsx — Interrupteur
 *
 * Interrupteur maison plutôt que celui de React Native : la couleur active
 * suit les tokens (bloqué = rouge, autorisé = vert…), l'animation tourne sur
 * l'UI thread et la taille reste identique sur Android et iOS.
 */

import React, { useEffect } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { DISABLED_OPACITY, Spring, useTheme } from "@/theme";
import { Touchable } from "./Touchable";

export type SwitchTone = "brand" | "blocked" | "allowed" | "focus" | "warning";
export type SwitchSize = "sm" | "md";

const SIZES: Record<SwitchSize, { w: number; h: number; thumb: number; pad: number }> = {
  sm: { w: 38, h: 23, thumb: 17, pad: 3 },
  md: { w: 50, h: 30, thumb: 23, pad: 3.5 },
};

export type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  tone?: SwitchTone;
  size?: SwitchSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Switch({
  value,
  onValueChange,
  tone = "brand",
  size = "md",
  disabled = false,
  accessibilityLabel,
  style,
}: SwitchProps) {
  const { t } = useTheme();
  const dims = SIZES[size];
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, Spring.snappy);
  }, [value, progress]);

  const offColor = t.bg.cardSunken;
  const offBorder = t.border.normal;
  const onColor = tone === "brand" ? t.brand.base : t.intent[tone].accent;
  const onBorder = onColor;
  const thumbOff = t.text.muted;
  const thumbOn = tone === "brand" ? t.brand.onBase : t.intent[tone].onAccent;

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offColor, onColor]),
    borderColor: interpolateColor(progress.value, [0, 1], [offBorder, onBorder]),
  }));

  const travel = useDerivedValue(() => dims.w - dims.thumb - dims.pad * 2);
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel.value }],
    backgroundColor: interpolateColor(progress.value, [0, 1], [thumbOff, thumbOn]),
  }));

  return (
    <Touchable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      feedback="strong"
      haptic="light"
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={[disabled && { opacity: DISABLED_OPACITY }, style]}
    >
      <Animated.View
        style={[
          st.track,
          { width: dims.w, height: dims.h, borderRadius: dims.h / 2, padding: dims.pad },
          track,
        ]}
      >
        <Animated.View
          style={[
            { width: dims.thumb, height: dims.thumb, borderRadius: dims.thumb / 2 },
            thumb,
          ]}
        />
      </Animated.View>
    </Touchable>
  );
}

const st = StyleSheet.create({
  track: { borderWidth: 1, justifyContent: "center" },
});
