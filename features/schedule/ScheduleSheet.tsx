/**
 * features/schedule/ScheduleSheet.tsx — Éditeur de planification
 *
 * Sert aux deux formes de planification de l'app : par application
 * (bloquer / autoriser) et par profil (activer / désactiver). Seuls les
 * intitulés d'action changent, d'où le paramètre `actions`.
 *
 * Les créneaux qui franchissent minuit sont acceptés — « 22:00 → 07:00 » est
 * précisément le cas d'usage du profil Sommeil.
 */

import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { WEEKDAYS_INITIAL, daysLabel, hourMinute } from "@/lib/format";
import { Radius, Spacing, useTheme } from "@/theme";
import { Button, Chip, Icon, Section, Sheet, Text, TextField, Touchable } from "@/ui";

/** Valeurs éditées par le panneau, indépendantes du modèle de stockage. */
export type ScheduleDraft = {
  label: string;
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  action: string;
};

export type ScheduleActionOption = {
  key: string;
  label: string;
  description: string;
  tone: "blocked" | "allowed";
};

const PRESET_DAYS: { label: string; days: number[] }[] = [
  { label: "Tous les jours", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "En semaine", days: [1, 2, 3, 4, 5] },
  { label: "Week-end", days: [0, 6] },
];

export type ScheduleSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: ScheduleDraft) => Promise<void> | void;
  /** Planification existante — passe le panneau en modification. */
  initial?: ScheduleDraft;
  actions: ScheduleActionOption[];
  /** Titre du panneau. */
  title?: string;
};

function defaultDraft(actions: ScheduleActionOption[]): ScheduleDraft {
  return {
    label: "",
    days: [1, 2, 3, 4, 5],
    startHour: 9,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
    action: actions[0]?.key ?? "",
  };
}

