import AppDetailSkeleton from "@/components/AppDetailSkeleton";
import PaywallModal from "@/components/PaywallModal";
import { usePremium } from "@/hooks/usePremium";
import AppListService from "@/services/app-list.service";
import ScheduleService from "@/services/schedule.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import { Colors, Semantic, useTheme } from "@/theme";
import { AppRule, InstalledApp, Schedule } from "@/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { AppInfoModule } = NativeModules;
const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface AppDetails {
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  isSystemApp: boolean;
  isEnabled: boolean;
  isLaunchable: boolean;
  notificationsEnabled: boolean;
  firstInstallTime: number;
  lastUpdateTime: number;
  apkSizeBytes: number;
  permissions: string[];
  sourceDir: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────
function ProgressBar({
  pct,
  color,
  track,
}: {
  pct: number;
  color: string;
  track: string;
}) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  const width = w.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  return (
    <View
      style={{
        height: 3,
        backgroundColor: track,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          width,
          backgroundColor: color,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  value,
  onPress,
  size = "md",
}: {
  value: boolean;
  onPress: () => void;
  size?: "sm" | "md";
}) {
  const { t } = useTheme();
  const pos = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(pos, {
      toValue: value ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [value]);
  const isSm = size === "sm";
  const w = isSm ? 38 : 50,
    h = isSm ? 22 : 28,
    thumbSz = isSm ? 16 : 22,
    travel = isSm ? 16 : 22;
  const bg = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [t.bg.cardSunken, t.bg.accent],
  });
  const border = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [t.border.normal, t.border.focus],
  });
  const thumbX = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [2, travel],
  });
  const thumbBg = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [t.border.normal, Colors.blue[500]],
  });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View
        style={{
          width: w,
          height: h,
          borderRadius: h / 2,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            width: thumbSz,
            height: thumbSz,
            borderRadius: thumbSz / 2,
            backgroundColor: thumbBg,
            transform: [{ translateX: thumbX }],
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── ActionRow — ligne d'action avec icône ────────────────────────────────────
function ActionRow({
  icon,
  label,
  sub,
  onPress,
  danger = false,
  right,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const { t } = useTheme();
  return (
    <TouchableOpacity
      style={[
        st.actionRow,
        { backgroundColor: t.bg.card, borderColor: t.border.light },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View
        style={[
          st.actionRowIcon,
          {
            backgroundColor: danger ? t.danger.bg : t.bg.accent,
            borderColor: danger ? t.danger.border : t.border.light,
          },
        ]}
      >
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            st.actionRowLabel,
            { color: danger ? t.danger.text : t.text.primary },
          ]}
        >
          {label}
        </Text>
        {sub && (
          <Text style={[st.actionRowSub, { color: t.text.muted }]}>{sub}</Text>
        )}
      </View>
      {right ?? (
        <Text style={[st.actionRowChevron, { color: t.text.muted }]}>›</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── InfoRow — ligne d'information ────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  const { t } = useTheme();
  return (
    <View style={[st.infoRow, { borderBottomColor: t.border.light }]}>
      <Text style={[st.infoLabel, { color: t.text.muted }]}>{label}</Text>
      <Text
        style={[st.infoValue, { color: t.text.primary }]}
        selectable
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── PermissionBadge ──────────────────────────────────────────────────────────
function PermissionBadge({ perm }: { perm: string }) {
  const { t } = useTheme();
  const short = perm.split(".").pop() ?? perm;
  const isDangerous = [
    "CAMERA",
    "RECORD_AUDIO",
    "READ_CONTACTS",
    "ACCESS_FINE_LOCATION",
    "READ_CALL_LOG",
    "READ_SMS",
    "PROCESS_OUTGOING_CALLS",
  ].some((d) => short.includes(d));
  return (
    <View
      style={[
        st.permBadge,
        {
          backgroundColor: isDangerous ? t.danger.bg : t.bg.cardAlt,
          borderColor: isDangerous ? t.danger.border : t.border.light,
        },
      ]}
    >
      <Text
        style={[
          st.permBadgeText,
          { color: isDangerous ? t.danger.text : t.text.secondary },
        ]}
      >
        {isDangerous ? "⚠ " : ""}
        {short.toLowerCase().replace(/_/g, " ")}
      </Text>
    </View>
  );
}

// ─── ScheduleCard ─────────────────────────────────────────────────────────────
function ScheduleCard({
  schedule,
  onEdit,
  onToggle,
  onDelete,
}: {
  schedule: Schedule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTheme();
  const isNow = ScheduleService.isScheduleActiveNow(schedule);
  const isBlock = schedule.action === "block";
  const accent = isBlock ? t.blocked.accent : t.allowed.accent;
  const accentBg = isBlock ? t.blocked.bg : t.allowed.bg;
  const accentBd = isBlock ? t.blocked.border : t.allowed.border;
  return (
    <TouchableOpacity
      style={[
        st.scheduleCard,
        { backgroundColor: t.bg.card, borderColor: t.border.light },
        !schedule.isActive && { opacity: 0.4 },
      ]}
      onPress={onEdit}
      activeOpacity={0.75}
    >
      <View style={[st.scheduleAccent, { backgroundColor: accent }]} />
      <View style={st.scheduleLeft}>
        <View style={st.scheduleTopRow}>
          <View
            style={[
              st.actionPill,
              { backgroundColor: accentBg, borderColor: accentBd },
            ]}
          >
            <View style={[st.actionDot, { backgroundColor: accent }]} />
            <Text style={[st.actionPillText, { color: accent }]}>
              {isBlock ? "Bloquer" : "Autoriser"}
            </Text>
          </View>
          {isNow && schedule.isActive && (
            <View
              style={[
                st.nowBadge,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
            >
              <View
                style={[st.nowDot, { backgroundColor: t.allowed.accent }]}
              />
              <Text style={[st.nowBadgeText, { color: t.allowed.text }]}>
                EN COURS
              </Text>
            </View>
          )}
        </View>
        <Text style={[st.scheduleTime, { color: t.text.primary }]}>
          {ScheduleService.formatTime(schedule.startHour, schedule.startMinute)}
          <Text style={[st.scheduleTimeSep, { color: t.border.normal }]}>
            {" "}
            →{" "}
          </Text>
          {ScheduleService.formatTime(schedule.endHour, schedule.endMinute)}
        </Text>
        <View style={st.daysRow}>
          {DAYS.map((d, i) => {
            const active = schedule.days.includes(i);
            return (
              <View
                key={i}
                style={[
                  st.dayChip,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
                  active && {
                    backgroundColor: accentBg,
                    borderColor: accentBd,
                  },
                ]}
              >
                <Text
                  style={[
                    st.dayChipText,
                    { color: active ? accent : t.text.muted },
                  ]}
                >
                  {d}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={st.scheduleRight}>
        <Toggle value={schedule.isActive} onPress={onToggle} size="sm" />
        <TouchableOpacity
          style={[
            st.scheduleDeleteBtn,
            { backgroundColor: t.danger.bg, borderColor: t.danger.border },
          ]}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Text style={[st.scheduleDeleteIcon, { color: t.danger.accent }]}>
            ⌫
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AppDetailScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { packageName } = useLocalSearchParams<{ packageName: string }>();
  const { isPremium } = usePremium();

  const [app, setApp] = useState<InstalledApp | null>(null);
  const [details, setDetails] = useState<AppDetails | null>(null);
  const [rule, setRule] = useState<AppRule | null>(null);
  const [stats, setStats] = useState({ blocked: 0, allowed: 0 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"control" | "info" | "schedule">(
    "control",
  );
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [showPerms, setShowPerms] = useState(false);

  // Formulaire planification
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formStartHour, setFormStartHour] = useState(8);
  const [formStartMinute, setFormStartMinute] = useState(0);
  const [formEndHour, setFormEndHour] = useState(18);
  const [formEndMinute, setFormEndMinute] = useState(0);
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formAction, setFormAction] = useState<"block" | "allow">("block");
  const [timePickerTarget, setTimePickerTarget] = useState<"start" | "end">(
    "start",
  );
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const modalSlide = useRef(new Animated.Value(400)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
  }, [packageName]);

  useEffect(() => {
    if (!loading) {
      fadeAnim.setValue(0);
      slideAnim.setValue(16);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  useEffect(() => {
    if (showModal) {
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 220,
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
      modalSlide.setValue(400);
      modalOpacity.setValue(0);
    }
  }, [showModal]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [appData, existingRule, allStats, sched] = await Promise.all([
        AppListService.getAppByPackage(packageName),
        StorageService.getRuleByPackage(packageName),
        StorageService.getStats(),
        ScheduleService.getSchedules(packageName),
      ]);
      setApp(appData);
      setRule(existingRule);
      const appStats = allStats.find((s) => s.packageName === packageName);
      if (appStats)
        setStats({
          blocked: appStats.blockedAttempts,
          allowed: appStats.allowedAttempts,
        });
      setSchedules(sched);

      // Détails enrichis via module natif
      if (AppInfoModule) {
        try {
          const det = await AppInfoModule.getAppDetails(packageName);
          setDetails(det);
        } catch (e) {
          console.warn("AppInfoModule.getAppDetails:", e);
        }
      }
    } catch (e) {
      console.error("Erreur chargement:", e);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: "control" | "info" | "schedule") => {
    setActiveTab(tab);
    const idx = { control: 0, info: 1, schedule: 2 }[tab];
    Animated.timing(tabAnim, {
      toValue: idx,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const toggleBlock = async () => {
    const newBlocked = !rule?.isBlocked;
    if (newBlocked && !isPremium) {
      const rules = await StorageService.getRules();
      if (
        rules.filter((r) => r.isBlocked).length >= FREE_LIMITS.MAX_BLOCKED_APPS
      ) {
        setPaywallVisible(true);
        return;
      }
    }
    await VpnService.setRule(packageName, newBlocked);
    setRule((prev) => ({
      ...prev!,
      isBlocked: newBlocked,
      packageName,
      createdAt: prev?.createdAt || new Date(),
      updatedAt: new Date(),
    }));
  };

  const handleOpenSettings = async () => {
    if (AppInfoModule) {
      try {
        await AppInfoModule.openAppSettings(packageName);
        return;
      } catch {}
    }
    Linking.openURL(`package:${packageName}`).catch(() =>
      Alert.alert("Impossible d'ouvrir les paramètres système de cette app."),
    );
  };

  const handleOpenNotifSettings = async () => {
    if (AppInfoModule) {
      try {
        await AppInfoModule.openNotificationSettings(packageName);
        return;
      } catch {}
    }
    handleOpenSettings();
  };

  const handleLaunchApp = async () => {
    if (AppInfoModule && details?.isLaunchable) {
      try {
        await AppInfoModule.launchApp(packageName);
        return;
      } catch {}
    }
    Alert.alert("Cette application ne peut pas être lancée directement.");
  };

  const handleUninstall = () => {
    if (details?.isSystemApp) {
      Alert.alert(
        "App système",
        "Les applications système ne peuvent pas être désinstallées sans root.",
      );
      return;
    }
    Alert.alert(
      "Désinstaller",
      `Voulez-vous désinstaller "${details?.appName ?? packageName}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désinstaller",
          style: "destructive",
          onPress: async () => {
            if (AppInfoModule) {
              try {
                await AppInfoModule.uninstallApp(packageName);
              } catch {}
            }
          },
        },
      ],
    );
  };

  const handleOpenStorage = async () => {
    if (AppInfoModule) {
      try {
        await AppInfoModule.openStorageSettings(packageName);
        return;
      } catch {}
    }
    handleOpenSettings();
  };

  const simulateAttempt = async () => {
    const result = await VpnService.simulateConnectionAttempt(packageName);
    Alert.alert(
      result === "blocked" ? "◈ Connexion bloquée" : "◎ Connexion autorisée",
    );
  };

  // ── Planifications ──────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingSchedule(null);
    setFormLabel("");
    setFormStartHour(8);
    setFormStartMinute(0);
    setFormEndHour(18);
    setFormEndMinute(0);
    setFormDays([1, 2, 3, 4, 5]);
    setFormAction("block");
    setShowModal(true);
  };
  const openEditModal = (s: Schedule) => {
    setEditingSchedule(s);
    setFormLabel(s.label);
    setFormStartHour(s.startHour);
    setFormStartMinute(s.startMinute);
    setFormEndHour(s.endHour);
    setFormEndMinute(s.endMinute);
    setFormDays([...s.days]);
    setFormAction(s.action);
    setShowModal(true);
  };
  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(modalSlide, {
        toValue: 400,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setShowModal(false));
  };
  const saveSchedule = async () => {
    if (formDays.length === 0) {
      Alert.alert("Sélectionnez au moins un jour.");
      return;
    }
    const schedule: Schedule = {
      id: editingSchedule?.id || ScheduleService.generateId(),
      packageName,
      label:
        formLabel ||
        `${ScheduleService.formatTime(formStartHour, formStartMinute)} – ${ScheduleService.formatTime(formEndHour, formEndMinute)}`,
      startHour: formStartHour,
      startMinute: formStartMinute,
      endHour: formEndHour,
      endMinute: formEndMinute,
      days: formDays.sort(),
      isActive: editingSchedule?.isActive ?? true,
      action: formAction,
    };
    await ScheduleService.saveSchedule(schedule);
    setSchedules(await ScheduleService.getSchedules(packageName));
    closeModal();
  };
  const deleteSchedule = async (id: string) => {
    await ScheduleService.deleteSchedule(id);
    setSchedules(await ScheduleService.getSchedules(packageName));
  };
  const toggleSchedule = async (id: string) => {
    await ScheduleService.toggleSchedule(id);
    setSchedules(await ScheduleService.getSchedules(packageName));
  };
  const toggleDay = (day: number) =>
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

  const scheduleLimitReached =
    !isPremium && schedules.length >= FREE_LIMITS.MAX_SCHEDULES;
  const isBlocked = rule?.isBlocked ?? false;
  const total = stats.blocked + stats.allowed;
  const blockedPct = total > 0 ? stats.blocked / total : 0;
  const blockedPct100 = Math.round(blockedPct * 100);

  const TABS = [
    { key: "control", label: "Contrôle", icon: "◈" },
    { key: "info", label: "Infos", icon: "ℹ" },
    { key: "schedule", label: "Plages", icon: "◷" },
  ] as const;

  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ["0%", "33.33%", "66.66%"],
  });

  if (loading) return <AppDetailSkeleton />;

  return (
    <View style={[st.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* ── Header ── */}
      <View
        style={[
          st.header,
          { paddingTop: insets.top + 12, backgroundColor: Semantic.bg.header },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={st.backBtn}
          activeOpacity={0.7}
        >
          <Text style={st.backArrow}>←</Text>
          <Text style={st.backText}>Retour</Text>
        </TouchableOpacity>
        <View style={st.heroSection}>
          {app?.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${app.icon}` }}
              style={st.heroIcon}
            />
          ) : (
            <View
              style={[
                st.heroIconPlaceholder,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={[st.heroIconLetter, { color: t.text.link }]}>
                {app?.appName.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={st.heroName}>{app?.appName}</Text>
          <Text style={[st.heroPackage, { color: Colors.blue[200] }]}>
            {packageName}
          </Text>
          <View style={st.heroBadges}>
            {app?.isSystemApp && (
              <View
                style={[
                  st.heroBadge,
                  {
                    backgroundColor: "rgba(255,255,255,.12)",
                    borderColor: "rgba(255,255,255,.2)",
                  },
                ]}
              >
                <Text style={[st.heroBadgeText, { color: Colors.blue[100] }]}>
                  Système
                </Text>
              </View>
            )}
            {details && (
              <View
                style={[
                  st.heroBadge,
                  {
                    backgroundColor: "rgba(255,255,255,.12)",
                    borderColor: "rgba(255,255,255,.2)",
                  },
                ]}
              >
                <Text style={[st.heroBadgeText, { color: Colors.blue[100] }]}>
                  v{details.versionName}
                </Text>
              </View>
            )}
            {isBlocked && (
              <View
                style={[
                  st.heroBadge,
                  {
                    backgroundColor: t.blocked.bg + "CC",
                    borderColor: t.blocked.border,
                  },
                ]}
              >
                <Text style={[st.heroBadgeText, { color: t.blocked.accent }]}>
                  Bloqué
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Onglets */}
        <View style={st.tabBar}>
          <Animated.View
            style={[
              st.tabIndicator,
              { left: tabIndicatorLeft, width: "33.33%" },
            ]}
          />
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={st.tab}
              onPress={() => switchTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[st.tabText, activeTab === tab.key && st.tabTextActive]}
              >
                {tab.icon} {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Contenu ── */}
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[
          st.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {/* ════════════════════ ONGLET CONTRÔLE ════════════════════ */}
          {activeTab === "control" && (
            <>
              {/* Blocage réseau */}
              <Text style={[st.sectionLabel, { color: t.text.muted }]}>
                ACCÈS RÉSEAU
              </Text>
              <View
                style={[
                  st.controlCard,
                  {
                    backgroundColor: isBlocked ? t.blocked.bg : t.allowed.bg,
                    borderColor: isBlocked
                      ? t.blocked.border
                      : t.allowed.border,
                  },
                ]}
              >
                <View
                  style={[
                    st.controlAccent,
                    {
                      backgroundColor: isBlocked
                        ? t.blocked.accent
                        : t.allowed.accent,
                    },
                  ]}
                />
                <View
                  style={[
                    st.controlIconWrap,
                    {
                      backgroundColor: isBlocked ? t.blocked.bg : t.allowed.bg,
                      borderColor: isBlocked
                        ? t.blocked.border
                        : t.allowed.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      st.controlIcon,
                      {
                        color: isBlocked ? t.blocked.accent : t.allowed.accent,
                      },
                    ]}
                  >
                    {isBlocked ? "◈" : "◎"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      st.controlTitle,
                      { color: isBlocked ? t.blocked.text : t.allowed.text },
                    ]}
                  >
                    {isBlocked ? "Internet bloqué" : "Internet autorisé"}
                  </Text>
                  <Text style={[st.controlSub, { color: t.text.muted }]}>
                    {isBlocked
                      ? "Toutes les connexions sont interceptées"
                      : "Accès réseau normal"}
                  </Text>
                </View>
                <Toggle value={isBlocked} onPress={toggleBlock} />
              </View>

              {/* Statistiques */}
              <Text
                style={[
                  st.sectionLabel,
                  { color: t.text.muted, marginTop: 20 },
                ]}
              >
                STATISTIQUES
              </Text>
              <View style={st.statsRow}>
                {[
                  {
                    num: stats.blocked,
                    label: "Bloquées",
                    color: t.blocked.accent,
                    bg: t.blocked.bg,
                    border: t.blocked.border,
                  },
                  {
                    num: stats.allowed,
                    label: "Autorisées",
                    color: t.allowed.accent,
                    bg: t.allowed.bg,
                    border: t.allowed.border,
                  },
                  {
                    num: blockedPct100,
                    label: "% bloqué",
                    color: t.focus.accent,
                    bg: t.focus.bg,
                    border: t.focus.border,
                    suffix: "%",
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={[
                      st.statCard,
                      { backgroundColor: item.bg, borderColor: item.border },
                    ]}
                  >
                    <Text style={[st.statNum, { color: item.color }]}>
                      {item.num}
                      {(item as any).suffix ?? ""}
                    </Text>
                    <View style={st.statLabelRow}>
                      <View
                        style={[st.statDot, { backgroundColor: item.color }]}
                      />
                      <Text style={[st.statLabel, { color: t.text.muted }]}>
                        {item.label}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              {total > 0 && (
                <View style={{ marginTop: 10, marginBottom: 14 }}>
                  <ProgressBar
                    pct={blockedPct}
                    color={t.blocked.accent}
                    track={t.border.light}
                  />
                </View>
              )}
              <TouchableOpacity
                style={[
                  st.simulateBtn,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
                ]}
                onPress={simulateAttempt}
                activeOpacity={0.8}
              >
                <Text style={[st.simulateBtnIcon, { color: t.text.muted }]}>
                  ◎
                </Text>
                <Text style={[st.simulateBtnText, { color: t.text.secondary }]}>
                  Simuler une connexion
                </Text>
              </TouchableOpacity>

              {/* Actions rapides */}
              <Text
                style={[
                  st.sectionLabel,
                  { color: t.text.muted, marginTop: 20 },
                ]}
              >
                ACTIONS RAPIDES
              </Text>
              <View
                style={[
                  st.actionsCard,
                  { backgroundColor: t.bg.card, borderColor: t.border.light },
                ]}
              >
                {details?.isLaunchable && (
                  <ActionRow
                    icon="▶"
                    label="Ouvrir l'application"
                    onPress={handleLaunchApp}
                  />
                )}
                <ActionRow
                  icon="🔔"
                  label="Paramètres de notifications"
                  sub={
                    details
                      ? details.notificationsEnabled
                        ? "Activées"
                        : "Désactivées"
                      : undefined
                  }
                  onPress={handleOpenNotifSettings}
                  right={
                    details ? (
                      <View
                        style={[
                          st.notifBadge,
                          {
                            backgroundColor: details.notificationsEnabled
                              ? t.allowed.bg
                              : t.blocked.bg,
                            borderColor: details.notificationsEnabled
                              ? t.allowed.border
                              : t.blocked.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: details.notificationsEnabled
                              ? t.allowed.text
                              : t.blocked.text,
                          }}
                        >
                          {details.notificationsEnabled ? "ON" : "OFF"}
                        </Text>
                      </View>
                    ) : undefined
                  }
                />
                <ActionRow
                  icon="🗄"
                  label="Stockage et cache"
                  sub="Vider le cache ou les données"
                  onPress={handleOpenStorage}
                />
                <ActionRow
                  icon="⚙"
                  label="Paramètres Android"
                  sub="Page système de l'app"
                  onPress={handleOpenSettings}
                />
                {!details?.isSystemApp && (
                  <ActionRow
                    icon="🗑"
                    label="Désinstaller"
                    onPress={handleUninstall}
                    danger
                  />
                )}
              </View>
            </>
          )}

          {/* ════════════════════ ONGLET INFOS ════════════════════ */}
          {activeTab === "info" && details && (
            <>
              <Text style={[st.sectionLabel, { color: t.text.muted }]}>
                INFORMATIONS
              </Text>
              <View
                style={[
                  st.infoCard,
                  { backgroundColor: t.bg.card, borderColor: t.border.light },
                ]}
              >
                <InfoRow label="Nom" value={details.appName} />
                <InfoRow label="Package" value={details.packageName} />
                <InfoRow
                  label="Version"
                  value={`${details.versionName} (${details.versionCode})`}
                />
                <InfoRow
                  label="Taille APK"
                  value={formatSize(details.apkSizeBytes)}
                />
                <InfoRow
                  label="Installée le"
                  value={formatDate(details.firstInstallTime)}
                />
                <InfoRow
                  label="Mise à jour"
                  value={formatDate(details.lastUpdateTime)}
                />
                <InfoRow
                  label="Type"
                  value={
                    details.isSystemApp
                      ? "Application système"
                      : "Application utilisateur"
                  }
                />
                <InfoRow
                  label="État"
                  value={details.isEnabled ? "Activée" : "Désactivée"}
                />
                <InfoRow
                  label="Notifications"
                  value={
                    details.notificationsEnabled ? "Autorisées" : "Bloquées"
                  }
                />
                <View
                  style={[st.infoRow, { borderBottomColor: "transparent" }]}
                >
                  <Text style={[st.infoLabel, { color: t.text.muted }]}>
                    Chemin
                  </Text>
                  <Text
                    style={[
                      st.infoValue,
                      {
                        color: t.text.primary,
                        fontSize: 10,
                        fontFamily: "monospace",
                      },
                    ]}
                    selectable
                    numberOfLines={3}
                  >
                    {details.sourceDir || "—"}
                  </Text>
                </View>
              </View>

              {/* Permissions */}
              {details.permissions.length > 0 && (
                <>
                  <View style={st.permHeader}>
                    <Text style={[st.sectionLabel, { color: t.text.muted }]}>
                      PERMISSIONS ({details.permissions.length})
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowPerms((v) => !v)}
                      activeOpacity={0.75}
                    >
                      <Text style={[st.permToggle, { color: t.text.link }]}>
                        {showPerms ? "Réduire ▲" : "Afficher ▼"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {showPerms && (
                    <View style={st.permWrap}>
                      {details.permissions.map((p) => (
                        <PermissionBadge key={p} perm={p} />
                      ))}
                    </View>
                  )}
                  {!showPerms && (
                    <View style={st.permWrapCollapsed}>
                      {details.permissions.slice(0, 6).map((p) => (
                        <PermissionBadge key={p} perm={p} />
                      ))}
                      {details.permissions.length > 6 && (
                        <TouchableOpacity
                          onPress={() => setShowPerms(true)}
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              st.permMoreBtn,
                              {
                                backgroundColor: t.bg.cardAlt,
                                borderColor: t.border.light,
                              },
                            ]}
                          >
                            <Text
                              style={[st.permMoreText, { color: t.text.link }]}
                            >
                              +{details.permissions.length - 6} de plus
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === "info" && !details && (
            <View style={st.noDetails}>
              <Text style={{ fontSize: 28, marginBottom: 12 }}>ℹ</Text>
              <Text
                style={[
                  {
                    fontSize: 14,
                    color: t.text.secondary,
                    textAlign: "center",
                  },
                ]}
              >
                Informations détaillées non disponibles.{"\n"}Module natif
                requis.
              </Text>
            </View>
          )}

          {/* ════════════════════ ONGLET PLAGES ════════════════════ */}
          {activeTab === "schedule" && (
            <>
              <View style={st.sectionHeaderRow}>
                <Text style={[st.sectionLabel, { color: t.text.muted }]}>
                  PLANIFICATIONS
                </Text>
                <TouchableOpacity
                  style={[
                    st.addBtn,
                    {
                      backgroundColor: t.bg.accent,
                      borderColor: t.border.strong,
                    },
                    scheduleLimitReached && {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                  ]}
                  onPress={() => {
                    if (!scheduleLimitReached) openAddModal();
                    else setPaywallVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      st.addBtnText,
                      {
                        color: scheduleLimitReached
                          ? t.text.muted
                          : t.text.link,
                      },
                    ]}
                  >
                    {scheduleLimitReached ? "🔒 Premium" : "+ Ajouter"}
                  </Text>
                </TouchableOpacity>
              </View>
              {schedules.length === 0 ? (
                <View
                  style={[
                    st.emptySchedule,
                    { backgroundColor: t.bg.card, borderColor: t.border.light },
                  ]}
                >
                  <View
                    style={[
                      st.emptyIconWrap,
                      {
                        backgroundColor: t.bg.accent,
                        borderColor: t.border.strong,
                      },
                    ]}
                  >
                    <Text style={[st.emptyIconText, { color: t.text.link }]}>
                      ◷
                    </Text>
                  </View>
                  <Text style={[st.emptyTitle, { color: t.text.secondary }]}>
                    Aucune planification
                  </Text>
                  <Text style={[st.emptySubtitle, { color: t.text.muted }]}>
                    Définissez des plages horaires pour bloquer ou autoriser
                    automatiquement Internet.
                  </Text>
                  <TouchableOpacity
                    style={[
                      st.emptyBtn,
                      {
                        backgroundColor: t.bg.accent,
                        borderColor: t.border.strong,
                      },
                    ]}
                    onPress={openAddModal}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.emptyBtnText, { color: t.text.link }]}>
                      Créer une planification
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                schedules.map((sc) => (
                  <ScheduleCard
                    key={sc.id}
                    schedule={sc}
                    onEdit={() => openEditModal(sc)}
                    onToggle={() => toggleSchedule(sc.id)}
                    onDelete={() => deleteSchedule(sc.id)}
                  />
                ))
              )}
            </>
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* ── Modal planification ── */}
      <Modal
        visible={showModal}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View style={[ms.overlay, { opacity: modalOpacity }]}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeModal}
          />
          <Animated.View
            style={[
              ms.sheet,
              {
                backgroundColor: t.bg.card,
                borderColor: t.border.light,
                transform: [{ translateY: modalSlide }],
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={[ms.handle, { backgroundColor: t.border.normal }]} />
            <View style={ms.sheetHeader}>
              <Text style={[ms.sheetTitle, { color: t.text.primary }]}>
                {editingSchedule ? "Modifier" : "Nouvelle planification"}
              </Text>
              <TouchableOpacity
                onPress={closeModal}
                style={[
                  ms.closeIcon,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
                ]}
              >
                <Text style={[ms.closeIconText, { color: t.text.muted }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[ms.fieldLabel, { color: t.text.muted }]}>
                ACTION
              </Text>
              <View style={ms.actionRow}>
                {(["block", "allow"] as const).map((a) => {
                  const active = formAction === a;
                  const c =
                    a === "block"
                      ? {
                          bg: t.blocked.bg,
                          border: t.blocked.border,
                          text: t.blocked.accent,
                        }
                      : {
                          bg: t.allowed.bg,
                          border: t.allowed.border,
                          text: t.allowed.accent,
                        };
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[
                        ms.actionChip,
                        {
                          backgroundColor: t.bg.cardAlt,
                          borderColor: t.border.light,
                        },
                        active && {
                          backgroundColor: c.bg,
                          borderColor: c.border,
                        },
                      ]}
                      onPress={() => setFormAction(a)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          ms.actionDot,
                          {
                            backgroundColor: active ? c.text : t.border.normal,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          ms.actionChipText,
                          { color: active ? c.text : t.text.secondary },
                        ]}
                      >
                        {a === "block" ? "Bloquer" : "Autoriser"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={ms.timeRow}>
                {(["start", "end"] as const).map((target, idx) => {
                  const h = target === "start" ? formStartHour : formEndHour;
                  const m =
                    target === "start" ? formStartMinute : formEndMinute;
                  return (
                    <React.Fragment key={target}>
                      {idx === 1 && (
                        <Text style={[ms.timeSep, { color: t.border.normal }]}>
                          →
                        </Text>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[ms.fieldLabel, { color: t.text.muted }]}>
                          {target === "start" ? "DÉBUT" : "FIN"}
                        </Text>
                        <TouchableOpacity
                          style={[
                            ms.timeDisplay,
                            {
                              backgroundColor: t.bg.cardAlt,
                              borderColor: t.border.light,
                            },
                            timePickerTarget === target &&
                              showTimePicker && {
                                borderColor: t.border.focus,
                                backgroundColor: t.bg.accent,
                              },
                          ]}
                          onPress={() => {
                            if (timePickerTarget === target && showTimePicker)
                              setShowTimePicker(false);
                            else {
                              setTimePickerTarget(target);
                              setShowTimePicker(true);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              ms.timeDisplayText,
                              { color: t.text.primary },
                            ]}
                          >
                            {ScheduleService.formatTime(h, m)}
                          </Text>
                          <Text
                            style={[
                              ms.timeDisplayCaret,
                              { color: t.text.muted },
                            ]}
                          >
                            {timePickerTarget === target && showTimePicker
                              ? "▲"
                              : "▼"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              {showTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const d = new Date();
                    if (timePickerTarget === "start")
                      d.setHours(formStartHour, formStartMinute, 0, 0);
                    else d.setHours(formEndHour, formEndMinute, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  is24Hour
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, date) => {
                    if (Platform.OS === "android") setShowTimePicker(false);
                    if (event.type !== "dismissed" && date) {
                      const h = date.getHours(),
                        m = date.getMinutes();
                      if (timePickerTarget === "start") {
                        setFormStartHour(h);
                        setFormStartMinute(m);
                      } else {
                        setFormEndHour(h);
                        setFormEndMinute(m);
                      }
                    }
                  }}
                  style={Platform.OS === "ios" ? ms.iosPicker : undefined}
                />
              )}
              {showTimePicker && Platform.OS === "ios" && (
                <TouchableOpacity
                  style={[
                    ms.confirmBtn,
                    {
                      backgroundColor: t.bg.accent,
                      borderColor: t.border.strong,
                    },
                  ]}
                  onPress={() => setShowTimePicker(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[ms.confirmBtnText, { color: t.text.link }]}>
                    Valider
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={[ms.fieldLabel, { color: t.text.muted }]}>
                JOURS
              </Text>
              <View style={ms.daysRow}>
                {DAYS.map((d, i) => {
                  const active = formDays.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        ms.dayChip,
                        {
                          backgroundColor: t.bg.cardAlt,
                          borderColor: t.border.light,
                        },
                        active && {
                          backgroundColor: t.bg.accent,
                          borderColor: t.border.focus,
                        },
                      ]}
                      onPress={() => toggleDay(i)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          ms.dayChipText,
                          { color: active ? t.text.link : t.text.muted },
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={ms.shortcutsRow}>
                {[
                  { label: "Semaine", days: [1, 2, 3, 4, 5] },
                  { label: "Week-end", days: [0, 6] },
                  { label: "Tous", days: [0, 1, 2, 3, 4, 5, 6] },
                ].map(({ label, days }) => (
                  <TouchableOpacity
                    key={label}
                    style={[
                      ms.shortcut,
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.light,
                      },
                    ]}
                    onPress={() => setFormDays(days)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[ms.shortcutText, { color: t.text.secondary }]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[ms.saveBtn, { backgroundColor: Colors.blue[600] }]}
              onPress={saveSchedule}
              activeOpacity={0.85}
            >
              <Text style={ms.saveBtnText}>
                {editingSchedule ? "Enregistrer" : "Créer la planification"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      <PaywallModal
        visible={paywallVisible}
        reason="schedules"
        onClose={() => setPaywallVisible(false)}
        onUpgraded={() => setPaywallVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 0 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  backArrow: { fontSize: 18, color: Colors.gray[0], lineHeight: 20 },
  backText: { fontSize: 14, color: Colors.gray[0], fontWeight: "600" },
  heroSection: { alignItems: "center", marginBottom: 20 },
  heroIcon: { width: 72, height: 72, borderRadius: 20, marginBottom: 12 },
  heroIconPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
  },
  heroIconLetter: { fontSize: 28, fontWeight: "800" },
  heroName: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroPackage: { fontSize: 10, fontFamily: "monospace", marginBottom: 8 },
  heroBadges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  heroBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  heroBadgeText: { fontSize: 10, fontWeight: "600" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    position: "relative",
    backgroundColor: "rgba(255,255,255,.12)",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 0,
    marginTop: 4,
  },
  tabIndicator: {
    position: "absolute",
    height: "100%",
    backgroundColor: "rgba(255,255,255,.2)",
    borderRadius: 12,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,.55)" },
  tabTextActive: { color: Colors.gray[0], fontWeight: "800" },

  scroll: { paddingHorizontal: 18, paddingTop: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  // Control
  controlCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
    gap: 12,
    marginBottom: 4,
  },
  controlAccent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  controlIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  controlIcon: { fontSize: 16 },
  controlTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  controlSub: { fontSize: 11 },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 5,
  },
  statNum: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statDot: { width: 5, height: 5, borderRadius: 3 },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
  },
  simulateBtnIcon: { fontSize: 13 },
  simulateBtnText: { fontSize: 13, fontWeight: "600" },

  // Actions
  actionsCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  actionRowLabel: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  actionRowSub: { fontSize: 11 },
  actionRowChevron: { fontSize: 20, fontWeight: "300" },
  notifBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },

  // Info
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  infoLabel: { fontSize: 12, fontWeight: "600", flexShrink: 0, width: 100 },
  infoValue: { fontSize: 12, flex: 1, textAlign: "right" },
  noDetails: { alignItems: "center", paddingTop: 60 },
  permHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  permToggle: { fontSize: 12, fontWeight: "600" },
  permWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },
  permWrapCollapsed: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },
  permBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  permBadgeText: { fontSize: 10, fontWeight: "600" },
  permMoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  permMoreText: { fontSize: 10, fontWeight: "700" },

  // Schedule
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  addBtnText: { fontSize: 12, fontWeight: "700" },
  scheduleCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  scheduleAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  scheduleLeft: { flex: 1, paddingLeft: 10 },
  scheduleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionDot: { width: 5, height: 5, borderRadius: 3 },
  actionPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  nowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  nowDot: { width: 5, height: 5, borderRadius: 3 },
  nowBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  scheduleTime: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  scheduleTimeSep: { fontWeight: "400" },
  daysRow: { flexDirection: "row", gap: 4 },
  dayChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  dayChipText: { fontSize: 9, fontWeight: "700" },
  scheduleRight: { alignItems: "center", gap: 10, paddingLeft: 12 },
  scheduleDeleteBtn: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
  },
  scheduleDeleteIcon: { fontSize: 12 },
  emptySchedule: {
    borderRadius: 18,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyIconText: { fontSize: 24 },
  emptyTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  emptyBtnText: { fontSize: 13, fontWeight: "700" },
});

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "92%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  sheetTitle: { fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 11, fontWeight: "700" },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  actionChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionDot: { width: 7, height: 7, borderRadius: 4 },
  actionChipText: { fontSize: 14, fontWeight: "700" },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 14,
  },
  timeSep: { fontSize: 16, fontWeight: "700", paddingBottom: 14 },
  timeDisplay: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeDisplayText: { fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  timeDisplayCaret: { fontSize: 10 },
  confirmBtn: {
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
  },
  confirmBtnText: { fontSize: 14, fontWeight: "700" },
  daysRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  dayChipText: { fontSize: 12, fontWeight: "700" },
  shortcutsRow: { flexDirection: "row", gap: 8, marginBottom: 22 },
  shortcut: {
    flex: 1,
    borderRadius: 10,
    padding: 9,
    alignItems: "center",
    borderWidth: 1,
  },
  shortcutText: { fontSize: 11, fontWeight: "600" },
  saveBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: Colors.gray[0],
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  iosPicker: { width: "100%", height: 150, marginBottom: 4 },
});
