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

type AuthScreenProps = {
  onAuthenticated?: () => void;
};

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"pin" | "confirm">("pin");
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAuthSetup();
    checkBiometric();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const navigate = () => {
    if (onAuthenticated) {
      onAuthenticated();
    } else {
      router.replace("/(tabs)");
    }
  };

  const checkAuthSetup = async () => {
    const config = await StorageService.getAuthConfig();
    setIsFirstTime(!config.isPinEnabled);
  };

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
  };

  const shake = () => {
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
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authentification requise",
        fallbackLabel: "Utiliser le PIN",
      });
      if (result.success) navigate();
    } catch {
      Alert.alert("Erreur", "Échec de l'authentification biométrique");
    }
  };

  const handlePinPress = (digit: string) => {
    const current = step === "pin" ? pin : confirmPin;
    if (current.length >= 6) return;
    if (step === "pin") setPin(pin + digit);
    else setConfirmPin(confirmPin + digit);
  };

  const handleDelete = () => {
    if (step === "pin") setPin(pin.slice(0, -1));
    else setConfirmPin(confirmPin.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (loading) return;
    const currentPin = step === "pin" ? pin : confirmPin;
    if (currentPin.length < 4) {
      shake();
      return;
    }

    if (isFirstTime) {
      if (step === "pin") {
        setStep("confirm");
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
      if (isValid) {
        navigate();
      } else {
        shake();
        setPin("");
        Alert.alert("PIN incorrect", "Veuillez réessayer");
      }
    }
  };

  const currentPin = step === "pin" ? pin : confirmPin;

  const PinDots = () => (
    <View style={styles.dotsRow}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < currentPin.length ? styles.dotFilled : styles.dotEmpty,
          ]}
        />
      ))}
    </View>
  );

  const PadButton = ({ digit, sub }: { digit: string; sub?: string }) => (
    <TouchableOpacity
      style={styles.padBtn}
      onPress={() => handlePinPress(digit)}
      activeOpacity={0.6}
    >
      <Text style={styles.padBtnText}>{digit}</Text>
      {sub && <Text style={styles.padBtnSub}>{sub}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>🛡️</Text>
          <Text style={styles.logoTitle}>NetLock</Text>
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

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <PinDots />
        </Animated.View>

        <View style={styles.pad}>
          {[
            ["1", ""],
            ["2", "ABC"],
            ["3", "DEF"],
          ].map(([d, s]) => (
            <PadButton key={d} digit={d} sub={s} />
          ))}
          {[
            ["4", "GHI"],
            ["5", "JKL"],
            ["6", "MNO"],
          ].map(([d, s]) => (
            <PadButton key={d} digit={d} sub={s} />
          ))}
          {[
            ["7", "PQRS"],
            ["8", "TUV"],
            ["9", "WXYZ"],
          ].map(([d, s]) => (
            <PadButton key={d} digit={d} sub={s} />
          ))}
          <View style={styles.padBtn} />
          <PadButton digit="0" />
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

        {!isFirstTime && biometricAvailable && (
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometricAuth}
            activeOpacity={0.8}
          >
            <Text style={styles.biometricIcon}>👆</Text>
            <Text style={styles.biometricText}>Biométrie</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F", justifyContent: "center" },
  content: { alignItems: "center", paddingHorizontal: 32 },
  logo: { alignItems: "center", marginBottom: 40 },
  logoIcon: { fontSize: 48, marginBottom: 8 },
  logoTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 36,
    textAlign: "center",
  },
  dotsRow: { flexDirection: "row", gap: 14, marginBottom: 48 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotEmpty: {
    backgroundColor: "#1E1E2E",
    borderWidth: 1,
    borderColor: "#2E2E3E",
  },
  dotFilled: { backgroundColor: "#00F5A0" },
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    justifyContent: "center",
    marginBottom: 24,
  },
  padBtn: {
    width: 88,
    height: 78,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    margin: 4,
  },
  padBtnText: { fontSize: 26, fontWeight: "600", color: "#FFFFFF" },
  padBtnSub: {
    fontSize: 9,
    color: "#444",
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  padDeleteText: { fontSize: 22, color: "#555" },
  submitBtn: {
    width: 280,
    backgroundColor: "#00F5A0",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: "#00F5A030" },
  submitBtnText: { color: "#0A0A0F", fontSize: 16, fontWeight: "800" },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  biometricIcon: { fontSize: 20 },
  biometricText: { color: "#555", fontSize: 14, fontWeight: "600" },
});
