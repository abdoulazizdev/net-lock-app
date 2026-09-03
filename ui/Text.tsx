/**
 * ui/Text.tsx — Texte typé par variante
 *
 *   <Text variant="title2">Profils</Text>
 *   <Text variant="footnote" tone="muted">3 apps bloquées</Text>
 *
 * Les tailles et graisses viennent de `Typography` : aucun `fontSize` en dur
 * dans les écrans.
 */

import React from "react";
import {
  Text as RNText,
  StyleSheet,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { Typography, useTheme, type TypeVariant } from "@/theme";

/** Rôle sémantique de la couleur du texte. */
export type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "faint"
  | "inverse"
  | "link"
  | "brand"
  | "blocked"
  | "allowed"
  | "warning"
  | "focus"
  | "danger";

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Couleur explicite — court-circuite `tone`. */
  color?: string;
  /** Aligne les chiffres sur une largeur fixe (compteurs, minuteurs). */
  tabular?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
};

export const Text = React.memo(function Text({
  variant = "body",
  tone = "primary",
  color,
  tabular = false,
  center = false,
  style,
  ...rest
}: TextProps) {
  const { t } = useTheme();

  const toneColor =
    color ??
    {
      primary: t.text.primary,
      secondary: t.text.secondary,
      muted: t.text.muted,
      faint: t.text.faint,
      inverse: t.text.inverse,
      link: t.text.link,
      brand: t.brand.base,
      blocked: t.intent.blocked.text,
      allowed: t.intent.allowed.text,
      warning: t.intent.warning.text,
      focus: t.intent.focus.text,
      danger: t.intent.danger.text,
    }[tone];

  return (
    <RNText
      {...rest}
      style={[
        Typography[variant],
        { color: toneColor },
        tabular && st.tabular,
        center && st.center,
        style,
      ]}
    />
  );
});

const st = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] },
  center: { textAlign: "center" },
});
