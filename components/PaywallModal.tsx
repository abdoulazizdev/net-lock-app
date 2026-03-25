// components/PaywallModal.tsx
import SubscriptionService, {
  FREE_LIMITS,
} from "@/services/subscription.service";
import { Colors, useTheme } from "@/theme";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  Linking,
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
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Config contact ───────────────────────────────────────────────────────────
const CONTACT = {
  whatsapp: "+212646534846",
  email: "abdoulaziz.dev@gmail.com",
} as const;

const openWhatsApp = () => {
  const msg = encodeURIComponent(
    "Bonjour, je souhaite obtenir un accès Premium à NetOff.",
  );
  Linking.openURL(`https://wa.me/${CONTACT.whatsapp}?text=${msg}`).catch(() =>
    Linking.openURL(`https://wa.me/${CONTACT.whatsapp}`),
  );
};

const openEmail = () => {
  const subject = encodeURIComponent("[NetOff] Accès Premium");
  const body = encodeURIComponent(
    "Bonjour,\n\nJe souhaite obtenir un accès Premium à NetOff.\n\nMerci.",
  );
  Linking.openURL(`mailto:${CONTACT.email}?subject=${subject}&body=${body}`);
};

// ─── Types ────────────────────────────────────────────────────────────────────
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

// Plan enrichi : données RevenueCat + métadonnées UI
interface DynamicPlan {
  id: string; // identifiant RevenueCat (package.identifier)
  label: string; // libellé affiché
  price: string; // prix formaté par RevenueCat (localisation auto)
  period: string; // "/ mois" | "/ an" | "une fois"
  badge: string | null; // badge promotionnel
  rcPackage: PurchasesPackage | null; // null = fallback statique (pas de package RC dispo)
}

// Plans statiques de fallback (affichés si getOfferings() échoue ou retourne vide)
const FALLBACK_PLANS: DynamicPlan[] = [
  {
    id: "netoff_monthly",
    label: "Mensuel",
    price: "2,99 €",
    period: "/ mois",
    badge: null,
    rcPackage: null,
  },
  {
    id: "netoff_yearly",
    label: "Annuel",
    price: "17,99 €",
    period: "/ an",
    badge: "–50%",
    rcPackage: null,
  },
  {
    id: "netoff_lifetime",
    label: "À vie",
    price: "34,99 €",
    period: "une fois",
    badge: "⭐ MEILLEUR",
    rcPackage: null,
  },
];

// ─── Données statiques ────────────────────────────────────────────────────────
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

// Table de comparaison construite à partir de FREE_LIMITS
const plural = (n: number, singular: string, pluralForm: string) =>
  n > 1 ? `${n} ${pluralForm}` : `${n} ${singular}`;

const buildFeatures = () => [
  {
    icon: "◈",
    label: "Apps bloquées",
    free: plural(FREE_LIMITS.MAX_BLOCKED_APPS, "app", "apps"),
    premium: "Illimité",
  },
  {
    icon: "◉",
    label: "Profils",
    free: plural(FREE_LIMITS.MAX_PROFILES, "profil", "profils"),
    premium: "Illimité",
  },
  {
    icon: "◷",
    label: "Planifications",
    free: plural(FREE_LIMITS.MAX_SCHEDULES, "par profil", "par profil"),
    premium: "Illimité",
  },
  {
    icon: "◎",
    label: "Mode Focus",
    free: FREE_LIMITS.FOCUS_PRESETS_FREE.length
      ? FREE_LIMITS.FOCUS_PRESETS_FREE.map((m) => `${m} min`).join(", ")
      : "Limité",
    premium: "Durée libre",
  },
  {
    icon: "◈",
    label: "Statistiques",
    free: FREE_LIMITS.STATS_TABS_FREE.length > 0 ? "Vue d'ensemble" : "—",
    premium: "Historique + par app",
  },
  {
    icon: "◉",
    label: "Export / Import",
    free: FREE_LIMITS.EXPORT_IMPORT ? "✓" : "—",
    premium: "✓",
  },
  {
    icon: "◈",
    label: "PIN & Biométrie",
    free: FREE_LIMITS.PIN_AUTH ? "PIN" : "—",
    premium: "PIN + Biométrie",
  },
  { icon: "◎", label: "VPN persistant", free: "✓", premium: "✓" },
];

