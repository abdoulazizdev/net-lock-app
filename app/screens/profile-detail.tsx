import ScheduleModal from "@/components/ScheduleModal";
import SearchAndFilters, { FilterKey } from "@/components/SearchAndFilters";
import AppListService from "@/services/app-list.service";
import ProfileService from "@/services/profile.service";
import StorageService from "@/services/storage.service";
import { InstalledApp, Profile, ProfileSchedule } from "@/types";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

// ─── Schedule Row ──────────────────────────────────────────────────────────────
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
  const isNow = (() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const inDays = schedule.days.includes(now.getDay());
    const startMins = schedule.startHour * 60 + schedule.startMinute;
    const endMins = schedule.endHour * 60 + schedule.endMinute;
    const nowMins = h * 60 + m;
    return inDays && nowMins >= startMins && nowMins < endMins;
  })();

  return (
    <View style={[sr.container, !schedule.isActive && sr.containerInactive]}>
      <View style={sr.left}>
        <View style={sr.topRow}>
          <Text style={sr.label}>{schedule.label || "Sans nom"}</Text>
          {isNow && schedule.isActive && (
            <View style={sr.nowBadge}>
              <Text style={sr.nowBadgeText}>● EN COURS</Text>
            </View>
          )}
          <View
            style={[
              sr.actionBadge,
              schedule.action === "activate"
                ? sr.actionBadgeGreen
                : sr.actionBadgeRed,
            ]}
          >
            <Text
              style={[
                sr.actionBadgeText,
                {
                  color: schedule.action === "activate" ? "#3DDB8A" : "#D04070",
                },
              ]}
            >
              {schedule.action === "activate" ? "▶ Activer" : "■ Désactiver"}
            </Text>
          </View>
        </View>
        <Text style={sr.time}>
          {fmtTime(schedule.startHour, schedule.startMinute)} →{" "}
          {fmtTime(schedule.endHour, schedule.endMinute)}
        </Text>
        <View style={sr.daysRow}>
          {DAYS_SHORT.map((d, i) => (
            <View
              key={i}
              style={[sr.day, schedule.days.includes(i) && sr.dayActive]}
            >
              <Text
                style={[
                  sr.dayText,
                  schedule.days.includes(i) && sr.dayTextActive,
                ]}
              >
                {d}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={sr.right}>
        <TouchableOpacity style={sr.editBtn} onPress={onEdit}>
          <Text style={sr.editBtnText}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggle}>
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
        <TouchableOpacity style={sr.deleteBtn} onPress={onDelete}>
          <Text style={sr.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── App Row ───────────────────────────────────────────────────────────────────
function AppRow({
  app,
  isBlocked,
  isSystem,
  onToggle,
}: {
  app: InstalledApp;
  isBlocked: boolean;
  isSystem: boolean;
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
          <View style={[ar.iconPlaceholder, isSystem && ar.iconSystem]}>
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
        {isSystem && !isBlocked && (
          <View style={ar.systemDot}>
            <Text style={ar.systemDotText}>⚙</Text>
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
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ProfileDetailScreen() {
  const insets = useSafeAreaInsets();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isActiveProfile, setIsActiveProfile] = useState(false);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [blockedPackages, setBlockedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [activeTab, setActiveTab] = useState<"apps" | "schedules">("apps");
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [systemAppsLoaded, setSystemAppsLoaded] = useState(false);
  const [systemAppsLoading, setSystemAppsLoading] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ProfileSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const loadingSystemRef = useRef(false);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Capture editingSchedule.id at modal-open time to avoid stale closures
  const editingIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadAll();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  // Charger apps système quand le filtre système est activé
  useEffect(() => {
    if (
      activeFilters.includes("system") &&
      !systemAppsLoaded &&
      !loadingSystemRef.current
    ) {
      loadSystemApps();
    }
  }, [activeFilters]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const profiles = await StorageService.getProfiles();
      const p = profiles.find((pr) => pr.id === profileId);
      if (p) {
        const full: Profile = {
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
      const activeP = await StorageService.getActiveProfile();
      setIsActiveProfile(activeP?.id === profileId);

      const userApps = await AppListService.getUserApps();
      setApps(
        userApps.sort((a, b) =>
          (a.appName ?? "").localeCompare(b.appName ?? ""),
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSystemApps = async () => {
    if (loadingSystemRef.current) return;
    loadingSystemRef.current = true;
    setSystemAppsLoading(true);
    try {
      const all = await AppListService.getAllApps();
      setApps(
        all.sort((a, b) => {
          if (a.isSystemApp !== b.isSystemApp) return a.isSystemApp ? 1 : -1;
          return (a.appName ?? "").localeCompare(b.appName ?? "");
        }),
      );
      setSystemAppsLoaded(true);
    } finally {
      setSystemAppsLoading(false);
      loadingSystemRef.current = false;
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

  // ── Sauvegarde générique du profil + resync VPN si profil actif ─────────────
  const saveProfileAndSync = async (updated: Profile) => {
    await StorageService.saveProfile(updated);
    setProfile(updated);

    // Si ce profil est le profil actif → resync VPN immédiatement
    if (isActiveProfile) {
      await ProfileService.onProfileChanged(updated);
    }
  };

  // ── Toggle app dans le profil ──────────────────────────────────────────────
  const toggleApp = async (packageName: string) => {
    if (!profile) return;
    const wasBlocked = blockedPackages.has(packageName);
    const nowBlocked = !wasBlocked;

    // Mise à jour optimiste de l'UI
    setBlockedPackages((prev) => {
      const next = new Set(prev);
      nowBlocked ? next.add(packageName) : next.delete(packageName);
      return next;
    });

    const updatedRules = [
      ...profile.rules.filter((r) => r.packageName !== packageName),
      {
        packageName,
        isBlocked: nowBlocked,
        profileId: profile.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const updated: Profile = { ...profile, rules: updatedRules };

    // Sauvegarde + sync VPN (si profil actif)
    await saveProfileAndSync(updated);
  };

  // ── Tout bloquer / tout autoriser ─────────────────────────────────────────
  const blockAll = async () => {
    if (!profile) return;
    const scope = activeFilters.includes("system")
      ? apps
      : apps.filter((a) => !a.isSystemApp);
    const allRules = scope.map((a) => ({
      packageName: a.packageName,
      isBlocked: true,
      profileId: profile.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const updated: Profile = { ...profile, rules: allRules };
    setBlockedPackages(new Set(scope.map((a) => a.packageName)));
    await saveProfileAndSync(updated);
  };

  const allowAll = async () => {
    if (!profile) return;
    const updated: Profile = { ...profile, rules: [] };
    setBlockedPackages(new Set());
    await saveProfileAndSync(updated);
  };

  // ── Planifications ─────────────────────────────────────────────────────────
  const handleScheduleSave = async (
    data: Omit<ProfileSchedule, "id">,
    editingId: string | null,
  ) => {
    if (!profile) return;
    let updatedSchedules: ProfileSchedule[];
    if (editingId) {
      updatedSchedules = profile.schedules.map((s) =>
        s.id === editingId ? { ...data, id: s.id } : s,
      );
    } else {
      updatedSchedules = [
        ...profile.schedules,
        { ...data, id: `sched_${Date.now()}` },
      ];
    }
    const updated: Profile = { ...profile, schedules: updatedSchedules };
    await saveProfileAndSync(updated);
  };

  const toggleSchedule = async (scheduleId: string) => {
    if (!profile) return;
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        schedules: prev.schedules.map((s) =>
          s.id === scheduleId ? { ...s, isActive: !s.isActive } : s,
        ),
      };
    });
    const updated: Profile = {
      ...profile,
      schedules: profile.schedules.map((s) =>
        s.id === scheduleId ? { ...s, isActive: !s.isActive } : s,
      ),
    };
    await saveProfileAndSync(updated);
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!profile) return;
    const updated: Profile = {
      ...profile,
      schedules: profile.schedules.filter((s) => s.id !== scheduleId),
    };
    await saveProfileAndSync(updated);
  };

  // ── Filtrage apps ──────────────────────────────────────────────────────────
  const filteredApps = apps.filter((a) => {
    if (!activeFilters.includes("system") && a.isSystemApp) return false;
    if (
      searchQuery &&
      !a.appName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.packageName.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    if (
      activeFilters.includes("blocked") &&
      !blockedPackages.has(a.packageName)
    )
      return false;
    if (activeFilters.includes("allowed") && blockedPackages.has(a.packageName))
      return false;
    return true;
  });

  const schedules = profile?.schedules ?? [];
  const hasSchedules = schedules.length > 0;
  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  const PROFILE_COLORS = [
    "#3DDB8A",
    "#7B6EF6",
    "#4D9FFF",
    "#FFB84D",
    "#F06292",
  ];
  const color = profile
    ? PROFILE_COLORS[
        parseInt(profile.id.replace(/\D/g, "").slice(-1) || "0", 10) %
          PROFILE_COLORS.length
      ]
    : "#3DDB8A";

  return (
    <View style={detail.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* Header */}
      <Animated.View
        style={[
          detail.header,
          { paddingTop: insets.top + 8, opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={detail.backBtn}>
          <Text style={detail.backText}>← Retour</Text>
        </TouchableOpacity>
        <View style={detail.headerMain}>
          <View
            style={[
              detail.avatar,
              { backgroundColor: color + "20", borderColor: color + "50" },
            ]}
          >
            <Text style={[detail.avatarText, { color }]}>
              {profile?.name.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={detail.profileName}>{profile?.name ?? "…"}</Text>
            <View style={detail.metaRow}>
              <Text style={detail.profileMeta}>
                {blockedPackages.size} bloquée(s)
              </Text>
              {isActiveProfile && (
                <View style={detail.activePill}>
                  <View
                    style={[detail.activeDot, { backgroundColor: color }]}
                  />
                  <Text style={[detail.activeText, { color }]}>ACTIF</Text>
                </View>
              )}
              {isActiveProfile && !hasSchedules && (
                <View style={detail.immediatePill}>
                  <Text style={detail.immediateText}>blocage immédiat</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={detail.tabBar}>
          <Animated.View
            style={[detail.tabIndicator, { left: tabIndicatorLeft }]}
          />
          <TouchableOpacity
            style={detail.tab}
            onPress={() => switchTab("apps")}
          >
            <Text
              style={[
                detail.tabText,
                activeTab === "apps" && detail.tabTextActive,
              ]}
            >
              📱 Applications ({blockedPackages.size}/{filteredApps.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={detail.tab}
            onPress={() => switchTab("schedules")}
          >
            <Text
              style={[
                detail.tabText,
                activeTab === "schedules" && detail.tabTextActive,
              ]}
            >
              🕐 Planification ({schedules.length})
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── APPS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "apps" && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <View style={detail.searchBar}>
            <SearchAndFilters
              query={searchQuery}
              onQueryChange={setSearchQuery}
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              systemAppsLoaded={systemAppsLoaded}
              systemAppsLoading={systemAppsLoading}
            />
          </View>

          <View style={detail.bulkRow}>
            <TouchableOpacity style={detail.bulkBtn} onPress={blockAll}>
              <Text style={detail.bulkBtnText}>🚫 Tout bloquer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={detail.bulkBtn} onPress={allowAll}>
              <Text style={detail.bulkBtnText}>✅ Tout autoriser</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={detail.center}>
              <Text style={{ color: "#3A3A58" }}>Chargement…</Text>
            </View>
          ) : (
            <FlatList
              data={filteredApps}
              keyExtractor={(item) => item.packageName}
              renderItem={({ item }) => (
                <AppRow
                  app={item}
                  isBlocked={blockedPackages.has(item.packageName)}
                  isSystem={item.isSystemApp}
                  onToggle={() => toggleApp(item.packageName)}
                />
              )}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 40,
              }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={detail.center}>
                  <Text style={{ color: "#3A3A58", marginTop: 40 }}>
                    Aucune application
                  </Text>
                </View>
              }
            />
          )}
        </Animated.View>
      )}

      {/* ── SCHEDULES TAB ──────────────────────────────────────────────────── */}
      {activeTab === "schedules" && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            contentContainerStyle={[
              detail.schedulesList,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Info bannière */}
            {!hasSchedules ? (
              <View style={detail.noScheduleBanner}>
                <Text style={detail.noScheduleIcon}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={detail.noScheduleTitle}>Blocage immédiat</Text>
                  <Text style={detail.noScheduleText}>
                    Ce profil n'a pas de planification. Dès qu'il est activé,
                    les {blockedPackages.size} app(s) configurées sont bloquées
                    instantanément.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={detail.infoBanner}>
                <Text style={detail.infoIcon}>💡</Text>
                <Text style={detail.infoText}>
                  Les plages horaires contrôlent l'activation automatique du
                  profil. Sans planification active, le profil applique ses
                  règles immédiatement.
                </Text>
              </View>
            )}

            {schedules.map((s) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                onToggle={() => toggleSchedule(s.id)}
                onDelete={() => deleteSchedule(s.id)}
                onEdit={() => {
                  editingIdRef.current = s.id;
                  setEditingSchedule(s);
                  setScheduleModalVisible(true);
                }}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[detail.addSchedFab, { bottom: insets.bottom + 24 }]}
            onPress={() => {
              editingIdRef.current = null;
              setEditingSchedule(null);
              setScheduleModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={detail.addSchedFabText}>+ Ajouter une plage</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScheduleModal
        visible={scheduleModalVisible}
        onClose={() => {
          setScheduleModalVisible(false);
          setEditingSchedule(null);
        }}
        onSave={(data, editingId) => handleScheduleSave(data, editingId)}
        editingSchedule={editingSchedule}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const detail = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  backBtn: { marginBottom: 14 },
  backText: { color: "#3DDB8A", fontSize: 14, fontWeight: "600" },
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  profileMeta: { fontSize: 12, color: "#3A3A58" },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0D221880",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#1E6A4640",
  },
  activeDot: { width: 5, height: 5, borderRadius: 3 },
  activeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  immediatePill: {
    backgroundColor: "#7B6EF618",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#7B6EF640",
  },
  immediateText: { fontSize: 9, color: "#7B6EF6", fontWeight: "700" },

  tabBar: {
    flexDirection: "row",
    position: "relative",
    height: 44,
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 0,
  },
  tabIndicator: {
    position: "absolute",
    width: "50%",
    height: "100%",
    backgroundColor: "#7B6EF618",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7B6EF640",
  },
  tab: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#3A3A58" },
  tabTextActive: { color: "#7B6EF6" },

  searchBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  bulkRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  bulkBtn: {
    flex: 1,
    backgroundColor: "#14141E",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  bulkBtnText: { fontSize: 12, color: "#5A5A80", fontWeight: "600" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  schedulesList: { paddingHorizontal: 20, paddingTop: 16 },

  // Bannière "pas de planification = blocage immédiat"
  noScheduleBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#0D1A1280",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3DDB8A30",
    marginBottom: 20,
  },
  noScheduleIcon: { fontSize: 22 },
  noScheduleTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3DDB8A",
    marginBottom: 4,
  },
  noScheduleText: {
    fontSize: 13,
    color: "#4A8A6A",
    lineHeight: 20,
  },

  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#7B6EF610",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#7B6EF630",
    marginBottom: 16,
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 13, color: "#5A5A80", lineHeight: 20 },

  addSchedFab: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  addSchedFabText: {
    color: "#F0F0FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
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
  },
  containerInactive: { opacity: 0.5 },
  left: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  label: { fontSize: 14, fontWeight: "700", color: "#F0F0FF" },
  nowBadge: {
    backgroundColor: "#3DDB8A20",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#3DDB8A60",
  },
  nowBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#3DDB8A",
    letterSpacing: 1,
  },
  actionBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  actionBadgeGreen: {
    backgroundColor: "#3DDB8A15",
    borderColor: "#3DDB8A40",
  },
  actionBadgeRed: { backgroundColor: "#D0407015", borderColor: "#D0407040" },
  actionBadgeText: { fontSize: 9, fontWeight: "700" },
  time: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F0F0FF",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  daysRow: { flexDirection: "row", gap: 4 },
  day: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C2C",
  },
  dayActive: {
    backgroundColor: "#7B6EF625",
    borderWidth: 1,
    borderColor: "#7B6EF650",
  },
  dayText: { fontSize: 9, fontWeight: "700", color: "#3A3A58" },
  dayTextActive: { color: "#7B6EF6" },
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
  editBtnText: { fontSize: 14, color: "#5A5A80" },
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
  deleteBtnText: { fontSize: 13 },
});

const ar = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1C1C2C",
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
  iconSystem: { backgroundColor: "#141422" },
  iconLetter: { fontSize: 18, fontWeight: "800", color: "#3DDB8A" },
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
  systemDot: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#141230",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2450",
  },
  systemDotText: { fontSize: 7, color: "#8880C0" },
  info: { flex: 1, marginRight: 12 },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E8E8F8",
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  nameBlocked: {
    color: "#806080",
    textDecorationLine: "line-through",
  },
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
