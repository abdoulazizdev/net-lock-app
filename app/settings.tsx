import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import * as LocalAuthentication from "expo-local-authentication";
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
  return (
    <TouchableOpacity
      style={[
        styles.toggle,
        value ? styles.toggleOn : styles.toggleOff,
        disabled && styles.toggleDisabled,
      ]}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View
        style={[styles.toggleThumb, value ? styles.thumbOn : styles.thumbOff]}
      />
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
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      activeOpacity={onPress && !disabled ? 0.65 : 1}
      disabled={(!onPress && !right) || disabled}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Text style={styles.rowIconText}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {right && <View>{right}</View>}
      {onPress && !right && !disabled && (
        <Text style={[styles.rowChevron, danger && styles.rowChevronDanger]}>
          ›
        </Text>
      )}
    </TouchableOpacity>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ─── Pavé numérique réutilisable ──────────────────────────────────────────────
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
      {/* Indicateur PIN */}
      <Animated.View
        style={[pad.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {showPin ? (
          <Text style={pad.pinText}>{pin || "·  ·  ·  ·"}</Text>
        ) : (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[pad.dot, i < pin.length ? pad.dotFilled : pad.dotEmpty]}
            />
          ))
        )}
      </Animated.View>

      {/* Bouton afficher/masquer */}
      <TouchableOpacity
        style={pad.eyeBtn}
        onPress={onToggleShow}
        activeOpacity={0.7}
      >
        <Text style={pad.eyeText}>
          {showPin ? "🙈  Masquer" : "👁  Voir le code"}
        </Text>
      </TouchableOpacity>

      {/* Pavé */}
      <View style={pad.grid}>
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
        ].map(([d, s]) => (
          <TouchableOpacity
            key={d}
            style={pad.btn}
            onPress={() => onDigit(d)}
            activeOpacity={0.6}
          >
            <Text style={pad.btnText}>{d}</Text>
            {s ? <Text style={pad.btnSub}>{s}</Text> : null}
          </TouchableOpacity>
        ))}
        <View style={pad.btn} />
        <TouchableOpacity
          style={pad.btn}
          onPress={() => onDigit("0")}
          activeOpacity={0.6}
        >
          <Text style={pad.btnText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={pad.btn}
          onPress={onDelete}
          activeOpacity={0.6}
        >
          <Text style={pad.deleteText}>⌫</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[pad.submitBtn, submitDisabled && pad.submitBtnOff]}
        onPress={onSubmit}
        disabled={submitDisabled}
        activeOpacity={0.85}
      >
        <Text style={pad.submitText}>{submitLabel}</Text>
      </TouchableOpacity>
    </>
  );
}

