import PaywallModal from "@/components/PaywallModal";
import ScheduleModal from "@/components/ScheduleModal";
import SearchAndFilters, {
  DEFAULT_FILTERS,
  Filters,
} from "@/components/SearchAndFilters";
import { usePremium } from "@/hooks/usePremium";
import AppListService from "@/services/app-list.service";
import ProfileService from "@/services/profile.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
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
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
const PROFILE_COLORS = ["#3DDB8A", "#7B6EF6", "#4D9FFF", "#FFB84D", "#F06292"];

const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

const getProfileColor = (id: string) =>
  PROFILE_COLORS[
    parseInt(id.replace(/\D/g, "").slice(-1) || "0", 10) % PROFILE_COLORS.length
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

// ─── Schedule Row ─────────────────────────────────────────────────────────────
const ScheduleRow = React.memo(function ScheduleRow({
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
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = schedule.startHour * 60 + schedule.startMinute;
    const endMins = schedule.endHour * 60 + schedule.endMinute;
    return (
      schedule.days.includes(now.getDay()) &&
      nowMins >= startMins &&
      nowMins < endMins
    );
  })();
  const isActivate = schedule.action === "activate";
  const accent = isActivate ? "#2DB870" : "#C04060";
  const accentBg = isActivate ? "#081410" : "#140810";
  const accentBorder = isActivate ? "#0E3020" : "#3A1020";

  return (
    <View style={[sr.container, !schedule.isActive && sr.containerInactive]}>
      <View style={[sr.accentBar, { backgroundColor: accent }]} />
      <View style={sr.left}>
        <View style={sr.topRow}>
          <Text style={sr.label} numberOfLines={1}>
            {schedule.label || "Sans nom"}
          </Text>
          {isNow && schedule.isActive && (
            <View style={sr.nowBadge}>
              <PulseDot color="#2DB870" />
              <Text style={sr.nowBadgeText}>EN COURS</Text>
            </View>
          )}
          <View
            style={[
              sr.actionBadge,
              { backgroundColor: accentBg, borderColor: accentBorder },
            ]}
          >
            <Text style={[sr.actionBadgeText, { color: accent }]}>
              {isActivate ? "◎ Activer" : "◉ Désactiver"}
            </Text>
          </View>
        </View>
        <Text style={sr.time}>
          {fmtTime(schedule.startHour, schedule.startMinute)}
          <Text style={sr.timeArrow}> → </Text>
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
        <TouchableOpacity
          style={sr.editBtn}
          onPress={onEdit}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
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
        <TouchableOpacity
          style={sr.deleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={sr.deleteBtnText}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── App Row ──────────────────────────────────────────────────────────────────
const AppRow = React.memo(function AppRow({
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
      style={[ar.container, isBlocked && ar.containerBlocked]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      {isBlocked && <View style={ar.accentBar} />}
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
            <Text style={ar.systemDotText}>◈</Text>
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
  const [isActiveProfile, setIsActiveProfile] = useState(false);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [blockedPackages, setBlockedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [activeTab, setActiveTab] = useState<"apps" | "schedules">("apps");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [systemAppsLoaded, setSystemAppsLoaded] = useState(false);
  const [systemAppsLoading, setSystemAppsLoading] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ProfileSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { isPremium, refresh: refreshPremium } = usePremium();

  const loadingSystemRef = useRef(false);
  const editingIdRef = useRef<string | null>(null);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (
      (filters.scope === "system" || filters.scope === "all") &&
      !systemAppsLoaded &&
      !loadingSystemRef.current
    )
      loadSystemApps();
  }, [filters.scope]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profiles, activeP] = await Promise.all([
        StorageService.getProfiles(),
        StorageService.getActiveProfile(),
      ]);
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
    setSystemAppsLoaded(false);
    await loadSystemApps(true);
  }, [profileId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const loadSystemApps = async (force = false) => {
    if (!force && loadingSystemRef.current) return;
    loadingSystemRef.current = true;
    setSystemAppsLoading(true);
    try {
      const all = await AppListService.getAllApps();
      setApps(
        all.sort((a, b) => {
          if (a.isSystemApp !== b.isSystemApp)
            return a.isSystemApp === true ? 1 : -1;
          return (a.appName ?? "").localeCompare(b.appName ?? "");
        }),
      );
      setSystemAppsLoaded(true);
    } finally {
      setSystemAppsLoading(false);
      loadingSystemRef.current = false;
    }
  };

  const switchTab = useCallback((tab: "apps" | "schedules") => {
    setActiveTab(tab);
    Animated.timing(tabAnim, {
      toValue: tab === "apps" ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, []);

  const saveProfileAndSync = useCallback(
    async (updated: Profile) => {
      await StorageService.saveProfile(updated);
      setProfile(updated);
      if (isActiveProfile) await ProfileService.onProfileChanged(updated);
    },
    [isActiveProfile],
  );

  const toggleApp = useCallback(
    async (packageName: string) => {
      if (!profile) return;
      const nowBlocked = !blockedPackages.has(packageName);
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
      await saveProfileAndSync({ ...profile, rules: updatedRules });
    },
    [profile, blockedPackages, saveProfileAndSync],
  );

  const blockAll = useCallback(async () => {
    if (!profile) return;
    const scope =
      filters.scope === "system"
        ? apps.filter((a) => !!a.isSystemApp)
        : filters.scope === "all"
          ? apps
          : apps.filter((a) => !a.isSystemApp);
    const allRules = scope.map((a) => ({
      packageName: a.packageName,
      isBlocked: true,
      profileId: profile.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    setBlockedPackages(new Set(scope.map((a) => a.packageName)));
    await saveProfileAndSync({ ...profile, rules: allRules });
  }, [profile, apps, filters.scope, saveProfileAndSync]);

  const allowAll = useCallback(async () => {
    if (!profile) return;
    setBlockedPackages(new Set());
    await saveProfileAndSync({ ...profile, rules: [] });
  }, [profile, saveProfileAndSync]);

  const handleScheduleSave = useCallback(
    async (data: Omit<ProfileSchedule, "id">, editingId: string | null) => {
      if (!profile) return;
      if (
        !editingId &&
        !isPremium &&
        profile.schedules.length >= FREE_LIMITS.MAX_SCHEDULES
      ) {
        setPaywallVisible(true);
        return;
      }
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
      await saveProfileAndSync({ ...profile, schedules: updatedSchedules });
    },
    [profile, saveProfileAndSync, isPremium],
  );

  const toggleSchedule = useCallback(
    async (scheduleId: string) => {
      if (!profile) return;
      await saveProfileAndSync({
        ...profile,
        schedules: profile.schedules.map((s) =>
          s.id === scheduleId ? { ...s, isActive: !s.isActive } : s,
        ),
      });
    },
    [profile, saveProfileAndSync],
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (!profile) return;
      await saveProfileAndSync({
        ...profile,
        schedules: profile.schedules.filter((s) => s.id !== scheduleId),
      });
    },
    [profile, saveProfileAndSync],
  );

  const filteredApps = useMemo(
    () =>
      apps.filter((a) => {
        if (filters.scope === "user" && a.isSystemApp === true) return false;
        if (filters.scope === "system" && a.isSystemApp !== true) return false;
        if (
          searchQuery &&
          !a.appName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !a.packageName.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;
        if (filters.state === "blocked" && !blockedPackages.has(a.packageName))
          return false;
        if (filters.state === "allowed" && blockedPackages.has(a.packageName))
          return false;
        return true;
      }),
    [apps, filters, searchQuery, blockedPackages],
  );

  const keyExtractor = useCallback(
    (item: InstalledApp) => item.packageName,
    [],
  );
  const renderApp = useCallback(
    ({ item }: { item: InstalledApp }) => (
      <AppRow
        app={item}
        isBlocked={blockedPackages.has(item.packageName)}
        isSystem={item.isSystemApp}
        onToggle={() => toggleApp(item.packageName)}
      />
    ),
    [blockedPackages, toggleApp],
  );

  const schedules = profile?.schedules ?? [];
  const hasSchedules = schedules.length > 0;
  const color = profile ? getProfileColor(profile.id) : "#7B6EF6";
  const scheduleLimitReached =
    !isPremium && schedules.length >= FREE_LIMITS.MAX_SCHEDULES;

  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  return (
    <View style={[detail.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#07070F" />

      {/* ── Header ── */}
      <Animated.View style={[detail.header, { opacity: fadeAnim }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={detail.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={detail.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={detail.headerMain}>
          <View
            style={[
              detail.avatar,
              { backgroundColor: color + "18", borderColor: color + "40" },
            ]}
          >
            <Text style={[detail.avatarText, { color }]}>
              {profile?.name.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={detail.profileName} numberOfLines={1}>
              {profile?.name ?? "…"}
            </Text>
            <View style={detail.metaRow}>
              <Text style={detail.profileMeta}>
                {blockedPackages.size} bloquée(s)
              </Text>
              {isActiveProfile && (
                <View style={detail.activePill}>
                  <PulseDot color="#2DB870" />
                  <Text style={detail.activeText}>ACTIF</Text>
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
              ◎ Apps ({blockedPackages.size}/{filteredApps.length})
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
              ◷ Plages ({schedules.length})
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Apps tab ── */}
      {activeTab === "apps" && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <View style={detail.searchBar}>
            <SearchAndFilters
              query={searchQuery}
              onQueryChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
              systemAppsLoaded={systemAppsLoaded}
              systemAppsLoading={systemAppsLoading}
            />
          </View>
          <View style={detail.bulkRow}>
            <TouchableOpacity
              style={[detail.bulkBtn, detail.bulkBtnBlock]}
              onPress={blockAll}
            >
              <Text style={detail.bulkBtnBlockText}>◉ Tout bloquer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[detail.bulkBtn, detail.bulkBtnAllow]}
              onPress={allowAll}
            >
              <Text style={detail.bulkBtnAllowText}>◎ Tout autoriser</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={detail.center}>
              <Text style={{ color: "#3A3A58" }}>Chargement…</Text>
            </View>
          ) : (
            <FlatList
              data={filteredApps}
              keyExtractor={keyExtractor}
              renderItem={renderApp}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingBottom: insets.bottom + 40,
              }}
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
              ListEmptyComponent={
                <View style={detail.center}>
                  <View style={detail.emptyIconWrap}>
                    <Text style={detail.emptyIcon}>◈</Text>
                  </View>
                  <Text style={detail.emptyTitle}>Aucune application</Text>
                  <Text style={detail.emptySubtitle}>
                    Modifiez votre recherche ou vos filtres
                  </Text>
                </View>
              }
            />
          )}
        </Animated.View>
      )}

      {/* ── Schedules tab ── */}
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
            {!hasSchedules ? (
              <View style={detail.noScheduleBanner}>
                <View style={detail.noScheduleIconWrap}>
                  <Text style={detail.noScheduleIcon}>⚡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={detail.noScheduleTitle}>Blocage immédiat</Text>
                  <Text style={detail.noScheduleText}>
                    Aucune planification — dès activation, les{" "}
                    {blockedPackages.size} app(s) sont bloquées instantanément.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={detail.infoBanner}>
                <Text style={detail.infoIcon}>◈</Text>
                <Text style={detail.infoText}>
                  Les plages contrôlent l'activation automatique du profil.
                </Text>
              </View>
            )}

            {/* Limite gratuite */}
            {scheduleLimitReached && (
              <TouchableOpacity
                style={detail.limitBanner}
                onPress={() => setPaywallVisible(true)}
                activeOpacity={0.85}
              >
                <View style={detail.limitIconWrap}>
                  <Text style={detail.limitIcon}>◈</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={detail.limitTitle}>
                    Limite atteinte — {schedules.length}/
                    {FREE_LIMITS.MAX_SCHEDULES} plage
                  </Text>
                  <Text style={detail.limitSub}>
                    Passez à Premium pour des planifications illimitées
                  </Text>
                </View>
                <View style={detail.limitCta}>
                  <Text style={detail.limitCtaText}>⚡ Pro</Text>
                </View>
              </TouchableOpacity>
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
            style={[
              detail.addSchedFab,
              { bottom: insets.bottom + 24 },
              scheduleLimitReached && detail.addSchedFabLocked,
            ]}
            onPress={() => {
              if (scheduleLimitReached) {
                setPaywallVisible(true);
                return;
              }
              editingIdRef.current = null;
              setEditingSchedule(null);
              setScheduleModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={detail.addSchedFabText}>
              {scheduleLimitReached
                ? "🔒 Débloquer avec Premium"
                : "+ Ajouter une plage"}
            </Text>
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

      {/* ── PaywallModal ── */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        reason="schedules"
        onUpgraded={() => {
          setPaywallVisible(false);
          refreshPremium();
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const detail = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070F" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#111120",
    backgroundColor: "#07070F",
  },
  backBtn: { marginBottom: 14 },
  backText: { color: "#7B6EF6", fontSize: 14, fontWeight: "600" },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  avatarText: { fontSize: 22, fontWeight: "800" },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#EDEDFF",
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  profileMeta: { fontSize: 11, color: "#2E2E48" },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#081410",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#0E3020",
  },
  activeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2DB870",
    letterSpacing: 1,
  },
  immediatePill: {
    backgroundColor: "#16103A",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#3A3480",
  },
  immediateText: { fontSize: 9, color: "#7B6EF6", fontWeight: "700" },

  tabBar: {
    flexDirection: "row",
    position: "relative",
    height: 44,
    backgroundColor: "#0C0C16",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#141428",
  },
  tabIndicator: {
    position: "absolute",
    width: "50%",
    height: "100%",
    backgroundColor: "#16103A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3A3480",
  },
  tab: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#2A2A48" },
  tabTextActive: { color: "#9B8FFF" },

  searchBar: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  bulkRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 10,
  },
  bulkBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  bulkBtnBlock: { backgroundColor: "#140810", borderColor: "#3A1020" },
  bulkBtnAllow: { backgroundColor: "#081410", borderColor: "#0E3020" },
  bulkBtnBlockText: { fontSize: 12, color: "#C04060", fontWeight: "700" },
  bulkBtnAllowText: { fontSize: 12, color: "#2DB870", fontWeight: "700" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#3A3480",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyIcon: { fontSize: 26, color: "#4A3A9A" },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#C0C0D8",
    marginBottom: 6,
  },
  emptySubtitle: { fontSize: 12, color: "#2A2A48" },

  schedulesList: { paddingHorizontal: 18, paddingTop: 16 },

  noScheduleBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#081410",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#0E3020",
    marginBottom: 20,
  },
  noScheduleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#0A2018",
    borderWidth: 1,
    borderColor: "#1A5034",
    justifyContent: "center",
    alignItems: "center",
  },
  noScheduleIcon: { fontSize: 16, color: "#2DB870" },
  noScheduleTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2DB870",
    marginBottom: 4,
  },
  noScheduleText: { fontSize: 12, color: "#2A6A44", lineHeight: 18 },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#16103A",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3A3480",
    marginBottom: 16,
  },
  infoIcon: { fontSize: 14, color: "#7B6EF6" },
  infoText: { flex: 1, fontSize: 12, color: "#5A5080", lineHeight: 19 },

  // Limite banner
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#100C04",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A2800",
    padding: 14,
    marginBottom: 16,
  },
  limitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#1E1400",
    borderWidth: 1,
    borderColor: "#4A3400",
    justifyContent: "center",
    alignItems: "center",
  },
  limitIcon: { fontSize: 15, color: "#C07010" },
  limitTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#C07010",
    marginBottom: 2,
  },
  limitSub: { fontSize: 11, color: "#6A4A10" },
  limitCta: {
    backgroundColor: "#7B6EF625",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#7B6EF640",
  },
  limitCtaText: { fontSize: 11, fontWeight: "800", color: "#9B8FFF" },

  addSchedFab: {
    position: "absolute",
    left: 18,
    right: 18,
    backgroundColor: "#7B6EF6",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 8,
  },
  addSchedFabLocked: {
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#3A3480",
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
    backgroundColor: "#0C0C16",
    borderRadius: 16,
    padding: 16,
    paddingLeft: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#141428",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  containerInactive: { opacity: 0.4 },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  left: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  label: { fontSize: 13, fontWeight: "700", color: "#D8D8F0" },
  nowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#081410",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#0E3020",
  },
  nowBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#2DB870",
    letterSpacing: 1,
  },
  actionBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
  },
  actionBadgeText: { fontSize: 9, fontWeight: "700" },
  time: {
    fontSize: 20,
    fontWeight: "800",
    color: "#D8D8F0",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  timeArrow: { fontSize: 16, color: "#2A2A48", fontWeight: "400" },
  daysRow: { flexDirection: "row", gap: 4 },
  day: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  dayActive: { backgroundColor: "#16103A", borderColor: "#3A3480" },
  dayText: { fontSize: 9, fontWeight: "700", color: "#2A2A48" },
  dayTextActive: { color: "#9B8FFF" },
  right: { alignItems: "center", gap: 10 },
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
    width: 38,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    padding: 2,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: "#081410", borderColor: "#0E3020" },
  toggleOff: { backgroundColor: "#0E0E18", borderColor: "#141428" },
  toggleThumb: { width: 16, height: 16, borderRadius: 8 },
  thumbOn: { backgroundColor: "#2DB870", alignSelf: "flex-end" },
  thumbOff: { backgroundColor: "#2A2A3A", alignSelf: "flex-start" },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#140810",
    borderWidth: 1,
    borderColor: "#2A1018",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 13, color: "#C04060" },
});

const ar = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0C0C16",
    borderRadius: 14,
    padding: 12,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "#141428",
    overflow: "hidden",
  },
  containerBlocked: { backgroundColor: "#100810", borderColor: "#2A1020" },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: "#C04060",
  },
  iconWrap: { position: "relative", marginRight: 12 },
  icon: { width: 44, height: 44, borderRadius: 12 },
  iconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#141420",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1E30",
  },
  iconSystem: { backgroundColor: "#0E0E20" },
  iconLetter: { fontSize: 18, fontWeight: "800", color: "#3A3A7A" },
  blockedDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#C04060",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#07070F",
  },
  blockedDotText: { fontSize: 7, color: "#FFF", fontWeight: "800" },
  systemDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0E0E20",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2450",
  },
  systemDotText: { fontSize: 8, color: "#5A5090" },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 13, fontWeight: "600", color: "#D8D8F0", marginBottom: 3 },
  nameBlocked: { color: "#5A3A5A", textDecorationLine: "line-through" },
  pkg: { fontSize: 10, color: "#1E1E38", fontFamily: "monospace" },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    padding: 2,
    borderWidth: 1,
  },
  toggleAllowed: { backgroundColor: "#081410", borderColor: "#0E3020" },
  toggleBlocked: { backgroundColor: "#140810", borderColor: "#3A1020" },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  thumbAllowed: { backgroundColor: "#2DB870", alignSelf: "flex-end" },
  thumbBlocked: { backgroundColor: "#C04060", alignSelf: "flex-start" },
});
