/**
 * ui/ListRow.tsx — Ligne de liste
 *
 * Une seule ligne pour les réglages, menus et listes de détail. Le contenu à
 * droite est piloté par `trailing` :
 *
 *   <ListRow icon="lock" title="Code PIN" trailing="chevron" onPress={…} />
 *   <ListRow icon="wifi" title="Wi-Fi seulement" trailing={<Switch … />} />
 *   <ListRow title="Version" value="1.0.25" />
 *
 * `ListGroup` regroupe plusieurs lignes dans une carte avec séparateurs.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Radius, Spacing, useTheme, type ThemeTokens } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { Touchable } from "./Touchable";
import { Surface } from "./Surface";

export type ListRowTone = "default" | "brand" | "blocked" | "allowed" | "warning" | "focus" | "danger";

function iconColors(t: ThemeTokens, tone: ListRowTone) {
  if (tone === "default") {
    return { bg: t.bg.cardAlt, border: t.border.light, fg: t.text.secondary };
  }
  if (tone === "brand") {
    return { bg: t.brand.soft, border: t.brand.softBorder, fg: t.brand.base };
  }
  const i = t.intent[tone];
  return { bg: i.bg, border: i.border, fg: i.accent };
}

export type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Emoji ou glyphe, alternative à `icon`. */
  glyph?: string;
  tone?: ListRowTone;
  /** Valeur affichée à droite, avant l'élément `trailing`. */
  value?: string;
  trailing?: React.ReactNode | "chevron" | "none";
  onPress?: () => void;
  disabled?: boolean;
  /** Verrouillé derrière Premium — affiche un cadenas et grise la ligne. */
  locked?: boolean;
  /** Compact : hauteur réduite, pour les menus. */
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  title,
  subtitle,
  icon,
  glyph,
  tone = "default",
  value,
  trailing = "none",
  onPress,
  disabled = false,
  locked = false,
  dense = false,
  style,
}: ListRowProps) {
  const { t } = useTheme();
  const c = iconColors(t, tone);
  const interactive = !!onPress && !disabled;

  const body = (
    <>
      {icon || glyph ? (
        <View
          style={[
            st.iconBox,
            dense && st.iconBoxDense,
            { backgroundColor: c.bg, borderColor: c.border },
          ]}
        >
          {icon ? (
            <Icon name={icon} size={dense ? 16 : 19} color={c.fg} />
          ) : (
            <Text variant="callout" color={c.fg}>
              {glyph}
            </Text>
          )}
        </View>
      ) : null}

      <View style={st.textBlock}>
        <View style={st.titleRow}>
          <Text variant={dense ? "bodyStrong" : "headline"} numberOfLines={1} style={st.flex}>
            {title}
          </Text>
          {locked ? <Icon name="lock" size={13} color={t.intent.focus.accent} /> : null}
        </View>
        {subtitle ? (
          <Text variant="footnote" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text variant="callout" tone="muted" numberOfLines={1} tabular>
          {value}
        </Text>
      ) : null}

      {trailing === "chevron" ? (
        <Icon name="chevron-right" size={20} color={t.text.faint} />
      ) : trailing === "none" ? null : (
        trailing
      )}
    </>
  );

  if (!interactive) {
    return (
      <View
        style={[st.row, dense && st.rowDense, disabled && st.disabled, style]}
        accessible
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      >
        {body}
      </View>
    );
  }

  return (
    <Touchable
      onPress={onPress}
      feedback="none"
      pressedOpacity={0.55}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[st.row, dense && st.rowDense, style]}
    >
      {body}
    </Touchable>
  );
}

// ─── Groupe ──────────────────────────────────────────────────────────────────

/**
 * Regroupe des lignes dans une carte, en insérant les séparateurs.
 * Les enfants `null`/`false` sont ignorés — pratique pour les lignes
 * conditionnelles.
 */
export function ListGroup({
  children,
  /** Retrait du séparateur, aligné sur le texte quand les lignes ont une icône. */
  inset = 58,
  style,
}: {
  children: React.ReactNode;
  inset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Surface radius={Radius.lg} style={style}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? (
            <View
              style={[
                st.sep,
                { marginLeft: inset, backgroundColor: t.border.light },
              ]}
            />
          ) : null}
          {child}
        </View>
      ))}
    </Surface>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    minHeight: 62,
  },
  rowDense: { paddingVertical: Spacing.sm, minHeight: 48, gap: Spacing.sm + 2 },
  disabled: { opacity: 0.5 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxDense: { width: 30, height: 30, borderRadius: Radius.xs },
  textBlock: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flexShrink: 1 },
  sep: { height: StyleSheet.hairlineWidth },
});
