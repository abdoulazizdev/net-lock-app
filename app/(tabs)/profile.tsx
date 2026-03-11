import StorageService from "@/services/storage.service";
import { Profile } from "@/types";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

// ─── Color palette per profile (refined, no neon) ─────────────────────────────
const PROFILE_COLORS = [
  { base: "#7B6EF6", bg: "#16103A", border: "#4A3F8A" }, // violet
  { base: "#3DDB8A", bg: "#0D2218", border: "#1E6A46" }, // emerald
  { base: "#E07A5F", bg: "#2A1510", border: "#6A3020" }, // terracotta
  { base: "#74B3CE", bg: "#0E1E2A", border: "#1E4A6A" }, // steel blue
  { base: "#C9A84C", bg: "#261E0A", border: "#5A4A18" }, // gold
];

const getProfileColor = (id: string) =>
  PROFILE_COLORS[
    parseInt(id.replace(/\D/g, "").slice(-2) || "0", 10) % PROFILE_COLORS.length
  ];

const SUGGESTIONS = [
  { label: "Enfant", icon: "◎" },
  { label: "Travail", icon: "◈" },
  { label: "Gaming", icon: "◉" },
  { label: "Nuit", icon: "◌" },
];

// ─── Profile Card ─────────────────────────────────────────────────────────────
function ProfileCard({
  item,
  isActive,
  onToggle,
  onDelete,
  onManage,
}: {
  item: Profile;
  isActive: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onManage: () => void;
}) {
  const color = getProfileColor(item.id);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.timing(scaleAnim, {
      toValue: 0.985,
      duration: 100,
      useNativeDriver: true,
    }).start();
  const handlePressOut = () =>
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.card, isActive && { borderColor: color.border }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onManage}
        activeOpacity={1}
      >
        {/* Active indicator bar */}
        {isActive && (
          <View style={[styles.activeBar, { backgroundColor: color.base }]} />
        )}

        {/* Top row */}
        <View style={styles.cardTop}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: color.bg, borderColor: color.border },
            ]}
          >
            <Text style={[styles.avatarText, { color: color.base }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.cardMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {item.name}
              </Text>
              {isActive && (
                <View
                  style={[
                    styles.activePill,
                    { backgroundColor: color.bg, borderColor: color.border },
                  ]}
                >
                  <View
                    style={[styles.activeDot, { backgroundColor: color.base }]}
                  />
                  <Text style={[styles.activePillText, { color: color.base }]}>
                    ACTIF
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.profileDesc} numberOfLines={1}>
              {item.description || "Sans description"}
            </Text>
            <Text style={styles.rulesCount}>
              {item.rules.length === 0
                ? "Aucune règle"
                : `${item.rules.length} règle${item.rules.length > 1 ? "s" : ""}`}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions row */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              isActive
                ? { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" }
                : { backgroundColor: color.bg, borderColor: color.border },
            ]}
            onPress={onToggle}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.toggleDot,
                { backgroundColor: isActive ? "#D04070" : color.base },
              ]}
            />
            <Text
              style={[
                styles.toggleBtnText,
                { color: isActive ? "#D04070" : color.base },
              ]}
            >
              {isActive ? "Désactiver" : "Activer"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manageBtn}
            onPress={onManage}
            activeOpacity={0.75}
          >
            <Text style={styles.manageBtnText}>Gérer</Text>
            <Text style={styles.manageBtnArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            activeOpacity={0.75}
          >
            <Text style={styles.deleteBtnIcon}>⌫</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrapper}>
        <Text style={styles.emptyIconText}>◎</Text>
      </View>
      <Text style={styles.emptyTitle}>Aucun profil</Text>
      <Text style={styles.emptySubtitle}>
        Créez des profils pour regrouper vos règles et basculer entre eux en un
        tap.
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={onCreate}
        activeOpacity={0.8}
      >
        <Text style={styles.emptyBtnText}>Créer un profil</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDesc, setNewProfileDesc] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const modalSlide = useRef(new Animated.Value(300)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [profiles]);

  useEffect(() => {
    if (showModal) {
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalSlide, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalSlide.setValue(300);
      modalOpacity.setValue(0);
    }
  }, [showModal]);

  const loadProfiles = async () => {
    try {
      const loaded = await StorageService.getProfiles();
      setProfiles(loaded);
      const active = await StorageService.getActiveProfile();
      setActiveProfileId(active?.id || null);
    } catch (error) {
      console.error("Erreur profils:", error);
    }
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) {
      Alert.alert("Erreur", "Le nom du profil est requis");
      return;
    }
    try {
      const newProfile: Profile = {
        id: `profile_${Date.now()}`,
        name: newProfileName.trim(),
        description: newProfileDesc.trim(),
        isActive: false,
        rules: [],
        createdAt: new Date(),
      };
      await StorageService.saveProfile(newProfile);
      await loadProfiles();
      setShowModal(false);
      setNewProfileName("");
      setNewProfileDesc("");
    } catch {
      Alert.alert("Erreur", "Impossible de créer le profil");
    }
  };

  const deleteProfile = (profileId: string) => {
    Alert.alert("Supprimer ce profil ?", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await StorageService.deleteProfile(profileId);
          if (activeProfileId === profileId) {
            await StorageService.setActiveProfile(null);
            setActiveProfileId(null);
          }
          await loadProfiles();
        },
      },
    ]);
  };

  const toggleProfile = async (profileId: string) => {
    try {
      if (activeProfileId === profileId) {
        await StorageService.setActiveProfile(null);
        setActiveProfileId(null);
      } else {
        await StorageService.setActiveProfile(profileId);
        setActiveProfileId(profileId);
      }
    } catch {
      Alert.alert("Erreur", "Impossible de modifier le profil actif");
    }
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalSlide, {
        toValue: 300,
        duration: 240,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false);
      setNewProfileName("");
      setNewProfileDesc("");
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Profils</Text>
          <Text style={styles.headerSubtitle}>
            {profiles.length} configuré{profiles.length > 1 ? "s" : ""}
            {activeProfileId ? " · 1 actif" : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.newBtnPlus}>+</Text>
          <Text style={styles.newBtnText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* ── Content */}
      {profiles.length === 0 ? (
        <EmptyState onCreate={() => setShowModal(true)} />
      ) : (
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <FlatList
            data={profiles}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ProfileCard
                item={item}
                isActive={item.id === activeProfileId}
                onToggle={() => toggleProfile(item.id)}
                onDelete={() => deleteProfile(item.id)}
                onManage={() =>
                  router.push({
                    pathname: "/profile-rules",
                    params: { profileId: item.id },
                  })
                }
              />
            )}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + 90 },
            ]}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}

      {/* ── FAB */}
      {profiles.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* ── Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View style={[modalStyles.overlay, { opacity: modalOpacity }]}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeModal}
          />

          <Animated.View
            style={[
              modalStyles.sheet,
              {
                transform: [{ translateY: modalSlide }],
                paddingBottom: insets.bottom + 24,
              },
            ]}
          >
            {/* Handle */}
            <View style={modalStyles.handle} />

            <View style={modalStyles.sheetHeader}>
              <Text style={modalStyles.sheetTitle}>Nouveau profil</Text>
              <TouchableOpacity
                onPress={closeModal}
                style={modalStyles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={modalStyles.closeIcon}>
                  <Text style={modalStyles.closeIconText}>✕</Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={modalStyles.fieldLabel}>NOM</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="Ex: Enfant, Travail, Gaming…"
              placeholderTextColor="#2E2E48"
              value={newProfileName}
              onChangeText={setNewProfileName}
              autoFocus
            />

            <Text style={modalStyles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              style={[modalStyles.input, modalStyles.inputMulti]}
              placeholder="Description optionnelle…"
              placeholderTextColor="#2E2E48"
              value={newProfileDesc}
              onChangeText={setNewProfileDesc}
              multiline
              numberOfLines={3}
            />

            <Text style={modalStyles.fieldLabel}>SUGGESTIONS</Text>
            <View style={modalStyles.suggestionsRow}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={[
                    modalStyles.suggestionChip,
                    newProfileName === s.label &&
                      modalStyles.suggestionChipActive,
                  ]}
                  onPress={() => setNewProfileName(s.label)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      modalStyles.suggestionIcon,
                      newProfileName === s.label &&
                        modalStyles.suggestionTextActive,
                    ]}
                  >
                    {s.icon}
                  </Text>
                  <Text
                    style={[
                      modalStyles.suggestionLabel,
                      newProfileName === s.label &&
                        modalStyles.suggestionTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                modalStyles.createBtn,
                !newProfileName.trim() && modalStyles.createBtnDisabled,
              ]}
              onPress={createProfile}
              activeOpacity={0.85}
              disabled={!newProfileName.trim()}
            >
              <Text style={modalStyles.createBtnText}>Créer le profil</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  // ── Header
  header: {
    paddingTop: 12, // overridden dynamically with insets.top
    paddingHorizontal: 22,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
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
    letterSpacing: 0.4,
    fontWeight: "500",
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  newBtnPlus: {
    fontSize: 16,
    color: "#9B8FFF",
    lineHeight: 18,
    fontWeight: "300",
  },
  newBtnText: {
    fontSize: 13,
    color: "#9B8FFF",
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── List
  list: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 110 },

  // ── Card
  card: {
    backgroundColor: "#0E0E18",
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    overflow: "hidden",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingLeft: 20,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: "800" },

  cardMeta: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E8E8F8",
    letterSpacing: -0.2,
    flex: 1,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeDot: { width: 5, height: 5, borderRadius: 3 },
  activePillText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  profileDesc: { fontSize: 12, color: "#3A3A58", marginBottom: 3 },
  rulesCount: {
    fontSize: 11,
    color: "#2A2A42",
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  divider: { height: 1, backgroundColor: "#13131F", marginHorizontal: 16 },

  // ── Actions
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    paddingLeft: 20,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleDot: { width: 6, height: 6, borderRadius: 3 },
  toggleBtnText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },

  manageBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  manageBtnText: { fontSize: 12, color: "#5A5A80", fontWeight: "600" },
  manageBtnArrow: { fontSize: 12, color: "#3A3A58" },

  deleteBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#14080A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A1520",
  },
  deleteBtnIcon: { fontSize: 14, color: "#5A2030" },

  // ── Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyIconText: { fontSize: 32, color: "#7B6EF6" },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#E8E8F8",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#3A3A58",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  emptyBtnText: { color: "#9B8FFF", fontSize: 14, fontWeight: "700" },

  // ── FAB
  fab: {
    position: "absolute",
    bottom: 16, // overridden dynamically with insets.bottom
    right: 24,
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: {
    fontSize: 26,
    color: "#9B8FFF",
    fontWeight: "300",
    lineHeight: 30,
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0E0E18",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    paddingBottom: 24, // overridden dynamically with insets.bottom
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#1C1C2C",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A3C",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  closeBtn: {},
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 11, color: "#5A5A80", fontWeight: "700" },

  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#080810",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#E8E8F8",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 18,
  },
  inputMulti: {
    height: 72,
    textAlignVertical: "top",
  },

  suggestionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  suggestionChipActive: {
    backgroundColor: "#16103A",
    borderColor: "#4A3F8A",
  },
  suggestionIcon: { fontSize: 11, color: "#3A3A58" },
  suggestionLabel: { fontSize: 13, color: "#3A3A58", fontWeight: "600" },
  suggestionTextActive: { color: "#9B8FFF" },

  createBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  createBtnDisabled: {
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#2A2040",
  },
  createBtnText: {
    color: "#F0F0FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
