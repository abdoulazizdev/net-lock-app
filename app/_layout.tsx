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
import StorageService from "@/services/storage.service";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  // On rend le Stack immédiatement, puis on redirige depuis useEffect
  // après que le layout soit monté — sinon router.replace() est ignoré
  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    checkAuth();
  }, [ready]);

  const checkAuth = async () => {
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
    <PaperProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="profile-rules" options={{ headerShown: false }} />
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
  );
}
