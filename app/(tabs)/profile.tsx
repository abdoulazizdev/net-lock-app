import StorageService from "@/services/storage.service";
import { Profile } from "@/types";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

export default function ProfilesScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDesc, setNewProfileDesc] = useState("");

  useEffect(() => {
    loadProfiles();
  }, []);

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

  const PROFILE_COLORS = [
    "#00F5A0",
    "#FF4D4D",
    "#4D9FFF",
    "#FFB84D",
    "#C44DFF",
  ];
  const getColor = (id: string) =>
    PROFILE_COLORS[parseInt(id.slice(-1), 36) % PROFILE_COLORS.length];

  const renderItem = ({ item }: { item: Profile }) => {
    const isActive = item.id === activeProfileId;
    const color = getColor(item.id);

    return (
      <View style={[styles.card, isActive && { borderColor: color + "60" }]}>
        <View style={styles.cardTop}>
          <View
            style={[
              styles.profileAvatar,
              { backgroundColor: color + "20", borderColor: color + "40" },
            ]}
          >
            <Text style={[styles.profileAvatarText, { color }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{item.name}</Text>
              {isActive && (
                <View
                  style={[
                    styles.activeBadge,
                    { backgroundColor: color + "20", borderColor: color },
                  ]}
                >
                  <Text style={[styles.activeBadgeText, { color }]}>
                    ● ACTIF
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.profileDesc} numberOfLines={1}>
              {item.description || "Aucune description"}
            </Text>
            <Text style={styles.profileRules}>
              {item.rules.length} règle(s)
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              isActive
                ? { backgroundColor: "#FF4D4D15", borderColor: "#FF4D4D50" }
                : { backgroundColor: color + "15", borderColor: color + "60" },
            ]}
            onPress={() => toggleProfile(item.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.actionBtnText,
                { color: isActive ? "#FF4D4D" : color },
              ]}
            >
              {isActive ? "Désactiver" : "Activer"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteProfile(item.id)}
          >
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Profils</Text>
          <Text style={styles.headerSubtitle}>
            {profiles.length} profil(s) configuré(s)
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

      {profiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyTitle}>Aucun profil</Text>
          <Text style={styles.emptyText}>
            Créez des profils pour regrouper vos règles de blocage et basculer
            facilement entre eux.
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
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      {profiles.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={modal.overlay}>
          <View style={modal.container}>
            <View style={modal.header}>
              <Text style={modal.title}>Nouveau profil</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={modal.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={modal.label}>NOM DU PROFIL</Text>
            <TextInput
              style={modal.input}
              placeholder="Ex: Enfant, Travail, Gaming..."
              placeholderTextColor="#444"
              value={newProfileName}
              onChangeText={setNewProfileName}
              autoFocus
            />

            <Text style={modal.label}>DESCRIPTION</Text>
            <TextInput
              style={[modal.input, modal.inputMulti]}
              placeholder="Description optionnelle..."
              placeholderTextColor="#444"
              value={newProfileDesc}
              onChangeText={setNewProfileDesc}
              multiline
              numberOfLines={3}
            />

            {/* Suggestions */}
            <Text style={modal.label}>SUGGESTIONS</Text>
            <View style={modal.suggestionsRow}>
              {["Enfant", "Travail", "Gaming", "Nuit"].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={modal.suggestion}
                  onPress={() => setNewProfileName(s)}
                >
                  <Text style={modal.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={modal.saveBtn}
              onPress={createProfile}
              activeOpacity={0.8}
            >
              <Text style={modal.saveBtnText}>Créer le profil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  headerSubtitle: { fontSize: 13, color: "#555", marginTop: 2 },
  addBtn: {
    backgroundColor: "#00F5A015",
    borderWidth: 1,
    borderColor: "#00F5A0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: "#00F5A0", fontSize: 13, fontWeight: "700" },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    backgroundColor: "#16161E",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginRight: 14,
  },
  profileAvatarText: { fontSize: 22, fontWeight: "800" },
  profileInfo: { flex: 1 },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  profileName: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  activeBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  activeBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  profileDesc: { fontSize: 12, color: "#555", marginBottom: 4 },
  profileRules: { fontSize: 11, color: "#333", fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  deleteBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
  },
  deleteBtnText: { fontSize: 16 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: "#00F5A015",
    borderWidth: 1,
    borderColor: "#00F5A0",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: "#00F5A0", fontSize: 14, fontWeight: "700" },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#00F5A0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00F5A0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: "300",
    color: "#0A0A0F",
    lineHeight: 32,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#16161E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  closeBtn: { color: "#555", fontSize: 18, padding: 4 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1E1E2E",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2E2E3E",
    marginBottom: 18,
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  suggestionsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  suggestion: {
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2E2E3E",
  },
  suggestionText: { color: "#888", fontSize: 13, fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#00F5A0",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  saveBtnText: { color: "#0A0A0F", fontSize: 16, fontWeight: "800" },
});
