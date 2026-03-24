import PaywallModal from "@/components/PaywallModal";
import ThemeToggle from "@/components/ThemeToggle";
import { useAppInfo } from "@/hooks/useAppInfo";
import { usePremium } from "@/hooks/usePremium";
import AppEvents from "@/services/app-events";
import ImportExportService from "@/services/import-export.service";
import StorageService from "@/services/storage.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import VpnService from "@/services/vpn.service";
import { Colors, Semantic, useTheme } from "@/theme";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function Toggle({
  value,
  onToggle,
  disabled,
}: {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
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
    outputRange: [t.bg.cardSunken, t.bg.accent],
  });
  const border = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [t.border.normal, t.border.focus],
  });
  const thumbX = pos.interpolate({ inputRange: [0, 1], outputRange: [2, 20] });
  const thumbBg = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [t.border.normal, Colors.blue[500]],
  });
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.8}
      style={disabled ? { opacity: 0.3 } : undefined}
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
  const { t } = useTheme();
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
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          danger && {
            backgroundColor: t.danger.bg,
            borderColor: t.danger.border,
          },
          accent && {
            backgroundColor: accent + "15",
            borderColor: accent + "35",
          },
        ]}
      >
        <Text
          style={[
            s.rowIconText,
            { color: t.text.muted },
            accent && { color: accent },
            danger && { color: t.danger.accent },
          ]}
        >
          {icon}
        </Text>
      </View>
      <View style={s.rowContent}>
        <Text
          style={[
            s.rowTitle,
            { color: danger ? t.danger.text : t.text.primary },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[s.rowSubtitle, { color: t.text.muted }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View>{right}</View>}
      {onPress && !right && !disabled && (
        <Text
          style={[
            s.rowChevron,
            { color: danger ? t.danger.border : t.border.normal },
          ]}
        >
          ›
        </Text>
      )}
    </TouchableOpacity>
  );
}
function SectionLabel({ label }: { label: string }) {
  const { t } = useTheme();
  return <Text style={[s.sectionLabel, { color: t.text.muted }]}>{label}</Text>;
}
function Divider() {
  const { t } = useTheme();
  return <View style={[s.sep, { backgroundColor: t.border.light }]} />;
}

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
  const { t } = useTheme();
  return (
    <>
      <Animated.View
        style={[pp.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {showPin ? (
          <Text style={[pp.pinText, { color: Colors.blue[600] }]}>
            {pin || "·  ·  ·  ·"}
          </Text>
        ) : (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                pp.dot,
                i < pin.length
                  ? [pp.dotFilled, { backgroundColor: Colors.blue[500] }]
                  : [
                      pp.dotEmpty,
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.normal,
                      },
                    ],
              ]}
            />
          ))
        )}
      </Animated.View>
      <TouchableOpacity
        style={pp.eyeBtn}
        onPress={onToggleShow}
        activeOpacity={0.7}
      >
        <Text style={[pp.eyeText, { color: t.text.muted }]}>
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
            <Text style={[pp.btnText, { color: t.text.primary }]}>{d}</Text>
            {sub ? (
              <Text style={[pp.btnSub, { color: t.text.muted }]}>{sub}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
        <View style={pp.btn} />
        <TouchableOpacity
          style={pp.btn}
          onPress={() => onDigit("0")}
          activeOpacity={0.5}
        >
          <Text style={[pp.btnText, { color: t.text.primary }]}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pp.btn} onPress={onDelete} activeOpacity={0.5}>
          <Text style={[pp.deleteText, { color: t.text.secondary }]}>⌫</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[
          pp.submitBtn,
          {
            backgroundColor: submitDisabled
              ? Colors.blue[200]
              : Colors.blue[600],
          },
        ]}
        onPress={onSubmit}
        disabled={submitDisabled}
        activeOpacity={0.85}
      >
        <Text style={pp.submitText}>{submitLabel}</Text>
      </TouchableOpacity>
    </>
  );
}

