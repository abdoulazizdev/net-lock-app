/**
 * QuickTimerModal.tsx — Modal Minuterie rapide
 *
 * Utilise TimerService (pas FocusService).
 * - Pas de stats trackées
 * - Tap-to-stop (pas de hold)
 * - Bloque les apps actuellement cochées dans les règles
 * - Pas de message de motivation
 */

import TimerService from "@/services/timer.service";
import VpnService from "@/services/vpn.service";
import { Colors, useTheme } from "@/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
  onStarted: () => void;
}

const PRESETS = [
  { label: "5 min", minutes: 5, icon: "⚡", desc: "Pause rapide" },
  { label: "15 min", minutes: 15, icon: "☕", desc: "Café sans distr." },
  { label: "30 min", minutes: 30, icon: "💪", desc: "Demi-heure" },
  { label: "1h", minutes: 60, icon: "🔥", desc: "Session complète" },
  { label: "2h", minutes: 120, icon: "🧘", desc: "Deep work" },
  { label: "4h", minutes: 240, icon: "⭐", desc: "Demi-journée" },
];

export default function QuickTimerModal({
  visible,
  onClose,
  onStarted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setStarting(false);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleStart = async () => {
    if (selected === null || starting) return;
    setStarting(true);
    try {
      // S'assurer que le VPN est actif
      const isVpnOn = await VpnService.isVpnActive();
      if (!isVpnOn) {
        const started = await VpnService.startVpn();
        if (!started) {
          Alert.alert(
            "VPN requis",
            "Acceptez la permission VPN pour démarrer la minuterie.",
          );
          setStarting(false);
          return;
        }
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (await VpnService.isVpnActive()) break;
        }
      }
      await TimerService.start(selected);
      onStarted();
      onClose();
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.message ?? "Impossible de démarrer la minuterie.",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[qt.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            qt.sheet,
            {
              backgroundColor: t.bg.card,
              borderColor: t.border.light,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={[qt.handle, { backgroundColor: t.border.normal }]} />

          {/* Header — distingue visuellement de Focus */}
          <View style={qt.header}>
            <View style={qt.headerLeft}>
              <View
                style={[
                  qt.headerIcon,
                  {
                    backgroundColor: Colors.amber[50],
                    borderColor: Colors.amber[100],
                  },
                ]}
              >
                <Text style={{ fontSize: 20 }}>⏱</Text>
              </View>
              <View>
                <Text style={[qt.title, { color: t.text.primary }]}>
                  Minuterie rapide
                </Text>
                <Text style={[qt.sub, { color: t.text.muted }]}>
                  Blocage temporaire · Stop en 1 tap
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[qt.closeBtn, { backgroundColor: t.bg.cardAlt }]}
            >
              <Text
                style={{ fontSize: 11, color: t.text.muted, fontWeight: "700" }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Différence claire avec Focus */}
          <View
            style={[
              qt.diffBanner,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
          >
            <View style={qt.diffRow}>
              <Text style={[qt.diffIcon, { color: Colors.amber[400] }]}>⏱</Text>
              <View style={{ flex: 1 }}>
                <Text style={[qt.diffLabel, { color: t.text.primary }]}>
                  Minuterie
                </Text>
                <Text style={[qt.diffDesc, { color: t.text.muted }]}>
                  Stop en 1 tap · Sans stats
                </Text>
              </View>
              <View
                style={[
                  qt.diffBadge,
                  {
                    backgroundColor: Colors.amber[50],
                    borderColor: Colors.amber[100],
                  },
                ]}
              >
                <Text
                  style={[
                    {
                      fontSize: 9,
                      fontWeight: "800",
                      color: Colors.amber[500],
                    },
                  ]}
                >
                  CASUAL
                </Text>
              </View>
            </View>
            <View
              style={[qt.diffDivider, { backgroundColor: t.border.light }]}
            />
            <View style={qt.diffRow}>
              <Text style={[qt.diffIcon, { color: Colors.purple[400] }]}>
                🎯
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[qt.diffLabel, { color: t.text.muted }]}>
                  Mode Focus
                </Text>
                <Text style={[qt.diffDesc, { color: t.text.muted }]}>
                  Hold 5s pour stopper · Stats + badges
                </Text>
              </View>
              <View
                style={[
                  qt.diffBadge,
                  {
                    backgroundColor: Colors.purple[50],
                    borderColor: Colors.purple[100],
                  },
                ]}
              >
                <Text
                  style={[
                    {
                      fontSize: 9,
                      fontWeight: "800",
                      color: Colors.purple[500],
                    },
                  ]}
                >
                  FOCUS
                </Text>
              </View>
            </View>
          </View>

          {/* Durées */}
          <View style={qt.grid}>
            {PRESETS.map((preset) => {
              const active = selected === preset.minutes;
              return (
                <TouchableOpacity
                  key={preset.minutes}
                  style={[
                    qt.presetCard,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                    active && {
                      backgroundColor: Colors.amber[50],
                      borderColor: Colors.amber[200],
                    },
                  ]}
                  onPress={() => setSelected(preset.minutes)}
                  activeOpacity={0.8}
                >
                  <Text style={qt.presetIcon}>{preset.icon}</Text>
                  <Text
                    style={[
                      qt.presetLabel,
                      { color: active ? Colors.amber[600] : t.text.primary },
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text style={[qt.presetDesc, { color: t.text.muted }]}>
                    {preset.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note */}
          <View
            style={[
              qt.note,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
          >
            <Text style={[{ fontSize: 12, color: t.text.muted }]}>
              💡 Les apps déjà bloquées dans votre liste seront maintenues
              bloquées. Arrêt possible d'un simple tap.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              qt.startBtn,
              { backgroundColor: Colors.amber[400] },
              (selected === null || starting) && { opacity: 0.45 },
            ]}
            onPress={handleStart}
            disabled={selected === null || starting}
            activeOpacity={0.85}
          >
            <Text style={qt.startBtnText}>
              {starting
                ? "Démarrage…"
                : selected
                  ? `⏱ Démarrer — ${PRESETS.find((p) => p.minutes === selected)?.label}`
                  : "Choisissez une durée"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const qt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  sub: { fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  diffBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  diffRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  diffIcon: { fontSize: 18, width: 24, textAlign: "center" },
  diffLabel: { fontSize: 13, fontWeight: "700", marginBottom: 1 },
  diffDesc: { fontSize: 11 },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  diffDivider: { height: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  presetCard: {
    width: "30.5%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  presetIcon: { fontSize: 22, marginBottom: 2 },
  presetLabel: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  presetDesc: { fontSize: 9, fontWeight: "600" },
  note: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  startBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  startBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.2,
  },
});
