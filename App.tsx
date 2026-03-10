import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import AuthScreen from "@/app/(tabs)/auth";
import HomeScreen from "@/app/(tabs)/index";
import ProfilesScreen from "@/app/(tabs)/profile";
import SettingsScreen from "@/app/(tabs)/settings";
import StatsScreen from "@/app/(tabs)/stats";
import AppDetailScreen from "@/app/screens/app-detail";

import StorageService from "@/services/storage.service";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: string;

          switch (route.name) {
            case "Home":
              iconName = "apps";
              break;
            case "Profiles":
              iconName = "account-group";
              break;
            case "Stats":
              iconName = "chart-bar";
              break;
            default:
              iconName = "circle";
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#6200ee",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Applications" }}
      />
      <Tab.Screen
        name="profiles"
        component={ProfilesScreen}
        options={{ title: "Profils" }}
      />
      <Tab.Screen
        name="sStats"
        component={StatsScreen}
        options={{ title: "Statistiques" }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const config = await StorageService.getAuthConfig();
      setIsAuthenticated(!config.isPinEnabled);
    } catch (error) {
      console.error("Erreur lors de la vérification auth:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" options={{ headerShown: false }}>
          {(props) => (
            <AuthScreen
              {...props}
              onAuthenticated={() => setIsAuthenticated(true)}
            />
          )}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AppDetail"
            component={AppDetailScreen}
            options={{ title: "Détails de l'application" }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "Paramètres" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </PaperProvider>
  );
}
