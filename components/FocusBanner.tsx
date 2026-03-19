/**
 * FocusBanner — deux exports :
 *
 *   default FocusBanner       — bannière compacte dans le ListHeader
 *   FocusFullScreen           — overlay plein écran, à rendre à la RACINE
 *                               du HomeScreen (hors FlatList) pour éviter le clipping
 *
 * useFocusSession             — hook partagé (décompte, hold, pct)
 */
import FocusService, { FocusStatus } from "@/services/focus.service";
import { Colors, useTheme } from "@/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FocusBannerProps {
  status: FocusStatus;
  onStopped: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

const HOLD_MS = 5000;
const { width: SW, height: SH } = Dimensions.get("window");

// ─── AnimatedBackground ───────────────────────────────────────────────────────
// Orbes flottants apaisants — utilisés dans FocusFullScreen.
// Chaque orbe est un cercle translucide animé (scale + translate + opacity).
// useNativeDriver:true → smooth 60fps même sur ancien Android.

interface OrbConfig {
  size: number;
  startX: number; // position initiale (ratio 0–1 de SW)
  startY: number; // position initiale (ratio 0–1 de SH)
  driftX: number; // amplitude de dérive horizontale
  driftY: number; // amplitude de dérive verticale
  duration: number; // durée d'un aller (ms)
  delay: number; // délai avant départ (ms)
  color: string; // couleur de base (hex sans alpha)
  opacity: number; // opacité max de l'orbe
  scaleMin: number;
  scaleMax: number;
}

function Orb({ cfg }: { cfg: OrbConfig }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(cfg.scaleMin)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade-in doux
    Animated.timing(opacity, {
      toValue: cfg.opacity,
      duration: 1200,
      delay: cfg.delay,
      useNativeDriver: true,
    }).start();

    // Dérive X (aller-retour en boucle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: cfg.driftX,
          duration: cfg.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          delay: cfg.delay,
        }),
        Animated.timing(translateX, {
          toValue: -cfg.driftX,
          duration: cfg.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: cfg.duration * 0.6,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Dérive Y (phase décalée pour trajectoire naturelle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -cfg.driftY,
          duration: cfg.duration * 1.3,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          delay: cfg.delay,
        }),
        Animated.timing(translateY, {
          toValue: cfg.driftY,
          duration: cfg.duration * 0.9,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: cfg.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Respiration (scale)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: cfg.scaleMax,
          duration: cfg.duration * 1.1,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          delay: cfg.delay,
        }),
        Animated.timing(scale, {
          toValue: cfg.scaleMin,
          duration: cfg.duration * 0.9,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: cfg.startX * SW - cfg.size / 2,
        top: cfg.startY * SH - cfg.size / 2,
        width: cfg.size,
        height: cfg.size,
        borderRadius: cfg.size / 2,
        backgroundColor: cfg.color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

function AnimatedBackground({
  accentColor,
  isDark,
}: {
  accentColor: string;
  isDark: boolean;
}) {
  // Palette d'orbes — teintes bleues/violettes très transparentes
  // En mode nuit les orbes sont plus visibles (fond sombre)
  // En mode jour ils sont quasi invisibles (fond blanc)
  const a = isDark ? 0.07 : 0.04; // opacité max adaptée au thème

  const ORBS: OrbConfig[] = [
    // Grand orbe central lent — ancre visuelle
    {
      size: SW * 0.9,
      startX: 0.5,
      startY: 0.35,
      driftX: 18,
      driftY: 22,
      duration: 9000,
      delay: 0,
      color: accentColor,
      opacity: a * 1.2,
      scaleMin: 0.85,
      scaleMax: 1.05,
    },
    // Orbe haut-gauche
    {
      size: SW * 0.55,
      startX: 0.1,
      startY: 0.18,
      driftX: 28,
      driftY: 18,
      duration: 7800,
      delay: 600,
      color: accentColor,
      opacity: a,
      scaleMin: 0.9,
      scaleMax: 1.15,
    },
    // Orbe bas-droit
    {
      size: SW * 0.65,
      startX: 0.9,
      startY: 0.78,
      driftX: -22,
      driftY: -16,
      duration: 8500,
      delay: 1200,
      color: accentColor,
      opacity: a,
      scaleMin: 0.88,
      scaleMax: 1.1,
    },
    // Petit orbe accent haut-droit
    {
      size: SW * 0.38,
      startX: 0.85,
      startY: 0.22,
      driftX: -14,
      driftY: 26,
      duration: 6200,
      delay: 300,
      color: accentColor,
      opacity: a * 0.9,
      scaleMin: 0.92,
      scaleMax: 1.18,
    },
    // Petit orbe bas-gauche
    {
      size: SW * 0.42,
      startX: 0.12,
      startY: 0.82,
      driftX: 20,
      driftY: -20,
      duration: 7200,
      delay: 900,
      color: accentColor,
      opacity: a * 0.8,
      scaleMin: 0.85,
      scaleMax: 1.12,
    },
    // Micro orbe milieu-droite
    {
      size: SW * 0.28,
      startX: 0.78,
      startY: 0.5,
      driftX: -16,
      driftY: 30,
      duration: 5800,
      delay: 400,
      color: accentColor,
      opacity: a * 0.6,
      scaleMin: 0.9,
      scaleMax: 1.2,
    },
  ];

  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {ORBS.map((cfg, i) => (
        <Orb key={i} cfg={cfg} />
      ))}
    </View>
  );
}

// ─── useFocusSession — logique partagée ──────────────────────────────────────
export function useFocusSession(status: FocusStatus, onStopped: () => void) {
  const [remaining, setRemaining] = useState(status.remainingMs);
  const [holding, setHolding] = useState(false);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    setRemaining(status.remainingMs);
    const iv = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(iv);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
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
      if (finished) doStop();
    });
  };
  const cancelHold = () => {
    holdRef.current?.stop();
    holdAnim.setValue(0);
    setHolding(false);
  };
  const doStop = async () => {
    setHolding(false);
    holdAnim.setValue(0);
    await FocusService.stopFocus();
    onStopped();
  };

  const totalMs = status.durationMinutes * 60000;
  const elapsed = totalMs - remaining;
  const pct =
    totalMs > 0 ? Math.min(100, Math.round((elapsed / totalMs) * 100)) : 0;
  const timeStr = FocusService.formatRemaining(remaining);

  return { remaining, holding, holdAnim, startHold, cancelHold, pct, timeStr };
}

