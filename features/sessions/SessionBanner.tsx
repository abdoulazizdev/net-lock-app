/**
 * features/sessions/SessionBanner.tsx — Bandeau de session en cours
 *
 * Rappelle en permanence qu'une session tourne et combien de temps il reste.
 * Le Focus ouvre l'écran plein — la minuterie s'annule directement, sans
 * confirmation, puisqu'elle n'engage à rien.
 */

import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { countdown, plural } from "@/lib/format";
import AppEvents from "@/services/app-events";
import TimerService from "@/services/timer.service";
import { Radius, Spacing, useTheme } from "@/theme";
import { Dot, Icon, Text, Touchable, toast } from "@/ui";
import type { SessionsState } from "./useSessions";

export type SessionBannerProps = {
  sessions: SessionsState;
  /** Ouvre l'écran plein Focus. */
  onExpandFocus: () => void;
};

export function SessionBanner({ sessions, onExpandFocus }: SessionBannerProps) {
  const { t } = useTheme();
  const [stopping, setStopping] = useState(false);

  const stopTimer = useCallback(async () => {
    setStopping(true);
    try {
      await TimerService.stop();
      AppEvents.emit("timer:changed", false);
      await sessions.refresh();
      toast.info("Minuterie annulée.");
    } finally {
      setStopping(false);
    }
  }, [sessions]);

  if (sessions.focusActive && sessions.focus) {
    const blocked = sessions.focus.packages.length;
    return (
      <Touchable
        onPress={onExpandFocus}
        feedback="subtle"
        style={[
          st.banner,
          { backgroundColor: t.intent.focus.bg, borderColor: t.intent.focus.border },
        ]}
      >
        <Dot color={t.intent.focus.accent} pulse size={8} />
        <View style={st.text}>
          <Text variant="headline" tone="focus" numberOfLines={1}>
            Focus · {sessions.focus.profileName}
          </Text>
          <Text variant="footnote" tone="muted" numberOfLines={1}>
            {plural(blocked, "app coupée", "apps coupées")}
          </Text>
        </View>
        <Text variant="title3" tone="focus" tabular>
          {countdown(sessions.remainingMs)}
        </Text>
        <Icon name="arrow-expand" size={16} color={t.intent.focus.accent} />
      </Touchable>
    );
  }

  if (sessions.timerActive && sessions.timer) {
    return (
      <View
        style={[
          st.banner,
          { backgroundColor: t.brand.soft, borderColor: t.brand.softBorder },
        ]}
      >
        <Dot color={t.brand.base} pulse size={8} />
        <View style={st.text}>
          <Text variant="headline" tone="brand" numberOfLines={1}>
            Minuterie en cours
          </Text>
          <Text variant="footnote" tone="muted" numberOfLines={1}>
            Rétablissement automatique à la fin
          </Text>
        </View>
        <Text variant="title3" tone="brand" tabular>
          {countdown(sessions.remainingMs)}
        </Text>
        <Touchable
          onPress={stopTimer}
          disabled={stopping}
          feedback="strong"
          haptic="warning"
          style={[st.stop, { borderColor: t.intent.danger.border }]}
          accessibilityLabel="Annuler la minuterie"
        >
          <Text variant="caption" tone="danger">
            Annuler
          </Text>
        </Touchable>
      </View>
    );
  }

  return null;
}

const st = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 1 },
  stop: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
});
