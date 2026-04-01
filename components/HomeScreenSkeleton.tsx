import { Semantic, useTheme } from "@/theme";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Config ───────────────────────────────────────────────────────────────────
const CARD_COUNT = 9;
const WAVE_MS = 1600;
const PHASE_STEP = 0.085;

const PHASE_LOGO = 0.0;
const PHASE_ACTIONS = 0.05;
const PHASE_STATS = 0.1;
const PHASE_PILLS = 0.15;
const PHASE_PROGRESS = 0.18;
const PHASE_SEARCH = 0.22;
const PHASE_CHIPS = 0.27;
const PHASE_META = 0.3;

const LO = 0.28;
const HI = 0.82;

// ─── Wave hook ────────────────────────────────────────────────────────────────
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

function phaseOpacity(
  wave: Animated.Value,
  phase: number,
  lo = LO,
  hi = HI,
): Animated.AnimatedInterpolation<number> {
  const p = phase % 1;
  const p0 = (p - 0.25 + 1) % 1;
  const p1 = (p - 0.0 + 1) % 1;
  const p2 = (p + 0.25) % 1;
  const pts = [0, p0, p1, p2, 1].sort((a, b) => a - b);
  const out = pts.map((x) => {
    const dist = Math.min(Math.abs(x - p), 1 - Math.abs(x - p));
    const v = Math.cos(dist * Math.PI * 2) * 0.5 + 0.5;
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
  light = false,
  boneColor,
}: {
  w?: number | `${number}%`;
  h: number;
  r?: number;
  op: Animated.AnimatedInterpolation<number>;
  style?: object;
  light?: boolean;
  boneColor: string;
}) {
  return (
    <Animated.View
      style={[
        {
          width: w ?? "100%",
          height: h,
          borderRadius: r,
          backgroundColor: light ? "rgba(255,255,255,0.22)" : boneColor,
          opacity: op,
        },
        style,
      ]}
    />
  );
}

// ─── AppCardBone ──────────────────────────────────────────────────────────────
const AppCardBone = React.memo(function AppCardBone({
  wave,
  index,
  cardBg,
  cardBorder,
  boneBg,
}: {
  wave: Animated.Value;
  index: number;
  cardBg: string;
  cardBorder: string;
  boneBg: string;
}) {
  const op = useMemo(
    () => phaseOpacity(wave, (index * PHASE_STEP + 0.35) % 1),
    [],
  );
  const nameW = 38 + (index % 5) * 8;
  const pkgW = 24 + (index % 4) * 9;

  return (
    <Animated.View
      style={[
        s.card,
        { backgroundColor: cardBg, borderColor: cardBorder },
        { opacity: op },
      ]}
    >
      <View style={[s.cardIcon, { backgroundColor: boneBg }]} />
      <View style={s.cardInfo}>
        <View
          style={[
            s.cardLine,
            { width: `${nameW}%` as any, backgroundColor: boneBg },
          ]}
        />
        <View
          style={[
            s.cardLineSub,
            { width: `${pkgW}%` as any, backgroundColor: boneBg },
          ]}
        />
      </View>
      <View style={[s.cardToggle, { backgroundColor: boneBg }]} />
    </Animated.View>
  );
});

// ─── HomeScreenSkeleton ───────────────────────────────────────────────────────
export default function HomeScreenSkeleton() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const wave = useWave();

  const opLogo = useMemo(() => phaseOpacity(wave, PHASE_LOGO), []);
  const opActions = useMemo(() => phaseOpacity(wave, PHASE_ACTIONS), []);
  const opStats = useMemo(() => phaseOpacity(wave, PHASE_STATS), []);
  const opPills = useMemo(() => phaseOpacity(wave, PHASE_PILLS), []);
  const opProgress = useMemo(() => phaseOpacity(wave, PHASE_PROGRESS), []);
  const opSearch = useMemo(() => phaseOpacity(wave, PHASE_SEARCH), []);
  const opChips = useMemo(() => phaseOpacity(wave, PHASE_CHIPS), []);
  const opMeta = useMemo(() => phaseOpacity(wave, PHASE_META), []);

  const boneColor = t.bg.cardAlt;

  return (
    <View style={[s.root, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View
        style={[
          s.header,
          { paddingTop: insets.top + 10, backgroundColor: Semantic.bg.header },
        ]}
      >
        {/* Top row: brand + actions */}
        <View style={s.topRow}>
          <View style={s.brandBlock}>
            {/* Logo mark */}
            <Bone
              w={36}
              h={36}
              r={11}
              op={opLogo}
              light
              boneColor={boneColor}
            />
            {/* Brand name + tagline */}
            <View style={{ gap: 5 }}>
              <Bone
                w={80}
                h={16}
                r={6}
                op={opLogo}
                light
                boneColor={boneColor}
              />
              <Bone
                w={110}
                h={9}
                r={4}
                op={opLogo}
                light
                boneColor={boneColor}
                style={{ opacity: 0.55 }}
              />
            </View>
          </View>
          <View style={s.actionsBlock}>
            {/* Upgrade button shape */}
            <Bone
              w={96}
              h={32}
              r={20}
              op={opActions}
              light
              boneColor={boneColor}
            />
            <View style={s.actionSep} />
            {/* More menu button */}
            <Bone
              w={32}
              h={32}
              r={9}
              op={opActions}
              light
              boneColor={boneColor}
            />
          </View>
        </View>

        {/* Bottom row: stats band + sep + control pills */}
        <View style={s.bottomRow}>
          {/* Stats band — 3 groups */}
          <Animated.View
            style={[
              s.statsBand,
              {
                backgroundColor: "rgba(255,255,255,0.05)",
                borderColor: "rgba(255,255,255,0.09)",
              },
              { opacity: opStats },
            ]}
          >
            {[20, 26, 30].map((labelW, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={s.statDivider} />}
                <View style={s.statGroup}>
                  <View
                    style={[
                      s.statBig,
                      { backgroundColor: "rgba(255,255,255,0.22)" },
                    ]}
                  />
                  <View
                    style={[
                      s.statTiny,
                      {
                        width: labelW,
                        backgroundColor: "rgba(255,255,255,0.14)",
                      },
                    ]}
                  />
                </View>
              </React.Fragment>
            ))}
          </Animated.View>

          <View style={s.midSep} />

          {/* VPN pill + sep + Focus pill */}
          <Animated.View style={[s.pillsBlock, { opacity: opPills }]}>
            <View
              style={[
                s.pill,
                {
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.13)",
                },
              ]}
            />
            <View style={s.pillSep} />
            <View
              style={[
                s.pill,
                {
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.13)",
                },
              ]}
            />
          </Animated.View>
        </View>

        {/* Progress track */}
        <Animated.View
          style={[
            s.progressTrack,
            { backgroundColor: "rgba(255,255,255,0.07)" },
            { opacity: opProgress },
          ]}
        >
          <View
            style={[
              s.progressFill,
              { backgroundColor: "rgba(255,255,255,0.12)" },
            ]}
          />
        </Animated.View>
      </View>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <View style={s.body}>
        {/* Search + filter button */}
        <View style={s.searchRow}>
          <Bone
            h={44}
            r={12}
            op={opSearch}
            style={{ flex: 1 }}
            boneColor={boneColor}
          />
          <Bone w={44} h={44} r={12} op={opSearch} boneColor={boneColor} />
        </View>

        {/* Filter chips */}
        <View style={s.chipRow}>
          {[70, 90, 82, 76].map((w, i) => (
            <Bone
              key={i}
              w={w}
              h={30}
              r={100}
              op={opChips}
              boneColor={boneColor}
            />
          ))}
        </View>

        {/* List meta */}
        <Animated.View style={[s.listMeta, { opacity: opMeta }]}>
          <View style={[s.metaLabel, { backgroundColor: boneColor }]} />
          <View style={[s.metaChip, { backgroundColor: boneColor }]} />
        </Animated.View>

        {/* App cards */}
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <AppCardBone
            key={i}
            wave={wave}
            index={i}
            cardBg={t.bg.card}
            cardBorder={t.border.light}
            boneBg={boneColor}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
    shadowColor: "#040d1e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionsBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionSep: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // Bottom row
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statsBand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statGroup: { flex: 1, alignItems: "center", gap: 6 },
  statBig: { width: 28, height: 18, borderRadius: 5 },
  statTiny: { height: 8, borderRadius: 3 },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  midSep: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  pillsBlock: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: { width: 72, height: 32, borderRadius: 100, borderWidth: 1 },
  pillSep: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // Progress
  progressTrack: {
    height: 22,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "32%",
    borderRadius: 8,
    opacity: 0.6,
  },

  // Body
  body: { paddingHorizontal: 14, paddingTop: 14 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },

  // List meta
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  metaLabel: { width: 66, height: 9, borderRadius: 3, opacity: 0.5 },
  metaChip: { width: 80, height: 22, borderRadius: 8, opacity: 0.5 },

  // App card
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 74,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    overflow: "hidden",
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, marginRight: 13 },
  cardInfo: { flex: 1, gap: 7 },
  cardLine: { height: 11, borderRadius: 5 },
  cardLineSub: { height: 9, borderRadius: 4, opacity: 0.6 },
  cardToggle: { width: 48, height: 26, borderRadius: 13, marginLeft: 12 },
});
