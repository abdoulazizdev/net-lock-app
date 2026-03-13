import FocusService, { FocusStatus } from "@/services/focus.service";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";

interface Props {
  status: FocusStatus;
  onStopped: () => void;
}

const HOLD_MS = 5000; // 5 secondes pour annuler

export default function FocusBanner({ status, onStopped }: Props) {
  const [remaining, setRemaining] = useState(status.remainingMs);
  const [holding, setHolding] = useState(false);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Pulsation du bandeau
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.015,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

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
  const timeStr = FocusService.formatRemaining(remaining);
  const pct =
    status.durationMinutes > 0
      ? Math.round(
          ((status.durationMinutes * 60000 - remaining) /
            (status.durationMinutes * 60000)) *
            100,
        )
      : 0;

  return (
    <Animated.View style={[fb.banner, { transform: [{ scaleX: pulseAnim }] }]}>
      {/* Barre de progression de la session */}
      <View style={fb.sessionTrack}>
        <View style={[fb.sessionFill, { width: `${pct}%` }]} />
      </View>

      <View style={fb.content}>
        {/* Info gauche */}
        <View style={fb.left}>
          <View style={fb.row}>
            <View style={fb.dot} />
            <Text style={fb.liveLabel}>FOCUS ACTIF</Text>
          </View>
          <Text style={fb.profileName}>{status.profileName}</Text>
          <Text style={fb.subInfo}>{status.packages.length} apps bloquées</Text>
        </View>

        {/* Chrono */}
        <View style={fb.center}>
          <Text style={fb.timer}>{timeStr}</Text>
          <Text style={fb.timerLabel}>restant</Text>
        </View>

        {/* Bouton stop (hold) */}
        <View style={fb.right}>
          <TouchableOpacity
            style={[fb.stopBtn, holding && fb.stopBtnHolding]}
            onPressIn={startHold}
            onPressOut={cancelHold}
            activeOpacity={1}
          >
            {/* Barre de progression du hold */}
            <Animated.View style={[fb.holdFill, { width: progressWidth }]} />
            <Text style={fb.stopIcon}>⏹</Text>
            <Text style={fb.stopLabel}>
              {holding ? "Maintenir..." : "Stop"}
            </Text>
          </TouchableOpacity>
          {holding && <Text style={fb.holdHint}>Maintenir 5s</Text>}
        </View>
      </View>
    </Animated.View>
  );
}

const ACCENT = "#7B6EF6";
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
  sessionTrack: { height: 3, backgroundColor: "#1C1C2C" },
  sessionFill: { height: 3, backgroundColor: ACCENT, borderRadius: 2 },
  content: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  left: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#3DDB8A" },
  liveLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#3DDB8A",
    letterSpacing: 1.5,
  },
  profileName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#E8E8F8",
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  subInfo: { fontSize: 10, color: "#4A3F8A" },
  center: { alignItems: "center" },
  timer: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F0F0FF",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  timerLabel: {
    fontSize: 9,
    color: "#4A3F8A",
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 2,
  },
  right: { alignItems: "center", gap: 4 },
  stopBtn: {
    width: 60,
    height: 60,
    borderRadius: 16,
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
    backgroundColor: RED + "33",
  },
  stopIcon: { fontSize: 18, marginBottom: 2 },
  stopLabel: {
    fontSize: 9,
    color: "#D04070",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  holdHint: {
    fontSize: 9,
    color: "#D04070",
    fontWeight: "600",
    textAlign: "center",
  },
});
