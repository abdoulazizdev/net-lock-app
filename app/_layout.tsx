import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import { NetOffThemeProvider } from "@/theme";

export const unstable_settings = { anchor: "(tabs)" };

// ── RevenueCat — init conditionnelle ──────────────────────────────────────────
// Clés API à remplacer par vos vraies clés RevenueCat
const RC_API_KEY_ANDROID = "goog_xxxx"; // Google Play
const RC_API_KEY_IOS = "appl_xxxx"; // App Store

let Purchases: any = null;
try {
  Purchases = require("react-native-purchases").default;
} catch {
  console.warn(
    "[_layout] react-native-purchases non installé — RevenueCat désactivé",
  );
}

function initRevenueCat() {
  if (!Purchases) return;
  try {
    const apiKey = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    Purchases.configure({ apiKey });
    console.log("[RevenueCat] Initialisé avec succès");
  } catch (e) {
    console.error("[RevenueCat] Erreur d'initialisation:", e);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialiser RevenueCat au démarrage de l'app
    initRevenueCat();
    setReady(true);
  }, []);

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
                    if (status.isActive) {
                      router.back();
                    }
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
