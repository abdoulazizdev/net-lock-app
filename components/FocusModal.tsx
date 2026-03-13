import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import { Profile } from "@/types";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
  const slideAnim = useRef(new Animated.Value(500)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadProfiles();
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 240,
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
          toValue: 500,
          duration: 220,
          easing: Easing.in(Easing.quad),
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
            <View style={fm.headerIconWrap}>
              <Text style={fm.headerIcon}>◎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fm.title}>Mode Focus</Text>
              <Text style={fm.subtitle}>
                Bloquez les distractions pour une durée fixe
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={fm.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={fm.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── Durée */}
            <Text style={fm.sectionLabel}>DURÉE</Text>
            <View style={fm.presetsGrid}>
              {presets.map((p) => {
                const active = selectedDuration === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[fm.presetCard, active && fm.presetCardSelected]}
                    onPress={() => setSelectedDuration(p.value)}
                    activeOpacity={0.75}
                  >
                    {active && <View style={fm.presetAccent} />}
                    <Text style={fm.presetIcon}>{p.icon}</Text>
                    <Text
                      style={[fm.presetLabel, active && fm.presetLabelSelected]}
                    >
                      {p.label}
                    </Text>
                    <Text style={fm.presetDesc}>{p.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Apps à bloquer */}
            <Text style={[fm.sectionLabel, { marginTop: 22 }]}>
              APPS À BLOQUER
            </Text>

            {/* Règles globales */}
            <ProfileOption
              icon="◈"
              name="Règles globales"
              desc="Toutes les apps actuellement bloquées"
              selected={selectedProfileId === null}
              onPress={() => setSelectedProfileId(null)}
            />

            {/* Profils */}
            {profiles.map((p) => (
              <ProfileOption
                key={p.id}
                icon="◉"
                name={p.name}
                desc={`${p.rules.filter((r) => r.isBlocked).length} apps bloquées`}
                selected={selectedProfileId === p.id}
                onPress={() => setSelectedProfileId(p.id)}
              />
            ))}

            {/* Résumé sélection */}
            {selectedProfileId !== null && (
              <View style={fm.summaryRow}>
                <Text style={fm.summaryText}>
                  {blockedCount} app{blockedCount > 1 ? "s" : ""} sera
                  {blockedCount > 1 ? "ont" : ""} bloquée
                  {blockedCount > 1 ? "s" : ""}
                </Text>
              </View>
            )}

            {/* Warning */}
            <View style={fm.warnBox}>
              <Text style={fm.warnIcon}>◌</Text>
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
            <View style={fm.startBtnInner}>
              <Text style={fm.startBtnIcon}>◎</Text>
              <Text style={fm.startBtnText}>
                {loading ? "Démarrage…" : `Démarrer ${selectedDuration} min`}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Profile option row ───────────────────────────────────────────────────────
function ProfileOption({
  icon,
  name,
  desc,
  selected,
  onPress,
}: {
  icon: string;
  name: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[fm.profileOption, selected && fm.profileOptionSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View
        style={[fm.profileIconWrap, selected && fm.profileIconWrapSelected]}
      >
        <Text
          style={[
            fm.profileOptionIcon,
            selected && fm.profileOptionIconSelected,
          ]}
        >
          {icon}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            fm.profileOptionName,
            selected && fm.profileOptionNameSelected,
          ]}
        >
          {name}
        </Text>
        <Text style={fm.profileOptionDesc}>{desc}</Text>
      </View>
      <View style={[fm.checkCircle, selected && fm.checkCircleSelected]}>
        {selected && <Text style={fm.checkmark}>✓</Text>}
      </View>
    </TouchableOpacity>
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
    maxHeight: "92%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A3C",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 18,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#7B6EF618",
    borderWidth: 1,
    borderColor: "#7B6EF640",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: { fontSize: 20, color: "#7B6EF6" },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 12, color: "#3A3A58", marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 11, color: "#5A5A80", fontWeight: "700" },

  // Section
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },

  // Presets
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetCard: {
    width: "30%",
    flex: 1,
    backgroundColor: "#14141E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  presetCardSelected: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  presetAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#7B6EF6",
  },
  presetIcon: { fontSize: 20, marginBottom: 5 },
  presetLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#5A5A80",
    marginBottom: 2,
  },
  presetLabelSelected: { color: "#9B8FFF" },
  presetDesc: {
    fontSize: 9,
    color: "#2E2E48",
    fontWeight: "600",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  // Profile option
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
  profileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconWrapSelected: {
    backgroundColor: "#7B6EF618",
    borderColor: "#7B6EF640",
  },
  profileOptionIcon: { fontSize: 16, color: "#3A3A58" },
  profileOptionIconSelected: { color: "#7B6EF6" },
  profileOptionName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5A5A80",
    marginBottom: 2,
  },
  profileOptionNameSelected: { color: "#E8E8F8" },
  profileOptionDesc: { fontSize: 11, color: "#2E2E48" },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    backgroundColor: "#14141E",
    justifyContent: "center",
    alignItems: "center",
  },
  checkCircleSelected: { backgroundColor: "#7B6EF6", borderColor: "#7B6EF6" },
  checkmark: { fontSize: 11, color: "#FFF", fontWeight: "800" },

  // Summary
  summaryRow: {
    backgroundColor: "#7B6EF614",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#7B6EF630",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 12,
    color: "#9B8FFF",
    fontWeight: "600",
    textAlign: "center",
  },

  // Warning
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#14080A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A1520",
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  warnIcon: { fontSize: 13, color: "#D04070", marginTop: 1 },
  warnText: { flex: 1, fontSize: 12, color: "#D04070", lineHeight: 18 },

  // Start button
  startBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  startBtnLoading: {
    backgroundColor: "#7B6EF630",
    shadowOpacity: 0,
    elevation: 0,
  },
  startBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  startBtnIcon: { fontSize: 18, color: "#F0F0FF" },
  startBtnText: {
    color: "#F0F0FF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
