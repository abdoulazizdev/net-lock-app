import { ProfileSchedule } from "@/types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS_FULL = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

const ITEM_H = 54; // height of each drum item
const VISIBLE_ITEMS = 5; // items visible in the drum (odd number, selected is center)
const DRUM_H = ITEM_H * VISIBLE_ITEMS;

// ─── DrumRoller ───────────────────────────────────────────────────────────────
// Fully controlled drum roller with live highlight + snap commit
function DrumRoller({
  values,
  selected,
  onChange,
  format = (v: number) => String(v).padStart(2, "0"),
  label,
  accent = "#7B6EF6",
}: {
  values: number[];
  selected: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label: string;
  accent?: string;
}) {
  const scrollRef = useRef<ScrollView>(null);

  // localIdx drives the visual highlight in real-time as user scrolls
  const [localIdx, setLocalIdx] = useState(() =>
    Math.max(0, values.indexOf(selected)),
  );

  // Prevents double-commit from onScrollEndDrag + onMomentumScrollEnd
  const momentumStarted = useRef(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to correct position when modal opens or selected changes from parent
  useEffect(() => {
    const idx = values.indexOf(selected);
    if (idx < 0) return;
    setLocalIdx(idx);
    // Delay to ensure ScrollView is mounted and laid out
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    }, 120);
    return () => clearTimeout(t);
  }, [selected]);

  // Called during scroll — updates highlight live, no state commit
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const rawIdx = e.nativeEvent.contentOffset.y / ITEM_H;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(rawIdx)));
      setLocalIdx(idx);
    },
    [values.length],
  );

  // Final commit — snap and call onChange
  const commit = useCallback(
    (offsetY: number) => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      const idx = Math.max(
        0,
        Math.min(values.length - 1, Math.round(offsetY / ITEM_H)),
      );
      setLocalIdx(idx);
      onChange(values[idx]);
      // Correct snap to exact position
      scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true });
    },
    [values, onChange],
  );

  const handleMomentumBegin = useCallback(() => {
    momentumStarted.current = true;
  }, []);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      momentumStarted.current = false;
      commit(e.nativeEvent.contentOffset.y);
    },
    [commit],
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      // If momentum will follow, let onMomentumScrollEnd handle it
      // Otherwise (slow drag), commit after a short delay
      snapTimer.current = setTimeout(() => {
        if (!momentumStarted.current) commit(y);
      }, 80);
    },
    [commit],
  );

  const distFromCenter = (i: number) => Math.abs(i - localIdx);

  return (
    <View style={dr.col}>
      <Text style={dr.colLabel}>{label}</Text>
      <View style={dr.wrap}>
        {/* Selection ring — sits between bg and scroll content */}
        <View
          style={[
            dr.selector,
            { borderColor: accent + "50", backgroundColor: accent + "12" },
          ]}
          pointerEvents="none"
        />

        {/*
          CRITICAL: ScrollView must be ABOVE the selector in the tree
          so touches hit it first. Fades go AFTER ScrollView in JSX.
        */}
        <ScrollView
          ref={scrollRef}
          style={dr.scroll}
          contentContainerStyle={dr.scrollContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate={0.92}
          scrollEventThrottle={16}
          nestedScrollEnabled
          scrollEnabled
          onScroll={handleScroll}
          onMomentumScrollBegin={handleMomentumBegin}
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleScrollEndDrag}
        >
          {values.map((v, i) => {
            const dist = distFromCenter(i);
            const isSelected = i === localIdx;
            return (
              <TouchableOpacity
                key={v}
                style={dr.item}
                activeOpacity={0.6}
                onPress={() => {
                  setLocalIdx(i);
                  onChange(v);
                  scrollRef.current?.scrollTo({
                    y: i * ITEM_H,
                    animated: true,
                  });
                }}
              >
                <Text
                  style={[
                    dr.itemText,
                    isSelected && [dr.itemSelected, { color: accent }],
                    dist === 1 && dr.itemNear,
                    dist >= 2 && dr.itemFar,
                  ]}
                >
                  {format(v)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Fade overlays — AFTER ScrollView in JSX = higher z-index but pointerEvents none */}
        <View style={dr.fadeTop} pointerEvents="none" />
        <View style={dr.fadeBottom} pointerEvents="none" />
      </View>
    </View>
  );
}

// ─── TimeSelector ─────────────────────────────────────────────────────────────
function TimeSelector({
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
  accent,
}: {
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
  accent: string;
}) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINS = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <View style={ts.container}>
      <DrumRoller
        key={`h-${hour}`}
        values={HOURS}
        selected={hour}
        onChange={onChangeHour}
        label="HEURE"
        accent={accent}
      />
      <View style={ts.separator}>
        <Text style={ts.colon}>:</Text>
      </View>
      <DrumRoller
        key={`m-${minute}`}
        values={MINS}
        selected={minute}
        onChange={onChangeMinute}
        label="MIN"
        accent={accent}
      />
    </View>
  );
}

// ─── ScheduleModal ────────────────────────────────────────────────────────────
interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<ProfileSchedule, "id">, editingId: string | null) => void;
  editingSchedule?: ProfileSchedule | null;
}

