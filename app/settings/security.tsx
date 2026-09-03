/**
 * app/settings/security.tsx — Verrouillage de l'application
 *
 * Deux verrous complémentaires : un code PIN (toujours disponible) et la
 * biométrie (Pro). La biométrie ne remplace pas le code — elle s'appuie
 * dessus, car un capteur peut échouer ou ne plus être enrôlé.
 */

import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { PIN_LENGTH, PinDots, PinPad } from "@/features/security/PinPad";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import StorageService from "@/services/storage.service";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppBar,
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
  toast,
} from "@/ui";

/** Étapes du panneau de saisie, selon l'opération en cours. */
type PinFlow =
  | { kind: "create"; step: "new" | "confirm"; first: string }
  | { kind: "change"; step: "current" | "new" | "confirm"; first: string }
  | { kind: "disable"; step: "current"; first: string }
  | null;

const FLOW_COPY: Record<string, { title: string; subtitle: string }> = {
  "create:new": {
    title: "Choisir un code",
    subtitle: `Saisissez un code à ${PIN_LENGTH} chiffres.`,
  },
  "create:confirm": {
    title: "Confirmer le code",
    subtitle: "Saisissez à nouveau le même code.",
  },
  "change:current": {
    title: "Code actuel",
    subtitle: "Saisissez votre code actuel pour continuer.",
  },
  "change:new": { title: "Nouveau code", subtitle: `Choisissez un nouveau code.` },
  "change:confirm": {
    title: "Confirmer le code",
    subtitle: "Saisissez à nouveau le nouveau code.",
  },
  "disable:current": {
    title: "Confirmer la désactivation",
    subtitle: "Saisissez votre code pour retirer le verrouillage.",
  },
};

