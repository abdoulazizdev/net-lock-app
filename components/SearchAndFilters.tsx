import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

// ─── Types ────────────────────────────────────────────────────────────────────
// scope : quel ensemble d'apps afficher
// state : filtrer par état de blocage
export type ScopeKey = "all" | "user" | "system";
export type StateKey = "any" | "allowed" | "blocked";

// Rétrocompat — on exporte FilterKey comme alias de ScopeKey pour ne pas
// casser les imports existants dans HomeScreen
export type FilterKey = ScopeKey | StateKey;

export interface Filters {
  scope: ScopeKey;
  state: StateKey;
}

export const DEFAULT_FILTERS: Filters = { scope: "all", state: "any" };

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  systemAppsLoaded: boolean;
  systemAppsLoading?: boolean;
}

// ─── Filter config ────────────────────────────────────────────────────────────
const SCOPE_FILTERS: { key: ScopeKey; label: string; icon: string }[] = [
  { key: "all", label: "Tous", icon: "◈" },
  { key: "user", label: "Installées", icon: "◎" },
  { key: "system", label: "Système", icon: "◉" },
];

const STATE_FILTERS: { key: StateKey; label: string; icon: string }[] = [
  { key: "any", label: "Tout état", icon: "◌" },
  { key: "allowed", label: "Autorisées", icon: "●" },
  { key: "blocked", label: "Bloquées", icon: "✕" },
];

const SCOPE_COLORS: Record<
  ScopeKey,
  { bg: string; border: string; text: string }
> = {
  all: { bg: "#16103A", border: "#7B6EF6", text: "#9B8FFF" },
  user: { bg: "#141230", border: "#3A3460", text: "#8880C0" },
  system: { bg: "#0E1820", border: "#264058", text: "#5090B0" },
};

const STATE_COLORS: Record<
  StateKey,
  { bg: string; border: string; text: string }
> = {
  any: { bg: "#14141E", border: "#2A2A3A", text: "#5A5A80" },
  allowed: { bg: "#0D2218", border: "#1E6A46", text: "#3DDB8A" },
  blocked: { bg: "#1E0E16", border: "#6A1A35", text: "#D04070" },
};

