import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
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

import AppDetailSkeleton from "@/components/AppDetailSkeleton";
import PaywallModal from "@/components/PaywallModal";
import { usePremium } from "@/hooks/usePremium";
import AppListService from "@/services/app-list.service";
import ScheduleService from "@/services/schedule.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import { AppRule, InstalledApp, Schedule } from "@/types";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// ─── Animated progress bar ────────────────────────────────────────────────────
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

// ─── Toggle animé ─────────────────────────────────────────────────────────────
function Toggle({
  value,
  onPress,
  size = "md",
}: {
  value: boolean;
  onPress: () => void;
  size?: "sm" | "md";
}) {
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
    outputRange: ["#14141E", "#16103A"],
  });
  const border = pos.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1C1C2C", "#4A3F8A"],
  });
  const thumbX = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [2, travel],
  });
  const thumbBg = pos.interpolate({
    inputRange: [0, 1],
    outputRange: ["#2A2A3A", "#7B6EF6"],
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

// ─── Schedule Card ────────────────────────────────────────────────────────────
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
  const isNow = ScheduleService.isScheduleActiveNow(schedule);
  const isBlock = schedule.action === "block";
  const accent = isBlock ? "#C04060" : "#2DB870";
  const accentBg = isBlock ? "#140810" : "#081410";
  const accentBorder = isBlock ? "#3A1020" : "#0E3020";

  return (
    <TouchableOpacity
      style={[st.scheduleCard, !schedule.isActive && st.scheduleCardDim]}
      onPress={onEdit}
      activeOpacity={0.75}
    >
      <View style={[st.scheduleAccent, { backgroundColor: accent }]} />
      <View style={st.scheduleLeft}>
        <View style={st.scheduleTopRow}>
          <View
            style={[
              st.actionPill,
              { backgroundColor: accentBg, borderColor: accentBorder },
            ]}
          >
            <View style={[st.actionDot, { backgroundColor: accent }]} />
            <Text style={[st.actionPillText, { color: accent }]}>
              {isBlock ? "Bloquer" : "Autoriser"}
            </Text>
          </View>
          {isNow && schedule.isActive && (
            <View style={st.nowBadge}>
              <View style={st.nowDot} />
              <Text style={st.nowBadgeText}>EN COURS</Text>
            </View>
          )}
        </View>

        <Text style={st.scheduleTime}>
          {ScheduleService.formatTime(schedule.startHour, schedule.startMinute)}
          <Text style={st.scheduleTimeSep}> → </Text>
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
                  active && {
                    backgroundColor: accentBg,
                    borderColor: accentBorder,
                  },
                ]}
              >
                <Text style={[st.dayChipText, active && { color: accent }]}>
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
          style={st.scheduleDeleteBtn}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Text style={st.scheduleDeleteIcon}>⌫</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AppDetailScreen() {
  const insets = useSafeAreaInsets();
  const { packageName } = useLocalSearchParams<{ packageName: string }>();
  const { isPremium } = usePremium();
  const [app, setApp] = useState<InstalledApp | null>(null);
  const [rule, setRule] = useState<AppRule | null>(null);
  const [stats, setStats] = useState({ blocked: 0, allowed: 0 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);
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
      const allRules = await StorageService.getRules();
      setBlockedCount(allRules.filter((r) => r.isBlocked).length);
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
    if (
      newBlocked &&
      !isPremium &&
      blockedCount >= FREE_LIMITS.MAX_BLOCKED_APPS
    ) {
      setPaywallVisible(true);
      return;
    }
    await VpnService.setRule(packageName, newBlocked);
    setBlockedCount((c) => c + (newBlocked ? 1 : -1));
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
    alert(
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
      alert("Sélectionnez au moins un jour.");
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

  // Vérifier limite planifications
  const scheduleLimitReached =
    !isPremium && schedules.length >= FREE_LIMITS.MAX_SCHEDULES;

  if (loading) return <AppDetailSkeleton />;

  const isBlocked = rule?.isBlocked ?? false;
  const total = stats.blocked + stats.allowed;
  const blockedPct = total > 0 ? stats.blocked / total : 0;
  const blockedPercent = Math.round(blockedPct * 100);

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07070F" />

      {/* ── Header ── */}
      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
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
            <View style={st.heroIconPlaceholder}>
              <Text style={st.heroIconLetter}>{app?.appName.charAt(0)}</Text>
            </View>
          )}
          <Text style={st.heroName}>{app?.appName}</Text>
          <Text style={st.heroPackage}>{app?.packageName}</Text>
          {app?.isSystemApp && (
            <View style={st.sysBadge}>
              <Text style={st.sysBadgeText}>Système</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Scroll ── */}
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[
          st.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Contrôle d'accès ── */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <Text style={st.sectionLabel}>CONTRÔLE D'ACCÈS</Text>
          <View
            style={[
              st.controlCard,
              isBlocked ? st.controlCardBlocked : st.controlCardAllowed,
            ]}
          >
            <View
              style={[
                st.controlAccent,
                { backgroundColor: isBlocked ? "#C04060" : "#2DB870" },
              ]}
            />
            <View
              style={[
                st.controlIconWrap,
                isBlocked ? st.controlIconBlocked : st.controlIconAllowed,
              ]}
            >
              <Text style={st.controlIcon}>{isBlocked ? "◈" : "◎"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  st.controlTitle,
                  { color: isBlocked ? "#E8D0D8" : "#C8E8D0" },
                ]}
              >
                {isBlocked ? "Internet bloqué" : "Internet autorisé"}
              </Text>
              <Text style={st.controlSub}>
                {isBlocked
                  ? "Toutes les connexions sont bloquées"
                  : "Accès réseau normal"}
              </Text>
            </View>
            <Toggle value={isBlocked} onPress={toggleBlock} />
          </View>
        </Animated.View>

        {/* ── Stats ── */}
        <Animated.View
          style={[st.section, { transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={st.sectionLabel}>STATISTIQUES</Text>

          <View style={st.statsRow}>
            <View style={[st.statCard, st.statBlocked]}>
              <Text style={[st.statNum, { color: "#C04060" }]}>
                {stats.blocked}
              </Text>
              <View style={st.statLabelRow}>
                <View style={[st.statDot, { backgroundColor: "#C04060" }]} />
                <Text style={st.statLabel}>Bloquées</Text>
              </View>
            </View>
            <View style={[st.statCard, st.statAllowed]}>
              <Text style={[st.statNum, { color: "#2DB870" }]}>
                {stats.allowed}
              </Text>
              <View style={st.statLabelRow}>
                <View style={[st.statDot, { backgroundColor: "#2DB870" }]} />
                <Text style={st.statLabel}>Autorisées</Text>
              </View>
            </View>
            <View style={[st.statCard, st.statPct]}>
              <Text style={[st.statNum, { color: "#9B8FFF" }]}>
                {blockedPercent}%
              </Text>
              <View style={st.statLabelRow}>
                <View style={[st.statDot, { backgroundColor: "#9B8FFF" }]} />
                <Text style={st.statLabel}>Bloqué</Text>
              </View>
            </View>
          </View>

          {total > 0 && (
            <View style={{ marginTop: 12, marginBottom: 14 }}>
              <ProgressBar pct={blockedPct} color="#C04060" track="#14141E" />
            </View>
          )}

          <TouchableOpacity
            style={st.simulateBtn}
            onPress={simulateAttempt}
            activeOpacity={0.8}
          >
            <Text style={st.simulateBtnIcon}>◎</Text>
            <Text style={st.simulateBtnText}>Simuler une connexion</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Planification ── */}
        <Animated.View
          style={[st.section, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={st.sectionHeaderRow}>
            <Text style={st.sectionLabel}>PLANIFICATION</Text>
            <TouchableOpacity
              style={[st.addBtn, scheduleLimitReached && st.addBtnLocked]}
              onPress={() => {
                if (!scheduleLimitReached) openAddModal();
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  st.addBtnText,
                  scheduleLimitReached && st.addBtnTextLocked,
                ]}
              >
                {scheduleLimitReached ? "🔒 Premium" : "+ Ajouter"}
              </Text>
            </TouchableOpacity>
          </View>

          {schedules.length === 0 ? (
            <View style={st.emptySchedule}>
              <View style={st.emptyIconWrap}>
                <Text style={st.emptyIconText}>◷</Text>
              </View>
              <Text style={st.emptyTitle}>Aucune planification</Text>
              <Text style={st.emptySubtitle}>
                Définissez des plages horaires pour bloquer ou autoriser
                automatiquement Internet.
              </Text>
              <TouchableOpacity
                style={st.emptyBtn}
                onPress={openAddModal}
                activeOpacity={0.8}
              >
                <Text style={st.emptyBtnText}>Créer une planification</Text>
              </TouchableOpacity>
            </View>
          ) : (
            schedules.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                onEdit={() => openEditModal(s)}
                onToggle={() => toggleSchedule(s.id)}
                onDelete={() => deleteSchedule(s.id)}
              />
            ))
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
                transform: [{ translateY: modalSlide }],
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={ms.handle} />
            <View style={ms.sheetHeader}>
              <Text style={ms.sheetTitle}>
                {editingSchedule ? "Modifier" : "Nouvelle planification"}
              </Text>
              <TouchableOpacity onPress={closeModal} style={ms.closeIcon}>
                <Text style={ms.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Action */}
              <Text style={ms.fieldLabel}>ACTION</Text>
              <View style={ms.actionRow}>
                {(["block", "allow"] as const).map((a) => {
                  const active = formAction === a;
                  const c =
                    a === "block"
                      ? { bg: "#140810", border: "#3A1020", text: "#C04060" }
                      : { bg: "#081410", border: "#0E3020", text: "#2DB870" };
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[
                        ms.actionChip,
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
                          active && { backgroundColor: c.text },
                        ]}
                      />
                      <Text
                        style={[ms.actionChipText, active && { color: c.text }]}
                      >
                        {a === "block" ? "Bloquer" : "Autoriser"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Horaires */}
              <View style={ms.timeRow}>
                {(["start", "end"] as const).map((target, idx) => {
                  const h = target === "start" ? formStartHour : formEndHour;
                  const m =
                    target === "start" ? formStartMinute : formEndMinute;
                  return (
                    <React.Fragment key={target}>
                      {idx === 1 && <Text style={ms.timeSep}>→</Text>}
                      <View style={{ flex: 1 }}>
                        <Text style={ms.fieldLabel}>
                          {target === "start" ? "DÉBUT" : "FIN"}
                        </Text>
                        <TouchableOpacity
                          style={[
                            ms.timeDisplay,
                            timePickerTarget === target &&
                              showTimePicker &&
                              ms.timeDisplayActive,
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
                          <Text style={ms.timeDisplayText}>
                            {ScheduleService.formatTime(h, m)}
                          </Text>
                          <Text style={ms.timeDisplayCaret}>
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
                  themeVariant="dark"
                  textColor="#F0F0FF"
                  style={Platform.OS === "ios" ? ms.iosPicker : undefined}
                />
              )}
              {showTimePicker && Platform.OS === "ios" && (
                <TouchableOpacity
                  style={ms.confirmBtn}
                  onPress={() => setShowTimePicker(false)}
                  activeOpacity={0.8}
                >
                  <Text style={ms.confirmBtnText}>Valider</Text>
                </TouchableOpacity>
              )}

              {/* Jours */}
              <Text style={ms.fieldLabel}>JOURS</Text>
              <View style={ms.daysRow}>
                {DAYS.map((d, i) => {
                  const active = formDays.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[ms.dayChip, active && ms.dayChipActive]}
                      onPress={() => toggleDay(i)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[ms.dayChipText, active && ms.dayChipTextActive]}
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
                    style={ms.shortcut}
                    onPress={() => setFormDays(days)}
                    activeOpacity={0.8}
                  >
                    <Text style={ms.shortcutText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={ms.saveBtn}
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
        onClose={() => setPaywallVisible(false)}
        reason="blocked_apps"
        onUpgraded={() => {
          setPaywallVisible(false);
          loadAll();
        }}
      />
    </View>
  );
}

// ─── Styles principaux ────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070F" },

  // Header
  header: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#111120",
    backgroundColor: "#07070F",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 22,
  },
  backArrow: { fontSize: 18, color: "#7B6EF6", lineHeight: 20 },
  backText: { fontSize: 14, color: "#7B6EF6", fontWeight: "600" },

  heroSection: { alignItems: "center" },
  heroIcon: { width: 80, height: 80, borderRadius: 22, marginBottom: 14 },
  heroIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: "#14142A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2A2A40",
  },
  heroIconLetter: { fontSize: 32, fontWeight: "800", color: "#7B6EF6" },
  heroName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#EDEDFF",
    letterSpacing: -0.5,
    marginBottom: 5,
  },
  heroPackage: {
    fontSize: 11,
    color: "#1E1E38",
    fontFamily: "monospace",
    marginBottom: 10,
  },
  sysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  sysBadgeText: { fontSize: 10, color: "#3A3A58", fontWeight: "600" },

  // Scroll
  scroll: { paddingHorizontal: 20, paddingTop: 22 },
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2A2A48",
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  // Contrôle
  controlCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    overflow: "hidden",
    gap: 14,
  },
  controlCardBlocked: { backgroundColor: "#0E0608", borderColor: "#2A1018" },
  controlCardAllowed: { backgroundColor: "#060E08", borderColor: "#0E2818" },
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
  controlIconBlocked: {
    backgroundColor: "#180810",
    borderWidth: 1,
    borderColor: "#3A1020",
  },
  controlIconAllowed: {
    backgroundColor: "#081808",
    borderWidth: 1,
    borderColor: "#0E3020",
  },
  controlIcon: { fontSize: 18, color: "#5A5A80" },
  controlTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  controlSub: { fontSize: 11, color: "#2E2E48" },

  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  statBlocked: { backgroundColor: "#0E0608", borderColor: "#2A1018" },
  statAllowed: { backgroundColor: "#060E08", borderColor: "#0E2818" },
  statPct: { backgroundColor: "#0C0C18", borderColor: "#2A2460" },
  statNum: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statDot: { width: 5, height: 5, borderRadius: 3 },
  statLabel: {
    fontSize: 9,
    color: "#2A2A48",
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Simulate
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0C0C16",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#141428",
  },
  simulateBtnIcon: { fontSize: 13, color: "#3A3A58" },
  simulateBtnText: { color: "#3A3A58", fontSize: 13, fontWeight: "600" },

  // Add button
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#3A3480",
  },
  addBtnLocked: { backgroundColor: "#14141E", borderColor: "#1C1C2C" },
  addBtnText: { fontSize: 12, color: "#9B8FFF", fontWeight: "700" },
  addBtnTextLocked: { color: "#3A3A58" },

  // Schedule cards
  scheduleCard: {
    flexDirection: "row",
    backgroundColor: "#0C0C16",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#141428",
    marginBottom: 8,
    overflow: "hidden",
  },
  scheduleCardDim: { opacity: 0.4 },
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
    backgroundColor: "#081410",
    borderWidth: 1,
    borderColor: "#0E3020",
  },
  nowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#2DB870" },
  nowBadgeText: {
    fontSize: 9,
    color: "#2DB870",
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  scheduleTime: {
    fontSize: 22,
    fontWeight: "800",
    color: "#D8D8F0",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  scheduleTimeSep: { color: "#2A2A48", fontWeight: "400" },
  daysRow: { flexDirection: "row", gap: 4 },
  dayChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#141428",
  },
  dayChipText: { fontSize: 9, color: "#2A2A48", fontWeight: "700" },
  scheduleRight: { alignItems: "center", gap: 10, paddingLeft: 12 },
  scheduleDeleteBtn: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#140810",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A1018",
  },
  scheduleDeleteIcon: { fontSize: 12, color: "#4A2030" },

  // Empty
  emptySchedule: {
    backgroundColor: "#0C0C16",
    borderRadius: 18,
    padding: 28,
    borderWidth: 1,
    borderColor: "#141428",
    alignItems: "center",
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
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 26, color: "#5A4A9A" },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#C0C0D8",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#2A2A48",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#3A3480",
  },
  emptyBtnText: { color: "#9B8FFF", fontSize: 13, fontWeight: "700" },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0C0C16",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#141428",
    maxHeight: "92%",
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
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  sheetTitle: {
    fontSize: 19,
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

  fieldLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2A2A48",
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
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#141428",
  },
  actionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2A2A3A",
  },
  actionChipText: { fontSize: 14, fontWeight: "700", color: "#3A3A58" },

  timeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 14,
  },
  timeSep: {
    color: "#2A2A48",
    fontSize: 16,
    fontWeight: "700",
    paddingBottom: 14,
  },
  timeDisplay: {
    backgroundColor: "#07070F",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#141428",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeDisplayActive: { borderColor: "#3A3480", backgroundColor: "#0C0C1A" },
  timeDisplayText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#D8D8F0",
    letterSpacing: 1,
  },
  timeDisplayCaret: { fontSize: 10, color: "#2A2A48" },

  confirmBtn: {
    backgroundColor: "#16103A",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#3A3480",
  },
  confirmBtnText: { color: "#9B8FFF", fontSize: 14, fontWeight: "700" },

  daysRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#07070F",
    borderWidth: 1,
    borderColor: "#141428",
  },
  dayChipActive: { backgroundColor: "#16103A", borderColor: "#3A3480" },
  dayChipText: { fontSize: 12, color: "#2A2A48", fontWeight: "700" },
  dayChipTextActive: { color: "#9B8FFF" },

  shortcutsRow: { flexDirection: "row", gap: 8, marginBottom: 22 },
  shortcut: {
    flex: 1,
    backgroundColor: "#07070F",
    borderRadius: 10,
    padding: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#141428",
  },
  shortcutText: { fontSize: 11, color: "#3A3A58", fontWeight: "600" },

  saveBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#F0F0FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  iosPicker: { width: "100%", height: 150, marginBottom: 4 },
});
