import ProfileTemplatesService, {
  ProfileTemplate,
  TEMPLATES,
} from "@/services/profile-templates.service";
import { FREE_LIMITS } from "@/services/subscription.service";
import { Colors, useTheme } from "@/theme";
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
  profileCount: number;
  onLimitReached: () => void;
  isPremium: boolean;
}

function TemplateCard({
  template,
  isPremium,
  onPress,
}: {
  template: ProfileTemplate & { installedCount?: number };
  isPremium: boolean;
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

  const installed = template.installedCount ?? 0;
  const willBlock = isPremium
    ? installed
    : Math.min(installed, FREE_LIMITS.MAX_BLOCKED_APPS);
  const isTruncated = !isPremium && installed > FREE_LIMITS.MAX_BLOCKED_APPS;

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

          {/* Badge apps détectées */}
          {installed > 0 && (
            <View style={tm.badgeRow}>
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
                  {installed} app{installed > 1 ? "s" : ""} détectée
                  {installed > 1 ? "s" : ""}
                </Text>
              </View>

              {/* Badge limitation free */}
              {isTruncated && (
                <View
                  style={[
                    tm.limitBadge,
                    {
                      backgroundColor: Colors.amber[50],
                      borderColor: Colors.amber[200],
                    },
                  ]}
                >
                  <Text
                    style={[tm.limitBadgeText, { color: Colors.amber[700] }]}
                  >
                    🔒 {willBlock}/{installed} en gratuit
                  </Text>
                </View>
              )}
            </View>
          )}

          {installed === 0 && (
            <View
              style={[
                tm.cardBadge,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[tm.cardBadgeText, { color: t.text.muted }]}>
                Aucune app détectée
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
      TEMPLATES.map(async (tmpl) => {
        result[tmpl.id] = await ProfileTemplatesService.countInstalled(tmpl);
      }),
    );
    setCounts(result);
  };

  const handleCreate = async (template: ProfileTemplate) => {
    if (limitReached) {
      onClose();
      setTimeout(onLimitReached, 300);
      return;
    }
    if (creating) return;

    const installed = counts[template.id] ?? 0;
    const willBlock = isPremium
      ? installed
      : Math.min(installed, FREE_LIMITS.MAX_BLOCKED_APPS);
    const isTruncated = !isPremium && installed > FREE_LIMITS.MAX_BLOCKED_APPS;

    // Avertir l'utilisateur gratuit que sa liste sera tronquée
    if (isTruncated) {
      Alert.alert(
        `🔒 Limite gratuite`,
        `Ce template contient ${installed} apps, mais la version gratuite est limitée à ${FREE_LIMITS.MAX_BLOCKED_APPS} apps bloquées.\n\n${willBlock} apps seront bloquées. Passez à Premium pour toutes les bloquer.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: `Créer avec ${willBlock} apps`,
            onPress: () => doCreate(template),
          },
          {
            text: "Passer à Premium",
            onPress: () => {
              onClose();
              setTimeout(onLimitReached, 300);
            },
          },
        ],
      );
      return;
    }

    doCreate(template);
  };

  const doCreate = async (template: ProfileTemplate) => {
    setCreating(template.id);
    try {
      const result = await ProfileTemplatesService.createFromTemplate(
        template,
        isPremium,
      );
      const { blockedCount, detectedCount, wasTruncated } = result;

      const message = wasTruncated
        ? `${blockedCount}/${detectedCount} apps bloquées (limite gratuite).\nPassez à Premium pour bloquer les ${detectedCount} apps.`
        : `${blockedCount} app${blockedCount !== 1 ? "s" : ""} bloquée${blockedCount !== 1 ? "s" : ""}. Activez le profil depuis l'onglet Profils.`;

      Alert.alert(`✅ Profil "${template.name}" créé`, message, [
        {
          text: "Voir le profil",
          onPress: () => {
            onCreated(result.profile.id);
            onClose();
          },
        },
        { text: "Fermer", onPress: onClose },
      ]);
    } catch {
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

          {/* Bandeau limite profils */}
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
                  Limite profils atteinte ({profileCount}/
                  {FREE_LIMITS.MAX_PROFILES})
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

          {/* Bandeau limite apps (utilisateur gratuit, pas encore à la limite profils) */}
          {!isPremium && !limitReached && (
            <View
              style={[
                tm.appsLimitInfo,
                {
                  backgroundColor: Colors.amber[50],
                  borderColor: Colors.amber[100],
                },
              ]}
            >
              <Text style={{ fontSize: 13 }}>ℹ️</Text>
              <Text style={[tm.appsLimitText, { color: Colors.amber[700] }]}>
                Version gratuite : max {FREE_LIMITS.MAX_BLOCKED_APPS} apps
                bloquées par profil. Passez à Premium pour tout débloquer.
              </Text>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                template={{ ...template, installedCount: counts[template.id] }}
                isPremium={isPremium}
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
    marginBottom: 14,
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
    marginBottom: 12,
  },
  limitBannerIcon: { fontSize: 18 },
  limitBannerTitle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  limitBannerSub: { fontSize: 11, lineHeight: 16 },
  limitBannerCta: { fontSize: 13, fontWeight: "700" },

  appsLimitInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  appsLimitText: { flex: 1, fontSize: 11, lineHeight: 16 },

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
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  cardBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardBadgeText: { fontSize: 10, fontWeight: "700" },
  limitBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  limitBadgeText: { fontSize: 10, fontWeight: "700" },
  chevron: { fontSize: 22, fontWeight: "300" },
  infoBox: { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 4 },
  infoText: { fontSize: 12, lineHeight: 18 },
});
