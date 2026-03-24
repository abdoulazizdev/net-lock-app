import FocusService, { FocusStatus } from "@/services/focus.service";
import { Colors, useTheme } from "@/theme";
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

// ─── Pulsing rings ─────────────────────────────────────────────────────────────
const PulseRing = React.memo(function PulseRing({
  size,
  color,
  delay = 0,
}: {
  size: number;
  color: string;
  delay?: number;
}) {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.55,
            duration: 2600,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2600,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.82,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.55,
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
        borderWidth: 1,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
});

// ─── Countdown hook ────────────────────────────────────────────────────────────
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

// ─── Progress arc (border trick) ──────────────────────────────────────────────
function ProgressArc({
  progress,
  size,
  stroke,
  color,
  trackColor,
}: {
  progress: number;
  size: number;
  stroke: number;
  color: string;
  trackColor: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, position: "absolute" }}>
      {/* Track */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: trackColor,
        }}
      />
      {/* Arc segments — quarter by quarter for smooth appearance */}
      {p > 0 && (
        <View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: color,
            borderTopColor: p >= 0.125 ? color : "transparent",
            borderRightColor: p >= 0.375 ? color : "transparent",
            borderBottomColor: p >= 0.625 ? color : "transparent",
            borderLeftColor: p >= 0.875 ? color : "transparent",
            opacity: 0.9,
            transform: [{ rotate: "-90deg" }],
          }}
        />
      )}
    </View>
  );
}