// ─── Mapping package identifier → métadonnées UI ─────────────────────────────
// Permet d'enrichir les offres RevenueCat avec des labels/badges locaux.
// Si un identifiant n'est pas trouvé ici, on utilise les valeurs RC brutes.
const PACKAGE_UI_META: Record<
  string,
  { label: string; period: string; badge: string | null }
> = {
  netoff_monthly: { label: "Mensuel", period: "/ mois", badge: null },
  netoff_yearly: { label: "Annuel", period: "/ an", badge: "–50%" },
  netoff_lifetime: { label: "À vie", period: "une fois", badge: "⭐ MEILLEUR" },
  // Identifiants RevenueCat standard (fallback)
  $rc_monthly: { label: "Mensuel", period: "/ mois", badge: null },
  $rc_annual: { label: "Annuel", period: "/ an", badge: "–50%" },
  $rc_lifetime: { label: "À vie", period: "une fois", badge: "⭐ MEILLEUR" },
  $rc_weekly: { label: "Hebdo", period: "/ sem.", badge: null },
};

/** Priorité d'affichage des plans (du plus long au plus court engagement) */
const PLAN_ORDER = [
  "netoff_lifetime",
  "$rc_lifetime",
  "netoff_yearly",
  "$rc_annual",
  "netoff_monthly",
  "$rc_monthly",
  "$rc_weekly",
];

function sortPlans(plans: DynamicPlan[]): DynamicPlan[] {
  return [...plans].sort((a, b) => {
    const ia = PLAN_ORDER.indexOf(a.id);
    const ib = PLAN_ORDER.indexOf(b.id);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ─── Mapping erreurs internes → messages UX ───────────────────────────────────
const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  PURCHASE_FAILED:
    "Le paiement n'a pas pu être traité. Vérifiez votre moyen de paiement.",
  RESTORE_FAILED:
    "La restauration a échoué. Vérifiez votre connexion et réessayez.",
  SDK_NOT_READY: "Le service de paiement n'est pas disponible pour le moment.",
  NO_OFFERING: "Ce plan n'est pas disponible pour le moment.",
  NOT_CONFIRMED:
    "Votre paiement a été traité mais n'a pas encore été confirmé. Attendez quelques secondes puis relancez l'app.",
  USER_CANCELLED: "",
};

function friendlyPurchaseError(code: string | undefined): string {
  if (!code) return "Une erreur inattendue est survenue.";
  return PURCHASE_ERROR_MESSAGES[code] ?? "Une erreur inattendue est survenue.";
}

function friendlyPromoError(code: string | undefined): string {
  if (!code) return "Ce code n'est pas valide.";
  const safe = [
    "Code invalide ou inexistant.",
    "Ce code promotionnel a expiré.",
  ];
  return safe.includes(code) ? code : "Ce code n'est pas valide.";
}

// ─── Hook : chargement dynamique des offres RevenueCat ───────────────────────
function useDynamicPlans() {
  // Initialisation immédiate avec les plans statiques — pas de skeleton au 1er rendu
  const [plans, setPlans] = useState<DynamicPlan[]>(FALLBACK_PLANS);
  const [loading, setLoading] = useState(false);
  // true = les plans viennent du fallback statique (pas de RC)
  const [isFallback, setIsFallback] = useState(true);

  const load = useCallback(async () => {
    setIsFallback(false); // optimiste : on essaie RC
    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];

      if (packages.length === 0) {
        // Aucune offre RC disponible → fallback silencieux
        console.warn(
          "[PaywallModal] getOfferings: aucun package disponible, fallback statique",
        );
        setPlans(FALLBACK_PLANS);
        setIsFallback(true);
        return;
      }

      const dynamic: DynamicPlan[] = packages.map((pkg) => {
        const meta = PACKAGE_UI_META[pkg.identifier] ?? {
          label: pkg.product.title || pkg.identifier,
          period: "",
          badge: null,
        };
        return {
          id: pkg.identifier,
          label: meta.label,
          // Prix localisé automatiquement par RevenueCat (devise + locale user)
          price: pkg.product.priceString,
          period: meta.period,
          badge: meta.badge,
          rcPackage: pkg,
        };
      });

      setPlans(sortPlans(dynamic));
    } catch (e) {
      // Erreur réseau ou SDK → fallback statique, pas de message d'erreur bloquant
      console.error("[PaywallModal] getOfferings:", e);
      setPlans(FALLBACK_PLANS);
      setIsFallback(true);
    }
  }, []);

  return { plans, loading, isFallback, reload: load };
}

