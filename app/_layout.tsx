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

// UpdateBanner chargé en lazy pour éviter un crash si InAppUpdateModule
// n'est pas encore disponible (build sans Play Services, émulateur, etc.)
const UpdateBanner = React.lazy(() =>
  import("@/components/UpdateBanner").catch(() => ({
    default: () => null as any,
  })),
);

export const ONBOARDING_KEY = "@netoff_onboarding_done";
export const unstable_settings = { anchor: "(tabs)" };

async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
  } catch {
    return false;
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      await SubscriptionService.configure();
      await SubscriptionService.syncWithRevenueCat();
    } catch (e) {
      console.error("[bootstrap] subscription:", e);
    }

    try {
      const done = await isOnboardingDone();
      setOnboardingDone(done);
    } catch (e) {
      console.error("[bootstrap] onboarding:", e);
      setOnboardingDone(false);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    if (!ready || onboardingDone === null) return;
    if (onboardingDone) postBootActions();
    else router.replace("/onboarding");
  }, [ready, onboardingDone]);

  const postBootActions = async () => {
    try {
      const config = await StorageService.getAuthConfig();
      if (config.isPinEnabled || config.isBiometricEnabled)
        router.replace("/auth");
    } catch (e) {
      console.error("[postBootActions] auth:", e);
    }

    try {
      await WatchdogService.start();
    } catch (e) {
      console.error("[postBootActions] watchdog:", e);
    }

    try {
      const shouldShow = await WeeklyReportService.shouldShowReport();
      if (shouldShow) setShowWeeklyReport(true);
    } catch (e) {
      console.error("[postBootActions] weekly-report:", e);
    }

    // Charger UpdateBanner après que tout le reste est prêt
    // Un léger délai évite de surcharger le démarrage
    setTimeout(() => setUpdateReady(true), 2000);
  };

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
                try {
                  const routes = (e.data?.state as any)?.routes ?? [];
                  const last = routes[routes.length - 1];
                  if (last?.name === "settings") {
                    const status = await FocusService.getStatus();
                    if (status.isActive) router.back();
                  }
                } catch {}
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
              name="screens/about"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/contact"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/profile-detail"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="parental-control"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="productivity"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/allowlist"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/profile-apps"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/oem-compat"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </PaperProvider>

      <WeeklyReportModal
        visible={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
      />

      {/* UpdateBanner chargé en lazy après le boot complet */}
      {updateReady && (
        <React.Suspense fallback={null}>
          <UpdateBanner />
        </React.Suspense>
      )}
    </NetOffThemeProvider>
  );
}
