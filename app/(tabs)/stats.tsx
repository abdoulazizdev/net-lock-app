/**
 * app/(tabs)/stats.tsx — Statistiques
 *
 * Quatre vues sur les mêmes données. L'historique et le détail par app sont
 * réservés à Pro : au lieu de flouter le contenu, l'onglet affiche
 * franchement ce qu'il contient et pourquoi il est verrouillé.
 */

import React, { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { Paywall } from "@/features/premium/Paywall";
import { usePaywall, usePremium } from "@/features/premium/usePremium";
import {
  AppsPanel,
  HistoryPanel,
  OverviewPanel,
  ProductivityPanel,
} from "@/features/stats/StatsPanels";
import { useStats } from "@/features/stats/useStats";
import { Spacing, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import {
  AppBar,
  Button,
  Dialog,
  EmptyState,
  IconButton,
  Screen,
  ScreenScroll,
  SkeletonCard,
  Tabs,
  toast,
  useScrollY,
  type SegmentOption,
} from "@/ui";

type StatsTab = "overview" | "history" | "apps" | "productivity";

export default function StatsScreen() {
  const { t } = useTheme();
  const stats = useStats();
  const { limits } = usePremium();
  const paywall = usePaywall();
  const { scrollY, onScroll } = useScrollY();

  const [tab, setTab] = useState<StatsTab>("overview");
  const [confirmClear, setConfirmClear] = useState(false);

  const options: SegmentOption<StatsTab>[] = [
    { key: "overview", label: "Vue d'ensemble", icon: "chart-donut" },
    {
      key: "history",
      label: "Historique",
      icon: "history",
      locked: !limits.canViewStatsTab("history").allowed,
    },
    {
      key: "apps",
      label: "Par app",
      icon: "apps",
      locked: !limits.canViewStatsTab("apps").allowed,
    },
    { key: "productivity", label: "Progression", icon: "trophy-outline" },
  ];

  const selectTab = useCallback(
    (next: StatsTab) => {
      if (!paywall.enforce(limits.canViewStatsTab(next))) return;
      setTab(next);
    },
    [paywall, limits],
  );

  const clear = useCallback(async () => {
    setConfirmClear(false);
    try {
      await stats.clearHistory();
      toast.success("Historique effacé.");
    } catch {
      toast.error("L'effacement a échoué.");
    }
  }, [stats]);

  const locked = !limits.canViewStatsTab(tab).allowed;

  return (
    <Screen>
      <AppBar
        title="Statistiques"
        subtitle={
          stats.summary.totalEvents > 0
            ? `${stats.summary.totalEvents} événements enregistrés`
            : "En attente de données"
        }
        scrollY={scrollY}
        right={
          stats.summary.totalEvents > 0 ? (
            <IconButton
              icon="delete-sweep-outline"
              variant="soft"
              onPress={() => setConfirmClear(true)}
              accessibilityLabel="Effacer l'historique"
            />
          ) : undefined
        }
        below={<Tabs options={options} value={tab} onChange={selectTab} />}
      />

      <ScreenScroll
        onScroll={onScroll}
        bottomInset={TAB_BAR_HEIGHT + Spacing.xl}
        refreshControl={
          <RefreshControl
            refreshing={stats.refreshing}
            onRefresh={stats.refresh}
            tintColor={t.refreshTint}
            colors={[t.refreshTint]}
            progressBackgroundColor={t.bg.card}
          />
        }
      >
        {stats.loading ? (
          <View style={st.loading}>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={2} />
          </View>
        ) : locked ? (
          <EmptyState
            icon="lock-outline"
            title="Réservé à NetOff Pro"
            message={
              tab === "history"
                ? "L'historique détaille chaque tentative de connexion, app par app et heure par heure."
                : "Le détail par application montre ce que chaque app tente réellement de faire."
            }
            actionLabel="Découvrir Pro"
            onAction={() => paywall.open("stats")}
            actionVariant="accent"
          />
        ) : tab === "overview" ? (
          <OverviewPanel stats={stats} />
        ) : tab === "history" ? (
          <HistoryPanel stats={stats} />
        ) : tab === "apps" ? (
          <AppsPanel stats={stats} />
        ) : (
          <ProductivityPanel stats={stats} />
        )}
      </ScreenScroll>

      <Dialog
        visible={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Effacer l'historique ?"
        message="Les tentatives de connexion enregistrées seront supprimées. Vos règles, profils et badges ne sont pas touchés."
        actions={
          <>
            <Button label="Effacer" variant="danger" onPress={clear} fullWidth />
            <Button
              label="Annuler"
              variant="ghost"
              onPress={() => setConfirmClear(false)}
              fullWidth
            />
          </>
        }
      />

      <Paywall visible={paywall.visible} reason={paywall.reason} onClose={paywall.close} />
    </Screen>
  );
}

const st = StyleSheet.create({
  loading: { gap: Spacing.md, padding: Spacing.gutter },
});