export function ScheduleSheet({
  visible,
  onClose,
  onSave,
  initial,
  actions,
  title,
}: ScheduleSheetProps) {
  const { t } = useTheme();
  const [draft, setDraft] = useState<ScheduleDraft>(() => defaultDraft(actions));
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(initial ?? defaultDraft(actions));
    setPicking(null);
    setError(null);
    setBusy(false);
  }, [visible, initial, actions]);

  const patch = (values: Partial<ScheduleDraft>) =>
    setDraft((prev) => ({ ...prev, ...values }));

  const toggleDay = (day: number) =>
    setDraft((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort((a, b) => a - b),
    }));

  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    // Sur Android, le sélecteur est une boîte de dialogue : il se referme seul.
    if (Platform.OS === "android") setPicking(null);
    if (event.type === "dismissed" || !date) return;
    if (picking === "start") {
      patch({ startHour: date.getHours(), startMinute: date.getMinutes() });
    } else if (picking === "end") {
      patch({ endHour: date.getHours(), endMinute: date.getMinutes() });
    }
  };

  const crossesMidnight = useMemo(() => {
    const start = draft.startHour * 60 + draft.startMinute;
    const end = draft.endHour * 60 + draft.endMinute;
    return end <= start;
  }, [draft]);

  const submit = async () => {
    if (draft.days.length === 0) {
      setError("Choisissez au moins un jour.");
      return;
    }
    const start = draft.startHour * 60 + draft.startMinute;
    const end = draft.endHour * 60 + draft.endMinute;
    if (start === end) {
      setError("Les heures de début et de fin sont identiques.");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        ...draft,
        label: draft.label.trim() || defaultLabel(draft),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const pickerValue = new Date();
  if (picking === "start") pickerValue.setHours(draft.startHour, draft.startMinute, 0, 0);
  if (picking === "end") pickerValue.setHours(draft.endHour, draft.endMinute, 0, 0);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title ?? (initial ? "Modifier la planification" : "Nouvelle planification")}
      footer={
        <Button
          label={initial ? "Enregistrer" : "Ajouter"}
          onPress={submit}
          loading={busy}
          disabled={busy}
          size="lg"
          fullWidth
        />
      }
    >
      <Section title="Créneau">
        <View style={st.times}>
          <TimeButton
            label="Début"
            value={hourMinute(draft.startHour, draft.startMinute)}
            onPress={() => setPicking("start")}
          />
          <Icon name="arrow-right" size={18} color={t.text.faint} />
          <TimeButton
            label="Fin"
            value={hourMinute(draft.endHour, draft.endMinute)}
            onPress={() => setPicking("end")}
          />
        </View>
        {crossesMidnight ? (
          <View style={st.hintRow}>
            <Icon name="weather-night" size={14} color={t.intent.focus.accent} />
            <Text variant="footnote" tone="focus">
              Le créneau passe par minuit — il se termine le lendemain matin.
            </Text>
          </View>
        ) : null}
      </Section>

      <Section title="Jours" footnote={daysLabel(draft.days)}>
        <View style={st.dayRow}>
          {WEEKDAYS_INITIAL.map((initial_, index) => {
            const active = draft.days.includes(index);
            return (
              <Touchable
                key={index}
                onPress={() => {
                  toggleDay(index);
                  setError(null);
                }}
                feedback="strong"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                style={[
                  st.day,
                  {
                    backgroundColor: active ? t.brand.base : t.bg.cardAlt,
                    borderColor: active ? t.brand.base : t.border.light,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  color={active ? t.brand.onBase : t.text.muted}
                >
                  {initial_}
                </Text>
              </Touchable>
            );
          })}
        </View>
        <View style={st.presets}>
          {PRESET_DAYS.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              active={
                preset.days.length === draft.days.length &&
                preset.days.every((d) => draft.days.includes(d))
              }
              onPress={() => {
                patch({ days: preset.days });
                setError(null);
              }}
            />
          ))}
        </View>
      </Section>

      {actions.length > 1 ? (
        <Section title="Action">
          {actions.map((option) => {
            const active = draft.action === option.key;
            const intent = t.intent[option.tone];
            return (
              <Touchable
                key={option.key}
                onPress={() => patch({ action: option.key })}
                feedback="none"
                style={[
                  st.action,
                  {
                    backgroundColor: active ? intent.bg : t.bg.card,
                    borderColor: active ? intent.accent : t.border.light,
                  },
                ]}
              >
                <Icon
                  name={active ? "radiobox-marked" : "radiobox-blank"}
                  size={20}
                  color={active ? intent.accent : t.text.faint}
                />
                <View style={st.flex}>
                  <Text variant="headline">{option.label}</Text>
                  <Text variant="footnote" tone="muted">
                    {option.description}
                  </Text>
                </View>
              </Touchable>
            );
          })}
        </Section>
      ) : null}

      <TextField
        label="Nom"
        hint="Optionnel — généré automatiquement si vide."
        value={draft.label}
        onChangeText={(v) => patch({ label: v })}
        placeholder={defaultLabel(draft)}
        maxLength={40}
        icon="tag-outline"
        error={error ?? undefined}
      />

      {picking !== null ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onTimeChange}
        />
      ) : null}
    </Sheet>
  );
}

function TimeButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { t } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      feedback="strong"
      accessibilityLabel={`${label} : ${value}`}
      style={[
        st.time,
        { backgroundColor: t.bg.cardAlt, borderColor: t.border.normal },
      ]}
    >
      <Text variant="overline" tone="faint">
        {label}
      </Text>
      <Text variant="title2" tabular>
        {value}
      </Text>
    </Touchable>
  );
}

/** Intitulé par défaut, dérivé du créneau. */
function defaultLabel(draft: ScheduleDraft): string {
  return `${hourMinute(draft.startHour, draft.startMinute)} – ${hourMinute(draft.endHour, draft.endMinute)}`;
}

const st = StyleSheet.create({
  times: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  time: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayRow: { flexDirection: "row", gap: 6 },
  day: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
