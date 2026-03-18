import { Tabs } from "expo-router";
import React, { useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { HapticTab } from "@/components/haptic-tab";
import { Colors, useTheme } from "@/theme";

const TABS = [
  { name: "index", title: "Apps", icon: "apps" },
  { name: "profile", title: "Profils", icon: "account-group" },
  { name: "stats", title: "Stats", icon: "chart-bar" },
] as const;

export const TAB_BAR_HEIGHT = 62;

function TabIcon({
  icon,
  color,
  focused,
}: {
  icon: string;
  color: string;
  focused: boolean;
}) {
  const { t } = useTheme();
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
    outputRange: ["transparent", t.bg.accent],
  });
  const borderColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", t.border.strong],
  });

  return (
    <Animated.View
      style={[st.iconWrap, { backgroundColor, borderColor, borderWidth: 1 }]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon name={icon} size={21} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
          backgroundColor: t.bg.card,
          borderTopWidth: 1,
          borderTopColor: t.border.light,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: Colors.blue[600],
        tabBarInactiveTintColor: t.text.muted,
        tabBarLabelStyle: st.tabLabel,
        tabBarItemStyle: st.tabItem,
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

const st = StyleSheet.create({
  tabItem: { gap: 4, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  iconWrap: {
    width: 44,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
