/**
 * app/settings/parental.tsx — Contrôle parental
 *
 * Verrouille les actions sensibles derrière un code parent distinct du code
 * de l'app : le premier protège des modifications, le second protège
 * l'ouverture. Les deux peuvent coexister.
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { hourMinute } from "@/lib/format";
import { PIN_LENGTH, PinDots, PinPad } from "@/features/security/PinPad";
import ParentalControlService, {
  type ParentalSettings,
} from "@/services/parental-control.service";
import StorageService from "@/services/storage.service";
import type { Profile } from "@/types";
import { Radius, Spacing, useTheme } from "@/theme";
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
  Sheet,
  Switch,
  Text,
  Touchable,
  toast,
} from "@/ui";

/** Actions verrouillées lorsque le contrôle parental est actif. */
const PROTECTED = [
  "Couper la protection réseau",
  "Débloquer une application",
  "Modifier les règles d'un profil",
  "Ouvrir les réglages",
  "Désactiver le contrôle parental",
];

type PinFlow = { kind: "enable" | "disable"; step: "new" | "confirm"; first: string } | null;

export default function ParentalSettingsScreen() {
  const { t } = useTheme();

  const [settings, setSettings] = useState<ParentalSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [flow, setFlow] = useState<PinFlow>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [current, active, list] = await Promise.all([
      ParentalControlService.getSettings(),
      ParentalControlService.isParentalEnabled(),
      StorageService.getProfiles().catch(() => []),
    ]);
    setSettings(current);
    setEnabled(active);
    setProfiles(list);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (values: Partial<ParentalSettings>) => {
      if (!settings) return;
      const next = { ...settings, ...values };
      setSettings(next);
      await ParentalControlService.saveSettings(next);
    },
    [settings],
  );

  const closeFlow = useCallback(() => {
    setFlow(null);
    setPin("");
    setError(null);
  }, []);

  const advance = useCallback(
    async (candidate: string) => {
      if (!flow) return;
      setPin("");

      if (flow.kind === "disable") {
        try {
          await ParentalControlService.disableParental(candidate);
          await patch({ enabled: false });
          await load();
          closeFlow();
          toast.success("Contrôle parental désactivé.");
        } catch {
          setError("Code incorrect.");
        }
        return;
      }

      if (flow.step === "new") {
        setError(null);
        setFlow({ ...flow, step: "confirm", first: candidate });
        return;
      }

      if (candidate !== flow.first) {
        setError("Les deux codes ne correspondent pas.");
        setFlow({ ...flow, step: "new", first: "" });
        return;
      }

      await ParentalControlService.setParentalPin(candidate);
      await patch({ enabled: true });
      await load();
      closeFlow();
      toast.success("Contrôle parental activé.");
    },
    [flow, patch, load, closeFlow],
  );

  const toggle = useCallback(() => {
    if (enabled) setFlow({ kind: "disable", step: "new", first: "" });
    else setFlow({ kind: "enable", step: "new", first: "" });
  }, [enabled]);

  const shiftHour = useCallback(
    (key: "bedtimeHour" | "wakeHour", delta: number) => {
      if (!settings) return;
      const next = (settings[key] + delta + 24) % 24;
      patch({ [key]: next } as Partial<ParentalSettings>);
    },
    [settings, patch],
  );

  const flowTitle =
    flow?.kind === "disable"
      ? "Code parent requis"
      : flow?.step === "confirm"
        ? "Confirmer le code parent"
        : "Choisir un code parent";

  return (
    <Screen>
      <AppBar title="Contrôle parental" back />

      <ScreenScroll contentContainerStyle={st.content}>
        <Card
          style={[
            st.intro,
            enabled && {
              backgroundColor: t.intent.focus.bg,
              borderColor: t.intent.focus.border,
            },
          ]}
        >
          <View
            style={[
              st.introIcon,
              {
                backgroundColor: enabled ? t.bg.card : t.bg.cardAlt,
                borderColor: enabled ? t.intent.focus.border : t.border.light,
              },
            ]}
          >
            <Icon
              name="account-child-outline"
              size={22}
              color={enabled ? t.intent.focus.accent : t.text.muted}
            />
          </View>
          <View style={st.flex}>
            <Text variant="headline">
              {enabled ? "Contrôle parental actif" : "Contrôle parental"}
            </Text>
            <Text variant="footnote" tone="muted">
              Un code parent est exigé avant toute action qui affaiblirait le
              blocage.
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggle}
            tone="focus"
            accessibilityLabel="Contrôle parental"
          />
        </Card>

        <Section title="Actions protégées">
          <Card style={st.list}>
            {PROTECTED.map((action) => (
              <View key={action} style={st.listItem}>
                <Icon
                  name={enabled ? "lock" : "lock-open-variant-outline"}
                  size={15}
                  color={enabled ? t.intent.focus.accent : t.text.faint}
                />
                <Text variant="callout" tone={enabled ? "secondary" : "faint"}>
                  {action}
                </Text>
              </View>
            ))}
          </Card>
        </Section>

        {settings ? (
          <>
            <Section
              title="Heure du coucher"
              footnote="Sert de repère pour le bilan quotidien remis au parent."
            >
              <ListGroup>
                <ListRow
                  icon="weather-night"
                  title="Blocage nocturne"
                  subtitle="Signaler les usages tardifs"
                  trailing={
                    <Switch
                      value={settings.blockAtBedtime}
                      onValueChange={(value) => patch({ blockAtBedtime: value })}
                      tone="focus"
                      accessibilityLabel="Blocage nocturne"
                    />
                  }
                />
                {settings.blockAtBedtime ? (
                  <ListRow
                    icon="bed-outline"
                    title="Coucher"
                    trailing={
                      <HourStepper
                        hour={settings.bedtimeHour}
                        onChange={(delta) => shiftHour("bedtimeHour", delta)}
                      />
                    }
                  />
                ) : null}
                {settings.blockAtBedtime ? (
                  <ListRow
                    icon="weather-sunny"
                    title="Réveil"
                    trailing={
                      <HourStepper
                        hour={settings.wakeHour}
                        onChange={(delta) => shiftHour("wakeHour", delta)}
                      />
                    }
                  />
                ) : null}
              </ListGroup>
            </Section>

            {profiles.length > 0 ? (
              <Section
                title="Profil surveillé"
                footnote="Le profil dont les règles servent de référence."
              >
                <ListGroup>
                  {profiles.map((profile) => (
                    <ListRow
                      key={profile.id}
                      icon="account-multiple-outline"
                      title={profile.name}
                      subtitle={profile.description}
                      trailing={
                        settings.profileId === profile.id ? (
                          <Badge label="Suivi" tone="focus" />
                        ) : undefined
                      }
                      onPress={() =>
                        patch({
                          profileId: settings.profileId === profile.id ? null : profile.id,
                        })
                      }
                    />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
          </>
        ) : null}
      </ScreenScroll>

      <Sheet
        visible={flow !== null}
        onClose={closeFlow}
        title={flowTitle}
        subtitle={
          flow?.kind === "disable"
            ? "Saisissez le code parent pour retirer la protection."
            : `Choisissez un code à ${PIN_LENGTH} chiffres, différent du code de l'app.`
        }
        scrollable={false}
      >
        <View style={st.pad}>
          <PinDots filled={pin.length} error={error !== null} />
          {error ? (
            <Text variant="footnote" tone="danger" center>
              {error}
            </Text>
          ) : (
            <Text variant="footnote" tone="faint" center>
              {PIN_LENGTH} chiffres
            </Text>
          )}
          <PinPad
            value={pin}
            onChange={(next) => {
              setError(null);
              setPin(next);
            }}
            onComplete={advance}
          />
          <Button label="Annuler" variant="ghost" onPress={closeFlow} fullWidth />
        </View>
      </Sheet>
    </Screen>
  );
}

/** Réglage d'une heure entière, sans clavier. */
function HourStepper({
  hour,
  onChange,
}: {
  hour: number;
  onChange: (delta: number) => void;
}) {
  const { t } = useTheme();
  return (
    <View style={[st.stepper, { backgroundColor: t.bg.cardAlt, borderColor: t.border.light }]}>
      <Touchable
        onPress={() => onChange(-1)}
        feedback="strong"
        hitSlop={6}
        accessibilityLabel="Heure précédente"
        style={st.stepperButton}
      >
        <Icon name="minus" size={16} color={t.text.secondary} />
      </Touchable>
      <Text variant="bodyStrong" tabular>
        {hourMinute(hour, 0)}
      </Text>
      <Touchable
        onPress={() => onChange(1)}
        feedback="strong"
        hitSlop={6}
        accessibilityLabel="Heure suivante"
        style={st.stepperButton}
      >
        <Icon name="plus" size={16} color={t.text.secondary} />
      </Touchable>
    </View>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  intro: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { gap: Spacing.sm },
  listItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  stepperButton: { padding: 4 },
  pad: { alignItems: "stretch", gap: Spacing.lg },
  flex: { flex: 1 },
});
