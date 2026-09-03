/**
 * features/sessions/TimerSheet.tsx — Minuterie rapide
 *
 * Contrairement au Focus, la minuterie est réversible d'un tap : c'est une
 * commodité (« coupe-moi les distractions le temps d'un café »), pas un
 * engagement. Elle applique les règles déjà enregistrées, sans choix de profil.
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { humanMinutes, plural } from "@/lib/format";
import StorageService from "@/services/storage.service";
import TimerService from "@/services/timer.service";
import { Radius, Spacing, useTheme } from "@/theme";
import { Button, Icon, Section, Sheet, Text, Touchable, toast } from "@/ui";
import { usePremium } from "../premium/usePremium";

const PRESETS = [
  { minutes: 5, label: "5 min", desc: "Pause rapide" },
  { minutes: 15, label: "15 min", desc: "Le temps d'un café" },
  { minutes: 30, label: "30 min", desc: "Demi-heure" },
  { minutes: 60, label: "1 h", desc: "Session complète" },
  { minutes: 120, label: "2 h", desc: "Travail profond" },
  { minutes: 240, label: "4 h", desc: "Demi-journée" },
];

export type TimerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onStarted: () => void;
  onLocked: () => void;
};

export function TimerSheet({ visible, onClose, onStarted, onLocked }: TimerSheetProps) {
  const { t } = useTheme();
  const { limits } = usePremium();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMinutes(null);
    setStarting(false);
    setError(null);
    StorageService.getRules()
      .then((rules) => setBlockedCount(rules.filter((r) => r.isBlocked).length))
      .catch(() => {});
  }, [visible]);

  const select = useCallback(
    (value: number) => {
      if (!limits.canUseTimerPreset(value).allowed) {
        onLocked();
        return;
      }
      setMinutes(value);
    },
    [limits, onLocked],
  );

  const start = useCallback(async () => {
    if (minutes === null) return;
    setStarting(true);
    setError(null);
    try {
      // `TimerService.start` démarre la protection réseau si besoin et la
      // remet dans son état initial à l'expiration.
      await TimerService.start(minutes);
      onStarted();
      onClose();
      toast.success("Minuterie démarrée.");
    } catch {
      setError("La minuterie n'a pas pu démarrer.");
    } finally {
      setStarting(false);
    }
  }, [minutes, onClose, onStarted]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Minuterie"
      subtitle="Bloque les apps déjà marquées comme bloquées, puis rétablit tout automatiquement. Annulable à tout moment."
      error={error}
      footer={
        <Button
          label={minutes ? `Démarrer — ${humanMinutes(minutes)}` : "Choisir une durée"}
          icon="timer-outline"
          onPress={start}
          loading={starting}
          disabled={minutes === null || starting || blockedCount === 0}
          size="lg"
          fullWidth
        />
      }
    >
      {blockedCount === 0 ? (
        <View
          style={[
            st.notice,
            { backgroundColor: t.intent.warning.bg, borderColor: t.intent.warning.border },
          ]}
        >
          <Icon name="alert-outline" size={18} color={t.intent.warning.accent} />
          <Text variant="callout" tone="warning" style={st.flex}>
            Aucune app bloquée — la minuterie n'aurait aucun effet.
          </Text>
        </View>
      ) : (
        <View
          style={[
            st.notice,
            { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          ]}
        >
          <Icon name="shield-off-outline" size={18} color={t.text.muted} />
          <Text variant="callout" tone="secondary" style={st.flex}>
            {plural(blockedCount, "app sera coupée", "apps seront coupées")} du réseau.
          </Text>
        </View>
      )}

      <Section title="Durée">
        <View style={st.grid}>
          {PRESETS.map((preset) => {
            const locked = !limits.canUseTimerPreset(preset.minutes).allowed;
            const active = minutes === preset.minutes;
            return (
              <Touchable
                key={preset.minutes}
                onPress={() => select(preset.minutes)}
                feedback="strong"
                style={[
                  st.preset,
                  {
                    backgroundColor: active ? t.brand.soft : t.bg.card,
                    borderColor: active ? t.brand.base : t.border.light,
                    borderWidth: active ? 2 : 1,
                  },
                ]}
              >
                <Text variant="title3" tone={active ? "brand" : "primary"} tabular>
                  {preset.label}
                </Text>
                <Text variant="footnote" tone="muted" numberOfLines={1}>
                  {preset.desc}
                </Text>
                {locked ? (
                  <View style={st.presetLock}>
                    <Icon name="lock" size={12} color={t.intent.focus.accent} />
                  </View>
                ) : null}
              </Touchable>
            );
          })}
        </View>
      </Section>
    </Sheet>
  );
}

const st = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  preset: {
    flexGrow: 1,
    flexBasis: "30%",
    gap: 2,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  presetLock: { position: "absolute", top: 6, right: 8 },
  flex: { flex: 1 },
});
