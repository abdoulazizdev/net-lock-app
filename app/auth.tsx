import StorageService from "@/services/storage.service";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

export default function AuthScreen() {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"pin" | "confirm">("pin");
  const [showPin, setShowPin] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    init();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const init = async () => {
    const config = await StorageService.getAuthConfig();
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const bioAvail = hasHardware && isEnrolled;
    setIsFirstTime(!config.isPinEnabled && !config.isBiometricEnabled);
    setBiometricEnabled(config.isBiometricEnabled);
    setBiometricAvailable(bioAvail);
    if (config.isBiometricEnabled && bioAvail && config.isPinEnabled) {
      setTimeout(() => triggerBiometric(), 400);
    }
  };

  const navigate = () => router.replace("/(tabs)");

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();

  const triggerBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Déverrouiller NetOff",
        fallbackLabel: "Utiliser le PIN",
        cancelLabel: "Annuler",
      });
      if (result.success) navigate();
    } catch {}
  };

  const currentPin = step === "pin" ? pin : confirmPin;
  const setCurrentPin = (v: string) =>
    step === "pin" ? setPin(v) : setConfirmPin(v);

  const handleDigit = (d: string) => {
    if (currentPin.length < 6) setCurrentPin(currentPin + d);
  };
  const handleDelete = () => setCurrentPin(currentPin.slice(0, -1));

  const handleSubmit = async () => {
    if (loading) return;
    if (currentPin.length < 4) {
      shake();
      return;
    }

    if (isFirstTime) {
      if (step === "pin") {
        setStep("confirm");
        setShowPin(false);
        return;
      }
      if (pin !== confirmPin) {
        shake();
        setConfirmPin("");
        Alert.alert("Erreur", "Les PINs ne correspondent pas");
        return;
      }
      setLoading(true);
      await StorageService.savePin(pin);
      setLoading(false);
      navigate();
    } else {
      setLoading(true);
      const isValid = await StorageService.verifyPin(pin);
      setLoading(false);
      if (isValid) navigate();
      else {
        shake();
        setPin("");
        Alert.alert("PIN incorrect", "Veuillez réessayer");
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logo}>
          <View style={styles.logoIconWrap}>
            <Text style={styles.logoIconText}>🛡️</Text>
          </View>
          <Text style={styles.logoTitle}>NetOff</Text>
        </View>

        <Text style={styles.title}>
          {isFirstTime
            ? step === "pin"
              ? "Créer votre PIN"
              : "Confirmer le PIN"
            : "Déverrouiller"}
        </Text>
        <Text style={styles.subtitle}>
          {isFirstTime
            ? step === "pin"
              ? "Choisissez un PIN de 4 à 6 chiffres"
              : "Saisissez à nouveau votre PIN"
            : "Entrez votre code PIN"}
        </Text>

        {isFirstTime && (
          <View style={styles.steps}>
            <View
              style={[
                styles.step,
                step === "pin" ? styles.stepActive : styles.stepDone,
              ]}
            />
            <View
              style={[
                styles.step,
                step === "confirm" ? styles.stepActive : styles.stepInactive,
              ]}
            />
          </View>
        )}

        {/* Indicateur PIN */}
        <Animated.View
          style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {showPin ? (
            <Text style={styles.pinText}>{currentPin || "·  ·  ·  ·"}</Text>
          ) : (
            [0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < currentPin.length ? styles.dotFilled : styles.dotEmpty,
                ]}
              />
            ))
          )}
        </Animated.View>

        {/* Bouton afficher/masquer */}
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowPin((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.eyeText}>
            {showPin ? "🙈  Masquer" : "👁  Voir le code"}
          </Text>
        </TouchableOpacity>

        {/* Pavé numérique */}
        <View style={styles.pad}>
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
              style={styles.padBtn}
              onPress={() => handleDigit(d)}
              activeOpacity={0.6}
            >
              <Text style={styles.padBtnText}>{d}</Text>
              {s ? <Text style={styles.padBtnSub}>{s}</Text> : null}
            </TouchableOpacity>
          ))}
          <View style={styles.padBtn} />
          <TouchableOpacity
            style={styles.padBtn}
            onPress={() => handleDigit("0")}
            activeOpacity={0.6}
          >
            <Text style={styles.padBtnText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.padBtn}
            onPress={handleDelete}
            activeOpacity={0.6}
          >
            <Text style={styles.padDeleteText}>⌫</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            currentPin.length < 4 && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || currentPin.length < 4}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {loading
              ? "..."
              : isFirstTime
                ? step === "pin"
                  ? "Suivant →"
                  : "Créer le PIN"
                : "Déverrouiller"}
          </Text>
        </TouchableOpacity>

        {!isFirstTime && biometricEnabled && biometricAvailable && (
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={triggerBiometric}
            activeOpacity={0.8}
          >
            <Text style={styles.biometricIcon}>👆</Text>
            <Text style={styles.biometricText}>Utiliser la biométrie</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810", justifyContent: "center" },
  content: { alignItems: "center", paddingHorizontal: 32 },
  logo: { alignItems: "center", marginBottom: 32 },
  logoIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoIconText: { fontSize: 34 },
  logoTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#3A3A58",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
  steps: { flexDirection: "row", gap: 8, marginBottom: 20, width: 120 },
  step: { flex: 1, height: 3, borderRadius: 2 },
  stepActive: { backgroundColor: "#7B6EF6" },
  stepDone: { backgroundColor: "#3DDB8A" },
  stepInactive: { backgroundColor: "#1C1C2C" },
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
    backgroundColor: "#1E1E2E",
    borderWidth: 1,
    borderColor: "#2E2E3E",
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
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    justifyContent: "center",
    marginBottom: 20,
  },
  padBtn: {
    width: 88,
    height: 74,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    margin: 3,
  },
  padBtnText: { fontSize: 26, fontWeight: "600", color: "#F0F0FF" },
  padBtnSub: {
    fontSize: 9,
    color: "#3A3A58",
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  padDeleteText: { fontSize: 22, color: "#3A3A58" },
  submitBtn: {
    width: 280,
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: "#7B6EF620" },
  submitBtnText: { color: "#F0F0FF", fontSize: 16, fontWeight: "800" },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    paddingHorizontal: 20,
  },
  biometricIcon: { fontSize: 18 },
  biometricText: { color: "#5A5A80", fontSize: 14, fontWeight: "600" },
});
