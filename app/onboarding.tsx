/**
 * OnboardingScreen
 */

import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import WatchdogService from "@/services/watchdog.service";
import { Colors, useTheme } from "@/theme";
import { InstalledApp } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_KEY = "@netoff_onboarding_done";

type Step = "welcome" | "how" | "permission" | "pick" | "profile" | "done";
const STEPS: Step[] = [
  "welcome",
  "how",
  "permission",
  "pick",
  "profile",
  "done",
];

type SuggestedApp = InstalledApp & { emoji?: string };

const SOCIAL_PACKAGES = [
  { pkg: "com.instagram.android", label: "Instagram", icon: "📸" },
  { pkg: "com.zhiliaoapp.musically", label: "TikTok", icon: "🎵" },
  { pkg: "com.facebook.katana", label: "Facebook", icon: "👥" },
  { pkg: "com.twitter.android", label: "X (Twitter)", icon: "🐦" },
  { pkg: "com.snapchat.android", label: "Snapchat", icon: "👻" },
  { pkg: "com.google.android.youtube", label: "YouTube", icon: "▶" },
  { pkg: "com.netflix.mediaclient", label: "Netflix", icon: "🎬" },
  { pkg: "com.reddit.frontpage", label: "Reddit", icon: "🔴" },
  { pkg: "com.linkedin.android", label: "LinkedIn", icon: "💼" },
  { pkg: "com.pinterest", label: "Pinterest", icon: "📌" },
  { pkg: "com.discord", label: "Discord", icon: "💬" },
  { pkg: "com.whatsapp", label: "WhatsApp", icon: "💬" },
  { pkg: "org.telegram.messenger", label: "Telegram", icon: "✈" },
  { pkg: "com.king.candycrushsaga", label: "Candy Crush", icon: "🍬" },
];

export async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}
export async function isOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
}

// ─── StepDots ─────────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={ob.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[ob.dot, i === current ? ob.dotActive : undefined]}
        />
      ))}
    </View>
  );
}

