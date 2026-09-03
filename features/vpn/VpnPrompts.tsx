/**
 * features/vpn/VpnPrompts.tsx — Explications et rappels sur la protection
 *
 * NetOff bloque le trafic via un VPN *local* : rien ne sort de l'appareil, mais
 * Android affiche malgré tout l'avertissement standard « une application
 * surveille votre trafic ». Sans explication à ce moment précis, beaucoup
 * d'utilisateurs refusent la permission. D'où ce panneau.
 *
 * `VpnAlert` traite l'autre cas problématique : des règles enregistrées alors
 * que la protection est coupée — l'app semble alors ne rien faire.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { plural } from "@/lib/format";
import { Radius, Spacing, useTheme } from "@/theme";
import { Button, Icon, Sheet, Text, Touchable, type IconName } from "@/ui";

// ─── Panneau d'explication ───────────────────────────────────────────────────

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "cellphone-lock",
    title: "Tout reste sur l'appareil",
    body: "Le tunnel n'a aucun serveur distant : le trafic des apps bloquées est simplement abandonné localement.",
  },
  {
    icon: "eye-off-outline",
    title: "Aucune collecte",
    body: "NetOff ne lit pas, n'enregistre pas et ne transmet pas le contenu de vos connexions.",
  },
  {
    icon: "flash-outline",
    title: "Sans effet sur la batterie",
    body: "Le service ne fait qu'écarter les paquets des apps bloquées, sans chiffrement ni relais.",
  },
];

export type VpnExplainerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onActivate: () => void;
  /** Nom de l'app qui vient d'être bloquée, s'il y en a une. */
  appName?: string;
  busy?: boolean;
};

export function VpnExplainerSheet({
  visible,
  onClose,
  onActivate,
  appName,
  busy = false,
}: VpnExplainerSheetProps) {
  const { t } = useTheme();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Activer la protection réseau"
      subtitle={
        appName
          ? `« ${appName} » est marquée comme bloquée, mais rien ne sera coupé tant que la protection n'est pas active.`
          : "Les règles enregistrées ne prennent effet que lorsque la protection est active."
      }
      footer={
        <>
          <Button
            label="Activer maintenant"
            icon="shield-check"
            onPress={onActivate}
            loading={busy}
            size="lg"
            fullWidth
          />
          <Button label="Plus tard" variant="ghost" onPress={onClose} fullWidth />
        </>
      }
    >
      <View
        style={[
          st.notice,
          { backgroundColor: t.intent.info.bg, borderColor: t.intent.info.border },
        ]}
      >
        <Icon name="information-outline" size={18} color={t.intent.info.accent} />
        <Text variant="callout" tone="secondary" style={st.flex}>
          Android va demander l'autorisation d'établir un VPN. C'est le message
          standard du système — voici ce qu'il implique réellement.
        </Text>
      </View>

      {POINTS.map((point) => (
        <View key={point.title} style={st.point}>
          <View
            style={[
              st.pointIcon,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
          >
            <Icon name={point.icon} size={18} color={t.brand.base} />
          </View>
          <View style={st.flex}>
            <Text variant="headline">{point.title}</Text>
            <Text variant="callout" tone="muted">
              {point.body}
            </Text>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

// ─── Rappel en ligne ─────────────────────────────────────────────────────────

export type VpnAlertProps = {
  blockedCount: number;
  onActivate: () => void;
  onDismiss?: () => void;
  busy?: boolean;
};

/** Bandeau « des règles existent mais la protection est coupée ». */
export function VpnAlert({ blockedCount, onActivate, onDismiss, busy }: VpnAlertProps) {
  const { t } = useTheme();

  return (
    <View
      style={[
        st.alert,
        { backgroundColor: t.intent.warning.bg, borderColor: t.intent.warning.border },
      ]}
    >
      <Icon name="shield-alert-outline" size={20} color={t.intent.warning.accent} />
      <View style={st.flex}>
        <Text variant="headline" tone="warning" numberOfLines={1}>
          Protection désactivée
        </Text>
        <Text variant="footnote" tone="muted" numberOfLines={2}>
          {plural(blockedCount, "app est marquée bloquée", "apps sont marquées bloquées")}{" "}
          mais gardent l'accès à internet.
        </Text>
      </View>
      <Button
        label="Activer"
        size="sm"
        onPress={onActivate}
        loading={busy}
      />
      {onDismiss ? (
        <Touchable onPress={onDismiss} feedback="none" hitSlop={10} accessibilityLabel="Ignorer">
          <Icon name="close" size={16} color={t.text.muted} />
        </Touchable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  notice: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  point: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  pointIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
