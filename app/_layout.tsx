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

import { useColorScheme } from "@/hooks/use-color-scheme";
import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import SubscriptionService from "@/services/subscription.service";
import { NetOffThemeProvider } from "@/theme";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      // ✅ Initialise RevenueCat via le service centralisé
      await SubscriptionService.configure();

      // ✅ Sync statut premium avec RevenueCat (si SDK configuré)
      await SubscriptionService.syncWithRevenueCat();
    } catch (e) {
      console.error("[bootstrap] Erreur init:", e);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    if (!ready) return;
    checkAuthAndFocus();
  }, [ready]);

  const checkAuthAndFocus = async () => {
    try {
      const config = await StorageService.getAuthConfig();
      if (config.isPinEnabled || config.isBiometricEnabled) {
        router.replace("/auth");
      }
    } catch (e) {
      console.error("Erreur auth:", e);
    }
  };

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
    </NetOffThemeProvider>
  );
}
