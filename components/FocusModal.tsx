import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import { Profile } from "@/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────
type IdleStep = "idle" | "error";
type LoadingStep = "checking" | "starting_vpn" | "starting_focus";
type StartStep = IdleStep | LoadingStep;

function isLoadingStep(s: StartStep): s is LoadingStep {
  return s === "checking" || s === "starting_vpn" || s === "starting_focus";
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  onStarted: () => void;
}

// ─── Profile option ───────────────────────────────────────────────────────────
function ProfileOption({
  icon,
  name,
  desc,
  selected,
  onPress,
}: {
  icon: string;
  name: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[fm.profileOption, selected && fm.profileOptionSel]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[fm.profileIconWrap, selected && fm.profileIconWrapSel]}>
        <Text style={[fm.profileIcon, selected && fm.profileIconSel]}>
          {icon}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[fm.profileName, selected && fm.profileNameSel]}>
          {name}
        </Text>
        <Text style={fm.profileDesc}>{desc}</Text>
      </View>
      <View style={[fm.checkCircle, selected && fm.checkCircleSel]}>
        {selected && <Text style={fm.checkMark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Loading steps indicator ──────────────────────────────────────────────────
function LoadingSteps({ step }: { step: LoadingStep }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    return () => spinAnim.stopAnimation();
  }, []);
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const steps = [
    {
      key: "vpn",
      label: "VPN démarré",
      done: step === "starting_focus",
      active: step === "starting_vpn",
    },
    {
      key: "focus",
      label: "Focus activé",
      done: false,
      active: step === "starting_focus",
    },
  ] as const;

  return (
    <View style={fm.loadingBox}>
      <Animated.Text
        style={[fm.loadingSpinner, { transform: [{ rotate: spin }] }]}
      >
        ◌
      </Animated.Text>
      <Text style={fm.loadingTitle}>
        {step === "starting_vpn"
          ? "Démarrage du VPN…"
          : step === "starting_focus"
            ? "Activation du Focus…"
            : "Vérification…"}
      </Text>
      <View style={fm.loadingSteps}>
        {steps.map((s) => (
          <View key={s.key} style={fm.loadingStep}>
            <Text
              style={[
                fm.loadingDot,
                s.done && fm.loadingDotDone,
                s.active && fm.loadingDotActive,
              ]}
            >
              {s.done ? "◉" : s.active ? "◎" : "◌"}
            </Text>
            <Text
              style={[
                fm.loadingStepTxt,
                s.done && fm.loadingStepDone,
                s.active && fm.loadingStepActive,
              ]}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FocusModal({ visible, onClose, onStarted }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedDuration, setSelectedDuration] = useState<number | "custom">(
    25,
  );
  const [customTime, setCustomTime] = useState(new Date(0, 0, 0, 0, 30));
  const [showPicker, setShowPicker] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vpnWasActive, setVpnWasActive] = useState(false);
  const [step, setStep] = useState<StartStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const slideAnim = useRef(new Animated.Value(500)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadState();
      setStep("idle");
      setErrorMsg("");
      setShowPicker(false);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 240,
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
          toValue: 500,
          duration: 220,
          easing: Easing.in(Easing.quad),
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
    if (selectedDuration === "custom") {
      return customTime.getHours() * 60 + customTime.getMinutes();
    }
    return selectedDuration as number;
  };

  const formatDuration = (min: number): string => {
    if (min <= 0) return "Choisissez une durée";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60),
      m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const formatCustomTime = (): string => {
    const h = customTime.getHours(),
      m = customTime.getMinutes();
    if (h === 0 && m === 0) return "0 min";
    return formatDuration(h * 60 + m);
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
        const started = await VpnService.startVpn();
        if (!started) {
          setStep("error");
          setErrorMsg(
            "Impossible de démarrer le VPN. Veuillez accepter la permission VPN.",
          );
          return;
        }
        let vpnReady = false;
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 500));
          vpnReady = await VpnService.isVpnActive();
          if (vpnReady) break;
        }
        if (!vpnReady) {
          setStep("error");
          setErrorMsg(
            "Le VPN n'a pas pu démarrer. Vérifiez qu'aucune autre app VPN n'est active.",
          );
          return;
        }
      }
      setStep("starting_focus");
      await FocusService.startFocus(minutes, selectedProfileId ?? undefined);
      onStarted();
      onClose();
    } catch (e: any) {
      setStep("error");
      if (e?.code === "PERMISSION_DENIED") {
        setErrorMsg(
          "Permission VPN refusée. Le Focus nécessite le VPN pour bloquer les apps.",
        );
      } else {
        setErrorMsg(e?.message || "Une erreur est survenue.");
      }
    }
  };

  const loading = isLoadingStep(step);
  const durationMin = getDurationMinutes();
  const presets = FocusService.presets;
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const blockedCount = selectedProfile
    ? selectedProfile.rules.filter((r) => r.isBlocked).length
    : null;

  return (
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
          <View style={fm.handle} />

          {/* ── Header */}
          <View style={fm.header}>
            <View style={fm.headerIconWrap}>
              <Text style={fm.headerIcon}>◎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fm.title}>Mode Focus</Text>
              <Text style={fm.subtitle}>
                Session verrouillée — difficile à annuler
              </Text>
            </View>
            {!loading && (
              <TouchableOpacity
                onPress={onClose}
                style={fm.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={fm.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEnabled={!loading}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── VPN banner */}
            {!vpnWasActive && step === "idle" && (
              <View style={fm.vpnBanner}>
                <View style={fm.vpnBannerIconWrap}>
                  <Text style={fm.vpnBannerIcon}>◉</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fm.vpnBannerTitle}>
                    VPN inactif — démarrage automatique
                  </Text>
                  <Text style={fm.vpnBannerText}>
                    Le VPN sera démarré automatiquement. Une permission Android
                    sera demandée si c'est la première fois.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Loading */}
            {loading && <LoadingSteps step={step as LoadingStep} />}

            {/* ── Error */}
            {step === "error" && (
              <View style={fm.errorBox}>
                <View style={fm.errorIconWrap}>
                  <Text style={fm.errorIcon}>◌</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fm.errorTitle}>Échec du démarrage</Text>
                  <Text style={fm.errorText}>{errorMsg}</Text>
                </View>
              </View>
            )}

            {/* ── Main content */}
            {!loading && (
              <>
                {/* Durée */}
                <Text style={fm.sectionLabel}>DURÉE</Text>
                <View style={fm.presetsGrid}>
                  {presets.map((p) => {
                    const active = selectedDuration === p.value;
                    return (
                      <TouchableOpacity
                        key={p.value}
                        style={[fm.presetCard, active && fm.presetCardSel]}
                        onPress={() => setSelectedDuration(p.value)}
                        activeOpacity={0.75}
                      >
                        {active && <View style={fm.presetTopBar} />}
                        <Text style={fm.presetIcon}>{p.icon}</Text>
                        <Text
                          style={[fm.presetLabel, active && fm.presetLabelSel]}
                        >
                          {p.label}
                        </Text>
                        <Text style={fm.presetDesc}>{p.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* Custom */}
                  <TouchableOpacity
                    style={[
                      fm.presetCard,
                      fm.presetCustom,
                      selectedDuration === "custom" && fm.presetCardSel,
                    ]}
                    onPress={() => setSelectedDuration("custom")}
                    activeOpacity={0.75}
                  >
                    {selectedDuration === "custom" && (
                      <View style={fm.presetTopBar} />
                    )}
                    <Text style={fm.presetIcon}>◷</Text>
                    <Text
                      style={[
                        fm.presetLabel,
                        selectedDuration === "custom" && fm.presetLabelSel,
                      ]}
                    >
                      {selectedDuration === "custom"
                        ? formatCustomTime()
                        : "Perso"}
                    </Text>
                    <Text style={fm.presetDesc}>Libre</Text>
                  </TouchableOpacity>
                </View>

                {/* DateTimePicker custom */}
                {selectedDuration === "custom" && (
                  <View style={fm.pickerWrap}>
                    <Text style={fm.pickerLabel}>DURÉE PERSONNALISÉE</Text>

                    {/* Résumé + bouton pour ouvrir le picker */}
                    <TouchableOpacity
                      style={fm.pickerTrigger}
                      onPress={() => setShowPicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={fm.pickerTriggerIcon}>◷</Text>
                      <Text style={fm.pickerTriggerValue}>
                        {formatCustomTime()}
                      </Text>
                      <Text style={fm.pickerTriggerEdit}>Modifier</Text>
                    </TouchableOpacity>

                    {/* Sur iOS : spinner inline. Sur Android : Dialog natif (display="default") */}
                    {showPicker && (
                      <DateTimePicker
                        value={customTime}
                        mode="time"
                        is24Hour={true}
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={(event, date) => {
                          // Android : le dialog se ferme tout seul (type "set" ou "dismissed")
                          if (Platform.OS === "android") setShowPicker(false);
                          if (event.type !== "dismissed" && date)
                            setCustomTime(date);
                        }}
                        style={Platform.OS === "ios" ? fm.picker : undefined}
                        textColor="#F0F0FF"
                        themeVariant="dark"
                      />
                    )}

                    {/* iOS uniquement : bouton "Valider" pour fermer le spinner inline */}
                    {showPicker && Platform.OS === "ios" && (
                      <TouchableOpacity
                        style={fm.pickerDoneBtn}
                        onPress={() => setShowPicker(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={fm.pickerDoneBtnText}>Valider</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Apps à bloquer */}
                <Text style={[fm.sectionLabel, { marginTop: 22 }]}>
                  APPS À BLOQUER
                </Text>
                <ProfileOption
                  icon="◈"
                  name="Règles globales"
                  desc="Toutes les apps actuellement bloquées"
                  selected={selectedProfileId === null}
                  onPress={() => setSelectedProfileId(null)}
                />
                {profiles.map((p) => (
                  <ProfileOption
                    key={p.id}
                    icon="◉"
                    name={p.name}
                    desc={`${p.rules.filter((r) => r.isBlocked).length} apps bloquées`}
                    selected={selectedProfileId === p.id}
                    onPress={() => setSelectedProfileId(p.id)}
                  />
                ))}

                {/* Résumé */}
                {selectedProfileId !== null && blockedCount !== null && (
                  <View style={fm.summaryRow}>
                    <Text style={fm.summaryText}>
                      {blockedCount} app{blockedCount > 1 ? "s" : ""} sera
                      {blockedCount > 1 ? "ont" : ""} bloquée
                      {blockedCount > 1 ? "s" : ""}
                    </Text>
                  </View>
                )}

                {/* Warning */}
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

          {/* ── Start button */}
          {!loading && (
            <TouchableOpacity
              style={[fm.startBtn, durationMin < 1 && fm.startBtnOff]}
              onPress={handleStart}
              disabled={durationMin < 1}
              activeOpacity={0.85}
            >
              <View style={fm.startBtnInner}>
                <Text style={fm.startBtnIcon}>◎</Text>
                <Text style={fm.startBtnText}>
                  {durationMin < 1
                    ? "Choisissez une durée"
                    : `Démarrer — ${formatDuration(durationMin)}`}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0E0E18",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
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
    marginBottom: 18,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#7B6EF618",
    borderWidth: 1,
    borderColor: "#7B6EF640",
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
  subtitle: { fontSize: 12, color: "#3A3A58", marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 11, color: "#5A5A80", fontWeight: "700" },

  // VPN banner
  vpnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#16100A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#4A3A1A",
    padding: 14,
    marginBottom: 20,
  },
  vpnBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0A03018",
    borderWidth: 1,
    borderColor: "#F0A03040",
    justifyContent: "center",
    alignItems: "center",
  },
  vpnBannerIcon: { fontSize: 16, color: "#F0A030" },
  vpnBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F0A030",
    marginBottom: 3,
  },
  vpnBannerText: { fontSize: 11, color: "#7A5A20", lineHeight: 17 },

  // Loading
  loadingBox: { alignItems: "center", paddingVertical: 36, gap: 0 },
  loadingSpinner: { fontSize: 36, color: "#7B6EF6", marginBottom: 14 },
  loadingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 22,
  },
  loadingSteps: { gap: 12, alignItems: "flex-start" },
  loadingStep: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingDot: {
    fontSize: 14,
    color: "#2E2E48",
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
  loadingDotDone: { color: "#3DDB8A" },
  loadingDotActive: { color: "#7B6EF6" },
  loadingStepTxt: { fontSize: 13, color: "#3A3A58" },
  loadingStepDone: { color: "#3DDB8A", fontWeight: "600" },
  loadingStepActive: { color: "#9B8FFF", fontWeight: "600" },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#14080A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#4A1A2A",
    padding: 14,
    marginBottom: 16,
  },
  errorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#D0407018",
    borderWidth: 1,
    borderColor: "#D0407040",
    justifyContent: "center",
    alignItems: "center",
  },
  errorIcon: { fontSize: 16, color: "#D04070" },
  errorTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D04070",
    marginBottom: 3,
  },
  errorText: { fontSize: 11, color: "#8A3050", lineHeight: 17 },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },

  // Presets
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  presetCard: {
    width: "30%",
    flex: 1,
    backgroundColor: "#14141E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  presetCardSel: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  presetTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#7B6EF6",
  },
  presetCustom: { borderStyle: "dashed" },
  presetIcon: { fontSize: 18, marginBottom: 5 },
  presetLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5A5A80",
    marginBottom: 2,
  },
  presetLabelSel: { color: "#9B8FFF" },
  presetDesc: {
    fontSize: 9,
    color: "#2E2E48",
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Picker
  pickerWrap: {
    backgroundColor: "#0A0A14",
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#2A2450",
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 12,
  },
  picker: { width: "100%", height: 150 },
  // Trigger button (remplace l'affichage direct du picker)
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#16103A",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#4A3F8A",
    width: "100%",
  },
  pickerTriggerIcon: { fontSize: 18, color: "#7B6EF6" },
  pickerTriggerValue: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#9B8FFF",
    letterSpacing: -0.5,
  },
  pickerTriggerEdit: { fontSize: 11, color: "#4A3F8A", fontWeight: "600" },
  // iOS done button
  pickerDoneBtn: {
    marginTop: 10,
    backgroundColor: "#7B6EF6",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  pickerDoneBtnText: { fontSize: 14, fontWeight: "800", color: "#F0F0FF" },

  // Profile options
  profileOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#14141E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 14,
    marginBottom: 8,
  },
  profileOptionSel: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  profileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconWrapSel: {
    backgroundColor: "#7B6EF618",
    borderColor: "#7B6EF640",
  },
  profileIcon: { fontSize: 16, color: "#3A3A58" },
  profileIconSel: { color: "#7B6EF6" },
  profileName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5A5A80",
    marginBottom: 2,
  },
  profileNameSel: { color: "#E8E8F8" },
  profileDesc: { fontSize: 11, color: "#2E2E48" },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    backgroundColor: "#14141E",
    justifyContent: "center",
    alignItems: "center",
  },
  checkCircleSel: { backgroundColor: "#7B6EF6", borderColor: "#7B6EF6" },
  checkMark: { fontSize: 11, color: "#FFF", fontWeight: "800" },

  // Summary
  summaryRow: {
    backgroundColor: "#7B6EF614",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#7B6EF630",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 12,
    color: "#9B8FFF",
    fontWeight: "600",
    textAlign: "center",
  },

  // Warning
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#0E0A14",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A1A4A",
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  warnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#9B6EF618",
    borderWidth: 1,
    borderColor: "#9B6EF640",
    justifyContent: "center",
    alignItems: "center",
  },
  warnIcon: { fontSize: 15, color: "#9B6EF6" },
  warnTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9B6EF6",
    marginBottom: 4,
  },
  warnText: { fontSize: 11, color: "#5A3A78", lineHeight: 17 },

  // Start button
  startBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  startBtnOff: { backgroundColor: "#7B6EF630", shadowOpacity: 0, elevation: 0 },
  startBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  startBtnIcon: { fontSize: 18, color: "#F0F0FF" },
  startBtnText: {
    color: "#F0F0FF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