function shake(anim: Animated.Value) {
  Animated.sequence([
    Animated.timing(anim, { toValue: 8, duration: 60, useNativeDriver: true }),
    Animated.timing(anim, { toValue: -8, duration: 60, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 4, duration: 60, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 0, duration: 60, useNativeDriver: true }),
  ]).start();
}

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
  const { t } = useTheme();
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const handleClose = () => {
    setPin("");
    setShowPin(false);
    onClose();
  };
  const handleConfirm = async () => {
    if (pin.length < 4) {
      shake(shakeAnim);
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
      shake(shakeAnim);
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
      <View style={[cpm.overlay, { backgroundColor: t.bg.page }]}>
        <View style={cpm.container}>
          <View
            style={[
              cpm.iconWrap,
              { backgroundColor: t.bg.accent, borderColor: t.border.strong },
            ]}
          >
            <Text style={[cpm.iconText, { color: t.text.link }]}>◈</Text>
          </View>
          <View style={cpm.header}>
            <Text style={[cpm.title, { color: t.text.primary }]}>{title}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={[
                cpm.closeIcon,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[cpm.closeIconText, { color: t.text.muted }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[cpm.subtitle, { color: t.text.secondary }]}>
            {subtitle}
          </Text>
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

function PinChangeModal({
  visible,
  onClose,
  isCreating = false,
}: {
  visible: boolean;
  onClose: () => void;
  isCreating?: boolean;
}) {
  const { t } = useTheme();
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
        shake(shakeAnim);
        return;
      }
      const valid = await StorageService.verifyPin(currentPin);
      if (!valid) {
        shake(shakeAnim);
        setCurrentPin("");
        Alert.alert("PIN incorrect", "Veuillez réessayer");
        return;
      }
      setShowPin(false);
      setStep("new");
    } else if (step === "new") {
      if (newPin.length < 4) {
        shake(shakeAnim);
        return;
      }
      setShowPin(false);
      setStep("confirm");
    } else {
      if (newPin !== confirmPin) {
        shake(shakeAnim);
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
      <View style={[pcm.overlay, { backgroundColor: t.bg.page }]}>
        <View style={pcm.container}>
          <View
            style={[
              pcm.iconWrap,
              { backgroundColor: t.bg.accent, borderColor: t.border.strong },
            ]}
          >
            <Text style={[pcm.iconText, { color: t.text.link }]}>
              {step === "confirm" ? "◉" : step === "new" ? "◈" : "◎"}
            </Text>
          </View>
          <View style={pcm.header}>
            <Text style={[pcm.title, { color: t.text.primary }]}>
              {titles[step]}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[
                pcm.closeIcon,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[pcm.closeIconText, { color: t.text.muted }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
          <View style={pcm.steps}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  pcm.step,
                  i < stepIndex
                    ? { backgroundColor: Colors.green[400] }
                    : i === stepIndex
                      ? { backgroundColor: Colors.blue[500] }
                      : { backgroundColor: t.border.light },
                ]}
              />
            ))}
          </View>
          <Text style={[pcm.subtitle, { color: t.text.secondary }]}>
            {subtitles[step]}
          </Text>
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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
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
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // ── État VPN synchronisé via AppEvents ────────────────────────────────────
  const [vpnActive, setVpnActive] = useState(false);
  const [vpnNative, setVpnNative] = useState(false);
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

    // Écouter les changements VPN émis depuis l'index ou autre
    const unsub = AppEvents.on("vpn:changed", (active) => setVpnActive(active));
    return () => unsub();
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
    const isActive = await VpnService.isVpnActive();
    const status = VpnService.getStatus();
    setVpnActive(isActive);
    setVpnNative(status.isNative);
    const [rules, profiles] = await Promise.all([
      StorageService.getRules(),
      StorageService.getProfiles(),
    ]);
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

  // ── VPN toggle — émet l'event pour synchroniser index.tsx ─────────────────
  const toggleVpn = async () => {
    const next = !vpnActive;
    setVpnActive(next); // UI immédiat
    try {
      if (next) await VpnService.startVpn();
      else await VpnService.stopVpn();
      // VpnService émet "vpn:changed" → index.tsx se met à jour automatiquement
    } catch {
      setVpnActive(!next); // rollback si erreur
    }
    await loadAll();
  };

  const handleExport = async () => {
    try {
      await ImportExportService.exportRules();
      closeExportModal();
    } catch (e: any) {
      if (e?.message !== "User did not share")
        Alert.alert("Erreur", e?.message ?? "Impossible d'exporter");
    }
  };

  const handleImport = async () => {
    if (!isPremium) {
      showPaywall("export");
      return;
    }
    setImportLoading(true);
    try {
      Alert.alert(
        "Mode d'import",
        "Voulez-vous fusionner avec les règles existantes ou les remplacer ?",
        [
          {
            text: "Annuler",
            style: "cancel",
            onPress: () => setImportLoading(false),
          },
          {
            text: "Fusionner",
            onPress: async () => {
              try {
                const r = await ImportExportService.importRules("merge");
                await loadAll();
                AppEvents.emit("rules:changed", undefined); // sync index
                Alert.alert(
                  "✅ Import réussi",
                  `${r.rules} règle${r.rules !== 1 ? "s" : ""} importée${r.rules !== 1 ? "s" : ""}.`,
                );
              } catch (e: any) {
                if (e?.message !== "Import annulé.")
                  Alert.alert("Erreur", e?.message ?? "Import échoué.");
              } finally {
                setImportLoading(false);
              }
            },
          },
          {
            text: "Remplacer",
            style: "destructive",
            onPress: async () => {
              try {
                const r = await ImportExportService.importRules("replace");
                await loadAll();
                AppEvents.emit("rules:changed", undefined); // sync index
                Alert.alert(
                  "✅ Import réussi",
                  `${r.rules} règle${r.rules !== 1 ? "s" : ""} importée${r.rules !== 1 ? "s" : ""}.`,
                );
              } catch (e: any) {
                if (e?.message !== "Import annulé.")
                  Alert.alert("Erreur", e?.message ?? "Import échoué.");
              } finally {
                setImportLoading(false);
              }
            },
          },
        ],
      );
    } catch {
      setImportLoading(false);
    }
  };

  const clearAllData = async () => {
    try {
      await Promise.all([
        StorageService.clearStats(),
        StorageService.clearRules(),
        StorageService.clearProfiles(),
      ]);
      await loadAll();
      AppEvents.emit("rules:changed", undefined); // sync index
      Alert.alert("Succès", "Toutes les données ont été effacées");
    } catch {
      Alert.alert("Erreur", "Impossible d'effacer");
    }
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

  const vpnOn = vpnActive;
  const anyLockEnabled = pinEnabled || bioEnabled;

  return (
    <View style={[s.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />
      <View
        style={[
          s.header,
          { paddingTop: insets.top + 10, backgroundColor: Semantic.bg.header },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.backText}>← Retour</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
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
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* VPN Banner — toggle synchronisé */}
        <TouchableOpacity
          style={[
            s.vpnBanner,
            {
              backgroundColor: vpnOn ? t.vpnOn.bg : t.vpnOff.bg,
              borderColor: vpnOn ? t.vpnOn.border : t.vpnOff.border,
            },
          ]}
          onPress={toggleVpn}
          activeOpacity={0.8}
        >
          <View
            style={[
              s.vpnAccent,
              { backgroundColor: vpnOn ? t.vpnOn.dot : t.vpnOff.dot },
            ]}
          />
          <View style={{ flex: 1, paddingLeft: 10 }}>
            <Text
              style={[
                s.vpnTitle,
                { color: vpnOn ? t.vpnOn.text : t.vpnOff.text },
              ]}
            >
              {vpnOn ? "◉ VPN Actif" : "◎ VPN Inactif"}
            </Text>
            <Text style={[s.vpnSub, { color: t.text.muted }]}>
              {vpnNative ? "Mode natif (VPNService)" : "Mode simulation"}
            </Text>
          </View>
          <View
            style={[
              s.vpnTogglePill,
              {
                backgroundColor: vpnOn ? t.vpnOn.bg : t.vpnOff.bg,
                borderColor: vpnOn ? t.vpnOn.dot : t.vpnOff.border,
              },
            ]}
          >
            <View
              style={[
                s.vpnDot,
                { backgroundColor: vpnOn ? t.vpnOn.dot : t.vpnOff.dot },
              ]}
            />
            <Text
              style={[
                s.vpnToggleText,
                { color: vpnOn ? t.vpnOn.text : t.vpnOff.text },
              ]}
            >
              {vpnOn ? "ON" : "OFF"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { num: stats.rules, label: "Règles", color: t.text.link },
            { num: stats.profiles, label: "Profils", color: t.text.link },
            {
              num: null,
              label: "VPN",
              color: vpnOn ? t.vpnOn.dot : t.vpnOff.dot,
              dot: vpnOn,
            },
          ].map((item, i) => (
            <View
              key={i}
              style={[
                s.statCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              {item.dot !== undefined ? (
                <View style={[s.statDot, { backgroundColor: item.color }]} />
              ) : (
                <Text style={[s.statNum, { color: item.color }]}>
                  {item.num}
                </Text>
              )}
              <Text style={[s.statLabel, { color: t.text.muted }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <SectionLabel label="APPARENCE" />
        <View
          style={[
            s.card,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <View style={{ padding: 16 }}>
            <Text
              style={[s.rowTitle, { color: t.text.primary, marginBottom: 4 }]}
            >
              Thème
            </Text>
            <Text
              style={[s.rowSubtitle, { color: t.text.muted, marginBottom: 12 }]}
            >
              Automatique selon l'heure (7h–20h = Jour)
            </Text>
            <ThemeToggle />
          </View>
        </View>

        <SectionLabel label="SÉCURITÉ" />
        <View
          style={[
            s.lockStatusBanner,
            {
              backgroundColor: anyLockEnabled ? t.allowed.bg : t.danger.bg,
              borderColor: anyLockEnabled ? t.allowed.border : t.danger.border,
            },
          ]}
        >
          <View
            style={[
              s.lockIconWrap,
              {
                backgroundColor: anyLockEnabled ? t.allowed.bg : t.danger.bg,
                borderWidth: 1,
                borderColor: anyLockEnabled
                  ? t.allowed.accent
                  : t.danger.accent,
              },
            ]}
          >
            <Text style={[s.lockIcon, { color: t.text.muted }]}>
              {anyLockEnabled ? "◈" : "◎"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                s.lockStatusTitle,
                { color: anyLockEnabled ? t.allowed.text : t.danger.text },
              ]}
            >
              {anyLockEnabled
                ? "Application verrouillée"
                : "Application non protégée"}
            </Text>
            <Text style={[s.lockStatusSub, { color: t.text.muted }]}>
              {anyLockEnabled
                ? [pinEnabled && "PIN applicatif", bioEnabled && bioType]
                    .filter(Boolean)
                    .join(" + ")
                : "N'importe qui peut modifier les règles"}
            </Text>
          </View>
        </View>

        <Text style={[s.methodLabel, { color: t.text.muted }]}>
          MÉTHODE 1 — PIN APPLICATIF
        </Text>
        <View
          style={[
            s.card,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <SettingRow
            icon="◈"
            title="Code PIN de l'application"
            subtitle={
              pinEnabled
                ? "Code à 4–6 chiffres géré par NetOff"
                : "Créer un code propre à l'application"
            }
            right={<Toggle value={pinEnabled} onToggle={handlePinToggle} />}
            accent={Colors.blue[600]}
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
                accent={Colors.blue[600]}
              />
            </>
          )}
        </View>
        <Text style={[s.methodNote, { color: t.text.muted }]}>
          ✦ Indépendant du téléphone — utile si quelqu'un d'autre a accès à
          votre écran déverrouillé
        </Text>

        <Text style={[s.methodLabel, { color: t.text.muted, marginTop: 18 }]}>
          MÉTHODE 2 — {bioType.toUpperCase()}
        </Text>
        <View
          style={[
            s.card,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
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
            accent={Colors.green[500]}
          />
        </View>
        <Text style={[s.methodNote, { color: t.text.muted }]}>
          ✦ Délègue au système Android — empreinte, face ou PIN téléphone comme
          fallback
        </Text>

        <SectionLabel label="CONTRÔLE PARENTAL" />
        <View
          style={[
            s.card,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <SettingRow
            icon="👶"
            title="Contrôle parental"
            subtitle="Verrouiller NetOff avec un PIN parent"
            onPress={() => router.push("/parental-control")}
            accent={Colors.purple[400]}
          />
        </View>

        <SectionLabel label="PRODUCTIVITÉ" />
        <View
          style={[
            s.card,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <SettingRow
            icon="📊"
            title="Statistiques de productivité"
            subtitle="Streak, badges, score hebdomadaire"
            onPress={() => router.push("/productivity")}
            accent={Colors.blue[500]}
          />
        </View>

        <SectionLabel label="DONNÉES" />
        <View
          style={[
            s.card,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <SettingRow
            icon="↑"
            title="Exporter les règles"
            subtitle={
              isPremium
                ? "Sauvegarder règles et profils (Share)"
                : "Fonctionnalité Premium"
            }
            onPress={() => {
              if (!isPremium) {
                showPaywall("export");
                return;
              }
              setExportVisible(true);
            }}
            accent={Colors.purple[500]}
          />
          <Divider />
          <SettingRow
            icon="↓"
            title="Importer les règles"
            subtitle={
              importLoading
                ? "Import en cours…"
                : isPremium
                  ? "Restaurer depuis un fichier JSON"
                  : "Fonctionnalité Premium"
            }
            onPress={handleImport}
            disabled={importLoading}
            accent={Colors.purple[500]}
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

        <SectionLabel label="À PROPOS" />
        <View
          style={[
            s.card,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
          ]}
        >
          <SettingRow
            icon="◉"
            title="À propos de NetOff"
            subtitle={appInfo.loading ? "…" : `Version ${appInfo.fullVersion}`}
            onPress={() => router.push("/screens/about")}
            accent={Colors.blue[600]}
          />
          <Divider />
          <SettingRow
            icon="◎"
            title="Nous contacter"
            subtitle="Signaler un bug ou envoyer une suggestion"
            onPress={() => router.push("/screens/contact")}
            accent={Colors.green[500]}
          />
        </View>
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
                backgroundColor: t.bg.card,
                borderColor: t.border.light,
                transform: [{ translateY: modalSlide }],
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={[em.handle, { backgroundColor: t.border.normal }]} />
            <View style={em.header}>
              <Text style={[em.title, { color: t.text.primary }]}>
                Exporter les données
              </Text>
              <TouchableOpacity
                onPress={closeExportModal}
                style={[
                  em.closeIcon,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
                ]}
              >
                <Text style={[em.closeIconText, { color: t.text.muted }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[em.body, { color: t.text.secondary }]}>
              Les règles et profils seront exportés au format JSON via le menu
              de partage Android.
            </Text>
            <TouchableOpacity
              style={[em.exportBtn, { backgroundColor: Colors.blue[600] }]}
              onPress={handleExport}
              activeOpacity={0.85}
            >
              <Text style={em.exportBtnIcon}>↑</Text>
              <Text style={em.exportBtnText}>Exporter et partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                em.cancelBtn,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
              onPress={closeExportModal}
              activeOpacity={0.8}
            >
              <Text style={[em.cancelBtnText, { color: t.text.secondary }]}>
                Annuler
              </Text>
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
        <View style={ccm.overlay}>
          <View
            style={[
              ccm.container,
              { backgroundColor: t.bg.card, borderColor: t.danger.border },
            ]}
          >
            <View
              style={[
                ccm.iconWrap,
                { backgroundColor: t.danger.bg, borderColor: t.danger.border },
              ]}
            >
              <Text style={[ccm.iconText, { color: t.danger.accent }]}>⚠</Text>
            </View>
            <Text style={[ccm.title, { color: t.text.primary }]}>
              Effacer toutes les données ?
            </Text>
            <Text style={[ccm.body, { color: t.text.secondary }]}>
              Règles, profils et statistiques seront définitivement supprimés.
            </Text>
            <TouchableOpacity
              style={[ccm.dangerBtn, { backgroundColor: t.danger.accent }]}
              onPress={() => {
                setConfirmClearVisible(false);
                clearAllData();
              }}
              activeOpacity={0.85}
            >
              <Text style={ccm.dangerBtnText}>Oui, tout effacer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                ccm.cancelBtn,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
              onPress={() => setConfirmClearVisible(false)}
            >
              <Text style={[ccm.cancelBtnText, { color: t.text.secondary }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PinChangeModal
        visible={pinModalVisible}
        onClose={handlePinModalClose}
        isCreating={pinModalCreating}
      />
      <ConfirmPinModal
        visible={confirmDisablePinVisible}
        onClose={() => setConfirmDisablePinVisible(false)}
        onConfirmed={handleDisablePinConfirmed}
        title="Désactiver le PIN applicatif"
        subtitle="Entrez votre PIN pour confirmer la désactivation"
      />
      <PaywallModal
        visible={paywallVisible}
        reason={paywallReason}
        onClose={() => setPaywallVisible(false)}
        onUpgraded={() => {
          refreshPremium();
          AppEvents.emit("premium:changed", true);
          setPaywallVisible(false);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  backBtn: { marginBottom: 12 },
  backText: { color: Colors.gray[0], fontSize: 14, fontWeight: "600" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconText: { fontSize: 20, color: Colors.gray[0] },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.blue[200],
    marginTop: 2,
    fontWeight: "500",
  },
  proBadge: {
    backgroundColor: Colors.purple[50],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.purple[100],
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.purple[600],
    letterSpacing: 1.5,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 8,
  },
  vpnBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 18,
    elevation: 2,
  },
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
  vpnSub: { fontSize: 11, fontWeight: "500" },
  vpnTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  vpnDot: { width: 6, height: 6, borderRadius: 3 },
  vpnToggleText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 6,
    elevation: 1,
  },
  statNum: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statDot: { width: 12, height: 12, borderRadius: 6 },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  lockStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  lockIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  lockIcon: { fontSize: 18 },
  lockStatusTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  lockStatusSub: { fontSize: 11 },
  methodLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 8,
  },
  methodNote: {
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
    elevation: 1,
  },
  sep: { height: 1, marginLeft: 60 },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowIconText: { fontSize: 15 },
  rowContent: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  rowSubtitle: { fontSize: 11 },
  rowChevron: { fontSize: 22, fontWeight: "300" },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    borderWidth: 1,
  },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, position: "absolute" },
});
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
  dotEmpty: {},
  dotFilled: {},
  pinText: { fontSize: 28, fontWeight: "800", letterSpacing: 8 },
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 16, marginBottom: 24 },
  eyeText: { fontSize: 12, fontWeight: "600" },
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
  btnText: { fontSize: 26, fontWeight: "600" },
  btnSub: { fontSize: 8, fontWeight: "700", letterSpacing: 1.5 },
  deleteText: { fontSize: 22 },
  submitBtn: {
    width: 280,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  submitText: { color: Colors.gray[0], fontSize: 16, fontWeight: "800" },
});
const cpm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center" },
  container: { alignItems: "center", paddingHorizontal: 32 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconText: { fontSize: 28 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 12, fontWeight: "700" },
  subtitle: {
    fontSize: 13,
    marginBottom: 28,
    textAlign: "center",
    lineHeight: 20,
  },
});
const pcm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center" },
  container: { alignItems: "center", paddingHorizontal: 32 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconText: { fontSize: 28 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 12, fontWeight: "700" },
  steps: { flexDirection: "row", gap: 6, width: "100%", marginBottom: 16 },
  step: { flex: 1, height: 3, borderRadius: 2 },
  subtitle: {
    fontSize: 13,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
});
const em = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.3)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
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
  title: { fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: { fontSize: 11, fontWeight: "700" },
  body: { fontSize: 13, lineHeight: 21, marginBottom: 22 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 10,
  },
  exportBtnIcon: { fontSize: 16, color: Colors.gray[0], fontWeight: "700" },
  exportBtnText: { color: Colors.gray[0], fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
});
const ccm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.4)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  container: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconText: { fontSize: 24 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  body: { fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 24 },
  dangerBtn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  dangerBtnText: { color: Colors.gray[0], fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
});
