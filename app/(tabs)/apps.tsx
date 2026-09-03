/**
 * app/(tabs)/apps.tsx — Applications
 *
 * Liste des apps installées avec leur état de blocage. C'est l'écran le plus
 * exigeant en performance : plusieurs centaines de lignes avec icônes, une
 * recherche au fil de la frappe et des bascules à chaud.
 *
 * Trois choix expliquent la fluidité obtenue :
 *   • lignes à hauteur fixe (`getItemLayout`), donc pas de mesure au défilement ;
 *   • `AppRow` mémoïsé avec une comparaison explicite ;
 *   • retri différé après une bascule (voir `useAppFilter`).
 */

import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

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
import { useSessions } from "@/features/sessions/useSessions";
import { VpnAlert, VpnExplainerSheet } from "@/features/vpn/VpnPrompts";
import { useVpn } from "@/features/vpn/useVpn";
import { Radius, Spacing, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import {
  AppBar,
  Badge,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  SkeletonList,
  Text,
  Touchable,
  toast,
} from "@/ui";

export default function AppsScreen() {
  const { t } = useTheme();
  const catalog = useAppCatalog();
  const filter = useAppFilter(catalog.apps);
  const sessions = useSessions();
  const vpn = useVpn();
  const { limits } = usePremium();
  const paywall = usePaywall();
  const { guard, ParentalGate } = useParentalGuard();

  const selection = useAppSelection(filter.results);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [vpnExplainer, setVpnExplainer] = useState(false);
  const [explainerApp, setExplainerApp] = useState<string | undefined>();
  const [alertDismissed, setAlertDismissed] = useState(false);
  // Le panneau d'explication VPN n'est proposé qu'une fois par session : au
  // deuxième blocage, l'utilisateur a compris.
  const explainerShown = useRef(false);

  // Les apps système sont préchargées dès que la liste utilisateur est prête :
  // le scan natif est mutualisé, donc le basculement de périmètre est immédiat
  // au lieu d'afficher une liste vide le temps d'un chargement.
  useEffect(() => {
    if (!catalog.loading) catalog.loadSystemApps();
  }, [catalog.loading, catalog]);

  const quotaReached = !limits.canBlockApp(catalog.blockedCount).allowed;

  const toggle = useCallback(
    async (app: AppEntry) => {
      if (sessions.locked) {
        toast.info("Session en cours — les règles sont figées.");
        return;
      }

      const blocking = !app.blocked;
      if (blocking && !paywall.enforce(limits.canBlockApp(catalog.blockedCount))) return;
      if (!(await guard("toggle_block_app"))) return;

      filter.deferResort();
      const ok = await catalog.setBlocked(app.packageName, blocking);
      if (!ok) {
        toast.error(`Impossible de modifier la règle de ${app.appName}.`);
        return;
      }

      if (blocking && !vpn.active && !explainerShown.current) {
        explainerShown.current = true;
        setExplainerApp(app.appName);
        setVpnExplainer(true);
      }
    },
    [sessions.locked, paywall, limits, catalog, guard, filter, vpn.active],
  );

  /**
   * Applique la même règle à toute la sélection.
   * Le quota gratuit est vérifié sur le nombre d'apps réellement ajoutées :
   * cocher une app déjà bloquée ne consomme rien.
   */
  const applyToSelection = useCallback(
    async (blocked: boolean) => {
      if (sessions.locked) {
        toast.info("Session en cours — les règles sont figées.");
        return;
      }

      const targets = filter.results.filter(
        (app) => selection.isSelected(app.packageName) && app.blocked !== blocked,
      );
      if (targets.length === 0) {
        toast.info(
          blocked ? "Ces apps sont déjà bloquées." : "Ces apps sont déjà autorisées.",
        );
        return;
      }

      if (blocked) {
        const room = limits.maxBlockedApps - catalog.blockedCount;
        if (room <= 0) {
          paywall.open("blocked_apps");
          return;
        }
        if (targets.length > room) {
          // On applique ce qui tient dans le quota plutôt que de tout refuser.
          const partial = targets.slice(0, room).map((app) => app.packageName);
          if (!(await guard("toggle_block_app"))) return;
          setBulkBusy(true);
          await catalog.setBlockedMany(partial, true);
          setBulkBusy(false);
          selection.exit();
          toast.warning(
            `${plural(partial.length, "app bloquée", "apps bloquées")} sur ${targets.length} — limite gratuite atteinte.`,
          );
          paywall.open("blocked_apps");
          return;
        }
      }

      if (!(await guard("toggle_block_app"))) return;

      setBulkBusy(true);
      filter.deferResort();
      const ok = await catalog.setBlockedMany(
        targets.map((app) => app.packageName),
        blocked,
      );
      setBulkBusy(false);
      selection.exit();

      if (!ok) {
        toast.error("Les règles n'ont pas pu être enregistrées.");
        return;
      }
      toast.success(
        blocked
          ? plural(targets.length, "app bloquée", "apps bloquées")
          : plural(targets.length, "app autorisée", "apps autorisées"),
      );

      if (blocked && !vpn.active && !explainerShown.current) {
        explainerShown.current = true;
        setExplainerApp(undefined);
        setVpnExplainer(true);
      }
    },
    [sessions.locked, filter, selection, limits, catalog, paywall, guard, vpn.active],
  );

  const activateProtection = useCallback(async () => {
    setVpnExplainer(false);
    if (!(await guard("toggle_vpn"))) return;
    await vpn.start();
  }, [guard, vpn]);

  const openDetail = useCallback((app: AppEntry) => {
    router.push({
      pathname: "/application/[packageName]",
      params: { packageName: app.packageName },
    });
  }, []);

  const showVpnAlert =
    !vpn.active && catalog.blockedCount > 0 && !sessions.locked && !alertDismissed;

  return (
    <Screen>
      <AppBar
        title="Applications"
        subtitle={
          catalog.loading
            ? "Chargement…"
            : `${plural(catalog.apps.length, "app installée", "apps installées")} · ${catalog.blockedCount} bloquée${catalog.blockedCount > 1 ? "s" : ""}`
        }
        right={
          <View style={st.headerActions}>
            {quotaReached ? (
              <Touchable onPress={() => paywall.open("blocked_apps")} feedback="strong">
                <Badge
                  label={`${catalog.blockedCount}/${limits.maxBlockedApps}`}
                  tone="warning"
                  icon="lock"
                  size="md"
                />
              </Touchable>
            ) : null}
            <IconButton
              icon={
                selection.active
                  ? "close"
                  : "checkbox-multiple-marked-outline"
              }
              variant={selection.active ? "filled" : "soft"}
              onPress={() => (selection.active ? selection.exit() : selection.enter())}
              accessibilityLabel={
                selection.active ? "Quitter la sélection" : "Sélectionner plusieurs apps"
              }
            />
          </View>
        }
        below={
          <View style={st.header}>
            <AppFilterBar
              query={filter.query}
              onQueryChange={filter.setQuery}
              filters={filter.filters}
              onFiltersChange={filter.setFilters}
              isFiltered={filter.isFiltered}
              onReset={filter.reset}
              systemLoading={catalog.systemLoading}
            />

            {showVpnAlert ? (
              <VpnAlert
                blockedCount={catalog.blockedCount}
                onActivate={activateProtection}
                onDismiss={() => setAlertDismissed(true)}
                busy={vpn.busy}
              />
            ) : null}

            {sessions.locked ? (
              <View
                style={[
                  st.notice,
                  { backgroundColor: t.intent.focus.bg, borderColor: t.intent.focus.border },
                ]}
              >
                <Icon name="lock-outline" size={16} color={t.intent.focus.accent} />
                <Text variant="footnote" tone="focus" numberOfLines={1} style={st.flex}>
                  Session en cours — règles verrouillées
                </Text>
              </View>
            ) : null}

            <View style={st.countRow}>
              <Text variant="overline" tone="faint">
                {filter.results.length > 0
                  ? `${filter.results.length} résultat${filter.results.length > 1 ? "s" : ""}`
                  : ""}
              </Text>
              {filter.blockedInResults > 0 ? (
                <Badge
                  label={`${filter.blockedInResults} bloquée${filter.blockedInResults > 1 ? "s" : ""}`}
                  tone="blocked"
                />
              ) : null}
            </View>
          </View>
        }
      />

      {catalog.loading ? (
        <SkeletonList count={9} />
      ) : (
        <FlatList
          data={filter.results}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => (
            <AppRow
              app={item}
              onToggle={toggle}
              onPress={openDetail}
              locked={sessions.locked}
              quotaReached={quotaReached}
              selectable={selection.active}
              selected={selection.isSelected(item.packageName)}
              onSelect={(app) => selection.toggle(app.packageName)}
              onLongPress={(app) => selection.enter(app.packageName)}
            />
          )}
          getItemLayout={getItemLayout}
          contentContainerStyle={[
            st.list,
            selection.active && st.listWithSelection,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={9}
          refreshControl={
            <RefreshControl
              refreshing={catalog.refreshing}
              onRefresh={catalog.refresh}
              tintColor={t.refreshTint}
              colors={[t.refreshTint]}
              progressBackgroundColor={t.bg.card}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="magnify-close"
              title="Aucune application"
              message={
                filter.isFiltered
                  ? "Aucune app ne correspond à cette recherche ou à ces filtres."
                  : "La liste des applications installées n'a pas pu être lue."
              }
              actionLabel={filter.isFiltered ? "Réinitialiser les filtres" : "Recharger"}
              onAction={filter.isFiltered ? filter.reset : catalog.refresh}
              actionVariant="secondary"
            />
          }
          ListFooterComponent={
            filter.results.length > 0 && filter.filters.scope === "user" ? (
              <Text variant="footnote" tone="faint" center style={st.footer}>
                Une app manque ? Basculez sur « Toutes » pour inclure les
                composants système.
              </Text>
            ) : null
          }
        />
      )}

      {selection.active ? (
        <SelectionBar
          count={selection.count}
          alreadyCount={selection.blockedCount}
          allSelected={selection.allVisibleSelected}
          busy={bulkBusy}
          onToggleAll={selection.toggleAllVisible}
          onBlock={() => applyToSelection(true)}
          onUnblock={() => applyToSelection(false)}
          onCancel={selection.exit}
          bottomOffset={TAB_BAR_HEIGHT}
        />
      ) : null}

      <VpnExplainerSheet
        visible={vpnExplainer}
        onClose={() => setVpnExplainer(false)}
        onActivate={activateProtection}
        appName={explainerApp}
        busy={vpn.busy}
      />

      <Paywall
        visible={paywall.visible}
        reason={paywall.reason}
        onClose={paywall.close}
      />

      <ParentalGate />
    </Screen>
  );
}

const keyExtractor = (item: AppEntry) => item.packageName;

// Hauteur de ligne + espacement : constant, donc mesurable sans layout.
const ROW_STRIDE = APP_ROW_HEIGHT + Spacing.sm;
const getItemLayout = (_: unknown, index: number) => ({
  length: ROW_STRIDE,
  offset: ROW_STRIDE * index,
  index,
});

const st = StyleSheet.create({
  header: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.gutter,
    paddingBottom: Spacing.md,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 18,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  list: {
    paddingHorizontal: Spacing.gutter,
    paddingBottom: TAB_BAR_HEIGHT + Spacing.huge,
    gap: Spacing.sm,
  },
  // La barre d'actions recouvre le bas de la liste : on dégage la place.
  listWithSelection: { paddingBottom: TAB_BAR_HEIGHT + 160 },
  footer: { paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  flex: { flex: 1 },
});
