/**
 * ui/Icon.tsx — Unique source d'icônes de l'application
 *
 * Toute l'app utilise le jeu Material Community via `@expo/vector-icons`
 * (polices déjà embarquées, aucun réglage natif). Passer par ce wrapper garantit
 * des tailles cohérentes et un typage strict des noms.
 */

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import type { StyleProp, TextStyle } from "react-native";

import { useTheme } from "@/theme";

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Tailles nommées — éviter les valeurs arbitraires dans les écrans. */
export const IconSize = {
  xs: 13,
  sm: 16,
  md: 19,
  lg: 22,
  xl: 26,
  xxl: 34,
  hero: 46,
} as const;

export type IconSizeName = keyof typeof IconSize;

export type IconProps = {
  name: IconName;
  size?: IconSizeName | number;
  /** Par défaut : `text.secondary`. */
  color?: string;
  style?: StyleProp<TextStyle>;
};

export const Icon = React.memo(function Icon({
  name,
  size = "md",
  color,
  style,
}: IconProps) {
  const { t } = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={typeof size === "number" ? size : IconSize[size]}
      color={color ?? t.text.secondary}
      style={style}
    />
  );
});
