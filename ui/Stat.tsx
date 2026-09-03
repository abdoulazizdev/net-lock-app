/**
 * ui/Stat.tsx — Affichage de valeurs
 *
 * `Stat`     : une valeur avec son libellé, alignée sur la grille tabulaire.
 * `StatTile` : la même dans une carte, avec icône et variation.
 * `StatBand` : rangée de `Stat` séparées par des filets — pour les en-têtes.
 *
 * Les chiffres utilisent toujours des glyphes à largeur fixe : sans cela, un
 * compteur qui s'incrémente fait « sauter » la mise en page.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Radius, Spacing, useTheme, type ThemeTokens, type TypeVariant } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Surface } from "./Surface";
import { Text } from "./Text";
import { Touchable } from "./Touchable";

export type StatTone = "default" | "brand" | "blocked" | "allowed" | "warning" | "focus" | "info";

function toneColor(t: ThemeTokens, tone: StatTone) {
  if (tone === "default") return t.text.primary;
  if (tone === "brand") return t.brand.base;
  return t.intent[tone].accent;
}

// ─── Stat ────────────────────────────────────────────────────────────────────

export type StatProps = {
  value: string | number;
  label: string;
  tone?: StatTone;
  /** Taille du chiffre. `title1` par défaut. */
  size?: Extract<TypeVariant, "display" | "title1" | "title2" | "title3">;
  /** Unité accolée à la valeur (« min », « % »). */
  unit?: string;
  align?: "left" | "center";
  style?: StyleProp<ViewStyle>;
};

export function Stat({
  value,
  label,
  tone = "default",
  size = "title1",
  unit,
  align = "left",
  style,
}: StatProps) {
  const { t } = useTheme();
  return (
    <View style={[align === "center" && st.centered, style]}>
      <View style={[st.valueRow, align === "center" && st.centered]}>
        <Text variant={size} color={toneColor(t, tone)} tabular numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text variant="footnote" tone="muted" style={st.unit}>
            {unit}
          </Text>
        ) : null}
      </View>
      <Text variant="overline" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ─── StatTile ────────────────────────────────────────────────────────────────

export type StatTileProps = StatProps & {
  icon?: IconName;
  /** Précision sous le libellé (« +12 % cette semaine »). */
  caption?: string;
  onPress?: () => void;
};

export function StatTile({
  icon,
  caption,
  onPress,
  tone = "default",
  style,
  ...statProps
}: StatTileProps) {
  const { t } = useTheme();
  const accent = toneColor(t, tone);

  const content = (
    <>
      <View style={st.tileHead}>
        {icon ? (
          <View
            style={[
              st.tileIcon,
              {
                backgroundColor: tone === "default" ? t.bg.cardAlt : t.intent[tone === "brand" ? "focus" : tone].bg,
                borderColor: tone === "default" ? t.border.light : t.intent[tone === "brand" ? "focus" : tone].border,
              },
            ]}
          >
            <Icon name={icon} size={16} color={accent} />
          </View>
        ) : null}
        {onPress ? <Icon name="chevron-right" size={16} color={t.text.faint} /> : null}
      </View>
      <Stat {...statProps} tone={tone} />
      {caption ? (
        <Text variant="footnote" tone="faint" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <Surface style={[st.tile, style]}>
        {content}
      </Surface>
    );
  }
  return (
    <Touchable onPress={onPress} feedback="subtle" style={st.tileFlex}>
      <Surface style={[st.tile, style]}>{content}</Surface>
    </Touchable>
  );
}

// ─── StatBand ────────────────────────────────────────────────────────────────

/** Rangée de statistiques séparées par des filets verticaux. */
export function StatBand({
  items,
  style,
}: {
  items: (StatProps & { key?: string })[];
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTheme();
  return (
    <View
      style={[
        st.band,
        { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
        style,
      ]}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.key ?? item.label}>
          {i > 0 ? (
            <View style={[st.bandSep, { backgroundColor: t.border.normal }]} />
          ) : null}
          <Stat {...item} size="title2" align="center" style={st.bandItem} />
        </React.Fragment>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  centered: { alignItems: "center" },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  unit: { marginBottom: 2 },
  tile: { flex: 1, gap: Spacing.sm, padding: Spacing.lg },
  tileFlex: { flex: 1 },
  tileHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  band: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  bandItem: { flex: 1 },
  bandSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
});
