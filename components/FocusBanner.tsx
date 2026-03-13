import FocusService, { FocusStatus } from "@/services/focus.service";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

interface Props {
  status: FocusStatus;
  onStopped: () => void;
}

const HOLD_MS = 5000;

// ─── Animated PulseDot ────────────────────────────────────────────────────────
function PulseDot() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.6,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <View style={fb.dotWrap}>
      <Animated.View
        style={[fb.dotGlow, { transform: [{ scale: scaleAnim }] }]}
      />
      <View style={fb.dot} />
    </View>
  );
}

export default function FocusBanner({ status, onStopped }: Props) {
  const [remaining, setRemaining] = useState(status.remainingMs);
  const [holding, setHolding] = useState(false);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdRef = useRef<Animated.CompositeAnimation | null>(null);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Entrée animée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Compte à rebours
  useEffect(() => {
    setRemaining(status.remainingMs);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status.remainingMs]);

  const startHold = () => {
    setHolding(true);
    holdAnim.setValue(0);
    holdRef.current = Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    });
    holdRef.current.start(({ finished }) => {
      if (finished) handleForceStop();
    });
  };
  const cancelHold = () => {
    holdRef.current?.stop();
    holdAnim.setValue(0);
    setHolding(false);
  };
  const handleForceStop = async () => {
    setHolding(false);
    holdAnim.setValue(0);
    await FocusService.stopFocus();
    onStopped();
  };

  const progressWidth = holdAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const totalMs = status.durationMinutes * 60000;
  const elapsed = totalMs - remaining;
  const pct =
    totalMs > 0 ? Math.min(100, Math.round((elapsed / totalMs) * 100)) : 0;
  const timeStr = FocusService.formatRemaining(remaining);

  return (
    <Animated.View
      style={[
        fb.banner,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Session progress bar */}
      <View style={fb.sessionTrack}>
        <Animated.View style={[fb.sessionFill, { width: `${pct}%` }]} />
      </View>

      <View style={fb.content}>
        {/* Left — profile info */}
        <View style={fb.left}>
          <View style={fb.liveRow}>
            <PulseDot />
            <Text style={fb.liveLabel}>FOCUS ACTIF</Text>
          </View>
          <Text style={fb.profileName} numberOfLines={1}>
            {status.profileName}
          </Text>
          <Text style={fb.subInfo}>
            {status.packages.length} app{status.packages.length > 1 ? "s" : ""}{" "}
            bloquée{status.packages.length > 1 ? "s" : ""}
          </Text>
        </View>

        {/* Center — timer */}
        <View style={fb.center}>
          <Text style={fb.timer}>{timeStr}</Text>
          <Text style={fb.timerLabel}>restant</Text>
          <View style={fb.pctRow}>
            <View style={fb.pctTrack}>
              <View style={[fb.pctFill, { width: `${pct}%` }]} />
            </View>
            <Text style={fb.pctText}>{pct}%</Text>
          </View>
        </View>

        {/* Right — stop button */}
        <View style={fb.right}>
          <TouchableOpacity
            style={[fb.stopBtn, holding && fb.stopBtnHolding]}
            onPressIn={startHold}
            onPressOut={cancelHold}
            activeOpacity={1}
          >
            <Animated.View style={[fb.holdFill, { width: progressWidth }]} />
            <Text style={fb.stopIcon}>◼</Text>
            <Text style={[fb.stopLabel, holding && fb.stopLabelHolding]}>
              {holding ? "..." : "Stop"}
            </Text>
          </TouchableOpacity>
          <Text style={fb.holdHint}>
            {holding ? "Maintenir 5s" : "Maintenir\npour stop"}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const ACCENT = "#7B6EF6";
const GREEN = "#3DDB8A";
const RED = "#D04070";

const fb = StyleSheet.create({
  banner: {
    backgroundColor: "#16103A",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#4A3F8A",
    overflow: "hidden",
    marginBottom: 14,
  },
  sessionTrack: { height: 2, backgroundColor: "#1C1C2C" },
  sessionFill: { height: 2, backgroundColor: ACCENT, borderRadius: 2 },
  content: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },

  // Left
  left: { flex: 1, minWidth: 0 },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  dotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    position: "absolute",
  },
  dotGlow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GREEN + "40",
    position: "absolute",
  },
  liveLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: GREEN,
    letterSpacing: 1.5,
  },
  profileName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#E8E8F8",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  subInfo: { fontSize: 10, color: "#5A5480" },

  // Center
  center: { alignItems: "center", paddingHorizontal: 4 },
  timer: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  timerLabel: {
    fontSize: 8,
    color: "#4A3F8A",
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 1,
    marginBottom: 6,
  },
  pctRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pctTrack: {
    width: 52,
    height: 3,
    backgroundColor: "#1C1C2C",
    borderRadius: 2,
    overflow: "hidden",
  },
  pctFill: { height: 3, backgroundColor: ACCENT, borderRadius: 2 },
  pctText: { fontSize: 9, color: "#5A5480", fontWeight: "600" },

  // Right
  right: { alignItems: "center", gap: 5 },
  stopBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#14080A",
    borderWidth: 1,
    borderColor: "#2A1520",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  stopBtnHolding: { borderColor: RED },
  holdFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: RED + "30",
  },
  stopIcon: { fontSize: 16, color: RED, marginBottom: 2 },
  stopLabel: {
    fontSize: 8,
    color: "#5A3040",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  stopLabelHolding: { color: RED },
  holdHint: {
    fontSize: 8,
    color: "#3A3060",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 12,
  },
});
