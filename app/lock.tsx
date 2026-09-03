/**
 * app/lock.tsx — Verrouillage de l'application
 *
 * Écran affiché au lancement quand un code ou la biométrie est configuré.
 * Il ne sert qu'à *déverrouiller* : la création et la modification du code se
 * font dans Réglages › Sécurité.
 *
 * La biométrie est proposée d'emblée quand elle est activée — c'est le geste
 * attendu — avec le pavé numérique en repli.
 */

import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PIN_LENGTH, PinDots, PinPad } from "@/features/security/PinPad";
import StorageService from "@/services/storage.service";
import { Spacing, useTheme } from "@/theme";
import { Button, Screen, Text, toast } from "@/ui";

/** Au-delà, on impose une pause : cela décourage les essais à la chaîne. */
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

type BiometricKind = "fingerprint" | "face-recognition";

export default function LockScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometric, setBiometric] = useState<BiometricKind | null>(null);
  const [ready, setReady] = useState(false);

  const unlock = useCallback(() => {
    router.replace("/(tabs)");
  }, []);

  const promptBiometric = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Déverrouiller NetOff",
        cancelLabel: "Utiliser le code",
        disableDeviceFallback: false,
      });
      if (result.success) unlock();
    } catch {
      toast.error("La reconnaissance biométrique a échoué.");
    }
  }, [unlock]);

  // Configuration disponible : code, biométrie, ou les deux.
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      if (cancelled) return;

      const biometricUsable = config.isBiometricEnabled && hasHardware && enrolled;
      const kind: BiometricKind = types.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )
        ? "face-recognition"
        : "fingerprint";

      setPinEnabled(config.isPinEnabled);
      setBiometric(biometricUsable ? kind : null);
      setReady(true);

      // Aucun verrou configuré : ne pas retenir l'utilisateur.
      if (!config.isPinEnabled && !biometricUsable) {
        unlock();
        return;
      }
      if (biometricUsable) promptBiometric();
    })();

    return () => {
      cancelled = true;
    };
  }, [promptBiometric, unlock]);

  // Décompte de la pause après trop d'essais.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          setAttempts(0);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const submit = useCallback(
    async (candidate: string) => {
      if (await StorageService.verifyPin(candidate)) {
        unlock();
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setError(true);
      setPin("");
      if (next >= MAX_ATTEMPTS) setCooldown(COOLDOWN_SECONDS);
    },
    [attempts, unlock],
  );

  if (!ready) return <Screen />;

  const locked = cooldown > 0;
  const remaining = MAX_ATTEMPTS - attempts;

  return (
    <Screen>
      <View style={[st.root, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        <Animated.View entering={FadeIn.duration(320)} style={st.brand}>
          <View
            style={[
              st.logo,
              { backgroundColor: t.brand.soft, borderColor: t.brand.softBorder },
            ]}
          >
            <Image
              source={require("@/assets/images/netoff-logo.png")}
              style={st.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text variant="title1" center>
            NetOff
          </Text>
          <Text variant="callout" tone="muted" center>
            {locked
              ? `Trop d'essais — réessayez dans ${cooldown} s`
              : "Saisissez votre code pour continuer"}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(360)} style={st.pad}>
          <PinDots filled={pin.length} error={error} />

          {error && !locked ? (
            <Text variant="footnote" tone="danger" center>
              {remaining > 1
                ? `Code incorrect — ${remaining} essais restants`
                : "Dernier essai avant blocage temporaire"}
            </Text>
          ) : (
            <Text variant="footnote" tone="faint" center>
              Code à {PIN_LENGTH} chiffres
            </Text>
          )}

          {pinEnabled ? (
            <PinPad
              value={pin}
              onChange={(next) => {
                setError(false);
                setPin(next);
              }}
              onComplete={submit}
              disabled={locked}
              onBiometric={biometric ? promptBiometric : undefined}
              biometricIcon={biometric ?? "fingerprint"}
            />
          ) : biometric ? (
            <Button
              label="Déverrouiller"
              icon={biometric}
              size="lg"
              onPress={promptBiometric}
              fullWidth
            />
          ) : null}
        </Animated.View>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.huge,
  },
  brand: { alignItems: "center", gap: Spacing.sm },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  logoImage: { width: 42, height: 42 },
  pad: { gap: Spacing.lg, alignItems: "stretch" },
});
