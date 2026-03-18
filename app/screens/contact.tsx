import { useAppInfo } from "@/hooks/useAppInfo";
import { Colors, Semantic, useTheme } from "@/theme";
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

const CONTACT_EMAIL = "abdoulaziz.dev@gmail.com";
const SUBJECTS = [
  { id: "bug", label: "🐛 Signaler un bug", color: Colors.red[500] },
  { id: "feature", label: "◈ Suggestion", color: Colors.purple[400] },
  { id: "question", label: "◎ Question générale", color: Colors.blue[500] },
  { id: "other", label: "◌ Autre", color: Colors.gray[400] },
];

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
  const { t } = useTheme();
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
    outputRange: [t.border.light, t.border.focus],
  });
  const bgColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.bg.cardAlt, t.bg.accent],
  });
  return (
    <Animated.View
      style={[inp.wrap, { borderColor, backgroundColor: bgColor }, style]}
    >
      <TextInput
        style={[
          inp.field,
          { color: t.text.primary },
          multiline && inp.fieldMulti,
        ]}
        placeholder={placeholder}
        placeholderTextColor={t.text.muted}
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

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const appInfo = useAppInfo();
  const anims = useStagger(5, 55);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const shiftAnim = useRef(new Animated.Value(0)).current;

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
    const mailUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[NetOff] ${subject?.label ?? ""}`.replace(/[🐛◈◎◌]/gu, "").trim())}&body=${encodeURIComponent(body)}`;
    try {
      const supported = await Linking.canOpenURL(mailUrl);
      if (supported) {
        await Linking.openURL(mailUrl);
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
    <View style={[s.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: Semantic.bg.header,
            borderBottomColor: "rgba(255,255,255,.1)",
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Contact</Text>
        <Text style={s.headerSubtitle}>On vous répond sous 48h</Text>
      </View>

      <Animated.View
        style={{ flex: 1, transform: [{ translateY: shiftAnim }] }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: insets.bottom + 60 },
          ]}
        >
          <Section anim={anims[0]}>
            <TouchableOpacity
              style={[
                s.emailBanner,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  s.emailIconWrap,
                  { backgroundColor: t.bg.card, borderColor: t.border.strong },
                ]}
              >
                <Text style={[s.emailIcon, { color: t.text.link }]}>◎</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.emailLabel, { color: t.text.muted }]}>
                  Email direct
                </Text>
                <Text style={[s.emailAddr, { color: t.text.link }]}>
                  {CONTACT_EMAIL}
                </Text>
              </View>
              <Text style={[s.emailArrow, { color: t.text.muted }]}>›</Text>
            </TouchableOpacity>
          </Section>

          <Section anim={anims[1]}>
            <Text style={[s.sectionLabel, { color: t.text.muted }]}>SUJET</Text>
            <View style={s.subjectGrid}>
              {SUBJECTS.map((subj) => {
                const active = selectedSubject === subj.id;
                return (
                  <TouchableOpacity
                    key={subj.id}
                    style={[
                      s.subjectChip,
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.light,
                      },
                      active && {
                        backgroundColor: subj.color + "18",
                        borderColor: subj.color + "60",
                      },
                    ]}
                    onPress={() => setSelectedSubject(subj.id)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        s.subjectChipText,
                        { color: active ? subj.color : t.text.secondary },
                      ]}
                    >
                      {subj.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section anim={anims[2]}>
            <Text style={[s.sectionLabel, { color: t.text.muted }]}>
              VOTRE MESSAGE
            </Text>
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
            <View style={s.charRow}>
              <Text
                style={[
                  s.charCount,
                  {
                    color: message.length >= 10 ? t.allowed.text : t.text.muted,
                  },
                ]}
              >
                {message.length} / 10 min
              </Text>
            </View>
          </Section>

          <Section anim={anims[3]}>
            <View
              style={[
                s.deviceInfoBanner,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[s.deviceInfoIcon, { color: t.text.muted }]}>◈</Text>
              <Text style={[s.deviceInfoText, { color: t.text.secondary }]}>
                Les infos de l'appareil (
                {appInfo.loading
                  ? "…"
                  : `${appInfo.appName} ${appInfo.fullVersion}, ${appInfo.osName} ${appInfo.osVersion}`}
                ) seront jointes automatiquement pour faciliter le diagnostic.
              </Text>
            </View>
          </Section>

          <Section anim={anims[4]}>
            <TouchableOpacity
              style={[
                s.sendBtn,
                !canSend && {
                  backgroundColor: Colors.blue[200],
                  shadowOpacity: 0,
                  elevation: 0,
                },
              ]}
              onPress={handleSend}
              disabled={!canSend || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <Text style={s.sendBtnText}>Ouverture du mail…</Text>
              ) : (
                <View style={s.sendBtnInner}>
                  <Text style={s.sendBtnText}>Envoyer</Text>
                  <Text style={s.sendBtnArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>
            {!canSend && (
              <Text style={[s.sendHint, { color: t.text.muted }]}>
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

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { marginBottom: 12 },
  backText: { color: Colors.gray[0], fontSize: 14, fontWeight: "600" },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -1.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.blue[200],
    marginTop: 3,
    fontWeight: "500",
  },
  scroll: { paddingHorizontal: 22, paddingTop: 24 },
  emailBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 28,
  },
  emailIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emailIcon: { fontSize: 18 },
  emailLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  emailAddr: { fontSize: 14, fontWeight: "700" },
  emailArrow: { fontSize: 22 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  subjectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 28,
  },
  subjectChip: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  subjectChipText: { fontSize: 13, fontWeight: "600" },
  charRow: { alignItems: "flex-end", marginTop: 6 },
  charCount: { fontSize: 10, fontWeight: "600" },
  deviceInfoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  deviceInfoIcon: { fontSize: 13, marginTop: 1 },
  deviceInfoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  sendBtn: {
    backgroundColor: Colors.blue[600],
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.blue[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  sendBtnInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  sendBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: 0.2,
  },
  sendBtnArrow: { fontSize: 18, color: Colors.gray[0], fontWeight: "300" },
  sendHint: { textAlign: "center", fontSize: 12, fontWeight: "500" },
});
const inp = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  field: { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  fieldMulti: { height: 130, paddingTop: 13 },
});
