/**
 * ui/IconButton.tsx — Bouton icône seule
 *
 * Toujours accompagné d'un `accessibilityLabel` : sans libellé visible, c'est
 * la seule information dont dispose un lecteur d'écran.
 */

import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { Radius, useTheme, type ThemeTokens } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Touchable, type HapticStyle } from "./Touchable";

export type IconButtonVariant = "plain" | "soft" | "filled" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

const SIZES: Record<IconButtonSize, { box: number; icon: number; radius: number }> = {
  sm: { box: 30, icon: 16, radius: Radius.xs },
  md: { box: 38, icon: 19, radius: Radius.sm },
  lg: { box: 46, icon: 22, radius: Radius.md },
};

function palette(t: ThemeTokens, variant: IconButtonVariant) {
  switch (variant) {
    case "plain":
      return { bg: "transparent", border: "transparent", fg: t.text.secondary };
    case "soft":
      return { bg: t.bg.cardAlt, border: t.border.light, fg: t.text.primary };
    case "filled":
      return { bg: t.brand.base, border: t.brand.base, fg: t.brand.onBase };
    case "danger":
      return {
        bg: t.intent.danger.bg,
        border: t.intent.danger.border,
        fg: t.intent.danger.accent,
      };
  }
}

export type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: string;
  disabled?: boolean;
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = "plain",
  size = "md",
  color,
  disabled,
  haptic = "selection",
  style,
}: IconButtonProps) {
  const { t } = useTheme();
  const c = palette(t, variant);
  const dims = SIZES[size];

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      feedback="strong"
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={variant === "plain" ? 8 : undefined}
      style={[
        st.base,
        {
          width: dims.box,
          height: dims.box,
          borderRadius: dims.radius,
          backgroundColor: c.bg,
          borderColor: c.border,
        },
        style,
      ]}
    >
      <Icon name={icon} size={dims.icon} color={color ?? c.fg} />
    </Touchable>
  );
}

const st = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
