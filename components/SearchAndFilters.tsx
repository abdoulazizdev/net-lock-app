import { useTheme } from "@/theme";
import * as Haptics from "expo-haptics";
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

export type ScopeKey = "all" | "user" | "system";
export type StateKey = "any" | "allowed" | "blocked";
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

interface ChipDef {
  key: ScopeKey | StateKey;
  label: string;
  icon: string;
  group: "scope" | "state";
}

const CHIPS: ChipDef[] = [
  { key: "all", label: "Toutes", icon: "◉", group: "scope" },
  { key: "user", label: "Installées", icon: "⬇", group: "scope" },
  { key: "system", label: "Système", icon: "⚙", group: "scope" },
  { key: "blocked", label: "Bloquées", icon: "⊘", group: "state" },
  { key: "allowed", label: "Autorisées", icon: "✓", group: "state" },
];

// ─── Chip ──────────────────────────────────────────────────────────────────────
function Chip({
  label,
  icon,
  chipKey,
  active,
  onPress,
  loading,
  spinDeg,
}: {
  label: string;
  icon: string;
  chipKey: ScopeKey | StateKey;
  active: boolean;
  onPress: () => void;
  loading?: boolean;
  spinDeg?: Animated.AnimatedInterpolation<string>;
}) {
  const { t } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.timing(sc, {
        toValue: 0.88,
        duration: 65,
        useNativeDriver: true,
      }),
      Animated.spring(sc, {
        toValue: 1,
        tension: 340,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  const isBlocked = chipKey === "blocked";
  const isAllowed = chipKey === "allowed";

  const bgColor = active
    ? isBlocked
      ? t.blocked.bg
      : isAllowed
        ? t.allowed.bg
        : t.bg.accent
    : "transparent";
  const borderColor = active
    ? isBlocked
      ? t.blocked.border
      : isAllowed
        ? t.allowed.border
        : t.border.strong
    : t.border.normal;
  const textColor = active
    ? isBlocked
      ? t.blocked.text
      : isAllowed
        ? t.allowed.text
        : t.text.link
    : t.text.secondary;
  const iconColor = active
    ? isBlocked
      ? t.blocked.accent
      : isAllowed
        ? t.allowed.accent
        : t.text.link
    : t.text.muted;

  return (
    <TouchableOpacity
      onPress={press}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        style={[
          st.chip,
          { backgroundColor: bgColor, borderColor },
          active && st.chipActive,
          { transform: [{ scale: sc }] },
        ]}
      >
        {loading && spinDeg ? (
          <Animated.Text
            style={[
              st.chipIcon,
              { color: t.text.link, transform: [{ rotate: spinDeg }] },
            ]}
          >
            ◌
          </Animated.Text>
        ) : (
          <Text style={[st.chipIcon, { color: iconColor }]}>{icon}</Text>
        )}
        <Text
          style={[
            st.chipLabel,
            { color: textColor },
            active && { fontWeight: "700" },
          ]}
        >
          {loading ? "…" : label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  const { t } = useTheme();
  return (
    <View style={st.sectionLabel}>
      <Text style={[st.sectionLabelText, { color: t.text.muted }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function SearchAndFilters({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  systemAppsLoaded,
  systemAppsLoading,
}: Props) {
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (systemAppsLoading) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
    return () => {
      spinLoop.current?.stop();
    };
  }, [systemAppsLoading]);

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.border.light, t.border.focus],
  });
  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08],
  });
  const spinDeg = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleChip = (c: ChipDef) => {
    if (c.group === "scope") {
      onFiltersChange({ ...filters, scope: c.key as ScopeKey });
    } else {
      const next = filters.state === c.key ? "any" : (c.key as StateKey);
      onFiltersChange({ ...filters, state: next });
    }
  };

  const isActive = (c: ChipDef) =>
    c.group === "scope" ? filters.scope === c.key : filters.state === c.key;

  const scopeChips = CHIPS.filter((c) => c.group === "scope");
  const stateChips = CHIPS.filter((c) => c.group === "state");

  // Compteur de filtres actifs (hors defaults)
  const activeFilterCount =
    (filters.scope !== "all" ? 1 : 0) + (filters.state !== "any" ? 1 : 0);

  return (
    <View style={st.wrap}>
      {/* ── Search bar ── */}
      <Animated.View
        style={[
          st.searchBox,
          { backgroundColor: t.bg.cardAlt, borderColor },
          {
            shadowOpacity,
            shadowColor: t.border.focus,
            shadowOffset: { width: 0, height: 3 },
            shadowRadius: 10,
          },
        ]}
      >
        <Text
          style={[
            st.searchIcon,
            { color: focused ? t.text.link : t.text.muted },
          ]}
        >
          ⌕
        </Text>
        <TextInput
          style={[st.input, { color: t.text.primary }]}
          placeholder="Rechercher une application…"
          placeholderTextColor={t.text.muted}
          value={query}
          onChangeText={onQueryChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              onQueryChange("");
              Haptics.selectionAsync().catch(() => {});
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[st.clearBtn, { backgroundColor: t.bg.card }]}>
              <Text style={[st.clearBtnText, { color: t.text.muted }]}>✕</Text>
            </View>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Filters row ── */}
      <View style={st.filtersRow}>
        {/* Label with active badge */}
        <View style={st.filtersLabel}>
          <Text style={[st.filtersLabelText, { color: t.text.muted }]}>
            Filtres
          </Text>
          {activeFilterCount > 0 && (
            <View
              style={[
                st.filtersBadge,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={[st.filtersBadgeText, { color: t.text.link }]}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </View>

        {/* Chips scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={st.chipScroll}
          contentContainerStyle={st.chipRow}
        >
          {/* Scope group */}
          {scopeChips.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              icon={c.icon}
              chipKey={c.key}
              active={isActive(c)}
              onPress={() => handleChip(c)}
              loading={c.key === "system" && !!systemAppsLoading}
              spinDeg={spinDeg}
            />
          ))}

          {/* Separator */}
          <View style={[st.sep, { backgroundColor: t.border.normal }]} />

          {/* State group */}
          {stateChips.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              icon={c.icon}
              chipKey={c.key}
              active={isActive(c)}
              onPress={() => handleChip(c)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 8 },

  // ── Search ──
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: { fontSize: 16, lineHeight: 20 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 8, fontWeight: "700" },

  // ── Filters row ──
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filtersLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 2,
  },
  filtersLabelText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  filtersBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filtersBadgeText: {
    fontSize: 8,
    fontWeight: "800",
  },

  // ── Chips ──
  chipScroll: { flex: 1, marginRight: -14 },
  chipRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingRight: 14,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chipIcon: {
    fontSize: 9,
    lineHeight: 13,
  },
  chipLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.1 },
  sep: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    marginHorizontal: 2,
    opacity: 0.5,
    borderRadius: 1,
  },

  // ── Section label (unused but exported for potential reuse) ──
  sectionLabel: {
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  sectionLabelText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
