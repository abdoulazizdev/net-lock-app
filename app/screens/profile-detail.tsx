import ProfileDetailSkeleton from "@/components/ProfileDetailSkeleton";
import AppListService from "@/services/app-list.service";
import StorageService from "@/services/storage.service";
import { InstalledApp, Profile, ProfileSchedule } from "@/types";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
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

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

const PROFILE_COLORS = [
  { accent: "#3DDB8A", bg: "#0D2218", border: "#1E6A46" },
  { accent: "#7B6EF6", bg: "#16103A", border: "#4A3F8A" },
  { accent: "#4D9FFF", bg: "#0D1A2E", border: "#1A4A8A" },
  { accent: "#FFB84D", bg: "#2E1E0A", border: "#6A4A1A" },
  { accent: "#F06292", bg: "#2E0A1A", border: "#6A1A3A" },
];
function getProfileColor(id: string) {
  const idx =
    parseInt(id.replace(/\D/g, "").slice(-1) || "0", 10) %
    PROFILE_COLORS.length;
  return PROFILE_COLORS[idx];
}

// ─── TimePicker ───────────────────────────────────────────────────────────────
function TimePicker({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const hourRef = useRef<ScrollView>(null);
  const minRef = useRef<ScrollView>(null);
  const ITEM_H = 44;

  useEffect(() => {
    setTimeout(() => {
      hourRef.current?.scrollTo({ y: hour * ITEM_H, animated: false });
      minRef.current?.scrollTo({ y: (minute / 5) * ITEM_H, animated: false });
    }, 50);
  }, []);

  return (
    <View style={tp.container}>
      <View style={tp.col}>
        <Text style={tp.colLabel}>HEURE</Text>
        <View style={tp.scrollWrap}>
          <View style={tp.selector} pointerEvents="none" />
          <ScrollView
            ref={hourRef}
            style={tp.scroll}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
              onChange(Math.max(0, Math.min(23, idx)), minute);
            }}
          >
            <View style={{ height: ITEM_H * 2 }} />
            {hours.map((h) => (
              <View key={h} style={tp.item}>
                <Text style={[tp.itemText, h === hour && tp.itemTextActive]}>
                  {String(h).padStart(2, "0")}
                </Text>
              </View>
            ))}
            <View style={{ height: ITEM_H * 2 }} />
          </ScrollView>
        </View>
      </View>
      <Text style={tp.colon}>:</Text>
      <View style={tp.col}>
        <Text style={tp.colLabel}>MIN</Text>
        <View style={tp.scrollWrap}>
          <View style={tp.selector} pointerEvents="none" />
          <ScrollView
            ref={minRef}
            style={tp.scroll}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
              onChange(hour, Math.max(0, Math.min(11, idx)) * 5);
            }}
          >
            <View style={{ height: ITEM_H * 2 }} />
            {minutes.map((m) => (
              <View key={m} style={tp.item}>
                <Text style={[tp.itemText, m === minute && tp.itemTextActive]}>
                  {String(m).padStart(2, "0")}
                </Text>
              </View>
            ))}
            <View style={{ height: ITEM_H * 2 }} />
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({
  visible,
  onClose,
  onSave,
  editingSchedule,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (s: Omit<ProfileSchedule, "id">) => void;
  editingSchedule?: ProfileSchedule | null;
}) {
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(8);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(18);
  const [endMinute, setEndMinute] = useState(0);
  const [action, setAction] = useState<"activate" | "deactivate">("activate");
  const [pickerMode, setPickerMode] = useState<"start" | "end">("start");
  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editingSchedule) {
        setLabel(editingSchedule.label);
        setDays(editingSchedule.days);
        setStartHour(editingSchedule.startHour);
        setStartMinute(editingSchedule.startMinute);
        setEndHour(editingSchedule.endHour);
        setEndMinute(editingSchedule.endMinute);
        setAction(editingSchedule.action);
      } else {
        setLabel("");
        setDays([1, 2, 3, 4, 5]);
        setStartHour(8);
        setStartMinute(0);
        setEndHour(18);
        setEndMinute(0);
        setAction("activate");
      }
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(600);
      overlayAnim.setValue(0);
    }
  }, [visible, editingSchedule]);

  const close = () => {
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(onClose);
  };

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const presets = [
    { label: "Semaine", days: [1, 2, 3, 4, 5] },
    { label: "Week-end", days: [0, 6] },
    { label: "Tous", days: [0, 1, 2, 3, 4, 5, 6] },
    { label: "Aucun", days: [] },
  ];

  const handleSave = () => {
    if (days.length === 0) return;
    onSave({
      label:
        label ||
        `${fmtTime(startHour, startMinute)} – ${fmtTime(endHour, endMinute)}`,
      days,
      startHour,
      startMinute,
      endHour,
      endMinute,
      action,
      isActive: true,
    });
    close();
  };

  const isActivate = action === "activate";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      <Animated.View style={[schedModal.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={close}
        />
        <Animated.View
          style={[
            schedModal.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={schedModal.handle} />
          <View style={schedModal.header}>
            <Text style={schedModal.title}>
              {editingSchedule ? "Modifier la plage" : "Nouvelle plage horaire"}
            </Text>
            <TouchableOpacity onPress={close}>
              <View style={schedModal.closeIcon}>
                <Text style={schedModal.closeIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={schedModal.fieldLabel}>NOM (optionnel)</Text>
            <TextInput
              style={schedModal.input}
              placeholder="Ex: Matin, Travail, École..."
              placeholderTextColor="#2A2A42"
              value={label}
              onChangeText={setLabel}
            />

            <Text style={schedModal.fieldLabel}>ACTION</Text>
            <View style={schedModal.actionRow}>
              {(["activate", "deactivate"] as const).map((a) => {
                const active = action === a;
                const color = a === "activate" ? "#3DDB8A" : "#D04070";
                return (
                  <TouchableOpacity
                    key={a}
                    style={[
                      schedModal.actionBtn,
                      active && {
                        backgroundColor: color + "15",
                        borderColor: color + "50",
                      },
                    ]}
                    onPress={() => setAction(a)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        schedModal.actionDot,
                        { backgroundColor: active ? color : "#2A2A3A" },
                      ]}
                    />
                    <Text
                      style={[schedModal.actionBtnText, active && { color }]}
                    >
                      {a === "activate"
                        ? "Activer le profil"
                        : "Désactiver le profil"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={schedModal.fieldLabel}>JOURS</Text>
            <View style={schedModal.presets}>
              {presets.map((p) => {
                const isActive =
                  JSON.stringify(days.sort()) ===
                  JSON.stringify([...p.days].sort());
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[
                      schedModal.preset,
                      isActive && schedModal.presetActive,
                    ]}
                    onPress={() => setDays(p.days)}
                  >
                    <Text
                      style={[
                        schedModal.presetText,
                        isActive && schedModal.presetTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={schedModal.daysRow}>
              {DAYS.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    schedModal.dayBtn,
                    days.includes(i) && schedModal.dayBtnActive,
                  ]}
                  onPress={() => toggleDay(i)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      schedModal.dayBtnText,
                      days.includes(i) && schedModal.dayBtnTextActive,
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={schedModal.fieldLabel}>PLAGE HORAIRE</Text>
            <View style={schedModal.timeToggle}>
              {(["start", "end"] as const).map((mode, idx) => {
                const active = pickerMode === mode;
                const h = mode === "start" ? startHour : endHour;
                const m = mode === "start" ? startMinute : endMinute;
                return (
                  <React.Fragment key={mode}>
                    {idx === 1 && <Text style={schedModal.timeArrow}>→</Text>}
                    <TouchableOpacity
                      style={[
                        schedModal.timeTab,
                        active && schedModal.timeTabActive,
                      ]}
                      onPress={() => setPickerMode(mode)}
                    >
                      <Text style={schedModal.timeTabLabel}>
                        {mode === "start" ? "DÉBUT" : "FIN"}
                      </Text>
                      <Text
                        style={[
                          schedModal.timeTabValue,
                          active && { color: "#7B6EF6" },
                        ]}
                      >
                        {fmtTime(h, m)}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            <TimePicker
              hour={pickerMode === "start" ? startHour : endHour}
              minute={pickerMode === "start" ? startMinute : endMinute}
              onChange={(h, m) => {
                if (pickerMode === "start") {
                  setStartHour(h);
                  setStartMinute(m);
                } else {
                  setEndHour(h);
                  setEndMinute(m);
                }
              }}
            />

            <View style={schedModal.summary}>
              <View style={schedModal.summaryDot} />
              <Text style={schedModal.summaryText}>
                Ce profil sera{" "}
                <Text
                  style={{
                    color: isActivate ? "#3DDB8A" : "#D04070",
                    fontWeight: "800",
                  }}
                >
                  {isActivate ? "activé" : "désactivé"}
                </Text>{" "}
                de{" "}
                <Text style={{ color: "#F0F0FF", fontWeight: "700" }}>
                  {fmtTime(startHour, startMinute)}
                </Text>{" "}
                à{" "}
                <Text style={{ color: "#F0F0FF", fontWeight: "700" }}>
                  {fmtTime(endHour, endMinute)}
                </Text>
                {days.length > 0 && (
                  <Text>
                    {" "}
                    ·{" "}
                    {days
                      .sort()
                      .map((d) => DAYS[d])
                      .join(", ")}
                  </Text>
                )}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                schedModal.saveBtn,
                days.length === 0 && schedModal.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={days.length === 0}
              activeOpacity={0.85}
            >
              <Text style={schedModal.saveBtnText}>
                {editingSchedule ? "Enregistrer" : "Ajouter la plage"}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Schedule Row ─────────────────────────────────────────────────────────────
function ScheduleRow({
  schedule,
  onToggle,
  onDelete,
  onEdit,
}: {
  schedule: ProfileSchedule;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startM = schedule.startHour * 60 + schedule.startMinute;
  const endM = schedule.endHour * 60 + schedule.endMinute;
  const isNow =
    schedule.days.includes(now.getDay()) && nowMins >= startM && nowMins < endM;
  const isAct = schedule.action === "activate";
  const accent = isAct ? "#3DDB8A" : "#D04070";
  const accentBg = isAct ? "#0D2218" : "#1E0E16";
  const accentBd = isAct ? "#1E6A46" : "#4A1A2A";

  return (
    <View style={[sr.container, !schedule.isActive && sr.containerInactive]}>
      <View style={[sr.accent, { backgroundColor: accent }]} />
      <View style={sr.left}>
        <View style={sr.topRow}>
          <View
            style={[
              sr.actionBadge,
              { backgroundColor: accentBg, borderColor: accentBd },
            ]}
          >
            <View style={[sr.actionDot, { backgroundColor: accent }]} />
            <Text style={[sr.actionBadgeText, { color: accent }]}>
              {isAct ? "Activer" : "Désactiver"}
            </Text>
          </View>
          {isNow && schedule.isActive && (
            <View style={sr.nowBadge}>
              <View style={sr.nowDot} />
              <Text style={sr.nowBadgeText}>EN COURS</Text>
            </View>
          )}
          {schedule.label ? (
            <Text style={sr.label} numberOfLines={1}>
              {schedule.label}
            </Text>
          ) : null}
        </View>
        <Text style={sr.time}>
          {fmtTime(schedule.startHour, schedule.startMinute)}
          <Text style={sr.timeSep}> → </Text>
          {fmtTime(schedule.endHour, schedule.endMinute)}
        </Text>
        <View style={sr.daysRow}>
          {DAYS_SHORT.map((d, i) => {
            const active = schedule.days.includes(i);
            return (
              <View
                key={i}
                style={[
                  sr.day,
                  active && {
                    backgroundColor: accentBg,
                    borderWidth: 1,
                    borderColor: accentBd,
                  },
                ]}
              >
                <Text style={[sr.dayText, active && { color: accent }]}>
                  {d}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={sr.right}>
        <TouchableOpacity
          style={sr.editBtn}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Text style={sr.editBtnText}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
          <View
            style={[sr.toggle, schedule.isActive ? sr.toggleOn : sr.toggleOff]}
          >
            <View
              style={[
                sr.toggleThumb,
                schedule.isActive ? sr.thumbOn : sr.thumbOff,
              ]}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={sr.deleteBtn}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Text style={sr.deleteBtnText}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── App Row ──────────────────────────────────────────────────────────────────
const AppRow = React.memo(function AppRow({
  app,
  isBlocked,
  onToggle,
}: {
  app: InstalledApp;
  isBlocked: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={ar.container}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={ar.iconWrap}>
        {app.icon ? (
          <Image
            source={{ uri: `data:image/png;base64,${app.icon}` }}
            style={ar.icon}
          />
        ) : (
          <View style={ar.iconPlaceholder}>
            <Text style={ar.iconLetter}>
              {(app.appName ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {isBlocked && (
          <View style={ar.blockedDot}>
            <Text style={ar.blockedDotText}>✕</Text>
          </View>
        )}
      </View>
      <View style={ar.info}>
        <Text style={[ar.name, isBlocked && ar.nameBlocked]} numberOfLines={1}>
          {app.appName}
        </Text>
        <Text style={ar.pkg} numberOfLines={1}>
          {app.packageName}
        </Text>
      </View>
      <View
        style={[ar.toggle, isBlocked ? ar.toggleBlocked : ar.toggleAllowed]}
      >
        <View
          style={[
            ar.toggleThumb,
            isBlocked ? ar.thumbBlocked : ar.thumbAllowed,
          ]}
        />
      </View>
    </TouchableOpacity>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileDetailScreen() {
  const insets = useSafeAreaInsets();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [blockedPackages, setBlockedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [activeTab, setActiveTab] = useState<"apps" | "schedules">("apps");
  const [search, setSearch] = useState("");

  // Loading state: 'idle' | 'meta' (profile+app list, no icons) | 'icons' | 'done'
  const [loadState, setLoadState] = useState<"meta" | "done">("meta");
  const [refreshing, setRefreshing] = useState(false);

  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ProfileSchedule | null>(null);

  const tabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMeta();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  const loadMeta = async () => {
    setLoadState("meta");
    try {
      const [profiles] = await Promise.all([StorageService.getProfiles()]);

      const p = profiles.find((pr) => pr.id === profileId);
      if (p) {
        const full = {
          ...p,
          schedules: p.schedules ?? [],
          rules: p.rules ?? [],
        };
        setProfile(full);
        setBlockedPackages(
          new Set(
            full.rules.filter((r) => r.isBlocked).map((r) => r.packageName),
          ),
        );
      }

      // getAppsProgressive : callback appelé avec les icônes dès qu'elles sont dispo
      await AppListService.getAppsProgressive((allApps) => {
        const sorted = [...allApps].sort((a, b) => {
          if (a.isSystemApp !== b.isSystemApp) return a.isSystemApp ? 1 : -1;
          return (a.appName ?? "").localeCompare(b.appName ?? "");
        });
        setApps(sorted);
        setLoadState("done");
      });
    } catch (e) {
      console.error("Erreur chargement profil:", e);
      setLoadState("done");
    }
  };
  const switchTab = (tab: "apps" | "schedules") => {
    setActiveTab(tab);
    Animated.timing(tabAnim, {
      toValue: tab === "apps" ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    AppListService.invalidateCache();
    await loadMeta();
    setRefreshing(false);
  }, []);

  const saveProfile = async (updated: Profile) => {
    await StorageService.saveProfile(updated);
    setProfile(updated);
  };

  const toggleApp = useCallback(
    async (packageName: string) => {
      setProfile((prev) => {
        if (!prev) return prev;
        const isBlocked = blockedPackages.has(packageName);
        const updatedRules = [
          ...prev.rules.filter((r) => r.packageName !== packageName),
          {
            packageName,
            isBlocked: !isBlocked,
            profileId: prev.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
        const updated = { ...prev, rules: updatedRules };
        StorageService.saveProfile(updated); // fire-and-forget
        return updated;
      });
      setBlockedPackages((prev) => {
        const next = new Set(prev);
        prev.has(packageName)
          ? next.delete(packageName)
          : next.add(packageName);
        return next;
      });
    },
    [blockedPackages],
  );

  const addOrUpdateSchedule = async (data: Omit<ProfileSchedule, "id">) => {
    if (!profile) return;
    const updatedSchedules = editingSchedule
      ? profile.schedules.map((s) =>
          s.id === editingSchedule.id ? { ...data, id: s.id } : s,
        )
      : [...profile.schedules, { ...data, id: `sched_${Date.now()}` }];
    await saveProfile({ ...profile, schedules: updatedSchedules });
  };

  const toggleSchedule = async (id: string) => {
    if (!profile) return;
    await saveProfile({
      ...profile,
      schedules: profile.schedules.map((s) =>
        s.id === id ? { ...s, isActive: !s.isActive } : s,
      ),
    });
  };

  const deleteSchedule = async (id: string) => {
    if (!profile) return;
    await saveProfile({
      ...profile,
      schedules: profile.schedules.filter((s) => s.id !== id),
    });
  };

  const filteredApps = useMemo(
    () =>
      apps.filter(
        (a) =>
          a.appName?.toLowerCase().includes(search.toLowerCase()) ||
          a.packageName.toLowerCase().includes(search.toLowerCase()),
      ),
    [apps, search],
  );

  const renderApp = useCallback(
    ({ item }: { item: InstalledApp }) => (
      <AppRow
        app={item}
        isBlocked={blockedPackages.has(item.packageName)}
        onToggle={() => toggleApp(item.packageName)}
      />
    ),
    [blockedPackages, toggleApp],
  );

  const keyExtractor = useCallback(
    (item: InstalledApp) => item.packageName,
    [],
  );

  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });
  const profileColor = profile
    ? getProfileColor(profile.id)
    : PROFILE_COLORS[0];
  const blockedCount = blockedPackages.size;
  const schedules = profile?.schedules ?? [];

  if (!profile && loadState === "meta") {
    return <ProfileDetailSkeleton />;
  }

  return (
    <View style={detail.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* ── Header */}
      <Animated.View
        style={[
          detail.header,
          { paddingTop: insets.top + 8, opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={detail.backBtn}
          activeOpacity={0.7}
        >
          <Text style={detail.backArrow}>←</Text>
          <Text style={detail.backText}>Retour</Text>
        </TouchableOpacity>

        <View style={detail.headerMain}>
          <View
            style={[
              detail.avatar,
              {
                backgroundColor: profileColor.bg,
                borderColor: profileColor.border,
              },
            ]}
          >
            <Text style={[detail.avatarText, { color: profileColor.accent }]}>
              {profile?.name.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={detail.profileName}>{profile?.name ?? "..."}</Text>
            <Text style={detail.profileMeta}>
              {blockedCount} bloquée{blockedCount !== 1 ? "s" : ""} ·{" "}
              {schedules.filter((s) => s.isActive).length} plage
              {schedules.length !== 1 ? "s" : ""} active
              {schedules.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        <View style={detail.tabBar}>
          <Animated.View
            style={[detail.tabIndicator, { left: tabIndicatorLeft }]}
          />
          {(["apps", "schedules"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={detail.tab}
              onPress={() => switchTab(tab)}
            >
              <Text
                style={[
                  detail.tabText,
                  activeTab === tab && detail.tabTextActive,
                ]}
              >
                {tab === "apps"
                  ? `Apps (${blockedCount}/${apps.length})`
                  : `Planification (${schedules.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* ── Apps tab */}
      {activeTab === "apps" && (
        <View style={{ flex: 1 }}>
          <View style={detail.searchBar}>
            <Text style={detail.searchIconText}>◎</Text>
            <TextInput
              style={detail.searchInput}
              placeholder="Rechercher une application..."
              placeholderTextColor="#2A2A42"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={detail.searchClearBtn}
              >
                <Text style={detail.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={detail.bulkRow}>
            <TouchableOpacity
              style={[detail.bulkBtn, detail.bulkBtnBlock]}
              onPress={() => {
                if (!profile) return;
                const allRules = apps.map((a) => ({
                  packageName: a.packageName,
                  isBlocked: true,
                  profileId: profile.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }));
                saveProfile({ ...profile, rules: allRules });
                setBlockedPackages(new Set(apps.map((a) => a.packageName)));
              }}
              activeOpacity={0.8}
            >
              <View style={[detail.bulkDot, { backgroundColor: "#D04070" }]} />
              <Text style={[detail.bulkBtnText, { color: "#D04070" }]}>
                Tout bloquer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[detail.bulkBtn, detail.bulkBtnAllow]}
              onPress={() => {
                if (!profile) return;
                saveProfile({ ...profile, rules: [] });
                setBlockedPackages(new Set());
              }}
              activeOpacity={0.8}
            >
              <View style={[detail.bulkDot, { backgroundColor: "#3DDB8A" }]} />
              <Text style={[detail.bulkBtnText, { color: "#3DDB8A" }]}>
                Tout autoriser
              </Text>
            </TouchableOpacity>
          </View>

          {loadState === "meta" ? (
            <ProfileDetailSkeleton skeletonOnly />
          ) : (
            <FlatList
              data={filteredApps}
              keyExtractor={keyExtractor}
              renderItem={renderApp}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 40,
              }}
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, index) => ({
                length: 76,
                offset: 76 * index,
                index,
              })}
              initialNumToRender={30}
              maxToRenderPerBatch={30}
              updateCellsBatchingPeriod={30}
              windowSize={21}
              removeClippedSubviews={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#7B6EF6"
                  colors={["#7B6EF6"]}
                />
              }
              ListEmptyComponent={
                <View style={detail.emptySearch}>
                  <Text style={detail.emptySearchIcon}>◌</Text>
                  <Text style={detail.emptySearchText}>
                    Aucune application trouvée
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* ── Schedules tab */}
      {activeTab === "schedules" && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            contentContainerStyle={[
              detail.schedulesList,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#7B6EF6"
                colors={["#7B6EF6"]}
              />
            }
          >
            <View style={detail.infoBanner}>
              <View style={detail.infoBannerIcon}>
                <Text style={detail.infoBannerIconText}>◎</Text>
              </View>
              <Text style={detail.infoText}>
                Définissez des plages horaires pour activer ou désactiver
                automatiquement ce profil selon les jours et heures.
              </Text>
            </View>

            {schedules.length === 0 ? (
              <View style={detail.emptySchedules}>
                <View style={detail.emptyIconWrap}>
                  <Text style={detail.emptyIconText}>◷</Text>
                </View>
                <Text style={detail.emptyTitle}>Aucune planification</Text>
                <Text style={detail.emptySubtitle}>
                  Ajoutez des plages horaires pour automatiser l'activation de
                  ce profil.
                </Text>
              </View>
            ) : (
              schedules.map((s) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  onToggle={() => toggleSchedule(s.id)}
                  onDelete={() => deleteSchedule(s.id)}
                  onEdit={() => {
                    setEditingSchedule(s);
                    setScheduleModalVisible(true);
                  }}
                />
              ))
            )}
          </ScrollView>

          <TouchableOpacity
            style={[detail.addFab, { bottom: insets.bottom + 24 }]}
            onPress={() => {
              setEditingSchedule(null);
              setScheduleModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={detail.addFabText}>+ Ajouter une plage</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScheduleModal
        visible={scheduleModalVisible}
        onClose={() => {
          setScheduleModalVisible(false);
          setEditingSchedule(null);
        }}
        onSave={addOrUpdateSchedule}
        editingSchedule={editingSchedule}
      />
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const detail = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  backArrow: { fontSize: 18, color: "#9B8FFF", lineHeight: 20 },
  backText: { fontSize: 14, color: "#9B8FFF", fontWeight: "600" },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  avatarText: { fontSize: 20, fontWeight: "800" },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  profileMeta: { fontSize: 11, color: "#3A3A58", marginTop: 3 },
  tabBar: {
    flexDirection: "row",
    height: 44,
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  tabIndicator: {
    position: "absolute",
    width: "50%",
    height: "100%",
    backgroundColor: "#16103A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  tab: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 11, fontWeight: "600", color: "#3A3A58" },
  tabTextActive: { color: "#9B8FFF" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
  },
  searchIconText: { fontSize: 13, color: "#3A3A58", marginRight: 10 },
  searchInput: { flex: 1, color: "#F0F0FF", fontSize: 14 },
  searchClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  searchClearText: { fontSize: 10, color: "#5A5A80", fontWeight: "700" },
  bulkRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
    borderWidth: 1,
  },
  bulkBtnBlock: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  bulkBtnAllow: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  bulkDot: { width: 6, height: 6, borderRadius: 3 },
  bulkBtnText: { fontSize: 12, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptySearch: { alignItems: "center", paddingTop: 60 },
  emptySearchIcon: { fontSize: 32, color: "#2A2A3A", marginBottom: 10 },
  emptySearchText: { fontSize: 14, color: "#3A3A58" },
  schedulesList: { paddingHorizontal: 20, paddingTop: 16 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#16103A",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#4A3F8A",
    marginBottom: 16,
  },
  infoBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#0E0E2A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
  },
  infoBannerIconText: { fontSize: 12, color: "#7B6EF6" },
  infoText: { flex: 1, fontSize: 12, color: "#5A5A80", lineHeight: 19 },
  emptySchedules: { alignItems: "center", paddingTop: 48 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 30, color: "#7B6EF6" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#3A3A58",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  addFab: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  addFabText: {
    color: "#F0F0FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});

const tp = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#14141E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 20,
  },
  col: { alignItems: "center", gap: 8 },
  colLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
  },
  scrollWrap: { width: 80, height: 132, position: "relative" },
  selector: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: "#7B6EF620",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7B6EF640",
    zIndex: 0,
  },
  scroll: { flex: 1 },
  item: { height: 44, justifyContent: "center", alignItems: "center" },
  itemText: { fontSize: 24, fontWeight: "600", color: "#3A3A58" },
  itemTextActive: { color: "#F0F0FF", fontWeight: "800" },
  colon: { fontSize: 28, fontWeight: "800", color: "#3A3A58", marginTop: 22 },
});

const schedModal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000099",
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
    maxHeight: "95%",
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.4,
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#14141E",
    borderRadius: 12,
    padding: 14,
    color: "#F0F0FF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 20,
  },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  actionDot: { width: 7, height: 7, borderRadius: 4 },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: "#3A3A58" },
  presets: { flexDirection: "row", gap: 8, marginBottom: 12 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    backgroundColor: "#14141E",
  },
  presetActive: { backgroundColor: "#7B6EF620", borderColor: "#7B6EF660" },
  presetText: { fontSize: 12, color: "#3A3A58", fontWeight: "600" },
  presetTextActive: { color: "#7B6EF6" },
  daysRow: { flexDirection: "row", gap: 5, marginBottom: 22 },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    backgroundColor: "#14141E",
  },
  dayBtnActive: { backgroundColor: "#7B6EF625", borderColor: "#7B6EF660" },
  dayBtnText: { fontSize: 10, fontWeight: "700", color: "#3A3A58" },
  dayBtnTextActive: { color: "#7B6EF6" },
  timeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  timeTab: {
    flex: 1,
    backgroundColor: "#14141E",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  timeTabActive: { backgroundColor: "#7B6EF615", borderColor: "#7B6EF640" },
  timeTabLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  timeTabValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F0F0FF",
    fontFamily: "monospace",
  },
  timeArrow: { color: "#3A3A58", fontSize: 18, fontWeight: "700" },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#14141E",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 18,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3A3A58",
    marginTop: 7,
  },
  summaryText: { flex: 1, fontSize: 13, color: "#5A5A80", lineHeight: 21 },
  saveBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: "#7B6EF620" },
  saveBtnText: { color: "#F0F0FF", fontSize: 15, fontWeight: "800" },
});

const sr = StyleSheet.create({
  container: {
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  containerInactive: { opacity: 0.45 },
  accent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  left: { flex: 1, paddingLeft: 8 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  label: { fontSize: 12, fontWeight: "600", color: "#8A8AAA" },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  actionDot: { width: 5, height: 5, borderRadius: 3 },
  actionBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  nowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0D2218",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#1E6A46",
  },
  nowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#3DDB8A" },
  nowBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#3DDB8A",
    letterSpacing: 0.8,
  },
  time: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    fontFamily: "monospace",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  timeSep: { color: "#3A3A58", fontWeight: "400", fontSize: 16 },
  daysRow: { flexDirection: "row", gap: 4 },
  day: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C2C",
  },
  dayText: { fontSize: 9, fontWeight: "700", color: "#3A3A58" },
  right: { alignItems: "center", gap: 8 },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  editBtnText: { fontSize: 13, color: "#5A5A80" },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    padding: 2,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  toggleOff: { backgroundColor: "#14141E", borderColor: "#1C1C2C" },
  toggleThumb: { width: 16, height: 16, borderRadius: 8 },
  thumbOn: { backgroundColor: "#3DDB8A", alignSelf: "flex-end" },
  thumbOff: { backgroundColor: "#2A2A3A", alignSelf: "flex-start" },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#14080A",
    borderWidth: 1,
    borderColor: "#2A1520",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 12, color: "#5A2030", fontWeight: "700" },
});

const ar = StyleSheet.create({
  // height must stay at 76px (padding 12*2 + icon 44 + marginBottom 8)
  // to match getItemLayout — do not change padding/margin without updating getItemLayout
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    height: 68,
  },
  iconWrap: { position: "relative", marginRight: 14 },
  icon: { width: 44, height: 44, borderRadius: 11 },
  iconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: "#14141E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  iconLetter: { fontSize: 18, fontWeight: "800", color: "#7B6EF6" },
  blockedDot: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#D04070",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#080810",
  },
  blockedDotText: { fontSize: 7, color: "#FFF", fontWeight: "800" },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: "600", color: "#E8E8F8", marginBottom: 3 },
  nameBlocked: { textDecorationLine: "line-through", color: "#5A5A80" },
  pkg: { fontSize: 10, color: "#2A2A42", fontFamily: "monospace" },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    padding: 2,
    borderWidth: 1,
  },
  toggleAllowed: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  toggleBlocked: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  thumbAllowed: { backgroundColor: "#3DDB8A", alignSelf: "flex-end" },
  thumbBlocked: { backgroundColor: "#D04070", alignSelf: "flex-start" },
});
