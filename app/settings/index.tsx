/**
 * app/settings/index.tsx — Réglages
 *
 * Écran d'aiguillage. Chaque domaine a son propre écran : l'ancienne page
 * unique mêlait apparence, sécurité, sauvegarde et diagnostic, et devenait
 * impossible à parcourir.
 */

import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { plural } from "@/lib/format";
import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import { useVpn } from "@/features/vpn/useVpn";
import AllowlistService, { type AllowlistState } from "@/services/allowlist.service";
import AppEvents from "@/services/app-events";
import OemCompatService, { type DeviceInfo } from "@/services/oem-compat.service";
import ParentalControlService from "@/services/parental-control.service";
import StorageService from "@/services/storage.service";
import { useAppInfo } from "@/hooks/useAppInfo";
import { Radius, Spacing, THEME_MODES, useTheme } from "@/theme";
import {
  AppBar,
  Badge,
  Card,
  Icon,
  ListGroup,
  ListRow,
  Screen,
  ScreenScroll,
  Section,
  Switch,
  Text,
  Touchable,
  useScrollY,
} from "@/ui";

export default function SettingsScreen() {
  const { t, mode, setMode } = useTheme();
  const { scrollY, onScroll } = useScrollY();
  const appInfo = useAppInfo();
  const vpn = useVpn();
  const { isPremium, limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [allowlist, setAllowlist] = useState<AllowlistState>({
    enabled: false,
    packages: [],
  });
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [parentalEnabled, setParentalEnabled] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);

  const load = useCallback(async () => {
    const [state, info, parental, auth] = await Promise.all([
      AllowlistService.getState().catch(() => ({ enabled: false, packages: [] })),
      OemCompatService.getDeviceInfo().catch(() => null),
      ParentalControlService.isParentalEnabled().catch(() => false),
      StorageService.getAuthConfig().catch(() => ({
        isPinEnabled: false,
        isBiometricEnabled: false,
      })),
    ]);
    setAllowlist(state);
    setDevice(info);
    setParentalEnabled(parental);
    setLockEnabled(auth.isPinEnabled || auth.isBiometricEnabled);
  }, []);

  useEffect(() => {
    load();
    const unsub = AppEvents.on("allowlist:changed", () => load());
    return () => unsub();
  }, [load]);

  const toggleProtection = useCallback(async () => {
    if (!(await guard("toggle_vpn"))) return;
    await vpn.toggle();
  }, [guard, vpn]);

  const openSection = useCallback(
    async (path: Parameters<typeof router.push>[0]) => {
      if (!(await guard("open_settings"))) return;
      router.push(path);
    },
    [guard],
  );

  return (
    <Screen>
      <AppBar title="Réglages" back scrollY={scrollY} />

      <ScreenScroll onScroll={onScroll} contentContainerStyle={st.content}>
        {/* Abonnement */}
        {isPremium ? (
          <Card style={st.proCard}>
            <View
              style={[
                st.proIcon,
                { backgroundColor: t.intent.focus.bg, borderColor: t.intent.focus.border },
              ]}
            >
              <Icon name="shield-star" size={22} color={t.intent.focus.accent} />
            </View>
            <View style={st.flex}>
              <Text variant="headline">NetOff Pro</Text>
              <Text variant="footnote" tone="muted">
                Toutes les fonctionnalités sont débloquées. Merci !
              </Text>
            </View>
            <Badge label="Actif" tone="focus" />
          </Card>
        ) : (
          <Touchable onPress={() => paywall.open("general")} feedback="subtle">
            <Card
              style={[
                st.proCard,
                { backgroundColor: t.intent.focus.bg, borderColor: t.intent.focus.border },
              ]}
            >
              <View
                style={[
                  st.proIcon,
                  { backgroundColor: t.bg.card, borderColor: t.intent.focus.border },
                ]}
              >
                <Icon name="shield-star-outline" size={22} color={t.intent.focus.accent} />
              </View>
              <View style={st.flex}>
                <Text variant="headline">Passer à NetOff Pro</Text>
                <Text variant="footnote" tone="muted">
                  Apps et profils illimités, statistiques complètes, liste blanche.
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={t.intent.focus.accent} />
            </Card>
          </Touchable>
        )}

        {/* Protection */}
        <Section title="Protection">
          <ListGroup>
            <ListRow
              icon="shield-check-outline"
              tone={vpn.active ? "allowed" : "default"}
              title="Protection réseau"
              subtitle={
                vpn.active ? "Les règles sont appliquées" : "Aucune règle n'est appliquée"
              }
              trailing={
                <Switch
                  value={vpn.active}
                  onValueChange={toggleProtection}
                  tone="allowed"
                  disabled={vpn.busy}
                  accessibilityLabel="Protection réseau"
                />
              }
            />
            <ListRow
              icon="playlist-check"
              tone={allowlist.enabled ? "brand" : "default"}
              title="Mode liste blanche"
              subtitle={
                allowlist.enabled
                  ? plural(allowlist.packages.length, "app autorisée", "apps autorisées")
                  : "Tout bloquer sauf quelques apps"
              }
              locked={!isPremium}
              trailing="chevron"
              onPress={() => {
                if (!paywall.enforce(limits.canUseAllowlist())) return;
                router.push("/allowlist");
              }}
            />
            <ListRow
              icon="battery-heart-variant"
              tone={device?.isBatteryOptimized ? "warning" : "default"}
              title="Compatibilité appareil"
              subtitle={
                device
                  ? device.isBatteryOptimized
                    ? "Le système peut interrompre le blocage"
                    : `${device.manufacturer} — aucune restriction détectée`
                  : "Vérifier les restrictions d'arrière-plan"
              }
              trailing="chevron"
              onPress={() => router.push("/settings/device")}
            />
          </ListGroup>
        </Section>

        {/* Apparence */}
        <Section title="Apparence" footnote="« Système » suit le réglage d'Android.">
          <Card>
            <View style={st.themeGrid}>
              {THEME_MODES.map((option) => {
                const active = mode === option.key;
                return (
                  <Touchable
                    key={option.key}
                    onPress={() => setMode(option.key)}
                    feedback="strong"
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[
                      st.themeOption,
                      {
                        backgroundColor: active ? t.brand.soft : t.bg.cardAlt,
                        borderColor: active ? t.brand.base : t.border.light,
                      },
                    ]}
                  >
                    <Icon
                      name={option.icon as never}
                      size={20}
                      color={active ? t.brand.base : t.text.muted}
                    />
                    <Text
                      variant="caption"
                      color={active ? t.brand.base : t.text.secondary}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </Touchable>
                );
              })}
            </View>
          </Card>
        </Section>

        {/* Sécurité */}
        <Section title="Sécurité">
          <ListGroup>
            <ListRow
              icon="lock-outline"
              tone={lockEnabled ? "brand" : "default"}
              title="Verrouillage de l'app"
              subtitle={
                lockEnabled ? "Code PIN ou biométrie actif" : "Aucun verrouillage configuré"
              }
              trailing="chevron"
              onPress={() => openSection("/settings/security")}
            />
            <ListRow
              icon="account-child-outline"
              tone={parentalEnabled ? "focus" : "default"}
              title="Contrôle parental"
              subtitle={
                parentalEnabled
                  ? "Les modifications demandent le code parent"
                  : "Protéger les réglages par un code parent"
              }
              trailing="chevron"
              onPress={() => openSection("/settings/parental")}
            />
          </ListGroup>
        </Section>

        {/* Données */}
        <Section title="Données">
          <ListGroup>
            <ListRow
              icon="swap-vertical"
              title="Sauvegarde et restauration"
              subtitle="Exporter ou importer règles et profils"
              locked={!isPremium}
              trailing="chevron"
              onPress={() => openSection("/settings/data")}
            />
          </ListGroup>
        </Section>

        {/* À propos */}
        <Section title="À propos">
          <ListGroup>
            <ListRow
              icon="information-outline"
              title="À propos de NetOff"
              subtitle={appInfo.loading ? "…" : `Version ${appInfo.fullVersion}`}
              trailing="chevron"
              onPress={() => router.push("/settings/about")}
            />
            <ListRow
              icon="message-outline"
              title="Nous écrire"
              subtitle="Signaler un problème ou proposer une idée"
              trailing="chevron"
              onPress={() => router.push("/settings/contact")}
            />
          </ListGroup>
        </Section>

        <Text variant="footnote" tone="faint" center style={st.version}>
          NetOff {appInfo.fullVersion} · {appInfo.osName} {appInfo.osVersion}
        </Text>
      </ScreenScroll>

      <Paywall visible={paywall.visible} reason={paywall.reason} onClose={paywall.close} />

      <ParentalGate />
    </Screen>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  proCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  proIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeGrid: { flexDirection: "row", gap: Spacing.sm },
  themeOption: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  version: { paddingTop: Spacing.sm },
  flex: { flex: 1 },
});
