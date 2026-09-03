/**
 * app/(tabs)/index.tsx — Accueil
 *
 * Tableau de bord : l'état de la protection, les sessions en cours, les
 * raccourcis vers les actions fréquentes et un résumé chiffré. Aucune liste
 * d'applications ici — c'est le rôle de l'onglet Apps.
 */

import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { humanMinutes, plural } from "@/lib/format";
import { FocusOverlay } from "@/features/sessions/FocusOverlay";
import { FocusSheet } from "@/features/sessions/FocusSheet";
import { SessionBanner } from "@/features/sessions/SessionBanner";
import { TimerSheet } from "@/features/sessions/TimerSheet";
import { useSessions } from "@/features/sessions/useSessions";
import { ProtectionCard } from "@/features/home/ProtectionCard";
import { QuickActions, type QuickAction } from "@/features/home/QuickActions";
import { useDashboard } from "@/features/home/useDashboard";
import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import { VpnExplainerSheet } from "@/features/vpn/VpnPrompts";
import { useVpn } from "@/features/vpn/useVpn";
import AppEvents from "@/services/app-events";
import VpnService from "@/services/vpn.service";
import { Radius, Spacing, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import {
  Badge,
  Button,
  Card,
  Dot,
  Icon,
  IconButton,
  Screen,
  ScreenScroll,
  Section,
  Skeleton,
  StatBand,
  Text,
  Touchable,
  useScrollY,
  AppBar,
  LargeTitle,
} from "@/ui";

export default function HomeScreen() {
  const { t } = useTheme();
  const { scrollY, onScroll } = useScrollY();

  const data = useDashboard();
  const vpn = useVpn();
  const sessions = useSessions();
  const { isPremium, limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [focusSheet, setFocusSheet] = useState(false);
  const [timerSheet, setTimerSheet] = useState(false);
  const [focusOverlay, setFocusOverlay] = useState(false);
  const [vpnExplainer, setVpnExplainer] = useState(false);

  const toggleProtection = useCallback(async () => {
    if (sessions.locked) return;
    if (!(await guard("toggle_vpn"))) return;

    if (vpn.active) {
      await vpn.stop();
      return;
    }
    // Tant que la permission n'a pas été accordée, Android va afficher son
    // avertissement générique : on l'explique d'abord, sinon la plupart des
    // utilisateurs refusent.
    if (await VpnService.isVpnPermissionGranted()) {
      await vpn.start();
      return;
    }
    setVpnExplainer(true);
  }, [sessions.locked, guard, vpn]);

  const activateFromExplainer = useCallback(async () => {
    setVpnExplainer(false);
    await vpn.start();
  }, [vpn]);

  const openAllowlist = useCallback(() => {
    if (!paywall.enforce(limits.canUseAllowlist())) return;
    router.push("/allowlist");
  }, [paywall, limits]);

  const actions: QuickAction[] = [
    {
      key: "focus",
      icon: "target",
      label: "Focus",
      hint: sessions.focusActive
        ? "Session en cours — appuyer pour l'ouvrir"
        : "Bloquer sans possibilité de revenir en arrière",
      tone: "focus",
      active: sessions.focusActive,
      badge: sessions.focusActive ? "En cours" : undefined,
      onPress: () =>
        sessions.focusActive ? setFocusOverlay(true) : setFocusSheet(true),
    },
    {
      key: "timer",
      icon: "timer-outline",
      label: "Minuterie",
      hint: sessions.timerActive
        ? "Minuterie active"
        : "Couper les distractions un moment",
      tone: "brand",
      active: sessions.timerActive,
      badge: sessions.timerActive ? "En cours" : undefined,
      onPress: () => setTimerSheet(true),
    },
    {
      key: "allowlist",
      icon: "playlist-check",
      label: "Liste blanche",
      hint: data.allowlist.enabled
        ? plural(data.allowlist.packages.length, "app autorisée", "apps autorisées")
        : "Tout bloquer sauf quelques apps",
      tone: "info",
      active: data.allowlist.enabled,
      badge: data.allowlist.enabled ? "Active" : undefined,
      locked: !isPremium,
      onPress: openAllowlist,
    },
    {
      key: "profiles",
      icon: "account-multiple-outline",
      label: "Profils",
      hint: data.activeProfile
        ? `Actif : ${data.activeProfile.name}`
        : plural(data.profileCount, "profil enregistré", "profils enregistrés"),
      tone: "allowed",
      active: !!data.activeProfile,
      onPress: () => router.push("/profiles"),
    },
  ];

  return (
    <Screen>
      <AppBar
        title="NetOff"
        scrollY={scrollY}
        right={
          <View style={st.appBarRight}>
            {isPremium ? (
              <Badge label="Pro" tone="focus" icon="shield-star-outline" size="md" />
            ) : (
              <Button
                label="Passer Pro"
                size="sm"
                variant="accent"
                onPress={() => paywall.open("general")}
              />
            )}
            <IconButton
              icon="cog-outline"
              variant="soft"
              onPress={() => router.push("/settings")}
              accessibilityLabel="Réglages"
            />
          </View>
        }
      />

      <ScreenScroll
        onScroll={onScroll}
        bottomInset={TAB_BAR_HEIGHT + Spacing.xl}
        contentContainerStyle={st.content}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={data.refresh}
            tintColor={t.refreshTint}
            colors={[t.refreshTint]}
            progressBackgroundColor={t.bg.card}
          />
        }
      >
        <LargeTitle
          title="Votre réseau"
          subtitle={
            data.currentStreak > 0
              ? `${plural(data.currentStreak, "jour")} de suite sans céder`
              : "Reprenez la main sur ce qui accède à internet"
          }
        />

        {data.loading ? (
          <View style={st.loading}>
            <Skeleton height={260} radius={Radius.xl} />
            <Skeleton height={96} radius={Radius.lg} />
          </View>
        ) : (
          <>
            <ProtectionCard
              vpnActive={vpn.active}
              busy={vpn.busy}
              blockedCount={data.blockedCount}
              allowlistEnabled={data.allowlist.enabled}
              logs={data.logs}
              locked={sessions.locked}
              onToggle={toggleProtection}
            />

            {sessions.locked ? (
              <SessionBanner
                sessions={sessions}
                onExpandFocus={() => setFocusOverlay(true)}
              />
            ) : null}

            {data.batteryRestricted ? (
              <Touchable
                onPress={() => router.push("/settings/device")}
                feedback="subtle"
                style={[
                  st.warning,
                  {
                    backgroundColor: t.intent.warning.bg,
                    borderColor: t.intent.warning.border,
                  },
                ]}
              >
                <Icon name="battery-alert-variant-outline" size={20} color={t.intent.warning.accent} />
                <View style={st.flex}>
                  <Text variant="headline" tone="warning" numberOfLines={1}>
                    Le système restreint NetOff
                  </Text>
                  <Text variant="footnote" tone="muted" numberOfLines={2}>
                    Le blocage peut s'interrompre en arrière-plan. Voir la marche à suivre.
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={t.intent.warning.accent} />
              </Touchable>
            ) : null}

            <Section title="Actions rapides">
              <QuickActions actions={actions} />
            </Section>

            <Section
              title="Depuis le début"
              action={
                <Touchable
                  onPress={() => router.push("/stats")}
                  feedback="none"
                  hitSlop={8}
                >
                  <Text variant="caption" tone="link">
                    Tout voir
                  </Text>
                </Touchable>
              }
            >
              <StatBand
                items={[
                  {
                    value: data.logs.totalBlocked,
                    label: "connexions coupées",
                    tone: "blocked",
                  },
                  { value: data.currentStreak, label: "jours de suite", tone: "focus" },
                  {
                    value: humanMinutes(data.savedMinutes),
                    label: "temps regagné",
                    tone: "allowed",
                  },
                ]}
              />
            </Section>

            {data.activeProfile ? (
              <Section title="Profil actif">
                <Touchable
                  onPress={() =>
                    router.push({
                      pathname: "/profile/[profileId]",
                      params: { profileId: data.activeProfile!.id },
                    })
                  }
                  feedback="subtle"
                >
                  <Card style={st.profileCard}>
                    <Dot color={t.intent.allowed.accent} pulse size={9} />
                    <View style={st.flex}>
                      <Text variant="headline" numberOfLines={1}>
                        {data.activeProfile.name}
                      </Text>
                      <Text variant="footnote" tone="muted" numberOfLines={1}>
                        {plural(
                          (data.activeProfile.rules ?? []).filter((r) => r.isBlocked).length,
                          "app bloquée",
                          "apps bloquées",
                        )}
                        {(data.activeProfile.schedules ?? []).length > 0
                          ? ` · ${plural((data.activeProfile.schedules ?? []).length, "planification")}`
                          : ""}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={t.text.faint} />
                  </Card>
                </Touchable>
              </Section>
            ) : null}

            {data.parentalEnabled ? (
              <View style={st.footNote}>
                <Icon name="shield-lock-outline" size={14} color={t.intent.focus.accent} />
                <Text variant="footnote" tone="muted">
                  Contrôle parental actif — les modifications demandent le code parent.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScreenScroll>

      {/* Panneaux */}
      <FocusSheet
        visible={focusSheet}
        onClose={() => setFocusSheet(false)}
        onStarted={() => {
          AppEvents.emit("focus:changed", true);
          sessions.refresh();
          setFocusOverlay(true);
        }}
        onLocked={() => {
          setFocusSheet(false);
          paywall.open("focus_presets");
        }}
      />

      <TimerSheet
        visible={timerSheet}
        onClose={() => setTimerSheet(false)}
        onStarted={() => {
          AppEvents.emit("timer:changed", true);
          sessions.refresh();
        }}
        onLocked={() => {
          setTimerSheet(false);
          paywall.open("timer_presets");
        }}
      />

      <VpnExplainerSheet
        visible={vpnExplainer}
        onClose={() => setVpnExplainer(false)}
        onActivate={activateFromExplainer}
        busy={vpn.busy}
      />

      <Paywall
        visible={paywall.visible}
        reason={paywall.reason}
        onClose={paywall.close}
        onUpgraded={data.refresh}
      />

      {sessions.focus ? (
        <FocusOverlay
          visible={focusOverlay}
          status={sessions.focus}
          remainingMs={sessions.remainingMs}
          onClose={() => setFocusOverlay(false)}
          onStopped={sessions.refresh}
        />
      ) : null}

      <ParentalGate />
    </Screen>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl },
  appBarRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  loading: { gap: Spacing.lg },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  profileCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  footNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.xs,
  },
  flex: { flex: 1 },
});
