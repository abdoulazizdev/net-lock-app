import PaywallModal from "@/components/PaywallModal";
import { usePremium } from "@/hooks/usePremium";
import FocusService from "@/services/focus.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import { Colors, useTheme } from "@/theme";
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
  const { t } = useTheme();
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
        <View
          style={[
            atp.sheet,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <Text style={[atp.title, { color: t.text.primary }]}>
            Durée personnalisée
          </Text>
          <DateTimePicker
            value={draft}
            mode="time"
            is24Hour
            display="spinner"
            onChange={(_, d) => {
              if (d) setDraft(d);
            }}
            style={atp.picker}
          />
          <View style={atp.row}>
            <TouchableOpacity
              style={[
                atp.cancelBtn,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={[atp.cancelText, { color: t.text.secondary }]}>
                Annuler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[atp.confirmBtn, { backgroundColor: Colors.blue[600] }]}
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
  const { t } = useTheme();
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
                backgroundColor: t.bg.card,
                borderColor: t.border.light,
                transform: [{ translateY: slideAnim }],
                paddingBottom: insets.bottom + 24,
              },
            ]}
          >
            <View style={[fm.handle, { backgroundColor: t.border.normal }]} />
            {/* Header */}
            <View style={fm.header}>
              <View style={fm.headerLeft}>
                <View
                  style={[
                    fm.headerIconWrap,
                    { backgroundColor: Colors.blue[600] },
                  ]}
                >
                  <Text style={fm.headerIcon}>◎</Text>
                </View>
                <View>
                  <Text style={[fm.title, { color: t.text.primary }]}>
                    Mode Focus
                  </Text>
                  <Text style={[fm.subtitle, { color: t.text.secondary }]}>
                    Session verrouillée
                  </Text>
                </View>
              </View>
              {!loading && (
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    fm.closeBtn,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                  ]}
                >
                  <Text style={[fm.closeBtnText, { color: t.text.muted }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEnabled={!loading}
              keyboardShouldPersistTaps="handled"
            >
              {/* VPN banner */}
              {!vpnWasActive && step === "idle" && (
                <View
                  style={[
                    fm.vpnBanner,
                    {
                      backgroundColor: t.warning.bg,
                      borderColor: t.warning.border,
                    },
                  ]}
                >
                  <Text style={fm.vpnBannerIcon}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[fm.vpnBannerTitle, { color: t.warning.text }]}
                    >
                      VPN inactif — démarrage auto
                    </Text>
                    <Text
                      style={[fm.vpnBannerText, { color: t.warning.accent }]}
                    >
                      Le VPN sera activé automatiquement.
                    </Text>
                  </View>
                </View>
              )}
              {/* Loading */}
              {loading && (
                <View style={fm.loadingBox}>
                  <View
                    style={[
                      fm.loadingIconWrap,
                      {
                        backgroundColor: t.bg.accent,
                        borderColor: t.border.strong,
                      },
                    ]}
                  >
                    <Text style={[fm.loadingIcon, { color: t.text.link }]}>
                      {step === "starting_vpn"
                        ? "◈"
                        : step === "starting_focus"
                          ? "◎"
                          : "◷"}
                    </Text>
                  </View>
                  <Text style={[fm.loadingText, { color: t.text.primary }]}>
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
                    ).map((sv) => (
                      <View key={sv.key} style={fm.loadingStep}>
                        <View
                          style={[
                            fm.loadingDotWrap,
                            {
                              backgroundColor: sv.done
                                ? t.allowed.bg
                                : sv.active
                                  ? t.bg.accent
                                  : t.bg.cardAlt,
                              borderColor: sv.done
                                ? t.allowed.border
                                : sv.active
                                  ? t.border.focus
                                  : t.border.light,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              fm.loadingDot,
                              {
                                color: sv.done
                                  ? t.allowed.text
                                  : sv.active
                                    ? t.text.link
                                    : t.text.muted,
                              },
                            ]}
                          >
                            {sv.done ? "✓" : sv.active ? "▶" : "○"}
                          </Text>
                        </View>
                        <Text
                          style={[
                            fm.loadingStepTxt,
                            {
                              color: sv.done
                                ? t.allowed.text
                                : sv.active
                                  ? t.text.link
                                  : t.text.secondary,
                            },
                            (sv.done || sv.active) && { fontWeight: "600" },
                          ]}
                        >
                          {sv.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {/* Error */}
              {step === "error" && (
                <View
                  style={[
                    fm.errorBox,
                    {
                      backgroundColor: t.danger.bg,
                      borderColor: t.danger.border,
                    },
                  ]}
                >
                  <Text style={[fm.errorIcon, { color: t.danger.accent }]}>
                    ⚠
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[fm.errorTitle, { color: t.danger.text }]}>
                      Échec du démarrage
                    </Text>
                    <Text style={[fm.errorText, { color: t.danger.accent }]}>
                      {errorMsg}
                    </Text>
                  </View>
                </View>
              )}
              {!loading && (
                <>
                  <Text style={[fm.sectionLabel, { color: t.text.muted }]}>
                    DURÉE
                  </Text>
                  <View style={fm.presetsGrid}>
                    {allPresets.map((p) => {
                      const locked = isPresetLocked(p.value);
                      const selected = selectedDuration === p.value;
                      return (
                        <TouchableOpacity
                          key={p.value}
                          style={[
                            fm.presetCard,
                            {
                              backgroundColor: t.bg.cardAlt,
                              borderColor: t.border.light,
                            },
                            selected && {
                              backgroundColor: t.bg.accent,
                              borderColor: t.border.focus,
                            },
                            locked && { opacity: 0.5 },
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
                            <View
                              style={[
                                fm.lockBadge,
                                {
                                  backgroundColor: Colors.purple[50],
                                  borderColor: Colors.purple[100],
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  fm.lockBadgeText,
                                  { color: Colors.purple[600] },
                                ]}
                              >
                                PRO
                              </Text>
                            </View>
                          )}
                          <Text style={fm.presetIcon}>{p.icon}</Text>
                          <Text
                            style={[
                              fm.presetLabel,
                              {
                                color: selected
                                  ? t.text.link
                                  : locked
                                    ? t.border.normal
                                    : t.text.secondary,
                              },
                            ]}
                          >
                            {p.label}
                          </Text>
                          <Text
                            style={[
                              fm.presetDesc,
                              { color: selected ? t.text.link : t.text.muted },
                            ]}
                          >
                            {locked ? "Premium" : p.desc}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[
                        fm.presetCard,
                        fm.presetCustom,
                        {
                          backgroundColor: t.bg.cardAlt,
                          borderColor: t.border.light,
                        },
                        selectedDuration === "custom" && {
                          backgroundColor: t.bg.accent,
                          borderColor: t.border.focus,
                        },
                        !isPremium && { opacity: 0.5 },
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
                        <View
                          style={[
                            fm.lockBadge,
                            {
                              backgroundColor: Colors.purple[50],
                              borderColor: Colors.purple[100],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              fm.lockBadgeText,
                              { color: Colors.purple[600] },
                            ]}
                          >
                            PRO
                          </Text>
                        </View>
                      )}
                      <Text style={fm.presetIcon}>⏱</Text>
                      <Text
                        style={[
                          fm.presetLabel,
                          {
                            color:
                              selectedDuration === "custom"
                                ? t.text.link
                                : !isPremium
                                  ? t.border.normal
                                  : t.text.secondary,
                          },
                        ]}
                      >
                        {selectedDuration === "custom"
                          ? formatDuration(durationMin)
                          : "Perso"}
                      </Text>
                      <Text
                        style={[
                          fm.presetDesc,
                          {
                            color:
                              selectedDuration === "custom"
                                ? t.text.link
                                : t.text.muted,
                          },
                        ]}
                      >
                        {isPremium ? "Libre" : "Premium"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedDuration === "custom" &&
                    isPremium &&
                    Platform.OS === "ios" && (
                      <View
                        style={[
                          fm.pickerWrap,
                          {
                            backgroundColor: t.bg.cardAlt,
                            borderColor: t.border.light,
                          },
                        ]}
                      >
                        <Text style={[fm.pickerLabel, { color: t.text.muted }]}>
                          DURÉE PERSONNALISÉE
                        </Text>
                        <DateTimePicker
                          value={customTime}
                          mode="time"
                          is24Hour
                          display="spinner"
                          onChange={(_, d) => {
                            if (d) setCustomTime(d);
                          }}
                          style={fm.picker}
                        />
                        <View
                          style={[
                            fm.pickerSummary,
                            {
                              backgroundColor: t.bg.accent,
                              borderColor: t.border.strong,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              fm.pickerSummaryText,
                              { color: t.text.link },
                            ]}
                          >
                            {formatDuration(durationMin)} de focus
                          </Text>
                        </View>
                      </View>
                    )}
                  {selectedDuration === "custom" &&
                    isPremium &&
                    Platform.OS === "android" && (
                      <TouchableOpacity
                        style={[
                          fm.androidPickerBtn,
                          {
                            backgroundColor: t.bg.cardAlt,
                            borderColor: t.border.strong,
                          },
                        ]}
                        onPress={() => setShowTimePicker(true)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[fm.androidPickerIcon, { color: t.text.link }]}
                        >
                          ⏱
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              fm.androidPickerLabel,
                              { color: t.text.secondary },
                            ]}
                          >
                            Durée personnalisée
                          </Text>
                          <Text
                            style={[
                              fm.androidPickerValue,
                              { color: t.text.primary },
                            ]}
                          >
                            {formatDuration(durationMin)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            fm.androidPickerArrow,
                            { color: t.text.muted },
                          ]}
                        >
                          ›
                        </Text>
                      </TouchableOpacity>
                    )}

                  <Text
                    style={[
                      fm.sectionLabel,
                      { color: t.text.muted, marginTop: 24 },
                    ]}
                  >
                    APPS À BLOQUER
                  </Text>
                  {[
                    {
                      id: null,
                      name: "Règles globales",
                      desc: "Toutes les apps actuellement bloquées",
                      icon: "⚙",
                    },
                    ...profiles.map((p) => ({
                      id: p.id,
                      name: p.name,
                      desc: `${p.rules.filter((r) => r.isBlocked).length} apps bloquées`,
                      icon: "◉",
                    })),
                  ].map((item) => {
                    const sel = selectedProfileId === item.id;
                    return (
                      <TouchableOpacity
                        key={String(item.id)}
                        style={[
                          fm.profileOption,
                          {
                            backgroundColor: t.bg.cardAlt,
                            borderColor: t.border.light,
                          },
                          sel && {
                            backgroundColor: t.allowed.bg,
                            borderColor: t.allowed.border,
                          },
                        ]}
                        onPress={() => setSelectedProfileId(item.id)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            fm.profileIconWrap,
                            {
                              backgroundColor: t.bg.card,
                              borderColor: t.border.light,
                            },
                            sel && {
                              backgroundColor: t.allowed.bg,
                              borderColor: t.allowed.border,
                            },
                          ]}
                        >
                          <Text
                            style={[fm.profileIcon, { color: t.text.muted }]}
                          >
                            {item.icon}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              fm.profileName,
                              {
                                color: sel ? t.text.primary : t.text.secondary,
                              },
                            ]}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[fm.profileDesc, { color: t.text.muted }]}
                          >
                            {item.desc}
                          </Text>
                        </View>
                        {sel && (
                          <View
                            style={[
                              fm.checkWrap,
                              {
                                backgroundColor: t.allowed.bg,
                                borderColor: t.allowed.border,
                              },
                            ]}
                          >
                            <Text style={[fm.check, { color: t.allowed.text }]}>
                              ✓
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  <View
                    style={[
                      fm.warnBox,
                      {
                        backgroundColor: t.focus.bg,
                        borderColor: t.focus.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        fm.warnIconWrap,
                        {
                          backgroundColor: t.bg.accent,
                          borderColor: t.border.strong,
                        },
                      ]}
                    >
                      <Text style={[fm.warnIcon, { color: t.text.link }]}>
                        ◈
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[fm.warnTitle, { color: t.focus.text }]}>
                        Session verrouillée
                      </Text>
                      <Text style={[fm.warnText, { color: t.focus.accent }]}>
                        Le VPN ne peut pas être désactivé pendant la session.
                        Maintenez Stop 5s pour annuler.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
            {!loading && (
              <TouchableOpacity
                style={[
                  fm.startBtn,
                  {
                    backgroundColor:
                      durationMin < 1 ? Colors.blue[200] : Colors.blue[600],
                  },
                ]}
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

const atp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  picker: { width: "100%", height: 160 },
  row: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelText: { fontSize: 14, fontWeight: "700" },
  confirmBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmText: { fontSize: 14, fontWeight: "800", color: Colors.gray[0] },
});
const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.3)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "92%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 20,
  },
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
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: { fontSize: 20, color: Colors.gray[0] },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 12, fontWeight: "700" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 12,
  },
  vpnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 22,
  },
  vpnBannerIcon: { fontSize: 15, marginTop: 1 },
  vpnBannerTitle: { fontSize: 12, fontWeight: "800", marginBottom: 3 },
  vpnBannerText: { fontSize: 11, lineHeight: 17 },
  loadingBox: { alignItems: "center", paddingVertical: 36 },
  loadingIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingIcon: { fontSize: 30 },
  loadingText: { fontSize: 15, fontWeight: "700", marginBottom: 24 },
  loadingSteps: { gap: 12, alignItems: "flex-start" },
  loadingStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  loadingDotWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingDot: { fontSize: 11, fontWeight: "700" },
  loadingStepTxt: { fontSize: 13, fontWeight: "500" },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  errorIcon: { fontSize: 16, marginTop: 1 },
  errorTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  errorText: { fontSize: 12, lineHeight: 18 },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  presetCard: {
    width: "30%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    position: "relative",
  },
  presetCustom: { borderStyle: "dashed" },
  lockBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  lockBadgeText: { fontSize: 7, fontWeight: "800", letterSpacing: 0.5 },
  presetIcon: { fontSize: 22, marginBottom: 6 },
  presetLabel: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  presetDesc: { fontSize: 9, fontWeight: "600", letterSpacing: 0.5 },
  pickerWrap: {
    borderRadius: 18,
    padding: 18,
    marginVertical: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  picker: { width: "100%", height: 150 },
  pickerSummary: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
  },
  pickerSummaryText: { fontSize: 16, fontWeight: "800" },
  androidPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
  },
  androidPickerIcon: { fontSize: 20 },
  androidPickerLabel: { fontSize: 11, fontWeight: "600", marginBottom: 3 },
  androidPickerValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  androidPickerArrow: { fontSize: 22 },
  profileOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  profileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileIcon: { fontSize: 16 },
  profileName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  profileDesc: { fontSize: 11 },
  checkWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  check: { fontSize: 13, fontWeight: "800" },
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    marginBottom: 22,
  },
  warnIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  warnIcon: { fontSize: 15 },
  warnTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  warnText: { fontSize: 12, lineHeight: 18 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 17,
    marginTop: 8,
  },
  startBtnIcon: { fontSize: 16, color: Colors.gray[0] },
  startBtnText: {
    color: Colors.gray[0],
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
