/**
 * app/settings/device.tsx — Compatibilité appareil
 *
 * Le point noir de toute app de blocage sur Android : les surcouches
 * constructeur tuent les services d'arrière-plan. Cet écran identifie le
 * fabricant, indique la sévérité connue de ses restrictions, et ouvre
 * directement les bons écrans système.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import OemCompatService, {
  OEM_GUIDANCE,
  type DeviceInfo,
  type OemType,
} from "@/services/oem-compat.service";
import { Radius, Spacing, useTheme, type ThemeTokens } from "@/theme";
import {
  AppBar,
  Badge,
  Button,
  Card,
  Icon,
  ListGroup,
  ListRow,
  Screen,
  ScreenScroll,
  Section,
  Skeleton,
  Text,
  Touchable,
} from "@/ui";

/** Étapes cochées par l'utilisateur — purement indicatif, stocké localement. */
const DONE_KEY = "@netoff_oem_steps_done";

type Severity = "high" | "medium" | "low";

function severityLook(t: ThemeTokens, severity: Severity) {
  switch (severity) {
    case "high":
      return { ...t.intent.danger, label: "Restrictions fortes" };
    case "medium":
      return { ...t.intent.warning, label: "Restrictions modérées" };
    default:
      return { ...t.intent.allowed, label: "Peu de restrictions" };
  }
}

