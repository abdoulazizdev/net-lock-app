import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { HapticTab } from "@/components/haptic-tab";

const TABS = [
  { name: "index", title: "Apps", icon: "apps" },
  { name: "profile", title: "Profils", icon: "account-group" },
  { name: "stats", title: "Stats", icon: "chart-bar" },
] as const;

// Tab bar height exposed so screens can use it for paddingBottom
export const TAB_BAR_HEIGHT = 62;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        // No position:absolute — tab bar sits in normal flow so screens
        // are never obscured. Height accounts for safe-area bottom inset.
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
          backgroundColor: "#0B0B14",
          borderTopWidth: 1,
          borderTopColor: "#1C1C2C",
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: "#9B8FFF",
        tabBarInactiveTintColor: "#3A3A58",
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Icon name={icon} size={21} color={color} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  iconWrapActive: {
    backgroundColor: "#16103A",
  },
});