// ─── PulseDot ────────────────────────────────────────────────────────────────
function PulseDot({
  color,
  large = false,
}: {
  color: string;
  large?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  const dim = large ? 18 : 10;
  const core = large ? 9 : 6;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: large ? 2.2 : 1.6,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  }, []);

  return (
    <View
      style={{
        width: dim,
        height: dim,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: color + "50",
          transform: [{ scale }],
          opacity,
        }}
      />
      <View
        style={{
          width: core,
          height: core,
          borderRadius: core / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ─── StopButton ──────────────────────────────────────────────────────────────
function StopButton({
  holding,
  onPressIn,
  onPressOut,
  holdAnim,
  large = false,
}: {
  holding: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  holdAnim: Animated.Value;
  large?: boolean;
}) {
  const { t } = useTheme();
  const fillW = holdAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <TouchableOpacity
      style={[
        large ? fs.stopBtn : fb.stopBtn,
        {
          backgroundColor: t.danger.bg,
          borderColor: holding ? t.danger.accent : t.danger.border,
        },
      ]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            backgroundColor: t.danger.accent + "28",
          },
          { width: fillW },
        ]}
      />
      <Text
        style={[large ? fs.stopIcon : fb.stopIcon, { color: t.danger.accent }]}
      >
        ◼
      </Text>
      <Text
        style={[
          large ? fs.stopLabel : fb.stopLabel,
          { color: holding ? t.danger.text : t.text.muted },
        ]}
      >
        {holding ? "..." : "Stop"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────
// Technique sans transformOrigin (non fiable sur Android) :
//
// Chaque demi-cercle est UN cercle complet qui tourne autour de SON PROPRE
// centre, clipé dans un container de largeur R (moitié du cercle).
// Quand le cercle tourne, sa moitié visible dans le clip trace un arc.
//
//  Arc DROIT  (0 → 50%) : cercle dans clip gauche, tourne 0°→ 180°
//  Arc GAUCHE (50→100%) : cercle dans clip droit,  tourne 0°→-180°
//
// useNativeDriver:true — transform uniquement, aucune couleur animée.
function ProgressRing({
  pct,
  color,
  trackColor,
}: {
  pct: number;
  color: string;
  trackColor: string;
}) {
  const R = 100;
  const STR = 9;
  const D = R * 2;
  const SZ = D + STR * 2;
  const PAD = STR / 2; // espace autour du cercle dans le container

  const prog = useRef(new Animated.Value(pct / 100)).current;

  // Initialise sans animation au premier rendu
  useEffect(() => {
    prog.setValue(pct / 100);
  }, []);

  useEffect(() => {
    Animated.timing(prog, {
      toValue: pct / 100,
      duration: 480,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [pct]);

  // Arc droit : tourne de -180° (caché) à 0° (pleinement visible) sur 0→50%
  const rotRight = prog.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-180deg", "0deg", "0deg"],
    extrapolate: "clamp",
  });

  // Arc gauche : tourne de 0° (caché) à 180° (pleinement visible) sur 50→100%
  const rotLeft = prog.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "0deg", "180deg"],
    extrapolate: "clamp",
  });

  // Dot de tête (position trigonométrique JS, mis à jour chaque seconde)
  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
  const dotRad = R + STR / 2;
  const dotSz = STR + 4;
  const dotTop = SZ / 2 + dotRad * Math.sin(angle) - dotSz / 2;
  const dotLeft = SZ / 2 + dotRad * Math.cos(angle) - dotSz / 2;

  return (
    <View style={{ width: SZ, height: SZ }}>
      {/* ── Track gris complet ── */}
      <View
        style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          width: D,
          height: D,
          borderRadius: R,
          borderWidth: STR,
          borderColor: trackColor,
        }}
      />

      {/* ── Arc DROIT (0–50%) ─────────────────────────────────────────────────
          Le cercle coloré est positionné centré sur le bord droit du clip.
          Quand il tourne autour de son centre, sa moitié droite reste dans
          le clip et trace l'arc du bas vers le haut (sens horaire).        */}
      <View
        style={{
          position: "absolute",
          top: PAD,
          left: PAD + R, // clip = moitié droite (à partir du centre du cercle)
          width: R,
          height: D,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: -R, // cercle centré sur le bord gauche du clip = axe de rotation
            width: D,
            height: D,
            borderRadius: R,
            borderWidth: STR,
            borderTopColor: color,
            borderRightColor: color,
            borderBottomColor: color,
            borderLeftColor: color,
            transform: [{ rotate: rotRight }],
          }}
        />
      </View>

      {/* ── Arc GAUCHE (50–100%) ──────────────────────────────────────────────
          Même principe : le cercle est centré sur le bord droit du clip.   */}
      <View
        style={{
          position: "absolute",
          top: PAD,
          left: PAD, // clip = moitié gauche
          width: R,
          height: D,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0, // centre le cercle sur le bord droit du clip
            width: D,
            height: D,
            borderRadius: R,
            borderWidth: STR,
            borderTopColor: color,
            borderRightColor: color,
            borderBottomColor: color,
            borderLeftColor: color,
            transform: [{ rotate: rotLeft }],
          }}
        />
      </View>

      {/* ── Dot de départ fixe (12h) ── */}
      <View
        style={{
          position: "absolute",
          top: PAD - dotSz / 2 + 1,
          left: SZ / 2 - dotSz / 2,
          width: dotSz,
          height: dotSz,
          borderRadius: dotSz / 2,
          backgroundColor: color,
        }}
      />

      {/* ── Dot de tête mobile ── */}
      {pct > 1 && (
        <View
          style={{
            position: "absolute",
            top: dotTop,
            left: dotLeft,
            width: dotSz,
            height: dotSz,
            borderRadius: dotSz / 2,
            backgroundColor: color,
            elevation: 5,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 6,
          }}
        />
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BANNIÈRE COMPACTE (default export)
// ══════════════════════════════════════════════════════════════════════════════
export default function FocusBanner({
  status,
  onStopped,
  expanded,
  onToggleExpand,
}: FocusBannerProps) {
  const { t } = useTheme();
  const { holding, holdAnim, startHold, cancelHold, pct, timeStr } =
    useFocusSession(status, onStopped);

  const slideAnim = useRef(new Animated.Value(-70)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        fb.banner,
        { backgroundColor: t.focus.bg, borderColor: t.focus.border },
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Barre de progression */}
      <View style={[fb.bar, { backgroundColor: t.border.light }]}>
        <View
          style={[
            fb.barFill,
            { width: `${pct}%`, backgroundColor: t.focus.accent },
          ]}
        />
      </View>

      {/* Corps — tap ouvre le plein écran */}
      <TouchableOpacity
        style={fb.row}
        onPress={onToggleExpand}
        activeOpacity={0.82}
      >
        {/* Gauche */}
        <View style={fb.left}>
          <View style={fb.liveRow}>
            <PulseDot color={t.allowed.accent} />
            <Text style={[fb.liveLabel, { color: t.allowed.text }]}>
              FOCUS ACTIF
            </Text>
            <View
              style={[
                fb.expandBadge,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[fb.expandBadgeText, { color: t.text.muted }]}>
                ⌃
              </Text>
            </View>
          </View>
          <Text style={[fb.name, { color: t.text.primary }]} numberOfLines={1}>
            {status.profileName}
          </Text>
          <Text style={[fb.sub, { color: t.text.secondary }]}>
            {status.packages.length} app{status.packages.length > 1 ? "s" : ""}{" "}
            bloquée{status.packages.length > 1 ? "s" : ""}
          </Text>
        </View>

        {/* Centre — timer */}
        <View style={fb.center}>
          <Text style={[fb.timer, { color: t.text.primary }]}>{timeStr}</Text>
          <Text style={[fb.timerSub, { color: t.focus.accent }]}>restant</Text>
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

        {/* Droite — Stop */}
        <View style={fb.right}>
          <StopButton
            holding={holding}
            onPressIn={startHold}
            onPressOut={cancelHold}
            holdAnim={holdAnim}
          />
          <Text style={[fb.hint, { color: t.text.muted }]}>
            {holding ? "Maintenir 5s" : "Maintenir\npour stop"}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PLEIN ÉCRAN (named export — rendu à la racine du HomeScreen)
// ══════════════════════════════════════════════════════════════════════════════
export function FocusFullScreen({
  status,
  onStopped,
  visible,
  onClose,
}: {
  status: FocusStatus;
  onStopped: () => void;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { remaining, holding, holdAnim, startHold, cancelHold, pct, timeStr } =
    useFocusSession(status, onStopped);

  const fsAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fsAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 320 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const minsLeft = Math.ceil(remaining / 60000);
  const hoursLeft = Math.floor(minsLeft / 60);
  const minsPart = minsLeft % 60;

  const translateY = fsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  return (
    <Animated.View
      style={[
        fs.overlay,
        { backgroundColor: t.bg.page },
        { opacity: fsAnim, transform: [{ translateY }] },
      ]}
    >
      <StatusBar barStyle="light-content" />
      {/* ── Fond animé — orbes flottants apaisants ── */}
      <AnimatedBackground accentColor={t.focus.accent} isDark={isDark} />

      {/* Barre progression fine en haut */}
      <View style={[fs.topBar, { backgroundColor: t.border.light }]}>
        <View
          style={[
            fs.topBarFill,
            { width: `${pct}%`, backgroundColor: t.focus.accent },
          ]}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          fs.scroll,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Header ── */}
        <View style={fs.header}>
          <TouchableOpacity
            style={[
              fs.collapseBtn,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={[fs.collapseIcon, { color: t.text.muted }]}>⌄</Text>
            <Text style={[fs.collapseLabel, { color: t.text.muted }]}>
              Réduire
            </Text>
          </TouchableOpacity>
          <View
            style={[
              fs.liveBadge,
              { backgroundColor: t.focus.bg, borderColor: t.focus.border },
            ]}
          >
            <PulseDot color={t.focus.accent} large />
            <Text style={[fs.liveBadgeText, { color: t.focus.accent }]}>
              FOCUS ACTIF
            </Text>
          </View>
        </View>

        {/* ── Anneau de progression + timer centré ── */}
        <View style={fs.ringZone}>
          <ProgressRing
            pct={pct}
            color={t.focus.accent}
            trackColor={t.border.light}
          />
          {/* Timer superposé au centre de l'anneau */}
          <View style={fs.ringCenter} pointerEvents="none">
            <Text style={[fs.bigTimer, { color: t.text.primary }]}>
              {timeStr}
            </Text>
            <Text style={[fs.bigTimerLabel, { color: t.focus.accent }]}>
              restant
            </Text>
            <Text style={[fs.bigPct, { color: t.text.muted }]}>{pct}%</Text>
          </View>
        </View>

        {/* ── Stats ── */}
        <View
          style={[
            fs.statsCard,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <View style={fs.statsRow}>
            {[
              {
                value:
                  hoursLeft > 0 ? `${hoursLeft}h${minsPart}` : `${minsPart}`,
                unit: hoursLeft > 0 ? "" : " min",
                label: "restant",
                color: t.text.primary,
              },
              {
                value: String(status.packages.length),
                unit: "",
                label: `app${status.packages.length > 1 ? "s" : ""} bloquée${status.packages.length > 1 ? "s" : ""}`,
                color: t.blocked.accent,
              },
              {
                value: String(status.durationMinutes),
                unit: " min",
                label: "durée totale",
                color: t.text.primary,
              },
            ].map((item, i, arr) => (
              <React.Fragment key={i}>
                <View style={fs.statCell}>
                  <Text style={[fs.statNum, { color: item.color }]}>
                    {item.value}
                    <Text style={[fs.statUnit, { color: t.text.muted }]}>
                      {item.unit}
                    </Text>
                  </Text>
                  <Text style={[fs.statLabel, { color: t.text.muted }]}>
                    {item.label}
                  </Text>
                </View>
                {i < arr.length - 1 && (
                  <View
                    style={[
                      fs.statDivider,
                      { backgroundColor: t.border.light },
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Profil ── */}
        {!!status.profileName && (
          <View
            style={[
              fs.profilePill,
              { backgroundColor: t.bg.accent, borderColor: t.border.strong },
            ]}
          >
            <Text style={[fs.profileIcon, { color: t.text.link }]}>◉</Text>
            <Text
              style={[fs.profileName, { color: t.text.secondary }]}
              numberOfLines={1}
            >
              {status.profileName}
            </Text>
          </View>
        )}

        {/* ── Bouton Stop large ── */}
        <View style={fs.stopZone}>
          <StopButton
            holding={holding}
            onPressIn={startHold}
            onPressOut={cancelHold}
            holdAnim={holdAnim}
            large
          />
          <Text style={[fs.stopHint, { color: t.text.muted }]}>
            {holding ? "Encore un peu…" : "Maintenez 5 secondes pour arrêter"}
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ─── Styles bannière compacte ────────────────────────────────────────────────
const fb = StyleSheet.create({
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
    elevation: 2,
    shadowColor: Colors.purple[400],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bar: { height: 3 },
  barFill: { height: 3, borderRadius: 2 },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  left: { flex: 1, minWidth: 0 },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  liveLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  expandBadge: {
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
  },
  expandBadgeText: { fontSize: 10, fontWeight: "700" },
  name: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  sub: { fontSize: 10 },
  center: { alignItems: "center", paddingHorizontal: 4 },
  timer: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  timerSub: {
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
  stopIcon: { fontSize: 16, marginBottom: 2 },
  stopLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  hint: { fontSize: 8, fontWeight: "600", textAlign: "center", lineHeight: 12 },
});

// ─── Styles plein écran ───────────────────────────────────────────────────────
const fs = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 20,
  },
  topBar: { height: 3 },
  topBarFill: { height: 3, borderRadius: 2 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 36,
  },
  collapseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  collapseIcon: { fontSize: 15, fontWeight: "700" },
  collapseLabel: { fontSize: 12, fontWeight: "600" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  liveBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  // Anneau : le timer est superposé en absolu au centre
  ringZone: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    position: "relative",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  bigTimer: {
    fontSize: 50,
    fontWeight: "800",
    letterSpacing: -3,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  bigTimerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 2,
    textAlign: "center",
  },
  bigPct: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  statsCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    overflow: "hidden",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 8,
  },
  statCell: { flex: 1, alignItems: "center", gap: 5 },
  statDivider: { width: 1, height: 36 },
  statNum: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statUnit: { fontSize: 14, fontWeight: "500" },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 32,
    maxWidth: "80%",
  },
  profileIcon: { fontSize: 14 },
  profileName: { fontSize: 13, fontWeight: "600" },
  stopZone: { alignItems: "center", gap: 14 },
  stopBtn: {
    width: SW * 0.7,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexDirection: "row",
    gap: 10,
  },
  stopIcon: { fontSize: 20 },
  stopLabel: { fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
  stopHint: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
});
