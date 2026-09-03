/**
 * app/onboarding.tsx — Première configuration
 *
 * Quatre étapes, dans l'ordre qui donne le meilleur taux d'acceptation :
 *
 *   1. à quoi sert l'app ;
 *   2. comment elle s'y prend (VPN local — dit *avant* de le demander) ;
 *   3. quoi bloquer, tout de suite, pour que l'app serve à quelque chose ;
 *   4. les permissions, une fois la valeur comprise.
 *
 * Chaque étape peut être passée : un onboarding bloquant fait perdre plus
 * d'utilisateurs qu'il n'en convertit.
 */

import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { plural } from "@/lib/format";
import { markOnboardingDone } from "@/features/system/useBootstrap";
import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import type { InstalledApp } from "@/types";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppAvatar,
  Badge,
  Button,
  Icon,
  ProgressBar,
  Screen,
  Skeleton,
  Text,
  Touchable,
  toast,
  type IconName,
} from "@/ui";

/** Apps couramment chronophages, proposées en priorité. */
const SUGGESTED_PACKAGES = [
  "com.instagram.android",
  "com.zhiliaoapp.musically",
  "com.facebook.katana",
  "com.twitter.android",
  "com.snapchat.android",
  "com.google.android.youtube",
  "com.netflix.mediaclient",
  "com.reddit.frontpage",
  "com.pinterest",
  "com.discord",
  "com.linkedin.android",
  "com.king.candycrushsaga",
];

const STEPS = ["welcome", "how", "apps", "permissions"] as const;
type Step = (typeof STEPS)[number];

const HOW_POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "cellphone-lock",
    title: "Un tunnel local, rien de plus",
    body: "NetOff crée un VPN qui ne sort pas de votre téléphone. Le trafic des apps bloquées y est simplement abandonné.",
  },
  {
    icon: "eye-off-outline",
    title: "Aucune donnée collectée",
    body: "Pas de compte, pas de serveur, pas de lecture du contenu de vos connexions.",
  },
  {
    icon: "calendar-clock",
    title: "Automatique si vous voulez",
    body: "Profils et planifications appliquent vos règles aux bonnes heures, même app fermée.",
  },
];

