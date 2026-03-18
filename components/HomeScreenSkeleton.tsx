import { Semantic, useTheme } from "@/theme";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_COUNT = 9;
const WAVE_MS = 1600;
const PHASE_STEP = 0.1;
const LO = 0.25;
const HI = 0.8;
const HDR_PHASE = 0.0;
const SEARCH_PHASE = 0.05;
const CHIP_PHASE = 0.1;

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
          backgroundColor: light ? "rgba(255,255,255,.3)" : boneColor,
          opacity: op,
        },
        style,
      ]}
    />
  );
}

const CardBone = React.memo(function CardBone({
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
  const op = useMemo(() => phaseOpacity(wave, index * PHASE_STEP), []);
  const nameW = 40 + (index % 5) * 9;
  const pkgW = 26 + (index % 4) * 8;
  return (
    <Animated.View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: cardBg,
          borderRadius: 16,
          padding: 14,
          marginBottom: 7,
          borderWidth: 1,
          borderColor: cardBorder,
          height: 76,
        },
        { opacity: op },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: boneBg,
          marginRight: 12,
        }}
      />
      <View style={{ flex: 1, gap: 7 }}>
        <View
          style={{
            height: 11,
            borderRadius: 5,
            backgroundColor: boneBg,
            width: `${nameW}%`,
          }}
        />
        <View
          style={{
            height: 10,
            borderRadius: 4,
            backgroundColor: boneBg,
            width: `${pkgW}%`,
          }}
        />
      </View>
      <View
        style={{
          width: 46,
          height: 26,
          borderRadius: 13,
          backgroundColor: boneBg,
        }}
      />
    </Animated.View>
  );
});

export default function HomeScreenSkeleton() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const wave = useWave();
  const opHdr = useMemo(() => phaseOpacity(wave, HDR_PHASE), []);
  const opSearch = useMemo(() => phaseOpacity(wave, SEARCH_PHASE), []);
  const opChip = useMemo(() => phaseOpacity(wave, CHIP_PHASE), []);

  const boneColor = t.bg.cardAlt;
  const cardBg = t.bg.card;
  const cardBorder = t.border.light;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg.page }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* Header bleu — bones blanches */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingBottom: 18,
          paddingTop: insets.top + 12,
          backgroundColor: Semantic.bg.header,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 22,
          }}
        >
          <View style={{ gap: 9 }}>
            <Bone w={92} h={28} r={8} op={opHdr} light boneColor={boneColor} />
            <Bone w={152} h={11} r={5} op={opHdr} light boneColor={boneColor} />
          </View>
          <Bone w={114} h={34} r={22} op={opHdr} light boneColor={boneColor} />
        </View>
      </View>

      {/* Corps */}
      <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Bone
            h={38}
            r={12}
            op={opSearch}
            style={{ flex: 1 }}
            boneColor={boneColor}
          />
          <Bone w={52} h={38} r={12} op={opSearch} boneColor={boneColor} />
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
          {[72, 92, 84, 78].map((w, i) => (
            <Bone
              key={i}
              w={w}
              h={30}
              r={20}
              op={opChip}
              boneColor={boneColor}
            />
          ))}
        </View>
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <CardBone
            key={i}
            wave={wave}
            index={i}
            cardBg={cardBg}
            cardBorder={cardBorder}
            boneBg={boneColor}
          />
        ))}
      </View>
    </View>
  );
}
