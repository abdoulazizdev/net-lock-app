/**
 * ui/AppAvatar.tsx — Icône d'application
 *
 * Le module natif renvoie l'icône en base64 quand elle est disponible.
 * Sinon on retombe sur une pastille colorée portant l'initiale : la teinte
 * est dérivée du nom de package, donc stable d'un lancement à l'autre — l'œil
 * finit par reconnaître l'app à sa couleur.
 */

import { Image } from "expo-image";
import React from "react";
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** Teinte stable dérivée du nom de package. */
export function packageHue(packageName: string): number {
  let hash = 0;
  for (let i = 0; i < packageName.length; i++) {
    hash = (hash * 31 + packageName.charCodeAt(i)) % 360;
  }
  return hash;
}

export function packageColor(packageName: string, isDark: boolean): string {
  return `hsl(${packageHue(packageName)}, ${isDark ? 52 : 58}%, ${isDark ? 62 : 48}%)`;
}

const SIZES = { sm: 32, md: 42, lg: 56, xl: 72 } as const;
export type AppAvatarSize = keyof typeof SIZES | number;

export type AppAvatarProps = {
  packageName: string;
  appName?: string;
  /** Icône WebP encodée en base64, telle que fournie par le module natif. */
  icon?: string | null;
  size?: AppAvatarSize;
  /** Contour teinté à la couleur de l'app. */
  bordered?: boolean;
  style?: StyleProp<ViewStyle & ImageStyle>;
};

export const AppAvatar = React.memo(function AppAvatar({
  packageName,
  appName,
  icon,
  size = "md",
  bordered = true,
  style,
}: AppAvatarProps) {
  const { isDark } = useTheme();
  const box = typeof size === "number" ? size : SIZES[size];
  const radius = Math.round(box * 0.28);
  const color = packageColor(packageName, isDark);
  const initial = (appName?.trim()?.[0] ?? packageName.split(".").pop()?.[0] ?? "?").toUpperCase();

  const frame = { width: box, height: box, borderRadius: radius };

  if (icon) {
    return (
      <Image
        source={{ uri: `data:image/webp;base64,${icon}` }}
        style={[frame, style]}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={120}
        accessibilityLabel={appName}
      />
    );
  }

  return (
    <View
      style={[
        frame,
        st.fallback,
        {
          backgroundColor: isDark ? `${color}22` : `${color}1F`,
          borderColor: bordered ? `${color}55` : "transparent",
          borderWidth: bordered ? 1 : 0,
        },
        style,
      ]}
      accessibilityLabel={appName}
    >
      {initial === "?" || !initial.trim() ? (
        <Icon name="application-outline" size={Math.round(box * 0.5)} color={color} />
      ) : (
        <Text
          variant={box >= 56 ? "title2" : box >= 42 ? "title3" : "headline"}
          color={color}
        >
          {initial}
        </Text>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
