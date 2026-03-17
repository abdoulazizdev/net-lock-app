import SubscriptionService, {
    FREE_LIMITS,
} from "@/services/subscription.service";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Keyboard,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

let Purchases: any = null;
try {
  Purchases = require("react-native-purchases").default;
} catch {
  console.warn(
    "[PaywallModal] react-native-purchases non installé — mode simulation",
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpgraded: () => void;
  reason?:
    | "blocked_apps"
    | "profiles"
    | "schedules"
    | "focus"
    | "stats"
    | "export"
    | "security"
    | "general";
}

const REASON_MESSAGES: Record<
  string,
  { icon: string; title: string; sub: string }
> = {
  blocked_apps: {
    icon: "◈",
    title: "Limite atteinte",
    sub: `La version gratuite permet de bloquer ${FREE_LIMITS.MAX_BLOCKED_APPS} apps maximum.`,
  },
  profiles: {
    icon: "◉",
    title: "1 profil en gratuit",
    sub: "Passez à Premium pour créer autant de profils que vous voulez.",
  },
  schedules: {
    icon: "◷",
    title: "Planifications illimitées",
    sub: "La version gratuite est limitée à 1 planification par profil.",
  },
  focus: {
    icon: "◎",
    title: "Focus Premium",
    sub: "Les durées personnalisées et les sessions longues nécessitent Premium.",
  },
  stats: {
    icon: "◈",
    title: "Statistiques avancées",
    sub: "Accédez à l'historique complet et aux stats par application.",
  },
  export: {
    icon: "◉",
    title: "Export / Import",
    sub: "Sauvegardez et restaurez vos règles avec Premium.",
  },
  security: {
    icon: "◈",
    title: "Sécurité avancée",
    sub: "Le PIN applicatif et la biométrie sont des fonctionnalités Premium.",
  },
  general: {
    icon: "◎",
    title: "Passez à Premium",
    sub: "Débloquez toutes les fonctionnalités de NetOff.",
  },
};

const FEATURES = [
  { icon: "◈", label: "Apps bloquées", free: "3 apps", premium: "Illimité" },
  { icon: "◉", label: "Profils", free: "1 profil", premium: "Illimité" },
  {
    icon: "◷",
    label: "Planifications",
    free: "1 par profil",
    premium: "Illimité",
  },
  { icon: "◎", label: "Mode Focus", free: "25 min", premium: "Durée libre" },
  {
    icon: "◈",
    label: "Statistiques",
    free: "Vue d'ensemble",
    premium: "Historique + par app",
  },
  { icon: "◉", label: "Export / Import", free: "—", premium: "✓" },
  { icon: "◈", label: "PIN & Biométrie", free: "—", premium: "✓" },
  { icon: "◎", label: "VPN persistant", free: "✓", premium: "✓" },
];

const PLANS = [
  {
    id: "monthly",
    label: "Mensuel",
    price: "2,99 €",
    period: "/ mois",
    badge: null,
    rcId: "netoff_monthly",
  },
  {
    id: "yearly",
    label: "Annuel",
    price: "17,99 €",
    period: "/ an",
    badge: "–50%",
    rcId: "netoff_yearly",
  },
  {
    id: "lifetime",
    label: "À vie",
    price: "34,99 €",
    period: "une fois",
    badge: "⭐ MEILLEUR",
    rcId: "netoff_lifetime",
  },
];

// ─── Onglet code promo — composant isolé avec son propre listener clavier ─────
// Stratégie : on écoute la hauteur du clavier et on translate le contenu vers
// le haut d'autant, ce qui garantit que le champ reste visible quoi qu'il arrive.
function CodeTab({
  promoCode,
  setPromoCode,
  codeLoading,
  onSubmit,
}: {
  promoCode: string;
  setPromoCode: (v: string) => void;
  codeLoading: boolean;
  onSubmit: () => void;
}) {
  const shiftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const dur = Platform.OS === "ios" ? 260 : 160;

    const s1 = Keyboard.addListener(showEvt, (e) => {
      // On remonte le contenu de la hauteur du clavier moins un peu de marge
      Animated.timing(shiftAnim, {
        toValue: -(e.endCoordinates.height - 20),
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
    const s2 = Keyboard.addListener(hideEvt, () => {
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Animated.View
        style={[ct.wrap, { transform: [{ translateY: shiftAnim }] }]}
      >
        <View style={ct.iconWrap}>
          <Text style={ct.icon}>◈</Text>
        </View>
        <Text style={ct.title}>Entrez votre code</Text>
        <Text style={ct.sub}>
          Si vous avez reçu un code d'activation, saisissez-le ci-dessous pour
          activer Premium gratuitement.
        </Text>
        <TextInput
          style={ct.input}
          placeholder="Ex: NETOFF-PRO-2025"
          placeholderTextColor="#2A2A42"
          value={promoCode}
          onChangeText={setPromoCode}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
        <TouchableOpacity
          style={[ct.btn, (!promoCode.trim() || codeLoading) && ct.btnOff]}
          onPress={onSubmit}
          disabled={!promoCode.trim() || codeLoading}
          activeOpacity={0.85}
        >
          {codeLoading ? (
            <ActivityIndicator color="#F0F0FF" size="small" />
          ) : (
            <Text style={ct.btnText}>Activer le code</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PaywallModal({
  visible,
  onClose,
  onUpgraded,
  reason = "general",
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [rcPackages, setRcPackages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"plans" | "code">("plans");
  const [promoCode, setPromoCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const msg = REASON_MESSAGES[reason] ?? REASON_MESSAGES.general;

  useEffect(() => {
    if (visible) {
      setActiveTab("plans");
      setPromoCode("");
      loadRCPackages();
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 300,
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
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 250,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadRCPackages = async () => {
    if (!Purchases) return;
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages)
        setRcPackages(offerings.current.availablePackages);
    } catch (e) {
      console.warn(
        "[PaywallModal] Impossible de charger les offres RevenueCat:",
        e,
      );
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      if (Purchases && rcPackages.length > 0) {
        const plan = PLANS.find((p) => p.id === selectedPlan);
        const pkg =
          rcPackages.find(
            (p) =>
              p.packageType === plan?.rcId ||
              p.identifier === plan?.rcId ||
              p.identifier.toLowerCase().includes(plan?.id ?? ""),
          ) ?? rcPackages[0];
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const isActive =
          typeof customerInfo.entitlements?.active?.["premium"] !==
            "undefined" ||
          Object.keys(customerInfo.entitlements?.active ?? {}).length > 0;
        if (isActive) {
          await SubscriptionService.activateFromPurchase(
            customerInfo.latestExpirationDate ?? undefined,
          );
          onUpgraded();
          onClose();
        } else {
          Alert.alert(
            "Erreur",
            "L'achat n'a pas pu être vérifié. Contactez le support.",
          );
        }
      } else {
        await SubscriptionService.activate();
        onUpgraded();
        onClose();
      }
    } catch (e: any) {
      if (!e?.userCancelled)
        Alert.alert(
          "Erreur",
          e?.message || "Une erreur est survenue lors du paiement.",
        );
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      if (Purchases) {
        const customerInfo = await Purchases.restorePurchases();
        const isActive =
          typeof customerInfo.entitlements?.active?.["premium"] !==
            "undefined" ||
          Object.keys(customerInfo.entitlements?.active ?? {}).length > 0;
        if (isActive) {
          await SubscriptionService.activateFromRestore(
            customerInfo.latestExpirationDate ?? undefined,
          );
          onUpgraded();
          onClose();
          Alert.alert(
            "✓ Achat restauré",
            "Votre abonnement Premium a été restauré.",
          );
        } else {
          Alert.alert(
            "Aucun achat trouvé",
            "Aucun achat Premium associé à votre compte.",
          );
        }
      } else {
        Alert.alert(
          "Info",
          "La restauration n'est pas disponible en mode simulation.",
        );
      }
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.message || "Impossible de restaurer vos achats.",
      );
    } finally {
      setRestoring(false);
    }
  };

  const handlePromoCode = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setCodeLoading(true);
    try {
      const result = await SubscriptionService.activateWithCode(code);
      if (result.success) {
        onUpgraded();
        onClose();
        Alert.alert(
          "⚡ Premium activé !",
          "Votre code a été validé. Profitez de toutes les fonctionnalités !",
        );
      } else {
        Alert.alert(
          "Code invalide",
          result.error ?? "Ce code n'est pas valide.",
        );
      }
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[pw.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />

        <Animated.View
          style={[
            pw.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle + fermer */}
          <View style={pw.handleRow}>
            <View style={pw.handle} />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              style={pw.closeBtn}
            >
              <Text style={pw.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={pw.tabs}>
            <TouchableOpacity
              style={[pw.tabBtn, activeTab === "plans" && pw.tabBtnActive]}
              onPress={() => {
                Keyboard.dismiss();
                setActiveTab("plans");
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  pw.tabBtnText,
                  activeTab === "plans" && pw.tabBtnTextActive,
                ]}
              >
                Abonnement
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pw.tabBtn, activeTab === "code" && pw.tabBtnActive]}
              onPress={() => setActiveTab("code")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  pw.tabBtnText,
                  activeTab === "code" && pw.tabBtnTextActive,
                ]}
              >
                Code promo
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Onglet plans ── */}
          {activeTab === "plans" && (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Hero */}
                <View style={pw.hero}>
                  <View style={pw.heroIconWrap}>
                    <Text style={pw.heroIcon}>{msg.icon}</Text>
                  </View>
                  <View style={pw.premiumBadge}>
                    <Text style={pw.premiumBadgeText}>◎ NETOFF PREMIUM</Text>
                  </View>
                  <Text style={pw.heroTitle}>{msg.title}</Text>
                  <Text style={pw.heroSub}>{msg.sub}</Text>
                </View>

                {/* Tableau */}
                <View style={pw.tableWrap}>
                  <View style={pw.tableHeader}>
                    <Text style={pw.tableHeaderCell}>FONCTIONNALITÉ</Text>
                    <Text style={[pw.tableHeaderCell, pw.tableHeaderFree]}>
                      GRATUIT
                    </Text>
                    <Text style={[pw.tableHeaderCell, pw.tableHeaderPremium]}>
                      PREMIUM
                    </Text>
                  </View>
                  {FEATURES.map((f, i) => (
                    <View
                      key={f.label}
                      style={[pw.tableRow, i % 2 === 0 && pw.tableRowAlt]}
                    >
                      <View style={pw.tableFeature}>
                        <Text style={pw.tableFeatureIcon}>{f.icon}</Text>
                        <Text style={pw.tableFeatureLabel}>{f.label}</Text>
                      </View>
                      <Text style={pw.tableFreeVal}>{f.free}</Text>
                      <Text style={pw.tablePremiumVal}>{f.premium}</Text>
                    </View>
                  ))}
                </View>

                {/* Plans */}
                <Text style={pw.plansTitle}>CHOISIR UN PLAN</Text>
                {PLANS.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      pw.planCard,
                      selectedPlan === plan.id && pw.planCardSelected,
                    ]}
                    onPress={() => setSelectedPlan(plan.id)}
                    activeOpacity={0.8}
                  >
                    {plan.badge && (
                      <View style={pw.planBadge}>
                        <Text style={pw.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                    <View style={pw.planLeft}>
                      <View
                        style={[
                          pw.planRadio,
                          selectedPlan === plan.id && pw.planRadioSelected,
                        ]}
                      >
                        {selectedPlan === plan.id && (
                          <View style={pw.planRadioDot} />
                        )}
                      </View>
                      <Text
                        style={[
                          pw.planLabel,
                          selectedPlan === plan.id && pw.planLabelSelected,
                        ]}
                      >
                        {plan.label}
                      </Text>
                    </View>
                    <View style={pw.planRight}>
                      <Text
                        style={[
                          pw.planPrice,
                          selectedPlan === plan.id && pw.planPriceSelected,
                        ]}
                      >
                        {plan.price}
                      </Text>
                      <Text style={pw.planPeriod}>{plan.period}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                <Text style={pw.legalText}>
                  Paiement sécurisé via Google Play.
                  {Platform.OS === "ios" ? " App Store." : ""} Annulable à tout
                  moment.
                </Text>
              </ScrollView>

              <TouchableOpacity
                style={[pw.ctaBtn, loading && pw.ctaBtnLoading]}
                onPress={handleUpgrade}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#F0F0FF" />
                ) : (
                  <Text style={pw.ctaBtnText}>Passer à Premium ◎</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={pw.restoreBtn}
                onPress={handleRestore}
                disabled={restoring}
                activeOpacity={0.7}
              >
                {restoring ? (
                  <ActivityIndicator color="#3A3A58" size="small" />
                ) : (
                  <Text style={pw.restoreBtnText}>
                    Restaurer un achat · Continuer gratuitement
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ── Onglet code promo ── */}
          {activeTab === "code" && (
            <CodeTab
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              codeLoading={codeLoading}
              onSubmit={handlePromoCode}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles CodeTab ───────────────────────────────────────────────────────────
const ct = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 8,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: { fontSize: 28, color: "#7B6EF6" },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    color: "#3A3A58",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  input: {
    width: "100%",
    backgroundColor: "#14141E",
    borderRadius: 14,
    padding: 16,
    color: "#F0F0FF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: "#2A2A42",
    textAlign: "center",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  btn: {
    width: "100%",
    backgroundColor: "#7B6EF6",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnOff: { backgroundColor: "#7B6EF630" },
  btnText: { color: "#F0F0FF", fontSize: 15, fontWeight: "800" },
});

// ─── Styles principaux ────────────────────────────────────────────────────────
const pw = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000BB",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0E0E18",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#2A2A3C",
    maxHeight: "95%",
  },
  handleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 12,
    marginBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A3C",
    flex: 1,
    marginRight: 8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#1C1C2C",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 11, color: "#5A5A80", fontWeight: "700" },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 16,
    overflow: "hidden",
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#16103A" },
  tabBtnText: { fontSize: 13, fontWeight: "600", color: "#3A3A58" },
  tabBtnTextActive: { color: "#9B8FFF" },

  hero: { alignItems: "center", paddingVertical: 16 },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16103A",
    borderWidth: 1,
    borderColor: "#4A3F8A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  heroIcon: { fontSize: 28, color: "#7B6EF6" },
  premiumBadge: {
    backgroundColor: "#7B6EF620",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#7B6EF640",
    marginBottom: 8,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9B8FFF",
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    color: "#3A3A58",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  tableWrap: {
    backgroundColor: "#0A0A14",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    overflow: "hidden",
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#14141E",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    flex: 2,
    fontSize: 9,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 1.5,
  },
  tableHeaderFree: { flex: 1.2, textAlign: "center", color: "#3A3A58" },
  tableHeaderPremium: { flex: 1.5, textAlign: "center", color: "#7B6EF6" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableRowAlt: { backgroundColor: "#0E0E1A" },
  tableFeature: { flex: 2, flexDirection: "row", alignItems: "center", gap: 6 },
  tableFeatureIcon: { fontSize: 11, color: "#5A5A80" },
  tableFeatureLabel: { fontSize: 12, color: "#C0C0D8", fontWeight: "500" },
  tableFreeVal: {
    flex: 1.2,
    fontSize: 11,
    color: "#3A3A58",
    textAlign: "center",
  },
  tablePremiumVal: {
    flex: 1.5,
    fontSize: 11,
    color: "#9B8FFF",
    textAlign: "center",
    fontWeight: "700",
  },

  plansTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#14141E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    padding: 14,
    marginBottom: 8,
    overflow: "hidden",
  },
  planCardSelected: { backgroundColor: "#16103A", borderColor: "#7B6EF6" },
  planBadge: {
    position: "absolute",
    top: -1,
    right: -1,
    backgroundColor: "#7B6EF6",
    borderBottomLeftRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planBadgeText: { fontSize: 9, fontWeight: "800", color: "#F0F0FF" },
  planLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  planRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#2A2A42",
    justifyContent: "center",
    alignItems: "center",
  },
  planRadioSelected: { borderColor: "#7B6EF6" },
  planRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7B6EF6",
  },
  planLabel: { fontSize: 14, fontWeight: "700", color: "#5A5A80" },
  planLabelSelected: { color: "#F0F0FF" },
  planRight: { alignItems: "flex-end" },
  planPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#5A5A80",
    letterSpacing: -0.5,
  },
  planPriceSelected: { color: "#9B8FFF" },
  planPeriod: { fontSize: 10, color: "#2E2E48", marginTop: 1 },
  legalText: {
    fontSize: 10,
    color: "#2E2E48",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 16,
  },

  ctaBtn: {
    backgroundColor: "#7B6EF6",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  ctaBtnLoading: { backgroundColor: "#7B6EF640" },
  ctaBtnText: {
    color: "#F0F0FF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  restoreBtn: { paddingVertical: 12, alignItems: "center" },
  restoreBtnText: { fontSize: 12, color: "#2E2E48", fontWeight: "500" },
});