// ─── Chip component ───────────────────────────────────────────────────────────
function Chip({
  icon,
  label,
  active,
  colors,
  onPress,
  spinner,
  spinDeg,
  dimmed,
  dot,
}: {
  icon: string;
  label: string;
  active: boolean;
  colors: { bg: string; border: string; text: string };
  onPress: () => void;
  spinner?: boolean;
  spinDeg?: Animated.AnimatedInterpolation<string>;
  dimmed?: boolean;
  dot?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && { backgroundColor: colors.bg, borderColor: colors.border },
        dimmed && styles.chipDimmed,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {spinner && spinDeg ? (
        <Animated.Text
          style={[
            styles.chipIcon,
            { transform: [{ rotate: spinDeg }], color: "#8880C0" },
          ]}
        >
          ◌
        </Animated.Text>
      ) : (
        <Text style={[styles.chipIcon, active && { color: colors.text }]}>
          {icon}
        </Text>
      )}
      <Text style={[styles.chipLabel, active && { color: colors.text }]}>
        {spinner ? "Chargement…" : label}
      </Text>
      {dot && <View style={styles.chipDot} />}
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SearchAndFilters({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  systemAppsLoaded,
  systemAppsLoading,
}: Props) {
  const [inputFocused, setInputFocused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const focusBorder = useRef(new Animated.Value(0)).current;
  const panelHeight = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const chevronRot = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // ── Spin loader ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (systemAppsLoading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [systemAppsLoading]);

  // ── Input focus border ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(focusBorder, {
      toValue: inputFocused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [inputFocused]);

  // ── Panel open/close ──────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(panelHeight, {
        toValue: panelOpen ? 100 : 0,
        duration: 280,
        easing: panelOpen
          ? Easing.out(Easing.back(1.1))
          : Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(panelOpacity, {
        toValue: panelOpen ? 1 : 0,
        duration: panelOpen ? 260 : 140,
        useNativeDriver: false,
      }),
      Animated.timing(chevronRot, {
        toValue: panelOpen ? 1 : 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [panelOpen]);

  const borderColor = focusBorder.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1C1C2C", "#4A3F8A"],
  });
  const bgColor = focusBorder.interpolate({
    inputRange: [0, 1],
    outputRange: ["#0E0E18", "#0D0C1A"],
  });
  const chevronAngle = chevronRot.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const spinDeg = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Badge count = number of non-default filters active
  const activeCount =
    (filters.scope !== "all" ? 1 : 0) + (filters.state !== "any" ? 1 : 0);

  const setScope = (scope: ScopeKey) => onFiltersChange({ ...filters, scope });
  const setState = (state: StateKey) => onFiltersChange({ ...filters, state });

  return (
    <View style={styles.wrapper}>
      {/* ── Search row ── */}
      <View style={styles.searchRow}>
        <Animated.View
          style={[
            styles.searchContainer,
            { borderColor, backgroundColor: bgColor },
          ]}
        >
          <Text
            style={[
              styles.searchIcon,
              inputFocused && styles.searchIconFocused,
            ]}
          >
            ⌕
          </Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une application…"
            placeholderTextColor="#2E2E48"
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => onQueryChange("")}
              style={styles.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.clearIcon}>
                <Text style={styles.clearIconText}>✕</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Filter toggle button */}
        <TouchableOpacity
          style={[
            styles.filterToggle,
            panelOpen && styles.filterToggleOpen,
            activeCount > 0 && styles.filterToggleActive,
          ]}
          onPress={() => setPanelOpen((v) => !v)}
          activeOpacity={0.7}
        >
          {activeCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
          <Text
            style={[
              styles.filterToggleIcon,
              (panelOpen || activeCount > 0) && styles.filterToggleIconOpen,
            ]}
          >
            ⊟
          </Text>
          <Animated.Text
            style={[
              styles.filterChevron,
              { transform: [{ rotate: chevronAngle }] },
            ]}
          >
            ⌄
          </Animated.Text>
        </TouchableOpacity>
      </View>

      {/* ── Filters panel ── */}
      <Animated.View
        style={[
          styles.panel,
          { height: panelHeight, opacity: panelOpacity, overflow: "hidden" },
        ]}
      >
        <View style={styles.panelInner}>
          {/* Row 1 — Scope */}
          <View style={styles.filterRow}>
            <Text style={styles.filterRowLabel}>APPS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {SCOPE_FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  icon={f.icon}
                  label={f.label}
                  active={filters.scope === f.key}
                  colors={SCOPE_COLORS[f.key]}
                  onPress={() => setScope(f.key)}
                  spinner={f.key === "system" && !!systemAppsLoading}
                  spinDeg={spinDeg}
                  dimmed={
                    f.key === "system" &&
                    !systemAppsLoaded &&
                    !systemAppsLoading &&
                    filters.scope !== "system"
                  }
                  dot={
                    f.key === "system" &&
                    !systemAppsLoaded &&
                    !systemAppsLoading &&
                    filters.scope !== "system"
                  }
                />
              ))}
            </ScrollView>
          </View>

          {/* Row 2 — State */}
          <View style={styles.filterRow}>
            <Text style={styles.filterRowLabel}>ÉTAT</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {STATE_FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  icon={f.icon}
                  label={f.label}
                  active={filters.state === f.key}
                  colors={STATE_COLORS[f.key]}
                  onPress={() => setState(f.key)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 0 },

  // Search
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 16,
    color: "#2E2E48",
    marginRight: 8,
    lineHeight: 20,
  },
  searchIconFocused: { color: "#7B6EF6" },
  searchInput: { flex: 1, color: "#E8E8F8", fontSize: 14, paddingVertical: 0 },
  clearBtn: { marginLeft: 6 },
  clearIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2A2A3C",
    justifyContent: "center",
    alignItems: "center",
  },
  clearIconText: { fontSize: 9, color: "#8080A0", fontWeight: "700" },

  // Filter toggle
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
    position: "relative",
  },
  filterToggleOpen: { backgroundColor: "#16103A", borderColor: "#4A3F8A" },
  filterToggleActive: { borderColor: "#4A3F8A" },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#7B6EF6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#080810",
  },
  filterBadgeText: { fontSize: 9, color: "#FFF", fontWeight: "800" },
  filterToggleIcon: { fontSize: 15, color: "#3A3A58" },
  filterToggleIconOpen: { color: "#9B8FFF" },
  filterChevron: { fontSize: 13, color: "#3A3A58", lineHeight: 16 },

  // Panel
  panel: { marginTop: 8 },
  panelInner: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingBottom: 4,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterRowLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: "#2A2A42",
    letterSpacing: 1.5,
    width: 30,
    flexShrink: 0,
  },
  chipRow: { flexDirection: "row", gap: 6, alignItems: "center" },

  // Chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  chipDimmed: { opacity: 0.45 },
  chipIcon: { fontSize: 10, color: "#3A3A58" },
  chipLabel: {
    fontSize: 12,
    color: "#3A3A58",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#3A3460",
    marginLeft: 2,
  },
});
