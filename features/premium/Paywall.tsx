/**
 * features/premium/Paywall.tsx — Écran d'abonnement
 *
 * Un seul paywall pour toute l'app. Le motif d'ouverture (`reason`) change
 * l'accroche mais pas la structure : l'utilisateur voit toujours le même
 * panneau, ce qui rend l'offre lisible plutôt qu'opportuniste.
 *
 * Trois voies d'accès à Pro, dans cet ordre :
 *   1. achat via le store (RevenueCat),
 *   2. restauration d'un achat existant,
 *   3. code promotionnel — ou contact direct.
 *
 * Règle de fond : aucune de ces voies ne doit jamais être hors d'atteinte.
 * Quand le store est indisponible (build sans facturation, appareil sans
 * Play Store, pays non couvert), le panneau le dit et propose immédiatement
 * le code et le contact direct, au lieu d'un bouton d'achat qui échouera.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { SUPPORT, mailtoUrl, whatsappUrl } from "@/config/support";
import AppEvents from "@/services/app-events";
import SubscriptionService from "@/services/subscription.service";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  Badge,
  Button,
  Divider,
  Icon,
  Section,
  Sheet,
  Skeleton,
  Text,
  TextField,
  Touchable,
  toast,
} from "@/ui";
import {
  FALLBACK_PLANS,
  FEATURE_COMPARISON,
  REASON_COPY,
  fetchPlans,
  purchaseErrorMessage,
  type Plan,
} from "./plans";
import type { PaywallReason } from "./usePremium";

const CONTACT_MESSAGE = "Bonjour, je souhaite obtenir un accès Pro à NetOff.";

export type PaywallProps = {
  visible: boolean;
  reason?: PaywallReason;
  onClose: () => void;
  /** Appelé après une activation réussie (achat, restauration ou code). */
  onUpgraded?: () => void;
};

