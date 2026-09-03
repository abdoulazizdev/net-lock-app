/**
 * app/allowlist.tsx — Mode liste blanche
 *
 * Inversion de la logique habituelle : au lieu de désigner ce qui est bloqué,
 * on désigne ce qui reste autorisé, tout le reste étant coupé.
 *
 * Ce mode est aussi la réponse aux surcouches constructeur agressives
 * (Huawei/EMUI notamment) : le tunnel capture tout le trafic par défaut, il
 * n'existe donc plus de chemin réseau alternatif à contourner.
 */

import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { plural } from "@/lib/format";
import { AppFilterBar } from "@/features/apps/AppFilterBar";
import { APP_ROW_HEIGHT, AppRow } from "@/features/apps/AppRow";
import { SelectionBar } from "@/features/apps/SelectionBar";
import { useAppCatalog, type AppEntry } from "@/features/apps/useAppCatalog";
import { useAppFilter } from "@/features/apps/useAppFilter";
import { useAppSelection } from "@/features/apps/useAppSelection";
import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import { useParentalGuard } from "@/features/security/useParentalGuard";
import AllowlistService from "@/services/allowlist.service";
import AppEvents from "@/services/app-events";
import VpnService from "@/services/vpn.service";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppBar,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  SkeletonList,
  Text,
  toast,
} from "@/ui";

/** Apps qu'il est presque toujours souhaitable de laisser passer. */
const RECOMMENDED_KEYWORDS = [
  "phone",
  "dialer",
  "contacts",
  "message",
  "mms",
  "maps",
  "bank",
  "wallet",
  "authenticator",
  "health",
];

