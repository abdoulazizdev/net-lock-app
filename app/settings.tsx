import { useAppInfo } from "@/hooks/useAppInfo";
import { usePremium } from "@/hooks/usePremium";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  value,
  onToggle,
  disabled,
}: {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
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
  const bg = pos.interpolate({
    inputRange: [0, 1],
    outputRange: ["#14141E", "#16103A"],
  });
  const border = pos.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1C1C2C", "#4A3F8A"],
  });
  const thumbX = pos.interpolate({ inputRange: [0, 1], outputRange: [2, 20] });
  const thumbBg = pos.interpolate({
    inputRange: [0, 1],
    outputRange: ["#2A2A3A", "#7B6EF6"],
  });
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.8}
      style={disabled && { opacity: 0.3 }}
    >
      <Animated.View
        style={[s.toggle, { backgroundColor: bg, borderColor: border }]}
      >
        <Animated.View
          style={[
            s.toggleThumb,
            { transform: [{ translateX: thumbX }], backgroundColor: thumbBg },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── SettingRow ───────────────────────────────────────────────────────────────
function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
  disabled,
  accent,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  accent?: string;
}) {
  return (
    <TouchableOpacity
      style={[s.row, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      activeOpacity={onPress && !disabled ? 0.65 : 1}
      disabled={(!onPress && !right) || disabled}
    >
      <View
        style={[
          s.rowIcon,
          danger && s.rowIconDanger,
          accent
            ? { backgroundColor: accent + "18", borderColor: accent + "40" }
            : {},
        ]}
      >
        <Text
          style={[
            s.rowIconText,
            accent ? { color: accent } : danger ? { color: "#D04070" } : {},
          ]}
        >
          {icon}
        </Text>
      </View>
      <View style={s.rowContent}>
        <Text style={[s.rowTitle, danger && s.rowTitleDanger]}>{title}</Text>
        {subtitle && <Text style={s.rowSubtitle}>{subtitle}</Text>}
      </View>
      {right && <View>{right}</View>}
      {onPress && !right && !disabled && (
        <Text style={[s.rowChevron, danger && s.rowChevronDanger]}>›</Text>
      )}
    </TouchableOpacity>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={s.sectionLabel}>{label}</Text>;
}

function Divider() {
  return <View style={s.sep} />;
}

// ─── PinPad ───────────────────────────────────────────────────────────────────
function PinPad({
  pin,
  onDigit,
  onDelete,
  onSubmit,
  submitLabel,
  submitDisabled,
  showPin,
  onToggleShow,
  shakeAnim,
}: {
  pin: string;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled: boolean;
  showPin: boolean;
  onToggleShow: () => void;
  shakeAnim: Animated.Value;
}) {
  return (
    <>
      <Animated.View
        style={[pp.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {showPin ? (
          <Text style={pp.pinText}>{pin || "·  ·  ·  ·"}</Text>
        ) : (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[pp.dot, i < pin.length ? pp.dotFilled : pp.dotEmpty]}
            />
          ))
        )}
      </Animated.View>
      <TouchableOpacity
        style={pp.eyeBtn}
        onPress={onToggleShow}
        activeOpacity={0.7}
      >
        <Text style={pp.eyeText}>
          {showPin ? "◈  Masquer" : "◎  Voir le code"}
        </Text>
      </TouchableOpacity>
      <View style={pp.grid}>
        {[
          ["1", ""],
          ["2", "ABC"],
          ["3", "DEF"],
          ["4", "GHI"],
          ["5", "JKL"],
          ["6", "MNO"],
          ["7", "PQRS"],
          ["8", "TUV"],
          ["9", "WXYZ"],
        ].map(([d, sub]) => (
          <TouchableOpacity
            key={d}
            style={pp.btn}
            onPress={() => onDigit(d)}
            activeOpacity={0.5}
          >
            <Text style={pp.btnText}>{d}</Text>
            {sub ? <Text style={pp.btnSub}>{sub}</Text> : null}
          </TouchableOpacity>
        ))}
        <View style={pp.btn} />
        <TouchableOpacity
          style={pp.btn}
          onPress={() => onDigit("0")}
          activeOpacity={0.5}
        >
          <Text style={pp.btnText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pp.btn} onPress={onDelete} activeOpacity={0.5}>
          <Text style={pp.deleteText}>⌫</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[pp.submitBtn, submitDisabled && pp.submitBtnOff]}
        onPress={onSubmit}
        disabled={submitDisabled}
        activeOpacity={0.85}
      >
        <Text style={pp.submitText}>{submitLabel}</Text>
      </TouchableOpacity>
    </>
  );
}

const pp = StyleSheet.create({
  dotsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 10,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotEmpty: {
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#2A2A42",
  },
  dotFilled: { backgroundColor: "#7B6EF6" },
  pinText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#7B6EF6",
    letterSpacing: 8,
  },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 16, marginBottom: 24 },
  eyeText: { fontSize: 12, color: "#3A3A58", fontWeight: "600" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    justifyContent: "center",
    marginBottom: 20,
  },
  btn: {
    width: 88,
    height: 72,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    margin: 3,
  },
  btnText: { fontSize: 26, fontWeight: "600", color: "#E8E8F8" },
  btnSub: {
    fontSize: 8,
    color: "#3A3A58",
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  deleteText: { fontSize: 22, color: "#3A3A58" },
  submitBtn: {
    width: 280,
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  submitBtnOff: { backgroundColor: "#7B6EF620" },
  submitText: { color: "#F0F0FF", fontSize: 16, fontWeight: "800" },
});

// ─── ConfirmPinModal ──────────────────────────────────────────────────────────
function ConfirmPinModal({
  visible,
  onClose,
  onConfirmed,
  title,
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  title: string;
  subtitle: string;
}) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 4,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  const handleClose = () => {
    setPin("");
    setShowPin(false);
    onClose();
  };
  const handleConfirm = async () => {
    if (pin.length < 4) {
      shake();
      return;
    }
    setLoading(true);
    const valid = await StorageService.verifyPin(pin);
    setLoading(false);
    if (valid) {
      setPin("");
      setShowPin(false);
      onConfirmed();
    } else {
      shake();
      setPin("");
      Alert.alert("PIN incorrect", "Veuillez réessayer");
    }
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={cpm.overlay}>
        <View style={cpm.container}>
          <View style={cpm.iconWrap}>
            <Text style={cpm.iconText}>◈</Text>
          </View>
          <View style={cpm.header}>
            <Text style={cpm.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={cpm.closeIcon}>
              <Text style={cpm.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={cpm.subtitle}>{subtitle}</Text>
          <PinPad
            pin={pin}
            onDigit={(d) => {
              if (pin.length < 6) setPin((p) => p + d);
            }}
            onDelete={() => setPin((p) => p.slice(0, -1))}
            onSubmit={handleConfirm}
            submitLabel={loading ? "…" : "Confirmer"}
            submitDisabled={loading || pin.length < 4}
            showPin={showPin}
            onToggleShow={() => setShowPin((v) => !v)}
            shakeAnim={shakeAnim}
          />
        </View>
      </View>
    </Modal>
  );
}
const cpm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#07070F", justifyContent: "center" },
  container: { alignItems: "center", paddingHorizontal: 32 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconText: { fontSize: 28, color: "#7B6EF6" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 12, color: "#5A5A80", fontWeight: "700" },
  subtitle: {
    fontSize: 13,
    color: "#3A3A58",
    marginBottom: 28,
    textAlign: "center",
    lineHeight: 20,
  },
});

// ─── PinChangeModal ───────────────────────────────────────────────────────────
function PinChangeModal({
  visible,
  onClose,
  isCreating = false,
}: {
  visible: boolean;
  onClose: () => void;
  isCreating?: boolean;
}) {
  const initialStep = isCreating ? "new" : "current";
  const [step, setStep] = useState<"current" | "new" | "confirm">(initialStep);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setStep(isCreating ? "new" : "current");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setShowPin(false);
    }
  }, [visible]);
  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 4,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  const activePin =
    step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const setActivePin = (v: string) => {
    if (step === "current") setCurrentPin(v);
    else if (step === "new") setNewPin(v);
    else setConfirmPin(v);
  };
  const handleNext = async () => {
    if (step === "current") {
      if (currentPin.length < 4) {
        shake();
        return;
      }
      const valid = await StorageService.verifyPin(currentPin);
      if (!valid) {
        shake();
        setCurrentPin("");
        Alert.alert("PIN incorrect", "Veuillez réessayer");
        return;
      }
      setShowPin(false);
      setStep("new");
    } else if (step === "new") {
      if (newPin.length < 4) {
        shake();
        return;
      }
      setShowPin(false);
      setStep("confirm");
    } else {
      if (newPin !== confirmPin) {
        shake();
        setConfirmPin("");
        Alert.alert("Erreur", "Les PINs ne correspondent pas");
        return;
      }
      await StorageService.savePin(newPin);
      Alert.alert(
        "Succès",
        isCreating ? "PIN applicatif créé !" : "PIN modifié avec succès !",
      );
      onClose();
    }
  };
  const steps = isCreating ? ["new", "confirm"] : ["current", "new", "confirm"];
  const stepIndex = steps.indexOf(step);
  const titles = {
    current: "PIN actuel",
    new: isCreating ? "Créer votre PIN" : "Nouveau PIN",
    confirm: "Confirmer le PIN",
  };
  const subtitles = {
    current: "Entrez votre code actuel",
    new: "Choisissez un PIN de 4 à 6 chiffres",
    confirm: "Répétez votre nouveau PIN",
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={pcm.overlay}>
        <View style={pcm.container}>
          <View style={pcm.iconWrap}>
            <Text style={pcm.iconText}>
              {step === "confirm" ? "◉" : step === "new" ? "◈" : "◎"}
            </Text>
          </View>
          <View style={pcm.header}>
            <Text style={pcm.title}>{titles[step]}</Text>
            <TouchableOpacity onPress={onClose} style={pcm.closeIcon}>
              <Text style={pcm.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={pcm.steps}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  pcm.step,
                  i < stepIndex
                    ? pcm.stepDone
                    : i === stepIndex
                      ? pcm.stepActive
                      : pcm.stepInactive,
                ]}
              />
            ))}
          </View>
          <Text style={pcm.subtitle}>{subtitles[step]}</Text>
          <PinPad
            pin={activePin}
            onDigit={(d) => {
              if (activePin.length < 6) setActivePin(activePin + d);
            }}
            onDelete={() => setActivePin(activePin.slice(0, -1))}
            onSubmit={handleNext}
            submitLabel={
              step === "confirm"
                ? isCreating
                  ? "Créer le PIN"
                  : "Confirmer"
                : "Suivant →"
            }
            submitDisabled={activePin.length < 4}
            showPin={showPin}
            onToggleShow={() => setShowPin((v) => !v)}
            shakeAnim={shakeAnim}
          />
        </View>
      </View>
    </Modal>
  );
}
const pcm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#07070F", justifyContent: "center" },
  container: { alignItems: "center", paddingHorizontal: 32 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconText: { fontSize: 28, color: "#7B6EF6" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -0.5,
  },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 12, color: "#5A5A80", fontWeight: "700" },
  steps: { flexDirection: "row", gap: 6, width: "100%", marginBottom: 16 },
  step: { flex: 1, height: 3, borderRadius: 2 },
  stepActive: { backgroundColor: "#7B6EF6" },
  stepDone: { backgroundColor: "#3DDB8A" },
  stepInactive: { backgroundColor: "#1C1C2C" },
  subtitle: {
    fontSize: 13,
    color: "#3A3A58",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
});

