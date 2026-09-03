/**
 * ui/Skeleton.tsx — Chargement
 *
 * Un squelette vaut mieux qu'un spinner dès que la forme du contenu est
 * connue : la page ne « saute » pas à l'arrivée des données.
 *
 *   <Skeleton width={140} height={14} />
 *   <SkeletonRow />                     // ligne d'app : icône + 2 lignes
 *   <SkeletonList count={8} />
 */

import React, { useEffect } from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Radius, Spacing, useTheme } from "@/theme";

/** Pulsation partagée : une seule animation pour tous les squelettes montés. */
function usePulse() {
  const v = useSharedValue(0.5);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [v]);
  return v;
}

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = "100%",
  height = 12,
  radius = Radius.xs,
  circle = false,
  style,
}: SkeletonProps) {
  const { t } = useTheme();
  const pulse = usePulse();
  const anim = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: circle ? height / 2 : radius,
          backgroundColor: t.bg.cardAlt,
        },
        anim,
        style,
      ]}
    />
  );
}

/** Silhouette d'une ligne d'application : icône carrée + deux lignes de texte. */
export function SkeletonRow({ trailing = 50 }: { trailing?: number }) {
  const { t } = useTheme();
  return (
    <View style={[st.row, { borderColor: t.border.light }]}>
      <Skeleton width={42} height={42} radius={Radius.sm} />
      <View style={st.rowText}>
        <Skeleton width="62%" height={13} />
        <Skeleton width="38%" height={10} />
      </View>
      <Skeleton width={trailing} height={26} radius={Radius.pill} />
    </View>
  );
}

export function SkeletonList({ count = 8 }: { count?: number }) {
  return (
    <View style={st.list}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

/** Silhouette d'une carte : titre, deux lignes, pied. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const { t } = useTheme();
  return (
    <View style={[st.card, { backgroundColor: t.bg.card, borderColor: t.border.light }]}>
      <Skeleton width="45%" height={15} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "70%" : "100%"} height={11} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  list: { gap: Spacing.sm, paddingHorizontal: Spacing.gutter },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowText: { flex: 1, gap: Spacing.sm },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
});
