import PaywallModal from "@/components/PaywallModal";
import { usePremium } from "@/hooks/usePremium";
import ProfileService from "@/services/profile.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import { Profile, ProfileSchedule } from "@/types";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
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

const SUGGESTIONS = [
  { name: "Enfant", desc: "Protéger les enfants" },
  { name: "Travail", desc: "Mode concentration" },
  { name: "Gaming", desc: "Sessions de jeu" },
  { name: "Nuit", desc: "Pas de distraction" },
  { name: "Réseaux Sociaux", desc: "Bloquer Instagram, TikTok…" },
];

// ─── Pulse dot ────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.8,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
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
            toValue: 0.7,
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
        width: 8,
        height: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View
        style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }}
      />
    </View>
  );
}

// ─── Schedule badge ───────────────────────────────────────────────────────────
const ScheduleBadge = React.memo(function ScheduleBadge({
  schedule,
}: {
  schedule: ProfileSchedule;
}) {
  return (
    <View style={badge.container}>
      {!!schedule.label && (
        <Text style={badge.label} numberOfLines={1}>
          {schedule.label}
        </Text>
      )}
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
});

// ─── Profile card ─────────────────────────────────────────────────────────────
const ProfileCard = React.memo(
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
    const totalSchedules = (item.schedules ?? []).length;
    const blockedCount = (item.rules ?? []).filter((r) => r.isBlocked).length;
    const hasSchedules = totalSchedules > 0;

    return (
      <View
        style={[
          card.container,
          isActive ? card.containerActive : card.containerIdle,
        ]}
      >
        {isActive && <View style={card.accentBar} />}
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
              <Text style={card.name} numberOfLines={1}>
                {item.name}
              </Text>
              {isActive ? (
                <View style={card.activeBadge}>
                  <PulseDot color="#2DB870" />
                  <Text style={card.activeBadgeText}>ACTIF</Text>
                </View>
              ) : blockedCount > 0 ? (
                <View style={card.inactiveBadge}>
                  <Text style={card.inactiveBadgeText}>EN VEILLE</Text>
                </View>
              ) : null}
            </View>
            <Text style={card.desc} numberOfLines={1}>
              {item.description || "Aucune description"}
            </Text>
            <View style={card.metaRow}>
              <Text style={card.meta}>
                {blockedCount} bloquée{blockedCount !== 1 ? "s" : ""}
              </Text>
              <Text style={card.metaDot}>·</Text>
              <Text style={card.meta}>
                {hasSchedules
                  ? `${activeSchedules.length}/${totalSchedules} plage${totalSchedules !== 1 ? "s" : ""}`
                  : "Sans planification"}
              </Text>
            </View>
          </View>
        </View>

        {!hasSchedules && isActive && blockedCount > 0 && (
          <View style={card.immediateBanner}>
            <PulseDot color="#2DB870" />
            <Text style={card.immediateText}>
              {blockedCount} app{blockedCount !== 1 ? "s" : ""} bloquée
              {blockedCount !== 1 ? "s" : ""} maintenant
            </Text>
          </View>
        )}

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

        <View style={card.actions}>
          <TouchableOpacity
            style={[
              card.actionBtn,
              isActive ? card.actionBtnDeactivate : card.actionBtnActivate,
              toggling && card.actionBtnLoading,
            ]}
            onPress={onToggle}
            disabled={toggling}
            activeOpacity={0.8}
          >
            <Text
              style={[
                card.actionText,
                { color: isActive ? "#C04060" : "#2DB870" },
              ]}
            >
              {toggling ? "…" : isActive ? "Désactiver" : "Activer"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={card.configBtn}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Text style={card.configBtnText}>◈ Configurer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={card.deleteBtn} onPress={onDelete}>
            <Text style={card.deleteBtnText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.isActive === next.isActive &&
    prev.color === next.color &&
    prev.toggling === next.toggling,
);

// ─── Create Profile Modal ─────────────────────────────────────────────────────
function CreateModal({
  visible,
  onClose,
  onCreate,
  bottomInset,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, desc: string) => void;
  bottomInset: number;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shiftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEv =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEv =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const dur = Platform.OS === "ios" ? 250 : 150;
    const s1 = Keyboard.addListener(showEv, (e) => {
      Animated.timing(shiftAnim, {
        toValue: -e.endCoordinates.height,
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
    const s2 = Keyboard.addListener(hideEv, () => {
      Animated.timing(shiftAnim, {
        toValue: 0,
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(500);
      fadeAnim.setValue(0);
      shiftAnim.setValue(0);
      setName("");
      setDesc("");
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[cm.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={handleClose}
        />
        <Animated.View
          style={[
            cm.sheet,
            {
              transform: [{ translateY: slideAnim }, { translateY: shiftAnim }],
              paddingBottom: Math.max(bottomInset + 16, 32),
            },
          ]}
        >
          <View style={cm.handle} />
          <View style={cm.header}>
            <View style={cm.headerIconWrap}>
              <Text style={cm.headerIcon}>◉</Text>
            </View>
            <Text style={cm.title}>Nouveau profil</Text>
            <TouchableOpacity onPress={handleClose} style={cm.closeIcon}>
              <Text style={cm.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={cm.label}>NOM DU PROFIL</Text>
            <TextInput
              style={cm.input}
              placeholder="Ex: Enfant, Travail, Gaming..."
              placeholderTextColor="#2A2A42"
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
            />
            <Text style={cm.label}>DESCRIPTION (optionnel)</Text>
            <TextInput
              style={[cm.input, cm.inputMulti]}
              placeholder="Description du profil..."
              placeholderTextColor="#2A2A42"
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={2}
              returnKeyType="done"
            />
            <Text style={cm.label}>SUGGESTIONS</Text>
            <View style={cm.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.name}
                  style={[
                    cm.suggestion,
                    name === s.name && cm.suggestionActive,
                  ]}
                  onPress={() => {
                    setName(s.name);
                    setDesc(s.desc);
                  }}
                >
                  <Text
                    style={[
                      cm.suggestionText,
                      name === s.name && cm.suggestionTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[cm.createBtn, !name.trim() && cm.createBtnDisabled]}
              onPress={() => {
                if (name.trim()) onCreate(name.trim(), desc.trim());
              }}
              disabled={!name.trim()}
              activeOpacity={0.85}
            >
              <Text style={cm.createBtnText}>Créer le profil</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, refresh: refreshPremium } = usePremium();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfiles();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const [loaded, active] = await Promise.all([
        StorageService.getProfiles(),
        StorageService.getActiveProfile(),
      ]);
      setProfiles(
        loaded.map((p) => ({
          ...p,
          schedules: p.schedules ?? [],
          rules: p.rules ?? [],
        })),
      );
      setActiveProfileId(active?.id ?? null);
    } catch (e) {
      console.error("[ProfilesScreen] loadProfiles:", e);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfiles();
    setRefreshing(false);
  }, [loadProfiles]);

  const handleAddProfile = useCallback(() => {
    if (!isPremium && profiles.length >= FREE_LIMITS.MAX_PROFILES) {
      setPaywallVisible(true);
      return;
    }
    setShowModal(true);
  }, [isPremium, profiles.length]);

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
    router.push({
      pathname: "/screens/profile-detail",
      params: { profileId: newProfile.id },
    });
    loadProfiles();
  };

  const deleteProfile = useCallback(
    (profileId: string) => {
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
    },
    [activeProfileId, loadProfiles],
  );

  const toggleProfile = useCallback(
    async (profileId: string) => {
      if (togglingId) return;
      setTogglingId(profileId);
      try {
        if (activeProfileId === profileId) {
          await ProfileService.deactivateProfile();
          setActiveProfileId(null);
        } else {
          await ProfileService.activateProfile(profileId);
          setActiveProfileId(profileId);
        }
        await loadProfiles();
      } catch {
        Alert.alert("Erreur", "Impossible de modifier le profil actif");
      } finally {
        setTogglingId(null);
      }
    },
    [activeProfileId, togglingId, loadProfiles],
  );

  const keyExtractor = useCallback((item: Profile) => item.id, []);
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
    [activeProfileId, togglingId, toggleProfile, deleteProfile],
  );

  const canAddMore = isPremium || profiles.length < FREE_LIMITS.MAX_PROFILES;

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07070F" />

      {/* ── Header ── */}
      <View style={[st.header, { paddingTop: insets.top + 14 }]}>
        <View style={st.headerLeft}>
          <View style={st.headerIconWrap}>
            <Text style={st.headerIconText}>◉</Text>
          </View>
          <View>
            <Text style={st.headerTitle}>Profils</Text>
            <Text style={st.headerSubtitle}>
              {profiles.length} profil{profiles.length !== 1 ? "s" : ""} ·{" "}
              {activeProfileId ? "1 actif" : "Aucun actif"}
              {!isPremium
                ? ` · ${profiles.length}/${FREE_LIMITS.MAX_PROFILES} gratuit`
                : ""}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[st.addBtn, !canAddMore && st.addBtnLocked]}
          onPress={handleAddProfile}
          activeOpacity={0.8}
        >
          <Text style={[st.addBtnText, !canAddMore && st.addBtnTextLocked]}>
            {canAddMore ? "+ Nouveau" : "🔒 Premium"}
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {profiles.length === 0 ? (
          <View style={st.empty}>
            <View style={st.emptyIconWrap}>
              <Text style={st.emptyIcon}>◉</Text>
            </View>
            <Text style={st.emptyTitle}>Aucun profil</Text>
            <Text style={st.emptyText}>
              Créez des profils pour regrouper des règles de blocage. Sans
              planification, le profil bloque immédiatement les apps
              configurées.
            </Text>
            <TouchableOpacity style={st.emptyBtn} onPress={handleAddProfile}>
              <Text style={st.emptyBtnText}>Créer un profil</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={profiles}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              st.list,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#7B6EF6"
                colors={["#7B6EF6"]}
              />
            }
          />
        )}
      </Animated.View>

      {/* FAB */}
      {profiles.length > 0 && (
        <TouchableOpacity
          style={[
            st.fab,
            { bottom: insets.bottom + 24 },
            !canAddMore && st.fabLocked,
          ]}
          onPress={handleAddProfile}
          activeOpacity={0.85}
        >
          <Text style={[st.fabText, !canAddMore && st.fabTextLocked]}>
            {canAddMore ? "+" : "🔒"}
          </Text>
        </TouchableOpacity>
      )}

      <CreateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCreate={createProfile}
        bottomInset={insets.bottom}
      />

      <PaywallModal
        visible={paywallVisible}
        reason="profiles"
        onClose={() => setPaywallVisible(false)}
        onUpgraded={() => {
          refreshPremium();
          setPaywallVisible(false);
          setShowModal(true);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070F" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#111120",
    backgroundColor: "#07070F",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#0D2218",
    borderWidth: 1,
    borderColor: "#1A5034",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconText: { fontSize: 20, color: "#2DB870" },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#EDEDFF",
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#2A2A48",
    marginTop: 2,
    fontWeight: "500",
  },
  addBtn: {
    backgroundColor: "#081410",
    borderWidth: 1,
    borderColor: "#0E3020",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnLocked: { backgroundColor: "#16103A", borderColor: "#3A3480" },
  addBtnText: { color: "#2DB870", fontSize: 13, fontWeight: "700" },
  addBtnTextLocked: { color: "#9B8FFF" },
  list: { paddingHorizontal: 18, paddingTop: 18 },

  // Empty
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#0D2218",
    borderWidth: 1,
    borderColor: "#1A5034",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyIcon: { fontSize: 32, color: "#2DB870" },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#D8D8F0",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#2A2A48",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  emptyBtn: {
    backgroundColor: "#081410",
    borderWidth: 1,
    borderColor: "#0E3020",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyBtnText: { color: "#2DB870", fontSize: 14, fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#2DB870",
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
  fabLocked: {
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#3A3480",
  },
  fabText: {
    fontSize: 28,
    fontWeight: "300",
    color: "#07070F",
    lineHeight: 32,
  },
  fabTextLocked: { fontSize: 18, lineHeight: 32, color: "#9B8FFF" },
});

const card = StyleSheet.create({
  container: {
    backgroundColor: "#0C0C16",
    borderRadius: 20,
    padding: 18,
    paddingLeft: 22,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  containerActive: { borderColor: "#0E3020", backgroundColor: "#060E08" },
  containerIdle: { borderColor: "#141428" },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: "#2DB870",
  },
  top: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 50,
    height: 50,
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
    flexWrap: "wrap",
  },
  name: { fontSize: 16, fontWeight: "700", color: "#D8D8F0" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    backgroundColor: "#081410",
    borderColor: "#0E3020",
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#2DB870",
  },
  inactiveBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    backgroundColor: "#140810",
    borderColor: "#3A1020",
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#C04060",
  },
  desc: { fontSize: 11, color: "#2A2A48", marginBottom: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: 11, color: "#2A2A48", fontWeight: "500" },
  metaDot: { color: "#1E1E30", fontSize: 11 },
  immediateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: "#081410",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#0E3020",
  },
  immediateText: { fontSize: 12, color: "#2DB870", fontWeight: "600" },
  scheduleSection: { marginTop: 14 },
  scheduleLine: { height: 1, backgroundColor: "#111120", marginBottom: 12 },
  schedules: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    borderRadius: 11,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnActivate: { backgroundColor: "#081410", borderColor: "#0E3020" },
  actionBtnDeactivate: { backgroundColor: "#140810", borderColor: "#3A1020" },
  actionBtnLoading: { opacity: 0.5 },
  actionText: { fontSize: 13, fontWeight: "700" },
  configBtn: {
    flex: 1,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#141428",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#0E0E18",
  },
  configBtnText: { fontSize: 13, fontWeight: "600", color: "#4A4A68" },
  deleteBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#140810",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#2A1018",
  },
  deleteBtnText: { fontSize: 15, color: "#C04060" },
});

const badge = StyleSheet.create({
  container: {
    backgroundColor: "#0E0E18",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#141428",
    gap: 5,
    minWidth: 100,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7B6EF6",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  daysRow: { flexDirection: "row", gap: 3 },
  day: {
    width: 18,
    height: 18,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  dayActive: { backgroundColor: "#16103A", borderColor: "#3A3480" },
  dayText: { fontSize: 8, fontWeight: "700", color: "#2A2A48" },
  dayTextActive: { color: "#9B8FFF" },
  time: {
    fontSize: 11,
    color: "#3A3A58",
    fontWeight: "600",
    fontFamily: "monospace",
  },
  more: {
    backgroundColor: "#0E0E18",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#141428",
  },
  moreText: { fontSize: 11, color: "#3A3A58", fontWeight: "700" },
});

const cm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0C0C16",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#141428",
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
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#0D2218",
    borderWidth: 1,
    borderColor: "#1A5034",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: { fontSize: 18, color: "#2DB870" },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#EDEDFF",
    letterSpacing: -0.5,
  },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 11, color: "#5A5A80", fontWeight: "700" },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2A2A48",
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 14,
    color: "#D8D8F0",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#141428",
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
    backgroundColor: "#0E0E18",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#141428",
  },
  suggestionActive: { backgroundColor: "#16103A", borderColor: "#3A3480" },
  suggestionText: { color: "#3A3A58", fontSize: 13, fontWeight: "600" },
  suggestionTextActive: { color: "#9B8FFF" },
  createBtn: {
    backgroundColor: "#2DB870",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  createBtnDisabled: { backgroundColor: "#2DB87030" },
  createBtnText: { color: "#07070F", fontSize: 16, fontWeight: "800" },
});
