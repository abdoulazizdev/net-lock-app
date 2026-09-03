/**
 * features/apps/AppFilterBar.tsx — Recherche et filtres de la liste d'apps
 *
 * Le sélecteur de périmètre est **toujours visible**. Caché dans un panneau,
 * il donnait l'impression que des applications manquaient : « Mes apps »
 * masque les composants système, et rien ne le disait à l'écran.
 *
 * Le filtre par état (bloquées / autorisées), lui, reste dans un panneau : on
 * s'en sert ponctuellement, et deux rangées de contrôles au-dessus d'une liste
 * mangent l'écran pour rien.
 */

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Spacing, useTheme } from "@/theme";
import {
  Button,
  Chip,
  IconButton,
  SearchField,
  Section,
  Segmented,
  Sheet,
  Text,
  type SegmentOption,
} from "@/ui";
import type { AppFilters, AppScope, AppStateFilter } from "./useAppFilter";

const SCOPES: SegmentOption<AppScope>[] = [
  { key: "user", label: "Mes apps" },
  { key: "all", label: "Toutes" },
  { key: "system", label: "Système" },
];

const STATES: { key: AppStateFilter; label: string; tone: "brand" | "blocked" | "allowed" }[] = [
  { key: "any", label: "Tous les états", tone: "brand" },
  { key: "blocked", label: "Bloquées", tone: "blocked" },
  { key: "allowed", label: "Autorisées", tone: "allowed" },
];

export type AppFilterBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  filters: AppFilters;
  onFiltersChange: (f: AppFilters) => void;
  isFiltered: boolean;
  onReset: () => void;
  /** Les apps système sont en cours de chargement. */
  systemLoading?: boolean;
  /** Masque le sélecteur de périmètre (liste déjà restreinte). */
  hideScope?: boolean;
};

export function AppFilterBar({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  isFiltered,
  onReset,
  systemLoading = false,
  hideScope = false,
}: AppFilterBarProps) {
  const { t } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  const stateFiltered = filters.state !== "any";

  return (
    <>
      <SearchField
        value={query}
        onChangeText={onQueryChange}
        placeholder="Nom ou identifiant de package…"
        trailing={
          <View style={st.filterButton}>
            <IconButton
              icon="tune-variant"
              variant={stateFiltered ? "filled" : "soft"}
              onPress={() => setSheetOpen(true)}
              accessibilityLabel="Filtrer par état"
            />
            {stateFiltered ? (
              <View
                style={[
                  st.badge,
                  { backgroundColor: t.intent.warning.accent, borderColor: t.bg.page },
                ]}
              />
            ) : null}
          </View>
        }
      />

      {hideScope ? null : (
        <Segmented
          options={SCOPES}
          value={filters.scope}
          onChange={(scope) => onFiltersChange({ ...filters, scope })}
        />
      )}

      {systemLoading && filters.scope !== "user" ? (
        <Text variant="footnote" tone="faint">
          Chargement des applications système…
        </Text>
      ) : null}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtrer par état"
        scrollable={false}
        footer={
          <>
            <Button label="Voir les résultats" onPress={() => setSheetOpen(false)} fullWidth />
            {isFiltered ? (
              <Button
                label="Réinitialiser"
                variant="ghost"
                onPress={() => {
                  onReset();
                  setSheetOpen(false);
                }}
                fullWidth
              />
            ) : null}
          </>
        }
      >
        <Section title="État du blocage">
          <View style={st.chips}>
            {STATES.map((state) => (
              <Chip
                key={state.key}
                label={state.label}
                tone={state.tone}
                active={filters.state === state.key}
                onPress={() => onFiltersChange({ ...filters, state: state.key })}
              />
            ))}
          </View>
        </Section>

        {hideScope ? null : (
          <Section
            title="Périmètre"
            footnote="« Mes apps » masque les composants système. « Toutes » affiche l'intégralité de ce qui est installé."
          >
            <View style={st.chips}>
              {SCOPES.map((scope) => (
                <Chip
                  key={scope.key}
                  label={scope.label}
                  active={filters.scope === scope.key}
                  onPress={() => onFiltersChange({ ...filters, scope: scope.key })}
                />
              ))}
            </View>
          </Section>
        )}
      </Sheet>
    </>
  );
}

const st = StyleSheet.create({
  filterButton: { position: "relative" },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
});
