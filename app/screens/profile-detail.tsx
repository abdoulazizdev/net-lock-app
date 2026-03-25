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
import { Colors, Semantic, useTheme } from "@/theme";
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
const PROFILE_COLORS = [
  Colors.green[400],
  Colors.purple[400],
  Colors.blue[400],
  Colors.amber[400],
  "#F06292",
];
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const getProfileColor = (id: string) =>
  PROFILE_COLORS[
    parseInt(id.replace(/\D/g, "").slice(-1) || "0", 10) % PROFILE_COLORS.length
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

// ─── ScheduleRow ──────────────────────────────────────────────────────────────
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
  const { t } = useTheme();
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
  const accent = isActivate ? t.allowed.accent : t.blocked.accent;
  const accentBg = isActivate ? t.allowed.bg : t.blocked.bg;
  const accentBorder = isActivate ? t.allowed.border : t.blocked.border;

  return (
    <View
      style={[
        sr.container,
        { backgroundColor: t.bg.card, borderColor: t.border.light },
        !schedule.isActive && { opacity: 0.4 },
      ]}
    >
      <View style={[sr.accentBar, { backgroundColor: accent }]} />
      <View style={sr.left}>
        <View style={sr.topRow}>
          <Text style={[sr.label, { color: t.text.primary }]} numberOfLines={1}>
            {schedule.label || "Sans nom"}
          </Text>
          {isNow && schedule.isActive && (
            <View
              style={[
                sr.nowBadge,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
            >
              <PulseDot color={t.allowed.accent} />
              <Text style={[sr.nowBadgeText, { color: t.allowed.text }]}>
                EN COURS
              </Text>
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
        <Text style={[sr.time, { color: t.text.primary }]}>
          {fmtTime(schedule.startHour, schedule.startMinute)}
          <Text style={[sr.timeArrow, { color: t.border.normal }]}> → </Text>
          {fmtTime(schedule.endHour, schedule.endMinute)}
        </Text>
        <View style={sr.daysRow}>
          {DAYS_SHORT.map((d, i) => (
            <View
              key={i}
              style={[
                sr.day,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
                schedule.days.includes(i) && {
                  backgroundColor: t.bg.accent,
                  borderColor: t.border.focus,
                },
              ]}
            >
              <Text
                style={[
                  sr.dayText,
                  {
                    color: schedule.days.includes(i)
                      ? t.text.link
                      : t.text.muted,
                  },
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
          style={[
            sr.editBtn,
            { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          ]}
          onPress={onEdit}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[sr.editBtnText, { color: t.text.secondary }]}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggle}>
          <View
            style={[
              sr.toggle,
              schedule.isActive
                ? {
                    backgroundColor: t.allowed.bg,
                    borderColor: t.allowed.border,
                  }
                : {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
            ]}
          >
            <View
              style={[
                sr.toggleThumb,
                schedule.isActive
                  ? { backgroundColor: t.allowed.accent, alignSelf: "flex-end" }
                  : {
                      backgroundColor: t.border.normal,
                      alignSelf: "flex-start",
                    },
              ]}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            sr.deleteBtn,
            { backgroundColor: t.danger.bg, borderColor: t.danger.border },
          ]}
          onPress={onDelete}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[sr.deleteBtnText, { color: t.danger.accent }]}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── AppRow ───────────────────────────────────────────────────────────────────
const AppRow = React.memo(function AppRow({
  app,
  isBlocked,
  isSystem,
  cannotBlock,
  onToggle,
}: {
  app: InstalledApp;
  isBlocked: boolean;
  isSystem: boolean;
  cannotBlock: boolean; // ← NOUVEAU : limite gratuit atteinte et pas encore bloquée
  onToggle: () => void;
}) {
  const { t } = useTheme();

  return (
    <TouchableOpacity
      style={[
        ar.container,
        { backgroundColor: t.bg.card, borderColor: t.border.light },
        isBlocked && {
          backgroundColor: t.blocked.bg,
          borderColor: t.blocked.border,
        },
        // Dimmer la carte si elle ne peut pas être bloquée
        cannotBlock && { opacity: 0.45 },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      {isBlocked && (
        <View style={[ar.accentBar, { backgroundColor: t.blocked.accent }]} />
      )}
      <View style={ar.iconWrap}>
        {app.icon ? (
          <Image
            source={{ uri: `data:image/png;base64,${app.icon}` }}
            style={ar.icon}
          />
        ) : (
          <View
            style={[
              ar.iconPlaceholder,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              isSystem && { borderColor: t.border.strong },
            ]}
          >
            <Text style={[ar.iconLetter, { color: t.text.muted }]}>
              {(app.appName ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {isBlocked && (
          <View
            style={[
              ar.blockedDot,
              { backgroundColor: t.blocked.accent, borderColor: t.bg.page },
            ]}
          >
            <Text style={ar.blockedDotText}>✕</Text>
          </View>
        )}
        {/* Cadenas si limite atteinte et app non bloquée */}
        {cannotBlock && !isBlocked && (
          <View
            style={[
              ar.blockedDot,
              { backgroundColor: t.border.strong, borderColor: t.bg.page },
            ]}
          >
            <Text style={ar.blockedDotText}>🔒</Text>
          </View>
        )}
        {isSystem && !isBlocked && !cannotBlock && (
          <View
            style={[
              ar.systemDot,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.strong },
            ]}
          >
            <Text style={[ar.systemDotText, { color: t.text.muted }]}>◈</Text>
          </View>
        )}
      </View>
      <View style={ar.info}>
        <Text
          style={[
            ar.name,
            { color: isBlocked ? t.text.muted : t.text.primary },
            isBlocked && ar.nameBlocked,
          ]}
          numberOfLines={1}
        >
          {app.appName}
        </Text>
        <Text style={[ar.pkg, { color: t.border.strong }]} numberOfLines={1}>
          {app.packageName}
        </Text>
      </View>
      <View
        style={[
          ar.toggle,
          isBlocked
            ? { backgroundColor: t.blocked.bg, borderColor: t.blocked.border }
            : cannotBlock
              ? { backgroundColor: t.bg.cardAlt, borderColor: t.border.light }
              : {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
        ]}
      >
        <View
          style={[
            ar.toggleThumb,
            isBlocked
              ? { backgroundColor: t.blocked.accent, alignSelf: "flex-start" }
              : cannotBlock
                ? { backgroundColor: t.border.normal, alignSelf: "flex-start" }
                : { backgroundColor: t.allowed.accent, alignSelf: "flex-end" },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileDetailScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();

  const { isPremium, refresh: refreshPremium } = usePremium();

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
  const [paywallReason, setPaywallReason] = useState<
    "blocked_apps" | "schedules"
  >("blocked_apps");

  const loadingSystemRef = useRef(false);
  const editingIdRef = useRef<string | null>(null);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Limite apps bloquées ───────────────────────────────────────────────────
  // La limite s'applique au niveau GLOBAL (toutes règles confondues),
  // pas seulement au profil courant — cohérent avec HomeScreen.
  const blockedCount = blockedPackages.size;
  const limitReached =
    !isPremium && blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS;

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

  // ── Data loading ─────────────────────────────────────────────────────────
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

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const switchTab = useCallback((tab: "apps" | "schedules") => {
    setActiveTab(tab);
    Animated.timing(tabAnim, {
      toValue: tab === "apps" ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, []);

  // ── Profile mutations ──────────────────────────────────────────────────────
  const saveProfileAndSync = useCallback(
    async (updated: Profile) => {
      await StorageService.saveProfile(updated);
      setProfile(updated);
      if (isActiveProfile) await ProfileService.onProfileChanged(updated);
    },
    [isActiveProfile],
  );

  // ── toggleApp avec gate FREE_LIMITS ───────────────────────────────────────
  const toggleApp = useCallback(
    async (packageName: string) => {
      if (!profile) return;
      const nowBlocked = !blockedPackages.has(packageName);

      // ── GATE : si on essaie de bloquer et que la limite est atteinte
      if (
        nowBlocked &&
        !isPremium &&
        blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS
      ) {
        setPaywallReason("blocked_apps");
        setPaywallVisible(true);
        return;
      }

      // Mise à jour optimiste
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

      try {
        await saveProfileAndSync({ ...profile, rules: updatedRules });
      } catch {
        // Rollback en cas d'erreur
        setBlockedPackages((prev) => {
          const next = new Set(prev);
          nowBlocked ? next.delete(packageName) : next.add(packageName);
          return next;
        });
      }
    },
    [profile, blockedPackages, blockedCount, isPremium, saveProfileAndSync],
  );

  // ── blockAll avec gate ────────────────────────────────────────────────────
  const blockAll = useCallback(async () => {
    if (!profile) return;

    const scope =
      filters.scope === "system"
        ? apps.filter((a) => !!a.isSystemApp)
        : filters.scope === "all"
          ? apps
          : apps.filter((a) => !a.isSystemApp);

    // Combien d'apps seraient nouvellement bloquées ?
    const newlyBlocked = scope.filter(
      (a) => !blockedPackages.has(a.packageName),
    );
    const totalAfter = blockedCount + newlyBlocked.length;

    if (!isPremium && totalAfter > FREE_LIMITS.MAX_BLOCKED_APPS) {
      setPaywallReason("blocked_apps");
      setPaywallVisible(true);
      return;
    }

    const allRules = scope.map((a) => ({
      packageName: a.packageName,
      isBlocked: true,
      profileId: profile.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    setBlockedPackages(new Set(scope.map((a) => a.packageName)));
    await saveProfileAndSync({ ...profile, rules: allRules });
  }, [
    profile,
    apps,
    filters.scope,
    blockedPackages,
    blockedCount,
    isPremium,
    saveProfileAndSync,
  ]);

  const allowAll = useCallback(async () => {
    if (!profile) return;
    setBlockedPackages(new Set());
    await saveProfileAndSync({ ...profile, rules: [] });
  }, [profile, saveProfileAndSync]);

  // ── Schedule save — gate premium ──────────────────────────────────────────
  const handleScheduleSave = useCallback(
    async (data: Omit<ProfileSchedule, "id">, editingId: string | null) => {
      if (!profile) return;
      if (
        !editingId &&
        !isPremium &&
        profile.schedules.length >= FREE_LIMITS.MAX_SCHEDULES
      ) {
        setPaywallReason("schedules");
        setPaywallVisible(true);
        return;
      }
      const updatedSchedules = editingId
        ? profile.schedules.map((s) =>
            s.id === editingId ? { ...data, id: s.id } : s,
          )
        : [...profile.schedules, { ...data, id: `sched_${Date.now()}` }];
      await saveProfileAndSync({ ...profile, schedules: updatedSchedules });
    },
    [profile, saveProfileAndSync, isPremium],
  );

  const toggleSchedule = useCallback(
    async (id: string) => {
      if (!profile) return;
      await saveProfileAndSync({
        ...profile,
        schedules: profile.schedules.map((s) =>
          s.id === id ? { ...s, isActive: !s.isActive } : s,
        ),
      });
    },
    [profile, saveProfileAndSync],
  );

  const deleteSchedule = useCallback(
    async (id: string) => {
      if (!profile) return;
      await saveProfileAndSync({
        ...profile,
        schedules: profile.schedules.filter((s) => s.id !== id),
      });
    },
    [profile, saveProfileAndSync],
  );

  // ── Filters ───────────────────────────────────────────────────────────────
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
    ({ item }: { item: InstalledApp }) => {
      const isBlocked = blockedPackages.has(item.packageName);
      // cannotBlock : limite atteinte ET l'app n'est pas encore bloquée
      const cannotBlock = limitReached && !isBlocked;
      return (
        <AppRow
          app={item}
          isBlocked={isBlocked}
          isSystem={item.isSystemApp}
          cannotBlock={cannotBlock}
          onToggle={() => toggleApp(item.packageName)}
        />
      );
    },
    [blockedPackages, limitReached, toggleApp],
  );

  const schedules = profile?.schedules ?? [];
  const hasSchedules = schedules.length > 0;
  const color = profile ? getProfileColor(profile.id) : Colors.purple[400];
  const scheduleLimitReached =
    !isPremium && schedules.length >= FREE_LIMITS.MAX_SCHEDULES;
  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  return (
    <View
      style={[
        detail.container,
        { backgroundColor: t.bg.page, paddingTop: insets.top },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* ── Header ── */}
      <Animated.View
        style={[
          detail.header,
          {
            backgroundColor: Semantic.bg.header,
            borderBottomColor: "rgba(255,255,255,.1)",
            opacity: fadeAnim,
          },
        ]}
      >
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
              <Text style={[detail.profileMeta, { color: Colors.blue[200] }]}>
                {blockedPackages.size} bloquée(s)
              </Text>
              {isActiveProfile && (
                <View
                  style={[
                    detail.activePill,
                    {
                      backgroundColor: "rgba(45,184,112,.15)",
                      borderColor: "rgba(45,184,112,.35)",
                    },
                  ]}
                >
                  <PulseDot color={Colors.green[400]} />
                  <Text
                    style={[detail.activeText, { color: Colors.green[400] }]}
                  >
                    ACTIF
                  </Text>
                </View>
              )}
              {isActiveProfile && !hasSchedules && (
                <View
                  style={[
                    detail.immediatePill,
                    {
                      backgroundColor: "rgba(123,110,246,.15)",
                      borderColor: "rgba(123,110,246,.35)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      detail.immediateText,
                      { color: Colors.purple[400] },
                    ]}
                  >
                    blocage immédiat
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Limit strip — visible si limite atteinte */}
        {limitReached && (
          <TouchableOpacity
            style={[
              detail.limitStrip,
              { backgroundColor: t.warning.bg, borderColor: t.warning.border },
            ]}
            onPress={() => {
              setPaywallReason("blocked_apps");
              setPaywallVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={[detail.limitStripText, { color: t.warning.text }]}>
              🔒 Limite atteinte · {blockedCount}/{FREE_LIMITS.MAX_BLOCKED_APPS}{" "}
              apps bloquées
            </Text>
            <Text style={[detail.limitStripCta, { color: t.text.link }]}>
              Pro →
            </Text>
          </TouchableOpacity>
        )}

        <View
          style={[
            detail.tabBar,
            {
              backgroundColor: "rgba(255,255,255,.1)",
              borderColor: "rgba(255,255,255,.15)",
            },
          ]}
        >
          <Animated.View
            style={[
              detail.tabIndicator,
              {
                left: tabIndicatorLeft,
                backgroundColor: "rgba(255,255,255,.2)",
                borderColor: "rgba(255,255,255,.3)",
              },
            ]}
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
                  {
                    color:
                      activeTab === tab
                        ? Colors.gray[0]
                        : "rgba(255,255,255,.5)",
                  },
                ]}
              >
                {tab === "apps"
                  ? `◎ Apps (${blockedPackages.size}/${filteredApps.length})`
                  : `◷ Plages (${schedules.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* ══ APPS TAB ═══════════════════════════════════════════════════════════ */}
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
              style={[
                detail.bulkBtn,
                {
                  backgroundColor: t.blocked.bg,
                  borderColor: t.blocked.border,
                },
                limitReached && { opacity: 0.45 },
              ]}
              onPress={blockAll}
            >
              <Text style={[detail.bulkBtnText, { color: t.blocked.text }]}>
                ◉ Tout bloquer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                detail.bulkBtn,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
              onPress={allowAll}
            >
              <Text style={[detail.bulkBtnText, { color: t.allowed.text }]}>
                ◎ Tout autoriser
              </Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={detail.center}>
              <Text style={{ color: t.text.muted }}>Chargement…</Text>
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
                  tintColor={t.refreshTint}
                  colors={[t.refreshTint]}
                  progressBackgroundColor={t.bg.card}
                />
              }
              ListEmptyComponent={
                <View style={detail.center}>
                  <View
                    style={[
                      detail.emptyIconWrap,
                      {
                        backgroundColor: t.bg.accent,
                        borderColor: t.border.strong,
                      },
                    ]}
                  >
                    <Text style={[detail.emptyIcon, { color: t.text.link }]}>
                      ◈
                    </Text>
                  </View>
                  <Text
                    style={[detail.emptyTitle, { color: t.text.secondary }]}
                  >
                    Aucune application
                  </Text>
                  <Text style={[detail.emptySubtitle, { color: t.text.muted }]}>
                    Modifiez votre recherche ou vos filtres
                  </Text>
                </View>
              }
            />
          )}
        </Animated.View>
      )}

      {/* ══ SCHEDULES TAB ══════════════════════════════════════════════════════ */}
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
                tintColor={t.refreshTint}
                colors={[t.refreshTint]}
                progressBackgroundColor={t.bg.card}
              />
            }
          >
            {!hasSchedules && (
              <View
                style={[
                  detail.noScheduleBanner,
                  {
                    backgroundColor: t.allowed.bg,
                    borderColor: t.allowed.border,
                  },
                ]}
              >
                <View
                  style={[
                    detail.noScheduleIconWrap,
                    {
                      backgroundColor: t.allowed.bg,
                      borderColor: t.allowed.border,
                    },
                  ]}
                >
                  <Text
                    style={[detail.noScheduleIcon, { color: t.allowed.accent }]}
                  >
                    ⚡
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[detail.noScheduleTitle, { color: t.allowed.text }]}
                  >
                    Blocage immédiat
                  </Text>
                  <Text
                    style={[detail.noScheduleText, { color: t.allowed.accent }]}
                  >
                    Aucune planification — dès activation, les{" "}
                    {blockedPackages.size} app(s) sont bloquées instantanément.
                  </Text>
                </View>
              </View>
            )}

            {hasSchedules && (
              <View
                style={[
                  detail.infoBanner,
                  {
                    backgroundColor: t.bg.accent,
                    borderColor: t.border.strong,
                  },
                ]}
              >
                <Text style={[detail.infoIcon, { color: t.text.link }]}>◈</Text>
                <Text style={[detail.infoText, { color: t.text.secondary }]}>
                  Les plages contrôlent l'activation automatique du profil.
                </Text>
              </View>
            )}

            {scheduleLimitReached && (
              <TouchableOpacity
                style={[
                  detail.limitBanner,
                  {
                    backgroundColor: t.warning.bg,
                    borderColor: t.warning.border,
                  },
                ]}
                onPress={() => {
                  setPaywallReason("schedules");
                  setPaywallVisible(true);
                }}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    detail.limitIconWrap,
                    {
                      backgroundColor: t.warning.bg,
                      borderColor: t.warning.border,
                    },
                  ]}
                >
                  <Text style={[detail.limitIcon, { color: t.warning.accent }]}>
                    ◈
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[detail.limitTitle, { color: t.warning.text }]}>
                    Limite atteinte — {schedules.length}/
                    {FREE_LIMITS.MAX_SCHEDULES} plage
                  </Text>
                  <Text style={[detail.limitSub, { color: t.warning.accent }]}>
                    Passez à Premium pour des planifications illimitées
                  </Text>
                </View>
                <View
                  style={[
                    detail.limitCta,
                    {
                      backgroundColor: t.bg.accent,
                      borderColor: t.border.strong,
                    },
                  ]}
                >
                  <Text style={[detail.limitCtaText, { color: t.text.link }]}>
                    ⚡ Pro
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {schedules.map((sc) => (
              <ScheduleRow
                key={sc.id}
                schedule={sc}
                onToggle={() => toggleSchedule(sc.id)}
                onDelete={() => deleteSchedule(sc.id)}
                onEdit={() => {
                  editingIdRef.current = sc.id;
                  setEditingSchedule(sc);
                  setScheduleModalVisible(true);
                }}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[
              detail.addSchedFab,
              {
                bottom: insets.bottom + 24,
                backgroundColor: scheduleLimitReached
                  ? t.focus.bg
                  : Colors.blue[600],
              },
              scheduleLimitReached && {
                borderWidth: 1,
                borderColor: t.focus.border,
              },
            ]}
            onPress={() => {
              if (scheduleLimitReached) {
                setPaywallReason("schedules");
                setPaywallVisible(true);
                return;
              }
              editingIdRef.current = null;
              setEditingSchedule(null);
              setScheduleModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Text
              style={[
                detail.addSchedFabText,
                scheduleLimitReached && { color: t.focus.text },
              ]}
            >
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

      <PaywallModal
        visible={paywallVisible}
        reason={paywallReason}
        onClose={() => setPaywallVisible(false)}
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
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  backBtn: { marginBottom: 14 },
  backText: { color: Colors.gray[0], fontSize: 14, fontWeight: "600" },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
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
    color: Colors.gray[0],
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  profileMeta: { fontSize: 11 },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  activeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  immediatePill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  immediateText: { fontSize: 9, fontWeight: "700" },

  // Limit strip — sous le headerMain, au-dessus des tabs
  limitStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },
  limitStripText: { fontSize: 12, fontWeight: "600" },
  limitStripCta: { fontSize: 12, fontWeight: "700" },

  tabBar: {
    flexDirection: "row",
    position: "relative",
    height: 44,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 0,
    borderWidth: 1,
  },
  tabIndicator: {
    position: "absolute",
    width: "50%",
    height: "100%",
    borderRadius: 12,
    borderWidth: 1,
  },
  tab: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 12, fontWeight: "600" },
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
  bulkBtnText: { fontSize: 12, fontWeight: "700" },
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyIcon: { fontSize: 26 },
  emptyTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  emptySubtitle: { fontSize: 12 },
  schedulesList: { paddingHorizontal: 18, paddingTop: 16 },
  noScheduleBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  noScheduleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noScheduleIcon: { fontSize: 16 },
  noScheduleTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  noScheduleText: { fontSize: 12, lineHeight: 18 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoIcon: { fontSize: 14 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 19 },
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  limitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  limitIcon: { fontSize: 15 },
  limitTitle: { fontSize: 12, fontWeight: "800", marginBottom: 2 },
  limitSub: { fontSize: 11 },
  limitCta: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  limitCtaText: { fontSize: 11, fontWeight: "800" },
  addSchedFab: {
    position: "absolute",
    left: 18,
    right: 18,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 8,
  },
  addSchedFabText: {
    color: Colors.gray[0],
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});

const sr = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    paddingLeft: 20,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
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
  label: { fontSize: 13, fontWeight: "700" },
  nowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
  },
  nowBadgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 1 },
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
    fontFamily: "monospace",
    marginBottom: 8,
  },
  timeArrow: { fontSize: 16, fontWeight: "400" },
  daysRow: { flexDirection: "row", gap: 4 },
  day: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  dayText: { fontSize: 9, fontWeight: "700" },
  right: { alignItems: "center", gap: 10 },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editBtnText: { fontSize: 13 },
  toggle: {
    width: 38,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    padding: 2,
    borderWidth: 1,
  },
  toggleThumb: { width: 16, height: 16, borderRadius: 8 },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 13 },
});

const ar = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    marginBottom: 7,
    borderWidth: 1,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  iconWrap: { position: "relative", marginRight: 12 },
  icon: { width: 44, height: 44, borderRadius: 12 },
  iconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  iconLetter: { fontSize: 18, fontWeight: "800" },
  blockedDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  blockedDotText: { fontSize: 7, color: Colors.gray[0], fontWeight: "800" },
  systemDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  systemDotText: { fontSize: 8 },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 13, fontWeight: "600", marginBottom: 3 },
  nameBlocked: { textDecorationLine: "line-through" },
  pkg: { fontSize: 10, fontFamily: "monospace" },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    padding: 2,
    borderWidth: 1,
  },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
});