export function Paywall({
  visible,
  reason = "general",
  onClose,
  onUpgraded,
}: PaywallProps) {
  const { t } = useTheme();
  const copy = REASON_COPY[reason];

  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [storeReady, setStoreReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"purchase" | "restore" | "code" | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  // Le champ de code est plié par défaut : on l'amène à l'écran quand on le
  // déplie, sinon l'utilisateur tape « J'ai un code » et ne voit rien bouger.
  const pendingScroll = useRef(false);

  // Les offres ne sont chargées qu'à l'ouverture : inutile d'appeler le store
  // tant que l'utilisateur n'a pas demandé à voir les prix.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setCodeError(null);
    setShowCode(false);
    setLoadingPlans(SubscriptionService.isSdkReady());
    fetchPlans().then((result) => {
      if (cancelled) return;
      setPlans(result.plans);
      setStoreReady(result.fromStore);
      setSelected(
        (result.plans.find((p) => p.recommended) ?? result.plans[0])?.id ?? null,
      );
      setLoadingPlans(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const succeed = useCallback(
    (message: string) => {
      AppEvents.emit("premium:changed", true);
      toast.success(message);
      onUpgraded?.();
      onClose();
    },
    [onClose, onUpgraded],
  );

  const selectedPlan = plans.find((p) => p.id === selected);
  /** Le store peut-il réellement encaisser cette offre ? */
  const canBuy = !!selectedPlan?.rcPackage;

  const codeY = useRef(0);

  const scrollToCode = useCallback(() => {
    const y = Math.max(0, codeY.current - Spacing.md);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: true }));
  }, []);

  const revealCode = useCallback(() => {
    setCodeError(null);
    if (showCode) {
      scrollToCode();
      return;
    }
    pendingScroll.current = true;
    setShowCode(true);
  }, [showCode, scrollToCode]);

  const onCodeLayout = useCallback(
    (e: LayoutChangeEvent) => {
      codeY.current = e.nativeEvent.layout.y;
      if (!pendingScroll.current) return;
      pendingScroll.current = false;
      scrollToCode();
    },
    [scrollToCode],
  );

  const purchase = useCallback(async () => {
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;

    // Sans SDK ni offre réelle, proposer l'achat serait mentir : on bascule sur
    // les voies qui, elles, fonctionnent.
    if (!plan.rcPackage) {
      setError(
        "Le paiement n'est pas disponible sur cet appareil. Activez Pro avec un code, ou écrivez-nous : nous l'activons manuellement.",
      );
      revealCode();
      return;
    }

    setBusy("purchase");
    setError(null);
    try {
      const result = await SubscriptionService.purchase(plan.id);
      if (result.success) {
        succeed("NetOff Pro est activé. Merci !");
        return;
      }
      if (result.error === "USER_CANCELLED") return;
      setError(purchaseErrorMessage(result.error));
      revealCode();
    } finally {
      setBusy(null);
    }
  }, [plans, selected, succeed, revealCode]);

  const restore = useCallback(async () => {
    setBusy("restore");
    setError(null);
    try {
      const result = await SubscriptionService.restore();
      if (result.success) {
        succeed("Achat restauré.");
        return;
      }
      // `restore()` renvoie tantôt un code technique, tantôt une phrase :
      // on ne montre jamais un « SDK_NOT_READY » brut à l'utilisateur.
      const raw = result.error ?? "";
      setError(
        /^[A-Z_]+$/.test(raw)
          ? purchaseErrorMessage(raw)
          : raw || "Aucun achat à restaurer.",
      );
    } finally {
      setBusy(null);
    }
  }, [succeed]);

  const applyCode = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length < 3) {
      setCodeError("Saisissez le code reçu.");
      return;
    }
    setBusy("code");
    setCodeError(null);
    try {
      const result = await SubscriptionService.activateWithCode(trimmed);
      if (result.success) succeed("Code accepté — NetOff Pro est activé.");
      else setCodeError(result.error ?? "Ce code n'est pas valide.");
    } finally {
      setBusy(null);
    }
  }, [code, succeed]);

  const contactSupport = useCallback(async (channel: "whatsapp" | "email") => {
    const url =
      channel === "whatsapp"
        ? whatsappUrl(CONTACT_MESSAGE)
        : mailtoUrl("[NetOff] Accès Pro", CONTACT_MESSAGE);
    try {
      await Linking.openURL(url);
    } catch {
      setError(
        channel === "whatsapp"
          ? `WhatsApp n'a pas pu s'ouvrir. Écrivez-nous au ${SUPPORT.whatsappDisplay}.`
          : `Aucune application e-mail configurée. Écrivez-nous à ${SUPPORT.email}.`,
      );
    }
  }, []);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.92}
      error={error}
      scrollRef={scrollRef}
      contentStyle={st.sheetBody}
      footer={
        <>
          {canBuy ? (
            <Button
              label={
                selectedPlan
                  ? `Passer à Pro — ${selectedPlan.price}`
                  : "Passer à Pro"
              }
              icon="shield-star-outline"
              onPress={purchase}
              loading={busy === "purchase"}
              disabled={!selectedPlan || busy !== null}
              size="lg"
              fullWidth
            />
          ) : (
            <Button
              label="Nous écrire pour activer Pro"
              icon="whatsapp"
              onPress={() => contactSupport("whatsapp")}
              disabled={busy !== null}
              size="lg"
              fullWidth
            />
          )}
          <View style={st.footerLinks}>
            <Touchable
              onPress={restore}
              feedback="none"
              hitSlop={8}
              disabled={busy !== null}
            >
              <Text variant="footnote" tone="muted">
                {busy === "restore" ? "Restauration…" : "Restaurer un achat"}
              </Text>
            </Touchable>
            <Text variant="footnote" tone="faint">
              ·
            </Text>
            <Touchable onPress={revealCode} feedback="none" hitSlop={8}>
              <Text variant="footnote" tone="link">
                J'ai un code
              </Text>
            </Touchable>
          </View>
        </>
      }
    >
      {/* En-tête contextuel */}
      <View style={st.hero}>
        <View
          style={[
            st.heroIcon,
            { backgroundColor: t.intent.focus.bg, borderColor: t.intent.focus.border },
          ]}
        >
          <Icon name={copy.icon} size={28} color={t.intent.focus.accent} />
        </View>
        <Text variant="title2" center>
          {copy.title}
        </Text>
        <Text variant="callout" tone="secondary" center>
          {copy.message}
        </Text>
      </View>

      {/* Paiement indisponible : on l'annonce avant les prix, pas après l'échec */}
      {!storeReady && !loadingPlans ? (
        <View
          style={[
            st.notice,
            {
              backgroundColor: t.intent.warning.bg,
              borderColor: t.intent.warning.border,
            },
          ]}
        >
          <View style={st.noticeHead}>
            <Icon name="credit-card-off-outline" size={18} color={t.intent.warning.accent} />
            <Text variant="headline" style={st.flex}>
              Paiement indisponible ici
            </Text>
          </View>
          <Text variant="footnote" tone="secondary">
            Le store ne propose pas d'achat sur cet appareil. Écrivez-nous : nous
            activons Pro manuellement, ou nous vous envoyons un code.
          </Text>
          <ContactRow onContact={contactSupport} />
        </View>
      ) : null}

      {/* Code promotionnel — juste sous l'accroche, donc jamais à chercher */}
      {showCode ? (
        <View onLayout={onCodeLayout}>
          <Section title="Code promotionnel">
            <TextField
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase());
                setCodeError(null);
              }}
              placeholder="NETOFF-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={applyCode}
              icon="ticket-percent-outline"
              error={codeError ?? undefined}
              hint="Majuscules, tirets et espaces sont sans importance."
            />
            <Button
              label="Activer le code"
              variant="accent"
              icon="check"
              onPress={applyCode}
              loading={busy === "code"}
              disabled={busy !== null}
              size="lg"
              fullWidth
            />
            <Text variant="footnote" tone="faint">
              Pas de code ? Demandez-nous-en un :
            </Text>
            <ContactRow onContact={contactSupport} />
          </Section>
        </View>
      ) : null}

      {/* Offres */}
      <Section title="Choisir une formule">
        {loadingPlans ? (
          <View style={st.plans}>
            <Skeleton height={74} radius={Radius.md} />
            <Skeleton height={74} radius={Radius.md} />
          </View>
        ) : (
          <View style={st.plans}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={plan.id === selected}
                onSelect={() => setSelected(plan.id)}
              />
            ))}
          </View>
        )}
        {!storeReady && !loadingPlans ? (
          <Text variant="footnote" tone="faint">
            Prix indicatifs — les tarifs définitifs s'affichent depuis le store.
          </Text>
        ) : null}
      </Section>

      {/* Comparatif */}
      <Section title="Gratuit / Pro">
        <View style={[st.table, { borderColor: t.border.light, backgroundColor: t.bg.card }]}>
          <View style={st.tableHead}>
            <View style={st.tableLabel} />
            <Text variant="overline" tone="faint" center style={st.tableCol}>
              Gratuit
            </Text>
            <Text variant="overline" tone="focus" center style={st.tableCol}>
              Pro
            </Text>
          </View>
          {FEATURE_COMPARISON.map((f, i) => (
            <View key={f.label}>
              {i > 0 ? <Divider /> : null}
              <View style={st.tableRow}>
                <View style={st.tableLabel}>
                  <Icon name={f.icon} size={16} color={t.text.muted} />
                  <Text variant="callout" numberOfLines={2} style={st.flex}>
                    {f.label}
                  </Text>
                </View>
                <Text variant="footnote" tone="muted" center style={st.tableCol} numberOfLines={2}>
                  {f.free}
                </Text>
                <Text variant="footnote" tone="focus" center style={st.tableCol} numberOfLines={2}>
                  {f.premium}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      {/* Contact — toujours visible en bas, même quand le store fonctionne */}
      <Section title="Une question ?">
        <ContactRow onContact={contactSupport} />
        <Text variant="footnote" tone="faint" center selectable>
          {SUPPORT.whatsappDisplay} · {SUPPORT.email}
        </Text>
      </Section>

      <Text variant="footnote" tone="faint" center>
        Abonnement renouvelé automatiquement sauf annulation depuis votre compte
        du store. L'offre « à vie » est un paiement unique.
      </Text>
    </Sheet>
  );
}

// ─── Contact direct ──────────────────────────────────────────────────────────

function ContactRow({
  onContact,
}: {
  onContact: (channel: "whatsapp" | "email") => void;
}) {
  return (
    <View style={st.supportRow}>
      <Button
        label="WhatsApp"
        icon="whatsapp"
        variant="secondary"
        size="sm"
        onPress={() => onContact("whatsapp")}
        style={st.flex}
      />
      <Button
        label="E-mail"
        icon="email-outline"
        variant="secondary"
        size="sm"
        onPress={() => onContact("email")}
        style={st.flex}
      />
    </View>
  );
}

// ─── Carte d'offre ───────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTheme();
  return (
    <Touchable
      onPress={onSelect}
      feedback="subtle"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        st.plan,
        {
          backgroundColor: selected ? t.intent.focus.bg : t.bg.card,
          borderColor: selected ? t.intent.focus.accent : t.border.light,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <View
        style={[
          st.radio,
          {
            borderColor: selected ? t.intent.focus.accent : t.border.normal,
            backgroundColor: selected ? t.intent.focus.accent : "transparent",
          },
        ]}
      >
        {selected ? <Icon name="check" size={13} color={t.intent.focus.onAccent} /> : null}
      </View>

      <View style={st.planText}>
        <View style={st.planTitleRow}>
          <Text variant="headline" numberOfLines={1}>
            {plan.label}
          </Text>
          {plan.badge ? <Badge label={plan.badge} tone="focus" /> : null}
        </View>
        <Text variant="footnote" tone="muted" numberOfLines={1}>
          {plan.period}
        </Text>
      </View>

      <Text variant="title3" tone={selected ? "focus" : "primary"} tabular numberOfLines={1}>
        {plan.price}
      </Text>
    </Touchable>
  );
}

const st = StyleSheet.create({
  // Le dernier bloc ne doit pas coller au pied collant du panneau.
  sheetBody: { paddingBottom: Spacing.lg },
  hero: { alignItems: "center", gap: Spacing.xs, paddingBottom: Spacing.xs },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  notice: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  noticeHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  plans: { gap: Spacing.sm },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  planText: { flex: 1, gap: 2 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  supportRow: { flexDirection: "row", gap: Spacing.sm },
  table: { borderRadius: Radius.md, borderWidth: 1, overflow: "hidden" },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tableLabel: { flex: 1.4, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  tableCol: { flex: 1, textAlign: "center" },
  flex: { flex: 1 },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
});
