/**
 * features/profiles/ProfileCard.tsx — Carte de profil
 *
 * Affiche ce qui décide de l'action : le nom, combien d'apps sont concernées,
 * si des planifications tournent, et si le profil est celui qui s'applique en
 * ce moment. L'interrupteur active le profil ; le corps de la carte ouvre son
 * détail.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { daysLabel, hourMinute, plural } from "@/lib/format";
import type { Profile } from "@/types";
import { Radius, Spacing, useTheme } from "@/theme";
import { Badge, Dot, Icon, Switch, Text, Touchable } from "@/ui";
import { activeSchedules, blockedInProfile, profileAccent } from "./useProfiles";

export type ProfileCardProps = {
  profile: Profile;
  active: boolean;
  busy?: boolean;
  onPress: () => void;
  onToggle: () => void;
};

export const ProfileCard = React.memo(function ProfileCard({
  profile,
  active,
  busy = false,
  onPress,
  onToggle,
}: ProfileCardProps) {
  const { t } = useTheme();
  const accent = profileAccent(profile.id);
  const blocked = blockedInProfile(profile);
  const schedules = profile.schedules ?? [];
  const running = activeSchedules(profile);

  return (
    <Touchable
      onPress={onPress}
      feedback="subtle"
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}, ${plural(blocked, "app bloquée", "apps bloquées")}`}
      style={[
        st.card,
        {
          backgroundColor: t.bg.card,
          borderColor: active ? accent : t.border.light,
          borderWidth: active ? 2 : 1,
        },
        t.shadow.sm,
      ]}
    >
      <View style={st.head}>
        <View style={[st.mark, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
          <Icon name="account-multiple" size={20} color={accent} />
        </View>

        <View style={st.title}>
          <View style={st.titleRow}>
            <Text variant="title3" numberOfLines={1} style={st.flex}>
              {profile.name}
            </Text>
            {active ? (
              <View style={st.activeTag}>
                <Dot color={accent} pulse size={7} />
                <Text variant="overline" color={accent}>
                  Actif
                </Text>
              </View>
            ) : null}
          </View>
          {profile.description ? (
            <Text variant="footnote" tone="muted" numberOfLines={2}>
              {profile.description}
            </Text>
          ) : null}
        </View>

        <Switch
          value={active}
          onValueChange={onToggle}
          tone="allowed"
          size="sm"
          disabled={busy}
          accessibilityLabel={`Activer le profil ${profile.name}`}
        />
      </View>

      <View style={[st.meta, { borderTopColor: t.border.light }]}>
        <View style={st.metaItem}>
          <Icon name="shield-off-outline" size={14} color={t.intent.blocked.accent} />
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {plural(blocked, "app", "apps")}
          </Text>
        </View>

        <View style={[st.metaSep, { backgroundColor: t.border.light }]} />

        <View style={st.metaItem}>
          <Icon
            name={running > 0 ? "calendar-clock" : "calendar-blank-outline"}
            size={14}
            color={running > 0 ? t.intent.warning.accent : t.text.faint}
          />
          <Text variant="footnote" tone={running > 0 ? "secondary" : "faint"} numberOfLines={1}>
            {schedules.length === 0
              ? "Aucune planification"
              : plural(schedules.length, "planification")}
          </Text>
        </View>

        {blocked === 0 ? (
          <Badge label="À compléter" tone="warning" />
        ) : null}
      </View>

      {/* Aperçu de la première planification : suffisant pour se repérer. */}
      {schedules.length > 0 ? (
        <View style={[st.schedule, { backgroundColor: t.bg.cardAlt }]}>
          <Icon name="clock-outline" size={13} color={t.text.muted} />
          <Text variant="footnote" tone="muted" numberOfLines={1} style={st.flex}>
            {hourMinute(schedules[0].startHour, schedules[0].startMinute)} –{" "}
            {hourMinute(schedules[0].endHour, schedules[0].endMinute)} ·{" "}
            {daysLabel(schedules[0].days)}
          </Text>
          {schedules.length > 1 ? (
            <Text variant="footnote" tone="faint">
              +{schedules.length - 1}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Touchable>
  );
});

const st = StyleSheet.create({
  card: { borderRadius: Radius.lg, overflow: "hidden" },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  activeTag: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaSep: { width: StyleSheet.hairlineWidth, height: 12 },
  schedule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  flex: { flex: 1 },
});
