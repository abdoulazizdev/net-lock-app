import FocusService, { FocusStatus } from "@/services/focus.service";
import { Colors } from "@/theme";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Pulsing ring ─────────────────────────────────────────────────────────────
const PulseRing = React.memo(function PulseRing({
  size,
  color,
  delay = 0,
}: {
  size: number;
  color: string;
  delay?: number;
}) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 2200,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2200,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.85,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
});

// ─── Countdown timer ──────────────────────────────────────────────────────────
function useCountdown(endTime: number | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!endTime) return;
    const tick = () => setRemaining(Math.max(0, endTime - Date.now()));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
}

function formatTime(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Stop hold button ─────────────────────────────────────────────────────────
function HoldToStop({ onStopped }: { onStopped: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);
  const [ready, setReady] = useState(false);

  const HOLD_DURATION = 1800;

  const startHold = useCallback(() => {
    setHolding(true);
    holdAnim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished) {
        setReady(true);
        if (Platform.OS !== "web") Vibration.vibrate(80);
        onStopped();
      }
    });
  }, [onStopped, progress]);

  const cancelHold = useCallback(() => {
    holdAnim.current?.stop();
    setHolding(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <TouchableOpacity
      onPressIn={startHold}
      onPressOut={cancelHold}
      activeOpacity={0.9}
      style={hts.wrap}
    >
      <Animated.View style={[hts.fill, { width }]} />
      <Text style={hts.label}>
        {ready ? "Arrêt…" : holding ? "Maintenir…" : "Maintenir pour arrêter"}
      </Text>
    </TouchableOpacity>
  );
}

const hts = StyleSheet.create({
  wrap: {
    width: 240,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(248,113,113,0.28)",
    borderRadius: 26,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.3,
    zIndex: 1,
  },
});

// ─── Progress arc (SVG-like with Animated) ────────────────────────────────────
function ProgressCircle({
  progress,
  size,
  strokeWidth,
  color,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - progress);
  return (
    <View style={{ width: size, height: size, position: "absolute" }}>
      {/* background track */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: "rgba(255,255,255,0.06)",
        }}
      />
      {/* SVG for the arc — expo-compatible */}
      {/* We simulate it with a border clip trick */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderTopColor: progress < 0.25 ? "transparent" : color,
          borderRightColor: progress < 0.5 ? "transparent" : color,
          borderBottomColor: progress < 0.75 ? "transparent" : color,
          borderLeftColor: progress < 1 ? "transparent" : color,
          opacity: 0.85,
          transform: [{ rotate: "-90deg" }],
        }}
      />
    </View>
  );
}

// ─── Main FocusFullScreen ─────────────────────────────────────────────────────
interface Props {
  status: FocusStatus;
  visible: boolean;
  onClose: () => void;
  onStopped: () => void;
}

export default function FocusFullScreen({
  status,
  visible,
  onClose,
  onStopped,
}: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.04)).current;
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.04,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const endTime = status?.endTime ? new Date(status.endTime).getTime() : null;
  const totalDuration =
    status?.durationMinutes != null ? status.durationMinutes * 60 * 1000 : null;
  const remaining = useCountdown(endTime);
  const startTime = endTime && totalDuration ? endTime - totalDuration : null;
  const progress =
    totalDuration && remaining ? 1 - remaining / totalDuration : 0;

  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await FocusService.stopFocus();
      onStopped();
    } catch {
      setStopping(false);
    }
  }, [stopping, onStopped]);

  const blockedCount = status?.packages?.length ?? 0;
  const CIRCLE_SIZE = 220;
  const STROKE = 6;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[
          fs.backdrop,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Radial glow overlay */}
        <View style={fs.glowOverlay} pointerEvents="none" />

        {/* Close corner button */}
        <TouchableOpacity
          style={[fs.closeBtn, { top: insets.top + 16 }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={fs.closeBtnText}>↙ Réduire</Text>
        </TouchableOpacity>

        {/* Center content */}
        <View style={fs.center}>
          {/* Timer circle */}
          <View
            style={[fs.circleWrap, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}
          >
            <PulseRing
              size={CIRCLE_SIZE + 40}
              color="rgba(167,139,250,0.22)"
              delay={0}
            />
            <PulseRing
              size={CIRCLE_SIZE + 80}
              color="rgba(167,139,250,0.12)"
              delay={700}
            />
            <PulseRing
              size={CIRCLE_SIZE + 130}
              color="rgba(167,139,250,0.06)"
              delay={1400}
            />
            <ProgressCircle
              progress={progress}
              size={CIRCLE_SIZE}
              strokeWidth={STROKE}
              color={Colors.purple[300]}
            />
            <View style={fs.circleInner}>
              <Text style={fs.timeLabel}>{formatTime(remaining)}</Text>
              <Text style={fs.timeCaption}>restant</Text>
            </View>
          </View>

          {/* Title */}
          <View style={fs.titleBlock}>
            <View style={fs.focusBadge}>
              <View style={fs.focusDot} />
              <Text style={fs.focusBadgeText}>MODE FOCUS ACTIF</Text>
            </View>
            <Text style={fs.profileName}>
              {status?.profileName ?? "Règles globales"}
            </Text>
          </View>

          {/* Stats row */}
          <View style={fs.statsRow}>
            <View style={fs.statBox}>
              <Text style={fs.statNum}>{blockedCount}</Text>
              <Text style={fs.statLabel}>apps bloquées</Text>
            </View>
            <View style={fs.statSep} />
            <View style={fs.statBox}>
              <Text style={fs.statNum}>
                {totalDuration ? Math.round(totalDuration / 60000) : "—"}
              </Text>
              <Text style={fs.statLabel}>min prévues</Text>
            </View>
            <View style={fs.statSep} />
            <View style={fs.statBox}>
              <Text style={fs.statNum}>VPN</Text>
              <Text style={[fs.statLabel, { color: "#34d399" }]}>actif</Text>
            </View>
          </View>

          {/* Warning */}
          <View style={fs.warnRow}>
            <Text style={fs.warnText}>
              Le VPN reste verrouillé pendant la session
            </Text>
          </View>

          {/* Hold to stop */}
          <HoldToStop onStopped={handleStop} />
        </View>

        {/* Bottom motif */}
        <View style={[fs.bottomMotif, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={fs.motifText}>NetOff · contrôle réseau local</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#060C1E",
    alignItems: "center",
    justifyContent: "center",
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    // Simulated radial — a very dark purple tint in the center zone
    borderRadius: 0,
    opacity: 0.6,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.2,
  },
  center: {
    alignItems: "center",
    gap: 36,
    paddingHorizontal: 32,
  },
  circleWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  circleInner: {
    alignItems: "center",
    gap: 4,
  },
  timeLabel: {
    fontSize: 54,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
    lineHeight: 60,
  },
  timeCaption: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  titleBlock: {
    alignItems: "center",
    gap: 10,
  },
  focusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: "rgba(167,139,250,0.14)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
  },
  focusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.purple[300],
  },
  focusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.purple[300],
    letterSpacing: 1.5,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    overflow: "hidden",
  },
  statBox: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
    gap: 3,
  },
  statNum: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.3,
  },
  statSep: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  warnRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.18)",
  },
  warnText: {
    fontSize: 12,
    color: "rgba(248,113,113,0.75)",
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  bottomMotif: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
  },
  motifText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.12)",
    letterSpacing: 1.2,
    fontWeight: "600",
  },
});
