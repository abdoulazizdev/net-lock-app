import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Provider as PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import WeeklyReportModal from "@/components/WeeklyReportModal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import SubscriptionService from "@/services/subscription.service";
import WatchdogService from "@/services/watchdog.service";
import WeeklyReportService from "@/services/weekly-report.service";
import { NetOffThemeProvider } from "@/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ONBOARDING_KEY = "@netoff_onboarding_done";
export const unstable_settings = { anchor: "(tabs)" };

async function isOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // null = inconnu (splash), false = onboarding requis, true = app normale
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // ── Étape 1 : init async (RevenueCat + onboarding check) ────────────────
  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      await SubscriptionService.configure();
      await SubscriptionService.syncWithRevenueCat();
    } catch (e) {
      console.error("[bootstrap]", e);
    } finally {
      // Vérifier onboarding
      const done = await isOnboardingDone();
      setOnboardingDone(done);
      setReady(true);
    }
  };

  // ── Étape 2 : une fois prêt, actions post-boot ───────────────────────────
  useEffect(() => {
    if (!ready || onboardingDone === null) return;

    if (onboardingDone) {
      postBootActions();
    } else {
      // Rediriger vers l'onboarding
      router.replace("/onboarding");
    }
  }, [ready, onboardingDone]);

  const postBootActions = async () => {
    try {
      // Auth
      const config = await StorageService.getAuthConfig();
      if (config.isPinEnabled || config.isBiometricEnabled) {
        router.replace("/auth");
      }

      // Watchdog — s'assure que le VPN est surveillé
      await WatchdogService.start();

      // Rapport hebdomadaire — uniquement le lundi et si 7 jours écoulés
      const shouldShow = await WeeklyReportService.shouldShowReport();
      if (shouldShow) setShowWeeklyReport(true);
    } catch (e) {
      console.error("[postBootActions]", e);
    }
  };

  // ── Splash le temps de l'init ────────────────────────────────────────────
  if (!ready || onboardingDone === null) return null;

  return (
    <NetOffThemeProvider>
      <PaperProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack
            screenListeners={{
              beforeRemove: () => {},
              state: async (e) => {
                const routes = (e.data?.state as any)?.routes ?? [];
                const last = routes[routes.length - 1];
                if (last?.name === "settings") {
                  try {
                    const status = await FocusService.getStatus();
                    if (status.isActive) router.back();
                  } catch {}
                }
              },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="profile-rules"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/app-detail"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/profile-detail"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>

          <StatusBar style="light" />
        </ThemeProvider>
      </PaperProvider>

      {/* Rapport hebdomadaire — rendu hors du Stack pour éviter les conflits de navigation */}
      <WeeklyReportModal
        visible={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
      />
    </NetOffThemeProvider>
  );
}
