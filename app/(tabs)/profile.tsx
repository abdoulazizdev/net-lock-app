import PaywallModal from "@/components/PaywallModal";
import { usePremium } from "@/hooks/usePremium";
import ProfileService from "@/services/profile.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import { Colors, Semantic, useTheme } from "@/theme";
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
const PROFILE_COLORS = [
  Colors.green[400],
  Colors.purple[400],
  Colors.blue[400],
  Colors.amber[400],
  "#F06292",
];
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

const ScheduleBadge = React.memo(function ScheduleBadge({
  schedule,
}: {
  schedule: ProfileSchedule;
}) {
  const { t } = useTheme();
  return (
    <View
      style={[
        badge.container,
        { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
      ]}
    >
      {!!schedule.label && (
        <Text style={[badge.label, { color: t.text.link }]} numberOfLines={1}>
          {schedule.label}
        </Text>
      )}
      <View style={badge.daysRow}>
        {DAYS_SHORT.map((d, i) => (
          <View
            key={i}
            style={[
              badge.day,
              { backgroundColor: t.bg.cardSunken, borderColor: t.border.light },
              schedule.days.includes(i) && {
                backgroundColor: t.bg.accent,
                borderColor: t.border.focus,
              },
            ]}
          >
            <Text
              style={[
                badge.dayText,
                {
                  color: schedule.days.includes(i) ? t.text.link : t.text.muted,
                },
              ]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[badge.time, { color: t.text.secondary }]}>
        {fmtTime(schedule.startHour, schedule.startMinute)} →{" "}
        {fmtTime(schedule.endHour, schedule.endMinute)}
      </Text>
    </View>
  );
});

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
    const { t } = useTheme();
    const activeSchedules = (item.schedules ?? []).filter((s) => s.isActive);
    const totalSchedules = (item.schedules ?? []).length;
    const blockedCount = (item.rules ?? []).filter((r) => r.isBlocked).length;
    const hasSchedules = totalSchedules > 0;
    return (
      <View
        style={[
          card.container,
          {
            backgroundColor: isActive ? t.allowed.bg : t.bg.card,
            borderColor: isActive ? t.allowed.border : t.border.light,
          },
        ]}
      >
        {isActive && (
          <View
            style={[card.accentBar, { backgroundColor: t.allowed.accent }]}
          />
        )}
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
              <Text
                style={[card.name, { color: t.text.primary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {isActive ? (
                <View
                  style={[
                    card.activeBadge,
                    {
                      backgroundColor: t.allowed.bg,
                      borderColor: t.allowed.border,
                    },
                  ]}
                >
                  <PulseDot color={t.allowed.accent} />
                  <Text
                    style={[card.activeBadgeText, { color: t.allowed.text }]}
                  >
                    ACTIF
                  </Text>
                </View>
              ) : blockedCount > 0 ? (
                <View
                  style={[
                    card.inactiveBadge,
                    {
                      backgroundColor: t.blocked.bg,
                      borderColor: t.blocked.border,
                    },
                  ]}
                >
                  <Text
                    style={[card.inactiveBadgeText, { color: t.blocked.text }]}
                  >
                    EN VEILLE
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[card.desc, { color: t.text.muted }]}
              numberOfLines={1}
            >
              {item.description || "Aucune description"}
            </Text>
            <View style={card.metaRow}>
              <Text style={[card.meta, { color: t.text.secondary }]}>
                {blockedCount} bloquée{blockedCount !== 1 ? "s" : ""}
              </Text>
              <Text style={[card.metaDot, { color: t.border.light }]}>·</Text>
              <Text style={[card.meta, { color: t.text.secondary }]}>
                {hasSchedules
                  ? `${activeSchedules.length}/${totalSchedules} plage${totalSchedules !== 1 ? "s" : ""}`
                  : "Sans planification"}
              </Text>
            </View>
          </View>
        </View>
        {!hasSchedules && isActive && blockedCount > 0 && (
          <View
            style={[
              card.immediateBanner,
              { backgroundColor: t.allowed.bg, borderColor: t.allowed.border },
            ]}
          >
            <PulseDot color={t.allowed.accent} />
            <Text style={[card.immediateText, { color: t.allowed.text }]}>
              {blockedCount} app{blockedCount !== 1 ? "s" : ""} bloquée
              {blockedCount !== 1 ? "s" : ""} maintenant
            </Text>
          </View>
        )}
        {activeSchedules.length > 0 && (
          <View style={card.scheduleSection}>
            <View
              style={[card.scheduleLine, { backgroundColor: t.border.light }]}
            />
            <View style={card.schedules}>
              {activeSchedules.slice(0, 2).map((s) => (
                <ScheduleBadge key={s.id} schedule={s} />
              ))}
              {activeSchedules.length > 2 && (
                <View
                  style={[
                    badge.more,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                  ]}
                >
                  <Text style={[badge.moreText, { color: t.text.secondary }]}>
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
              isActive
                ? {
                    backgroundColor: t.blocked.bg,
                    borderColor: t.blocked.border,
                  }
                : {
                    backgroundColor: t.allowed.bg,
                    borderColor: t.allowed.border,
                  },
              toggling && { opacity: 0.5 },
            ]}
            onPress={onToggle}
            disabled={toggling}
            activeOpacity={0.8}
          >
            <Text
              style={[
                card.actionText,
                { color: isActive ? t.blocked.text : t.allowed.text },
              ]}
            >
              {toggling ? "…" : isActive ? "Désactiver" : "Activer"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              card.configBtn,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Text style={[card.configBtnText, { color: t.text.secondary }]}>
              ◈ Configurer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              card.deleteBtn,
              { backgroundColor: t.danger.bg, borderColor: t.danger.border },
            ]}
            onPress={onDelete}
          >
            <Text style={[card.deleteBtnText, { color: t.danger.accent }]}>
              ⌫
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (p, n) =>
    p.item === n.item &&
    p.isActive === n.isActive &&
    p.color === n.color &&
    p.toggling === n.toggling,
);

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
  const { t } = useTheme();
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
              backgroundColor: t.bg.card,
              borderColor: t.border.light,
              transform: [{ translateY: slideAnim }, { translateY: shiftAnim }],
              paddingBottom: Math.max(bottomInset + 16, 32),
            },
          ]}
        >
          <View style={[cm.handle, { backgroundColor: t.border.normal }]} />
          <View style={cm.header}>
            <View
              style={[
                cm.headerIconWrap,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
            >
              <Text style={[cm.headerIcon, { color: t.allowed.accent }]}>
                ◉
              </Text>
            </View>
            <Text style={[cm.title, { color: t.text.primary }]}>
              Nouveau profil
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={[
                cm.closeIcon,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[cm.closeIconText, { color: t.text.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={[cm.label, { color: t.text.muted }]}>
              NOM DU PROFIL
            </Text>
            <TextInput
              style={[
                cm.input,
                {
                  backgroundColor: t.bg.cardAlt,
                  color: t.text.primary,
                  borderColor: t.border.light,
                },
              ]}
              placeholder="Ex: Enfant, Travail, Gaming..."
              placeholderTextColor={t.text.muted}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
            />
            <Text style={[cm.label, { color: t.text.muted }]}>
              DESCRIPTION (optionnel)
            </Text>
            <TextInput
              style={[
                cm.input,
                cm.inputMulti,
                {
                  backgroundColor: t.bg.cardAlt,
                  color: t.text.primary,
                  borderColor: t.border.light,
                },
              ]}
              placeholder="Description du profil..."
              placeholderTextColor={t.text.muted}
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={2}
              returnKeyType="done"
            />
            <Text style={[cm.label, { color: t.text.muted }]}>SUGGESTIONS</Text>
            <View style={cm.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.name}
                  style={[
                    cm.suggestion,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                    name === s.name && {
                      backgroundColor: t.bg.accent,
                      borderColor: t.border.focus,
                    },
                  ]}
                  onPress={() => {
                    setName(s.name);
                    setDesc(s.desc);
                  }}
                >
                  <Text
                    style={[
                      cm.suggestionText,
                      {
                        color: name === s.name ? t.text.link : t.text.secondary,
                      },
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[
                cm.createBtn,
                {
                  backgroundColor: !name.trim()
                    ? Colors.green[100]
                    : Colors.green[400],
                },
              ]}
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

export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
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
    <View style={[s.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={s.headerLeft}>
          <View
            style={[
              s.headerIconWrap,
              { backgroundColor: t.allowed.bg, borderColor: t.allowed.border },
            ]}
          >
            <Text style={[s.headerIconText, { color: t.allowed.accent }]}>
              ◉
            </Text>
          </View>
          <View>
            <Text style={s.headerTitle}>Profils</Text>
            <Text style={[s.headerSubtitle, { color: Colors.blue[200] }]}>
              {profiles.length} profil{profiles.length !== 1 ? "s" : ""} ·{" "}
              {activeProfileId ? "1 actif" : "Aucun actif"}
              {!isPremium
                ? ` · ${profiles.length}/${FREE_LIMITS.MAX_PROFILES} gratuit`
                : ""}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            s.addBtn,
            canAddMore
              ? { backgroundColor: t.allowed.bg, borderColor: t.allowed.border }
              : { backgroundColor: t.focus.bg, borderColor: t.focus.border },
          ]}
          onPress={handleAddProfile}
          activeOpacity={0.8}
        >
          <Text
            style={[
              s.addBtnText,
              { color: canAddMore ? t.allowed.text : t.focus.text },
            ]}
          >
            {canAddMore ? "+ Nouveau" : "🔒 Premium"}
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {profiles.length === 0 ? (
          <View style={s.empty}>
            <View
              style={[
                s.emptyIconWrap,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
            >
              <Text style={[s.emptyIcon, { color: t.allowed.accent }]}>◉</Text>
            </View>
            <Text style={[s.emptyTitle, { color: t.text.primary }]}>
              Aucun profil
            </Text>
            <Text style={[s.emptyText, { color: t.text.secondary }]}>
              Créez des profils pour regrouper des règles de blocage. Sans
              planification, le profil bloque immédiatement les apps
              configurées.
            </Text>
            <TouchableOpacity
              style={[
                s.emptyBtn,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
              onPress={handleAddProfile}
            >
              <Text style={[s.emptyBtnText, { color: t.allowed.text }]}>
                Créer un profil
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={profiles}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              s.list,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={t.refreshTint}
                colors={[t.refreshTint]}
                progressBackgroundColor={t.bg.card}
              />
            }
          />
        )}
      </Animated.View>

      {profiles.length > 0 && (
        <TouchableOpacity
          style={[
            s.fab,
            {
              bottom: insets.bottom + 24,
              backgroundColor: canAddMore ? Colors.green[400] : t.focus.bg,
            },
            !canAddMore && { borderWidth: 1, borderColor: t.focus.border },
          ]}
          onPress={handleAddProfile}
          activeOpacity={0.85}
        >
          <Text style={[s.fabText, !canAddMore && { fontSize: 18 }]}>
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

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: Semantic.bg.header,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconText: { fontSize: 20 },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -1,
  },
  headerSubtitle: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  addBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnText: { fontSize: 13, fontWeight: "700" },
  list: { paddingHorizontal: 18, paddingTop: 18 },
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "800", marginBottom: 10 },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  emptyBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyBtnText: { fontSize: 14, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
  fabText: {
    fontSize: 28,
    fontWeight: "300",
    color: Colors.gray[0],
    lineHeight: 32,
  },
});
const card = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 18,
    paddingLeft: 22,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
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
  name: { fontSize: 16, fontWeight: "700" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  activeBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  inactiveBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  inactiveBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  desc: { fontSize: 11, marginBottom: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: 11, fontWeight: "500" },
  metaDot: { fontSize: 11 },
  immediateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  immediateText: { fontSize: 12, fontWeight: "600" },
  scheduleSection: { marginTop: 14 },
  scheduleLine: { height: 1, marginBottom: 12 },
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
  actionText: { fontSize: 13, fontWeight: "700" },
  configBtn: {
    flex: 1,
    borderRadius: 11,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  configBtnText: { fontSize: 13, fontWeight: "600" },
  deleteBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
  },
  deleteBtnText: { fontSize: 15 },
});
const badge = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    gap: 5,
    minWidth: 100,
  },
  label: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  daysRow: { flexDirection: "row", gap: 3 },
  day: {
    width: 18,
    height: 18,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  dayText: { fontSize: 8, fontWeight: "700" },
  time: { fontSize: 11, fontWeight: "600", fontFamily: "monospace" },
  more: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "center",
    borderWidth: 1,
  },
  moreText: { fontSize: 11, fontWeight: "700" },
});
const cm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: { fontSize: 18 },
  title: { flex: 1, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 11, fontWeight: "700" },
  label: { fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 8 },
  input: {
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 13, fontWeight: "600" },
  createBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  createBtnText: { color: Colors.gray[0], fontSize: 16, fontWeight: "800" },
});
