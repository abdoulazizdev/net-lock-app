import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import StorageService from "@/services/storage.service";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setReady(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
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
    <SafeAreaProvider>
      <PaperProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#080810" },
                animation: "slide_from_right",
                animationDuration: 280,
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, animation: "none" }}
              />
              <Stack.Screen
                name="auth"
                options={{ headerShown: false, animation: "fade" }}
              />
              <Stack.Screen
                name="profile-rules"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="settings"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="screens/app-detail"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="screens/profile-detail"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="screens/about"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="screens/contact"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
            </Stack>
          </Animated.View>
          <StatusBar style="light" />
        </ThemeProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
