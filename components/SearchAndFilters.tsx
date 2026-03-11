import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    ScrollView,
    StyleSheet,
    TextInput,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import { Text } from "react-native-paper";

// ─── Types ────────────────────────────────────────────────────────────────────
export type FilterKey = "system" | "blocked" | "allowed" | "all";

export interface FilterOption {
  key: FilterKey;
  label: string;
  icon: string;
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  activeFilters: FilterKey[];
  onFilterChange: (filters: FilterKey[]) => void;
}

// ─── Filter definitions ───────────────────────────────────────────────────────
const FILTERS: FilterOption[] = [
  { key: "all", label: "Tout", icon: "◈" },
  { key: "allowed", label: "Autorisées", icon: "●" },
  { key: "blocked", label: "Bloquées", icon: "✕" },
  { key: "system", label: "Système", icon: "⚙" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function SearchAndFilters({
  query,
  onQueryChange,
  activeFilters,
  onFilterChange,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Animations
  const focusBorder = useRef(new Animated.Value(0)).current;
  const focusGlow = useRef(new Animated.Value(0)).current;
  const filtersHeight = useRef(new Animated.Value(0)).current;
  const filtersOpacity = useRef(new Animated.Value(0)).current;
  const chevronRot = useRef(new Animated.Value(0)).current;

  // ── Focus animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(focusBorder, {
        toValue: focused ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(focusGlow, {
        toValue: focused ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  // ── Filters expand animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(filtersHeight, {
        toValue: filtersOpen ? 40 : 0,
        duration: 260,
        easing: filtersOpen
          ? Easing.out(Easing.back(1.2))
          : Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(filtersOpacity, {
        toValue: filtersOpen ? 1 : 0,
        duration: filtersOpen ? 260 : 160,
        useNativeDriver: false,
      }),
      Animated.timing(chevronRot, {
        toValue: filtersOpen ? 1 : 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [filtersOpen]);

  const borderColor = focusBorder.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1C1C2C", "#4A3F8A"],
  });
  const bgColor = focusBorder.interpolate({
    inputRange: [0, 1],
    outputRange: ["#0E0E18", "#0D0C1A"],
  });
  const shadowOpacity = focusGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });
  const chevronAngle = chevronRot.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const toggleFilter = (key: FilterKey) => {
    if (key === "all") {
      onFilterChange([]);
      return;
    }
    const next = activeFilters.includes(key)
      ? activeFilters.filter((f) => f !== key)
      : [...activeFilters.filter((f) => f !== "all"), key];
    onFilterChange(next);
  };

  const activeCount = activeFilters.length;

  return (
    <View style={styles.wrapper}>
      {/* ── Search Row ── */}
      <View style={styles.searchRow}>
        {/* Search field */}
        <Animated.View
          style={[
            styles.searchContainer,
            { borderColor, backgroundColor: bgColor },
          ]}
        >
          {/* Glow layer */}
          <Animated.View
            style={[
              styles.glowLayer,
              { shadowOpacity, opacity: shadowOpacity },
            ]}
            pointerEvents="none"
          />

          <Text
            style={[styles.searchIcon, focused && styles.searchIconFocused]}
          >
            ⌕
          </Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher…"
            placeholderTextColor="#2E2E48"
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            clearButtonMode="never"
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

        {/* Filter toggle pill */}
        <TouchableOpacity
          style={[styles.filterToggle, filtersOpen && styles.filterToggleOpen]}
          onPress={() => setFiltersOpen((v) => !v)}
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
              filtersOpen && styles.filterToggleIconOpen,
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

      {/* ── Filters Panel (animated expand) ── */}
      <Animated.View
        style={[
          styles.filtersPanel,
          {
            height: filtersHeight,
            opacity: filtersOpacity,
            overflow: "hidden",
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        >
          {FILTERS.map((f) => {
            const isActive =
              f.key === "all"
                ? activeFilters.length === 0
                : activeFilters.includes(f.key);

            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, isActive && chipActiveStyle(f.key)]}
                onPress={() => toggleFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipIcon,
                    isActive && chipTextActiveStyle(f.key),
                  ]}
                >
                  {f.icon}
                </Text>
                <Text
                  style={[
                    styles.chipLabel,
                    isActive && chipTextActiveStyle(f.key),
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Chip color maps ──────────────────────────────────────────────────────────
const CHIP_COLORS: Record<
  FilterKey,
  { bg: string; border: string; text: string }
> = {
  all: { bg: "#16103A", border: "#7B6EF6", text: "#9B8FFF" },
  allowed: { bg: "#0D2218", border: "#1E6A46", text: "#3DDB8A" },
  blocked: { bg: "#1E0E16", border: "#6A1A35", text: "#D04070" },
  system: { bg: "#141230", border: "#3A3460", text: "#8880C0" },
};

const chipActiveStyle = (key: FilterKey): ViewStyle => ({
  backgroundColor: CHIP_COLORS[key].bg,
  borderColor: CHIP_COLORS[key].border,
});
const chipTextActiveStyle = (key: FilterKey): TextStyle => ({
  color: CHIP_COLORS[key].text,
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    gap: 0,
  },

  // ── Search Row
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 0,
  },

  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    position: "relative",
  },

  glowLayer: {
    position: "absolute",
    inset: -1,
    borderRadius: 13,
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 0,
  },

  searchIcon: {
    fontSize: 16,
    color: "#2E2E48",
    marginRight: 8,
    lineHeight: 20,
  },
  searchIconFocused: {
    color: "#7B6EF6",
  },

  searchInput: {
    flex: 1,
    color: "#E8E8F8",
    fontSize: 14,
    paddingVertical: 0,
    fontWeight: "400",
  },

  clearBtn: {
    marginLeft: 6,
  },
  clearIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2A2A3C",
    justifyContent: "center",
    alignItems: "center",
  },
  clearIconText: {
    fontSize: 9,
    color: "#8080A0",
    fontWeight: "700",
  },

  // ── Filter toggle button
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
  filterToggleOpen: {
    backgroundColor: "#16103A",
    borderColor: "#4A3F8A",
  },
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
  filterBadgeText: {
    fontSize: 9,
    color: "#FFF",
    fontWeight: "800",
  },
  filterToggleIcon: {
    fontSize: 15,
    color: "#3A3A58",
  },
  filterToggleIconOpen: {
    color: "#9B8FFF",
  },
  filterChevron: {
    fontSize: 13,
    color: "#3A3A58",
    lineHeight: 16,
  },

  // ── Filters panel
  filtersPanel: {
    marginTop: 8,
  },
  filtersList: {
    paddingRight: 4,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  // ── Chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#0E0E18",
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  chipIcon: {
    fontSize: 10,
    color: "#3A3A58",
  },
  chipLabel: {
    fontSize: 12,
    color: "#3A3A58",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
