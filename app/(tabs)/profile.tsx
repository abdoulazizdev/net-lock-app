import PaywallModal from "@/components/PaywallModal";
import ProfileTemplatesModal from "@/components/ProfileTemplatesModal";
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

// ─── PulseDot ─────────────────────────────────────────────────────────────────
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

// ─── ScheduleBadge ────────────────────────────────────────────────────────────
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

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({
  value,
  label,
  accent,
}: {
  value: string | number;
  label: string;
  accent?: string;
}) {
  return (
    <View style={stat.pill}>
      <Text style={[stat.val, accent ? { color: accent } : {}]}>{value}</Text>
      <Text style={stat.lbl}>{label}</Text>
    </View>
  );
}

const stat = StyleSheet.create({
  pill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  val: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  lbl: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.38)",
    letterSpacing: 0.8,
    marginTop: 2,
  },
});

// ─── ProfileCard ──────────────────────────────────────────────────────────────
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

        {/* ── Corps principal ── */}
        <View style={card.body}>
          {/* Avatar + infos */}
          <View style={card.top}>
            <View
              style={[
                card.avatar,
                { backgroundColor: color + "18", borderColor: color + "35" },
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
                      card.sleepBadge,
                      {
                        backgroundColor: t.blocked.bg,
                        borderColor: t.blocked.border,
                      },
                    ]}
                  >
                    <Text
                      style={[card.sleepBadgeText, { color: t.blocked.text }]}
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

          {/* Bannière immédiat */}
          {!hasSchedules && isActive && blockedCount > 0 && (
            <View
              style={[
                card.immediateBanner,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
            >
              <PulseDot color={t.allowed.accent} />
              <Text style={[card.immediateText, { color: t.allowed.text }]}>
                {blockedCount} app{blockedCount !== 1 ? "s" : ""} bloquée
                {blockedCount !== 1 ? "s" : ""} maintenant
              </Text>
            </View>
          )}

          {/* Plages horaires */}
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
        </View>

        {/* ── Divider + Actions ── */}
        <View style={[card.divider, { backgroundColor: t.border.light }]} />
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
            activeOpacity={0.8}
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

// ─── CreateModal ──────────────────────────────────────────────────────────────
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

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { isPremium, refresh: refreshPremium } = usePremium();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
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

  // Stats dérivées
  const totalBlocked = profiles.reduce(
    (acc, p) => acc + (p.rules ?? []).filter((r) => r.isBlocked).length,
    0,
  );
  const activeCount = activeProfileId ? 1 : 0;
  const canAddMore = isPremium || profiles.length < FREE_LIMITS.MAX_PROFILES;

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

  return (
    <View style={[s.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* ══ HEADER ══════════════════════════════════════════════════════════════ */}
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + 14,
            backgroundColor: Semantic.bg.header,
          },
        ]}
      >
        {/* Ligne titre + actions */}
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>Profils</Text>
          <View style={s.headerActions}>
            {!isPremium && (
              <View style={s.limitBadge}>
                <Text style={s.limitBadgeText}>
                  {profiles.length}/{FREE_LIMITS.MAX_PROFILES}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={s.templatesBtn}
              onPress={() => setShowTemplates(true)}
              activeOpacity={0.8}
            >
              <Text style={s.templatesBtnText}>⚡ Templates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.addBtn,
                canAddMore
                  ? {
                      backgroundColor: "rgba(99,153,34,0.2)",
                      borderColor: "rgba(99,153,34,0.4)",
                    }
                  : {
                      backgroundColor: "rgba(127,119,221,0.15)",
                      borderColor: "rgba(127,119,221,0.35)",
                    },
              ]}
              onPress={handleAddProfile}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  s.addBtnText,
                  {
                    color: canAddMore ? Colors.green[400] : Colors.purple[400],
                  },
                ]}
              >
                {canAddMore ? "+ Nouveau" : "🔒 Pro"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats pills */}
        {profiles.length > 0 && (
          <View style={s.statsRow}>
            <StatPill value={profiles.length} label="PROFILS" />
            <StatPill
              value={activeCount}
              label="ACTIF"
              accent={activeCount > 0 ? "#4ade80" : undefined}
            />
            <StatPill value={totalBlocked} label="APPS BLOQUÉES" />
          </View>
        )}
      </View>

      {/* ══ CONTENU ═════════════════════════════════════════════════════════════ */}
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
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[
                  s.emptyBtn,
                  {
                    backgroundColor: "rgba(255,255,255,.1)",
                    borderColor: "rgba(255,255,255,.18)",
                  },
                ]}
                onPress={() => setShowTemplates(true)}
              >
                <Text style={[s.emptyBtnText, { color: Colors.blue[100] }]}>
                  ⚡ Templates
                </Text>
              </TouchableOpacity>
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
                  + Créer
                </Text>
              </TouchableOpacity>
            </View>
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

      {/* ══ FAB ══════════════════════════════════════════════════════════════════ */}
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

      {/* ══ MODALS ════════════════════════════════════════════════════════════════ */}
      <CreateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCreate={createProfile}
        bottomInset={insets.bottom}
      />
      <ProfileTemplatesModal
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
        onCreated={(profileId) => {
          loadProfiles();
          router.push({
            pathname: "/screens/profile-detail",
            params: { profileId },
          });
        }}
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
const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Semantic.bg.header,
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  limitBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  limitBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
  },
  templatesBtn: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  templatesBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  addBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { fontSize: 12, fontWeight: "700" },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },

  // List
  list: { paddingHorizontal: 14, paddingTop: 14 },

  // Empty
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyIcon: { fontSize: 28 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  emptyBtnText: { fontSize: 13, fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
  fabText: {
    fontSize: 26,
    fontWeight: "300",
    color: Colors.gray[0],
    lineHeight: 30,
  },
});

const card = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
    zIndex: 1,
  },
  body: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingLeft: 18,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: "800" },
  info: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 3,
    flexWrap: "wrap",
  },
  name: { fontSize: 14, fontWeight: "700" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activeBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  sleepBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sleepBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  desc: { fontSize: 11, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontSize: 11, fontWeight: "500" },
  metaDot: { fontSize: 11 },
  immediateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  immediateText: { fontSize: 11, fontWeight: "600" },
  scheduleSection: { marginTop: 12 },
  scheduleLine: { height: StyleSheet.hairlineWidth, marginBottom: 10 },
  schedules: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  divider: { height: StyleSheet.hairlineWidth },
  actions: {
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    alignItems: "center",
  },
  actionText: { fontSize: 12, fontWeight: "700" },
  configBtn: {
    flex: 1,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    alignItems: "center",
  },
  configBtnText: { fontSize: 12, fontWeight: "600" },
  deleteBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deleteBtnText: { fontSize: 14 },
});

const badge = StyleSheet.create({
  container: {
    borderRadius: 9,
    padding: 9,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
    minWidth: 95,
  },
  label: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  daysRow: { flexDirection: "row", gap: 3 },
  day: {
    width: 18,
    height: 18,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayText: { fontSize: 8, fontWeight: "700" },
  time: { fontSize: 11, fontWeight: "600", fontFamily: "monospace" },
  more: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: { fontSize: 18 },
  title: { flex: 1, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 11, fontWeight: "700" },
  label: { fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 8 },
  input: {
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
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
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { fontSize: 13, fontWeight: "600" },
  createBtn: {
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    marginBottom: 8,
  },
  createBtnText: { color: Colors.gray[0], fontSize: 15, fontWeight: "800" },
});
