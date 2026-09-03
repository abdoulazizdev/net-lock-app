/**
 * app/_layout.tsx — Racine de l'application
 *
 * Responsabilités, dans cet ordre :
 *   1. les fournisseurs (gestes, safe-area, thème) ;
 *   2. la séquence de démarrage et la destination initiale ;
 *   3. la pile de navigation et les surcouches globales (notifications,
 *      mises à jour, bilan hebdomadaire).
 *
 * Aucune logique métier ici : tout ce qui concerne le VPN, les profils ou les
 * sessions vit dans `features/`.
 */

import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { UpdatePrompt } from "@/features/system/UpdatePrompt";
import { useBootstrap, type BootState } from "@/features/system/useBootstrap";
import { WeeklyReportSheet } from "@/features/stats/WeeklyReportSheet";
import { TAB_BAR_HEIGHT, ThemeProvider, useTheme } from "@/theme";
import { ToastHost } from "@/ui";

// Le splash reste visible tant que la destination initiale n'est pas connue :
// cela évite d'afficher les onglets une fraction de seconde avant de basculer
// sur l'écran de verrouillage.
SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const boot = useBootstrap();

  useEffect(() => {
    if (boot.ready) SplashScreen.hideAsync().catch(() => {});
  }, [boot.ready]);

  if (!boot.ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell boot={boot} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell({ boot }: { boot: BootState }) {
  const { t } = useTheme();

  // La redirection est faite après le montage de la pile : `router.replace`
  // depuis le rendu initial serait ignoré.
  useEffect(() => {
    if (boot.route !== "/(tabs)") router.replace(boot.route);
  }, [boot.route]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg.page },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{ gestureEnabled: false, animation: "fade" }}
        />
        <Stack.Screen
          name="lock"
          options={{ gestureEnabled: false, animation: "fade" }}
        />
        <Stack.Screen name="application/[packageName]" />
        <Stack.Screen name="profile/[profileId]" />
        <Stack.Screen name="allowlist" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/security" />
        <Stack.Screen name="settings/parental" />
        <Stack.Screen name="settings/data" />
        <Stack.Screen name="settings/device" />
        <Stack.Screen name="settings/about" />
        <Stack.Screen name="settings/contact" />
      </Stack>

      <UpdatePrompt bottomOffset={TAB_BAR_HEIGHT} />
      <ToastHost bottomOffset={TAB_BAR_HEIGHT} />

      <WeeklyReportSheet
        visible={boot.showWeeklyReport}
        onClose={boot.dismissWeeklyReport}
      />
    </>
  );
}
