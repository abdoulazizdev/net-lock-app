/**
 * features/schedule/ScheduleRow.tsx — Ligne de planification
 *
 * Signale d'un coup d'œil si le créneau est en cours : c'est l'information la
 * plus utile quand on se demande pourquoi une app est (ou n'est pas) bloquée.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { daysLabel, hourMinute } from "@/lib/format";
import { Radius, Spacing, useTheme } from "@/theme";
import { Badge, Dot, Icon, IconButton, Switch, Text, Touchable } from "@/ui";

export type ScheduleRowProps = {
  label: string;
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  enabled: boolean;
  /** Le créneau couvre l'instant présent. */
  runningNow: boolean;
  /** Effet du créneau — colore la ligne. */
  tone: "blocked" | "allowed";
  actionLabel: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Le créneau couvre-t-il l'instant présent ? Gère le passage par minuit. */
export function isRunningNow(schedule: {
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}): boolean {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = schedule.startHour * 60 + schedule.startMinute;
  const end = schedule.endHour * 60 + schedule.endMinute;

  if (start <= end) {
    return schedule.days.includes(now.getDay()) && minutes >= start && minutes < end;
  }
  // Créneau à cheval sur minuit : la fin appartient au lendemain.
  const yesterday = (now.getDay() + 6) % 7;
  return (
    (schedule.days.includes(now.getDay()) && minutes >= start) ||
    (schedule.days.includes(yesterday) && minutes < end)
  );
}

export function ScheduleRow({
  label,
  days,
  startHour,
  startMinute,
  endHour,
  endMinute,
  enabled,
  runningNow,
  tone,
  actionLabel,
  onToggle,
  onEdit,
  onDelete,
}: ScheduleRowProps) {
  const { t } = useTheme();
  const intent = t.intent[tone];
  const highlighted = enabled && runningNow;

  return (
    <Touchable
      onPress={onEdit}
      feedback="subtle"
      accessibilityLabel={`${label}, ${daysLabel(days)}`}
      style={[
        st.row,
        {
          backgroundColor: highlighted ? intent.bg : t.bg.card,
          borderColor: highlighted ? intent.border : t.border.light,
          opacity: enabled ? 1 : 0.62,
        },
      ]}
    >
      <View style={st.head}>
        <View style={st.timeBlock}>
          <Text variant="title3" tabular>
            {hourMinute(startHour, startMinute)}
          </Text>
          <Text variant="footnote" tone="faint" tabular>
            {hourMinute(endHour, endMinute)}
          </Text>
        </View>

        <View style={[st.bar, { backgroundColor: intent.accent }]} />

        <View style={st.info}>
          <View style={st.labelRow}>
            <Text variant="headline" numberOfLines={1} style={st.flex}>
              {label}
            </Text>
            {highlighted ? (
              <View style={st.nowTag}>
                <Dot color={intent.accent} pulse size={6} />
                <Text variant="overline" color={intent.accent}>
                  En cours
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="footnote" tone="muted" numberOfLines={1}>
            {daysLabel(days)}
          </Text>
          <Badge label={actionLabel} tone={tone} />
        </View>

        <View style={st.controls}>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            tone={tone}
            size="sm"
            accessibilityLabel={`Activer ${label}`}
          />
          <IconButton
            icon="trash-can-outline"
            size="sm"
            variant="plain"
            color={t.intent.danger.accent}
            onPress={onDelete}
            accessibilityLabel={`Supprimer ${label}`}
          />
        </View>
      </View>

      {/* Frise des jours : plus rapide à lire qu'une énumération. */}
      <View style={st.weekStrip}>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const on = days.includes(day);
          return (
            <View
              key={day}
              style={[
                st.weekCell,
                {
                  backgroundColor: on ? intent.accent : t.bg.cardSunken,
                },
              ]}
            />
          );
        })}
      </View>
    </Touchable>
  );
}

/** Bloc « aucune planification », avec l'action pour en créer une. */
export function ScheduleEmpty({ onAdd }: { onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <Touchable
      onPress={onAdd}
      feedback="subtle"
      style={[
        st.empty,
        { backgroundColor: t.bg.cardAlt, borderColor: t.border.normal },
      ]}
    >
      <Icon name="calendar-plus" size={22} color={t.brand.base} />
      <View style={st.flex}>
        <Text variant="headline">Ajouter une planification</Text>
        <Text variant="footnote" tone="muted">
          Appliquer la règle automatiquement à certaines heures.
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={t.text.faint} />
    </Touchable>
  );
}

const st = StyleSheet.create({
  row: { borderRadius: Radius.md, borderWidth: 1, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md },
  timeBlock: { alignItems: "flex-end", minWidth: 46 },
  bar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  info: { flex: 1, gap: 3, alignItems: "flex-start" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, alignSelf: "stretch" },
  nowTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  controls: { alignItems: "center", gap: 2 },
  weekStrip: { flexDirection: "row", gap: 2, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  weekCell: { flex: 1, height: 3, borderRadius: 2 },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  flex: { flex: 1 },
});
