import FocusService from "@/services/focus.service";
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
  { label: "15 min", minutes: 15, icon: "🎯", desc: "Mini-sprint" },
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
        // Attendre établissement
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (await VpnService.isVpnActive()) break;
        }
      }
      await FocusService.startFocus(selected);
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
          <View style={qt.header}>
            <View>
              <Text style={[qt.title, { color: t.text.primary }]}>
                ⏱ Minuterie rapide
              </Text>
              <Text style={[qt.sub, { color: t.text.muted }]}>
                Blocage temporaire des apps configurées
              </Text>
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

          <View style={qt.grid}>
            {PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.minutes}
                style={[
                  qt.presetCard,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
                  selected === preset.minutes && {
                    backgroundColor: Colors.blue[50],
                    borderColor: Colors.blue[400],
                  },
                ]}
                onPress={() => setSelected(preset.minutes)}
                activeOpacity={0.8}
              >
                <Text style={qt.presetIcon}>{preset.icon}</Text>
                <Text
                  style={[
                    qt.presetLabel,
                    {
                      color:
                        selected === preset.minutes
                          ? Colors.blue[600]
                          : t.text.primary,
                    },
                  ]}
                >
                  {preset.label}
                </Text>
                <Text style={[qt.presetDesc, { color: t.text.muted }]}>
                  {preset.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={[
              qt.infoBox,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
          >
            <Text style={{ fontSize: 13 }}>🔒</Text>
            <Text style={[qt.infoText, { color: t.text.muted }]}>
              La minuterie est verrouillée. Pour l'arrêter, maintenez le bouton
              Stop 5 secondes dans la bannière Focus.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              qt.startBtn,
              { backgroundColor: Colors.blue[600] },
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
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  sub: { fontSize: 12, marginTop: 3 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
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
  presetDesc: { fontSize: 10, fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: { fontSize: 12, lineHeight: 18, flex: 1 },
  startBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  startBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.2,
  },
});
