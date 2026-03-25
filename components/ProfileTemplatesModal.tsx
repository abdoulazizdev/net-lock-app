import ProfileTemplatesService, {
  ProfileTemplate,
  TEMPLATES,
} from "@/services/profile-templates.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import { useTheme } from "@/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (profileId: string) => void;
  /** Nombre de profils déjà créés — utilisé pour vérifier la limite free */
  profileCount: number;
  /** Appelé quand la limite est atteinte, pour ouvrir le PaywallModal */
  onLimitReached: () => void;
  /** true si l'utilisateur est premium */
  isPremium: boolean;
}

function TemplateCard({
  template,
  onPress,
}: {
  template: ProfileTemplate & { installedCount?: number };
  onPress: () => void;
}) {
  const { t } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const tap = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 300,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity onPress={tap} activeOpacity={0.9}>
      <Animated.View
        style={[
          tm.card,
          {
            backgroundColor: t.bg.card,
            borderColor: t.border.light,
            transform: [{ scale }],
          },
        ]}
      >
        <View
          style={[
            tm.cardIcon,
            {
              backgroundColor: template.color + "18",
              borderColor: template.color + "40",
            },
          ]}
        >
          <Text style={{ fontSize: 28 }}>{template.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[tm.cardName, { color: t.text.primary }]}>
            {template.name}
          </Text>
          <Text
            style={[tm.cardDesc, { color: t.text.muted }]}
            numberOfLines={2}
          >
            {template.description}
          </Text>
          {template.installedCount !== undefined && (
            <View
              style={[
                tm.cardBadge,
                {
                  backgroundColor: template.color + "18",
                  borderColor: template.color + "30",
                },
              ]}
            >
              <Text style={[tm.cardBadgeText, { color: template.color }]}>
                {template.installedCount} app
                {template.installedCount !== 1 ? "s" : ""} détectée
                {template.installedCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>
        <Text style={[tm.chevron, { color: t.text.muted }]}>›</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function ProfileTemplatesModal({
  visible,
  onClose,
  onCreated,
  profileCount,
  onLimitReached,
  isPremium,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Limite atteinte si non-premium et déjà au max
  const limitReached = !isPremium && profileCount >= FREE_LIMITS.MAX_PROFILES;

  useEffect(() => {
    if (visible) {
      loadCounts();
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 55,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadCounts = async () => {
    const result: Record<string, number> = {};
    await Promise.all(
      TEMPLATES.map(async (t) => {
        result[t.id] = await ProfileTemplatesService.countInstalled(t);
      }),
    );
    setCounts(result);
  };

  const handleCreate = async (template: ProfileTemplate) => {
    // Vérification limite avant toute création
    if (limitReached) {
      onClose();
      // Léger délai pour laisser le modal se fermer avant d'ouvrir le paywall
      setTimeout(onLimitReached, 300);
      return;
    }

    if (creating) return;
    setCreating(template.id);
    try {
      const profile =
        await ProfileTemplatesService.createFromTemplate(template);
      const count = counts[template.id] ?? 0;
      Alert.alert(
        `✅ Profil "${template.name}" créé`,
        `${count} app${count !== 1 ? "s" : ""} bloquée${count !== 1 ? "s" : ""}. Vous pouvez l'activer depuis l'onglet Profils.`,
        [
          {
            text: "Voir le profil",
            onPress: () => {
              onCreated(profile.id);
              onClose();
            },
          },
          { text: "Fermer", onPress: onClose },
        ],
      );
    } catch (e) {
      Alert.alert("Erreur", "Impossible de créer le profil.");
    } finally {
      setCreating(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[tm.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            tm.sheet,
            {
              backgroundColor: t.bg.card,
              borderColor: t.border.light,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[tm.handle, { backgroundColor: t.border.normal }]} />
          <View style={tm.header}>
            <View style={{ flex: 1 }}>
              <Text style={[tm.title, { color: t.text.primary }]}>
                Templates de profils
              </Text>
              <Text style={[tm.sub, { color: t.text.muted }]}>
                Créez un profil en un tap avec des apps pré-sélectionnées
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[tm.closeBtn, { backgroundColor: t.bg.cardAlt }]}
            >
              <Text
                style={{ fontSize: 11, color: t.text.muted, fontWeight: "700" }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bandeau limite atteinte */}
          {limitReached && (
            <TouchableOpacity
              style={[
                tm.limitBanner,
                { backgroundColor: "#7F77DD18", borderColor: "#7F77DD40" },
              ]}
              onPress={() => {
                onClose();
                setTimeout(onLimitReached, 300);
              }}
              activeOpacity={0.85}
            >
              <Text style={tm.limitBannerIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={[tm.limitBannerTitle, { color: "#A89FE8" }]}>
                  Limite atteinte ({profileCount}/{FREE_LIMITS.MAX_PROFILES}{" "}
                  profils)
                </Text>
                <Text style={[tm.limitBannerSub, { color: t.text.muted }]}>
                  Passez à Premium pour créer des profils illimités.
                </Text>
              </View>
              <Text style={[tm.limitBannerCta, { color: "#A89FE8" }]}>
                Voir →
              </Text>
            </TouchableOpacity>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                template={{ ...template, installedCount: counts[template.id] }}
                onPress={() => handleCreate(template)}
              />
            ))}
            <View
              style={[
                tm.infoBox,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[tm.infoText, { color: t.text.muted }]}>
                💡 Seules les apps réellement installées sur votre appareil
                seront bloquées. Vous pourrez modifier les règles après
                création.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const tm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sub: { fontSize: 12, lineHeight: 18 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  limitBannerIcon: { fontSize: 18 },
  limitBannerTitle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  limitBannerSub: { fontSize: 11, lineHeight: 16 },
  limitBannerCta: { fontSize: 13, fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardName: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  cardDesc: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  cardBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardBadgeText: { fontSize: 10, fontWeight: "700" },
  chevron: { fontSize: 22, fontWeight: "300" },
  infoBox: { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 4 },
  infoText: { fontSize: 12, lineHeight: 18 },
});
