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
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress && !right}
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
      {onPress && !right && (
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

// ─── PIN Change Modal ─────────────────────────────────────────────────────────
function PinChangeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"current" | "new" | "confirm">("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
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
  };

  const reset = () => {
    setStep("current");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDigit = (d: string) => {
    if (step === "current" && currentPin.length < 6)
      setCurrentPin((p) => p + d);
    else if (step === "new" && newPin.length < 6) setNewPin((p) => p + d);
    else if (step === "confirm" && confirmPin.length < 6)
      setConfirmPin((p) => p + d);
  };

  const handleDelete = () => {
    if (step === "current") setCurrentPin((p) => p.slice(0, -1));
    else if (step === "new") setNewPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
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
        Alert.alert("Erreur", "PIN actuel incorrect");
        return;
      }
      setStep("new");
    } else if (step === "new") {
      if (newPin.length < 4) {
        shake();
        return;
      }
      setStep("confirm");
    } else {
      if (newPin !== confirmPin) {
        shake();
        setConfirmPin("");
        Alert.alert("Erreur", "Les PINs ne correspondent pas");
        return;
      }
      await StorageService.savePin(newPin);
      Alert.alert("Succès", "PIN modifié avec succès");
      handleClose();
    }
  };

  const activePin =
    step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const titles = {
    current: "PIN actuel",
    new: "Nouveau PIN",
    confirm: "Confirmer le PIN",
  };
  const subtitles = {
    current: "Entrez votre code actuel",
    new: "Choisissez un nouveau PIN (4-6 chiffres)",
    confirm: "Répétez le nouveau PIN",
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={pinModal.overlay}>
        <View style={pinModal.container}>
          <View style={pinModal.header}>
            <Text style={pinModal.title}>{titles[step]}</Text>
            <TouchableOpacity onPress={handleClose}>
              <View style={pinModal.closeIcon}>
                <Text style={pinModal.closeIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Steps */}
          <View style={pinModal.steps}>
            {(["current", "new", "confirm"] as const).map((s, i) => (
              <View
                key={s}
                style={[
                  pinModal.step,
                  step === s && pinModal.stepActive,
                  (step === "new" && i === 0) || (step === "confirm" && i <= 1)
                    ? pinModal.stepDone
                    : null,
                ]}
              />
            ))}
          </View>

          <Text style={pinModal.subtitle}>{subtitles[step]}</Text>

          {/* Dots */}
          <Animated.View
            style={[pinModal.dots, { transform: [{ translateX: shakeAnim }] }]}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  pinModal.dot,
                  i < activePin.length ? pinModal.dotFilled : pinModal.dotEmpty,
                ]}
              />
            ))}
          </Animated.View>

          {/* Numpad */}
          <View style={pinModal.pad}>
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
                style={pinModal.padBtn}
                onPress={() => handleDigit(d)}
                activeOpacity={0.6}
              >
                <Text style={pinModal.padBtnText}>{d}</Text>
                {s && <Text style={pinModal.padBtnSub}>{s}</Text>}
              </TouchableOpacity>
            ))}
            <View style={pinModal.padBtn} />
            <TouchableOpacity
              style={pinModal.padBtn}
              onPress={() => handleDigit("0")}
              activeOpacity={0.6}
            >
              <Text style={pinModal.padBtnText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={pinModal.padBtn}
              onPress={handleDelete}
              activeOpacity={0.6}
            >
              <Text style={pinModal.padDelete}>⌫</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              pinModal.nextBtn,
              activePin.length < 4 && pinModal.nextBtnDisabled,
            ]}
            onPress={handleNext}
            disabled={activePin.length < 4}
            activeOpacity={0.85}
          >
            <Text style={pinModal.nextBtnText}>
              {step === "confirm" ? "Confirmer le changement" : "Suivant →"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

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
    } catch (e) {
      Alert.alert("Erreur", "JSON invalide ou corrompu. Vérifiez le contenu.");
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
      <View style={importModal.overlay}>
        <View style={importModal.container}>
          <View style={importModal.header}>
            <Text style={importModal.title}>Importer des données</Text>
            <TouchableOpacity onPress={onClose}>
              <View style={importModal.closeIcon}>
                <Text style={importModal.closeIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={importModal.label}>COLLER LE JSON EXPORTÉ</Text>
          <TextInput
            style={importModal.input}
            placeholder='{"rules": [...], "profiles": [...], ...}'
            placeholderTextColor="#2A2A42"
            value={jsonText}
            onChangeText={setJsonText}
            multiline
            numberOfLines={8}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={importModal.warning}>
            ⚠️ L'import remplacera les données existantes. Cette action est
            irréversible.
          </Text>

          <TouchableOpacity
            style={[
              importModal.importBtn,
              (!jsonText.trim() || loading) && importModal.importBtnDisabled,
            ]}
            onPress={handleImport}
            disabled={!jsonText.trim() || loading}
            activeOpacity={0.85}
          >
            <Text style={importModal.importBtnText}>
              {loading ? "Import..." : "↓ Importer"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={importModal.cancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={importModal.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);
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

  const toggleBiometric = async (value: boolean) => {
    try {
      if (value) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirmer l'activation",
        });
        if (result.success) {
          await StorageService.updateAuthConfig({ isBiometricEnabled: true });
          setBiometricEnabled(true);
        }
      } else {
        await StorageService.updateAuthConfig({ isBiometricEnabled: false });
        setBiometricEnabled(false);
      }
    } catch {
      Alert.alert("Erreur", "Impossible de modifier la biométrie");
    }
  };

  const handleExport = async () => {
    try {
      const jsonData = await StorageService.exportData();
      await Share.share({ message: jsonData, title: "Export NetLock" });
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

      {/* Header */}
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

        {/* Stats rapides */}
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
              icon="◎"
              title="Authentification biométrique"
              subtitle={
                biometricAvailable
                  ? "Face ID / Touch ID"
                  : "Non disponible sur cet appareil"
              }
              right={
                <Toggle
                  value={biometricEnabled}
                  onToggle={() => toggleBiometric(!biometricEnabled)}
                  disabled={!biometricAvailable}
                />
              }
            />
            <View style={styles.sep} />
            <SettingRow
              icon="◈"
              title="Changer le PIN"
              subtitle="Modifier le code PIN de sécurité"
              onPress={() => setPinModalVisible(true)}
            />
          </View>
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
        <Animated.View
          style={[exportModalStyles.overlay, { opacity: modalOpacity }]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeExportModal}
          />
          <Animated.View
            style={[
              exportModalStyles.sheet,
              {
                transform: [{ translateY: modalSlide }],
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={exportModalStyles.handle} />
            <View style={exportModalStyles.header}>
              <Text style={exportModalStyles.title}>Exporter les données</Text>
              <TouchableOpacity onPress={closeExportModal}>
                <View style={exportModalStyles.closeIcon}>
                  <Text style={exportModalStyles.closeIconText}>✕</Text>
                </View>
              </TouchableOpacity>
            </View>
            <Text style={exportModalStyles.body}>
              Les règles, profils et statistiques seront exportés au format
              JSON. Vous pourrez partager ce fichier ou le sauvegarder
              localement.
            </Text>
            <TouchableOpacity
              style={exportModalStyles.exportBtn}
              onPress={handleExport}
              activeOpacity={0.85}
            >
              <Text style={exportModalStyles.exportBtnIcon}>↑</Text>
              <Text style={exportModalStyles.exportBtnText}>
                Exporter et partager
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={exportModalStyles.cancelBtn}
              onPress={closeExportModal}
              activeOpacity={0.8}
            >
              <Text style={exportModalStyles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Confirm Clear Modal */}
      <Modal
        visible={confirmClearVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmClearVisible(false)}
      >
        <View style={confirmStyles.overlay}>
          <View style={confirmStyles.container}>
            <Text style={confirmStyles.icon}>⚠️</Text>
            <Text style={confirmStyles.title}>
              Effacer toutes les données ?
            </Text>
            <Text style={confirmStyles.body}>
              Cette action supprimera définitivement toutes vos règles, profils
              et statistiques. Elle est irréversible.
            </Text>
            <TouchableOpacity
              style={confirmStyles.dangerBtn}
              onPress={() => {
                setConfirmClearVisible(false);
                clearAllData();
              }}
              activeOpacity={0.85}
            >
              <Text style={confirmStyles.dangerBtnText}>Oui, tout effacer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={confirmStyles.cancelBtn}
              onPress={() => setConfirmClearVisible(false)}
            >
              <Text style={confirmStyles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN Change Modal */}
      <PinChangeModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
      />

      {/* Import Modal */}
      <ImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImported={loadAll}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
});

const exportModalStyles = StyleSheet.create({
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
  exportBtnText: {
    color: "#F0F0FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
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

const confirmStyles = StyleSheet.create({
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

const pinModal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#080810", justifyContent: "center" },
  container: { alignItems: "center", paddingHorizontal: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 24,
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
  steps: { flexDirection: "row", gap: 8, marginBottom: 20 },
  step: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "#1C1C2C" },
  stepActive: { backgroundColor: "#7B6EF6" },
  stepDone: { backgroundColor: "#3DDB8A" },
  subtitle: {
    fontSize: 14,
    color: "#3A3A58",
    marginBottom: 32,
    textAlign: "center",
  },
  dots: { flexDirection: "row", gap: 14, marginBottom: 40 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotEmpty: {
    backgroundColor: "#1C1C2C",
    borderWidth: 1,
    borderColor: "#2A2A42",
  },
  dotFilled: { backgroundColor: "#7B6EF6" },
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    justifyContent: "center",
    marginBottom: 24,
  },
  padBtn: {
    width: 88,
    height: 72,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    margin: 3,
  },
  padBtnText: { fontSize: 26, fontWeight: "600", color: "#F0F0FF" },
  padBtnSub: {
    fontSize: 8,
    color: "#3A3A58",
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  padDelete: { fontSize: 22, color: "#3A3A58" },
  nextBtn: {
    width: 280,
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  nextBtnDisabled: { backgroundColor: "#7B6EF620" },
  nextBtnText: { color: "#F0F0FF", fontSize: 16, fontWeight: "800" },
});

const importModal = StyleSheet.create({
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
  importBtnDisabled: { backgroundColor: "#7B6EF620" },
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