// ─── ImportModal ──────────────────────────────────────────────────────────────
function ImportModal({
  visible,
  onClose,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const handleImport = async () => {
    if (!jsonText.trim()) {
      Alert.alert("Erreur", "Collez le JSON à importer");
      return;
    }
    setLoading(true);
    try {
      await StorageService.importData(jsonText.trim());
      Alert.alert("Succès", "Données importées");
      setJsonText("");
      onImported();
      onClose();
    } catch {
      Alert.alert("Erreur", "JSON invalide ou corrompu.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={imm.overlay}>
        <View style={imm.container}>
          <View style={imm.handle} />
          <View style={imm.header}>
            <Text style={imm.title}>Importer des données</Text>
            <TouchableOpacity onPress={onClose} style={imm.closeIcon}>
              <Text style={imm.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={imm.label}>COLLER LE JSON EXPORTÉ</Text>
          <TextInput
            style={imm.input}
            placeholder='{"rules": [...], "profiles": [...], ...}'
            placeholderTextColor="#2A2A42"
            value={jsonText}
            onChangeText={setJsonText}
            multiline
            numberOfLines={8}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={imm.warnRow}>
            <Text style={imm.warnIcon}>⚠</Text>
            <Text style={imm.warning}>
              L'import remplacera les données existantes. Action irréversible.
            </Text>
          </View>
          <TouchableOpacity
            style={[imm.btn, (!jsonText.trim() || loading) && imm.btnOff]}
            onPress={handleImport}
            disabled={!jsonText.trim() || loading}
            activeOpacity={0.85}
          >
            <Text style={imm.btnText}>
              {loading ? "Import…" : "↓ Importer"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={imm.cancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={imm.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const imm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#0C0C16",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#1C1C2C",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A3C",
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#F0F0FF",
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
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 14,
    color: "#F0F0FF",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    height: 140,
    textAlignVertical: "top",
    fontFamily: "monospace",
    marginBottom: 14,
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#140810",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#3A1020",
    marginBottom: 20,
  },
  warnIcon: { fontSize: 13, color: "#D04070", marginTop: 1 },
  warning: { flex: 1, fontSize: 12, color: "#8A3050", lineHeight: 18 },
  btn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  btnOff: { backgroundColor: "#7B6EF620" },
  btnText: { color: "#F0F0FF", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  cancelText: { color: "#3A3A58", fontSize: 14, fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const appInfo = useAppInfo();
  const { isPremium, refresh: refreshPremium } = usePremium();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<"security" | "export">(
    "security",
  );
  const showPaywall = (reason: "security" | "export") => {
    setPaywallReason(reason);
    setPaywallVisible(true);
  };

  const [pinEnabled, setPinEnabled] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioType, setBioType] = useState("Biométrie");
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalCreating, setPinModalCreating] = useState(false);
  const [confirmDisablePinVisible, setConfirmDisablePinVisible] =
    useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [vpnStatus, setVpnStatus] = useState({
    isActive: false,
    isNative: false,
    platform: "",
  });
  const [stats, setStats] = useState({ rules: 0, profiles: 0 });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const modalSlide = useRef(new Animated.Value(300)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (exportVisible) {
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(modalSlide, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalSlide.setValue(300);
      modalOpacity.setValue(0);
    }
  }, [exportVisible]);

  const loadAll = async () => {
    const config = await StorageService.getAuthConfig();
    setPinEnabled(config.isPinEnabled);
    setBioEnabled(config.isBiometricEnabled);
    const hasHW = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBioAvailable(hasHW && enrolled);
    if (hasHW) {
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (
        types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        )
      )
        setBioType("Face ID");
      else if (
        types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      )
        setBioType("Empreinte digitale");
      else setBioType("PIN du téléphone");
    }
    const status = VpnService.getStatus();
    const isActive = await VpnService.isVpnActive();
    setVpnStatus({ ...status, isActive });
    const rules = await StorageService.getRules();
    const profiles = await StorageService.getProfiles();
    setStats({ rules: rules.length, profiles: profiles.length });
  };

  const handlePinToggle = () => {
    if (!isPremium && !FREE_LIMITS.PIN_AUTH) {
      showPaywall("security");
      return;
    }
    if (!pinEnabled) {
      setPinModalCreating(true);
      setPinModalVisible(true);
    } else setConfirmDisablePinVisible(true);
  };
  const handlePinModalClose = async () => {
    setPinModalVisible(false);
    setPinModalCreating(false);
    await loadAll();
  };
  const handleDisablePinConfirmed = async () => {
    setConfirmDisablePinVisible(false);
    await StorageService.disablePin();
    await StorageService.updateAuthConfig({ isBiometricEnabled: false });
    setPinEnabled(false);
    setBioEnabled(false);
    Alert.alert(
      "PIN applicatif désactivé",
      "L'app ne demandera plus de code propriétaire.",
    );
  };
  const handleBioToggle = async () => {
    if (!bioEnabled) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirmer l'activation",
          fallbackLabel: "Utiliser le PIN du téléphone",
          cancelLabel: "Annuler",
        });
        if (result.success) {
          await StorageService.updateAuthConfig({ isBiometricEnabled: true });
          setBioEnabled(true);
        }
      } catch {
        Alert.alert("Erreur", "Impossible d'activer la biométrie");
      }
    } else {
      if (pinEnabled) {
        Alert.alert(
          "Désactiver la biométrie ?",
          "Le PIN applicatif restera actif.",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Désactiver",
              style: "destructive",
              onPress: async () => {
                await StorageService.updateAuthConfig({
                  isBiometricEnabled: false,
                });
                setBioEnabled(false);
              },
            },
          ],
        );
      } else {
        await StorageService.updateAuthConfig({ isBiometricEnabled: false });
        setBioEnabled(false);
      }
    }
  };
  const handleExport = async () => {
    try {
      const jsonData = await StorageService.exportData();
      await Share.share({ message: jsonData, title: "Export NetOff" });
      closeExportModal();
    } catch {
      Alert.alert("Erreur", "Impossible d'exporter");
    }
  };
  const clearAllData = async () => {
    try {
      await StorageService.clearStats();
      await StorageService.clearRules();
      await StorageService.clearProfiles();
      await loadAll();
      Alert.alert("Succès", "Toutes les données ont été effacées");
    } catch {
      Alert.alert("Erreur", "Impossible d'effacer");
    }
  };
  const toggleVpn = async () => {
    if (vpnStatus.isActive) await VpnService.stopVpn();
    else await VpnService.startVpn();
    await loadAll();
  };
  const closeExportModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(modalSlide, {
        toValue: 300,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setExportVisible(false));
  };

  const vpnOn = vpnStatus.isActive;
  const anyLockEnabled = pinEnabled || bioEnabled;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07070F" />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={s.headerLeft}>
          <View style={s.headerIconWrap}>
            <Text style={s.headerIconText}>◈</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>Paramètres</Text>
            <Text style={s.headerSubtitle}>Configuration de l'app</Text>
          </View>
        </View>
        {isPremium && (
          <View style={s.proBadge}>
            <Text style={s.proBadgeText}>PRO</Text>
          </View>
        )}
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* ── VPN Banner ── */}
        <TouchableOpacity
          style={[s.vpnBanner, vpnOn ? s.vpnBannerOn : s.vpnBannerOff]}
          onPress={toggleVpn}
          activeOpacity={0.8}
        >
          <View
            style={[
              s.vpnAccent,
              { backgroundColor: vpnOn ? "#3DDB8A" : "#D04070" },
            ]}
          />
          <View style={{ flex: 1, paddingLeft: 10 }}>
            <Text
              style={[s.vpnTitle, { color: vpnOn ? "#3DDB8A" : "#D04070" }]}
            >
              {vpnOn ? "◉ VPN Actif" : "◎ VPN Inactif"}
            </Text>
            <Text style={s.vpnSub}>
              {vpnStatus.isNative
                ? "Mode natif (VPNService)"
                : "Mode simulation"}
              {vpnStatus.platform ? ` · ${vpnStatus.platform}` : ""}
            </Text>
          </View>
          <View
            style={[
              s.vpnTogglePill,
              vpnOn ? s.vpnTogglePillOn : s.vpnTogglePillOff,
            ]}
          >
            <View
              style={[
                s.vpnDot,
                { backgroundColor: vpnOn ? "#3DDB8A" : "#D04070" },
              ]}
            />
            <Text
              style={[
                s.vpnToggleText,
                { color: vpnOn ? "#3DDB8A" : "#D04070" },
              ]}
            >
              {vpnOn ? "ON" : "OFF"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          {[
            { num: stats.rules, label: "Règles", color: "#9B8FFF" },
            { num: stats.profiles, label: "Profils", color: "#9B8FFF" },
            {
              num: null,
              label: "VPN",
              color: vpnOn ? "#3DDB8A" : "#D04070",
              dot: vpnOn,
            },
          ].map((item, i) => (
            <View key={i} style={s.statCard}>
              {item.dot !== undefined ? (
                <View style={[s.statDot, { backgroundColor: item.color }]} />
              ) : (
                <Text style={[s.statNum, { color: item.color }]}>
                  {item.num}
                </Text>
              )}
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── SÉCURITÉ ── */}
        <SectionLabel label="SÉCURITÉ" />

        {/* Statut global du verrou */}
        <View
          style={[
            s.lockStatusBanner,
            anyLockEnabled ? s.lockStatusOn : s.lockStatusOff,
          ]}
        >
          <View
            style={[
              s.lockIconWrap,
              anyLockEnabled ? s.lockIconWrapOn : s.lockIconWrapOff,
            ]}
          >
            <Text style={s.lockIcon}>{anyLockEnabled ? "◈" : "◎"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                s.lockStatusTitle,
                { color: anyLockEnabled ? "#3DDB8A" : "#C04060" },
              ]}
            >
              {anyLockEnabled
                ? "Application verrouillée"
                : "Application non protégée"}
            </Text>
            <Text style={s.lockStatusSub}>
              {anyLockEnabled
                ? [pinEnabled && "PIN applicatif", bioEnabled && bioType]
                    .filter(Boolean)
                    .join(" + ")
                : "N'importe qui peut modifier les règles"}
            </Text>
          </View>
        </View>

        {/* Méthode 1 — PIN */}
        <Text style={s.methodLabel}>MÉTHODE 1 — PIN APPLICATIF</Text>
        <View style={s.card}>
          <SettingRow
            icon="◈"
            title="Code PIN de l'application"
            subtitle={
              pinEnabled
                ? "Code à 4–6 chiffres géré par NetOff"
                : "Créer un code propre à l'application"
            }
            right={<Toggle value={pinEnabled} onToggle={handlePinToggle} />}
            accent="#7B6EF6"
          />
          {pinEnabled && (
            <>
              <Divider />
              <SettingRow
                icon="✎"
                title="Changer le PIN"
                subtitle="Modifier le code PIN applicatif"
                onPress={() => {
                  setPinModalCreating(false);
                  setPinModalVisible(true);
                }}
                accent="#7B6EF6"
              />
            </>
          )}
        </View>
        <Text style={s.methodNote}>
          ✦ Indépendant du téléphone — utile si quelqu'un d'autre a accès à
          votre écran déverrouillé
        </Text>

        {/* Méthode 2 — Bio */}
        <Text style={[s.methodLabel, { marginTop: 18 }]}>
          MÉTHODE 2 — {bioType.toUpperCase()}
        </Text>
        <View style={s.card}>
          <SettingRow
            icon="◎"
            title={`${bioType} / PIN du téléphone`}
            subtitle={
              bioAvailable
                ? bioEnabled
                  ? `Actif — ${bioType}`
                  : `Utiliser ${bioType} ou le PIN du téléphone`
                : "Aucune biométrie configurée"
            }
            right={
              <Toggle
                value={bioEnabled}
                onToggle={handleBioToggle}
                disabled={!bioAvailable}
              />
            }
            disabled={!bioAvailable}
            accent="#3DDB8A"
          />
        </View>
        <Text style={s.methodNote}>
          ✦ Délègue au système Android — empreinte, face ou PIN téléphone comme
          fallback
        </Text>

        {pinEnabled && bioEnabled && (
          <View style={s.combinedBanner}>
            <View style={s.combinedIconWrap}>
              <Text style={s.combinedIcon}>⚡</Text>
            </View>
            <Text style={s.combinedText}>
              Les deux méthodes sont actives. Biométrie proposée en premier, PIN
              en secours.
            </Text>
          </View>
        )}

        {/* ── DONNÉES ── */}
        <SectionLabel label="DONNÉES" />
        <View style={s.card}>
          <SettingRow
            icon="↑"
            title="Exporter les règles"
            subtitle={
              isPremium
                ? "Sauvegarder règles et profils en JSON"
                : "Fonctionnalité Premium"
            }
            onPress={() => {
              if (!isPremium) {
                showPaywall("export");
                return;
              }
              setExportVisible(true);
            }}
            accent="#9B8FFF"
          />
          <Divider />
          <SettingRow
            icon="↓"
            title="Importer les règles"
            subtitle={
              isPremium
                ? "Restaurer des règles depuis un JSON"
                : "Fonctionnalité Premium"
            }
            onPress={() => {
              if (!isPremium) {
                showPaywall("export");
                return;
              }
              setImportModalVisible(true);
            }}
            accent="#9B8FFF"
          />
          <Divider />
          <SettingRow
            icon="⌫"
            title="Effacer toutes les données"
            subtitle="Supprime règles, profils et statistiques"
            onPress={() => setConfirmClearVisible(true)}
            danger
          />
        </View>

        {/* ── À PROPOS ── */}
        <SectionLabel label="À PROPOS" />
        <View style={s.card}>
          <SettingRow
            icon="◉"
            title="À propos de NetOff"
            subtitle={appInfo.loading ? "…" : `Version ${appInfo.fullVersion}`}
            onPress={() => router.push("/screens/about")}
            accent="#7B6EF6"
          />
          <Divider />
          <SettingRow
            icon="◎"
            title="Nous contacter"
            subtitle="Signaler un bug ou envoyer une suggestion"
            onPress={() => router.push("/screens/contact")}
            accent="#3DDB8A"
          />
        </View>
      </Animated.ScrollView>

      {/* ── Export Modal ── */}
      <Modal
        visible={exportVisible}
        transparent
        animationType="none"
        onRequestClose={closeExportModal}
      >
        <Animated.View style={[em.overlay, { opacity: modalOpacity }]}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeExportModal}
          />
          <Animated.View
            style={[
              em.sheet,
              {
                transform: [{ translateY: modalSlide }],
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={em.handle} />
            <View style={em.header}>
              <Text style={em.title}>Exporter les données</Text>
              <TouchableOpacity onPress={closeExportModal} style={em.closeIcon}>
                <Text style={em.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={em.body}>
              Les règles, profils et statistiques seront exportés au format
              JSON.
            </Text>
            <TouchableOpacity
              style={em.exportBtn}
              onPress={handleExport}
              activeOpacity={0.85}
            >
              <Text style={em.exportBtnIcon}>↑</Text>
              <Text style={em.exportBtnText}>Exporter et partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={em.cancelBtn}
              onPress={closeExportModal}
              activeOpacity={0.8}
            >
              <Text style={em.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Confirm Clear ── */}
      <Modal
        visible={confirmClearVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmClearVisible(false)}
      >
        <View style={ccm.overlay}>
          <View style={ccm.container}>
            <View style={ccm.iconWrap}>
              <Text style={ccm.iconText}>⚠</Text>
            </View>
            <Text style={ccm.title}>Effacer toutes les données ?</Text>
            <Text style={ccm.body}>
              Règles, profils et statistiques seront définitivement supprimés.
            </Text>
            <TouchableOpacity
              style={ccm.dangerBtn}
              onPress={() => {
                setConfirmClearVisible(false);
                clearAllData();
              }}
              activeOpacity={0.85}
            >
              <Text style={ccm.dangerBtnText}>Oui, tout effacer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ccm.cancelBtn}
              onPress={() => setConfirmClearVisible(false)}
            >
              <Text style={ccm.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PinChangeModal
        visible={pinModalVisible}
        onClose={handlePinModalClose}
        isCreating={pinModalCreating}
      />
      <ImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImported={loadAll}
      />
      <ConfirmPinModal
        visible={confirmDisablePinVisible}
        onClose={() => setConfirmDisablePinVisible(false)}
        onConfirmed={handleDisablePinConfirmed}
        title="Désactiver le PIN applicatif"
        subtitle="Entrez votre PIN pour confirmer la désactivation"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070F" },

  // Header
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#111120",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#07070F",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#3A3480",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconText: { fontSize: 20, color: "#7B6EF6" },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#EDEDFF",
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#2A2A48",
    marginTop: 2,
    fontWeight: "500",
  },
  proBadge: {
    backgroundColor: "#16103A",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#4A3F8A",
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9B8FFF",
    letterSpacing: 1.5,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2A2A48",
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 8,
  },

  // VPN Banner
  vpnBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 18,
  },
  vpnBannerOn: { backgroundColor: "#080E0A", borderColor: "#112018" },
  vpnBannerOff: { backgroundColor: "#0E0808", borderColor: "#200E10" },
  vpnAccent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  vpnTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  vpnSub: { fontSize: 11, color: "#2E2E48", fontWeight: "500" },
  vpnTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  vpnTogglePillOn: { backgroundColor: "#0A1C14", borderColor: "#1A5034" },
  vpnTogglePillOff: { backgroundColor: "#1A0A0C", borderColor: "#3A1018" },
  vpnDot: { width: 6, height: 6, borderRadius: 3 },
  vpnToggleText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "#0C0C16",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#141428",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  statNum: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statDot: { width: 12, height: 12, borderRadius: 6 },
  statLabel: {
    fontSize: 9,
    color: "#2A2A48",
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  // Lock status
  lockStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  lockStatusOn: { backgroundColor: "#080E0A", borderColor: "#112018" },
  lockStatusOff: { backgroundColor: "#0E080A", borderColor: "#281018" },
  lockIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  lockIconWrapOn: {
    backgroundColor: "#0A2018",
    borderWidth: 1,
    borderColor: "#1A5034",
  },
  lockIconWrapOff: {
    backgroundColor: "#200A10",
    borderWidth: 1,
    borderColor: "#401020",
  },
  lockIcon: { fontSize: 18, color: "#5A5A80" },
  lockStatusTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  lockStatusSub: { fontSize: 11, color: "#3A3A58" },

  // Method labels & notes
  methodLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2A2A48",
    letterSpacing: 2,
    marginBottom: 8,
  },
  methodNote: {
    fontSize: 11,
    color: "#1E1E30",
    lineHeight: 17,
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 4,
  },

  // Combined banner
  combinedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#16103A",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3A3480",
    marginTop: 12,
  },
  combinedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#0E0A22",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
  },
  combinedIcon: { fontSize: 14, color: "#7B6EF6" },
  combinedText: { flex: 1, fontSize: 12, color: "#5A5080", lineHeight: 18 },

  // Card
  card: {
    backgroundColor: "#0C0C16",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#141428",
    marginBottom: 8,
    overflow: "hidden",
  },
  sep: { height: 1, backgroundColor: "#111120", marginLeft: 60 },

  // Row
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowIconDanger: { backgroundColor: "#120608", borderColor: "#2A0E14" },
  rowIconText: { fontSize: 15, color: "#5A5A80" },
  rowContent: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D8D8F0",
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  rowTitleDanger: { color: "#C04060" },
  rowSubtitle: { fontSize: 11, color: "#2E2E48" },
  rowChevron: { color: "#1E1E30", fontSize: 22, fontWeight: "300" },
  rowChevronDanger: { color: "#3A1020" },

  // Toggle
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    borderWidth: 1,
  },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, position: "absolute" },
});

const em = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0C0C16",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#1C1C2C",
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#F0F0FF",
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
  body: { fontSize: 13, color: "#3A3A58", lineHeight: 21, marginBottom: 22 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 10,
  },
  exportBtnIcon: { fontSize: 16, color: "#F0F0FF", fontWeight: "700" },
  exportBtnText: { color: "#F0F0FF", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  cancelBtnText: { color: "#3A3A58", fontSize: 14, fontWeight: "600" },
});

const ccm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000BB",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  container: {
    backgroundColor: "#0C0C16",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "#2A0E14",
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#180810",
    borderWidth: 1,
    borderColor: "#3A1020",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconText: { fontSize: 24, color: "#C04060" },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 13,
    color: "#3A3A58",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  dangerBtn: {
    width: "100%",
    backgroundColor: "#C04060",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  dangerBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    width: "100%",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#141428",
  },
  cancelBtnText: { color: "#3A3A58", fontSize: 14, fontWeight: "600" },
});
