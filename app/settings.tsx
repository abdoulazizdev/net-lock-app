import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Share,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg: "#07070C",
  surface: "#0E0E17",
  surfaceHigh: "#14141F",
  border: "#1A1A28",
  borderSubtle: "#12121C",
  accent: "#7B6EF6", // violet doux
  accentGlow: "#7B6EF620",
  accentDim: "#7B6EF640",
  success: "#4EFFC0",
  successGlow: "#4EFFC015",
  danger: "#FF5E7A",
  dangerGlow: "#FF5E7A15",
  textPrimary: "#F0EFF8",
  textSecondary: "#5A5870",
  textMuted: "#2E2D40",
  white: "#FFFFFF",
};

// ─── Animated Toggle ─────────────────────────────────────────────────────────
const Toggle = ({
  value,
  onToggle,
  disabled,
}: {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      tension: 180,
      friction: 18,
    }).start();
  }, [value]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20],
  });
  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.accent],
  });

  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          tog.track,
          { backgroundColor: trackColor },
          disabled && { opacity: 0.25 },
        ]}
      >
        <Animated.View style={[tog.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const tog = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.white,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});

// ─── Section Label ────────────────────────────────────────────────────────────
const Section = ({ label }: { label: string }) => (
  <View style={styles.sectionRow}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={styles.sectionLine} />
  </View>
);

