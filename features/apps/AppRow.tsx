/**
 * features/apps/AppRow.tsx — Ligne d'application
 *
 * Utilisée dans l'onglet Apps, le détail d'un profil et la liste blanche.
 * L'interrupteur signifie « blocage activé » : il est donc rouge, jamais vert.
 *
 * En mode sélection, l'interrupteur laisse la place à une case à cocher et
 * l'appui sur la ligne coche au lieu d'ouvrir le détail.
 *
 * `React.memo` avec comparaison explicite : dans une liste de plusieurs
 * centaines d'apps, laisser React comparer les callbacks recrée toutes les
 * lignes à chaque frappe dans la recherche.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { Radius, Spacing, useTheme } from "@/theme";
import { AppAvatar, Badge, Icon, Switch, Text, Touchable } from "@/ui";
import type { AppEntry } from "./useAppCatalog";

export type AppRowProps = {
  app: AppEntry;
  onToggle: (app: AppEntry) => void;
  onPress?: (app: AppEntry) => void;
  /** Règles figées (session Focus en cours) — l'interrupteur est inerte. */
  locked?: boolean;
  /** Quota gratuit atteint : seul le déblocage reste possible. */
  quotaReached?: boolean;
  /** Sens inversé : l'interrupteur signifie « autorisée » (liste blanche). */
  invert?: boolean;
  /** Masque l'interrupteur — pour les listes en lecture seule. */
  readOnly?: boolean;
  /** Mode sélection multiple. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (app: AppEntry) => void;
  /** Entre en mode sélection sur appui long. */
  onLongPress?: (app: AppEntry) => void;
};

export const AppRow = React.memo(
  function AppRow({
    app,
    onToggle,
    onPress,
    locked = false,
    quotaReached = false,
    invert = false,
    readOnly = false,
    selectable = false,
    selected = false,
    onSelect,
    onLongPress,
  }: AppRowProps) {
    const { t } = useTheme();

    const on = invert ? !app.blocked : app.blocked;
    const blockedByQuota = quotaReached && !app.blocked && !invert;
    const disabled = locked || blockedByQuota;
    const tone = invert ? "allowed" : "blocked";

    const highlighted = selectable ? selected : app.blocked && !invert;
    const accentBorder = selectable ? t.brand.base : t.intent.blocked.border;
    const accentBackground = selectable ? t.brand.soft : t.intent.blocked.bg;

    return (
      <Touchable
        onPress={
          selectable ? () => onSelect?.(app) : onPress ? () => onPress(app) : undefined
        }
        onLongPress={onLongPress ? () => onLongPress(app) : undefined}
        disabled={!selectable && !onPress}
        feedback={selectable ? "subtle" : "none"}
        pressedOpacity={0.6}
        haptic={selectable ? "selection" : "none"}
        accessibilityRole={selectable ? "checkbox" : onPress ? "button" : undefined}
        accessibilityState={selectable ? { checked: selected } : undefined}
        accessibilityLabel={app.appName}
        style={[
          st.row,
          {
            backgroundColor: highlighted ? accentBackground : t.bg.card,
            borderColor: highlighted ? accentBorder : t.border.light,
          },
        ]}
      >
        {selectable ? (
          <View
            style={[
              st.checkbox,
              {
                backgroundColor: selected ? t.brand.base : "transparent",
                borderColor: selected ? t.brand.base : t.border.normal,
              },
            ]}
          >
            {selected ? <Icon name="check" size={14} color={t.brand.onBase} /> : null}
          </View>
        ) : null}

        <View style={st.avatarWrap}>
          <AppAvatar
            packageName={app.packageName}
            appName={app.appName}
            icon={app.icon}
            size="md"
          />
          {app.isSystemApp ? (
            <View
              style={[
                st.sysTag,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.normal },
              ]}
            >
              <Text variant="overline" tone="faint" style={st.sysTagText}>
                SYS
              </Text>
            </View>
          ) : null}
        </View>

        <View style={st.info}>
          <Text
            variant="headline"
            numberOfLines={1}
            tone={app.blocked && !invert && !selectable ? "secondary" : "primary"}
          >
            {app.appName}
          </Text>
          <Text variant="footnote" tone="faint" numberOfLines={1}>
            {app.packageName}
          </Text>
        </View>

        {app.isWorkProfile ? <Badge label="Pro" tone="info" /> : null}
        {app.isEnabled === false ? <Badge label="Désactivée" tone="warning" /> : null}

        {selectable || readOnly ? null : (
          <Switch
            value={on}
            onValueChange={() => onToggle(app)}
            tone={tone}
            size="sm"
            disabled={disabled}
            accessibilityLabel={
              invert
                ? `${app.appName} — accès internet ${on ? "autorisé" : "bloqué"}`
                : `${app.appName} — blocage ${on ? "activé" : "désactivé"}`
            }
          />
        )}

        {!selectable && onPress ? (
          <Icon name="chevron-right" size={18} color={t.text.faint} />
        ) : null}
      </Touchable>
    );
  },
  (prev, next) =>
    prev.app.packageName === next.app.packageName &&
    prev.app.blocked === next.app.blocked &&
    prev.app.icon === next.app.icon &&
    prev.app.appName === next.app.appName &&
    prev.app.isEnabled === next.app.isEnabled &&
    prev.locked === next.locked &&
    prev.quotaReached === next.quotaReached &&
    prev.invert === next.invert &&
    prev.readOnly === next.readOnly &&
    prev.selectable === next.selectable &&
    prev.selected === next.selected,
);

/** Hauteur fixe de la ligne — permet `getItemLayout` sur les grandes listes. */
export const APP_ROW_HEIGHT = 68;

const st = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    height: APP_ROW_HEIGHT,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: { position: "relative" },
  sysTag: {
    position: "absolute",
    bottom: -3,
    right: -5,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  sysTagText: { fontSize: 8, letterSpacing: 0.4 },
  info: { flex: 1, gap: 1 },
});