export default function ScheduleModal({
  visible,
  onClose,
  onSave,
  editingSchedule,
}: ScheduleModalProps) {
  const insets = useSafeAreaInsets();

  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(8);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(18);
  const [endMinute, setEndMinute] = useState(0);
  const [action, setAction] = useState<"activate" | "deactivate">("activate");
  const [timeTab, setTimeTab] = useState<"start" | "end">("start");

  const slideAnim = useRef(new Animated.Value(800)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const editingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (visible) {
      editingIdRef.current = editingSchedule?.id ?? null;

      if (editingSchedule) {
        setLabel(editingSchedule.label ?? "");
        setDays([...editingSchedule.days]);
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
        setTimeTab("start");
      }

      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(800);
      overlayAnim.setValue(0);
    }
  }, [visible, editingSchedule]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 800,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(onClose);
  }, [onClose]);

  const toggleDay = useCallback((d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }, []);

  const handleSave = useCallback(() => {
    if (days.length === 0) return;
    onSave(
      {
        label:
          label.trim() ||
          `${fmtTime(startHour, startMinute)} – ${fmtTime(endHour, endMinute)}`,
        days: [...days].sort(),
        startHour,
        startMinute,
        endHour,
        endMinute,
        action,
        isActive: true,
      },
      editingIdRef.current,
    );
    close();
  }, [
    days,
    label,
    startHour,
    startMinute,
    endHour,
    endMinute,
    action,
    onSave,
    close,
  ]);

  const PRESETS = [
    { label: "Semaine", days: [1, 2, 3, 4, 5] },
    { label: "Week-end", days: [0, 6] },
    { label: "Tous", days: [0, 1, 2, 3, 4, 5, 6] },
    { label: "Aucun", days: [] as number[] },
  ];

  const isActivate = action === "activate";
  const accentColor = isActivate ? "#3DDB8A" : "#D04070";
  const currentHour = timeTab === "start" ? startHour : endHour;
  const currentMinute = timeTab === "start" ? startMinute : endMinute;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Animated.View style={[m.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={close}
        />

        <Animated.View
          style={[
            m.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle */}
          <View style={m.handle} />

          {/* Header */}
          <View style={m.header}>
            <View style={{ flex: 1 }}>
              <Text style={m.title}>
                {editingSchedule ? "Modifier la plage" : "Nouvelle plage"}
              </Text>
              <Text style={m.titleSub}>horaire automatique</Text>
            </View>
            <TouchableOpacity
              onPress={close}
              style={m.closeBtn}
              activeOpacity={0.7}
            >
              <Text style={m.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Action */}
            <Text style={m.sectionLabel}>ACTION</Text>
            <View style={m.actionRow}>
              {(["activate", "deactivate"] as const).map((a) => {
                const active = action === a;
                const color = a === "activate" ? "#3DDB8A" : "#D04070";
                const bg = a === "activate" ? "#0D221880" : "#1E0E1680";
                const bd = a === "activate" ? "#1E6A46" : "#4A1A2A";
                return (
                  <TouchableOpacity
                    key={a}
                    style={[
                      m.actionBtn,
                      active && { backgroundColor: bg, borderColor: bd },
                    ]}
                    onPress={() => setAction(a)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        m.actionDot,
                        { backgroundColor: active ? color : "#2A2A3A" },
                      ]}
                    />
                    <Text style={[m.actionBtnText, active && { color }]}>
                      {a === "activate" ? "▶  Activer" : "■  Désactiver"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Days */}
            <Text style={m.sectionLabel}>JOURS</Text>
            <View style={m.presetsRow}>
              {PRESETS.map((p) => {
                const match =
                  JSON.stringify([...days].sort()) ===
                  JSON.stringify([...p.days].sort());
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[m.preset, match && m.presetActive]}
                    onPress={() => setDays([...p.days])}
                    activeOpacity={0.75}
                  >
                    <Text style={[m.presetText, match && m.presetTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={m.daysRow}>
              {DAYS_SHORT.map((d, i) => {
                const active = days.includes(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      m.dayBtn,
                      active && {
                        backgroundColor: accentColor + "22",
                        borderColor: accentColor + "70",
                      },
                    ]}
                    onPress={() => toggleDay(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={m.dayBtnShort}>{d.charAt(0)}</Text>
                    <Text
                      style={[m.dayBtnFull, active && { color: accentColor }]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Time pickers */}
            <Text style={m.sectionLabel}>PLAGE HORAIRE</Text>

            {/* Start / End tab buttons */}
            <View style={m.timeTabs}>
              {(["start", "end"] as const).map((tab) => {
                const active = timeTab === tab;
                const h = tab === "start" ? startHour : endHour;
                const min = tab === "start" ? startMinute : endMinute;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      m.timeTab,
                      active && {
                        backgroundColor: "#7B6EF618",
                        borderColor: "#7B6EF650",
                      },
                    ]}
                    onPress={() => setTimeTab(tab)}
                    activeOpacity={0.75}
                  >
                    <Text style={m.timeTabLabel}>
                      {tab === "start" ? "DÉBUT" : "FIN"}
                    </Text>
                    <Text
                      style={[m.timeTabValue, active && { color: "#7B6EF6" }]}
                    >
                      {fmtTime(h, min)}
                    </Text>
                    {active && <View style={m.timeTabDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Drum roller — key forces remount on tab switch so scroll resets */}
            <View style={m.drumContainer}>
              <TimeSelector
                key={timeTab}
                hour={currentHour}
                minute={currentMinute}
                onChangeHour={timeTab === "start" ? setStartHour : setEndHour}
                onChangeMinute={
                  timeTab === "start" ? setStartMinute : setEndMinute
                }
                accent="#7B6EF6"
              />
            </View>

            {/* ── Label */}
            <Text style={m.sectionLabel}>NOM (optionnel)</Text>
            <TextInput
              style={m.input}
              placeholder="Ex : Matin, École, Travail…"
              placeholderTextColor="#252535"
              value={label}
              onChangeText={setLabel}
              returnKeyType="done"
            />

            {/* ── Summary */}
            <View style={[m.summary, { borderColor: accentColor + "35" }]}>
              <View style={[m.summaryBar, { backgroundColor: accentColor }]} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={m.summaryText}>
                  {"Profil "}
                  <Text style={{ color: accentColor, fontWeight: "800" }}>
                    {isActivate ? "activé" : "désactivé"}
                  </Text>
                  {"  "}
                  <Text style={{ color: "#F0F0FF", fontWeight: "700" }}>
                    {fmtTime(startHour, startMinute)}
                  </Text>
                  {"  →  "}
                  <Text style={{ color: "#F0F0FF", fontWeight: "700" }}>
                    {fmtTime(endHour, endMinute)}
                  </Text>
                </Text>
                {days.length > 0 ? (
                  <Text style={m.summaryDays}>
                    {[...days]
                      .sort()
                      .map((d) => DAYS_FULL[d])
                      .join("  ·  ")}
                  </Text>
                ) : (
                  <Text style={[m.summaryDays, { color: "#D04070" }]}>
                    ⚠ Aucun jour sélectionné
                  </Text>
                )}
              </View>
            </View>

            {/* ── Save */}
            <TouchableOpacity
              style={[m.saveBtn, days.length === 0 && m.saveBtnOff]}
              onPress={handleSave}
              disabled={days.length === 0}
              activeOpacity={0.85}
            >
              <Text style={m.saveBtnText}>
                {editingSchedule
                  ? "Enregistrer les modifications"
                  : "Ajouter la plage horaire"}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 12 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles : DrumRoller ──────────────────────────────────────────────────────
const dr = StyleSheet.create({
  col: { alignItems: "center", gap: 8 },
  colLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2E2E4A",
    letterSpacing: 2.5,
  },
  wrap: {
    width: 100,
    height: DRUM_H,
    overflow: "hidden",
    position: "relative",
  },
  selector: {
    position: "absolute",
    top: ITEM_H * 2, // center item (index 2 of 5)
    left: 4,
    right: 4,
    height: ITEM_H,
    borderRadius: 14,
    borderWidth: 1.5,
    zIndex: 1, // behind scroll content
  },
  scroll: {
    flex: 1,
    zIndex: 2, // above selector
  },
  scrollContent: {
    paddingTop: ITEM_H * 2, // padding so first item can center
    paddingBottom: ITEM_H * 2,
  },
  item: {
    height: ITEM_H,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E1E30",
    letterSpacing: -0.5,
  },
  itemNear: {
    fontSize: 24,
    fontWeight: "600",
    color: "#3A3A58",
  },
  itemFar: {
    fontSize: 20,
    fontWeight: "400",
    color: "#1C1C2C",
  },
  itemSelected: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  // Fades — AFTER ScrollView in JSX so they overlay it visually
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
    backgroundColor: "#0B0B14",
    opacity: 0.72,
    zIndex: 3,
    pointerEvents: "none" as any,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
    backgroundColor: "#0B0B14",
    opacity: 0.72,
    zIndex: 3,
    pointerEvents: "none" as any,
  },
});

// ─── Styles : TimeSelector ────────────────────────────────────────────────────
const ts = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  separator: {
    width: 32,
    alignItems: "center",
    marginTop: 20,
  },
  colon: {
    fontSize: 32,
    fontWeight: "800",
    color: "#3A3A58",
    letterSpacing: -1,
  },
});

// ─── Styles : ScheduleModal ───────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000B0",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0B0B14",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#18182A",
    maxHeight: "95%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#28283C",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  titleSub: {
    fontSize: 12,
    color: "#32324E",
    marginTop: 2,
    fontWeight: "500",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#18182A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  closeBtnText: { fontSize: 11, color: "#4A4A6A", fontWeight: "700" },

  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#28284A",
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 6,
  },

  // Action
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: "#12121E",
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  actionDot: { width: 8, height: 8, borderRadius: 4 },
  actionBtnText: { fontSize: 13, fontWeight: "700", color: "#32325A" },

  // Days
  presetsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  preset: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1E2E",
    backgroundColor: "#12121E",
  },
  presetActive: { backgroundColor: "#7B6EF618", borderColor: "#7B6EF650" },
  presetText: { fontSize: 11, color: "#32325A", fontWeight: "700" },
  presetTextActive: { color: "#7B6EF6" },

  daysRow: { flexDirection: "row", gap: 5, marginBottom: 22 },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1E2E",
    backgroundColor: "#12121E",
    gap: 3,
  },
  dayBtnShort: { fontSize: 13, fontWeight: "800", color: "#28284A" },
  dayBtnFull: {
    fontSize: 7,
    fontWeight: "600",
    color: "#28284A",
    letterSpacing: 0.3,
  },

  // Time tabs
  timeTabs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  timeTab: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#1C1C2C",
    backgroundColor: "#12121E",
    gap: 4,
  },
  timeTabLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#28284A",
    letterSpacing: 2,
  },
  timeTabValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#D0D0E8",
    fontFamily: "monospace",
    letterSpacing: -1.5,
  },
  timeTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#7B6EF6",
    marginTop: 2,
  },

  // Drum container
  drumContainer: {
    backgroundColor: "#0E0E1A",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#18182A",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 22,
    overflow: "hidden",
  },

  // Label input
  input: {
    backgroundColor: "#12121E",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F0F0FF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    marginBottom: 18,
  },

  // Summary
  summary: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    backgroundColor: "#12121E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
  },
  summaryBar: { width: 3, borderRadius: 2 },
  summaryText: { fontSize: 13, color: "#50507A", lineHeight: 21 },
  summaryDays: {
    fontSize: 11,
    color: "#32324E",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // Save button
  saveBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnOff: { backgroundColor: "#7B6EF620", shadowOpacity: 0, elevation: 0 },
  saveBtnText: {
    color: "#F0F0FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