// ─── Setting Row ──────────────────────────────────────────────────────────────
const SettingRow = ({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
  isLast,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  isLast?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    onPress &&
    Animated.spring(scale, {
      toValue: 0.975,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();

  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={onPress ? 0.9 : 1}
        disabled={!onPress && !right}
      >
        <Animated.View style={[styles.rowInner, { transform: [{ scale }] }]}>
          {/* Icon pill */}
          <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>

          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, danger && { color: C.danger }]}>
              {title}
            </Text>
            {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
          </View>

          {right ??
            (onPress && (
              <View style={styles.chevronWrap}>
                <Text style={styles.chevron}>›</Text>
              </View>
            ))}
        </Animated.View>
      </TouchableOpacity>
      {!isLast && <View style={styles.rowSep} />}
    </>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [vpnStatus, setVpnStatus] = useState({
    isActive: false,
    isNative: false,
    platform: "",
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadSettings();
    checkBiometric();
    loadVpnStatus();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadSettings = async () => {
    const config = await StorageService.getAuthConfig();
    setBiometricEnabled(config.isBiometricEnabled);
  };

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
  };

  const loadVpnStatus = async () => {
    const status = VpnService.getStatus();
    const isActive = await VpnService.isVpnActive();
    setVpnStatus({ ...status, isActive });
  };

  const toggleBiometric = async (value: boolean) => {
    try {
      if (value) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirmer l'activation de la biométrie",
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
      Alert.alert(
        "Erreur",
        "Impossible de modifier les paramètres biométriques",
      );
    }
  };

  const handleExport = async () => {
    try {
      const jsonData = await StorageService.exportData();
      await Share.share({
        message: jsonData,
        title: "Export des règles NetLock",
      });
      setExportDialogVisible(false);
    } catch {
      Alert.alert("Erreur", "Impossible d'exporter les données");
    }
  };

  const clearAllData = () => {
    Alert.alert(
      "Effacer toutes les données ?",
      "Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: async () => {
            await StorageService.clearStats();
            Alert.alert("Succès", "Données effacées");
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={styles.headerEyebrow}>NetLock</Text>
        <Text style={styles.headerTitle}>Paramètres</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
      >
        {/* VPN Status Card */}
        <TouchableOpacity
          style={[
            styles.vpnCard,
            vpnStatus.isActive ? styles.vpnCardOn : styles.vpnCardOff,
          ]}
          onPress={async () => {
            if (vpnStatus.isActive) await VpnService.stopVpn();
            else await VpnService.startVpn();
            await loadVpnStatus();
          }}
          activeOpacity={0.85}
        >
          {/* Status dot */}
          <View
            style={[
              styles.vpnDot,
              vpnStatus.isActive ? styles.vpnDotOn : styles.vpnDotOff,
            ]}
          />

          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.vpnTitle,
                { color: vpnStatus.isActive ? C.success : C.danger },
              ]}
            >
              {vpnStatus.isActive ? "Protection active" : "Non protégé"}
            </Text>
            <Text style={styles.vpnMeta}>
              {vpnStatus.isNative ? "Mode natif" : "Mode simulation"} ·{" "}
              {vpnStatus.platform}
            </Text>
          </View>

          <View
            style={[
              styles.vpnPill,
              vpnStatus.isActive ? styles.vpnPillOn : styles.vpnPillOff,
            ]}
          >
            <Text
              style={[
                styles.vpnPillText,
                { color: vpnStatus.isActive ? C.success : C.danger },
              ]}
            >
              {vpnStatus.isActive ? "ON" : "OFF"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Sécurité */}
        <Section label="Sécurité" />
        <View style={styles.card}>
          <SettingRow
            icon="⊙"
            title="Authentification biométrique"
            subtitle={
              biometricAvailable ? "Face ID / Touch ID" : "Non disponible"
            }
            right={
              <Toggle
                value={biometricEnabled}
                onToggle={() => toggleBiometric(!biometricEnabled)}
                disabled={!biometricAvailable}
              />
            }
          />
          <SettingRow
            icon="◈"
            title="Changer le PIN"
            subtitle="Modifier le code de sécurité"
            onPress={() => Alert.alert("Info", "Fonctionnalité à implémenter")}
            isLast
          />
        </View>

        {/* Données */}
        <Section label="Données" />
        <View style={styles.card}>
          <SettingRow
            icon="↑"
            title="Exporter les règles"
            subtitle="Sauvegarder règles et profils"
            onPress={() => setExportDialogVisible(true)}
          />
          <SettingRow
            icon="↓"
            title="Importer les règles"
            subtitle="Restaurer des règles sauvegardées"
            onPress={() =>
              Alert.alert("Import", "Fonctionnalité à implémenter")
            }
          />
          <SettingRow
            icon="⊘"
            title="Effacer toutes les données"
            subtitle="Supprimer règles, profils et statistiques"
            onPress={clearAllData}
            danger
            isLast
          />
        </View>

        {/* À propos */}
        <Section label="À propos" />
        <View style={styles.card}>
          <SettingRow icon="◎" title="Version" subtitle="1.0.0 — NetLock" />
          <SettingRow
            icon="☰"
            title="Documentation"
            subtitle="Guide d'utilisation et FAQ"
            onPress={() =>
              Alert.alert("Info", "Consultez le README.md du projet")
            }
            isLast
          />
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Export Modal */}
      <Modal
        visible={exportDialogVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExportDialogVisible(false)}
      >
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            {/* Handle */}
            <View style={modal.handle} />

            <Text style={modal.title}>Exporter les données</Text>
            <Text style={modal.body}>
              Les règles, profils et statistiques seront exportés au format
              JSON. Partagez ce fichier ou sauvegardez-le localement.
            </Text>

            <TouchableOpacity
              style={modal.primaryBtn}
              onPress={handleExport}
              activeOpacity={0.85}
            >
              <Text style={modal.primaryBtnText}>Exporter et partager</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={modal.ghostBtn}
              onPress={() => setExportDialogVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={modal.ghostBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    color: C.accent,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "300",
    color: C.textPrimary,
    letterSpacing: -0.5,
  },

  scroll: { paddingHorizontal: 20 },

  // Section
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginRight: 12,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    overflow: "hidden",
  },

  // Row
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.borderSubtle,
    marginLeft: 62,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: C.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  iconWrapDanger: {
    backgroundColor: "#FF5E7A0A",
    borderColor: "#FF5E7A25",
  },
  iconText: {
    fontSize: 14,
    color: C.textSecondary,
  },
  rowContent: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: C.textPrimary,
    letterSpacing: 0.1,
  },
  rowSub: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  chevronWrap: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    color: C.textMuted,
    fontSize: 18,
  },

  // VPN Card
  vpnCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    position: "relative",
    overflow: "hidden",
  },
  vpnCardOn: {
    backgroundColor: C.successGlow,
    borderColor: "#4EFFC030",
  },
  vpnCardOff: {
    backgroundColor: C.dangerGlow,
    borderColor: "#FF5E7A30",
  },
  vpnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  vpnDotOn: { backgroundColor: C.success },
  vpnDotOff: { backgroundColor: C.danger },
  vpnTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.1,
    marginBottom: 3,
  },
  vpnMeta: {
    fontSize: 11,
    color: C.textSecondary,
    letterSpacing: 0.2,
  },
  vpnPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  vpnPillOn: { backgroundColor: "#4EFFC010", borderColor: "#4EFFC035" },
  vpnPillOff: { backgroundColor: "#FF5E7A10", borderColor: "#FF5E7A35" },
  vpnPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "300",
    color: C.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  body: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
    letterSpacing: 0.1,
  },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  ghostBtn: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  ghostBtnText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});
