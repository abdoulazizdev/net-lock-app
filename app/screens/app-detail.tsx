import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppDetailSkeleton from "@/components/AppDetailSkeleton";
import AppListService from "@/services/app-list.service";
import ScheduleService from "@/services/schedule.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { AppRule, InstalledApp, Schedule } from "@/types";

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
      duration: 650,
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
        height: 4,
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
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  return (
    <View style={tp.container}>
      <ScrollView style={tp.scroll} showsVerticalScrollIndicator={false}>
        {hours.map((h) => (
          <TouchableOpacity
            key={h}
            style={[tp.item, h === hour && tp.itemActive]}
            onPress={() => onChange(h, minute)}
          >
            <Text style={[tp.itemText, h === hour && tp.itemTextActive]}>
              {h.toString().padStart(2, "0")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={tp.sep}>:</Text>
      <ScrollView style={tp.scroll} showsVerticalScrollIndicator={false}>
        {minutes.map((m) => (
          <TouchableOpacity
            key={m}
            style={[tp.item, m === minute && tp.itemActive]}
            onPress={() => onChange(hour, m)}
          >
            <Text style={[tp.itemText, m === minute && tp.itemTextActive]}>
              {m.toString().padStart(2, "0")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const tp = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", height: 160 },
  scroll: { flex: 1 },
  sep: {
    fontSize: 22,
    fontWeight: "800",
    color: "#E8E8F8",
    marginHorizontal: 8,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  itemActive: {
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  itemText: { fontSize: 18, color: "#3A3A58", fontWeight: "600" },
  itemTextActive: { color: "#9B8FFF", fontWeight: "800" },
});

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
  const accentColor = isBlock ? "#D04070" : "#3DDB8A";
  const accentBg = isBlock ? "#1E0E16" : "#0D2218";
  const accentBorder = isBlock ? "#4A1A2A" : "#1E6A46";

  return (
    <TouchableOpacity
      style={[
        styles.scheduleCard,
        !schedule.isActive && styles.scheduleCardDim,
      ]}
      onPress={onEdit}
      activeOpacity={0.75}
    >
      <View style={[styles.scheduleAccent, { backgroundColor: accentColor }]} />
      <View style={styles.scheduleLeft}>
        <View style={styles.scheduleTopRow}>
          <View
            style={[
              styles.actionPill,
              { backgroundColor: accentBg, borderColor: accentBorder },
            ]}
          >
            <View
              style={[styles.actionDot, { backgroundColor: accentColor }]}
            />
            <Text style={[styles.actionPillText, { color: accentColor }]}>
              {isBlock ? "Bloquer" : "Autoriser"}
            </Text>
          </View>
          {isNow && schedule.isActive && (
            <View style={styles.nowBadge}>
              <View style={styles.nowDot} />
              <Text style={styles.nowBadgeText}>EN COURS</Text>
            </View>
          )}
        </View>
        <Text style={styles.scheduleTime}>
          {ScheduleService.formatTime(schedule.startHour, schedule.startMinute)}
          <Text style={styles.scheduleTimeSep}> → </Text>
          {ScheduleService.formatTime(schedule.endHour, schedule.endMinute)}
        </Text>
        <View style={styles.daysRow}>
          {DAYS.map((d, i) => {
            const active = schedule.days.includes(i);
            return (
              <View
                key={i}
                style={[
                  styles.dayChip,
                  active && {
                    backgroundColor: accentBg,
                    borderColor: accentBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.dayChipText, active && { color: accentColor }]}
                >
                  {d}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.scheduleRight}>
        <TouchableOpacity
          style={[
            styles.scheduleToggle,
            schedule.isActive ? styles.toggleOn : styles.toggleOff,
          ]}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.toggleThumb,
              schedule.isActive ? styles.thumbOn : styles.thumbOff,
            ]}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.scheduleDeleteBtn}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Text style={styles.scheduleDeleteIcon}>⌫</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function AppDetailScreen() {
  const insets = useSafeAreaInsets();
  const { packageName } = useLocalSearchParams<{ packageName: string }>();
  const [app, setApp] = useState<InstalledApp | null>(null);
  const [rule, setRule] = useState<AppRule | null>(null);
  const [stats, setStats] = useState({ blocked: 0, allowed: 0 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

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

  // ── Tout en parallèle ──────────────────────────────────────────────────────
  const loadAll = async () => {
    try {
      setLoading(true);
      const [appData, existingRule, allStats, loadedSchedules] =
        await Promise.all([
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
      setSchedules(loadedSchedules);
    } catch (e) {
      console.error("Erreur chargement:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async () => {
    const newBlocked = !rule?.isBlocked;
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
    alert(
      result === "blocked" ? "🚫 Connexion bloquée" : "✅ Connexion autorisée",
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

  if (loading) return <AppDetailSkeleton />;

  const isBlocked = rule?.isBlocked ?? false;
  const total = stats.blocked + stats.allowed;
  const blockedPct = total > 0 ? stats.blocked / total : 0;
  const blockedPercent = Math.round(blockedPct * 100);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
        <View style={styles.heroSection}>
          {app?.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${app.icon}` }}
              style={styles.heroIcon}
            />
          ) : (
            <View style={styles.heroIconPlaceholder}>
              <Text style={styles.heroIconLetter}>
                {app?.appName.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={styles.heroName}>{app?.appName}</Text>
          <Text style={styles.heroPackage}>{app?.packageName}</Text>
          {app?.isSystemApp && (
            <View style={styles.sysBadge}>
              <Text style={styles.sysBadgeText}>Système</Text>
            </View>
          )}
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.sectionLabel}>CONTRÔLE D'ACCÈS</Text>
          <View
            style={[
              styles.controlCard,
              isBlocked ? styles.controlCardBlocked : styles.controlCardAllowed,
            ]}
          >
            <View
              style={[
                styles.controlAccent,
                { backgroundColor: isBlocked ? "#D04070" : "#3DDB8A" },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.controlTitle}>
                {isBlocked ? "Internet bloqué" : "Internet autorisé"}
              </Text>
              <Text style={styles.controlSub}>
                {isBlocked
                  ? "Toutes les connexions sont bloquées"
                  : "Accès réseau normal"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.bigToggle,
                isBlocked ? styles.bigToggleBlocked : styles.bigToggleAllowed,
              ]}
              onPress={toggleBlock}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.bigThumb,
                  isBlocked ? styles.bigThumbBlocked : styles.bigThumbAllowed,
                ]}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.section, { transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={styles.sectionLabel}>STATISTIQUES</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statBlocked]}>
              <Text style={[styles.statNum, { color: "#D04070" }]}>
                {stats.blocked}
              </Text>
              <View style={styles.statLabelRow}>
                <View
                  style={[styles.statDot, { backgroundColor: "#D04070" }]}
                />
                <Text style={styles.statLabel}>Bloquées</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.statAllowed]}>
              <Text style={[styles.statNum, { color: "#3DDB8A" }]}>
                {stats.allowed}
              </Text>
              <View style={styles.statLabelRow}>
                <View
                  style={[styles.statDot, { backgroundColor: "#3DDB8A" }]}
                />
                <Text style={styles.statLabel}>Autorisées</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.statTotal]}>
              <Text style={[styles.statNum, { color: "#9B8FFF" }]}>
                {blockedPercent}%
              </Text>
              <View style={styles.statLabelRow}>
                <View
                  style={[styles.statDot, { backgroundColor: "#9B8FFF" }]}
                />
                <Text style={styles.statLabel}>Bloqué</Text>
              </View>
            </View>
          </View>
          {total > 0 && (
            <View style={{ marginTop: 10, marginBottom: 14 }}>
              <ProgressBar pct={blockedPct} color="#D04070" track="#0D2218" />
            </View>
          )}
          <TouchableOpacity
            style={styles.simulateBtn}
            onPress={simulateAttempt}
            activeOpacity={0.8}
          >
            <Text style={styles.simulateBtnIcon}>◎</Text>
            <Text style={styles.simulateBtnText}>Simuler une connexion</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[styles.section, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>PLANIFICATION</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openAddModal}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnPlus}>+</Text>
              <Text style={styles.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {schedules.length === 0 ? (
            <View style={styles.emptySchedule}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIconText}>◷</Text>
              </View>
              <Text style={styles.emptyTitle}>Aucune planification</Text>
              <Text style={styles.emptySubtitle}>
                Définissez des plages horaires pour bloquer ou autoriser
                automatiquement Internet.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={openAddModal}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>Créer une planification</Text>
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

      <Modal
        visible={showModal}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View style={[modalStyles.overlay, { opacity: modalOpacity }]}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeModal}
          />
          <Animated.View
            style={[
              modalStyles.sheet,
              {
                transform: [{ translateY: modalSlide }],
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={modalStyles.handle} />
            <View style={modalStyles.sheetHeader}>
              <Text style={modalStyles.sheetTitle}>
                {editingSchedule ? "Modifier" : "Nouvelle planification"}
              </Text>
              <TouchableOpacity
                onPress={closeModal}
                style={modalStyles.closeBtn}
              >
                <View style={modalStyles.closeIcon}>
                  <Text style={modalStyles.closeIconText}>✕</Text>
                </View>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={modalStyles.fieldLabel}>ACTION</Text>
              <View style={modalStyles.actionRow}>
                {(["block", "allow"] as const).map((a) => {
                  const active = formAction === a;
                  const c =
                    a === "block"
                      ? { bg: "#1E0E16", border: "#6A1A35", text: "#D04070" }
                      : { bg: "#0D2218", border: "#1E6A46", text: "#3DDB8A" };
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[
                        modalStyles.actionChip,
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
                          modalStyles.actionChipDot,
                          active && { backgroundColor: c.text },
                        ]}
                      />
                      <Text
                        style={[
                          modalStyles.actionChipText,
                          active && { color: c.text },
                        ]}
                      >
                        {a === "block" ? "Bloquer" : "Autoriser"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={modalStyles.timeRow}>
                {(["start", "end"] as const).map((target, idx) => {
                  const h = target === "start" ? formStartHour : formEndHour;
                  const m =
                    target === "start" ? formStartMinute : formEndMinute;
                  return (
                    <React.Fragment key={target}>
                      {idx === 1 && <Text style={modalStyles.timeSep}>→</Text>}
                      <View style={{ flex: 1 }}>
                        <Text style={modalStyles.fieldLabel}>
                          {target === "start" ? "DÉBUT" : "FIN"}
                        </Text>
                        <TouchableOpacity
                          style={[
                            modalStyles.timeDisplay,
                            timePickerTarget === target &&
                              showTimePicker &&
                              modalStyles.timeDisplayActive,
                          ]}
                          onPress={() => {
                            setTimePickerTarget(target);
                            setShowTimePicker(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={modalStyles.timeDisplayText}>
                            {ScheduleService.formatTime(h, m)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              {showTimePicker && (
                <View style={modalStyles.timePickerWrap}>
                  <Text style={modalStyles.timePickerTitle}>
                    {timePickerTarget === "start"
                      ? "Heure de début"
                      : "Heure de fin"}
                  </Text>
                  <TimePicker
                    hour={
                      timePickerTarget === "start" ? formStartHour : formEndHour
                    }
                    minute={
                      timePickerTarget === "start"
                        ? formStartMinute
                        : formEndMinute
                    }
                    onChange={(h, m) => {
                      if (timePickerTarget === "start") {
                        setFormStartHour(h);
                        setFormStartMinute(m);
                      } else {
                        setFormEndHour(h);
                        setFormEndMinute(m);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={modalStyles.confirmBtn}
                    onPress={() => setShowTimePicker(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={modalStyles.confirmBtnText}>Confirmer</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={modalStyles.fieldLabel}>JOURS</Text>
              <View style={modalStyles.daysRow}>
                {DAYS.map((d, i) => {
                  const active = formDays.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        modalStyles.dayChip,
                        active && modalStyles.dayChipActive,
                      ]}
                      onPress={() => toggleDay(i)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          modalStyles.dayChipText,
                          active && modalStyles.dayChipTextActive,
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={modalStyles.shortcutsRow}>
                {[
                  { label: "Semaine", days: [1, 2, 3, 4, 5] },
                  { label: "Week-end", days: [0, 6] },
                  { label: "Tous", days: [0, 1, 2, 3, 4, 5, 6] },
                ].map(({ label, days }) => (
                  <TouchableOpacity
                    key={label}
                    style={modalStyles.shortcut}
                    onPress={() => setFormDays(days)}
                    activeOpacity={0.8}
                  >
                    <Text style={modalStyles.shortcutText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={modalStyles.saveBtn}
              onPress={saveSchedule}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.saveBtnText}>
                {editingSchedule ? "Enregistrer" : "Créer la planification"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  backArrow: { fontSize: 18, color: "#9B8FFF", lineHeight: 20 },
  backText: { fontSize: 14, color: "#9B8FFF", fontWeight: "600" },
  heroSection: { alignItems: "center" },
  heroIcon: { width: 80, height: 80, borderRadius: 22, marginBottom: 12 },
  heroIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: "#16162A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A40",
  },
  heroIconLetter: { fontSize: 32, fontWeight: "800", color: "#7B6EF6" },
  heroName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroPackage: {
    fontSize: 11,
    color: "#2E2E44",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  sysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  sysBadgeText: { fontSize: 11, color: "#3A3A58", fontWeight: "600" },
  scroll: { paddingHorizontal: 22, paddingTop: 22 },
  section: { marginBottom: 26 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  controlCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    overflow: "hidden",
    gap: 16,
  },
  controlCardBlocked: { backgroundColor: "#0E0A10", borderColor: "#2A1525" },
  controlCardAllowed: { backgroundColor: "#0A0E0C", borderColor: "#152518" },
  controlAccent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  controlTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 3,
    paddingLeft: 8,
  },
  controlSub: { fontSize: 12, color: "#3A3A58", paddingLeft: 8 },
  bigToggle: {
    width: 54,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    padding: 3,
    borderWidth: 1,
  },
  bigToggleAllowed: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  bigToggleBlocked: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  bigThumb: { width: 22, height: 22, borderRadius: 11 },
  bigThumbAllowed: { backgroundColor: "#3DDB8A", alignSelf: "flex-end" },
  bigThumbBlocked: { backgroundColor: "#4A2030", alignSelf: "flex-start" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 2 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  statBlocked: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  statAllowed: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  statTotal: { backgroundColor: "#16103A", borderColor: "#4A3F8A" },
  statNum: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statDot: { width: 5, height: 5, borderRadius: 3 },
  statLabel: {
    fontSize: 10,
    color: "#3A3A58",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  simulateBtnIcon: { fontSize: 14, color: "#3A3A58" },
  simulateBtnText: { color: "#5A5A80", fontSize: 14, fontWeight: "600" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  addBtnPlus: {
    fontSize: 14,
    color: "#9B8FFF",
    lineHeight: 16,
    fontWeight: "300",
  },
  addBtnText: { fontSize: 12, color: "#9B8FFF", fontWeight: "700" },
  scheduleCard: {
    flexDirection: "row",
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 8,
    overflow: "hidden",
  },
  scheduleCardDim: { opacity: 0.45 },
  scheduleAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  scheduleLeft: { flex: 1, paddingLeft: 8 },
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
    backgroundColor: "#0D2218",
    borderWidth: 1,
    borderColor: "#1E6A46",
  },
  nowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#3DDB8A" },
  nowBadgeText: {
    fontSize: 9,
    color: "#3DDB8A",
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  scheduleTime: {
    fontSize: 22,
    fontWeight: "800",
    color: "#E8E8F8",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  scheduleTimeSep: { color: "#3A3A58", fontWeight: "400" },
  daysRow: { flexDirection: "row", gap: 4 },
  dayChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  dayChipText: { fontSize: 9, color: "#2E2E44", fontWeight: "700" },
  scheduleRight: { alignItems: "center", gap: 10, paddingLeft: 12 },
  scheduleToggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    padding: 3,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  toggleOff: { backgroundColor: "#14141E", borderColor: "#1C1C2C" },
  toggleThumb: { width: 14, height: 14, borderRadius: 7 },
  thumbOn: { backgroundColor: "#3DDB8A", alignSelf: "flex-end" },
  thumbOff: { backgroundColor: "#2A2A3A", alignSelf: "flex-start" },
  scheduleDeleteBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#14080A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A1520",
  },
  scheduleDeleteIcon: { fontSize: 13, color: "#5A2030" },
  emptySchedule: {
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 28, color: "#7B6EF6" },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#3A3A58",
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
    borderColor: "#4A3F8A",
  },
  emptyBtnText: { color: "#9B8FFF", fontSize: 13, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0E0E18",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#1C1C2C",
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
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  closeBtn: {},
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
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  actionChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  actionChipDot: {
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
    color: "#3A3A58",
    fontSize: 16,
    fontWeight: "700",
    paddingBottom: 14,
  },
  timeDisplay: {
    backgroundColor: "#080810",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    alignItems: "center",
  },
  timeDisplayActive: { borderColor: "#4A3F8A", backgroundColor: "#0D0C1A" },
  timeDisplayText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#E8E8F8",
    letterSpacing: 1,
  },
  timePickerWrap: {
    backgroundColor: "#080810",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  timePickerTitle: {
    fontSize: 11,
    color: "#3A3A58",
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  confirmBtn: {
    backgroundColor: "#16103A",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  confirmBtnText: { color: "#9B8FFF", fontSize: 14, fontWeight: "700" },
  daysRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#080810",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  dayChipActive: { backgroundColor: "#16103A", borderColor: "#4A3F8A" },
  dayChipText: { fontSize: 12, color: "#3A3A58", fontWeight: "700" },
  dayChipTextActive: { color: "#9B8FFF" },
  shortcutsRow: { flexDirection: "row", gap: 8, marginBottom: 22 },
  shortcut: {
    flex: 1,
    backgroundColor: "#080810",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  shortcutText: { fontSize: 11, color: "#3A3A58", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#F0F0FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
