/**
 * ui/Button.tsx — Boutons
 *
 *   <Button label="Activer" onPress={…} />                       // primaire
 *   <Button label="Annuler" variant="ghost" />
 *   <Button label="Supprimer" variant="danger" icon="trash-can-outline" />
 *   <Button label="Enregistrer" loading fullWidth size="lg" />
 *
 * Un seul bouton primaire par écran ou par panneau : c'est l'action attendue.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Radius, Spacing, useTheme, type ThemeTokens } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { Touchable, type HapticStyle } from "./Touchable";

export type ButtonVariant =
  /** Action principale — fond plein couleur de marque. */
  | "primary"
  /** Action secondaire — surface avec contour. */
  | "secondary"
  /** Action tertiaire — sans fond ni contour. */
  | "ghost"
  /** Action destructrice. */
  | "danger"
  /** Action positive (autoriser, valider). */
  | "success"
  /** Premium / Focus. */
  | "accent";

export type ButtonSize = "sm" | "md" | "lg";

const SIZES: Record<
  ButtonSize,
  { height: number; padding: number; gap: number; icon: number; radius: number }
> = {
  sm: { height: 34, padding: Spacing.md, gap: 6, icon: 15, radius: Radius.sm },
  md: { height: 44, padding: Spacing.lg, gap: 8, icon: 18, radius: Radius.md },
  lg: { height: 52, padding: Spacing.xl, gap: 9, icon: 20, radius: Radius.md },
};

function palette(t: ThemeTokens, variant: ButtonVariant) {
  switch (variant) {
    case "primary":
      return { bg: t.brand.base, border: t.brand.base, fg: t.brand.onBase };
    case "secondary":
      return { bg: t.bg.cardAlt, border: t.border.normal, fg: t.text.primary };
    case "ghost":
      return { bg: "transparent", border: "transparent", fg: t.text.link };
    case "danger":
      return {
        bg: t.intent.danger.accent,
        border: t.intent.danger.accent,
        fg: t.intent.danger.onAccent,
      };
    case "success":
      return {
        bg: t.intent.allowed.accent,
        border: t.intent.allowed.accent,
        fg: t.intent.allowed.onAccent,
      };
    case "accent":
      return {
        bg: t.intent.focus.accent,
        border: t.intent.focus.accent,
        fg: t.intent.focus.onAccent,
      };
  }
}

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Place l'icône après le libellé (flèches « suivant »). */
  iconRight?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight = false,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic,
  style,
}: ButtonProps) {
  const { t } = useTheme();
  const c = palette(t, variant);
  const dims = SIZES[size];
  const isBusy = loading || disabled;

  const content = (
    <>
      {icon && !iconRight && !loading ? (
        <Icon name={icon} size={dims.icon} color={c.fg} />
      ) : null}
      {loading ? <ActivityIndicator size="small" color={c.fg} /> : null}
      <Text
        variant={size === "sm" ? "callout" : "headline"}
        color={c.fg}
        numberOfLines={1}
      >
        {label}
      </Text>
      {icon && iconRight && !loading ? (
        <Icon name={icon} size={dims.icon} color={c.fg} />
      ) : null}
    </>
  );

  return (
    <Touchable
      onPress={onPress}
      disabled={isBusy}
      feedback="strong"
      haptic={haptic ?? (variant === "danger" ? "warning" : "light")}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isBusy, busy: loading }}
      style={[
        st.base,
        {
          height: dims.height,
          paddingHorizontal: dims.padding,
          gap: dims.gap,
          borderRadius: dims.radius,
          backgroundColor: c.bg,
          borderColor: c.border,
        },
        variant === "primary" && t.shadow.sm,
        fullWidth && st.fullWidth,
        style,
      ]}
    >
      {content}
    </Touchable>
  );
}

/** Rangée de boutons, espacée, chaque bouton prenant une part égale. */
export function ButtonRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[st.row, style]}>{children}</View>;
}

const st = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  fullWidth: { alignSelf: "stretch" },
  row: { flexDirection: "row", gap: Spacing.sm },
});
