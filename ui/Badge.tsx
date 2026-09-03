/**
 * ui/Badge.tsx — Badges, pastilles et chips
 *
 * `Badge` : étiquette non interactive (état, compteur, « PRO »).
 * `Dot`   : pastille de statut, avec pulsation optionnelle.
 * `Chip`  : étiquette interactive (filtres, sélections).
 */

import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Radius, Spacing, useTheme, type ThemeTokens } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { Touchable } from "./Touchable";

/** Un badge reprend les états métier du thème. */
export type BadgeTone =
  | "neutral"
  | "brand"
  | "blocked"
  | "allowed"
  | "warning"
  | "focus"
  | "danger"
  | "info";

function tones(t: ThemeTokens, tone: BadgeTone) {
  if (tone === "brand") {
    return { bg: t.brand.soft, border: t.brand.softBorder, fg: t.text.link };
  }
  const i = t.intent[tone];
  return { bg: i.bg, border: i.border, fg: i.text };
}

// ─── Badge ───────────────────────────────────────────────────────────────────

export type BadgeProps = {
  label: string | number;
  tone?: BadgeTone;
  icon?: IconName;
  size?: "sm" | "md";
  /** Fond plein plutôt que teinté — pour se détacher d'une surface colorée. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Badge({
  label,
  tone = "neutral",
  icon,
  size = "sm",
  solid = false,
  style,
}: BadgeProps) {
  const { t } = useTheme();
  const c = tones(t, tone);
  const accent =
    tone === "brand" ? t.brand.base : t.intent[tone].accent;
  const fg = solid
    ? tone === "brand"
      ? t.brand.onBase
      : t.intent[tone].onAccent
    : c.fg;

  return (
    <View
      style={[
        st.badge,
        size === "md" && st.badgeMd,
        {
          backgroundColor: solid ? accent : c.bg,
          borderColor: solid ? accent : c.border,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === "md" ? 13 : 11} color={fg} /> : null}
      <Text variant={size === "md" ? "caption" : "overline"} color={fg} numberOfLines={1}>
        {String(label)}
      </Text>
    </View>
  );
}

// ─── Dot ─────────────────────────────────────────────────────────────────────

export type DotProps = {
  color: string;
  size?: number;
  /** Halo qui pulse — réservé aux états réellement « en cours ». */
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Dot({ color, size = 8, pulse = false, style }: DotProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!pulse) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [pulse, progress]);

  const halo = useAnimatedStyle(() => ({
    opacity: (1 - progress.value) * 0.5,
    transform: [{ scale: 1 + progress.value * 1.9 }],
  }));

  return (
    <View style={[{ width: size, height: size }, st.dotWrap, style]}>
      {pulse ? (
        <Animated.View
          style={[
            st.halo,
            { borderRadius: size / 2, backgroundColor: color },
            halo,
          ]}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────

export type ChipProps = {
  label: string;
  onPress?: () => void;
  active?: boolean;
  icon?: IconName;
  tone?: BadgeTone;
  disabled?: boolean;
  /** Affiche une croix de retrait à droite. */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Chip({
  label,
  onPress,
  active = false,
  icon,
  tone = "brand",
  disabled = false,
  onRemove,
  style,
}: ChipProps) {
  const { t } = useTheme();
  const c = tones(t, tone);

  const bg = active ? c.bg : t.bg.cardAlt;
  const border = active ? c.border : t.border.light;
  const fg = active ? c.fg : t.text.secondary;

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || !onPress}
      feedback="strong"
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={[st.chip, { backgroundColor: bg, borderColor: border }, style]}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text variant="caption" color={fg} numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? (
        <Touchable onPress={onRemove} hitSlop={8} feedback="none" style={st.chipRemove}>
          <Icon name="close" size={12} color={fg} />
        </Touchable>
      ) : null}
    </Touchable>
  );
}

const st = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeMd: { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.sm },
  dotWrap: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: "100%", height: "100%" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipRemove: { marginLeft: 1 },
});
