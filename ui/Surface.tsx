/**
 * ui/Surface.tsx — Conteneurs de base
 *
 * `Card`     : surface de contenu, contour hairline, rayon `lg`.
 * `Surface`  : primitive derrière Card, avec niveau d'élévation explicite.
 * `Divider`  : séparateur 1px.
 * `Section`  : titre de section + contenu, l'espacement standard des écrans.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Radius, Spacing, useTheme, type ThemeTokens } from "@/theme";
import { Text } from "./Text";

// ─── Surface ─────────────────────────────────────────────────────────────────

/** Hauteur perçue : `flat` collé à la page, `raised` détaché, `floating` au-dessus de tout. */
export type Elevation = "flat" | "sunken" | "raised" | "floating";

export type SurfaceProps = {
  elevation?: Elevation;
  radius?: number;
  bordered?: boolean;
  /** Couleur de bordure explicite — pour les cartes d'état (bloqué, focus…). */
  borderColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

function surfaceBg(t: ThemeTokens, elevation: Elevation) {
  switch (elevation) {
    case "sunken":
      return t.bg.cardSunken;
    case "raised":
      return t.bg.card;
    case "floating":
      return t.bg.elevated;
    default:
      return "transparent";
  }
}

export function Surface({
  elevation = "raised",
  radius = Radius.lg,
  bordered = true,
  borderColor,
  backgroundColor,
  style,
  children,
}: SurfaceProps) {
  const { t } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: backgroundColor ?? surfaceBg(t, elevation),
          borderRadius: radius,
        },
        bordered && {
          borderWidth: 1,
          borderColor: borderColor ?? t.border.light,
        },
        elevation === "raised" && t.shadow.sm,
        elevation === "floating" && t.shadow.lg,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export type CardProps = Omit<SurfaceProps, "elevation"> & {
  /** Padding interne uniforme. `false` pour gérer soi-même (listes, médias). */
  padded?: boolean | number;
  elevation?: Elevation;
};

export function Card({ padded = true, style, children, ...rest }: CardProps) {
  const padding =
    padded === true ? Spacing.lg : padded === false ? undefined : padded;
  return (
    <Surface {...rest} style={[padding !== undefined && { padding }, style]}>
      {children}
    </Surface>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({
  inset = 0,
  vertical = false,
  style,
}: {
  /** Retrait horizontal, pour aligner sur le texte d'une liste. */
  inset?: number;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTheme();
  return (
    <View
      style={[
        vertical
          ? { width: StyleSheet.hairlineWidth, alignSelf: "stretch" }
          : { height: StyleSheet.hairlineWidth, marginLeft: inset },
        { backgroundColor: t.border.normal },
        style,
      ]}
    />
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export type SectionProps = {
  title?: string;
  /** Action textuelle alignée à droite du titre. */
  action?: React.ReactNode;
  /** Texte explicatif sous le contenu. */
  footnote?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Section({
  title,
  action,
  footnote,
  style,
  children,
}: SectionProps) {
  return (
    <View style={[st.section, style]}>
      {(title || action) && (
        <View style={st.sectionHead}>
          {title ? (
            <Text variant="overline" tone="muted" numberOfLines={1} style={st.sectionTitle}>
              {title}
            </Text>
          ) : (
            <View style={st.sectionTitle} />
          )}
          {action}
        </View>
      )}
      {children}
      {footnote ? (
        <Text variant="footnote" tone="faint" style={st.footnote}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: { flex: 1 },
  footnote: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.xxs },
});
