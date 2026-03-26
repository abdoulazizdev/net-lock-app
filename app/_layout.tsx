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
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

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
      const done = await isOnboardingDone();
      setOnboardingDone(done);
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
      await WatchdogService.start();
      const shouldShow = await WeeklyReportService.shouldShowReport();
      if (shouldShow) setShowWeeklyReport(true);
    } catch (e) {
      console.error("[postBootActions]", e);
    }
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
              name="screens/oem-compat"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/parental-control"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="screens/productivity"
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
    </NetOffThemeProvider>
  );
}