// ─── Tick marks around circle ─────────────────────────────────────────────────
function TickMarks({
  size,
  count = 60,
  color,
  progress,
}: {
  size: number;
  count?: number;
  color: string;
  progress: number;
}) {
  const ticks = Array.from({ length: count }, (_, i) => i);
  const r = size / 2;
  return (
    <View
      style={{
        position: "absolute",
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
      pointerEvents="none"
    >
      {ticks.map((i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const isMajor = i % 5 === 0;
        const tickLen = isMajor ? 10 : 5;
        const innerR = r - tickLen - 4;
        const outerR = r - 4;
        const x1 = r + innerR * Math.cos(angle);
        const y1 = r + innerR * Math.sin(angle);
        const active = i / count <= progress;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: isMajor ? 2 : 1,
              height: tickLen,
              backgroundColor: active ? color : color + "22",
              borderRadius: 1,
              left: x1 - (isMajor ? 1 : 0.5),
              top: y1 - tickLen / 2,
              transform: [{ rotate: `${(i / count) * 360}deg` }],
              transformOrigin: `${isMajor ? 1 : 0.5}px ${tickLen / 2}px`,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Hold-to-stop button ───────────────────────────────────────────────────────
function HoldToStop({
  onStopped,
  isDark,
}: {
  onStopped: () => void;
  isDark: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);
  const [ready, setReady] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const HOLD_DURATION = 1800;

  const startHold = useCallback(() => {
    setHolding(true);
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
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
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
    Animated.timing(progress, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const borderColor = isDark ? "rgba(248,113,113,0.25)" : "rgba(220,38,38,0.2)";
  const bgColor = isDark ? "rgba(248,113,113,0.06)" : "rgba(220,38,38,0.05)";
  const fillColor = isDark ? "rgba(248,113,113,0.22)" : "rgba(220,38,38,0.15)";
  const textColor = isDark ? "rgba(248,113,113,0.7)" : "rgba(185,28,28,0.75)";

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={startHold}
        onPressOut={cancelHold}
        activeOpacity={1}
        style={[
          hts.wrap,
          {
            borderColor,
            backgroundColor: bgColor,
          },
        ]}
      >
        <Animated.View
          style={[hts.fill, { width, backgroundColor: fillColor }]}
        />
        <View style={hts.inner}>
          <Text style={[hts.icon, { color: textColor }]}>
            {ready ? "✓" : "◼"}
          </Text>
          <Text style={[hts.label, { color: textColor }]}>
            {ready
              ? "Arrêt en cours…"
              : holding
                ? "Maintenir…"
                : "Maintenir pour arrêter"}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const hts = StyleSheet.create({
  wrap: {
    width: 260,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 27,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 1,
  },
  icon: {
    fontSize: 11,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

// ─── Theme toggle button ───────────────────────────────────────────────────────
function ThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const bg = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const iconColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(30,30,60,0.55)";

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75}>
      <Animated.View
        style={[
          tt.btn,
          {
            backgroundColor: bg,
            borderColor: border,
            transform: [{ rotate }],
          },
        ]}
      >
        <Text style={[tt.icon, { color: iconColor }]}>
          {isDark ? "☀" : "◑"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const tt = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: { fontSize: 15 },
});

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  value,
  label,
  accent,
  isDark,
}: {
  value: string;
  label: string;
  accent?: string;
  isDark: boolean;
}) {
  const bg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const border = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const valColor =
    accent || (isDark ? "rgba(255,255,255,0.88)" : "rgba(10,10,40,0.85)");
  const lblColor = isDark ? "rgba(255,255,255,0.32)" : "rgba(10,10,40,0.38)";

  return (
    <View style={[sc.card, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[sc.value, { color: valColor }]}>{value}</Text>
      <Text style={[sc.label, { color: lblColor }]}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  label: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
});

// ─── Main FocusFullScreen ──────────────────────────────────────────────────────
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
  const { isDark, toggle } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [stopping, setStopping] = useState(false);

  // ── Enter/exit animation ──────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // ── Timer ─────────────────────────────────────────────────────────────
  const endTime = status?.endTime ? new Date(status.endTime).getTime() : null;
  const totalDuration =
    status?.durationMinutes != null ? status.durationMinutes * 60 * 1000 : null;
  const remaining = useCountdown(endTime);
  const progress =
    totalDuration && remaining > 0 ? 1 - remaining / totalDuration : 0;

  // ── Stop ──────────────────────────────────────────────────────────────
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
  const totalMin = totalDuration ? Math.round(totalDuration / 60000) : 0;
  const elapsedMin =
    totalDuration && remaining >= 0
      ? Math.round((totalDuration - remaining) / 60000)
      : 0;

  // ── Theming ───────────────────────────────────────────────────────────
  const CIRCLE_SIZE = 230;
  const STROKE = 5;

  // Backgrounds
  const pageBg = isDark ? "#06081A" : "#F0F2FB";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)";
  const cardBorder = isDark
    ? "rgba(255,255,255,0.07)"
    : "rgba(200,210,240,0.8)";

  // Colors
  const accentColor = isDark ? Colors.purple[300] : Colors.purple[500];
  const accentBg = isDark ? "rgba(167,139,250,0.12)" : "rgba(139,115,245,0.1)";
  const accentBorder = isDark
    ? "rgba(167,139,250,0.28)"
    : "rgba(139,115,245,0.25)";
  const trackColor = isDark
    ? "rgba(255,255,255,0.06)"
    : "rgba(120,100,220,0.08)";

  const titleColor = isDark ? "rgba(255,255,255,0.92)" : "rgba(15,10,50,0.88)";
  const subtitleColor = isDark
    ? "rgba(255,255,255,0.38)"
    : "rgba(60,50,120,0.45)";
  const captionColor = isDark
    ? "rgba(255,255,255,0.28)"
    : "rgba(80,70,140,0.38)";

  const closeBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const closeBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.09)";
  const closeTextColor = isDark
    ? "rgba(255,255,255,0.4)"
    : "rgba(20,10,60,0.38)";

  const warnBg = isDark ? "rgba(248,113,113,0.07)" : "rgba(220,38,38,0.05)";
  const warnBorder = isDark ? "rgba(248,113,113,0.16)" : "rgba(220,38,38,0.12)";
  const warnTextColor = isDark
    ? "rgba(248,113,113,0.65)"
    : "rgba(185,28,28,0.65)";

  const motifColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";

  const pulseColor1 = isDark
    ? "rgba(139,115,245,0.18)"
    : "rgba(139,115,245,0.12)";
  const pulseColor2 = isDark
    ? "rgba(139,115,245,0.09)"
    : "rgba(139,115,245,0.06)";
  const pulseColor3 = isDark
    ? "rgba(139,115,245,0.04)"
    : "rgba(139,115,245,0.03)";

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
          {
            backgroundColor: pageBg,
            opacity: fadeAnim,
          },
        ]}
      >
        {/* ── Subtle ambient gradient blobs ── */}
        <View
          pointerEvents="none"
          style={[
            fs.blob1,
            {
              backgroundColor: isDark
                ? "rgba(100,80,200,0.07)"
                : "rgba(130,100,240,0.06)",
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            fs.blob2,
            {
              backgroundColor: isDark
                ? "rgba(50,200,150,0.04)"
                : "rgba(50,180,130,0.04)",
            },
          ]}
        />

        {/* ── Top bar ── */}
        <Animated.View
          style={[
            fs.topBar,
            {
              paddingTop: insets.top + 14,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Status badge */}
          <View
            style={[
              fs.statusBadge,
              { backgroundColor: accentBg, borderColor: accentBorder },
            ]}
          >
            <View style={[fs.statusDot, { backgroundColor: accentColor }]} />
            <Text style={[fs.statusText, { color: accentColor }]}>
              FOCUS ACTIF
            </Text>
          </View>

          {/* Controls */}
          <View style={fs.topControls}>
            <ThemeToggle isDark={isDark} onToggle={toggle} />
            <TouchableOpacity
              style={[
                fs.closeBtn,
                { backgroundColor: closeBg, borderColor: closeBorder },
              ]}
              onPress={onClose}
              activeOpacity={0.75}
            >
              <Text style={[fs.closeBtnIcon, { color: closeTextColor }]}>
                ↙
              </Text>
              <Text style={[fs.closeBtnText, { color: closeTextColor }]}>
                Réduire
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Center content ── */}
        <Animated.View
          style={[fs.center, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Timer circle */}
          <View
            style={[fs.circleWrap, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}
          >
            <PulseRing size={CIRCLE_SIZE + 36} color={pulseColor1} delay={0} />
            <PulseRing
              size={CIRCLE_SIZE + 72}
              color={pulseColor2}
              delay={800}
            />
            <PulseRing
              size={CIRCLE_SIZE + 120}
              color={pulseColor3}
              delay={1600}
            />

            <ProgressArc
              progress={progress}
              size={CIRCLE_SIZE}
              stroke={STROKE}
              color={accentColor}
              trackColor={trackColor}
            />

            {/* Circle background */}
            <View
              style={[
                fs.circleBackground,
                {
                  width: CIRCLE_SIZE - STROKE * 2 - 16,
                  height: CIRCLE_SIZE - STROKE * 2 - 16,
                  borderRadius: (CIRCLE_SIZE - STROKE * 2 - 16) / 2,
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                },
              ]}
            />

            {/* Time display */}
            <View style={fs.circleInner}>
              <Text style={[fs.timeLabel, { color: titleColor }]}>
                {formatTime(remaining)}
              </Text>
              <Text style={[fs.timeCaption, { color: captionColor }]}>
                RESTANT
              </Text>
              {totalMin > 0 && (
                <View
                  style={[
                    fs.progressPill,
                    { backgroundColor: accentBg, borderColor: accentBorder },
                  ]}
                >
                  <Text style={[fs.progressPillText, { color: accentColor }]}>
                    {elapsedMin}′ / {totalMin}′
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Profile name */}
          <View style={fs.titleBlock}>
            <Text style={[fs.profileName, { color: titleColor }]}>
              {status?.profileName ?? "Règles globales"}
            </Text>
            <Text style={[fs.profileSub, { color: subtitleColor }]}>
              Session verrouillée · VPN actif
            </Text>
          </View>

          {/* Stats row */}
          <View style={fs.statsRow}>
            <StatCard
              value={String(blockedCount)}
              label={"Apps\nbloquées"}
              isDark={isDark}
            />
            <StatCard
              value={String(totalMin)}
              label={"Minutes\nprévues"}
              isDark={isDark}
            />
            <StatCard
              value="VPN"
              label={"Réseau\nactif"}
              accent="#34d399"
              isDark={isDark}
            />
          </View>

          {/* Warning row */}
          <View
            style={[
              fs.warnRow,
              { backgroundColor: warnBg, borderColor: warnBorder },
            ]}
          >
            <Text style={[fs.warnIcon, { color: warnTextColor }]}>◈</Text>
            <Text style={[fs.warnText, { color: warnTextColor }]}>
              Impossible de désactiver le VPN pendant la session
            </Text>
          </View>

          {/* Hold to stop */}
          <HoldToStop onStopped={handleStop} isDark={isDark} />
        </Animated.View>

        {/* ── Footer ── */}
        <View style={[fs.footer, { paddingBottom: insets.bottom + 20 }]}>
          <View
            style={[
              fs.footerLine,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.06)",
              },
            ]}
          />
          <Text style={[fs.footerText, { color: motifColor }]}>
            NetOff · contrôle réseau local
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  blob1: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    top: -80,
    left: -100,
    opacity: 1,
  },
  blob2: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: 40,
    right: -80,
  },
  topBar: {
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  topControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  closeBtnIcon: {
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    paddingHorizontal: 28,
    width: "100%",
  },
  circleWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  circleBackground: {
    position: "absolute",
    borderWidth: 1,
  },
  circleInner: {
    alignItems: "center",
    gap: 5,
    zIndex: 1,
  },
  timeLabel: {
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -3,
    lineHeight: 62,
  },
  timeCaption: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
  },
  progressPill: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  progressPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  titleBlock: {
    alignItems: "center",
    gap: 6,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  profileSub: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
  },
  warnIcon: {
    fontSize: 13,
  },
  warnText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  footer: {
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  footerLine: {
    width: 36,
    height: 3,
    borderRadius: 2,
  },
  footerText: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "600",
  },
});