// ─── AppPickCard ──────────────────────────────────────────────────────────────
function AppPickCard({
  app,
  selected,
  disabled,
  onToggle,
}: {
  app: SuggestedApp;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const tap = () => {
    if (disabled && !selected) return;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 300,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle();
  };

  return (
    <TouchableOpacity
      onPress={tap}
      activeOpacity={disabled && !selected ? 0.4 : 0.9}
    >
      <Animated.View
        style={[
          ob.appCard,
          { backgroundColor: t.bg.card, borderColor: t.border.light },
          selected
            ? {
                backgroundColor: Colors.blue[50],
                borderColor: Colors.blue[400],
              }
            : undefined,
          disabled && !selected ? { opacity: 0.4 } : undefined,
          { transform: [{ scale }] },
        ]}
      >
        {app.icon ? (
          <Image
            source={{ uri: `data:image/png;base64,${app.icon}` }}
            style={ob.appCardIcon}
          />
        ) : (
          <View
            style={[
              ob.appCardIconFallback,
              { backgroundColor: Colors.blue[50] },
            ]}
          >
            <Text style={{ fontSize: 20 }}>{app.emoji ?? "📱"}</Text>
          </View>
        )}
        <Text
          style={[ob.appCardName, { color: t.text.primary }]}
          numberOfLines={2}
        >
          {app.appName}
        </Text>
        <View
          style={[
            ob.appCardCheck,
            selected
              ? {
                  backgroundColor: Colors.blue[500],
                  borderColor: Colors.blue[500],
                }
              : undefined,
          ]}
        >
          {selected && (
            <Text style={{ fontSize: 10, color: "#fff", fontWeight: "800" }}>
              ✓
            </Text>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  const [step, setStep] = useState<Step>("welcome");
  const [selectedPkgs, setSelectedPkgs] = useState<Set<string>>(
    new Set<string>(),
  );
  const [suggestedApps, setSuggestedApps] = useState<SuggestedApp[]>([]);
  const [permGranted, setPermGranted] = useState<boolean>(false);
  const [permLoading, setPermLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [showLimitHint, setShowLimitHint] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const stepIdx = STEPS.indexOf(step);

  const maxSelect = FREE_LIMITS.MAX_BLOCKED_APPS;
  const limitReached = selectedPkgs.size >= maxSelect;

  useEffect(() => {
    animateIn();
  }, [step]);
  useEffect(() => {
    if (step === "pick") loadSuggested();
  }, [step]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadSuggested = async () => {
    setLoadingApps(true);
    try {
      const installed: InstalledApp[] = await AppListService.getNonSystemApps();
      const installedMap = new Map<string, InstalledApp>(
        installed.map((a) => [a.packageName, a]),
      );

      const seen = new Set<string>();
      const unique: SuggestedApp[] = SOCIAL_PACKAGES.filter((s) =>
        installedMap.has(s.pkg),
      ).reduce<SuggestedApp[]>((acc, s) => {
        if (seen.has(s.pkg)) return acc;
        seen.add(s.pkg);
        const base = installedMap.get(s.pkg)!;
        acc.push({ ...base, emoji: s.icon });
        return acc;
      }, []);

      setSuggestedApps(unique);

      AppListService.getNonSystemAppsWithIcons?.()
        .then((full: InstalledApp[]) => {
          const fm = new Map<string, InstalledApp>(
            full.map((a) => [a.packageName, a]),
          );
          setSuggestedApps((prev) =>
            prev.map((a) => ({
              ...a,
              icon: fm.get(a.packageName)?.icon ?? a.icon,
            })),
          );
        })
        .catch(() => {});
    } finally {
      setLoadingApps(false);
    }
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };
  const prev = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const requestVpnPermission = async () => {
    setPermLoading(true);
    try {
      const granted: boolean = await VpnService.startVpn();
      setPermGranted(granted);
      if (granted) setTimeout(next, 600);
    } catch {
      setPermGranted(false);
    } finally {
      setPermLoading(false);
    }
  };

  const toggleApp = (pkg: string) => {
    setSelectedPkgs((prev) => {
      const next = new Set<string>(prev);
      if (next.has(pkg)) {
        next.delete(pkg);
        setShowLimitHint(false);
        return next;
      }
      if (next.size >= maxSelect) {
        setShowLimitHint(true);
        setTimeout(() => setShowLimitHint(false), 2500);
        return prev;
      }
      next.add(pkg);
      return next;
    });
  };

  const finish = async () => {
    setSaving(true);
    try {
      const pkgsToSave = Array.from(selectedPkgs).slice(0, maxSelect);
      for (const pkg of pkgsToSave) {
        await StorageService.saveRule({
          packageName: pkg,
          isBlocked: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      if (pkgsToSave.length > 0) await VpnService.syncRules?.();
      await WatchdogService.start?.();
      await markOnboardingDone();
      router.replace("/(tabs)");
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    await markOnboardingDone();
    await WatchdogService.start?.();
    router.replace("/(tabs)");
  };

  // ─────────────────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ── BIENVENUE ──────────────────────────────────────────────────────────
      case "welcome":
        return (
          <View style={ob.stepWrap}>
            <View
              style={[
                ob.heroIconBig,
                {
                  backgroundColor: Colors.blue[50],
                  borderColor: Colors.blue[100],
                },
              ]}
            >
              <Image
                source={require("@/assets/images/netoff-logo.png")}
                style={ob.heroLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={[ob.stepTitle, { color: t.text.primary }]}>
              Bienvenue dans NetOff
            </Text>
            <Text style={[ob.stepSub, { color: t.text.secondary }]}>
              Reprenez le contrôle de votre connexion internet. Bloquez les apps
              qui vous distraient, en quelques secondes.
            </Text>
            <View style={ob.featureList}>
              {(
                [
                  [
                    "🚫",
                    "Blocage réseau par app",
                    "Pas juste des notifications — l'internet réel",
                  ],
                  [
                    "⏰",
                    "Planifications automatiques",
                    "Bloquer les réseaux sociaux la nuit, au travail",
                  ],
                  [
                    "🎯",
                    "Mode Focus",
                    "Sessions verrouillées, difficiles à annuler",
                  ],
                  [
                    "📊",
                    "Statistiques détaillées",
                    "Voyez exactement ce que vos apps font",
                  ],
                ] as [string, string, string][]
              ).map(([icon, title, sub]) => (
                <View
                  key={title}
                  style={[ob.featureRow, { borderColor: t.border.light }]}
                >
                  <Text style={ob.featureIcon}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[ob.featureTitle, { color: t.text.primary }]}>
                      {title}
                    </Text>
                    <Text style={[ob.featureSub, { color: t.text.muted }]}>
                      {sub}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );

      // ── COMMENT ÇA MARCHE ─────────────────────────────────────────────────
      case "how":
        return (
          <View style={ob.stepWrap}>
            <View
              style={[
                ob.heroIconBig,
                {
                  backgroundColor: Colors.blue[50],
                  borderColor: Colors.blue[100],
                },
              ]}
            >
              <Text style={{ fontSize: 56 }}>⚙</Text>
            </View>
            <Text style={[ob.stepTitle, { color: t.text.primary }]}>
              Comment ça marche ?
            </Text>
            <Text style={[ob.stepSub, { color: t.text.secondary }]}>
              NetOff utilise un VPN local sur votre appareil. Vos données ne
              quittent jamais votre téléphone.
            </Text>
            <View style={ob.howList}>
              {(
                [
                  {
                    n: "1",
                    title: "Un VPN local est créé",
                    sub: "Entièrement sur votre appareil. Aucun serveur externe.",
                    c: Colors.blue[400],
                  },
                  {
                    n: "2",
                    title: "Les apps bloquées entrent",
                    sub: "Leur trafic réseau est redirigé dans le tunnel VPN local.",
                    c: Colors.blue[500],
                  },
                  {
                    n: "3",
                    title: "Le trafic est drainé",
                    sub: "Les paquets sont lus et jetés. L'app pense ne pas avoir internet.",
                    c: Colors.blue[600],
                  },
                  {
                    n: "4",
                    title: "Les autres apps bypassent",
                    sub: "Toutes vos autres apps continuent de fonctionner normalement.",
                    c: Colors.blue[700],
                  },
                ] as { n: string; title: string; sub: string; c: string }[]
              ).map((item) => (
                <View
                  key={item.n}
                  style={[
                    ob.howRow,
                    { backgroundColor: t.bg.card, borderColor: t.border.light },
                  ]}
                >
                  <View style={[ob.howNum, { backgroundColor: item.c }]}>
                    <Text style={ob.howNumText}>{item.n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ob.howTitle, { color: t.text.primary }]}>
                      {item.title}
                    </Text>
                    <Text style={[ob.howSub, { color: t.text.muted }]}>
                      {item.sub}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <View
              style={[
                ob.privacyBox,
                {
                  backgroundColor: Colors.green[50],
                  borderColor: Colors.green[100],
                },
              ]}
            >
              <Text style={{ fontSize: 14, color: Colors.green[500] }}>🔒</Text>
              <Text style={[ob.privacyText, { color: Colors.green[600] }]}>
                100% privé — aucune donnée n'est envoyée à nos serveurs. Le VPN
                est local et hors ligne.
              </Text>
            </View>
          </View>
        );

      // ── PERMISSION VPN ────────────────────────────────────────────────────
      case "permission":
        return (
          <View style={ob.stepWrap}>
            <View
              style={[
                ob.permBox,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🔑</Text>
              <Text
                style={[
                  ob.stepTitle,
                  { color: t.text.primary, textAlign: "center" },
                ]}
              >
                Permission VPN requise
              </Text>
              <Text
                style={[
                  ob.stepSub,
                  { color: t.text.secondary, textAlign: "center" },
                ]}
              >
                Android doit vous demander d'autoriser NetOff à créer un VPN
                local. Cette étape est obligatoire pour le blocage.
              </Text>
              <View style={ob.permSteps}>
                {(
                  [
                    "Un dialog Android va s'ouvrir",
                    'Appuyez sur "OK" ou "Autoriser"',
                    "Le VPN local est créé sur votre appareil",
                  ] as string[]
                ).map((s, i) => (
                  <View
                    key={i}
                    style={[ob.permStep, { borderColor: t.border.light }]}
                  >
                    <View
                      style={[
                        ob.permStepNum,
                        {
                          backgroundColor: permGranted
                            ? Colors.green[400]
                            : Colors.blue[500],
                        },
                      ]}
                    >
                      <Text style={ob.permStepNumText}>
                        {permGranted ? "✓" : i + 1}
                      </Text>
                    </View>
                    <Text
                      style={[
                        ob.permStepText,
                        {
                          color: permGranted
                            ? Colors.green[600]
                            : t.text.secondary,
                        },
                      ]}
                    >
                      {s}
                    </Text>
                  </View>
                ))}
              </View>
              {permGranted ? (
                <View
                  style={[
                    ob.permGranted,
                    {
                      backgroundColor: Colors.green[50],
                      borderColor: Colors.green[100],
                    },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>✅</Text>
                  <Text
                    style={[ob.permGrantedText, { color: Colors.green[600] }]}
                  >
                    Permission accordée !
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    ob.permBtn,
                    { backgroundColor: Colors.blue[600] },
                    permLoading ? { opacity: 0.6 } : undefined,
                  ]}
                  onPress={requestVpnPermission}
                  disabled={permLoading}
                  activeOpacity={0.85}
                >
                  <Text style={ob.permBtnText}>
                    {permLoading ? "En attente…" : "🔑 Accorder la permission"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[ob.permNote, { color: t.text.muted }]}>
              Android peut vous poser cette question à nouveau après un
              redémarrage. C'est normal.
            </Text>
          </View>
        );

      // ── CHOISIR LES APPS ──────────────────────────────────────────────────
      case "pick":
        return (
          <View style={[ob.stepWrap, { flex: 1 }]}>
            <Text style={[ob.stepTitle, { color: t.text.primary }]}>
              Que voulez-vous bloquer ?
            </Text>
            <Text style={[ob.stepSub, { color: t.text.secondary }]}>
              Sélectionnez les apps qui vous distraient. Vous pourrez modifier
              ça à tout moment.
            </Text>

            <View
              style={[
                ob.pickCounter,
                {
                  backgroundColor: limitReached ? Colors.amber[50] : t.bg.card,
                  borderColor: limitReached
                    ? Colors.amber[100]
                    : t.border.light,
                },
              ]}
            >
              <View style={ob.pickCounterLeft}>
                <Text
                  style={[
                    ob.pickCounterNum,
                    {
                      color: limitReached
                        ? Colors.amber[500]
                        : Colors.blue[500],
                    },
                  ]}
                >
                  {selectedPkgs.size}
                </Text>
                <Text style={[ob.pickCounterSep, { color: t.text.muted }]}>
                  /
                </Text>
                <Text style={[ob.pickCounterMax, { color: t.text.muted }]}>
                  {maxSelect}
                </Text>
              </View>
              <Text
                style={[
                  ob.pickCounterLabel,
                  {
                    color: limitReached ? Colors.amber[600] : t.text.secondary,
                  },
                ]}
              >
                {limitReached
                  ? "🔒 Limite gratuite — débloquez plus avec Premium"
                  : `app${selectedPkgs.size !== 1 ? "s" : ""} sélectionnée${selectedPkgs.size !== 1 ? "s" : ""}`}
              </Text>
            </View>

            {showLimitHint && (
              <View
                style={[
                  ob.limitToast,
                  {
                    backgroundColor: Colors.amber[50],
                    borderColor: Colors.amber[200],
                  },
                ]}
              >
                <Text style={[ob.limitToastText, { color: Colors.amber[700] }]}>
                  🔒 Version gratuite — max {maxSelect} apps. Vous pourrez en
                  débloquer plus avec Premium depuis l'accueil.
                </Text>
              </View>
            )}

            {loadingApps ? (
              <View style={ob.loadingWrap}>
                <Text style={{ color: t.text.muted, fontSize: 14 }}>
                  Chargement des applications…
                </Text>
              </View>
            ) : suggestedApps.length === 0 ? (
              <View style={ob.loadingWrap}>
                <Text
                  style={{
                    color: t.text.muted,
                    fontSize: 14,
                    textAlign: "center",
                  }}
                >
                  Aucune app de réseaux sociaux détectée.{"\n"}Vous pourrez en
                  ajouter depuis l'accueil.
                </Text>
              </View>
            ) : (
              <FlatList<SuggestedApp>
                data={suggestedApps}
                keyExtractor={(a) => a.packageName}
                numColumns={3}
                columnWrapperStyle={{ gap: 10 }}
                contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <AppPickCard
                    app={item}
                    selected={selectedPkgs.has(item.packageName)}
                    disabled={
                      limitReached && !selectedPkgs.has(item.packageName)
                    }
                    onToggle={() => toggleApp(item.packageName)}
                  />
                )}
              />
            )}
          </View>
        );

      // ── PROFIL DE BASE ────────────────────────────────────────────────────
      case "profile":
        return (
          <View style={ob.stepWrap}>
            <View
              style={[
                ob.heroIconBig,
                {
                  backgroundColor: Colors.green[50],
                  borderColor: Colors.green[100],
                },
              ]}
            >
              <Text style={{ fontSize: 56 }}>✅</Text>
            </View>
            <Text style={[ob.stepTitle, { color: t.text.primary }]}>
              Presque prêt !
            </Text>
            <Text style={[ob.stepSub, { color: t.text.secondary }]}>
              {selectedPkgs.size > 0
                ? `${selectedPkgs.size} app${selectedPkgs.size > 1 ? "s" : ""} seront bloquées dès l'activation du VPN.`
                : "Vous n'avez pas sélectionné d'apps. Vous pourrez le faire depuis l'accueil."}
            </Text>

            {selectedPkgs.size >= maxSelect && (
              <View
                style={[
                  ob.limitReminder,
                  {
                    backgroundColor: Colors.amber[50],
                    borderColor: Colors.amber[100],
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>💡</Text>
                <Text
                  style={[ob.limitReminderText, { color: Colors.amber[700] }]}
                >
                  Vous avez atteint la limite de {maxSelect} apps de la version
                  gratuite. Passez à Premium depuis l'accueil pour en débloquer
                  plus.
                </Text>
              </View>
            )}

            <View style={ob.summaryList}>
              {(
                [
                  [
                    "🛡",
                    "VPN local activé",
                    "Vos données restent sur votre appareil",
                  ],
                  [
                    "🔄",
                    "Watchdog actif",
                    "Le VPN se relance automatiquement si coupé",
                  ],
                  [
                    "📊",
                    "Statistiques activées",
                    "Suivez vos tentatives de connexion bloquées",
                  ],
                  [
                    "⚙",
                    "Tout configurable",
                    "Modifiez vos règles à tout moment",
                  ],
                ] as [string, string, string][]
              ).map(([icon, title, sub]) => (
                <View
                  key={title}
                  style={[
                    ob.summaryRow,
                    { backgroundColor: t.bg.card, borderColor: t.border.light },
                  ]}
                >
                  <Text style={ob.summaryIcon}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[ob.summaryTitle, { color: t.text.primary }]}>
                      {title}
                    </Text>
                    <Text style={[ob.summarySub, { color: t.text.muted }]}>
                      {sub}
                    </Text>
                  </View>
                  <Text style={{ color: Colors.green[400], fontSize: 14 }}>
                    ✓
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      case "done":
        return null;
    }
  };

  const isLastContent = step === "profile";
  const canGoNext = step !== "permission" || permGranted;

  return (
    <View style={[ob.container, { backgroundColor: t.bg.page }]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.bg.page} />

      {/* Header */}
      <View style={[ob.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={stepIdx > 0 ? prev : skip}
          activeOpacity={0.7}
          style={ob.headerBack}
        >
          {stepIdx > 0 ? (
            <Text style={[ob.headerBackText, { color: t.text.muted }]}>
              ← Retour
            </Text>
          ) : (
            <Text style={[ob.headerSkip, { color: t.text.muted }]}>Passer</Text>
          )}
        </TouchableOpacity>
        <StepDots current={stepIdx} total={STEPS.length - 1} />
        <TouchableOpacity
          onPress={skip}
          activeOpacity={0.7}
          style={ob.headerSkipBtn}
        >
          {stepIdx < STEPS.length - 2 ? (
            <Text style={[ob.headerSkip, { color: t.text.muted }]}>Passer</Text>
          ) : (
            <View style={{ width: 48 }} />
          )}
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={[
          ob.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {renderStep()}
        </Animated.View>
      </Animated.ScrollView>

      {/* Footer */}
      <View
        style={[
          ob.footer,
          { paddingBottom: insets.bottom + 16, backgroundColor: t.bg.page },
        ]}
      >
        {step === "permission" && !permGranted && (
          <TouchableOpacity
            style={[ob.btnSecondary, { borderColor: t.border.normal }]}
            onPress={next}
            activeOpacity={0.75}
          >
            <Text style={[ob.btnSecondaryText, { color: t.text.secondary }]}>
              Passer cette étape
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            ob.btnPrimary,
            { backgroundColor: Colors.blue[600] },
            !canGoNext || saving ? { opacity: 0.5 } : undefined,
          ]}
          onPress={isLastContent ? finish : next}
          disabled={!canGoNext || saving}
          activeOpacity={0.85}
        >
          <Text style={ob.btnPrimaryText}>
            {saving
              ? "Démarrage…"
              : isLastContent
                ? "🚀 Commencer"
                : step === "pick"
                  ? selectedPkgs.size > 0
                    ? `Bloquer ${selectedPkgs.size} app${selectedPkgs.size > 1 ? "s" : ""}`
                    : "Continuer sans bloquer"
                  : "Continuer →"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ob = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerBack: { minWidth: 64 },
  headerBackText: { fontSize: 14, fontWeight: "600" },
  headerSkipBtn: { minWidth: 64, alignItems: "flex-end" },
  headerSkip: { fontSize: 13, fontWeight: "500" },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CBD5E0" },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.blue[500],
  },

  scrollContent: { paddingHorizontal: 22, paddingTop: 8 },
  stepWrap: { gap: 16 },
  heroIconBig: {
    alignSelf: "center",
    marginBottom: 8,
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  heroLogo: { width: 68, height: 68 },
  stepTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  stepSub: { fontSize: 14, lineHeight: 22, textAlign: "center", opacity: 0.8 },

  featureList: { gap: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  featureIcon: { fontSize: 22, width: 28, textAlign: "center" },
  featureTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  featureSub: { fontSize: 12, lineHeight: 18 },

  howList: { gap: 10 },
  howRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  howNum: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  howNumText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  howTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  howSub: { fontSize: 12, lineHeight: 17 },
  privacyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  privacyText: { fontSize: 12, lineHeight: 18, flex: 1 },

  permBox: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
    gap: 16,
  },
  permSteps: { width: "100%", gap: 12 },
  permStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  permStepNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  permStepNumText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  permStepText: { fontSize: 13, flex: 1, fontWeight: "500" },
  permBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  permBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  permGranted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  permGrantedText: { fontSize: 14, fontWeight: "700" },
  permNote: { fontSize: 11, textAlign: "center", lineHeight: 18, opacity: 0.7 },

  pickCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  pickCounterLeft: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  pickCounterNum: { fontSize: 22, fontWeight: "800" },
  pickCounterSep: { fontSize: 16 },
  pickCounterMax: { fontSize: 14 },
  pickCounterLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },

  limitToast: { borderRadius: 12, borderWidth: 1, padding: 12 },
  limitToastText: { fontSize: 12, lineHeight: 18, fontWeight: "500" },

  appCard: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  appCardIcon: { width: 48, height: 48, borderRadius: 13 },
  appCardIconFallback: {
    width: 48,
    height: 48,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  appCardName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14,
  },
  appCardCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CBD5E0",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingWrap: { paddingVertical: 32, alignItems: "center" },

  limitReminder: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  limitReminderText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },

  summaryList: { gap: 10 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryIcon: { fontSize: 20, width: 28, textAlign: "center" },
  summaryTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  summarySub: { fontSize: 11, opacity: 0.7 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    gap: 10,
  },
  btnPrimary: { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.2,
  },
  btnSecondary: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: "600" },
});