const pad = StyleSheet.create({
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
    backgroundColor: "#1C1C2C",
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
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 16, marginBottom: 28 },
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
  btnText: { fontSize: 26, fontWeight: "600", color: "#F0F0FF" },
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

// ─── Confirm PIN Modal ────────────────────────────────────────────────────────
function ConfirmPinModal({
  visible,
  onClose,
  onConfirmed,
  title,
  subtitle,
  accentColor = "#D04070",
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  title: string;
  subtitle: string;
  accentColor?: string;
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
      <View style={cm.overlay}>
        <View style={cm.container}>
          <View style={cm.header}>
            <Text style={cm.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose}>
              <View style={cm.closeIcon}>
                <Text style={cm.closeIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={cm.subtitle}>{subtitle}</Text>
          <PinPad
            pin={pin}
            onDigit={(d) => {
              if (pin.length < 6) setPin((p) => p + d);
            }}
            onDelete={() => setPin((p) => p.slice(0, -1))}
            onSubmit={handleConfirm}
            submitLabel={loading ? "..." : "Confirmer"}
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

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#080810", justifyContent: "center" },
  container: { alignItems: "center", paddingHorizontal: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#F0F0FF" },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 12, color: "#5A5A80", fontWeight: "700" },
  subtitle: {
    fontSize: 14,
    color: "#3A3A58",
    marginBottom: 28,
    textAlign: "center",
  },
});

// ─── PIN Setup/Change Modal ───────────────────────────────────────────────────
// isCreating=true → saute l'étape "PIN actuel" (premier setup)
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

  // Reset quand on ouvre
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

  const handleClose = () => {
    onClose();
  };

  const activePin =
    step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const setActivePin = (val: string) => {
    if (step === "current") setCurrentPin(val);
    else if (step === "new") setNewPin(val);
    else setConfirmPin(val);
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
        isCreating ? "PIN créé avec succès !" : "PIN modifié avec succès !",
      );
      handleClose();
    }
  };

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

  // Barre de progression
  const steps = isCreating ? ["new", "confirm"] : ["current", "new", "confirm"];
  const stepIndex = steps.indexOf(step);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={pm.overlay}>
        <View style={pm.container}>
          <View style={pm.header}>
            <Text style={pm.title}>{titles[step]}</Text>
            <TouchableOpacity onPress={handleClose}>
              <View style={pm.closeIcon}>
                <Text style={pm.closeIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Barre de progression */}
          <View style={pm.steps}>
            {steps.map((s, i) => (
              <View
                key={s}
                style={[
                  pm.step,
                  i < stepIndex
                    ? pm.stepDone
                    : i === stepIndex
                      ? pm.stepActive
                      : pm.stepInactive,
                ]}
              />
            ))}
          </View>

          <Text style={pm.subtitle}>{subtitles[step]}</Text>

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
                  : "Confirmer le changement"
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

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#080810", justifyContent: "center" },
  container: { alignItems: "center", paddingHorizontal: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#F0F0FF" },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 12, color: "#5A5A80", fontWeight: "700" },
  steps: { flexDirection: "row", gap: 8, width: "100%", marginBottom: 16 },
  step: { flex: 1, height: 3, borderRadius: 2 },
  stepActive: { backgroundColor: "#7B6EF6" },
  stepDone: { backgroundColor: "#3DDB8A" },
  stepInactive: { backgroundColor: "#1C1C2C" },
  subtitle: {
    fontSize: 14,
    color: "#3A3A58",
    marginBottom: 24,
    textAlign: "center",
  },
});