export default function AllowlistScreen() {
  const { t } = useTheme();
  const catalog = useAppCatalog();
  const filter = useAppFilter(catalog.apps);
  const { limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [enabled, setEnabled] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  // L'écran est réservé à Pro : on l'annonce à l'ouverture plutôt que de
  // laisser l'utilisateur préparer une sélection inutilisable.
  useEffect(() => {
    if (!limits.canUseAllowlist().allowed) paywall.open("allowlist");
  }, [limits, paywall]);

  useEffect(() => {
    AllowlistService.getState()
      .then((state) => {
        setEnabled(state.enabled);
        setAllowed(new Set(state.packages));
      })
      .catch(() => {})
      .finally(() => setLoadingState(false));
  }, []);

  useEffect(() => {
    if (filter.filters.scope !== "user") catalog.loadSystemApps();
  }, [filter.filters.scope, catalog]);

  const entries = useMemo<AppEntry[]>(
    () =>
      filter.results.map((app) => ({
        ...app,
        // `AppRow` en mode inversé lit `blocked` : autorisée = non bloquée.
        blocked: !allowed.has(app.packageName),
      })),
    [filter.results, allowed],
  );

  const selection = useAppSelection(entries);

  /** Autorise ou retire toute la sélection d'un coup. */
  const applyToSelection = useCallback(
    (allow: boolean) => {
      setAllowed((prev) => {
        const next = new Set(prev);
        selection.selected.forEach((packageName) =>
          allow ? next.add(packageName) : next.delete(packageName),
        );
        return next;
      });
      selection.exit();
    },
    [selection],
  );

  const toggle = useCallback((app: AppEntry) => {
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(app.packageName)) next.delete(app.packageName);
      else next.add(app.packageName);
      return next;
    });
  }, []);

  const addRecommended = useCallback(() => {
    const matches = catalog.apps
      .filter((app) => {
        const haystack = `${app.appName} ${app.packageName}`.toLowerCase();
        return RECOMMENDED_KEYWORDS.some((kw) => haystack.includes(kw));
      })
      .map((app) => app.packageName);

    if (matches.length === 0) {
      toast.info("Aucune app essentielle détectée automatiquement.");
      return;
    }
    setAllowed((prev) => new Set([...prev, ...matches]));
    toast.success(plural(matches.length, "app ajoutée", "apps ajoutées"));
  }, [catalog.apps]);

  const save = useCallback(async () => {
    if (!paywall.enforce(limits.canUseAllowlist())) return;
    if (!(await guard("change_rules"))) return;

    setSaving(true);
    try {
      await AllowlistService.enable([...allowed]);
      // Sans protection active, la liste blanche ne coupe rien.
      if (!(await VpnService.isVpnActive())) await VpnService.startVpn();

      setEnabled(true);
      AppEvents.emit("allowlist:changed", true);
      AppEvents.emit("rules:changed", undefined);
      toast.success(
        `Liste blanche active — ${plural(allowed.size, "app autorisée", "apps autorisées")}.`,
      );
      router.back();
    } catch {
      toast.error("La liste blanche n'a pas pu être appliquée.");
    } finally {
      setSaving(false);
    }
  }, [paywall, limits, guard, allowed]);

  const disable = useCallback(async () => {
    setConfirmDisable(false);
    if (!(await guard("change_rules"))) return;

    setSaving(true);
    try {
      await AllowlistService.disable();
      setEnabled(false);
      setAllowed(new Set());
      AppEvents.emit("allowlist:changed", false);
      AppEvents.emit("rules:changed", undefined);
      toast.success("Retour au mode blocage normal.");
      router.back();
    } catch {
      toast.error("La désactivation a échoué.");
    } finally {
      setSaving(false);
    }
  }, [guard]);

  const header = (
    <View style={st.header}>
      <Card
        style={[
          st.explain,
          {
            backgroundColor: enabled ? t.intent.info.bg : t.bg.card,
            borderColor: enabled ? t.intent.info.border : t.border.light,
          },
        ]}
      >
        <Icon
          name={enabled ? "playlist-check" : "playlist-remove"}
          size={22}
          color={t.intent.info.accent}
        />
        <View style={st.flex}>
          <Text variant="headline">
            {enabled ? "Liste blanche active" : "Tout bloquer sauf…"}
          </Text>
          <Text variant="footnote" tone="muted">
            Seules les apps cochées gardent l'accès à internet. C'est le mode le
            plus strict, et le plus fiable sur les téléphones qui coupent les
            services en arrière-plan.
          </Text>
        </View>
      </Card>

      <View
        style={[
          st.counter,
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
        ]}
      >
        <Text variant="title2" tone="allowed" tabular>
          {allowed.size}
        </Text>
        <Text variant="footnote" tone="muted" style={st.flex}>
          {allowed.size === 0
            ? "Aucune app autorisée — tout serait coupé."
            : plural(allowed.size, "app conserve internet", "apps conservent internet")}
        </Text>
        <Button
          label="Essentielles"
          icon="auto-fix"
          variant="secondary"
          size="sm"
          onPress={addRecommended}
        />
      </View>

      {allowed.size === 0 ? (
        <View
          style={[
            st.warning,
            { backgroundColor: t.intent.warning.bg, borderColor: t.intent.warning.border },
          ]}
        >
          <Icon name="alert-outline" size={16} color={t.intent.warning.accent} />
          <Text variant="footnote" tone="warning" style={st.flex}>
            Pensez à autoriser au minimum le téléphone et les messages.
          </Text>
        </View>
      ) : null}

      <AppFilterBar
        query={filter.query}
        onQueryChange={filter.setQuery}
        filters={filter.filters}
        onFiltersChange={filter.setFilters}
        isFiltered={filter.isFiltered}
        onReset={filter.reset}
        systemLoading={catalog.systemLoading}
      />
    </View>
  );

  return (
    <Screen>
      <AppBar
        title="Liste blanche"
        subtitle={enabled ? "Mode actif" : "Mode inactif"}
        back
        right={
          <IconButton
            icon={selection.active ? "close" : "checkbox-multiple-marked-outline"}
            variant={selection.active ? "filled" : "soft"}
            onPress={() => (selection.active ? selection.exit() : selection.enter())}
            accessibilityLabel={
              selection.active ? "Quitter la sélection" : "Sélectionner plusieurs apps"
            }
          />
        }
      />

      {catalog.loading || loadingState ? (
        <View style={st.loadingWrap}>
          {header}
          <SkeletonList count={6} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.packageName}
          renderItem={({ item }) => (
            <AppRow
              app={item}
              onToggle={toggle}
              invert
              selectable={selection.active}
              selected={selection.isSelected(item.packageName)}
              onSelect={(app) => selection.toggle(app.packageName)}
              onLongPress={(app) => selection.enter(app.packageName)}
            />
          )}
          getItemLayout={getItemLayout}
          ListHeaderComponent={header}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          initialNumToRender={10}
          windowSize={9}
          ListEmptyComponent={
            <EmptyState
              icon="magnify-close"
              title="Aucune application"
              message="Modifiez la recherche ou les filtres."
              actionLabel="Réinitialiser"
              onAction={filter.reset}
              actionVariant="secondary"
              compact
            />
          }
        />
      )}

      {selection.active ? (
        <SelectionBar
          count={selection.count}
          alreadyCount={
            entries.filter(
              (app) => selection.isSelected(app.packageName) && !app.blocked,
            ).length
          }
          alreadyLabel={["déjà autorisée", "déjà autorisées"]}
          allSelected={selection.allVisibleSelected}
          onToggleAll={selection.toggleAllVisible}
          onBlock={() => applyToSelection(true)}
          onUnblock={() => applyToSelection(false)}
          onCancel={selection.exit}
          blockLabel="Autoriser"
          unblockLabel="Retirer"
        />
      ) : null}

      <View style={[st.footer, { backgroundColor: t.bg.card, borderTopColor: t.border.light }]}>
        <Button
          label={enabled ? "Mettre à jour la liste" : "Activer la liste blanche"}
          icon="shield-check"
          onPress={save}
          loading={saving}
          disabled={saving}
          size="lg"
          fullWidth
        />
        {enabled ? (
          <Button
            label="Revenir au mode normal"
            variant="ghost"
            onPress={() => setConfirmDisable(true)}
            disabled={saving}
            fullWidth
          />
        ) : null}
      </View>

      <Dialog
        visible={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        title="Désactiver la liste blanche ?"
        message="Le blocage repassera en mode normal : seules les apps que vous avez explicitement bloquées seront coupées."
        actions={
          <>
            <Button label="Désactiver" variant="danger" onPress={disable} fullWidth />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => setConfirmDisable(false)}
              fullWidth
            />
          </>
        }
      />

      <Paywall
        visible={paywall.visible}
        reason={paywall.reason}
        onClose={() => {
          paywall.close();
          if (!limits.canUseAllowlist().allowed) router.back();
        }}
      />

      <ParentalGate />
    </Screen>
  );
}

const ROW_STRIDE = APP_ROW_HEIGHT + Spacing.sm;
const getItemLayout = (_: unknown, index: number) => ({
  length: ROW_STRIDE,
  offset: ROW_STRIDE * index,
  index,
});

const st = StyleSheet.create({
  header: { gap: Spacing.md, paddingBottom: Spacing.md },
  loadingWrap: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  explain: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  list: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge,
    gap: Spacing.sm,
  },
  footer: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
});
