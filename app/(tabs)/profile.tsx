import ProfileService from "@/services/profile.service";
import StorageService from "@/services/storage.service";
import { Profile, ProfileSchedule } from "@/types";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
const PROFILE_COLORS = ["#3DDB8A", "#7B6EF6", "#4D9FFF", "#FFB84D", "#F06292"];
const getColor = (id: string) =>
  PROFILE_COLORS[
    parseInt(id.replace(/\D/g, "").slice(-1) || "0", 10) % PROFILE_COLORS.length
  ];
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

// ─── Schedule badge ────────────────────────────────────────────────────────────
function ScheduleBadge({ schedule }: { schedule: ProfileSchedule }) {
  return (
    <View style={badge.container}>
      <View style={badge.daysRow}>
        {DAYS_SHORT.map((d, i) => (
          <View
            key={i}
            style={[badge.day, schedule.days.includes(i) && badge.dayActive]}
          >
            <Text
              style={[
                badge.dayText,
                schedule.days.includes(i) && badge.dayTextActive,
              ]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>
      <Text style={badge.time}>
        {fmtTime(schedule.startHour, schedule.startMinute)} →{" "}
        {fmtTime(schedule.endHour, schedule.endMinute)}
      </Text>
    </View>
  );
}

// ─── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({
  item,
  isActive,
  color,
  onToggle,
  onDelete,
  onPress,
  toggling,
}: {
  item: Profile;
  isActive: boolean;
  color: string;
  onToggle: () => void;
  onDelete: () => void;
  onPress: () => void;
  toggling: boolean;
}) {
  const activeSchedules = (item.schedules ?? []).filter((s) => s.isActive);
  const blockedCount = (item.rules ?? []).filter((r) => r.isBlocked).length;
  const hasSchedules = (item.schedules ?? []).length > 0;

  return (
    <View style={[card.container, isActive && { borderColor: color + "50" }]}>
      {/* Top row */}
      <View style={card.top}>
        <View
          style={[
            card.avatar,
            { backgroundColor: color + "18", borderColor: color + "40" },
          ]}
        >
          <Text style={[card.avatarText, { color }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={card.info}>
          <View style={card.nameRow}>
            <Text style={card.name}>{item.name}</Text>
            {isActive && (
              <View
                style={[
                  card.activeBadge,
                  { backgroundColor: color + "20", borderColor: color },
                ]}
              >
                <Text style={[card.activeBadgeText, { color }]}>● ACTIF</Text>
              </View>
            )}
          </View>
          <Text style={card.desc} numberOfLines={1}>
            {item.description || "Aucune description"}
          </Text>
          <View style={card.metaRow}>
            <Text style={card.meta}>{blockedCount} app(s) bloquée(s)</Text>
            <Text style={card.metaDot}>·</Text>
            <Text style={card.meta}>
              {hasSchedules
                ? `${activeSchedules.length} plage(s)`
                : "Blocage immédiat"}
            </Text>
          </View>
        </View>
      </View>

      {/* Planification info si aucune plage */}
      {!hasSchedules && isActive && (
        <View style={card.immediateBanner}>
          <View style={card.immediateDot} />
          <Text style={card.immediateText}>
            Profil actif · {blockedCount} app(s) bloquée(s) maintenant
          </Text>
        </View>
      )}

      {/* Schedules preview */}
      {activeSchedules.length > 0 && (
        <View style={card.scheduleSection}>
          <View style={card.scheduleLine} />
          <View style={card.schedules}>
            {activeSchedules.slice(0, 2).map((s) => (
              <ScheduleBadge key={s.id} schedule={s} />
            ))}
            {activeSchedules.length > 2 && (
              <View style={badge.more}>
                <Text style={badge.moreText}>
                  +{activeSchedules.length - 2}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={card.actions}>
        <TouchableOpacity
          style={[
            card.actionBtn,
            isActive
              ? { backgroundColor: "#D0407015", borderColor: "#D0407050" }
              : { backgroundColor: color + "15", borderColor: color + "50" },
            toggling && card.actionBtnLoading,
          ]}
          onPress={onToggle}
          disabled={toggling}
          activeOpacity={0.8}
        >
          <Text
            style={[card.actionText, { color: isActive ? "#D04070" : color }]}
          >
            {toggling ? "…" : isActive ? "Désactiver" : "Activer"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={card.configBtn}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={card.configBtnText}>⚙ Configurer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={card.deleteBtn} onPress={onDelete}>
          <Text style={card.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Create Profile Modal ──────────────────────────────────────────────────────
function CreateModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), desc.trim());
    setName("");
    setDesc("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={createModal.overlay}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            createModal.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={createModal.handle} />
          <View style={createModal.header}>
            <Text style={createModal.title}>Nouveau profil</Text>
            <TouchableOpacity onPress={onClose}>
              <View style={createModal.closeIcon}>
                <Text style={createModal.closeIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={createModal.label}>NOM DU PROFIL</Text>
          <TextInput
            style={createModal.input}
            placeholder="Ex: Enfant, Travail, Gaming..."
            placeholderTextColor="#2A2A42"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={createModal.label}>DESCRIPTION (optionnel)</Text>
          <TextInput
            style={[createModal.input, createModal.inputMulti]}
            placeholder="Description du profil..."
            placeholderTextColor="#2A2A42"
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={2}
          />

          <Text style={createModal.label}>SUGGESTIONS</Text>
          <View style={createModal.suggestions}>
            {[
              { name: "👶 Enfant", desc: "Protéger les enfants" },
              { name: "💼 Travail", desc: "Mode concentration" },
              { name: "🎮 Gaming", desc: "Sessions de jeu" },
              { name: "🌙 Nuit", desc: "Pas de distraction" },
            ].map((s) => (
              <TouchableOpacity
                key={s.name}
                style={createModal.suggestion}
                onPress={() => {
                  setName(s.name);
                  setDesc(s.desc);
                }}
              >
                <Text style={createModal.suggestionText}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              createModal.createBtn,
              !name.trim() && createModal.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={!name.trim()}
            activeOpacity={0.85}
          >
            <Text style={createModal.createBtnText}>Créer le profil</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfiles();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadProfiles = async () => {
    try {
      const loaded = await StorageService.getProfiles();
      setProfiles(
        loaded.map((p) => ({
          ...p,
          schedules: p.schedules ?? [],
          rules: p.rules ?? [],
        })),
      );
      const active = await StorageService.getActiveProfile();
      setActiveProfileId(active?.id ?? null);
    } catch (e) {
      console.error("Erreur profils:", e);
    }
  };

  const createProfile = async (name: string, desc: string) => {
    const newProfile: Profile = {
      id: `profile_${Date.now()}`,
      name,
      description: desc,
      isActive: false,
      rules: [],
      schedules: [],
      createdAt: new Date(),
    };
    await StorageService.saveProfile(newProfile);
    setShowModal(false);
    await loadProfiles();
    router.push({
      pathname: "/screens/profile-detail",
      params: { profileId: newProfile.id },
    });
  };

  const deleteProfile = (profileId: string) => {
    Alert.alert("Supprimer ce profil ?", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          if (activeProfileId === profileId) {
            await ProfileService.deactivateProfile();
            setActiveProfileId(null);
          }
          await StorageService.deleteProfile(profileId);
          await loadProfiles();
        },
      },
    ]);
  };

  // ── Activation / désactivation ─────────────────────────────────────────────
  // Utilise ProfileService qui garantit la sync VPN
  const toggleProfile = async (profileId: string) => {
    if (togglingId) return;
    setTogglingId(profileId);
    try {
      if (activeProfileId === profileId) {
        // Désactiver → tout autoriser
        await ProfileService.deactivateProfile();
        setActiveProfileId(null);
      } else {
        // Activer → applique les règles + sync VPN
        await ProfileService.activateProfile(profileId);
        setActiveProfileId(profileId);
      }
      await loadProfiles();
    } catch (e) {
      Alert.alert("Erreur", "Impossible de modifier le profil actif");
      console.error("[ProfilesScreen] toggleProfile:", e);
    } finally {
      setTogglingId(null);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: Profile }) => (
      <ProfileCard
        item={item}
        isActive={item.id === activeProfileId}
        color={getColor(item.id)}
        toggling={togglingId === item.id}
        onToggle={() => toggleProfile(item.id)}
        onDelete={() => deleteProfile(item.id)}
        onPress={() =>
          router.push({
            pathname: "/screens/profile-detail",
            params: { profileId: item.id },
          })
        }
      />
    ),
    [activeProfileId, togglingId],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Profils</Text>
          <Text style={styles.headerSubtitle}>
            {profiles.length} profil(s) ·{" "}
            {activeProfileId ? "1 actif" : "Aucun actif"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {profiles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗂</Text>
            <Text style={styles.emptyTitle}>Aucun profil</Text>
            <Text style={styles.emptyText}>
              Créez des profils pour regrouper des règles de blocage. Sans
              planification, le profil bloque immédiatement les apps
              configurées.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowModal(true)}
            >
              <Text style={styles.emptyBtnText}>Créer un profil</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={profiles}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {profiles.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <CreateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCreate={createProfile}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#3A3A58",
    marginTop: 3,
    fontWeight: "500",
  },
  addBtn: {
    backgroundColor: "#3DDB8A18",
    borderWidth: 1,
    borderColor: "#3DDB8A60",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: "#3DDB8A", fontSize: 13, fontWeight: "700" },
  list: { paddingHorizontal: 20, paddingTop: 16 },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 52, marginBottom: 18 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: "#3A3A58",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyBtn: {
    backgroundColor: "#3DDB8A18",
    borderWidth: 1,
    borderColor: "#3DDB8A60",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyBtnText: { color: "#3DDB8A", fontSize: 14, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#3DDB8A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3DDB8A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  fabText: {
    fontSize: 28,
    fontWeight: "300",
    color: "#080810",
    lineHeight: 32,
  },
});

const card = StyleSheet.create({
  container: {
    backgroundColor: "#0E0E18",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  top: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginRight: 14,
  },
  avatarText: { fontSize: 22, fontWeight: "800" },
  info: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: "700", color: "#F0F0FF" },
  activeBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  activeBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  desc: { fontSize: 12, color: "#3A3A58", marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: 11, color: "#2A2A42", fontWeight: "500" },
  metaDot: { color: "#2A2A42", fontSize: 11 },

  // Bannière "blocage immédiat" quand actif sans planification
  immediateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: "#0D221880",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#1E6A4650",
  },
  immediateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3DDB8A",
  },
  immediateText: { fontSize: 12, color: "#3DDB8A", fontWeight: "600" },

  scheduleSection: { marginTop: 14 },
  scheduleLine: { height: 1, backgroundColor: "#13131F", marginBottom: 12 },
  schedules: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnLoading: { opacity: 0.5 },
  actionText: { fontSize: 13, fontWeight: "700" },
  configBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#14141E",
  },
  configBtnText: { fontSize: 13, fontWeight: "600", color: "#5A5A80" },
  deleteBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#14080A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A1520",
  },
  deleteBtnText: { fontSize: 16 },
});

const badge = StyleSheet.create({
  container: {
    backgroundColor: "#14141E",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    gap: 6,
  },
  daysRow: { flexDirection: "row", gap: 3 },
  day: {
    width: 18,
    height: 18,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C2C",
  },
  dayActive: { backgroundColor: "#7B6EF630" },
  dayText: { fontSize: 8, fontWeight: "700", color: "#3A3A58" },
  dayTextActive: { color: "#7B6EF6" },
  time: {
    fontSize: 11,
    color: "#5A5A80",
    fontWeight: "600",
    fontFamily: "monospace",
  },
  more: {
    backgroundColor: "#1C1C2C",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "center",
  },
  moreText: { fontSize: 11, color: "#3A3A58", fontWeight: "700" },
});

const createModal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0E0E18",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A3C",
    alignSelf: "center",
    marginBottom: 22,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 11, color: "#5A5A80", fontWeight: "700" },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#14141E",
    borderRadius: 12,
    padding: 14,
    color: "#F0F0FF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 18,
  },
  inputMulti: { height: 70, textAlignVertical: "top" },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  suggestion: {
    backgroundColor: "#14141E",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  suggestionText: { color: "#5A5A80", fontSize: 13, fontWeight: "600" },
  createBtn: {
    backgroundColor: "#3DDB8A",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  createBtnDisabled: { backgroundColor: "#3DDB8A30" },
  createBtnText: { color: "#080810", fontSize: 16, fontWeight: "800" },
});
