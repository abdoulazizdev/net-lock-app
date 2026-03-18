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
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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

export default function AppDetailScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { packageName } = useLocalSearchParams<{ packageName: string }>();
  const { isPremium } = usePremium();
  const [app, setApp] = useState<InstalledApp | null>(null);
  const [rule, setRule] = useState<AppRule | null>(null);
  const [stats, setStats] = useState({ blocked: 0, allowed: 0 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [paywallVisible, setPaywallVisible] = useState(false);

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

  useEffect(() => {
    loadAll();
  }, [packageName]);
  useEffect(() => {
    if (!loading) {
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
    try {
      setLoading(true);
      const appData = await AppListService.getAppByPackage(packageName);
      setApp(appData);
      const existingRule = await StorageService.getRuleByPackage(packageName);
      setRule(existingRule);
      const allStats = await StorageService.getStats();
      const appStats = allStats.find((s) => s.packageName === packageName);
      if (appStats)
        setStats({
          blocked: appStats.blockedAttempts,
          allowed: appStats.allowedAttempts,
        });
      setSchedules(await ScheduleService.getSchedules(packageName));
    } catch (e) {
      console.error("Erreur chargement:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async () => {
    const newBlocked = !rule?.isBlocked;
    if (newBlocked && !isPremium) {
      const rules = await StorageService.getRules();
      const blockedCount = rules.filter((r) => r.isBlocked).length;
      if (blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS) {
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

  const simulateAttempt = async () => {
    const result = await VpnService.simulateConnectionAttempt(packageName);
    await loadAll();
    Alert.alert(
      result === "blocked" ? "◈ Connexion bloquée" : "◎ Connexion autorisée",
    );
  };

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

  if (loading)
    return <View style={[{ flex: 1, backgroundColor: t.bg.page }]} />;

  return (
    <View style={[st.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />

      {/* Header */}
      <View
        style={[
          st.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: Semantic.bg.header,
            borderBottomColor: "rgba(255,255,255,.1)",
          },
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
            {app?.packageName}
          </Text>
          {app?.isSystemApp && (
            <View
              style={[
                st.sysBadge,
                {
                  backgroundColor: "rgba(255,255,255,.1)",
                  borderColor: "rgba(255,255,255,.2)",
                },
              ]}
            >
              <Text style={[st.sysBadgeText, { color: Colors.blue[100] }]}>
                Système
              </Text>
            </View>
          )}
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[
          st.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Contrôle */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <Text style={[st.sectionLabel, { color: t.text.muted }]}>
            CONTRÔLE D'ACCÈS
          </Text>
          <View
            style={[
              st.controlCard,
              {
                backgroundColor: isBlocked ? t.blocked.bg : t.allowed.bg,
                borderColor: isBlocked ? t.blocked.border : t.allowed.border,
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
                  borderWidth: 1,
                  borderColor: isBlocked ? t.blocked.border : t.allowed.border,
                },
              ]}
            >
              <Text
                style={[
                  st.controlIcon,
                  { color: isBlocked ? t.blocked.accent : t.allowed.accent },
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
                  ? "Toutes les connexions sont bloquées"
                  : "Accès réseau normal"}
              </Text>
            </View>
            <Toggle value={isBlocked} onPress={toggleBlock} />
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View
          style={[st.section, { transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={[st.sectionLabel, { color: t.text.muted }]}>
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
                label: "%",
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
                  {item.suffix ?? ""}
                </Text>
                <View style={st.statLabelRow}>
                  <View style={[st.statDot, { backgroundColor: item.color }]} />
                  <Text style={[st.statLabel, { color: t.text.muted }]}>
                    {item.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {total > 0 && (
            <View style={{ marginTop: 12, marginBottom: 14 }}>
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
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
            onPress={simulateAttempt}
            activeOpacity={0.8}
          >
            <Text style={[st.simulateBtnIcon, { color: t.text.muted }]}>◎</Text>
            <Text style={[st.simulateBtnText, { color: t.text.secondary }]}>
              Simuler une connexion
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Planification */}
        <Animated.View
          style={[st.section, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={st.sectionHeaderRow}>
            <Text style={[st.sectionLabel, { color: t.text.muted }]}>
              PLANIFICATION
            </Text>
            <TouchableOpacity
              style={[
                st.addBtn,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
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
                  { color: scheduleLimitReached ? t.text.muted : t.text.link },
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
        </Animated.View>
      </Animated.ScrollView>

      {/* Modal planification */}
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

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 24, borderBottomWidth: 1 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 22,
  },
  backArrow: { fontSize: 18, color: Colors.gray[0], lineHeight: 20 },
  backText: { fontSize: 14, color: Colors.gray[0], fontWeight: "600" },
  heroSection: { alignItems: "center" },
  heroIcon: { width: 80, height: 80, borderRadius: 22, marginBottom: 14 },
  heroIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
  },
  heroIconLetter: { fontSize: 32, fontWeight: "800" },
  heroName: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -0.5,
    marginBottom: 5,
  },
  heroPackage: { fontSize: 11, fontFamily: "monospace", marginBottom: 10 },
  sysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sysBadgeText: { fontSize: 10, fontWeight: "600" },
  scroll: { paddingHorizontal: 20, paddingTop: 22 },
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  controlCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    overflow: "hidden",
    gap: 14,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  controlIcon: { fontSize: 18 },
  controlTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  controlSub: { fontSize: 11 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  statNum: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statDot: { width: 5, height: 5, borderRadius: 3 },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  simulateBtnIcon: { fontSize: 13 },
  simulateBtnText: { fontSize: 13, fontWeight: "600" },
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
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 26 },
  emptyTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
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
