import { Tabs } from "expo-router";
import React, { useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { HapticTab } from "@/components/haptic-tab";

const TABS = [
  { name: "index", title: "Apps", icon: "apps" },
  { name: "profile", title: "Profils", icon: "account-group" },
  { name: "stats", title: "Stats", icon: "chart-bar" },
] as const;

export const TAB_BAR_HEIGHT = 62;

// ─── Animated tab icon ────────────────────────────────────────────────────────
function TabIcon({
  icon,
  color,
  focused,
}: {
  icon: string;
  color: string;
  focused: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.12 : 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }),
      Animated.timing(bgAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "#16103A"],
  });
  const borderColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "#4A3F8A"],
  });

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        { backgroundColor, borderColor, borderWidth: 1 },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon name={icon} size={21} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
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
              <TabIcon icon={icon} color={color} focused={focused} />
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
    width: 44,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