export default function DeviceSettingsScreen() {
  const { t } = useTheme();
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    OemCompatService.invalidateCache();
    const [device, raw] = await Promise.all([
      OemCompatService.getDeviceInfo(),
      AsyncStorage.getItem(DONE_KEY).catch(() => null),
    ]);
    setInfo(device);
    setDone(raw ? JSON.parse(raw) : {});
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDone = useCallback(
    (key: string) => {
      const next = { ...done, [key]: !done[key] };
      setDone(next);
      AsyncStorage.setItem(DONE_KEY, JSON.stringify(next)).catch(() => {});
    },
    [done],
  );

  const oem = (info?.oem ?? "generic") as OemType;
  const guidance = OEM_GUIDANCE[oem] ?? OEM_GUIDANCE.generic;
  const look = severityLook(t, guidance.severity);
  const optimized = info?.isBatteryOptimized ?? false;

  return (
    <Screen>
      <AppBar title="Compatibilité" back />

      <ScreenScroll contentContainerStyle={st.content}>
        {loading ? (
          <View style={st.loading}>
            <Skeleton height={140} radius={Radius.lg} />
            <Skeleton height={200} radius={Radius.lg} />
          </View>
        ) : (
          <>
            {/* Appareil détecté */}
            <Card style={st.device}>
              <View style={st.deviceHead}>
                <View
                  style={[
                    st.deviceIcon,
                    { backgroundColor: look.bg, borderColor: look.border },
                  ]}
                >
                  <Icon name="cellphone-cog" size={22} color={look.accent} />
                </View>
                <View style={st.flex}>
                  <Text variant="headline" numberOfLines={1}>
                    {guidance.name}
                  </Text>
                  <Text variant="footnote" tone="muted" numberOfLines={1}>
                    {info
                      ? `${info.model} · Android ${info.androidVersion}`
                      : "Appareil non identifié"}
                  </Text>
                </View>
                <Badge label={look.label} tone={guidance.severity === "high" ? "danger" : guidance.severity === "medium" ? "warning" : "allowed"} />
              </View>

              <Text variant="callout" tone="secondary">
                {guidance.severity === "low"
                  ? "Cet appareil laisse tourner les services d'arrière-plan sans réglage particulier."
                  : "Sans les autorisations ci-dessous, le système peut interrompre la protection quand NetOff n'est pas au premier plan."}
              </Text>
            </Card>

            {/* État actuel */}
            <Section title="État">
              <ListGroup>
                <ListRow
                  icon={optimized ? "battery-alert-variant-outline" : "battery-check-outline"}
                  tone={optimized ? "warning" : "allowed"}
                  title="Optimisation de la batterie"
                  subtitle={
                    optimized
                      ? "NetOff est soumis à l'optimisation — à désactiver"
                      : "NetOff est exempté, c'est le réglage attendu"
                  }
                  trailing={
                    optimized ? (
                      <Button
                        label="Corriger"
                        size="sm"
                        onPress={() => OemCompatService.requestIgnoreBatteryOptimization()}
                      />
                    ) : (
                      <Icon name="check-circle" size={20} color={t.intent.allowed.accent} />
                    )
                  }
                />
                <ListRow
                  icon="restart"
                  tone={info?.hasAutoStartSetting ? "warning" : "default"}
                  title="Démarrage automatique"
                  subtitle={
                    info?.hasAutoStartSetting
                      ? "Cet appareil dispose d'un écran dédié — à activer"
                      : "Non requis sur cet appareil"
                  }
                  trailing={
                    info?.hasAutoStartSetting ? (
                      <Button
                        label="Ouvrir"
                        size="sm"
                        variant="secondary"
                        onPress={() => OemCompatService.openAutoStartSettings()}
                      />
                    ) : undefined
                  }
                />
                <ListRow
                  icon="bell-outline"
                  title="Notifications"
                  subtitle="La notification permanente maintient le service actif"
                  trailing="chevron"
                  onPress={() => OemCompatService.openNotificationSettings()}
                />
              </ListGroup>
            </Section>

            {/* Marche à suivre */}
            <Section
              title={guidance.batteryLabel}
              footnote="Cochez les étapes réalisées — c'est un simple pense-bête."
            >
              <Card style={st.steps}>
                {guidance.batterySteps.map((step, index) => (
                  <StepRow
                    key={`battery-${index}`}
                    index={index + 1}
                    label={step}
                    done={!!done[`battery-${oem}-${index}`]}
                    onToggle={() => markDone(`battery-${oem}-${index}`)}
                  />
                ))}
                <Button
                  label="Ouvrir les réglages batterie"
                  icon="open-in-new"
                  variant="secondary"
                  onPress={() => OemCompatService.openBatterySettings()}
                  fullWidth
                />
              </Card>
            </Section>

            {info?.hasAutoStartSetting ? (
              <Section title={guidance.autoStartLabel}>
                <Card style={st.steps}>
                  {guidance.autoStartSteps.map((step, index) => (
                    <StepRow
                      key={`autostart-${index}`}
                      index={index + 1}
                      label={step}
                      done={!!done[`autostart-${oem}-${index}`]}
                      onToggle={() => markDone(`autostart-${oem}-${index}`)}
                    />
                  ))}
                  <Button
                    label="Ouvrir le démarrage automatique"
                    icon="open-in-new"
                    variant="secondary"
                    onPress={() => OemCompatService.openAutoStartSettings()}
                    fullWidth
                  />
                </Card>
              </Section>
            ) : null}

            {guidance.severity === "high" ? (
              <View
                style={[
                  st.tip,
                  { backgroundColor: t.intent.info.bg, borderColor: t.intent.info.border },
                ]}
              >
                <Icon name="lightbulb-on-outline" size={18} color={t.intent.info.accent} />
                <Text variant="footnote" tone="secondary" style={st.flex}>
                  Sur ce type d'appareil, le mode liste blanche est plus robuste :
                  tout le trafic entre dans le tunnel, il n'existe plus de chemin
                  de contournement.
                </Text>
              </View>
            ) : null}

            <Button
              label="Revérifier l'appareil"
              icon="refresh"
              variant="ghost"
              onPress={load}
              fullWidth
            />
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}

function StepRow({
  index,
  label,
  done,
  onToggle,
}: {
  index: number;
  label: string;
  done: boolean;
  onToggle: () => void;
}) {
  const { t } = useTheme();
  return (
    <Touchable onPress={onToggle} feedback="none" style={st.step}>
      <View
        style={[
          st.stepBullet,
          {
            backgroundColor: done ? t.intent.allowed.accent : t.bg.cardAlt,
            borderColor: done ? t.intent.allowed.accent : t.border.normal,
          },
        ]}
      >
        {done ? (
          <Icon name="check" size={13} color={t.intent.allowed.onAccent} />
        ) : (
          <Text variant="caption" tone="muted" tabular>
            {index}
          </Text>
        )}
      </View>
      <Text
        variant="callout"
        tone={done ? "faint" : "secondary"}
        style={[st.flex, done && st.stepDone]}
      >
        {label}
      </Text>
    </Touchable>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  loading: { gap: Spacing.md },
  device: { gap: Spacing.md },
  deviceHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { gap: Spacing.md },
  step: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  stepBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { textDecorationLine: "line-through" },
  tip: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