// ─── Squelette de chargement des plans ───────────────────────────────────────
function PlansSkeleton() {
  const { t } = useTheme();
  return (
    <View style={{ gap: 8, marginBottom: 8 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            pw.planCard,
            {
              backgroundColor: t.bg.cardAlt,
              borderColor: t.border.light,
              height: 56,
              opacity: 0.5 + i * 0.15,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Section contact ──────────────────────────────────────────────────────────
function ContactSection() {
  const { t } = useTheme();
  return (
    <View style={cs.container}>
      <View style={[cs.divider, { backgroundColor: t.border.light }]} />
      <Text style={[cs.label, { color: t.text.muted }]}>
        Besoin d'aide ou d'un accès personnalisé ?
      </Text>
      <View style={cs.btns}>
        <TouchableOpacity
          style={[
            cs.btn,
            { backgroundColor: "#25D36618", borderColor: "#25D36640" },
          ]}
          onPress={openWhatsApp}
          activeOpacity={0.75}
        >
          <Text style={cs.btnIcon}>💬</Text>
          <View style={cs.btnBody}>
            <Text style={[cs.btnLabel, { color: "#25D366" }]}>WhatsApp</Text>
            <Text style={[cs.btnSub, { color: t.text.muted }]}>
              +212 646 534 846
            </Text>
          </View>
          <Text style={[cs.arrow, { color: t.border.normal }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            cs.btn,
            { backgroundColor: Colors.blue[50], borderColor: Colors.blue[100] },
          ]}
          onPress={openEmail}
          activeOpacity={0.75}
        >
          <Text style={cs.btnIcon}>✉️</Text>
          <View style={cs.btnBody}>
            <Text style={[cs.btnLabel, { color: Colors.blue[600] }]}>
              Email
            </Text>
            <Text style={[cs.btnSub, { color: t.text.muted }]}>
              abdoulaziz.dev@gmail.com
            </Text>
          </View>
          <Text style={[cs.arrow, { color: t.border.normal }]}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tab Code promo ───────────────────────────────────────────────────────────
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
  const { t } = useTheme();
  const shiftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const dur = Platform.OS === "ios" ? 260 : 160;
    const s1 = Keyboard.addListener(showEvt, (e) => {
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
        <View style={[ct.iconWrap, { backgroundColor: Colors.blue[600] }]}>
          <Text style={ct.icon}>◈</Text>
        </View>
        <Text style={[ct.title, { color: t.text.primary }]}>
          Entrez votre code
        </Text>
        <Text style={[ct.sub, { color: t.text.secondary }]}>
          Si vous avez reçu un code d'activation, saisissez-le ci-dessous pour
          activer Premium gratuitement.
        </Text>

        <TextInput
          style={[
            ct.input,
            {
              backgroundColor: t.bg.cardAlt,
              color: t.text.primary,
              borderColor: t.border.normal,
            },
          ]}
          placeholder="Ex: NETOFF-PRO-2025"
          placeholderTextColor={t.text.muted}
          value={promoCode}
          onChangeText={setPromoCode}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />

        <TouchableOpacity
          style={[
            ct.btn,
            {
              backgroundColor:
                !promoCode.trim() || codeLoading
                  ? Colors.blue[200]
                  : Colors.blue[600],
            },
          ]}
          onPress={onSubmit}
          disabled={!promoCode.trim() || codeLoading}
          activeOpacity={0.85}
        >
          {codeLoading ? (
            <ActivityIndicator color={Colors.gray[0]} size="small" />
          ) : (
            <Text style={ct.btnText}>Activer le code</Text>
          )}
        </TouchableOpacity>

        <ContactSection />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function PaywallModal({
  visible,
  onClose,
  onUpgraded,
  reason = "general",
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  // Plans chargés dynamiquement depuis RevenueCat
  const {
    plans,
    loading: plansLoading,
    isFallback,
    reload,
  } = useDynamicPlans();

  // État premium courant (pour détecter si déjà premium à l'ouverture)
  const [currentState, setCurrentState] = useState<{ isPremium: boolean }>({
    isPremium: false,
  });
  const [syncing, setSyncing] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<string>("netoff_yearly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [activeTab, setActiveTab] = useState<"plans" | "code">("plans");
  const [promoCode, setPromoCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const msg = REASON_MESSAGES[reason] ?? REASON_MESSAGES.general;

  // Table de fonctionnalités construite depuis FREE_LIMITS
  const FEATURES = buildFeatures();

  // ── Synchronisation à l'ouverture ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setActiveTab("plans");
      setPromoCode("");
      setSelectedPlan("netoff_yearly"); // toujours annuel par défaut

      // Lancer en parallèle : animation + chargement données
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

      // Charger les offres et synchroniser l'état premium
      reload();
      syncState();
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

  // Sync état local + RevenueCat à l'ouverture
  const syncState = async () => {
    setSyncing(true);
    try {
      // 1. Lire l'état local d'abord (rapide)
      const localState = await SubscriptionService.getState();
      setCurrentState({ isPremium: localState.isPremium });

      // 2. Synchroniser avec RevenueCat (peut révéler un abonnement expiré/restauré)
      const rcIsPremium = await SubscriptionService.syncWithRevenueCat();
      if (rcIsPremium && !localState.isPremium) {
        // RevenueCat dit premium mais pas en local → fermer directement
        onUpgraded();
        onClose();
      } else if (!rcIsPremium) {
        const refreshed = await SubscriptionService.getState();
        setCurrentState({ isPremium: refreshed.isPremium });
      }
    } catch (e) {
      console.warn("[PaywallModal] syncState:", e);
    } finally {
      setSyncing(false);
    }
  };

  // ── Achat via RevenueCat ────────────────────────────────────────────────────
  // Si rcPackage est disponible (plans RC chargés), on l'utilise directement.
  // Sinon (fallback statique), on délègue à SubscriptionService.purchase(id).
  const handleUpgrade = async () => {
    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) return;
    setLoading(true);

    const contactAlert = () =>
      Alert.alert("Besoin d'aide ?", "Contactez-nous directement :", [
        { text: "WhatsApp", onPress: openWhatsApp },
        { text: "Email", onPress: openEmail },
        { text: "Fermer", style: "cancel" },
      ]);

    const showPurchaseError = (code: string) =>
      Alert.alert("Paiement impossible", friendlyPurchaseError(code), [
        { text: "Réessayer", onPress: handleUpgrade },
        { text: "Nous contacter", onPress: contactAlert },
        { text: "Annuler", style: "cancel" },
      ]);

    try {
      if (plan.rcPackage) {
        // ── Chemin nominal : package RC disponible ────────────────────────────
        const { customerInfo } = await Purchases.purchasePackage(
          plan.rcPackage,
        );
        const isPremium =
          Object.keys(customerInfo.entitlements.active).length > 0;
        if (isPremium) {
          const entitlement = Object.values(
            customerInfo.entitlements.active,
          )[0] as any;
          await SubscriptionService.activateFromPurchase(
            entitlement?.expirationDate ?? undefined,
          );
          onUpgraded();
          onClose();
        } else {
          showPurchaseError("NOT_CONFIRMED");
        }
      } else {
        // ── Chemin fallback : plans statiques, on passe par le service ────────
        const result = await SubscriptionService.purchase(plan.id);
        if (result.success) {
          onUpgraded();
          onClose();
        } else if (result.error !== "USER_CANCELLED") {
          showPurchaseError(result.error ?? "PURCHASE_FAILED");
        }
      }
    } catch (e: any) {
      if (e?.userCancelled) return; // silencieux
      showPurchaseError("PURCHASE_FAILED");
    } finally {
      setLoading(false);
    }
  };

  // ── Restauration via RevenueCat ─────────────────────────────────────────────
  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await SubscriptionService.restore();
      if (result.success) {
        onUpgraded();
        onClose();
        Alert.alert(
          "✓ Achat restauré",
          "Votre abonnement Premium a été restauré.",
        );
      } else {
        Alert.alert(
          "Aucun achat trouvé",
          "Aucun achat Premium associé à votre compte.\nSi vous pensez qu'il s'agit d'une erreur, contactez-nous.",
          [
            { text: "WhatsApp", onPress: openWhatsApp },
            { text: "Email", onPress: openEmail },
            { text: "OK", style: "cancel" },
          ],
        );
      }
    } finally {
      setRestoring(false);
    }
  };

  // ── Code promo ──────────────────────────────────────────────────────────────
  const handlePromoCode = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setCodeLoading(true);
    try {
      const result = await SubscriptionService.activateWithCode(code);
      if (result.success) {
        onUpgraded();
        onClose();
        Alert.alert("⚡ Premium activé !", "Votre code a été validé !");
      } else {
        Alert.alert("Code invalide", friendlyPromoError(result.error));
      }
    } finally {
      setCodeLoading(false);
    }
  };

  // ── Rendu de la liste des plans (dynamique) ─────────────────────────────────
  const renderPlans = () => {
    if (plansLoading) return <PlansSkeleton />;

    return plans.map((plan) => (
      <TouchableOpacity
        key={plan.id}
        style={[
          pw.planCard,
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          selectedPlan === plan.id && {
            backgroundColor: t.bg.accent,
            borderColor: Colors.blue[500],
          },
        ]}
        onPress={() => setSelectedPlan(plan.id)}
        activeOpacity={0.8}
      >
        {plan.badge && (
          <View style={[pw.planBadge, { backgroundColor: Colors.blue[600] }]}>
            <Text style={pw.planBadgeText}>{plan.badge}</Text>
          </View>
        )}
        <View style={pw.planLeft}>
          <View
            style={[
              pw.planRadio,
              {
                borderColor:
                  selectedPlan === plan.id ? Colors.blue[500] : t.border.normal,
              },
            ]}
          >
            {selectedPlan === plan.id && <View style={pw.planRadioDot} />}
          </View>
          <Text
            style={[
              pw.planLabel,
              {
                color:
                  selectedPlan === plan.id ? t.text.primary : t.text.secondary,
              },
            ]}
          >
            {plan.label}
          </Text>
        </View>
        <View style={pw.planRight}>
          <Text
            style={[
              pw.planPrice,
              {
                color:
                  selectedPlan === plan.id
                    ? Colors.blue[600]
                    : t.text.secondary,
              },
            ]}
          >
            {plan.price}
          </Text>
          <Text style={[pw.planPeriod, { color: t.text.muted }]}>
            {plan.period}
          </Text>
        </View>
      </TouchableOpacity>
    ));
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
              backgroundColor: t.bg.card,
              borderColor: t.border.light,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle + fermer */}
          <View style={pw.handleRow}>
            <View style={[pw.handle, { backgroundColor: t.border.normal }]} />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              style={[
                pw.closeBtn,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text style={[pw.closeBtnText, { color: t.text.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View
            style={[
              pw.tabs,
              { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
            ]}
          >
            {(["plans", "code"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  pw.tabBtn,
                  activeTab === tab && { backgroundColor: t.bg.accent },
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  setActiveTab(tab);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    pw.tabBtnText,
                    { color: activeTab === tab ? t.text.link : t.text.muted },
                  ]}
                >
                  {tab === "plans" ? "Abonnement" : "Code promo"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Onglet Plans ── */}
          {activeTab === "plans" && (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Indicateur de synchronisation discret */}
                {syncing && (
                  <View style={pw.syncRow}>
                    <ActivityIndicator size="small" color={t.text.muted} />
                    <Text style={[pw.syncText, { color: t.text.muted }]}>
                      Vérification…
                    </Text>
                  </View>
                )}

                {/* Hero */}
                <View style={pw.hero}>
                  <View
                    style={[
                      pw.heroIconWrap,
                      { backgroundColor: Colors.blue[600] },
                    ]}
                  >
                    <Text style={pw.heroIcon}>{msg.icon}</Text>
                  </View>
                  <View
                    style={[
                      pw.premiumBadge,
                      {
                        backgroundColor: Colors.purple[50],
                        borderColor: Colors.purple[100],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        pw.premiumBadgeText,
                        { color: Colors.purple[600] },
                      ]}
                    >
                      ◎ NETOFF PREMIUM
                    </Text>
                  </View>
                  <Text style={[pw.heroTitle, { color: t.text.primary }]}>
                    {msg.title}
                  </Text>
                  <Text style={[pw.heroSub, { color: t.text.secondary }]}>
                    {msg.sub}
                  </Text>
                </View>

                {/* Table des fonctionnalités (construite depuis FREE_LIMITS) */}
                <View
                  style={[
                    pw.tableWrap,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.light,
                    },
                  ]}
                >
                  <View
                    style={[
                      pw.tableHeader,
                      { backgroundColor: t.bg.cardSunken },
                    ]}
                  >
                    <Text style={[pw.tableHeaderCell, { color: t.text.muted }]}>
                      FONCTIONNALITÉ
                    </Text>
                    <Text
                      style={[
                        pw.tableHeaderCell,
                        pw.headerFree,
                        { color: t.text.muted },
                      ]}
                    >
                      GRATUIT
                    </Text>
                    <Text
                      style={[
                        pw.tableHeaderCell,
                        pw.headerPremium,
                        { color: Colors.blue[600] },
                      ]}
                    >
                      PREMIUM
                    </Text>
                  </View>
                  {FEATURES.map((f, i) => (
                    <View
                      key={f.label}
                      style={[
                        pw.tableRow,
                        i % 2 === 0 && { backgroundColor: t.bg.card },
                      ]}
                    >
                      <View style={pw.tableFeature}>
                        <Text style={[pw.featureIcon, { color: t.text.muted }]}>
                          {f.icon}
                        </Text>
                        <Text
                          style={[pw.featureLabel, { color: t.text.secondary }]}
                        >
                          {f.label}
                        </Text>
                      </View>
                      <Text style={[pw.freeVal, { color: t.text.muted }]}>
                        {f.free}
                      </Text>
                      <Text
                        style={[pw.premiumVal, { color: Colors.blue[600] }]}
                      >
                        {f.premium}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Plans dynamiques */}
                <Text style={[pw.plansTitle, { color: t.text.muted }]}>
                  CHOISIR UN PLAN
                </Text>
                {isFallback && (
                  <View
                    style={[
                      pw.fallbackBanner,
                      {
                        backgroundColor: t.bg.cardAlt,
                        borderColor: t.border.light,
                      },
                    ]}
                  >
                    <Text
                      style={[pw.fallbackBannerText, { color: t.text.muted }]}
                    >
                      ⚠ Prix indicatifs — connexion requise pour confirmer.
                    </Text>
                  </View>
                )}
                {renderPlans()}

                <Text style={[pw.legalText, { color: t.text.muted }]}>
                  Paiement sécurisé via Google Play.
                  {Platform.OS === "ios" ? " App Store." : ""} Annulable à tout
                  moment.
                </Text>

                <ContactSection />
              </ScrollView>

              {/* CTA */}
              <TouchableOpacity
                style={[
                  pw.ctaBtn,
                  {
                    backgroundColor:
                      loading || !selectedPlan
                        ? Colors.blue[200]
                        : Colors.blue[600],
                  },
                ]}
                onPress={handleUpgrade}
                disabled={loading || !selectedPlan}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.gray[0]} />
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
                  <ActivityIndicator color={t.text.muted} size="small" />
                ) : (
                  <Text style={[pw.restoreBtnText, { color: t.text.muted }]}>
                    Restaurer un achat · Continuer gratuitement
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ── Onglet Code promo ── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const ct = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: { fontSize: 28, color: Colors.gray[0] },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  input: {
    width: "100%",
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
    borderWidth: 1,
    textAlign: "center",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  btn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  btnText: { color: Colors.gray[0], fontSize: 15, fontWeight: "800" },
});

const cs = StyleSheet.create({
  container: { width: "100%", marginTop: 8, paddingBottom: 4 },
  divider: { height: 1, marginBottom: 18 },
  label: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 14,
    fontWeight: "500",
  },
  btns: { flexDirection: "column", gap: 10 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
  },
  btnIcon: { fontSize: 20 },
  btnBody: { flex: 1 },
  btnLabel: { fontSize: 13, fontWeight: "700", marginBottom: 1 },
  btnSub: { fontSize: 11 },
  arrow: { fontSize: 20, fontWeight: "300" },
});

const pw = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "95%",
  },
  handleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 12,
    marginBottom: 4,
  },
  handle: { height: 4, borderRadius: 2, flex: 1, marginRight: 8 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  closeBtnText: { fontSize: 11, fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  hero: { alignItems: "center", paddingVertical: 16 },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  heroIcon: { fontSize: 28, color: Colors.gray[0] },
  premiumBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    marginBottom: 8,
  },
  premiumBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  tableWrap: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    flex: 2,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  headerFree: { flex: 1.2, textAlign: "center" },
  headerPremium: { flex: 1.5, textAlign: "center" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableFeature: { flex: 2, flexDirection: "row", alignItems: "center", gap: 6 },
  featureIcon: { fontSize: 11 },
  featureLabel: { fontSize: 12, fontWeight: "500" },
  freeVal: { flex: 1.2, fontSize: 11, textAlign: "center" },
  premiumVal: {
    flex: 1.5,
    fontSize: 11,
    textAlign: "center",
    fontWeight: "700",
  },
  plansTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    overflow: "hidden",
  },
  planBadge: {
    position: "absolute",
    top: -1,
    right: -1,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planBadgeText: { fontSize: 9, fontWeight: "800", color: Colors.gray[0] },
  planLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  planRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  planRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.blue[500],
  },
  planLabel: { fontSize: 14, fontWeight: "700" },
  planRight: { alignItems: "flex-end" },
  planPrice: { fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
  planPeriod: { fontSize: 10, marginTop: 1 },
  fallbackBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  fallbackBannerText: { fontSize: 11, textAlign: "center" },
  legalText: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 16,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  syncText: { fontSize: 11 },
  ctaBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  ctaBtnText: {
    color: Colors.gray[0],
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  restoreBtn: { paddingVertical: 12, alignItems: "center" },
  restoreBtnText: { fontSize: 12, fontWeight: "500" },
});
