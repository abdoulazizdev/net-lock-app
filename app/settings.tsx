import StorageService from "@/services/storage.service";
import VpnService from "@/services/vpn.service";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

export default function SettingsScreen() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [vpnStatus, setVpnStatus] = useState({
    isActive: false,
    isNative: false,
    platform: "",
  });

  useEffect(() => {
    loadSettings();
    checkBiometric();
    loadVpnStatus();
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

  const Section = ({ label }: { label: string }) => (
    <Text style={styles.sectionLabel}>{label}</Text>
  );

  const SettingRow = ({
    icon,
    title,
    subtitle,
    onPress,
    right,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    right?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <View style={styles.settingIcon}>
        <Text style={styles.settingIconText}>{icon}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {right && <View>{right}</View>}
      {onPress && !right && <Text style={styles.settingChevron}>›</Text>}
    </TouchableOpacity>
  );

  const Toggle = ({
    value,
    onToggle,
    disabled,
  }: {
    value: boolean;
    onToggle: () => void;
    disabled?: boolean;
  }) => (
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
        style={[
          styles.toggleThumb,
          value ? styles.toggleThumbOn : styles.toggleThumbOff,
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Paramètres</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* VPN Status Banner */}
        <TouchableOpacity
          style={[
            styles.vpnBanner,
            vpnStatus.isActive ? styles.vpnBannerOn : styles.vpnBannerOff,
          ]}
          onPress={async () => {
            if (vpnStatus.isActive) await VpnService.stopVpn();
            else await VpnService.startVpn();
            await loadVpnStatus();
          }}
          activeOpacity={0.8}
        >
          <View>
            <Text
              style={[
                styles.vpnBannerTitle,
                { color: vpnStatus.isActive ? "#00F5A0" : "#FF4D4D" },
              ]}
            >
              {vpnStatus.isActive ? "🛡️ VPN Actif" : "⚠️ VPN Inactif"}
            </Text>
            <Text style={styles.vpnBannerSub}>
              {vpnStatus.isNative
                ? "Mode natif (VPNService)"
                : "Mode simulation"}{" "}
              • {vpnStatus.platform}
            </Text>
          </View>
          <View
            style={[
              styles.vpnToggle,
              vpnStatus.isActive ? styles.vpnToggleOn : styles.vpnToggleOff,
            ]}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: vpnStatus.isActive ? "#00F5A0" : "#FF4D4D",
              }}
            >
              {vpnStatus.isActive ? "ON" : "OFF"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Sécurité */}
        <Section label="SÉCURITÉ" />
        <View style={styles.card}>
          <SettingRow
            icon="🔐"
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
          <View style={styles.separator} />
          <SettingRow
            icon="🔑"
            title="Changer le PIN"
            subtitle="Modifier le code PIN de sécurité"
            onPress={() => Alert.alert("Info", "Fonctionnalité à implémenter")}
          />
        </View>

        {/* Données */}
        <Section label="DONNÉES" />
        <View style={styles.card}>
          <SettingRow
            icon="📤"
            title="Exporter les règles"
            subtitle="Sauvegarder règles et profils"
            onPress={() => setExportDialogVisible(true)}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="📥"
            title="Importer les règles"
            subtitle="Restaurer des règles sauvegardées"
            onPress={() =>
              Alert.alert("Import", "Fonctionnalité à implémenter")
            }
          />
          <View style={styles.separator} />
          <SettingRow
            icon="🗑️"
            title="Effacer toutes les données"
            subtitle="Supprimer règles, profils et statistiques"
            onPress={clearAllData}
          />
        </View>

        {/* À propos */}
        <Section label="À PROPOS" />
        <View style={styles.card}>
          <SettingRow icon="📱" title="Version" subtitle="1.0.0" />
          <View style={styles.separator} />
          <SettingRow
            icon="📖"
            title="Documentation"
            subtitle="Guide d'utilisation et FAQ"
            onPress={() =>
              Alert.alert("Info", "Consultez le README.md du projet")
            }
          />
        </View>
      </ScrollView>

      {/* Export Modal */}
      <Modal
        visible={exportDialogVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExportDialogVisible(false)}
      >
        <View style={modal.overlay}>
          <View style={modal.container}>
            <View style={modal.header}>
              <Text style={modal.title}>Exporter les données</Text>
              <TouchableOpacity onPress={() => setExportDialogVisible(false)}>
                <Text style={modal.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={modal.body}>
              Les règles, profils et statistiques seront exportés au format
              JSON. Vous pourrez partager ce fichier ou le sauvegarder
              localement.
            </Text>
            <TouchableOpacity
              style={modal.exportBtn}
              onPress={handleExport}
              activeOpacity={0.8}
            >
              <Text style={modal.exportBtnText}>📤 Exporter et partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={modal.cancelBtn}
              onPress={() => setExportDialogVisible(false)}
            >
              <Text style={modal.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#16161E",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    marginBottom: 8,
    overflow: "hidden",
  },
  separator: { height: 1, backgroundColor: "#1E1E2E", marginLeft: 58 },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1E1E2E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  settingIconText: { fontSize: 16 },
  settingContent: { flex: 1 },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  settingSubtitle: { fontSize: 12, color: "#555" },
  settingChevron: { color: "#333", fontSize: 22, fontWeight: "300" },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    padding: 3,
  },
  toggleOn: {
    backgroundColor: "#00F5A020",
    borderWidth: 1,
    borderColor: "#00F5A0",
  },
  toggleOff: {
    backgroundColor: "#1E1E2E",
    borderWidth: 1,
    borderColor: "#2E2E3E",
  },
  toggleDisabled: { opacity: 0.3 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  toggleThumbOn: { backgroundColor: "#00F5A0", alignSelf: "flex-end" },
  toggleThumbOff: { backgroundColor: "#333", alignSelf: "flex-start" },
  vpnBanner: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
  vpnBannerOn: { backgroundColor: "#00F5A008", borderColor: "#00F5A030" },
  vpnBannerOff: { backgroundColor: "#FF4D4D08", borderColor: "#FF4D4D30" },
  vpnBannerTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  vpnBannerSub: { fontSize: 12, color: "#555" },
  vpnToggle: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  vpnToggleOn: { backgroundColor: "#00F5A015", borderColor: "#00F5A0" },
  vpnToggleOff: { backgroundColor: "#FF4D4D15", borderColor: "#FF4D4D" },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#16161E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1E1E2E",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  closeBtn: { color: "#555", fontSize: 18, padding: 4 },
  body: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 24 },
  exportBtn: {
    backgroundColor: "#00F5A0",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  exportBtnText: { color: "#0A0A0F", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    backgroundColor: "#1E1E2E",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: "#555", fontSize: 14, fontWeight: "600" },
});
