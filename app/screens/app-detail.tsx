import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

import AppListService from "@/services/app-list.service";
import ScheduleService from "@/services/schedule.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { AppRule, InstalledApp, Schedule } from "@/types";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_FULL = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

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
            style={[tp.item, h === hour && tp.itemSelected]}
            onPress={() => onChange(h, minute)}
          >
            <Text style={[tp.itemText, h === hour && tp.itemTextSelected]}>
              {h.toString().padStart(2, "0")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={tp.separator}>:</Text>
      <ScrollView style={tp.scroll} showsVerticalScrollIndicator={false}>
        {minutes.map((m) => (
          <TouchableOpacity
            key={m}
            style={[tp.item, m === minute && tp.itemSelected]}
            onPress={() => onChange(hour, m)}
          >
            <Text style={[tp.itemText, m === minute && tp.itemTextSelected]}>
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
  separator: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginHorizontal: 8,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  itemSelected: {
    backgroundColor: "#00F5A020",
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  itemText: { fontSize: 18, color: "#555", fontWeight: "600" },
  itemTextSelected: { color: "#00F5A0" },
});

export default function AppDetailScreen() {
  const { packageName } = useLocalSearchParams<{ packageName: string }>();
  const [app, setApp] = useState<InstalledApp | null>(null);
  const [rule, setRule] = useState<AppRule | null>(null);
  const [stats, setStats] = useState({ blocked: 0, allowed: 0 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Modal state
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

  useEffect(() => {
    loadAll();
  }, [packageName]);

  const loadAll = async () => {
    try {
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
      const appSchedules = await ScheduleService.getSchedules(packageName);
      setSchedules(appSchedules);
    } catch (error) {
      console.error("Erreur chargement:", error);
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
    setFormLabel("Nouvelle planification");
    setFormStartHour(8);
    setFormStartMinute(0);
    setFormEndHour(18);
    setFormEndMinute(0);
    setFormDays([1, 2, 3, 4, 5]);
    setFormAction("block");
    setShowModal(true);
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormLabel(schedule.label);
    setFormStartHour(schedule.startHour);
    setFormStartMinute(schedule.startMinute);
    setFormEndHour(schedule.endHour);
    setFormEndMinute(schedule.endMinute);
    setFormDays([...schedule.days]);
    setFormAction(schedule.action);
    setShowModal(true);
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
    setShowModal(false);
  };

  const deleteSchedule = async (id: string) => {
    await ScheduleService.deleteSchedule(id);
    setSchedules(await ScheduleService.getSchedules(packageName));
  };

  const toggleSchedule = async (id: string) => {
    await ScheduleService.toggleSchedule(id);
    setSchedules(await ScheduleService.getSchedules(packageName));
  };

  const toggleDay = (day: number) => {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  if (!app) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
        <Text style={{ color: "#555", textAlign: "center", marginTop: 100 }}>
          Chargement...
        </Text>
      </View>
    );
  }

  const isBlocked = rule?.isBlocked ?? false;
  const total = stats.blocked + stats.allowed;
  const blockedPercent =
    total > 0 ? Math.round((stats.blocked / total) * 100) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.appHero}>
          {app.icon ? (
            <Image
              source={{ uri: `data:image/png;base64,${app.icon}` }}
              style={styles.heroIcon}
            />
          ) : (
            <View style={styles.heroIconPlaceholder}>
              <Text style={styles.heroIconLetter}>{app.appName.charAt(0)}</Text>
            </View>
          )}
          <Text style={styles.heroName}>{app.appName}</Text>
          <Text style={styles.heroPackage}>{app.packageName}</Text>
          {app.isSystemApp && (
            <View style={styles.systemBadge}>
              <Text style={styles.systemBadgeText}>App système</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Access Control */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTRÔLE D'ACCÈS</Text>
          <View
            style={[
              styles.card,
              isBlocked ? styles.cardBlocked : styles.cardAllowed,
            ]}
          >
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.cardTitle}>
                  {isBlocked ? "🚫 Internet bloqué" : "✅ Internet autorisé"}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {isBlocked
                    ? "Toutes les connexions sont bloquées"
                    : "Accès réseau normal"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.bigToggle,
                  isBlocked ? styles.bigToggleOff : styles.bigToggleOn,
                ]}
                onPress={toggleBlock}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.bigThumb,
                    isBlocked ? styles.bigThumbOff : styles.bigThumbOn,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STATISTIQUES</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardBlocked]}>
              <Text style={styles.statNumber}>{stats.blocked}</Text>
              <Text style={styles.statLabel}>Bloquées</Text>
            </View>
            <View style={[styles.statCard, styles.statCardAllowed]}>
              <Text style={styles.statNumber}>{stats.allowed}</Text>
              <Text style={styles.statLabel}>Autorisées</Text>
            </View>
            <View style={[styles.statCard, styles.statCardTotal]}>
              <Text style={styles.statNumber}>{blockedPercent}%</Text>
              <Text style={styles.statLabel}>Bloqué</Text>
            </View>
          </View>
          {total > 0 && (
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${blockedPercent}%` as any },
                ]}
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.testBtn}
            onPress={simulateAttempt}
            activeOpacity={0.8}
          >
            <Text style={styles.testBtnText}>🧪 Simuler une connexion</Text>
          </TouchableOpacity>
        </View>

        {/* Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PLANIFICATION</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openAddModal}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>

          {schedules.length === 0 ? (
            <View style={styles.emptySchedule}>
              <Text style={styles.emptyScheduleIcon}>🕐</Text>
              <Text style={styles.emptyScheduleTitle}>
                Aucune planification
              </Text>
              <Text style={styles.emptyScheduleText}>
                Définissez des plages horaires pour bloquer ou autoriser
                automatiquement Internet.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={openAddModal}
              >
                <Text style={styles.emptyAddBtnText}>
                  Créer une planification
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            schedules.map((schedule) => {
              const isNow = ScheduleService.isScheduleActiveNow(schedule);
              return (
                <TouchableOpacity
                  key={schedule.id}
                  style={[
                    styles.scheduleCard,
                    !schedule.isActive && styles.scheduleCardInactive,
                  ]}
                  onPress={() => openEditModal(schedule)}
                  activeOpacity={0.8}
                >
                  <View style={styles.scheduleCardLeft}>
                    <View style={styles.scheduleCardTop}>
                      <Text
                        style={[
                          styles.scheduleAction,
                          schedule.action === "block"
                            ? styles.scheduleActionBlock
                            : styles.scheduleActionAllow,
                        ]}
                      >
                        {schedule.action === "block" ? "🚫" : "✅"}{" "}
                        {schedule.action === "block" ? "Bloquer" : "Autoriser"}
                      </Text>
                      {isNow && schedule.isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>● ACTIF</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.scheduleTime}>
                      {ScheduleService.formatTime(
                        schedule.startHour,
                        schedule.startMinute,
                      )}
                      {" → "}
                      {ScheduleService.formatTime(
                        schedule.endHour,
                        schedule.endMinute,
                      )}
                    </Text>
                    <View style={styles.scheduleDaysRow}>
                      {DAYS.map((d, i) => (
                        <View
                          key={i}
                          style={[
                            styles.scheduleDayChip,
                            schedule.days.includes(i) &&
                              styles.scheduleDayChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.scheduleDayText,
                              schedule.days.includes(i) &&
                                styles.scheduleDayTextActive,
                            ]}
                          >
                            {d}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.scheduleCardRight}>
                    <TouchableOpacity
                      style={[
                        styles.scheduleToggle,
                        schedule.isActive
                          ? styles.scheduleToggleOn
                          : styles.scheduleToggleOff,
                      ]}
                      onPress={() => toggleSchedule(schedule.id)}
                    >
                      <View
                        style={[
                          styles.scheduleThumb,
                          schedule.isActive
                            ? styles.scheduleThumbOn
                            : styles.scheduleThumbOff,
                        ]}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteSchedule(schedule.id)}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal ajout/édition */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={modal.overlay}>
          <View style={modal.container}>
            <View style={modal.header}>
              <Text style={modal.title}>
                {editingSchedule ? "Modifier" : "Nouvelle planification"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={modal.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Action */}
              <Text style={modal.label}>ACTION</Text>
              <View style={modal.actionRow}>
                <TouchableOpacity
                  style={[
                    modal.actionChip,
                    formAction === "block" && modal.actionChipBlock,
                  ]}
                  onPress={() => setFormAction("block")}
                >
                  <Text
                    style={[
                      modal.actionChipText,
                      formAction === "block" && modal.actionChipTextBlock,
                    ]}
                  >
                    🚫 Bloquer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    modal.actionChip,
                    formAction === "allow" && modal.actionChipAllow,
                  ]}
                  onPress={() => setFormAction("allow")}
                >
                  <Text
                    style={[
                      modal.actionChipText,
                      formAction === "allow" && modal.actionChipTextAllow,
                    ]}
                  >
                    ✅ Autoriser
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Heures */}
              <View style={modal.timeRow}>
                <View style={modal.timeBlock}>
                  <Text style={modal.label}>DÉBUT</Text>
                  <TouchableOpacity
                    style={modal.timeDisplay}
                    onPress={() => {
                      setTimePickerTarget("start");
                      setShowTimePicker(true);
                    }}
                  >
                    <Text style={modal.timeDisplayText}>
                      {ScheduleService.formatTime(
                        formStartHour,
                        formStartMinute,
                      )}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={modal.timeSep}>→</Text>
                <View style={modal.timeBlock}>
                  <Text style={modal.label}>FIN</Text>
                  <TouchableOpacity
                    style={modal.timeDisplay}
                    onPress={() => {
                      setTimePickerTarget("end");
                      setShowTimePicker(true);
                    }}
                  >
                    <Text style={modal.timeDisplayText}>
                      {ScheduleService.formatTime(formEndHour, formEndMinute)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Time picker inline */}
              {showTimePicker && (
                <View style={modal.timePickerContainer}>
                  <Text style={modal.timePickerLabel}>
                    {timePickerTarget === "start"
                      ? "⏰ Heure de début"
                      : "⏰ Heure de fin"}
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
                    style={modal.timePickerDone}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={modal.timePickerDoneText}>Confirmer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Jours */}
              <Text style={modal.label}>JOURS</Text>
              <View style={modal.daysRow}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      modal.dayChip,
                      formDays.includes(i) && modal.dayChipActive,
                    ]}
                    onPress={() => toggleDay(i)}
                  >
                    <Text
                      style={[
                        modal.dayChipText,
                        formDays.includes(i) && modal.dayChipTextActive,
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Raccourcis jours */}
              <View style={modal.shortcutsRow}>
                <TouchableOpacity
                  style={modal.shortcut}
                  onPress={() => setFormDays([1, 2, 3, 4, 5])}
                >
                  <Text style={modal.shortcutText}>Semaine</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={modal.shortcut}
                  onPress={() => setFormDays([0, 6])}
                >
                  <Text style={modal.shortcutText}>Week-end</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={modal.shortcut}
                  onPress={() => setFormDays([0, 1, 2, 3, 4, 5, 6])}
                >
                  <Text style={modal.shortcutText}>Tous</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={modal.saveBtn}
              onPress={saveSchedule}
              activeOpacity={0.8}
            >
              <Text style={modal.saveBtnText}>
                {editingSchedule ? "Enregistrer" : "Créer la planification"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: "#0A0A0F",
  },
  backBtn: { marginBottom: 24 },
  backBtnText: { color: "#00F5A0", fontSize: 15, fontWeight: "600" },
  appHero: { alignItems: "center" },
  heroIcon: { width: 80, height: 80, borderRadius: 20, marginBottom: 12 },
  heroIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#16161E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  heroIconLetter: { fontSize: 32, fontWeight: "800", color: "#00F5A0" },
  heroName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  heroPackage: {
    fontSize: 12,
    color: "#444",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  systemBadge: {
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  systemBadgeText: { fontSize: 11, color: "#555", fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 1.5,
  },
  addBtn: {
    backgroundColor: "#00F5A015",
    borderWidth: 1,
    borderColor: "#00F5A0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addBtnText: { color: "#00F5A0", fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: "#16161E",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  cardBlocked: { borderColor: "#FF4D4D30", backgroundColor: "#FF4D4D08" },
  cardAllowed: { borderColor: "#00F5A030", backgroundColor: "#00F5A008" },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 12, color: "#555" },
  bigToggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    padding: 4,
  },
  bigToggleOn: {
    backgroundColor: "#00F5A020",
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  bigToggleOff: {
    backgroundColor: "#FF4D4D15",
    borderWidth: 1,
    borderColor: "#FF4D4D50",
  },
  bigThumb: { width: 22, height: 22, borderRadius: 11 },
  bigThumbOn: { backgroundColor: "#00F5A0", alignSelf: "flex-end" },
  bigThumbOff: { backgroundColor: "#FF4D4D60", alignSelf: "flex-start" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  statCardBlocked: { backgroundColor: "#FF4D4D10", borderColor: "#FF4D4D30" },
  statCardAllowed: { backgroundColor: "#00F5A010", borderColor: "#00F5A030" },
  statCardTotal: { backgroundColor: "#16161E", borderColor: "#1E1E2E" },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "#555",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  progressBar: {
    height: 4,
    backgroundColor: "#1E1E2E",
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#FF4D4D", borderRadius: 2 },
  testBtn: {
    backgroundColor: "#16161E",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  testBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  // Empty state
  emptySchedule: {
    backgroundColor: "#16161E",
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    alignItems: "center",
  },
  emptyScheduleIcon: { fontSize: 36, marginBottom: 12 },
  emptyScheduleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptyScheduleText: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddBtn: {
    backgroundColor: "#00F5A015",
    borderWidth: 1,
    borderColor: "#00F5A0",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyAddBtnText: { color: "#00F5A0", fontSize: 13, fontWeight: "700" },

  // Schedule cards
  scheduleCard: {
    backgroundColor: "#16161E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scheduleCardInactive: { opacity: 0.4 },
  scheduleCardLeft: { flex: 1 },
  scheduleCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  scheduleAction: { fontSize: 13, fontWeight: "700" },
  scheduleActionBlock: { color: "#FF4D4D" },
  scheduleActionAllow: { color: "#00F5A0" },
  activeBadge: {
    backgroundColor: "#00F5A020",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeText: {
    color: "#00F5A0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  scheduleTime: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  scheduleDaysRow: { flexDirection: "row", gap: 4 },
  scheduleDayChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#1E1E2E",
  },
  scheduleDayChipActive: {
    backgroundColor: "#00F5A015",
    borderWidth: 1,
    borderColor: "#00F5A040",
  },
  scheduleDayText: { fontSize: 9, color: "#444", fontWeight: "700" },
  scheduleDayTextActive: { color: "#00F5A0" },
  scheduleCardRight: { alignItems: "center", gap: 12, paddingLeft: 12 },
  scheduleToggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    padding: 3,
  },
  scheduleToggleOn: {
    backgroundColor: "#00F5A020",
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  scheduleToggleOff: {
    backgroundColor: "#1E1E2E",
    borderWidth: 1,
    borderColor: "#333",
  },
  scheduleThumb: { width: 14, height: 14, borderRadius: 7 },
  scheduleThumbOn: { backgroundColor: "#00F5A0", alignSelf: "flex-end" },
  scheduleThumbOff: { backgroundColor: "#333", alignSelf: "flex-start" },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#16161E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  closeBtn: { color: "#555", fontSize: 18, padding: 4 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  actionChip: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#1E1E2E",
    borderWidth: 1,
    borderColor: "#2E2E3E",
    alignItems: "center",
  },
  actionChipBlock: { backgroundColor: "#FF4D4D15", borderColor: "#FF4D4D" },
  actionChipAllow: { backgroundColor: "#00F5A015", borderColor: "#00F5A0" },
  actionChipText: { fontSize: 14, fontWeight: "700", color: "#555" },
  actionChipTextBlock: { color: "#FF4D4D" },
  actionChipTextAllow: { color: "#00F5A0" },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  timeBlock: { flex: 1 },
  timeSep: { color: "#555", fontSize: 18, fontWeight: "700", marginTop: 20 },
  timeDisplay: {
    backgroundColor: "#1E1E2E",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2E2E3E",
    alignItems: "center",
  },
  timeDisplayText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  timePickerContainer: {
    backgroundColor: "#1E1E2E",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2E2E3E",
  },
  timePickerLabel: {
    fontSize: 12,
    color: "#555",
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: 1,
  },
  timePickerDone: {
    backgroundColor: "#00F5A015",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  timePickerDoneText: { color: "#00F5A0", fontSize: 14, fontWeight: "700" },
  daysRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#1E1E2E",
    borderWidth: 1,
    borderColor: "#2E2E3E",
  },
  dayChipActive: { backgroundColor: "#00F5A015", borderColor: "#00F5A0" },
  dayChipText: { fontSize: 12, color: "#555", fontWeight: "700" },
  dayChipTextActive: { color: "#00F5A0" },
  shortcutsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  shortcut: {
    flex: 1,
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2E2E3E",
  },
  shortcutText: { fontSize: 11, color: "#555", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#00F5A0",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#0A0A0F", fontSize: 16, fontWeight: "800" },
});