export default function SecuritySettingsScreen() {
  const { t } = useTheme();
  const { limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [pinEnabled, setPinEnabled] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biométrie");

  const [flow, setFlow] = useState<PinFlow>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [config, hasHardware, enrolled, types] = await Promise.all([
      StorageService.getAuthConfig().catch(() => ({
        isPinEnabled: false,
        isBiometricEnabled: false,
      })),
      LocalAuthentication.hasHardwareAsync().catch(() => false),
      LocalAuthentication.isEnrolledAsync().catch(() => false),
      LocalAuthentication.supportedAuthenticationTypesAsync().catch(
        () => [] as LocalAuthentication.AuthenticationType[],
      ),
    ]);

    setPinEnabled(config.isPinEnabled);
    setBioEnabled(config.isBiometricEnabled);
    setBioAvailable(hasHardware && enrolled);
    setBioLabel(
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        ? "Reconnaissance faciale"
        : "Empreinte digitale",
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeFlow = useCallback(() => {
    setFlow(null);
    setPin("");
    setError(null);
  }, []);

  /** Enchaîne les étapes du panneau selon l'opération demandée. */
  const advance = useCallback(
    async (candidate: string) => {
      if (!flow) return;
      setPin("");

      if (flow.step === "current") {
        if (!(await StorageService.verifyPin(candidate))) {
          setError("Code incorrect.");
          return;
        }
        if (flow.kind === "disable") {
          await StorageService.disablePin();
          await load();
          closeFlow();
          toast.success("Verrouillage désactivé.");
          return;
        }
        setError(null);
        setFlow({ kind: "change", step: "new", first: "" });
        return;
      }

      if (flow.step === "new") {
        setError(null);
        setFlow({ ...flow, step: "confirm", first: candidate });
        return;
      }

      // Étape de confirmation.
      if (candidate !== flow.first) {
        setError("Les deux codes ne correspondent pas.");
        setFlow({ ...flow, step: "new", first: "" });
        return;
      }
      await StorageService.savePin(candidate);
      await load();
      closeFlow();
      toast.success(flow.kind === "create" ? "Code activé." : "Code modifié.");
    },
    [flow, load, closeFlow],
  );

  const togglePin = useCallback(async () => {
    if (!(await guard("open_settings"))) return;
    if (pinEnabled) setFlow({ kind: "disable", step: "current", first: "" });
    else setFlow({ kind: "create", step: "new", first: "" });
  }, [guard, pinEnabled]);

  const toggleBiometrics = useCallback(async () => {
    if (bioEnabled) {
      await StorageService.updateAuthConfig({ isBiometricEnabled: false });
      await load();
      return;
    }
    if (!paywall.enforce(limits.canUseBiometrics())) return;
    if (!pinEnabled) {
      toast.info("Configurez d'abord un code PIN — il sert de solution de repli.");
      return;
    }

    // On exige une authentification réussie avant d'activer : inutile de
    // proposer un verrou qui ne fonctionne pas sur cet appareil.
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirmer l'activation",
    }).catch(() => ({ success: false }) as LocalAuthentication.LocalAuthenticationResult);

    if (!result.success) {
      toast.error("Authentification annulée.");
      return;
    }
    await StorageService.updateAuthConfig({ isBiometricEnabled: true });
    await load();
    toast.success(`${bioLabel} activée.`);
  }, [bioEnabled, paywall, limits, pinEnabled, bioLabel, load]);

  const flowKey = flow ? `${flow.kind}:${flow.step}` : null;
  const copy = flowKey ? FLOW_COPY[flowKey] : null;

  return (
    <Screen>
      <AppBar title="Sécurité" back />

      <ScreenScroll contentContainerStyle={st.content}>
        <Card style={st.intro}>
          <View
            style={[
              st.introIcon,
              { backgroundColor: t.brand.soft, borderColor: t.brand.softBorder },
            ]}
          >
            <Icon name="shield-key-outline" size={22} color={t.brand.base} />
          </View>
          <View style={st.flex}>
            <Text variant="headline">Protéger l'accès à NetOff</Text>
            <Text variant="footnote" tone="muted">
              Empêche de modifier vos règles ou de couper la protection sans
              votre accord.
            </Text>
          </View>
        </Card>

        <Section title="Verrous">
          <ListGroup>
            <ListRow
              icon="dialpad"
              tone={pinEnabled ? "brand" : "default"}
              title="Code PIN"
              subtitle={
                pinEnabled
                  ? `Code à ${PIN_LENGTH} chiffres demandé au lancement`
                  : "Aucun code configuré"
              }
              trailing={
                <Switch
                  value={pinEnabled}
                  onValueChange={togglePin}
                  accessibilityLabel="Code PIN"
                />
              }
            />
            {pinEnabled ? (
              <ListRow
                icon="pencil-outline"
                title="Modifier le code"
                trailing="chevron"
                onPress={() => setFlow({ kind: "change", step: "current", first: "" })}
              />
            ) : null}
            <ListRow
              icon="fingerprint"
              tone={bioEnabled ? "brand" : "default"}
              title={bioLabel}
              subtitle={
                !bioAvailable
                  ? "Non disponible ou non enrôlée sur cet appareil"
                  : bioEnabled
                    ? "Proposée automatiquement au lancement"
                    : "Déverrouiller sans saisir le code"
              }
              locked={!limits.canUseBiometrics().allowed}
              disabled={!bioAvailable}
              trailing={
                <Switch
                  value={bioEnabled}
                  onValueChange={toggleBiometrics}
                  disabled={!bioAvailable}
                  accessibilityLabel={bioLabel}
                />
              }
            />
          </ListGroup>
        </Section>

        {!pinEnabled ? (
          <View
            style={[
              st.notice,
              { backgroundColor: t.intent.warning.bg, borderColor: t.intent.warning.border },
            ]}
          >
            <Icon name="alert-outline" size={18} color={t.intent.warning.accent} />
            <Text variant="footnote" tone="warning" style={st.flex}>
              Sans verrouillage, n'importe qui peut désactiver la protection
              depuis cet appareil.
            </Text>
          </View>
        ) : null}
      </ScreenScroll>

      <Sheet
        visible={flow !== null}
        onClose={closeFlow}
        title={copy?.title ?? ""}
        subtitle={copy?.subtitle}
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

      <Paywall visible={paywall.visible} reason={paywall.reason} onClose={paywall.close} />

      <ParentalGate />
    </Screen>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  intro: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  pad: { alignItems: "stretch", gap: Spacing.lg },
  flex: { flex: 1 },
});