// ─── Import Modal ─────────────────────────────────────────────────────────────
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
      Alert.alert("Succès", "Données importées avec succès");
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
      <View style={im.overlay}>
        <View style={im.container}>
          <View style={im.header}>
            <Text style={im.title}>Importer des données</Text>
            <TouchableOpacity onPress={onClose}>
              <View style={im.closeIcon}>
                <Text style={im.closeIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={im.label}>COLLER LE JSON EXPORTÉ</Text>
          <TextInput
            style={im.input}
            placeholder='{"rules": [...], "profiles": [...], ...}'
            placeholderTextColor="#2A2A42"
            value={jsonText}
            onChangeText={setJsonText}
            multiline
            numberOfLines={8}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={im.warning}>
            ⚠️ L'import remplacera les données existantes. Action irréversible.
          </Text>
          <TouchableOpacity
            style={[
              im.importBtn,
              (!jsonText.trim() || loading) && im.importBtnOff,
            ]}
            onPress={handleImport}
            disabled={!jsonText.trim() || loading}
            activeOpacity={0.85}
          >
            <Text style={im.importBtnText}>
              {loading ? "Import..." : "↓ Importer"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={im.cancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={im.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const im = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#0E0E18",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 19, fontWeight: "800", color: "#F0F0FF" },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#1C1C2C",
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
    backgroundColor: "#14141E",
    borderRadius: 12,
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
  warning: { fontSize: 12, color: "#D04070", marginBottom: 20, lineHeight: 18 },
  importBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  importBtnOff: { backgroundColor: "#7B6EF620" },
  importBtnText: { color: "#F0F0FF", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    backgroundColor: "#14141E",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  cancelBtnText: { color: "#3A3A58", fontSize: 14, fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  // isCreating=true → PinChangeModal sans étape "PIN actuel"
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalCreating, setPinModalCreating] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);
  const [confirmDisablePinVisible, setConfirmDisablePinVisible] =
    useState(false);
  const [confirmDisableBioVisible, setConfirmDisableBioVisible] =
    useState(false);
  const [vpnStatus, setVpnStatus] = useState({
    isActive: false,
    isNative: false,
    platform: "",
  });
  const [stats, setStats] = useState({ rules: 0, profiles: 0 });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const modalSlide = useRef(new Animated.Value(300)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
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
    setBiometricEnabled(config.isBiometricEnabled);
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
    const status = VpnService.getStatus();
    const isActive = await VpnService.isVpnActive();
    setVpnStatus({ ...status, isActive });
    const rules = await StorageService.getRules();
    const profiles = await StorageService.getProfiles();
    setStats({ rules: rules.length, profiles: profiles.length });
  };

  const handlePinToggle = () => {
    if (!pinEnabled) {
      // Activation → création de PIN (sans demander le PIN actuel)
      setPinModalCreating(true);
      setPinModalVisible(true);
    } else {
      // Désactivation → confirmer avec le PIN actuel
      setConfirmDisablePinVisible(true);
    }
  };

  const handlePinModalClose = async () => {
    setPinModalVisible(false);
    setPinModalCreating(false);
    await loadAll(); // recharge pour refléter si le PIN a été créé
  };

  const handleDisablePinConfirmed = async () => {
    setConfirmDisablePinVisible(false);
    await StorageService.disablePin();
    setPinEnabled(false);
    setBiometricEnabled(false);
    Alert.alert(
      "Verrouillage désactivé",
      "L'app ne demandera plus de PIN au démarrage.",
    );
  };

  const handleBioToggle = async () => {
    if (!biometricEnabled) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirmer l'activation de la biométrie",
        });
        if (result.success) {
          await StorageService.updateAuthConfig({ isBiometricEnabled: true });
          setBiometricEnabled(true);
        }
      } catch {
        Alert.alert("Erreur", "Impossible d'activer la biométrie");
      }
    } else {
      setConfirmDisableBioVisible(true);
    }
  };

  const handleDisableBioConfirmed = async () => {
    setConfirmDisableBioVisible(false);
    await StorageService.updateAuthConfig({ isBiometricEnabled: false });
    setBiometricEnabled(false);
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
      Alert.alert("Erreur", "Impossible d'effacer les données");
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <Text style={styles.headerSubtitle}>Configuration de l'app</Text>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* VPN Banner */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <TouchableOpacity
            style={[
              styles.vpnBanner,
              vpnOn ? styles.vpnBannerOn : styles.vpnBannerOff,
            ]}
            onPress={toggleVpn}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.vpnAccent,
                { backgroundColor: vpnOn ? "#3DDB8A" : "#D04070" },
              ]}
            />
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text
                style={[
                  styles.vpnTitle,
                  { color: vpnOn ? "#3DDB8A" : "#D04070" },
                ]}
              >
                {vpnOn ? "🛡️ VPN Actif" : "⚠️ VPN Inactif"}
              </Text>
              <Text style={styles.vpnSub}>
                {vpnStatus.isNative
                  ? "Mode natif (VPNService)"
                  : "Mode simulation"}
                {vpnStatus.platform ? ` • ${vpnStatus.platform}` : ""}
              </Text>
            </View>
            <View
              style={[
                styles.vpnPill,
                vpnOn ? styles.vpnPillOn : styles.vpnPillOff,
              ]}
            >
              <View
                style={[
                  styles.vpnPillDot,
                  { backgroundColor: vpnOn ? "#3DDB8A" : "#D04070" },
                ]}
              />
              <Text
                style={[
                  styles.vpnPillText,
                  { color: vpnOn ? "#3DDB8A" : "#D04070" },
                ]}
              >
                {vpnOn ? "ON" : "OFF"}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats */}
        <Animated.View
          style={[styles.statsRow, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.rules}</Text>
            <Text style={styles.statLabel}>Règles</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.profiles}</Text>
            <Text style={styles.statLabel}>Profils</Text>
          </View>
          <View style={styles.statCard}>
            <Text
              style={[styles.statNum, { color: vpnOn ? "#3DDB8A" : "#D04070" }]}
            >
              {vpnOn ? "●" : "○"}
            </Text>
            <Text style={styles.statLabel}>VPN</Text>
          </View>
        </Animated.View>

        {/* Sécurité */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <SectionLabel label="SÉCURITÉ" />
          <View style={styles.card}>
            <SettingRow
              icon="◈"
              title="Verrouillage par PIN"
              subtitle={
                pinEnabled
                  ? "L'app demande un code au démarrage"
                  : "Aucun verrouillage actif"
              }
              right={<Toggle value={pinEnabled} onToggle={handlePinToggle} />}
            />
            {pinEnabled && (
              <>
                <View style={styles.sep} />
                <SettingRow
                  icon="✎"
                  title="Changer le PIN"
                  subtitle="Modifier le code PIN de sécurité"
                  onPress={() => {
                    setPinModalCreating(false);
                    setPinModalVisible(true);
                  }}
                />
              </>
            )}
            {pinEnabled && (
              <>
                <View style={styles.sep} />
                <SettingRow
                  icon="◎"
                  title="Authentification biométrique"
                  subtitle={
                    biometricAvailable
                      ? "Face ID / Touch ID en complément du PIN"
                      : "Non disponible sur cet appareil"
                  }
                  right={
                    <Toggle
                      value={biometricEnabled}
                      onToggle={handleBioToggle}
                      disabled={!biometricAvailable}
                    />
                  }
                />
              </>
            )}
          </View>
          {!pinEnabled && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoIcon}>◎</Text>
              <Text style={styles.infoText}>
                Activez le verrouillage pour protéger l'accès à NetOff. Sans
                lui, n'importe qui peut ouvrir l'app et désactiver les blocages.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Données */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <SectionLabel label="DONNÉES" />
          <View style={styles.card}>
            <SettingRow
              icon="↑"
              title="Exporter les règles"
              subtitle="Sauvegarder règles et profils en JSON"
              onPress={() => setExportVisible(true)}
            />
            <View style={styles.sep} />
            <SettingRow
              icon="↓"
              title="Importer les règles"
              subtitle="Restaurer des règles depuis un JSON"
              onPress={() => setImportModalVisible(true)}
            />
            <View style={styles.sep} />
            <SettingRow
              icon="⌫"
              title="Effacer toutes les données"
              subtitle="Supprime règles, profils et statistiques"
              onPress={() => setConfirmClearVisible(true)}
              danger
            />
          </View>
        </Animated.View>

        {/* À propos */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <SectionLabel label="À PROPOS" />
          <View style={styles.card}>
            <SettingRow icon="◉" title="Version" subtitle="1.0.0 — NetOff" />
            <View style={styles.sep} />
            <SettingRow
              icon="◌"
              title="Licence"
              subtitle="Usage personnel uniquement"
              onPress={() =>
                Alert.alert(
                  "Licence",
                  "NetOff — Usage personnel uniquement.\nModule VPN natif Android.",
                )
              }
            />
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Export Modal */}
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
              <TouchableOpacity onPress={closeExportModal}>
                <View style={em.closeIcon}>
                  <Text style={em.closeIconText}>✕</Text>
                </View>
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

      {/* Confirm Clear */}
      <Modal
        visible={confirmClearVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmClearVisible(false)}
      >
        <View style={cc.overlay}>
          <View style={cc.container}>
            <Text style={cc.icon}>⚠️</Text>
            <Text style={cc.title}>Effacer toutes les données ?</Text>
            <Text style={cc.body}>
              Cette action supprimera définitivement toutes vos règles, profils
              et statistiques. Elle est irréversible.
            </Text>
            <TouchableOpacity
              style={cc.dangerBtn}
              onPress={() => {
                setConfirmClearVisible(false);
                clearAllData();
              }}
              activeOpacity={0.85}
            >
              <Text style={cc.dangerBtnText}>Oui, tout effacer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cc.cancelBtn}
              onPress={() => setConfirmClearVisible(false)}
            >
              <Text style={cc.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN Setup / Change */}
      <PinChangeModal
        visible={pinModalVisible}
        onClose={handlePinModalClose}
        isCreating={pinModalCreating}
      />

      {/* Import */}
      <ImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImported={loadAll}
      />

      {/* Désactiver PIN */}
      <ConfirmPinModal
        visible={confirmDisablePinVisible}
        onClose={() => setConfirmDisablePinVisible(false)}
        onConfirmed={handleDisablePinConfirmed}
        title="Désactiver le verrouillage"
        subtitle="Entrez votre PIN pour confirmer la désactivation"
      />

      {/* Désactiver biométrie */}
      <ConfirmPinModal
        visible={confirmDisableBioVisible}
        onClose={() => setConfirmDisableBioVisible(false)}
        onConfirmed={handleDisableBioConfirmed}
        title="Désactiver la biométrie"
        subtitle="Entrez votre PIN pour confirmer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#3A3A58",
    marginTop: 3,
    letterSpacing: 0.4,
    fontWeight: "500",
  },
  scroll: { paddingHorizontal: 22, paddingTop: 18 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 6,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 14,
    alignItems: "center",
  },
  statNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "#3A3A58",
    fontWeight: "700",
    letterSpacing: 1,
  },
  vpnBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  vpnBannerOn: { backgroundColor: "#0A0E0C", borderColor: "#152518" },
  vpnBannerOff: { backgroundColor: "#0E0A0C", borderColor: "#251520" },
  vpnAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  vpnTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  vpnSub: { fontSize: 11, color: "#3A3A58", fontWeight: "500" },
  vpnPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  vpnPillOn: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  vpnPillOff: { backgroundColor: "#1E0E16", borderColor: "#4A1A2A" },
  vpnPillDot: { width: 6, height: 6, borderRadius: 3 },
  vpnPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  card: {
    backgroundColor: "#0E0E18",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 8,
    overflow: "hidden",
  },
  sep: { height: 1, backgroundColor: "#13131F", marginLeft: 58 },
  row: { flexDirection: "row", alignItems: "center", padding: 15 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#14141E",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowIconDanger: { backgroundColor: "#14080A", borderColor: "#2A1520" },
  rowIconText: { fontSize: 15, color: "#5A5A80" },
  rowContent: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E8E8F8",
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  rowTitleDanger: { color: "#D04070" },
  rowSubtitle: { fontSize: 11, color: "#3A3A58" },
  rowChevron: { color: "#2A2A42", fontSize: 22, fontWeight: "300" },
  rowChevronDanger: { color: "#4A1A2A" },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    padding: 3,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: "#0D2218", borderColor: "#1E6A46" },
  toggleOff: { backgroundColor: "#14141E", borderColor: "#1C1C2C" },
  toggleDisabled: { opacity: 0.3 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  thumbOn: { backgroundColor: "#3DDB8A", alignSelf: "flex-end" },
  thumbOff: { backgroundColor: "#2A2A3A", alignSelf: "flex-start" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 8,
  },
  infoIcon: { fontSize: 14, color: "#3A3A58", marginTop: 1 },
  infoText: { flex: 1, fontSize: 12, color: "#3A3A58", lineHeight: 19 },
});

const em = StyleSheet.create({
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
    backgroundColor: "#1C1C2C",
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

const cc = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000BB",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  container: {
    backgroundColor: "#0E0E18",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "#2A1520",
    alignItems: "center",
  },
  icon: { fontSize: 40, marginBottom: 16 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 12,
    textAlign: "center",
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
    backgroundColor: "#D04070",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  dangerBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    width: "100%",
    backgroundColor: "#14141E",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  cancelBtnText: { color: "#3A3A58", fontSize: 14, fontWeight: "600" },
});
