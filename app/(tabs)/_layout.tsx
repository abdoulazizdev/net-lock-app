/**
 * app/(tabs)/_layout.tsx — Barre d'onglets
 *
 * Quatre destinations, dans l'ordre d'usage : l'état de la protection, les
 * applications, les profils, les statistiques. Les réglages sont accessibles
 * depuis l'en-tête de l'accueil — on n'y va pas tous les jours.
 */

import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Duration, Radius, Spacing, Spring, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import { Icon, Text, type IconName } from "@/ui";

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: "index", title: "Accueil", icon: "shield-outline", iconActive: "shield-check" },
  { name: "apps", title: "Apps", icon: "apps", iconActive: "apps" },
  {
    name: "profiles",
    title: "Profils",
    icon: "account-multiple-outline",
    iconActive: "account-multiple",
  },
  {
    name: "stats",
    title: "Stats",
    icon: "chart-box-outline",
    iconActive: "chart-box",
  },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: t.bg.page },
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: Spacing.sm,
          paddingBottom: insets.bottom,
          backgroundColor: t.bg.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.border.light,
          elevation: 0,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused }) => (
              <TabItem
                icon={focused ? tab.iconActive : tab.icon}
                label={tab.title}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

/**
 * L'onglet actif prend une pastille teintée et son libellé s'affiche.
 * Les inactifs ne montrent que l'icône : la barre reste lisible sans être
 * chargée de texte.
 */
function TabItem({
  icon,
  label,
  focused,
}: {
  icon: IconName;
  label: string;
  focused: boolean;
}) {
  const { t } = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = focused
      ? withSpring(1, Spring.snappy)
      : withTiming(0, { duration: Duration.fast });
  }, [focused, progress]);

  const pill = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.8 + progress.value * 0.2 }],
  }));

  return (
    <View style={st.item}>
      <View style={st.iconWrap}>
        <Animated.View
          style={[
            st.pill,
            { backgroundColor: t.brand.soft, borderColor: t.brand.softBorder },
            pill,
          ]}
        />
        <Icon
          name={icon}
          size={22}
          color={focused ? t.brand.base : t.text.muted}
        />
      </View>
      <Text
        variant="overline"
        color={focused ? t.brand.base : t.text.faint}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  item: { alignItems: "center", gap: 3, width: 72 },
  iconWrap: {
    width: 52,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});
