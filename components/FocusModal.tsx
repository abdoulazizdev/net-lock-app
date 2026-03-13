import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import { Profile } from "@/types";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Modal,
    ScrollView,
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

export default function FocusModal({ visible, onClose, onStarted }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadProfiles();
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

  const loadProfiles = async () => {
    const p = await StorageService.getProfiles();
    setProfiles(p);
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await FocusService.startFocus(
        selectedDuration,
        selectedProfileId ?? undefined,
      );
      onStarted();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const presets = FocusService.presets;
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const blockedCount = selectedProfile
    ? selectedProfile.rules.filter((r) => r.isBlocked).length
    : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[fm.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            fm.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <View style={fm.handle} />

          {/* Header */}
          <View style={fm.header}>
            <View>
              <Text style={fm.title}>🎯 Mode Focus</Text>
              <Text style={fm.subtitle}>
                Bloquez les distractions pour une durée fixe
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={fm.closeBtn}>
              <Text style={fm.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Durée */}
            <Text style={fm.sectionLabel}>DURÉE</Text>
            <View style={fm.presetsGrid}>
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    fm.presetCard,
                    selectedDuration === p.value && fm.presetCardSelected,
                  ]}
                  onPress={() => setSelectedDuration(p.value)}
                  activeOpacity={0.75}
                >
                  <Text style={fm.presetIcon}>{p.icon}</Text>
                  <Text
                    style={[
                      fm.presetLabel,
                      selectedDuration === p.value && fm.presetLabelSelected,
                    ]}
                  >
                    {p.label}
                  </Text>
                  <Text style={fm.presetDesc}>{p.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Profil */}
            <Text style={[fm.sectionLabel, { marginTop: 20 }]}>
              APPS À BLOQUER
            </Text>
            <TouchableOpacity
              style={[
                fm.profileOption,
                selectedProfileId === null && fm.profileOptionSelected,
              ]}
              onPress={() => setSelectedProfileId(null)}
              activeOpacity={0.75}
            >
              <Text style={fm.profileOptionIcon}>⚙️</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    fm.profileOptionName,
                    selectedProfileId === null && fm.profileOptionNameSelected,
                  ]}
                >
                  Règles globales
                </Text>
                <Text style={fm.profileOptionDesc}>
                  Toutes les apps actuellement bloquées
                </Text>
              </View>
              {selectedProfileId === null && (
                <Text style={fm.checkmark}>✓</Text>
              )}
            </TouchableOpacity>

            {profiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  fm.profileOption,
                  selectedProfileId === p.id && fm.profileOptionSelected,
                ]}
                onPress={() => setSelectedProfileId(p.id)}
                activeOpacity={0.75}
              >
                <Text style={fm.profileOptionIcon}>👤</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      fm.profileOptionName,
                      selectedProfileId === p.id &&
                        fm.profileOptionNameSelected,
                    ]}
                  >
                    {p.name}
                  </Text>
                  <Text style={fm.profileOptionDesc}>
                    {p.rules.filter((r) => r.isBlocked).length} apps bloquées
                  </Text>
                </View>
                {selectedProfileId === p.id && (
                  <Text style={fm.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Avertissement */}
            <View style={fm.warnBox}>
              <Text style={fm.warnIcon}>⚠️</Text>
              <Text style={fm.warnText}>
                Une fois démarré, la session ne peut être annulée qu'en
                maintenant le bouton Stop pendant 5 secondes.
              </Text>
            </View>
          </ScrollView>

          {/* Bouton démarrer */}
          <TouchableOpacity
            style={[fm.startBtn, loading && fm.startBtnLoading]}
            onPress={handleStart}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={fm.startBtnIcon}>🎯</Text>
            <Text style={fm.startBtnText}>
              {loading ? "Démarrage..." : `Démarrer ${selectedDuration} min`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0E0E18",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#1C1C2C",
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A3C",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 12, color: "#3A3A58", marginTop: 3 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 12, color: "#5A5A80", fontWeight: "700" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetCard: {
    width: "28%",
    backgroundColor: "#14141E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 12,
    alignItems: "center",
  },
  presetCardSelected: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  presetIcon: { fontSize: 22, marginBottom: 6 },
  presetLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#5A5A80",
    marginBottom: 2,
  },
  presetLabelSelected: { color: "#7B6EF6" },
  presetDesc: {
    fontSize: 9,
    color: "#2E2E48",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  profileOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#14141E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 14,
    marginBottom: 8,
  },
  profileOptionSelected: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  profileOptionIcon: { fontSize: 20 },
  profileOptionName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5A5A80",
    marginBottom: 2,
  },
  profileOptionNameSelected: { color: "#E8E8F8" },
  profileOptionDesc: { fontSize: 11, color: "#2E2E48" },
  checkmark: { fontSize: 16, color: "#7B6EF6", fontWeight: "700" },
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#14080A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A1520",
    padding: 14,
    marginTop: 16,
    marginBottom: 20,
  },
  warnIcon: { fontSize: 14, marginTop: 1 },
  warnText: { flex: 1, fontSize: 12, color: "#D04070", lineHeight: 18 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  startBtnLoading: { backgroundColor: "#7B6EF640" },
  startBtnIcon: { fontSize: 18 },
  startBtnText: {
    color: "#F0F0FF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
