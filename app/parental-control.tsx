import ParentalControlService, {
    ParentalSettings,
} from "@/services/parental-control.service";
import { Colors, useTheme } from "@/theme";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function Toggle({ value, onPress }: { value: boolean; onPress: () => void }) {
  const { t } = useTheme();
  const pos = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(pos, {
      toValue: value ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [value]);
  const bg = pos.interpolate({
    inputRange: [0, 1],
    outputRange: [t.bg.cardSunken, Colors.blue[500]],
  });
  const thumbX = pos.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View
        style={{
          width: 46,
          height: 26,
          borderRadius: 13,
          backgroundColor: bg,
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: "#fff",
            transform: [{ translateX: thumbX }],
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

function SettingRow({
  icon,
  title,
  sub,
  right,
  onPress,
  danger = false,
}: {
  icon: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { t } = useTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[pc.settingRow, { borderBottomColor: t.border.light }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={pc.settingIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            pc.settingTitle,
            { color: danger ? t.danger.text : t.text.primary },
          ]}
        >
          {title}
        </Text>
        {sub && (
          <Text style={[pc.settingSub, { color: t.text.muted }]}>{sub}</Text>
        )}
      </View>
      {right}
    </Wrapper>
  );
}

export default function ParentalControlScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [settings, setSettings] = useState<ParentalSettings | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep, setPinStep] = useState<"enter" | "confirm" | "done">("enter");
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [disablePin, setDisablePin] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [s, enabled, pin] = await Promise.all([
      ParentalControlService.getSettings(),
      ParentalControlService.isParentalEnabled(),
      ParentalControlService.hasPin(),
    ]);
    setSettings(s);
    setIsEnabled(enabled);
    setHasPin(pin);
  };

  const handleSetPin = async () => {
    if (pinInput.length < 4) {
      Alert.alert("PIN trop court", "Minimum 4 chiffres.");
      return;
    }
    if (pinStep === "enter") {
      setPinStep("confirm");
      return;
    }
    if (pinInput !== confirmPin) {
      Alert.alert("PINs différents", "Les deux PINs ne correspondent pas.");
      setPinInput("");
      setConfirmPin("");
      setPinStep("enter");
      return;
    }
    setSaving(true);
    try {
      await ParentalControlService.setParentalPin(pinInput);
      if (settings) {
        const updated = { ...settings, enabled: true };
        await ParentalControlService.saveSettings(updated);
        setSettings(updated);
      }
      setIsEnabled(true);
      setHasPin(true);
      setShowPinSetup(false);
      setPinInput("");
      setConfirmPin("");
      setPinStep("enter");
      Alert.alert(
        "✅ Contrôle parental activé",
        "Un PIN est maintenant requis pour modifier les paramètres NetOff.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (disablePin.length < 4) {
      Alert.alert("PIN incorrect");
      return;
    }
    setSaving(true);
    try {
      await ParentalControlService.disableParental(disablePin);
      setIsEnabled(false);
      setHasPin(false);
      setShowDisable(false);
      setDisablePin("");
      Alert.alert("Contrôle parental désactivé.");
    } catch {
      Alert.alert("PIN incorrect", "Le PIN saisi est incorrect.");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = async (key: keyof ParentalSettings, value: any) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await ParentalControlService.saveSettings(updated);
  };

  return (
    <View style={[pc.container, { backgroundColor: t.bg.page }]}>
      <StatusBar barStyle="light-content" />
      <View style={[pc.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={pc.backBtn}
          activeOpacity={0.7}
        >
          <Text style={pc.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={pc.headerTitle}>Contrôle parental</Text>
        <Text style={[pc.headerSub, { color: Colors.blue[200] }]}>
          Protéger les enfants sur cet appareil
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          pc.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Statut */}
        <View
          style={[
            pc.statusCard,
            {
              backgroundColor: isEnabled ? Colors.green[50] : t.bg.card,
              borderColor: isEnabled ? Colors.green[100] : t.border.light,
            },
          ]}
        >
          <View
            style={[
              pc.statusDot,
              {
                backgroundColor: isEnabled
                  ? Colors.green[400]
                  : t.border.normal,
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                pc.statusTitle,
                { color: isEnabled ? Colors.green[600] : t.text.primary },
              ]}
            >
              {isEnabled
                ? "Contrôle parental ACTIF"
                : "Contrôle parental désactivé"}
            </Text>
            <Text style={[pc.statusSub, { color: t.text.muted }]}>
              {isEnabled
                ? "Un PIN est requis pour modifier les règles de blocage."
                : "Activez pour verrouiller les paramètres NetOff avec un PIN parent."}
            </Text>
          </View>
        </View>

        {/* PIN setup / désactivation */}
        {!isEnabled ? (
          <View
            style={[
              pc.card,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <Text style={[pc.cardTitle, { color: t.text.primary }]}>
              🔑 Définir un PIN parent
            </Text>
            <Text style={[pc.cardSub, { color: t.text.muted }]}>
              Ce PIN sera requis pour désactiver le blocage ou modifier les
              règles. Choisissez-en un que votre enfant ne connaît pas.
            </Text>
            {!showPinSetup ? (
              <TouchableOpacity
                style={[pc.actionBtn, { backgroundColor: Colors.blue[600] }]}
                onPress={() => setShowPinSetup(true)}
                activeOpacity={0.85}
              >
                <Text style={pc.actionBtnText}>
                  Activer le contrôle parental
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={[pc.pinLabel, { color: t.text.muted }]}>
                  {pinStep === "enter"
                    ? "ENTREZ UN PIN (4-6 chiffres)"
                    : "CONFIRMEZ LE PIN"}
                </Text>
                <TextInput
                  style={[
                    pc.pinInput,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                      color: t.text.primary,
                    },
                  ]}
                  value={pinStep === "enter" ? pinInput : confirmPin}
                  onChangeText={
                    pinStep === "enter" ? setPinInput : setConfirmPin
                  }
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder={
                    pinStep === "enter" ? "Ex: 1234" : "Répétez le PIN"
                  }
                  placeholderTextColor={t.text.muted}
                />
                <TouchableOpacity
                  style={[
                    pc.actionBtn,
                    { backgroundColor: Colors.blue[600] },
                    saving && { opacity: 0.5 },
                  ]}
                  onPress={handleSetPin}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Text style={pc.actionBtnText}>
                    {pinStep === "enter"
                      ? "Suivant →"
                      : saving
                        ? "Activation…"
                        : "Activer"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowPinSetup(false);
                    setPinStep("enter");
                    setPinInput("");
                    setConfirmPin("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[pc.cancelText, { color: t.text.muted }]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View
            style={[
              pc.card,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <Text style={[pc.cardTitle, { color: t.text.primary }]}>
              🔓 Désactiver le contrôle parental
            </Text>
            {!showDisable ? (
              <TouchableOpacity
                style={[
                  pc.actionBtn,
                  {
                    backgroundColor: t.danger.bg,
                    borderWidth: 1,
                    borderColor: t.danger.border,
                  },
                ]}
                onPress={() => setShowDisable(true)}
                activeOpacity={0.85}
              >
                <Text style={[pc.actionBtnText, { color: t.danger.text }]}>
                  Saisir le PIN parent pour désactiver
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={[
                    pc.pinInput,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                      color: t.text.primary,
                    },
                  ]}
                  value={disablePin}
                  onChangeText={setDisablePin}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder="PIN parent"
                  placeholderTextColor={t.text.muted}
                />
                <TouchableOpacity
                  style={[
                    pc.actionBtn,
                    {
                      backgroundColor: t.danger.bg,
                      borderWidth: 1,
                      borderColor: t.danger.border,
                    },
                  ]}
                  onPress={handleDisable}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Text style={[pc.actionBtnText, { color: t.danger.text }]}>
                    Désactiver
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Paramètres (si activé) */}
        {isEnabled && settings && (
          <>
            <Text style={[pc.sectionLabel, { color: t.text.muted }]}>
              PARAMÈTRES
            </Text>
            <View
              style={[
                pc.settingsCard,
                { backgroundColor: t.bg.card, borderColor: t.border.light },
              ]}
            >
              <SettingRow
                icon="🌙"
                title="Blocage au coucher"
                sub={`Bloquer après ${settings.bedtimeHour}h jusqu'à ${settings.wakeHour}h`}
                right={
                  <Toggle
                    value={settings.blockAtBedtime}
                    onPress={() =>
                      updateSetting("blockAtBedtime", !settings.blockAtBedtime)
                    }
                  />
                }
              />
              <SettingRow
                icon="⏱"
                title="Temps d'écran quotidien"
                sub={
                  settings.maxDailyMinutes === 0
                    ? "Illimité"
                    : `Maximum ${settings.maxDailyMinutes} min/jour`
                }
                onPress={() =>
                  Alert.prompt("Temps max (minutes)", "0 = illimité", (val) => {
                    const n = parseInt(val ?? "0", 10);
                    if (!isNaN(n)) updateSetting("maxDailyMinutes", n);
                  })
                }
              />
              <SettingRow
                icon="📱"
                title="Limiter à certaines apps"
                sub="Mode liste blanche — tout bloquer sauf les apps autorisées"
                onPress={() =>
                  Alert.alert(
                    "Bientôt",
                    "La gestion des apps autorisées sera disponible dans la prochaine version.",
                  )
                }
              />
            </View>

            <View
              style={[
                pc.infoBox,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={pc.infoIcon}>ℹ</Text>
              <Text style={[pc.infoText, { color: t.text.muted }]}>
                Le contrôle parental verrouille les paramètres de NetOff. Pour
                modifier les règles de blocage, le PIN parent sera requis.
                Gardez-le en lieu sûr.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const pc = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 20,
    backgroundColor: Colors.blue[600],
  },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  headerSub: { fontSize: 12 },
  scroll: { paddingHorizontal: 18, paddingTop: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 16,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  statusSub: { fontSize: 12, lineHeight: 18 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    gap: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSub: { fontSize: 13, lineHeight: 20 },
  pinLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  pinInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 18,
    letterSpacing: 8,
    textAlign: "center",
  },
  actionBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  actionBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  cancelText: { fontSize: 13, textAlign: "center" },
  settingsCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderBottomWidth: 1,
  },
  settingIcon: { fontSize: 18, width: 26, textAlign: "center" },
  settingTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  settingSub: { fontSize: 12 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  infoIcon: { fontSize: 14, color: "#7B6EF6" },
  infoText: { fontSize: 12, lineHeight: 18, flex: 1 },
});
