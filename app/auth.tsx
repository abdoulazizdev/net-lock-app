import StorageService from "@/services/storage.service";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

type Mode = "pin" | "bio" | "both";

// ✅ Props typées
type Props = {
  onAuthenticated?: () => void;
};

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("pin");
  const [step, setStep] = useState<"pin" | "confirm">("pin");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biométrie");
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
    const hasHW = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const bioOk = hasHW && enrolled;
    setBioAvailable(bioOk);

    if (bioOk) {
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (
        types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        )
      )
        setBioLabel("Face ID");
      else if (
        types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      )
        setBioLabel("Empreinte");
      else setBioLabel("PIN téléphone");
    }

    const pinOn = config.isPinEnabled;
    const bioOn = config.isBiometricEnabled && bioOk;

    if (!pinOn && !bioOn) {
      setIsFirstTime(true);
      setMode("pin");
      return;
    }

    if (pinOn && bioOn) setMode("both");
    else if (bioOn) setMode("bio");
    else setMode("pin");

    if (bioOn) setTimeout(() => triggerBio(), 400);
  };

  // ✅ navigate utilise onAuthenticated si dispo, sinon router
  const navigate = () => {
    if (onAuthenticated) {
      onAuthenticated();
    } else {
      router.replace("/(tabs)");
    }
  };

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

  const triggerBio = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Déverrouiller NetOff",
        fallbackLabel:
          mode === "both"
            ? "Utiliser le PIN applicatif"
            : "Utiliser le PIN du téléphone",
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
      const valid = await StorageService.verifyPin(pin);
      setLoading(false);
      if (valid) navigate();
      else {
        shake();
        setPin("");
        Alert.alert("PIN incorrect", "Veuillez réessayer");
      }
    }
  };

  const showPad = mode === "pin" || mode === "both" || isFirstTime;
  const showBioButton =
    (mode === "bio" || mode === "both") && bioAvailable && !isFirstTime;

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />
      <Animated.View style={[st.content, { opacity: fadeAnim }]}>
        <View style={st.logo}>
          <View style={st.logoWrap}>
            <Image
              source={require("@/assets/images/netoff-logo.png")}
              style={st.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={st.logoTitle}>NetOff</Text>
        </View>

        <Text style={st.title}>
          {isFirstTime
            ? step === "pin"
              ? "Créer votre PIN"
              : "Confirmer le PIN"
            : "Déverrouiller"}
        </Text>
        <Text style={st.subtitle}>
          {isFirstTime
            ? step === "pin"
              ? "Choisissez un PIN de 4 à 6 chiffres"
              : "Saisissez à nouveau votre PIN"
            : mode === "bio"
              ? `Utilisez votre ${bioLabel} pour accéder à l'app`
              : mode === "both"
                ? `PIN applicatif ou ${bioLabel}`
                : "Entrez votre code PIN applicatif"}
        </Text>

        {isFirstTime && (
          <View style={st.steps}>
            <View
              style={[st.step, step === "pin" ? st.stepActive : st.stepDone]}
            />
            <View
              style={[
                st.step,
                step === "confirm" ? st.stepActive : st.stepInactive,
              ]}
            />
          </View>
        )}

        {mode === "bio" && !isFirstTime && (
          <TouchableOpacity
            style={st.bioBigBtn}
            onPress={triggerBio}
            activeOpacity={0.8}
          >
            <Text style={st.bioBigIcon}>👆</Text>
            <Text style={st.bioBigLabel}>Appuyer pour {bioLabel}</Text>
          </TouchableOpacity>
        )}

        {showPad && (
          <>
            <Animated.View
              style={[st.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
            >
              {showPin ? (
                <Text style={st.pinText}>{currentPin || "·  ·  ·  ·"}</Text>
              ) : (
                [0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    style={[
                      st.dot,
                      i < currentPin.length ? st.dotFilled : st.dotEmpty,
                    ]}
                  />
                ))
              )}
            </Animated.View>
            <TouchableOpacity
              style={st.eyeBtn}
              onPress={() => setShowPin((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={st.eyeText}>
                {showPin ? "🙈  Masquer" : "👁  Voir le code"}
              </Text>
            </TouchableOpacity>
            <View style={st.pad}>
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
                  style={st.padBtn}
                  onPress={() => handleDigit(d)}
                  activeOpacity={0.6}
                >
                  <Text style={st.padBtnText}>{d}</Text>
                  {sub ? <Text style={st.padBtnSub}>{sub}</Text> : null}
                </TouchableOpacity>
              ))}
              <View style={st.padBtn} />
              <TouchableOpacity
                style={st.padBtn}
                onPress={() => handleDigit("0")}
                activeOpacity={0.6}
              >
                <Text style={st.padBtnText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.padBtn}
                onPress={handleDelete}
                activeOpacity={0.6}
              >
                <Text style={st.padDeleteText}>⌫</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[st.submitBtn, currentPin.length < 4 && st.submitBtnOff]}
              onPress={handleSubmit}
              disabled={loading || currentPin.length < 4}
              activeOpacity={0.8}
            >
              <Text style={st.submitBtnText}>
                {loading
                  ? "..."
                  : isFirstTime
                    ? step === "pin"
                      ? "Suivant →"
                      : "Créer le PIN"
                    : "Déverrouiller"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {showBioButton && mode === "both" && (
          <TouchableOpacity
            style={st.bioSecondaryBtn}
            onPress={triggerBio}
            activeOpacity={0.8}
          >
            <Text style={st.bioSecondaryIcon}>👆</Text>
            <Text style={st.bioSecondaryText}>Utiliser {bioLabel}</Text>
          </TouchableOpacity>
        )}

        {showBioButton && mode === "bio" && (
          <TouchableOpacity
            style={st.bioRetryBtn}
            onPress={triggerBio}
            activeOpacity={0.8}
          >
            <Text style={st.bioRetryText}>Réessayer</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810", justifyContent: "center" },
  content: { alignItems: "center", paddingHorizontal: 32 },
  logo: { alignItems: "center", marginBottom: 28 },
  logoWrap: {
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
  logoImg: { width: 42, height: 42 },
  logoEmoji: { fontSize: 34 },
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
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },
  steps: { flexDirection: "row", gap: 8, marginBottom: 20, width: 120 },
  step: { flex: 1, height: 3, borderRadius: 2 },
  stepActive: { backgroundColor: "#7B6EF6" },
  stepDone: { backgroundColor: "#3DDB8A" },
  stepInactive: { backgroundColor: "#1C1C2C" },
  bioBigBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#16103A",
    borderWidth: 2,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 32,
  },
  bioBigIcon: { fontSize: 52, marginBottom: 8 },
  bioBigLabel: {
    fontSize: 11,
    color: "#7B6EF6",
    fontWeight: "700",
    textAlign: "center",
  },
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
  eyeBtn: { paddingVertical: 8, paddingHorizontal: 16, marginBottom: 20 },
  eyeText: { fontSize: 12, color: "#3A3A58", fontWeight: "600" },
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    justifyContent: "center",
    marginBottom: 16,
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
    marginBottom: 12,
  },
  submitBtnOff: { backgroundColor: "#7B6EF620" },
  submitBtnText: { color: "#F0F0FF", fontSize: 16, fontWeight: "800" },
  bioSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    paddingHorizontal: 20,
    marginTop: 4,
  },
  bioSecondaryIcon: { fontSize: 18 },
  bioSecondaryText: { color: "#5A5A80", fontSize: 14, fontWeight: "600" },
  bioRetryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  bioRetryText: { color: "#5A5A80", fontSize: 14, fontWeight: "600" },
});
