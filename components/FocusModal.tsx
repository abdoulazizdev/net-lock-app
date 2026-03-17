import PaywallModal from "@/components/PaywallModal";
import { usePremium } from "@/hooks/usePremium";
import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import { Profile } from "@/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IdleStep = "idle" | "error";
type LoadingStep = "checking" | "starting_vpn" | "starting_focus";
type StartStep = IdleStep | LoadingStep;
function isLoadingStep(s: StartStep): s is LoadingStep {
  return s === "checking" || s === "starting_vpn" || s === "starting_focus";
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onStarted: () => void;
}

// ─── Picker Android dans un modal dédié ──────────────────────────────────────
function AndroidTimePicker({
  visible,
  value,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  value: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={atp.overlay}>
        <View style={atp.sheet}>
          <Text style={atp.title}>Durée personnalisée</Text>
          <DateTimePicker
            value={draft}
            mode="time"
            is24Hour
            display="spinner"
            onChange={(_, date) => {
              if (date) setDraft(date);
            }}
            style={atp.picker}
            textColor="#F0F0FF"
            themeVariant="dark"
          />
          <View style={atp.row}>
            <TouchableOpacity
              style={atp.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={atp.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={atp.confirmBtn}
              onPress={() => onConfirm(draft)}
              activeOpacity={0.8}
            >
              <Text style={atp.confirmText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FocusModal({ visible, onClose, onStarted }: Props) {
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremium();

  const [selectedDuration, setSelectedDuration] = useState<number | "custom">(
    25,
  );
  const [customTime, setCustomTime] = useState(new Date(0, 0, 0, 0, 30));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vpnWasActive, setVpnWasActive] = useState(false);
  const [step, setStep] = useState<StartStep>("idle");
  const [stepMsg, setStepMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [paywallVisible, setPaywallVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadState();
      setStep("idle");
      setErrorMsg("");
      setShowTimePicker(false);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadState = async () => {
    const [p, isVpn] = await Promise.all([
      StorageService.getProfiles(),
      VpnService.isVpnActive(),
    ]);
    setProfiles(p);
    setVpnWasActive(isVpn);
  };

  const getDurationMinutes = (): number => {
    if (selectedDuration === "custom")
      return customTime.getHours() * 60 + customTime.getMinutes();
    return selectedDuration as number;
  };

  const formatDuration = (min: number): string => {
    if (min <= 0) return "—";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60),
      m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleStart = async () => {
    const minutes = getDurationMinutes();
    if (minutes < 1) return;
    setStep("checking");
    setErrorMsg("");
    try {
      const isVpnOn = await VpnService.isVpnActive();
      if (!isVpnOn) {
        setStep("starting_vpn");
        setStepMsg("Démarrage du VPN…");
        const started = await VpnService.startVpn();
        if (!started) {
          setStep("error");
          setErrorMsg("Impossible de démarrer le VPN.");
          return;
        }
        let ready = false;
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 500));
          ready = await VpnService.isVpnActive();
          if (ready) break;
        }
        if (!ready) {
          setStep("error");
          setErrorMsg("Le VPN n'a pas démarré.");
          return;
        }
      }
      setStep("starting_focus");
      setStepMsg("Activation du Focus…");
      await FocusService.startFocus(minutes, selectedProfileId ?? undefined);
      onStarted();
      onClose();
    } catch (e: any) {
      setStep("error");
      setErrorMsg(
        e?.code === "PERMISSION_DENIED"
          ? "Permission VPN refusée."
          : e?.message || "Erreur.",
      );
    }
  };

  const loading = isLoadingStep(step);
  const durationMin = getDurationMinutes();
  const allPresets = FocusService.presets;
  const isPresetLocked = (value: number) =>
    !isPremium && !FREE_LIMITS.FOCUS_PRESETS_FREE.includes(value);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={loading ? undefined : onClose}
      >
        <Animated.View style={[fm.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={loading ? undefined : onClose}
          />

          <Animated.View
            style={[
              fm.sheet,
              {
                transform: [{ translateY: slideAnim }],
                paddingBottom: insets.bottom + 24,
              },
            ]}
          >
            {/* Handle */}
            <View style={fm.handle} />

            {/* Header */}
            <View style={fm.header}>
              <View style={fm.headerLeft}>
                <View style={fm.headerIconWrap}>
                  <Text style={fm.headerIcon}>◎</Text>
                </View>
                <View>
                  <Text style={fm.title}>Mode Focus</Text>
                  <Text style={fm.subtitle}>Session verrouillée</Text>
                </View>
              </View>
              {!loading && (
                <TouchableOpacity onPress={onClose} style={fm.closeBtn}>
                  <Text style={fm.closeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEnabled={!loading}
              keyboardShouldPersistTaps="handled"
            >
              {/* Bannière VPN inactif */}
              {!vpnWasActive && step === "idle" && (
                <View style={fm.vpnBanner}>
                  <Text style={fm.vpnBannerIcon}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={fm.vpnBannerTitle}>
                      VPN inactif — démarrage auto
                    </Text>
                    <Text style={fm.vpnBannerText}>
                      Le VPN sera activé automatiquement.
                    </Text>
                  </View>
                </View>
              )}

              {/* Chargement */}
              {loading && (
                <View style={fm.loadingBox}>
                  <View style={fm.loadingIconWrap}>
                    <Text style={fm.loadingIcon}>
                      {step === "starting_vpn"
                        ? "◈"
                        : step === "starting_focus"
                          ? "◎"
                          : "◷"}
                    </Text>
                  </View>
                  <Text style={fm.loadingText}>
                    {stepMsg || "Vérification…"}
                  </Text>
                  <View style={fm.loadingSteps}>
                    {(
                      [
                        {
                          key: "vpn",
                          label: "VPN démarré",
                          active: step === "starting_vpn",
                          done: step === "starting_focus",
                        },
                        {
                          key: "focus",
                          label: "Focus activé",
                          active: step === "starting_focus",
                          done: false,
                        },
                      ] as const
                    ).map((s) => (
                      <View key={s.key} style={fm.loadingStep}>
                        <View
                          style={[
                            fm.loadingDotWrap,
                            s.done && fm.loadingDotWrapDone,
                            s.active && fm.loadingDotWrapActive,
                          ]}
                        >
                          <Text
                            style={[
                              fm.loadingDot,
                              s.done && fm.loadingDotDone,
                              s.active && fm.loadingDotActive,
                            ]}
                          >
                            {s.done ? "✓" : s.active ? "▶" : "○"}
                          </Text>
                        </View>
                        <Text
                          style={[
                            fm.loadingStepTxt,
                            s.done && fm.loadingStepTxtDone,
                            s.active && fm.loadingStepTxtActive,
                          ]}
                        >
                          {s.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Erreur */}
              {step === "error" && (
                <View style={fm.errorBox}>
                  <Text style={fm.errorIcon}>⚠</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={fm.errorTitle}>Échec du démarrage</Text>
                    <Text style={fm.errorText}>{errorMsg}</Text>
                  </View>
                </View>
              )}

              {!loading && (
                <>
                  {/* ── Durée ── */}
                  <Text style={fm.sectionLabel}>DURÉE</Text>
                  <View style={fm.presetsGrid}>
                    {allPresets.map((p) => {
                      const locked = isPresetLocked(p.value);
                      const selected = selectedDuration === p.value;
                      return (
                        <TouchableOpacity
                          key={p.value}
                          style={[
                            fm.presetCard,
                            selected && fm.presetCardSel,
                            locked && fm.presetCardLocked,
                          ]}
                          onPress={() => {
                            if (locked) {
                              setPaywallVisible(true);
                              return;
                            }
                            setSelectedDuration(p.value);
                            setShowTimePicker(false);
                          }}
                          activeOpacity={0.75}
                        >
                          {locked && (
                            <View style={fm.lockBadge}>
                              <Text style={fm.lockBadgeText}>PRO</Text>
                            </View>
                          )}
                          <Text style={fm.presetIcon}>{p.icon}</Text>
                          <Text
                            style={[
                              fm.presetLabel,
                              selected && fm.presetLabelSel,
                              locked && fm.presetLabelLocked,
                            ]}
                          >
                            {p.label}
                          </Text>
                          <Text
                            style={[
                              fm.presetDesc,
                              selected && fm.presetDescSel,
                            ]}
                          >
                            {locked ? "Premium" : p.desc}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Custom — premium only */}
                    <TouchableOpacity
                      style={[
                        fm.presetCard,
                        fm.presetCustom,
                        selectedDuration === "custom" && fm.presetCardSel,
                        !isPremium && fm.presetCardLocked,
                      ]}
                      onPress={() => {
                        if (!isPremium) {
                          setPaywallVisible(true);
                          return;
                        }
                        setSelectedDuration("custom");
                        setShowTimePicker(true);
                      }}
                      activeOpacity={0.75}
                    >
                      {!isPremium && (
                        <View style={fm.lockBadge}>
                          <Text style={fm.lockBadgeText}>PRO</Text>
                        </View>
                      )}
                      <Text style={fm.presetIcon}>⏱</Text>
                      <Text
                        style={[
                          fm.presetLabel,
                          selectedDuration === "custom" && fm.presetLabelSel,
                          !isPremium && fm.presetLabelLocked,
                        ]}
                      >
                        {selectedDuration === "custom"
                          ? formatDuration(durationMin)
                          : "Perso"}
                      </Text>
                      <Text
                        style={[
                          fm.presetDesc,
                          selectedDuration === "custom" && fm.presetDescSel,
                        ]}
                      >
                        {isPremium ? "Libre" : "Premium"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* ── Time picker iOS inline ── */}
                  {selectedDuration === "custom" &&
                    isPremium &&
                    Platform.OS === "ios" && (
                      <View style={fm.pickerWrap}>
                        <Text style={fm.pickerLabel}>DURÉE PERSONNALISÉE</Text>
                        <DateTimePicker
                          value={customTime}
                          mode="time"
                          is24Hour
                          display="spinner"
                          onChange={(_, date) => {
                            if (date) setCustomTime(date);
                          }}
                          style={fm.picker}
                          textColor="#F0F0FF"
                          themeVariant="dark"
                        />
                        <View style={fm.pickerSummary}>
                          <Text style={fm.pickerSummaryText}>
                            {formatDuration(durationMin)} de focus
                          </Text>
                        </View>
                      </View>
                    )}

                  {/* ── Time picker Android — bouton qui ouvre le modal ── */}
                  {selectedDuration === "custom" &&
                    isPremium &&
                    Platform.OS === "android" && (
                      <TouchableOpacity
                        style={fm.androidPickerBtn}
                        onPress={() => setShowTimePicker(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={fm.androidPickerIcon}>⏱</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={fm.androidPickerLabel}>
                            Durée personnalisée
                          </Text>
                          <Text style={fm.androidPickerValue}>
                            {formatDuration(durationMin)}
                          </Text>
                        </View>
                        <Text style={fm.androidPickerArrow}>›</Text>
                      </TouchableOpacity>
                    )}

                  {/* ── Profil ── */}
                  <Text style={[fm.sectionLabel, { marginTop: 24 }]}>
                    APPS À BLOQUER
                  </Text>
                  <TouchableOpacity
                    style={[
                      fm.profileOption,
                      selectedProfileId === null && fm.profileOptionSel,
                    ]}
                    onPress={() => setSelectedProfileId(null)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        fm.profileIconWrap,
                        selectedProfileId === null && fm.profileIconWrapSel,
                      ]}
                    >
                      <Text style={fm.profileIcon}>⚙</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          fm.profileName,
                          selectedProfileId === null && fm.profileNameSel,
                        ]}
                      >
                        Règles globales
                      </Text>
                      <Text style={fm.profileDesc}>
                        Toutes les apps actuellement bloquées
                      </Text>
                    </View>
                    {selectedProfileId === null && (
                      <View style={fm.checkWrap}>
                        <Text style={fm.check}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {profiles.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        fm.profileOption,
                        selectedProfileId === p.id && fm.profileOptionSel,
                      ]}
                      onPress={() => setSelectedProfileId(p.id)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          fm.profileIconWrap,
                          selectedProfileId === p.id && fm.profileIconWrapSel,
                        ]}
                      >
                        <Text style={fm.profileIcon}>◉</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            fm.profileName,
                            selectedProfileId === p.id && fm.profileNameSel,
                          ]}
                        >
                          {p.name}
                        </Text>
                        <Text style={fm.profileDesc}>
                          {p.rules.filter((r) => r.isBlocked).length} apps
                          bloquées
                        </Text>
                      </View>
                      {selectedProfileId === p.id && (
                        <View style={fm.checkWrap}>
                          <Text style={fm.check}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* Avertissement */}
                  <View style={fm.warnBox}>
                    <View style={fm.warnIconWrap}>
                      <Text style={fm.warnIcon}>◈</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={fm.warnTitle}>Session verrouillée</Text>
                      <Text style={fm.warnText}>
                        Le VPN ne peut pas être désactivé pendant la session.
                        Maintenez Stop 5s pour annuler.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Bouton start */}
            {!loading && (
              <TouchableOpacity
                style={[fm.startBtn, durationMin < 1 && fm.startBtnOff]}
                onPress={handleStart}
                disabled={durationMin < 1}
                activeOpacity={0.85}
              >
                <Text style={fm.startBtnIcon}>◎</Text>
                <Text style={fm.startBtnText}>
                  {durationMin < 1
                    ? "Choisissez une durée"
                    : `Démarrer — ${formatDuration(durationMin)}`}
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Modal picker Android ── */}
      <AndroidTimePicker
        visible={showTimePicker && Platform.OS === "android"}
        value={customTime}
        onConfirm={(d) => {
          setCustomTime(d);
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        reason="focus"
        onUpgraded={() => setPaywallVisible(false)}
      />
    </>
  );
}

// ─── Styles AndroidTimePicker ─────────────────────────────────────────────────
const atp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000CC",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    backgroundColor: "#0E0E18",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2A2A3C",
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  picker: { width: "100%", height: 160 },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#14141E",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A3C",
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: "#5A5A80" },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmText: { fontSize: 14, fontWeight: "800", color: "#F0F0FF" },
});

// ─── Styles FocusModal ────────────────────────────────────────────────────────
const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0A0A12",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#1C1C2C",
    maxHeight: "92%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A3C",
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: { fontSize: 20, color: "#7B6EF6" },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 11, color: "#3A3A58", marginTop: 2, fontWeight: "500" },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 12, color: "#5A5A80", fontWeight: "700" },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 12,
  },

  // Bannière VPN
  vpnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#120E04",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A2A0A",
    padding: 14,
    marginBottom: 22,
  },
  vpnBannerIcon: { fontSize: 15, marginTop: 1 },
  vpnBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D4901A",
    marginBottom: 3,
  },
  vpnBannerText: { fontSize: 11, color: "#6A4A10", lineHeight: 17 },

  // Loading
  loadingBox: { alignItems: "center", paddingVertical: 36 },
  loadingIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingIcon: { fontSize: 30, color: "#7B6EF6" },
  loadingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 24,
  },
  loadingSteps: { gap: 12, alignItems: "flex-start" },
  loadingStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  loadingDotWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingDotWrapDone: { backgroundColor: "#0D2218", borderColor: "#3DDB8A40" },
  loadingDotWrapActive: {
    backgroundColor: "#16103A",
    borderColor: "#7B6EF640",
  },
  loadingDot: { fontSize: 11, color: "#2E2E48", fontWeight: "700" },
  loadingDotDone: { color: "#3DDB8A" },
  loadingDotActive: { color: "#7B6EF6" },
  loadingStepTxt: { fontSize: 13, color: "#3A3A58", fontWeight: "500" },
  loadingStepTxtDone: { color: "#3DDB8A", fontWeight: "600" },
  loadingStepTxtActive: { color: "#9B8FFF", fontWeight: "600" },

  // Erreur
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#120608",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#4A1020",
    padding: 14,
    marginBottom: 20,
  },
  errorIcon: { fontSize: 16, color: "#D04070", marginTop: 1 },
  errorTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#D04070",
    marginBottom: 4,
  },
  errorText: { fontSize: 12, color: "#8A3050", lineHeight: 18 },

  // Presets
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  presetCard: {
    width: "30%",
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 14,
    alignItems: "center",
    position: "relative",
  },
  presetCardSel: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  presetCardLocked: {
    backgroundColor: "#0A0A0E",
    borderColor: "#161618",
    opacity: 0.55,
  },
  presetCustom: { borderStyle: "dashed", borderColor: "#2A2A3C" },
  lockBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#7B6EF625",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#7B6EF640",
  },
  lockBadgeText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#7B6EF6",
    letterSpacing: 0.5,
  },
  presetIcon: { fontSize: 22, marginBottom: 6 },
  presetLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4A4A68",
    marginBottom: 3,
  },
  presetLabelSel: { color: "#9B8FFF" },
  presetLabelLocked: { color: "#1E1E28" },
  presetDesc: {
    fontSize: 9,
    color: "#2A2A40",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  presetDescSel: { color: "#5A4E9A" },

  // Picker iOS
  pickerWrap: {
    backgroundColor: "#0A0A14",
    borderRadius: 18,
    padding: 18,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "#2A2450",
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },
  picker: { width: "100%", height: 150 },
  pickerSummary: {
    marginTop: 12,
    backgroundColor: "#16103A",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  pickerSummaryText: { fontSize: 16, fontWeight: "800", color: "#9B8FFF" },

  // Picker Android bouton
  androidPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2450",
    padding: 16,
    marginVertical: 12,
  },
  androidPickerIcon: { fontSize: 20, color: "#7B6EF6" },
  androidPickerLabel: {
    fontSize: 11,
    color: "#5A5A80",
    fontWeight: "600",
    marginBottom: 3,
  },
  androidPickerValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9B8FFF",
    letterSpacing: -0.5,
  },
  androidPickerArrow: { fontSize: 22, color: "#3A3A58" },

  // Profils
  profileOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 14,
    marginBottom: 8,
  },
  profileOptionSel: { backgroundColor: "#0D1520", borderColor: "#3DDB8A40" },
  profileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconWrapSel: { backgroundColor: "#0D2218", borderColor: "#3DDB8A40" },
  profileIcon: { fontSize: 16, color: "#5A5A80" },
  profileName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5A5A80",
    marginBottom: 2,
  },
  profileNameSel: { color: "#E8E8F8" },
  profileDesc: { fontSize: 11, color: "#2E2E48" },
  checkWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#0D2218",
    borderWidth: 1,
    borderColor: "#3DDB8A40",
    justifyContent: "center",
    alignItems: "center",
  },
  check: { fontSize: 13, color: "#3DDB8A", fontWeight: "800" },

  // Warn
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#0C0A16",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A2A5A",
    padding: 14,
    marginTop: 8,
    marginBottom: 22,
  },
  warnIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  warnIcon: { fontSize: 15, color: "#7B6EF6" },
  warnTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9B6EF6",
    marginBottom: 4,
  },
  warnText: { fontSize: 12, color: "#5A3A78", lineHeight: 18 },

  // Start button
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#7B6EF6",
    borderRadius: 18,
    paddingVertical: 17,
    marginTop: 8,
  },
  startBtnOff: { backgroundColor: "#7B6EF625" },
  startBtnIcon: { fontSize: 16, color: "#F0F0FF" },
  startBtnText: {
    color: "#F0F0FF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
