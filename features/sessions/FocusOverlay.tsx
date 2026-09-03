/**
 * features/sessions/FocusOverlay.tsx — Écran plein d'une session Focus
 *
 * Volontairement dépouillé : un compte à rebours, ce qui est bloqué, et une
 * seule sortie possible par appui maintenu. Rien d'autre à faire ici — c'est
 * le but.
 */

import React, { useCallback } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { countdownParts, humanMinutes, plural } from "@/lib/format";
import AppEvents from "@/services/app-events";
import FocusService, { type FocusStatus } from "@/services/focus.service";
import ProductivityService from "@/services/productivity.service";
import { Radius, Spacing, useTheme } from "@/theme";
import { Dot, Icon, IconButton, ProgressRing, Text, toast } from "@/ui";
import { HoldToConfirm } from "./HoldToConfirm";

export type FocusOverlayProps = {
  visible: boolean;
  status: FocusStatus;
  remainingMs: number;
  onClose: () => void;
  onStopped: () => void;
};

export function FocusOverlay({
  visible,
  status,
  remainingMs,
  onClose,
  onStopped,
}: FocusOverlayProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  const totalMs = status.durationMinutes * 60_000;
  const elapsed = Math.max(0, totalMs - remainingMs);
  const progress = totalMs > 0 ? elapsed / totalMs : 0;
  const { hours, minutes, seconds } = countdownParts(remainingMs);

  const stop = useCallback(async () => {
    try {
      await FocusService.stopFocus();
      // La session est journalisée même interrompue : le temps déjà tenu
      // compte dans les statistiques.
      const doneMinutes = Math.round(elapsed / 60_000);
      if (doneMinutes > 0) {
        await ProductivityService.logFocusSession(doneMinutes, status.packages.length);
      }
      AppEvents.emit("focus:changed", false);
      onStopped();
      onClose();
      toast.info("Session Focus interrompue.");
    } catch {
      toast.error("Impossible d'arrêter la session.");
    }
  }, [elapsed, status.packages.length, onClose, onStopped]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[st.root, { backgroundColor: t.bg.page, paddingTop: insets.top }]}>
        <View style={st.topBar}>
          <View style={st.status}>
            <Dot color={t.intent.focus.accent} pulse size={7} />
            <Text variant="overline" tone="focus">
              Session en cours
            </Text>
          </View>
          <IconButton
            icon="arrow-collapse"
            variant="soft"
            onPress={onClose}
            accessibilityLabel="Réduire"
          />
        </View>

        <View style={st.center}>
          <ProgressRing
            progress={progress}
            size={244}
            thickness={8}
            color={t.intent.focus.accent}
            trackColor={t.bg.cardAlt}
          >
            <View style={st.ringContent}>
              <View style={st.clock}>
                {hours > 0 ? (
                  <>
                    <Text variant="display" tone="primary" tabular>
                      {hours}
                    </Text>
                    <Text variant="title2" tone="faint">
                      :
                    </Text>
                  </>
                ) : null}
                <Text variant="display" tone="primary" tabular>
                  {String(minutes).padStart(2, "0")}
                </Text>
                <Text variant="title2" tone="faint">
                  :
                </Text>
                <Text variant="display" tone="primary" tabular>
                  {String(seconds).padStart(2, "0")}
                </Text>
              </View>
              <Text variant="footnote" tone="muted">
                {Math.round(progress * 100)} % écoulé
              </Text>
            </View>
          </ProgressRing>

          <View style={st.meta}>
            <Text variant="title2" center numberOfLines={2}>
              {status.profileName}
            </Text>
            <Text variant="callout" tone="muted" center>
              {humanMinutes(status.durationMinutes)} ·{" "}
              {plural(status.packages.length, "app coupée", "apps coupées")}
            </Text>
          </View>
        </View>

        <View style={[st.bottom, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View
            style={[
              st.hint,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
          >
            <Icon name="shield-check-outline" size={16} color={t.intent.allowed.accent} />
            <Text variant="footnote" tone="muted" style={st.flex}>
              La session continue même si vous fermez NetOff.
            </Text>
          </View>

          <HoldToConfirm
            label="Interrompre la session"
            holdingLabel="Maintenez pour interrompre…"
            onConfirm={stop}
          />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.gutter },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  status: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.xxxl },
  ringContent: { alignItems: "center", gap: Spacing.xs },
  clock: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  meta: { gap: Spacing.xs, alignItems: "center" },
  bottom: { gap: Spacing.md },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
