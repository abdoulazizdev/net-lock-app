/**
 * features/home/QuickActions.tsx — Raccourcis de l'accueil
 *
 * Grille de deux colonnes vers les quatre actions les plus fréquentes. Chaque
 * tuile affiche son état courant : on doit pouvoir constater qu'une session
 * tourne ou que la liste blanche est active sans ouvrir l'écran.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { Radius, Spacing, useTheme, type ThemeTokens } from "@/theme";
import { Badge, Icon, Text, Touchable, type IconName } from "@/ui";

export type QuickAction = {
  key: string;
  icon: IconName;
  label: string;
  hint: string;
  tone: "brand" | "focus" | "info" | "allowed" | "warning";
  /** Étiquette d'état, affichée en haut à droite. */
  badge?: string;
  active?: boolean;
  locked?: boolean;
  onPress: () => void;
};

function toneColors(t: ThemeTokens, tone: QuickAction["tone"]) {
  if (tone === "brand") {
    return { accent: t.brand.base, bg: t.brand.soft, border: t.brand.softBorder };
  }
  const i = t.intent[tone];
  return { accent: i.accent, bg: i.bg, border: i.border };
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={st.grid}>
      {actions.map((action) => (
        <QuickActionTile key={action.key} action={action} />
      ))}
    </View>
  );
}

function QuickActionTile({ action }: { action: QuickAction }) {
  const { t } = useTheme();
  const c = toneColors(t, action.tone);

  return (
    <Touchable
      onPress={action.onPress}
      feedback="subtle"
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${action.label}. ${action.hint}`}
      style={[
        st.tile,
        {
          backgroundColor: action.active ? c.bg : t.bg.card,
          borderColor: action.active ? c.border : t.border.light,
        },
      ]}
    >
      <View style={st.tileHead}>
        <View
          style={[
            st.iconBox,
            { backgroundColor: c.bg, borderColor: c.border },
          ]}
        >
          <Icon name={action.icon} size={20} color={c.accent} />
        </View>
        {action.badge ? (
          <Badge label={action.badge} tone={action.tone === "brand" ? "brand" : action.tone} />
        ) : action.locked ? (
          <Icon name="lock" size={13} color={t.intent.focus.accent} />
        ) : null}
      </View>

      <View style={st.tileText}>
        <Text variant="headline" numberOfLines={1}>
          {action.label}
        </Text>
        <Text variant="footnote" tone="muted" numberOfLines={2}>
          {action.hint}
        </Text>
      </View>
    </Touchable>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  tileHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { gap: 2 },
});
