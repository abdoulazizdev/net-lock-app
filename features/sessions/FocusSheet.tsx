/**
 * features/sessions/FocusSheet.tsx — Démarrer une session Focus
 *
 * Le démarrage enchaîne deux étapes qui peuvent chacune échouer : activer la
 * protection réseau si elle est coupée, puis lancer le service Focus. L'état
 * de progression est affiché, car la boîte de dialogue VPN d'Android peut
 * s'intercaler et l'attente serait sinon inexplicable.
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { humanMinutes, plural } from "@/lib/format";
import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import type { Profile } from "@/types";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  Badge,
  Button,
  Icon,
  Section,
  Sheet,
  Text,
  Touchable,
  toast,
} from "@/ui";
import { usePremium } from "../premium/usePremium";

/** Délai maximal d'attente de l'activation du VPN avant d'abandonner. */
const VPN_WAIT_ATTEMPTS = 8;
const VPN_WAIT_INTERVAL_MS = 500;

type Phase = "idle" | "vpn" | "focus";

export type FocusSheetProps = {
  visible: boolean;
  onClose: () => void;
  onStarted: () => void;
  /** Ouvre le paywall pour une durée réservée à Pro. */
  onLocked: () => void;
};

export function FocusSheet({ visible, onClose, onStarted, onLocked }: FocusSheetProps) {
  const { t } = useTheme();
  const { limits } = usePremium();

  const presets = FocusService.presets;
  const [minutes, setMinutes] = useState(presets[0]?.value ?? 25);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhase("idle");
    setError(null);
    StorageService.getProfiles().then(setProfiles).catch(() => {});
    StorageService.getRules()
      .then((rules) => setBlockedCount(rules.filter((r) => r.isBlocked).length))
      .catch(() => {});
  }, [visible]);

  const selectPreset = useCallback(
    (value: number) => {
      const check = limits.canUseFocusPreset(value);
      if (!check.allowed) {
        onLocked();
        return;
      }
      setMinutes(value);
    },
    [limits, onLocked],
  );

  const start = useCallback(async () => {
    if (!limits.canUseFocusPreset(minutes).allowed) {
      onLocked();
      return;
    }

    setError(null);
    try {
      if (!(await VpnService.isVpnActive())) {
        setPhase("vpn");
        if (!(await VpnService.startVpn())) {
          setPhase("idle");
          setError("La protection réseau n'a pas pu démarrer.");
          return;
        }
        // La permission VPN passe par une boîte de dialogue système : on
        // attend que le service soit réellement actif avant de continuer.
        let ready = false;
        for (let i = 0; i < VPN_WAIT_ATTEMPTS && !ready; i++) {
          await new Promise((r) => setTimeout(r, VPN_WAIT_INTERVAL_MS));
          ready = await VpnService.isVpnActive();
        }
        if (!ready) {
          setPhase("idle");
          setError("Permission VPN refusée — la session n'a pas démarré.");
          return;
        }
      }

      setPhase("focus");
      await FocusService.startFocus(minutes, profileId ?? undefined);
      onStarted();
      onClose();
      toast.success("Session Focus démarrée.");
    } catch (e) {
      setPhase("idle");
      setError(
        (e as { code?: string })?.code === "PERMISSION_DENIED"
          ? "Permission VPN refusée."
          : "La session Focus n'a pas pu démarrer.",
      );
    }
  }, [limits, minutes, profileId, onClose, onLocked, onStarted]);

  const selectedProfile = profiles.find((p) => p.id === profileId);
  const targetCount = selectedProfile
    ? (selectedProfile.rules ?? []).filter((r) => r.isBlocked).length
    : blockedCount;

  const busy = phase !== "idle";

  return (
    <Sheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      dismissible={!busy}
      title="Session Focus"
      subtitle="Les apps sélectionnées perdent l'accès à internet pour toute la durée. La session résiste à la fermeture de NetOff."
      error={error}
      footer={
        <>
          <Button
            label={
              phase === "vpn"
                ? "Activation de la protection…"
                : phase === "focus"
                  ? "Démarrage…"
                  : `Démarrer — ${humanMinutes(minutes)}`
            }
            icon="target"
            onPress={start}
            loading={busy}
            disabled={busy || targetCount === 0}
            size="lg"
            fullWidth
          />
          {targetCount === 0 ? (
            <Text variant="footnote" tone="warning" center>
              Aucune app à bloquer — bloquez d'abord au moins une application.
            </Text>
          ) : null}
        </>
      }
    >
      <Section title="Durée">
        <View style={st.grid}>
          {presets.map((preset) => {
            const locked = !limits.canUseFocusPreset(preset.value).allowed;
            const active = minutes === preset.value && !locked;
            return (
              <Touchable
                key={preset.value}
                onPress={() => selectPreset(preset.value)}
                feedback="strong"
                style={[
                  st.preset,
                  {
                    backgroundColor: active ? t.intent.focus.bg : t.bg.card,
                    borderColor: active ? t.intent.focus.accent : t.border.light,
                    borderWidth: active ? 2 : 1,
                  },
                ]}
              >
                <Text variant="title3" tone={active ? "focus" : "primary"} tabular>
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

      <Section
        title="Apps à bloquer"
        footnote={
          selectedProfile
            ? `Les règles du profil « ${selectedProfile.name} » seront appliquées.`
            : "Les règles actuellement enregistrées seront appliquées."
        }
      >
        <Touchable
          onPress={() => setProfileId(null)}
          feedback="none"
          style={[
            st.option,
            {
              backgroundColor: t.bg.card,
              borderColor: profileId === null ? t.brand.base : t.border.light,
            },
          ]}
        >
          <Icon
            name={profileId === null ? "radiobox-marked" : "radiobox-blank"}
            size={20}
            color={profileId === null ? t.brand.base : t.text.faint}
          />
          <View style={st.optionText}>
            <Text variant="headline">Règles actuelles</Text>
            <Text variant="footnote" tone="muted">
              {plural(blockedCount, "app bloquée", "apps bloquées")}
            </Text>
          </View>
        </Touchable>

        {profiles.map((profile) => {
          const active = profileId === profile.id;
          const count = (profile.rules ?? []).filter((r) => r.isBlocked).length;
          return (
            <Touchable
              key={profile.id}
              onPress={() => setProfileId(profile.id)}
              feedback="none"
              style={[
                st.option,
                {
                  backgroundColor: t.bg.card,
                  borderColor: active ? t.brand.base : t.border.light,
                },
              ]}
            >
              <Icon
                name={active ? "radiobox-marked" : "radiobox-blank"}
                size={20}
                color={active ? t.brand.base : t.text.faint}
              />
              <View style={st.optionText}>
                <Text variant="headline" numberOfLines={1}>
                  {profile.name}
                </Text>
                <Text variant="footnote" tone="muted">
                  {plural(count, "app", "apps")}
                </Text>
              </View>
              {profile.isActive ? <Badge label="Actif" tone="allowed" /> : null}
            </Touchable>
          );
        })}
      </Section>
    </Sheet>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  preset: {
    flexGrow: 1,
    flexBasis: "30%",
    gap: 2,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  presetLock: { position: "absolute", top: 6, right: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  optionText: { flex: 1, gap: 1 },
});