export default function OnboardingScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("welcome");
  const [suggested, setSuggested] = useState<InstalledApp[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [vpnGranted, setVpnGranted] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const maxFree = FREE_LIMITS.MAX_BLOCKED_APPS;

  // Les suggestions sont chargées dès l'ouverture : à l'étape 3, la liste est
  // déjà prête et l'écran ne fait pas patienter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const installed = await AppListService.getUserAppsWithIcons();
        if (cancelled) return;
        const map = new Map(installed.map((app) => [app.packageName, app]));
        const matches = SUGGESTED_PACKAGES.map((pkg) => map.get(pkg)).filter(
          (app): app is InstalledApp => !!app,
        );
        // À défaut de correspondance, on propose les premières apps utilisateur.
        setSuggested(matches.length > 0 ? matches : installed.slice(0, 12));
      } catch {
        if (!cancelled) setSuggested([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goNext = useCallback(() => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }, [stepIndex]);

  const goBack = useCallback(() => {
    const previous = STEPS[stepIndex - 1];
    if (previous) setStep(previous);
  }, [stepIndex]);

  const toggleApp = useCallback(
    (packageName: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(packageName)) {
          next.delete(packageName);
          return next;
        }
        if (next.size >= maxFree) {
          toast.info(
            `Version gratuite : ${plural(maxFree, "app")} maximum. Vous pourrez en ajouter avec Pro.`,
          );
          return prev;
        }
        next.add(packageName);
        return next;
      });
    },
    [maxFree],
  );

  const requestNotifications = useCallback(async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifGranted(status === "granted");
    } catch {
      setNotifGranted(false);
    }
  }, []);

  const requestVpn = useCallback(async () => {
    try {
      const started = await VpnService.startVpn();
      setVpnGranted(started);
      if (!started) toast.error("Permission VPN refusée — vous pourrez réessayer plus tard.");
    } catch {
      setVpnGranted(false);
    }
  }, []);

  const finish = useCallback(async () => {
    setFinishing(true);
    try {
      // Les règles choisies sont écrites avant de quitter l'onboarding : l'app
      // s'ouvre alors sur un état déjà utile.
      const now = new Date();
      for (const packageName of selected) {
        await StorageService.saveRule({
          packageName,
          isBlocked: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (selected.size > 0) await VpnService.syncRules();
      await markOnboardingDone();
      router.replace("/(tabs)");
    } catch {
      // Même en cas d'échec d'écriture, on ne bloque pas l'accès à l'app.
      await markOnboardingDone().catch(() => {});
      router.replace("/(tabs)");
    }
  }, [selected]);

  return (
    <Screen>
      <View style={[st.root, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* Progression */}
        <View style={st.progress}>
          <ProgressBar
            progress={(stepIndex + 1) / STEPS.length}
            height={4}
            color={t.brand.base}
          />
          <View style={st.progressRow}>
            <Text variant="overline" tone="faint">
              Étape {stepIndex + 1} sur {STEPS.length}
            </Text>
            {step !== "welcome" ? (
              <Touchable onPress={goBack} feedback="none" hitSlop={8}>
                <Text variant="caption" tone="muted">
                  Retour
                </Text>
              </Touchable>
            ) : null}
          </View>
        </View>

        <View style={st.body}>
          {step === "welcome" ? (
            <Animated.View
              key="welcome"
              entering={FadeIn.duration(360)}
              style={st.welcome}
            >
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
              <Text variant="display" center>
                Reprenez la main
              </Text>
              <Text variant="body" tone="secondary" center>
                NetOff coupe l'accès à internet des applications que vous
                désignez. Pas de suppression, pas de désinstallation : juste
                plus de réseau, quand vous l'avez décidé.
              </Text>
              <View style={st.pills}>
                <Badge label="100 % local" tone="allowed" icon="cellphone-lock" size="md" />
                <Badge label="Sans compte" tone="brand" icon="account-off-outline" size="md" />
              </View>
            </Animated.View>
          ) : null}

          {step === "how" ? (
            <Animated.View
              key="how"
              entering={FadeInRight.duration(280)}
              exiting={FadeOutLeft.duration(180)}
              style={st.section}
            >
              <Text variant="title1">Comment ça marche</Text>
              <Text variant="callout" tone="muted">
                Android va vous avertir qu'une app « surveille votre trafic ».
                Voici ce que cela signifie réellement.
              </Text>

              <View style={st.points}>
                {HOW_POINTS.map((point) => (
                  <View key={point.title} style={st.point}>
                    <View
                      style={[
                        st.pointIcon,
                        { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
                      ]}
                    >
                      <Icon name={point.icon} size={19} color={t.brand.base} />
                    </View>
                    <View style={st.flex}>
                      <Text variant="headline">{point.title}</Text>
                      <Text variant="footnote" tone="muted">
                        {point.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          {step === "apps" ? (
            <Animated.View
              key="apps"
              entering={FadeInRight.duration(280)}
              exiting={FadeOutLeft.duration(180)}
              style={st.section}
            >
              <Text variant="title1">Que voulez-vous couper ?</Text>
              <Text variant="callout" tone="muted">
                Choisissez jusqu'à {plural(maxFree, "application")} pour commencer.
                Vous pourrez tout ajuster ensuite.
              </Text>

              <View style={st.counter}>
                <Badge
                  label={`${selected.size}/${maxFree}`}
                  tone={selected.size >= maxFree ? "warning" : "brand"}
                  size="md"
                />
                <Text variant="footnote" tone="faint" style={st.flex}>
                  {selected.size === 0
                    ? "Aucune sélection — vous pouvez passer cette étape."
                    : plural(selected.size, "app sera bloquée", "apps seront bloquées")}
                </Text>
              </View>

              {suggested === null ? (
                <View style={st.appGrid}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} width="30%" height={92} radius={Radius.md} />
                  ))}
                </View>
              ) : suggested.length === 0 ? (
                <Text variant="callout" tone="muted">
                  Impossible de lire la liste des applications installées. Vous
                  pourrez choisir vos apps depuis l'onglet Apps.
                </Text>
              ) : (
                <View style={st.appGrid}>
                  {suggested.map((app) => {
                    const active = selected.has(app.packageName);
                    return (
                      <Touchable
                        key={app.packageName}
                        onPress={() => toggleApp(app.packageName)}
                        feedback="strong"
                        haptic="light"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: active }}
                        style={[
                          st.appTile,
                          {
                            backgroundColor: active ? t.intent.blocked.bg : t.bg.card,
                            borderColor: active ? t.intent.blocked.accent : t.border.light,
                            borderWidth: active ? 2 : 1,
                          },
                        ]}
                      >
                        <AppAvatar
                          packageName={app.packageName}
                          appName={app.appName}
                          icon={app.icon}
                          size="md"
                        />
                        <Text variant="caption" center numberOfLines={1}>
                          {app.appName}
                        </Text>
                        {active ? (
                          <View style={st.appCheck}>
                            <Icon
                              name="close-circle"
                              size={16}
                              color={t.intent.blocked.accent}
                            />
                          </View>
                        ) : null}
                      </Touchable>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          ) : null}

          {step === "permissions" ? (
            <Animated.View
              key="permissions"
              entering={FadeInRight.duration(280)}
              exiting={FadeOutLeft.duration(180)}
              style={st.section}
            >
              <Text variant="title1">Deux autorisations</Text>
              <Text variant="callout" tone="muted">
                La première est indispensable, la seconde recommandée.
              </Text>

              <PermissionCard
                icon="shield-check-outline"
                title="Protection réseau"
                body="Nécessaire pour couper le trafic des apps bloquées. Sans elle, NetOff enregistre vos règles sans pouvoir les appliquer."
                required
                granted={vpnGranted}
                actionLabel="Activer"
                onPress={requestVpn}
              />

              <PermissionCard
                icon="bell-outline"
                title="Notifications"
                body="Sert à afficher la session en cours et à signaler une interruption de la protection."
                granted={notifGranted}
                actionLabel="Autoriser"
                onPress={requestNotifications}
              />
            </Animated.View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={st.actions}>
          {step === "permissions" ? (
            <>
              <Button
                label={selected.size > 0 ? "Terminer et bloquer" : "Terminer"}
                icon="check"
                onPress={finish}
                loading={finishing}
                size="lg"
                fullWidth
              />
              {vpnGranted !== true ? (
                <Text variant="footnote" tone="faint" center>
                  Vous pourrez activer la protection à tout moment depuis l'accueil.
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Button
                label={step === "welcome" ? "Commencer" : "Continuer"}
                icon="arrow-right"
                iconRight
                onPress={goNext}
                size="lg"
                fullWidth
              />
              {step === "apps" ? (
                <Button label="Passer cette étape" variant="ghost" onPress={goNext} fullWidth />
              ) : null}
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

// ─── Carte de permission ─────────────────────────────────────────────────────

function PermissionCard({
  icon,
  title,
  body,
  granted,
  actionLabel,
  onPress,
  required = false,
}: {
  icon: IconName;
  title: string;
  body: string;
  granted: boolean | null;
  actionLabel: string;
  onPress: () => void;
  required?: boolean;
}) {
  const { t } = useTheme();
  const ok = granted === true;

  return (
    <View
      style={[
        st.permission,
        {
          backgroundColor: ok ? t.intent.allowed.bg : t.bg.card,
          borderColor: ok ? t.intent.allowed.border : t.border.light,
        },
      ]}
    >
      <View style={st.permissionHead}>
        <View
          style={[
            st.pointIcon,
            {
              backgroundColor: ok ? t.bg.card : t.bg.cardAlt,
              borderColor: ok ? t.intent.allowed.border : t.border.light,
            },
          ]}
        >
          <Icon
            name={ok ? "check" : icon}
            size={19}
            color={ok ? t.intent.allowed.accent : t.brand.base}
          />
        </View>
        <View style={st.flex}>
          <View style={st.permissionTitle}>
            <Text variant="headline" numberOfLines={1}>
              {title}
            </Text>
            {required ? <Badge label="Requis" tone="warning" /> : null}
          </View>
          <Text variant="footnote" tone="muted">
            {body}
          </Text>
        </View>
      </View>

      {ok ? (
        <Text variant="caption" tone="allowed">
          Autorisation accordée
        </Text>
      ) : (
        <Button
          label={granted === false ? "Réessayer" : actionLabel}
          variant={required ? "primary" : "secondary"}
          onPress={onPress}
          fullWidth
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  progress: { gap: Spacing.sm, paddingTop: Spacing.md },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  body: { flex: 1 },
  welcome: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  logoImage: { width: 52, height: 52 },
  pills: { flexDirection: "row", gap: Spacing.sm, paddingTop: Spacing.md },
  section: { gap: Spacing.md, paddingTop: Spacing.lg },
  points: { gap: Spacing.lg, paddingTop: Spacing.sm },
  point: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  pointIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  appGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  appTile: {
    flexGrow: 1,
    flexBasis: "28%",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  appCheck: { position: "absolute", top: 5, right: 5 },
  permission: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  permissionHead: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  permissionTitle: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  actions: { gap: Spacing.sm },
  flex: { flex: 1 },
});
