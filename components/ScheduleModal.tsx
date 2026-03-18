import { Colors, useTheme } from "@/theme";
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

const ITEM_H = 54;
const VISIBLE_ITEMS = 5;
const DRUM_H = ITEM_H * VISIBLE_ITEMS;

// ─── DrumRoller ───────────────────────────────────────────────────────────────
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
  const { t } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [localIdx, setLocalIdx] = useState(() =>
    Math.max(0, values.indexOf(selected)),
  );
  const momentumStarted = useRef(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const idx = values.indexOf(selected);
    if (idx < 0) return;
    setLocalIdx(idx);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    }, 120);
    return () => clearTimeout(timer);
  }, [selected]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const rawIdx = e.nativeEvent.contentOffset.y / ITEM_H;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(rawIdx)));
      setLocalIdx(idx);
    },
    [values.length],
  );

  const commit = useCallback(
    (offsetY: number) => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      const idx = Math.max(
        0,
        Math.min(values.length - 1, Math.round(offsetY / ITEM_H)),
      );
      setLocalIdx(idx);
      onChange(values[idx]);
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
      snapTimer.current = setTimeout(() => {
        if (!momentumStarted.current) commit(y);
      }, 80);
    },
    [commit],
  );

  const distFromCenter = (i: number) => Math.abs(i - localIdx);

  return (
    <View style={dr.col}>
      <Text style={[dr.colLabel, { color: t.text.muted }]}>{label}</Text>
      <View style={[dr.wrap, { backgroundColor: t.bg.cardAlt }]}>
        <View
          style={[
            dr.selector,
            { borderColor: accent + "50", backgroundColor: accent + "12" },
          ]}
          pointerEvents="none"
        />
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
                    { color: t.text.muted },
                    isSelected && [dr.itemSelected, { color: accent }],
                    dist === 1 && [dr.itemNear, { color: t.text.secondary }],
                    dist >= 2 && [dr.itemFar, { color: t.border.normal }],
                  ]}
                >
                  {format(v)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Fades adaptées au thème */}
        <View
          style={[dr.fadeTop, { backgroundColor: t.bg.cardAlt }]}
          pointerEvents="none"
        />
        <View
          style={[dr.fadeBottom, { backgroundColor: t.bg.cardAlt }]}
          pointerEvents="none"
        />
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
  const { t } = useTheme();
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
        <Text style={[ts.colon, { color: t.text.muted }]}>:</Text>
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
  const { t } = useTheme();

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
  const accentColor = isActivate ? t.allowed.accent : t.blocked.accent;
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
              backgroundColor: t.bg.card,
              borderColor: t.border.light,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle */}
          <View style={[m.handle, { backgroundColor: t.border.normal }]} />

          {/* Header */}
          <View style={m.header}>
            <View style={{ flex: 1 }}>
              <Text style={[m.title, { color: t.text.primary }]}>
                {editingSchedule ? "Modifier la plage" : "Nouvelle plage"}
              </Text>
              <Text style={[m.titleSub, { color: t.text.muted }]}>
                horaire automatique
              </Text>
            </View>
            <TouchableOpacity
              onPress={close}
              style={[
                m.closeBtn,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[m.closeBtnText, { color: t.text.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Action */}
            <Text style={[m.sectionLabel, { color: t.text.muted }]}>
              ACTION
            </Text>
            <View style={m.actionRow}>
              {(["activate", "deactivate"] as const).map((a) => {
                const active = action === a;
                const color =
                  a === "activate" ? t.allowed.accent : t.blocked.accent;
                const bg = a === "activate" ? t.allowed.bg : t.blocked.bg;
                const bd =
                  a === "activate" ? t.allowed.border : t.blocked.border;
                return (
                  <TouchableOpacity
                    key={a}
                    style={[
                      m.actionBtn,
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.light,
                      },
                      active && { backgroundColor: bg, borderColor: bd },
                    ]}
                    onPress={() => setAction(a)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        m.actionDot,
                        { backgroundColor: active ? color : t.border.normal },
                      ]}
                    />
                    <Text
                      style={[
                        m.actionBtnText,
                        { color: t.text.muted },
                        active && { color },
                      ]}
                    >
                      {a === "activate" ? "▶  Activer" : "■  Désactiver"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Days */}
            <Text style={[m.sectionLabel, { color: t.text.muted }]}>JOURS</Text>
            <View style={m.presetsRow}>
              {PRESETS.map((p) => {
                const match =
                  JSON.stringify([...days].sort()) ===
                  JSON.stringify([...p.days].sort());
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[
                      m.preset,
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.light,
                      },
                      match && {
                        backgroundColor: t.bg.accent,
                        borderColor: t.border.focus,
                      },
                    ]}
                    onPress={() => setDays([...p.days])}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        m.presetText,
                        { color: t.text.muted },
                        match && { color: t.text.link },
                      ]}
                    >
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
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.light,
                      },
                      active && {
                        backgroundColor: accentColor + "22",
                        borderColor: accentColor + "70",
                      },
                    ]}
                    onPress={() => toggleDay(i)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        m.dayBtnShort,
                        { color: active ? accentColor : t.border.strong },
                      ]}
                    >
                      {d.charAt(0)}
                    </Text>
                    <Text
                      style={[
                        m.dayBtnFull,
                        { color: active ? accentColor : t.text.muted },
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Time pickers */}
            <Text style={[m.sectionLabel, { color: t.text.muted }]}>
              PLAGE HORAIRE
            </Text>
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
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.light,
                      },
                      active && {
                        backgroundColor: t.bg.accent,
                        borderColor: t.border.focus,
                      },
                    ]}
                    onPress={() => setTimeTab(tab)}
                    activeOpacity={0.75}
                  >
                    <Text style={[m.timeTabLabel, { color: t.text.muted }]}>
                      {tab === "start" ? "DÉBUT" : "FIN"}
                    </Text>
                    <Text
                      style={[
                        m.timeTabValue,
                        { color: active ? t.text.link : t.text.primary },
                      ]}
                    >
                      {fmtTime(h, min)}
                    </Text>
                    {active && (
                      <View
                        style={[
                          m.timeTabDot,
                          { backgroundColor: t.border.focus },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                m.drumContainer,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <TimeSelector
                key={timeTab}
                hour={currentHour}
                minute={currentMinute}
                onChangeHour={timeTab === "start" ? setStartHour : setEndHour}
                onChangeMinute={
                  timeTab === "start" ? setStartMinute : setEndMinute
                }
                accent={Colors.purple[400]}
              />
            </View>

            {/* ── Label */}
            <Text style={[m.sectionLabel, { color: t.text.muted }]}>
              NOM (optionnel)
            </Text>
            <TextInput
              style={[
                m.input,
                {
                  backgroundColor: t.bg.cardAlt,
                  borderColor: t.border.light,
                  color: t.text.primary,
                },
              ]}
              placeholder="Ex : Matin, École, Travail…"
              placeholderTextColor={t.text.muted}
              value={label}
              onChangeText={setLabel}
              returnKeyType="done"
            />

            {/* ── Summary */}
            <View
              style={[
                m.summary,
                {
                  backgroundColor: t.bg.cardAlt,
                  borderColor: accentColor + "35",
                },
              ]}
            >
              <View style={[m.summaryBar, { backgroundColor: accentColor }]} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[m.summaryText, { color: t.text.secondary }]}>
                  {"Profil "}
                  <Text style={{ color: accentColor, fontWeight: "800" }}>
                    {isActivate ? "activé" : "désactivé"}
                  </Text>
                  {"  "}
                  <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                    {fmtTime(startHour, startMinute)}
                  </Text>
                  {"  →  "}
                  <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                    {fmtTime(endHour, endMinute)}
                  </Text>
                </Text>
                {days.length > 0 ? (
                  <Text style={[m.summaryDays, { color: t.text.muted }]}>
                    {[...days]
                      .sort()
                      .map((d) => DAYS_FULL[d])
                      .join("  ·  ")}
                  </Text>
                ) : (
                  <Text style={[m.summaryDays, { color: t.blocked.accent }]}>
                    ⚠ Aucun jour sélectionné
                  </Text>
                )}
              </View>
            </View>

            {/* ── Save */}
            <TouchableOpacity
              style={[
                m.saveBtn,
                { backgroundColor: Colors.purple[400] },
                days.length === 0 && {
                  backgroundColor: Colors.purple[400] + "20",
                  shadowOpacity: 0,
                  elevation: 0,
                },
              ]}
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

// ─── Styles statiques (valeurs fixes, couleurs injectées inline) ──────────────
const dr = StyleSheet.create({
  col: { alignItems: "center", gap: 8 },
  colLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2.5 },
  wrap: {
    width: 100,
    height: DRUM_H,
    overflow: "hidden",
    position: "relative",
    borderRadius: 14,
  },
  selector: {
    position: "absolute",
    top: ITEM_H * 2,
    left: 4,
    right: 4,
    height: ITEM_H,
    borderRadius: 14,
    borderWidth: 1.5,
    zIndex: 1,
  },
  scroll: { flex: 1, zIndex: 2 },
  scrollContent: { paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 },
  item: { height: ITEM_H, justifyContent: "center", alignItems: "center" },
  itemText: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  itemNear: { fontSize: 24, fontWeight: "600" },
  itemFar: { fontSize: 20, fontWeight: "400" },
  itemSelected: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
    opacity: 0.85,
    zIndex: 3,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
    opacity: 0.85,
    zIndex: 3,
  },
});

const ts = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  separator: { width: 32, alignItems: "center", marginTop: 20 },
  colon: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000B0",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "95%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
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
  title: { fontSize: 21, fontWeight: "800", letterSpacing: -0.5 },
  titleSub: { fontSize: 12, marginTop: 2, fontWeight: "500" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  closeBtnText: { fontSize: 11, fontWeight: "700" },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 6,
  },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
  },
  actionDot: { width: 8, height: 8, borderRadius: 4 },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  presetsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  preset: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  presetText: { fontSize: 11, fontWeight: "700" },
  daysRow: { flexDirection: "row", gap: 5, marginBottom: 22 },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    gap: 3,
  },
  dayBtnShort: { fontSize: 13, fontWeight: "800" },
  dayBtnFull: { fontSize: 7, fontWeight: "600", letterSpacing: 0.3 },
  timeTabs: { flexDirection: "row", gap: 10, marginBottom: 14 },
  timeTab: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1.5,
    gap: 4,
  },
  timeTabLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  timeTabValue: {
    fontSize: 26,
    fontWeight: "800",
    fontFamily: "monospace",
    letterSpacing: -1.5,
  },
  timeTabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  drumContainer: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 22,
    overflow: "hidden",
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  summary: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
  },
  summaryBar: { width: 3, borderRadius: 2 },
  summaryText: { fontSize: 13, lineHeight: 21 },
  summaryDays: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  saveBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: Colors.purple[400],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnText: {
    color: Colors.gray[0],
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
