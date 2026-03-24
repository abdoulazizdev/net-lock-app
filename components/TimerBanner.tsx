/**
 * TimerBanner.tsx — Bannière simple pour la Minuterie rapide
 *
 * DIFFÉRENCES vs FocusBanner (Focus mode) :
 * - Bouton STOP simple (tap direct, pas de hold 5s)
 * - Couleur orange/ambre (vs purple pour Focus)
 * - Texte "Minuterie" (vs "Session Focus")
 * - Pas de fullscreen
 * - Message : "Tap pour annuler" (vs "Maintenir 5s pour arrêter")
 */

import TimerService, { TimerStatus } from "@/services/timer.service";
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
  status: TimerStatus;
  onStopped: () => void;
}

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.8,
            duration: 800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 800,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  }, []);
  return (
    <View style={tb.dotWrap}>
      <Animated.View
        style={[
          tb.dotRing,
          { transform: [{ scale }], opacity, backgroundColor: color + "50" },
        ]}
      />
      <View style={[tb.dotCore, { backgroundColor: color }]} />
    </View>
  );
}

export default function TimerBanner({ status, onStopped }: Props) {
  const { t } = useTheme();
  const [label, setLabel] = useState(status.remainingLabel);
  const [stopping, setStopping] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Tick toutes les secondes
  useEffect(() => {
    const id = setInterval(async () => {
      const s = await TimerService.getStatus();
      if (!s.isActive) {
        clearInterval(id);
        onStopped();
        return;
      }
      setLabel(s.remainingLabel);
      // Barre de progression
      const pct = s.remainingMs / (status.durationMin * 60 * 1000);
      Animated.timing(progressAnim, {
        toValue: Math.max(0, pct),
        duration: 900,
        useNativeDriver: false,
      }).start();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleStop = async () => {
    if (stopping) return;
    setStopping(true);
    await TimerService.stop();
    onStopped();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const AMBER = Colors.amber[400];

  return (
    <View
      style={[
        tb.container,
        {
          backgroundColor: Colors.amber.dark50 ?? "#100C04",
          borderColor: Colors.amber.dark100 ?? "#3A2800",
        },
      ]}
    >
      {/* Barre de progression */}
      <View
        style={[tb.progressTrack, { backgroundColor: "rgba(245,166,35,0.12)" }]}
      >
        <Animated.View
          style={[
            tb.progressFill,
            { width: progressWidth, backgroundColor: AMBER },
          ]}
        />
      </View>

      <View style={tb.content}>
        {/* Gauche : dot + infos */}
        <View style={tb.left}>
          <PulseDot color={AMBER} />
          <View style={tb.info}>
            <View style={tb.topRow}>
              <Text style={[tb.label, { color: AMBER }]}>⏱ Minuterie</Text>
              <View
                style={[
                  tb.badge,
                  {
                    backgroundColor: "rgba(245,166,35,0.15)",
                    borderColor: "rgba(245,166,35,0.3)",
                  },
                ]}
              >
                <Text style={[tb.badgeText, { color: AMBER }]}>{label}</Text>
              </View>
            </View>
            <Text style={[tb.sub, { color: "rgba(245,166,35,0.55)" }]}>
              Tap pour annuler • Apps bloquées actives
            </Text>
          </View>
        </View>

        {/* Bouton STOP — tap simple, pas de hold ──────────────── */}
        <TouchableOpacity
          style={[
            tb.stopBtn,
            {
              backgroundColor: "rgba(245,166,35,0.18)",
              borderColor: "rgba(245,166,35,0.35)",
            },
            stopping && { opacity: 0.5 },
          ]}
          onPress={handleStop}
          disabled={stopping}
          activeOpacity={0.7}
        >
          <Text style={[tb.stopText, { color: AMBER }]}>
            {stopping ? "…" : "■ Stop"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  container: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  progressTrack: { height: 2 },
  progressFill: { height: "100%", borderRadius: 1 },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dotWrap: {
    width: 10,
    height: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dotCore: { width: 6, height: 6, borderRadius: 3, position: "absolute" },
  dotRing: { width: 10, height: 10, borderRadius: 5, position: "absolute" },
  info: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    fontFamily: "monospace",
  },
  sub: { fontSize: 10, fontWeight: "500" },
  stopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  stopText: { fontSize: 12, fontWeight: "800" },
});
