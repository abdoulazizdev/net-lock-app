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
 *   3. code promotionnel.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

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

/** Contact direct — utile là où les paiements du store sont indisponibles. */
const SUPPORT = {
  whatsapp: "+212646534846",
  email: "abdoulaziz.dev@gmail.com",
} as const;

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
  const [fromStore, setFromStore] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"purchase" | "restore" | "code" | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Les offres ne sont chargées qu'à l'ouverture : inutile d'appeler le store
  // tant que l'utilisateur n'a pas demandé à voir les prix.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setLoadingPlans(SubscriptionService.isSdkReady());
    fetchPlans().then((result) => {
      if (cancelled) return;
      setPlans(result.plans);
      setFromStore(result.fromStore);
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

  const purchase = useCallback(async () => {
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;

    // Sans SDK ni offre réelle, proposer l'achat serait mentir : on redirige
    // vers le support, seule voie d'activation dans ce cas.
    if (!plan.rcPackage) {
      setError(
        "Le paiement n'est pas disponible sur cet appareil. Activez Pro avec un code ou écrivez-nous.",
      );
      setShowCode(true);
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
    } finally {
      setBusy(null);
    }
  }, [plans, selected, succeed]);

  const restore = useCallback(async () => {
    setBusy("restore");
    setError(null);
    try {
      const result = await SubscriptionService.restore();
      if (result.success) succeed("Achat restauré.");
      else setError(result.error ?? "Aucun achat à restaurer.");
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

  const contactSupport = useCallback((channel: "whatsapp" | "email") => {
    const message = "Bonjour, je souhaite obtenir un accès Pro à NetOff.";
    const url =
      channel === "whatsapp"
        ? `https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent(message)}`
        : `mailto:${SUPPORT.email}?subject=${encodeURIComponent("[NetOff] Accès Pro")}&body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() =>
      setError("Aucune application disponible pour ce mode de contact."),
    );
  }, []);

  const selectedPlan = plans.find((p) => p.id === selected);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.94}
      error={error}
      footer={
        <>
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
          <View style={st.footerLinks}>
            <Touchable onPress={restore} feedback="none" hitSlop={8} disabled={busy !== null}>
              <Text variant="footnote" tone="muted">
                {busy === "restore" ? "Restauration…" : "Restaurer un achat"}
              </Text>
            </Touchable>
            <Text variant="footnote" tone="faint">
              ·
            </Text>
            <Touchable onPress={() => setShowCode((v) => !v)} feedback="none" hitSlop={8}>
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
        <Text variant="title1" center>
          {copy.title}
        </Text>
        <Text variant="body" tone="secondary" center>
          {copy.message}
        </Text>
      </View>

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
        {!fromStore && !loadingPlans ? (
          <Text variant="footnote" tone="faint">
            Prix indicatifs — les tarifs définitifs s'affichent depuis le store.
          </Text>
        ) : null}
      </Section>

      {/* Code promotionnel */}
      {showCode ? (
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
            icon="ticket-percent-outline"
            error={codeError ?? undefined}
          />
          <Button
            label="Activer le code"
            variant="secondary"
            onPress={applyCode}
            loading={busy === "code"}
            disabled={busy !== null}
            fullWidth
          />
          <View style={st.supportRow}>
            <Button
              label="WhatsApp"
              icon="whatsapp"
              variant="ghost"
              size="sm"
              onPress={() => contactSupport("whatsapp")}
            />
            <Button
              label="E-mail"
              icon="email-outline"
              variant="ghost"
              size="sm"
              onPress={() => contactSupport("email")}
            />
          </View>
        </Section>
      ) : null}

      {/* Comparatif */}
      <Section title="Gratuit / Pro">
        <View style={[st.table, { borderColor: t.border.light, backgroundColor: t.bg.card }]}>
          <View style={st.tableHead}>
            <View style={st.tableLabel} />
            <Text variant="overline" tone="faint" style={st.tableCol}>
              Gratuit
            </Text>
            <Text variant="overline" tone="focus" style={st.tableCol}>
              Pro
            </Text>
          </View>
          {FEATURE_COMPARISON.map((f, i) => (
            <View key={f.label}>
              {i > 0 ? <Divider /> : null}
              <View style={st.tableRow}>
                <View style={st.tableLabel}>
                  <Icon name={f.icon} size={16} color={t.text.muted} />
                  <Text variant="callout" numberOfLines={1} style={st.flex}>
                    {f.label}
                  </Text>
                </View>
                <Text variant="footnote" tone="muted" center style={st.tableCol} numberOfLines={1}>
                  {f.free}
                </Text>
                <Text variant="footnote" tone="focus" center style={st.tableCol} numberOfLines={1}>
                  {f.premium}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Text variant="footnote" tone="faint" center>
        Abonnement renouvelé automatiquement sauf annulation depuis votre compte
        du store. L'offre « à vie » est un paiement unique.
      </Text>
    </Sheet>
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
  hero: { alignItems: "center", gap: Spacing.sm, paddingBottom: Spacing.sm },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  plans: { gap: Spacing.sm },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
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
  supportRow: { flexDirection: "row", justifyContent: "center", gap: Spacing.sm },
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
    paddingVertical: Spacing.md,
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
