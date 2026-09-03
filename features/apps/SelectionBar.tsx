/**
 * features/apps/SelectionBar.tsx — Barre d'actions de la sélection multiple
 *
 * Ancrée en bas de l'écran pendant le mode sélection. Les deux actions sont
 * proposées côte à côte plutôt qu'une bascule : après avoir coché dix apps
 * dont certaines sont déjà bloquées, « inverser » serait imprévisible — on
 * veut dire « bloque tout ça » ou « libère tout ça ».
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { plural } from "@/lib/format";
import { Radius, Spacing, useTheme } from "@/theme";
import { Button, Icon, Text, Touchable } from "@/ui";

export type SelectionBarProps = {
  count: number;
  /** Parmi la sélection, combien sont déjà dans l'état visé par `onBlock`. */
  alreadyCount: number;
  /** Formule décrivant `alreadyCount`, au singulier et au pluriel. */
  alreadyLabel?: [singular: string, plural: string];
  allSelected: boolean;
  busy?: boolean;
  onToggleAll: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onCancel: () => void;
  /** Décalage bas — hauteur de la barre d'onglets, le cas échéant. */
  bottomOffset?: number;
  /** Libellés inversés pour la liste blanche. */
  blockLabel?: string;
  unblockLabel?: string;
};

export function SelectionBar({
  count,
  alreadyCount,
  alreadyLabel = ["déjà bloquée", "déjà bloquées"],
  allSelected,
  busy = false,
  onToggleAll,
  onBlock,
  onUnblock,
  onCancel,
  bottomOffset = 0,
  blockLabel = "Bloquer",
  unblockLabel = "Débloquer",
}: SelectionBarProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      exiting={FadeOutDown.duration(160)}
      style={[
        st.host,
        {
          paddingBottom: insets.bottom + bottomOffset + Spacing.md,
          backgroundColor: t.bg.elevated,
          borderTopColor: t.border.normal,
        },
        t.shadow.lg,
      ]}
    >
      <View style={st.header}>
        <Touchable
          onPress={onToggleAll}
          feedback="strong"
          accessibilityRole="button"
          accessibilityLabel={allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          style={[
            st.selectAll,
            { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          ]}
        >
          <Icon
            name={allSelected ? "checkbox-multiple-marked" : "checkbox-multiple-blank-outline"}
            size={16}
            color={allSelected ? t.brand.base : t.text.muted}
          />
          <Text variant="caption" tone={allSelected ? "link" : "secondary"}>
            {allSelected ? "Tout décocher" : "Tout cocher"}
          </Text>
        </Touchable>

        <View style={st.summary}>
          <Text variant="headline" numberOfLines={1}>
            {count === 0 ? "Aucune sélection" : plural(count, "app sélectionnée", "apps sélectionnées")}
          </Text>
          {count > 0 ? (
            <Text variant="footnote" tone="faint" numberOfLines={1}>
              {alreadyCount} {alreadyCount > 1 ? alreadyLabel[1] : alreadyLabel[0]}
            </Text>
          ) : null}
        </View>

        <Touchable
          onPress={onCancel}
          feedback="strong"
          hitSlop={8}
          accessibilityLabel="Quitter la sélection"
        >
          <Icon name="close" size={20} color={t.text.muted} />
        </Touchable>
      </View>

      <View style={st.actions}>
        <View style={st.action}>
          <Button
            label={blockLabel}
            icon="shield-off-outline"
            variant="danger"
            onPress={onBlock}
            disabled={count === 0 || busy}
            fullWidth
          />
        </View>
        <View style={st.action}>
          <Button
            label={unblockLabel}
            icon="shield-check-outline"
            variant="secondary"
            onPress={onUnblock}
            disabled={count === 0 || busy}
            fullWidth
          />
        </View>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.md,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    zIndex: 50,
  },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  selectAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  summary: { flex: 1, gap: 1 },
  actions: { flexDirection: "row", gap: Spacing.sm },
  action: { flex: 1 },
});
