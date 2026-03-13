import { useAppInfo } from "@/hooks/useAppInfo";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Keyboard,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONTACT_EMAIL = "support@netoff.app";

const SUBJECTS = [
  { id: "bug", label: "🐛 Signaler un bug", color: "#D04070" },
  { id: "feature", label: "◈ Suggestion", color: "#7B6EF6" },
  { id: "question", label: "◎ Question générale", color: "#4D9FFF" },
  { id: "other", label: "◌ Autre", color: "#5A5A80" },
];

// ─── Stagger hook ─────────────────────────────────────────────────────────────
function useStagger(count: number, delay = 55) {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;
  useEffect(() => {
    Animated.stagger(
      delay,
      anims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, []);
  return anims;
}

function Section({
  anim,
  children,
}: {
  anim: Animated.Value;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ─── Focused input ────────────────────────────────────────────────────────────
function FocusInput({
  placeholder,
  value,
  onChangeText,
  multiline,
  style,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  style?: object;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1C1C2C", "#7B6EF6"],
  });

  return (
    <Animated.View style={[input.wrap, { borderColor }, style]}>
      <TextInput
        style={[input.field, multiline && input.fieldMulti]}
        placeholder={placeholder}
        placeholderTextColor="#2A2A42"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        returnKeyType={multiline ? "default" : "next"}
      />
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const appInfo = useAppInfo();
  const anims = useStagger(5, 55);

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const shiftAnim = useRef(new Animated.Value(0)).current;

  // Keyboard shift for the form area
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const dur = Platform.OS === "ios" ? 250 : 150;

    const s1 = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(shiftAnim, {
        toValue: -e.endCoordinates.height / 3,
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
    const s2 = Keyboard.addListener(hideEvent, () => {
      Animated.timing(shiftAnim, {
        toValue: 0,
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const canSend = selectedSubject !== null && message.trim().length >= 10;

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);

    const subject = SUBJECTS.find((s) => s.id === selectedSubject);
    const deviceLine = appInfo.loading
      ? ""
      : `\n\n---\nApp: ${appInfo.appName} ${appInfo.fullVersion}\nOS: ${appInfo.osName} ${appInfo.osVersion}\nAppareil: ${appInfo.deviceModel ?? "—"}`;

    const body = [
      name.trim() ? `De : ${name.trim()}` : "",
      email.trim() ? `Email : ${email.trim()}` : "",
      "",
      message.trim(),
      deviceLine,
    ]
      .filter((l) => l !== undefined)
      .join("\n");

    const mailUrl =
      `mailto:${CONTACT_EMAIL}` +
      `?subject=${encodeURIComponent(`[NetOff] ${subject?.label ?? ""}`.replace(/[🐛◈◎◌]/gu, "").trim())}` +
      `&body=${encodeURIComponent(body)}`;

    try {
      const supported = await Linking.canOpenURL(mailUrl);
      if (supported) {
        await Linking.openURL(mailUrl);
        // Reset after a short delay
        setTimeout(() => {
          setSelectedSubject(null);
          setName("");
          setEmail("");
          setMessage("");
          setSending(false);
        }, 800);
      } else {
        Alert.alert(
          "Aucune appli mail",
          `Contactez-nous directement à :\n${CONTACT_EMAIL}`,
          [
            {
              text: "Copier l'adresse",
              onPress: () => Linking.openURL(`mailto:${CONTACT_EMAIL}`),
            },
            { text: "OK", style: "cancel" },
          ],
        );
        setSending(false);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir le client mail.");
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact</Text>
        <Text style={styles.headerSubtitle}>On vous répond sous 48h</Text>
      </View>

      <Animated.View
        style={{ flex: 1, transform: [{ translateY: shiftAnim }] }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 60 },
          ]}
        >
          {/* ── Direct contact ─────────────────────────────────────────── */}
          <Section anim={anims[0]}>
            <TouchableOpacity
              style={styles.emailBanner}
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
              activeOpacity={0.75}
            >
              <View style={styles.emailIconWrap}>
                <Text style={styles.emailIcon}>◎</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emailLabel}>Email direct</Text>
                <Text style={styles.emailAddr}>{CONTACT_EMAIL}</Text>
              </View>
              <Text style={styles.emailArrow}>›</Text>
            </TouchableOpacity>
          </Section>

          {/* ── Subject ────────────────────────────────────────────────── */}
          <Section anim={anims[1]}>
            <Text style={styles.sectionLabel}>SUJET</Text>
            <View style={styles.subjectGrid}>
              {SUBJECTS.map((s) => {
                const active = selectedSubject === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.subjectChip,
                      active && {
                        borderColor: s.color + "80",
                        backgroundColor: s.color + "14",
                      },
                    ]}
                    onPress={() => setSelectedSubject(s.id)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.subjectChipText,
                        active && { color: s.color },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* ── Form ───────────────────────────────────────────────────── */}
          <Section anim={anims[2]}>
            <Text style={styles.sectionLabel}>VOTRE MESSAGE</Text>
            <View style={styles.formCard}>
              <FocusInput
                placeholder="Votre nom (optionnel)"
                value={name}
                onChangeText={setName}
              />
              <FocusInput
                placeholder="Votre email (optionnel)"
                value={email}
                onChangeText={setEmail}
                style={{ marginTop: 10 }}
              />
              <FocusInput
                placeholder="Décrivez votre demande… (minimum 10 caractères)"
                value={message}
                onChangeText={setMessage}
                multiline
                style={{ marginTop: 10 }}
              />
              {/* Character count */}
              <View style={styles.charRow}>
                <Text
                  style={[
                    styles.charCount,
                    message.length >= 10 && styles.charCountOk,
                  ]}
                >
                  {message.length} / 10 min
                </Text>
              </View>
            </View>
          </Section>

          {/* ── Device info preview ────────────────────────────────────── */}
          <Section anim={anims[3]}>
            <View style={styles.deviceInfoBanner}>
              <Text style={styles.deviceInfoIcon}>◈</Text>
              <Text style={styles.deviceInfoText}>
                Les infos de l'appareil (
                {appInfo.loading
                  ? "…"
                  : `${appInfo.appName} ${appInfo.fullVersion}, ${appInfo.osName} ${appInfo.osVersion}`}
                ) seront jointes automatiquement pour faciliter le diagnostic.
              </Text>
            </View>
          </Section>

          {/* ── Send button ────────────────────────────────────────────── */}
          <Section anim={anims[4]}>
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!canSend || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <Text style={styles.sendBtnText}>Ouverture du mail…</Text>
              ) : (
                <View style={styles.sendBtnInner}>
                  <Text style={styles.sendBtnText}>Envoyer</Text>
                  <Text style={styles.sendBtnArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>

            {!canSend && (
              <Text style={styles.sendHint}>
                {selectedSubject === null
                  ? "Choisissez un sujet pour continuer"
                  : "Le message doit faire au moins 10 caractères"}
              </Text>
            )}
          </Section>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  backBtn: { marginBottom: 12 },
  backText: { color: "#3DDB8A", fontSize: 14, fontWeight: "600" },
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
    fontWeight: "500",
  },

  scroll: { paddingHorizontal: 22, paddingTop: 24 },

  // ── Email banner
  emailBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#7B6EF614",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#7B6EF630",
    marginBottom: 28,
  },
  emailIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#7B6EF620",
    borderWidth: 1,
    borderColor: "#7B6EF640",
    justifyContent: "center",
    alignItems: "center",
  },
  emailIcon: { fontSize: 18, color: "#7B6EF6" },
  emailLabel: {
    fontSize: 11,
    color: "#5A5A80",
    fontWeight: "600",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  emailAddr: { fontSize: 14, color: "#9B8FFF", fontWeight: "700" },
  emailArrow: { fontSize: 22, color: "#3A3A58" },

  // ── Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },

  // ── Subject grid
  subjectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 28,
  },
  subjectChip: {
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  subjectChipText: { fontSize: 13, fontWeight: "600", color: "#3A3A58" },

  // ── Form card
  formCard: {
    marginBottom: 16,
  },

  // ── Char count
  charRow: { alignItems: "flex-end", marginTop: 6 },
  charCount: { fontSize: 10, color: "#2E2E48", fontWeight: "600" },
  charCountOk: { color: "#3DDB8A" },

  // ── Device info
  deviceInfoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 24,
  },
  deviceInfoIcon: { fontSize: 13, color: "#2E2E48", marginTop: 1 },
  deviceInfoText: { flex: 1, fontSize: 12, color: "#2E2E48", lineHeight: 18 },

  // ── Send button
  sendBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  sendBtnDisabled: {
    backgroundColor: "#7B6EF630",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  sendBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: 0.2,
  },
  sendBtnArrow: { fontSize: 18, color: "#F0F0FF", fontWeight: "300" },
  sendHint: {
    textAlign: "center",
    fontSize: 12,
    color: "#2E2E48",
    fontWeight: "500",
  },
});

// ─── Input styles ─────────────────────────────────────────────────────────────
const input = StyleSheet.create({
  wrap: {
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  field: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#F0F0FF",
    fontSize: 15,
  },
  fieldMulti: {
    height: 130,
    paddingTop: 13,
  },
});
