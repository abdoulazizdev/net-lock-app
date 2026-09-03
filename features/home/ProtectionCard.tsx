/**
 * features/home/ProtectionCard.tsx — État de la protection
 *
 * Pièce maîtresse de l'accueil. Elle doit répondre en un coup d'œil à
 * « suis-je protégé, là, maintenant ? » — d'où trois états visuellement
 * distincts plutôt qu'un simple interrupteur :
 *
 *   • active     — vert, anneau rempli, tout va bien ;
 *   • incohérent — ambre, des règles existent mais rien n'est appliqué ;
 *   • inactive   — neutre, aucune règle, rien à signaler.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { percent, plural } from "@/lib/format";
import type { LogSummary } from "@/services/connection-log.service";
import { Radius, Spacing, useTheme, type ThemeTokens } from "@/theme";
import { Badge, Dot, Icon, ProgressRing, Switch, Text } from "@/ui";

export type ProtectionStatus = "active" | "inconsistent" | "idle";

export function protectionStatus(vpnActive: boolean, blockedCount: number): ProtectionStatus {
  if (vpnActive) return "active";
  return blockedCount > 0 ? "inconsistent" : "idle";
}

type Look = {
  accent: string;
  bg: string;
  border: string;
  text: string;
  label: string;
  detail: string;
};

function look(
  t: ThemeTokens,
  status: ProtectionStatus,
  blockedCount: number,
  allowlistEnabled: boolean,
): Look {
  switch (status) {
    case "active":
      return {
        accent: t.intent.allowed.accent,
        bg: t.intent.allowed.bg,
        border: t.intent.allowed.border,
        text: t.intent.allowed.text,
        label: "Protection active",
        detail: allowlistEnabled
          ? "Mode liste blanche — tout est bloqué sauf les apps autorisées"
          : plural(blockedCount, "app coupée du réseau", "apps coupées du réseau"),
      };
    case "inconsistent":
      return {
        accent: t.intent.warning.accent,
        bg: t.intent.warning.bg,
        border: t.intent.warning.border,
        text: t.intent.warning.text,
        label: "Règles inactives",
        detail: `${plural(blockedCount, "app est marquée bloquée", "apps sont marquées bloquées")} mais gardent internet`,
      };
    default:
      return {
        accent: t.text.muted,
        bg: t.bg.cardAlt,
        border: t.border.light,
        text: t.text.secondary,
        label: "Protection inactive",
        detail: "Aucune règle de blocage enregistrée",
      };
  }
}

export type ProtectionCardProps = {
  vpnActive: boolean;
  busy: boolean;
  blockedCount: number;
  allowlistEnabled: boolean;
  logs: LogSummary;
  /** Session Focus ou minuterie en cours : la protection est verrouillée. */
  locked: boolean;
  onToggle: () => void;
};

export function ProtectionCard({
  vpnActive,
  busy,
  blockedCount,
  allowlistEnabled,
  logs,
  locked,
  onToggle,
}: ProtectionCardProps) {
  const { t } = useTheme();
  const status = protectionStatus(vpnActive, blockedCount);
  const c = look(t, status, blockedCount, allowlistEnabled);

  const filteredPct = percent(logs.totalBlocked, logs.totalEvents);
  // Sans historique, l'anneau reflète l'état plutôt qu'une statistique vide.
  const ringProgress =
    logs.totalEvents > 0 ? filteredPct / 100 : status === "active" ? 1 : 0;

  return (
    <View
      style={[
        st.card,
        { backgroundColor: t.bg.card, borderColor: c.border },
        t.shadow.md,
      ]}
    >
      <View style={[st.tint, { backgroundColor: c.bg }]} />

      <View style={st.header}>
        <View style={st.statusRow}>
          <Dot color={c.accent} pulse={status === "active"} size={9} />
          <Text variant="overline" color={c.text}>
            {c.label}
          </Text>
        </View>
        {allowlistEnabled ? <Badge label="Liste blanche" tone="info" /> : null}
      </View>

      <View style={st.body}>
        <ProgressRing
          progress={ringProgress}
          size={112}
          thickness={9}
          color={c.accent}
          trackColor={t.bg.cardSunken}
        >
          <Icon
            name={
              status === "active"
                ? "shield-check"
                : status === "inconsistent"
                  ? "shield-alert-outline"
                  : "shield-off-outline"
            }
            size={34}
            color={c.accent}
          />
        </ProgressRing>

        <View style={st.figures}>
          {logs.totalEvents > 0 ? (
            <>
              <View style={st.figureRow}>
                <Text variant="display" color={c.accent} tabular>
                  {filteredPct}
                </Text>
                <Text variant="title3" tone="muted">
                  %
                </Text>
              </View>
              <Text variant="footnote" tone="muted">
                du trafic filtré
              </Text>
            </>
          ) : (
            <>
              <Text variant="display" color={c.accent} tabular>
                {blockedCount}
              </Text>
              <Text variant="footnote" tone="muted">
                {blockedCount > 1 ? "apps bloquées" : "app bloquée"}
              </Text>
            </>
          )}
        </View>
      </View>

      <Text variant="callout" tone="secondary" numberOfLines={2} style={st.detail}>
        {c.detail}
      </Text>

      <View style={[st.toggleRow, { borderTopColor: t.border.light }]}>
        <View style={st.toggleText}>
          <Text variant="headline">Protection réseau</Text>
          <Text variant="footnote" tone="faint" numberOfLines={1}>
            {locked
              ? "Verrouillée pendant la session en cours"
              : "VPN local — aucun trafic ne quitte l'appareil"}
          </Text>
        </View>
        <Switch
          value={vpnActive}
          onValueChange={onToggle}
          tone="allowed"
          disabled={busy || locked}
          accessibilityLabel="Protection réseau"
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  // Voile teinté sur la partie haute : donne sa couleur à la carte sans
  // sacrifier la lisibilité du texte posé dessus.
  tint: { position: "absolute", left: 0, right: 0, top: 0, height: 150, opacity: 0.55 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  figures: { flex: 1, gap: 1 },
  figureRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  detail: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flex: 1, gap: 1 },
});
