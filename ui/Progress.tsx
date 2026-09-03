/**
 * ui/Progress.tsx — Indicateurs de progression
 *
 * `ProgressBar`  : barre horizontale, remplissage animé.
 * `ProgressRing` : anneau de progression, sans dépendance SVG.
 * `Meter`        : barre segmentée (bloqué / autorisé) pour les statistiques.
 *
 * L'anneau est composé de deux demi-disques rognés que l'on fait tourner :
 * chacun couvre 180° de l'arc. C'est la seule façon de tracer un arc en
 * pur React Native, et le rendu reste sur l'UI thread.
 */

import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Duration, Radius, Spring, useTheme } from "@/theme";
import { Text } from "./Text";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ─── Barre ───────────────────────────────────────────────────────────────────

export type ProgressBarProps = {
  /** Progression de 0 à 1. */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  /** Libellé superposé, centré verticalement. */
  label?: string;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 6,
  label,
  animated = true,
  style,
}: ProgressBarProps) {
  const { t } = useTheme();
  const p = useSharedValue(animated ? 0 : clamp01(progress));

  useEffect(() => {
    const target = clamp01(progress);
    p.value = animated ? withSpring(target, Spring.default) : target;
  }, [progress, animated, p]);

  // scaleX plutôt qu'une largeur en pourcentage : pas de recalcul de layout.
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));

  return (
    <View
      style={[
        st.barTrack,
        {
          height: label ? Math.max(height, 20) : height,
          borderRadius: Radius.pill,
          backgroundColor: trackColor ?? t.bg.cardSunken,
        },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamp01(progress) * 100), min: 0, max: 100 }}
    >
      <Animated.View
        style={[
          st.barFill,
          { backgroundColor: color ?? t.brand.base, borderRadius: Radius.pill },
          fill,
        ]}
      />
      {label ? (
        <Text variant="caption" tone="secondary" numberOfLines={1} style={st.barLabel}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Anneau ──────────────────────────────────────────────────────────────────

export type ProgressRingProps = {
  progress: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  animated?: boolean;
  /** Contenu centré dans l'anneau (valeur, icône…). */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ProgressRing({
  progress,
  size = 120,
  thickness = 10,
  color,
  trackColor,
  animated = true,
  children,
  style,
}: ProgressRingProps) {
  const { t } = useTheme();
  const p = useSharedValue(animated ? 0 : clamp01(progress));

  useEffect(() => {
    const target = clamp01(progress);
    p.value = animated
      ? withTiming(target, { duration: Duration.slower })
      : target;
  }, [progress, animated, p]);

  const half = size / 2;
  const accent = color ?? t.brand.base;
  const track = trackColor ?? t.bg.cardSunken;

  // Chaque demi-anneau tourne autour du centre du cercle : le premier balaie
  // 0 → 50 % dans la moitié droite, le second 50 → 100 % dans la moitié gauche.
  const firstRotate = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.min(p.value, 0.5) * 360}deg` }],
  }));
  const secondRotate = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.max(p.value - 0.5, 0) * 360}deg` }],
  }));

  const ring: ViewStyle = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: thickness,
    borderColor: accent,
  };

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamp01(progress) * 100), min: 0, max: 100 }}
    >
      {/* Piste */}
      <View
        style={[
          st.absolute,
          { borderRadius: half, borderWidth: thickness, borderColor: track },
        ]}
      />

      {/* 0 → 50 % : révélé dans la moitié droite */}
      <View style={[st.clip, { left: half, width: half, height: size }]}>
        <Animated.View
          style={[{ width: size, height: size, marginLeft: -half }, firstRotate]}
        >
          <View style={[st.clip, { left: 0, width: half, height: size }]}>
            <View style={ring} />
          </View>
        </Animated.View>
      </View>

      {/* 50 → 100 % : révélé dans la moitié gauche */}
      <View style={[st.clip, { left: 0, width: half, height: size }]}>
        <Animated.View style={[{ width: size, height: size }, secondRotate]}>
          <View style={[st.clip, { left: half, width: half, height: size }]}>
            <View style={[ring, { marginLeft: -half }]} />
          </View>
        </Animated.View>
      </View>

      {children ? <View style={st.ringCenter}>{children}</View> : null}
    </View>
  );
}

// ─── Compteur segmenté ───────────────────────────────────────────────────────

export type MeterSegment = { value: number; color: string; label?: string };

/**
 * Barre proportionnelle à plusieurs segments (par exemple bloqué vs autorisé).
 * Les segments de valeur nulle sont omis.
 */
export function Meter({
  segments,
  height = 8,
  style,
}: {
  segments: MeterSegment[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTheme();
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <View
      style={[
        st.meter,
        { height, borderRadius: Radius.pill, backgroundColor: t.bg.cardSunken },
        style,
      ]}
    >
      {total > 0
        ? segments
            .filter((s) => s.value > 0)
            .map((s, i) => (
              <View
                key={i}
                style={{ flex: s.value, backgroundColor: s.color }}
                accessibilityLabel={s.label}
              />
            ))
        : null}
    </View>
  );
}

const st = StyleSheet.create({
  barTrack: { overflow: "hidden", justifyContent: "center" },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "left center",
  },
  barLabel: { paddingHorizontal: 8 },
  absolute: { ...StyleSheet.absoluteFillObject },
  clip: { position: "absolute", top: 0, overflow: "hidden" },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  meter: { flexDirection: "row", overflow: "hidden" },
});
