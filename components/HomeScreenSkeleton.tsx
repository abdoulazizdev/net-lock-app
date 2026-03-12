/**
 * HomeScreenSkeleton
 *
 * Animation: shimmer "wave" qui descend le long de la liste.
 * Un seul Animated.Value → N interpolations avec phase-shift.
 * Tout tourne sur le thread UI natif (useNativeDriver: true).
 * Zéro setState, zéro re-render pendant l'animation.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Constantes ───────────────────────────────────────────────────────────────
const CARD_COUNT = 9;
const WAVE_MS = 1600; // durée d'un cycle complet
const PHASE_STEP = 0.1; // décalage de phase entre chaque card
const LO = 0.07; // opacité min des bones
const HI = 0.42; // opacité max des bones
const HDR_PHASE = 0.0;
const SEARCH_PHASE = 0.05;
const CHIP_PHASE = 0.1;

// ─── Hook central : un seul Animated.Value ────────────────────────────────────
function useWave() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: WAVE_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ).start();
    return () => anim.stopAnimation();
  }, []);
  return anim;
}

// ─── Interpolation avec phase-shift ──────────────────────────────────────────
// inputRange en 5 points pour une sinusoïde lisse sans artefact "clamp"
function phaseOpacity(
  wave: Animated.Value,
  phase: number, // 0…1
  lo = LO,
  hi = HI,
): Animated.AnimatedInterpolation<number> {
  // On déroule le cycle sur [0,1] avec le décalage de phase
  const p = phase % 1;
  // 5 pivots : 0 → pic → 1 avec le pic centré sur `p`
  const p0 = (p - 0.25 + 1) % 1;
  const p1 = (p - 0.0 + 1) % 1;
  const p2 = (p + 0.25) % 1;

  // On trie pour que inputRange soit strictement croissant
  const pts = [0, p0, p1, p2, 1].sort((a, b) => a - b);
  const out = pts.map((x) => {
    // Valeur sinusoïdale centrée sur p
    const dist = Math.min(Math.abs(x - p), 1 - Math.abs(x - p));
    const v = Math.cos(dist * Math.PI * 2) * 0.5 + 0.5; // 0…1
    return lo + v * (hi - lo);
  });

  return wave.interpolate({
    inputRange: pts,
    outputRange: out,
    extrapolate: "clamp",
  });
}

// ─── Bone ─────────────────────────────────────────────────────────────────────
function Bone({
  w,
  h,
  r = 7,
  op,
  style,
}: {
  w?: number | `${number}%`;
  h: number;
  r?: number;
  op: Animated.AnimatedInterpolation<number>;
  style?: object;
}) {
  return (
    <Animated.View
      style={[
        {
          width: w ?? "100%",
          height: h,
          borderRadius: r,
          backgroundColor: "#1C1C2C",
          opacity: op,
        },
        style,
      ]}
    />
  );
}

// ─── Card skeleton ────────────────────────────────────────────────────────────
// Memoïsé : les interpolations sont créées une seule fois, jamais recalculées.
const CardBone = React.memo(function CardBone({
  wave,
  index,
}: {
  wave: Animated.Value;
  index: number;
}) {
  // Les interpolations sont créées une seule fois grâce à useMemo.
  const op = useMemo(
    () => phaseOpacity(wave, index * PHASE_STEP),
    [], // wave est un ref stable, index ne change pas
  );

  // Largeurs variées pour paraître naturel
  const nameW = 40 + (index % 5) * 9; // 40–76 %
  const pkgW = 26 + (index % 4) * 8; // 26–50 %

  return (
    <Animated.View style={[sk.card, { opacity: op }]}>
      <View style={sk.icon} />
      <View style={sk.info}>
        <View style={[sk.line, { width: `${nameW}%` }]} />
        <View style={[sk.line, sk.lineB, { width: `${pkgW}%` }]} />
      </View>
      <View style={sk.toggle} />
    </Animated.View>
  );
});

// ─── Skeleton complet ─────────────────────────────────────────────────────────
export default function HomeScreenSkeleton() {
  const insets = useSafeAreaInsets();
  const wave = useWave();

  // Header / search / chips ont leurs propres phases
  const opHdr = useMemo(() => phaseOpacity(wave, HDR_PHASE), []);
  const opSearch = useMemo(() => phaseOpacity(wave, SEARCH_PHASE), []);
  const opChip = useMemo(() => phaseOpacity(wave, CHIP_PHASE), []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {/* Titre + bouton VPN */}
        <View style={styles.row}>
          <View style={{ gap: 9 }}>
            <Bone w={92} h={28} r={8} op={opHdr} />
            <Bone w={152} h={11} r={5} op={opHdr} />
          </View>
          <Bone w={114} h={34} r={22} op={opHdr} />
        </View>

        {/* Barre de recherche + toggle filtre */}
        <View style={[styles.row, { marginBottom: 10 }]}>
          <Bone h={38} r={12} op={opSearch} style={{ flex: 1 }} />
          <Bone w={52} h={38} r={12} op={opSearch} />
        </View>

        {/* Chips de filtres */}
        <View style={styles.chips}>
          {[72, 92, 84, 78].map((w, i) => (
            <Bone key={i} w={w} h={30} r={20} op={opChip} />
          ))}
        </View>
      </View>

      {/* ── Cards ───────────────────────────────────────────────────────────── */}
      <View style={styles.list}>
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <CardBone key={i} wave={wave} index={i} />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 22,
  },
  chips: { flexDirection: "row", gap: 6 },
  list: { paddingHorizontal: 22, paddingTop: 12 },
});

const sk = StyleSheet.create({
  // Hauteur fixe = padding 14×2 + icon 48 = 76 — identique à AppCard
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 18,
    padding: 14,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    height: 76,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#1C1C2C",
    marginRight: 14,
  },
  info: { flex: 1, gap: 7 },
  line: { height: 11, borderRadius: 5, backgroundColor: "#1C1C2C" },
  lineB: { height: 10, borderRadius: 4 },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1C1C2C",
  },
});
