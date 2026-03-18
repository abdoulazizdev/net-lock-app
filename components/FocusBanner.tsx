import FocusService, { FocusStatus } from "@/services/focus.service";
import { Colors, useTheme } from "@/theme";
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

function PulseDot() {
  const { t } = useTheme();
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
        style={[
          fb.dotGlow,
          {
            backgroundColor: t.allowed.accent + "40",
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />
      <View style={[fb.dot, { backgroundColor: t.allowed.accent }]} />
    </View>
  );
}

export default function FocusBanner({ status, onStopped }: Props) {
  const { t } = useTheme();
  const [remaining, setRemaining] = useState(status.remainingMs);
  const [holding, setHolding] = useState(false);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdRef = useRef<Animated.CompositeAnimation | null>(null);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        {
          backgroundColor: t.focus.bg,
          borderColor: t.focus.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[fb.sessionTrack, { backgroundColor: t.border.light }]}>
        <Animated.View
          style={[
            fb.sessionFill,
            { width: `${pct}%`, backgroundColor: t.focus.accent },
          ]}
        />
      </View>
      <View style={fb.content}>
        <View style={fb.left}>
          <View style={fb.liveRow}>
            <PulseDot />
            <Text style={[fb.liveLabel, { color: t.allowed.text }]}>
              FOCUS ACTIF
            </Text>
          </View>
          <Text
            style={[fb.profileName, { color: t.text.primary }]}
            numberOfLines={1}
          >
            {status.profileName}
          </Text>
          <Text style={[fb.subInfo, { color: t.text.secondary }]}>
            {status.packages.length} app{status.packages.length > 1 ? "s" : ""}{" "}
            bloquée{status.packages.length > 1 ? "s" : ""}
          </Text>
        </View>
        <View style={fb.center}>
          <Text style={[fb.timer, { color: t.text.primary }]}>{timeStr}</Text>
          <Text style={[fb.timerLabel, { color: t.focus.accent }]}>
            restant
          </Text>
          <View style={fb.pctRow}>
            <View style={[fb.pctTrack, { backgroundColor: t.border.light }]}>
              <View
                style={[
                  fb.pctFill,
                  { width: `${pct}%`, backgroundColor: t.focus.accent },
                ]}
              />
            </View>
            <Text style={[fb.pctText, { color: t.text.muted }]}>{pct}%</Text>
          </View>
        </View>
        <View style={fb.right}>
          <TouchableOpacity
            style={[
              fb.stopBtn,
              {
                backgroundColor: t.danger.bg,
                borderColor: holding ? t.danger.accent : t.danger.border,
              },
            ]}
            onPressIn={startHold}
            onPressOut={cancelHold}
            activeOpacity={1}
          >
            <Animated.View
              style={[
                fb.holdFill,
                {
                  width: progressWidth,
                  backgroundColor: t.danger.accent + "30",
                },
              ]}
            />
            <Text style={[fb.stopIcon, { color: t.danger.accent }]}>◼</Text>
            <Text
              style={[
                fb.stopLabel,
                { color: holding ? t.danger.text : t.text.muted },
              ]}
            >
              {holding ? "..." : "Stop"}
            </Text>
          </TouchableOpacity>
          <Text style={[fb.holdHint, { color: t.text.muted }]}>
            {holding ? "Maintenir 5s" : "Maintenir\npour stop"}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const fb = StyleSheet.create({
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: Colors.purple[400],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionTrack: { height: 3 },
  sessionFill: { height: 3, borderRadius: 2 },
  content: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
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
  dot: { width: 6, height: 6, borderRadius: 3, position: "absolute" },
  dotGlow: { width: 10, height: 10, borderRadius: 5, position: "absolute" },
  liveLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  profileName: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  subInfo: { fontSize: 10 },
  center: { alignItems: "center", paddingHorizontal: 4 },
  timer: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  timerLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 1,
    marginBottom: 6,
  },
  pctRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pctTrack: { width: 52, height: 3, borderRadius: 2, overflow: "hidden" },
  pctFill: { height: 3, borderRadius: 2 },
  pctText: { fontSize: 9, fontWeight: "600" },
  right: { alignItems: "center", gap: 5 },
  stopBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  holdFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  stopIcon: { fontSize: 16, marginBottom: 2 },
  stopLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  holdHint: {
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 12,
  },
});
