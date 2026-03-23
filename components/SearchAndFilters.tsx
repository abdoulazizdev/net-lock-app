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
  group: "scope" | "state";
}

const CHIPS: ChipDef[] = [
  { key: "all", label: "Toutes", group: "scope" },
  { key: "user", label: "Installées", group: "scope" },
  { key: "system", label: "Système", group: "scope" },
  { key: "blocked", label: "Bloquées", group: "state" },
  { key: "allowed", label: "Autorisées", group: "state" },
];

// ─── Chip ──────────────────────────────────────────────────────────────────────
function Chip({
  label,
  chipKey,
  active,
  onPress,
  loading,
  spinDeg,
}: {
  label: string;
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

  // Couleur active selon le type de chip
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
          { transform: [{ scale: sc }] },
        ]}
      >
        {loading && spinDeg && (
          <Animated.Text
            style={[
              st.chipSpin,
              { color: t.text.link, transform: [{ rotate: spinDeg }] },
            ]}
          >
            ◌
          </Animated.Text>
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
      // Tap sur chip actif → reset à "any"
      const next = filters.state === c.key ? "any" : (c.key as StateKey);
      onFiltersChange({ ...filters, state: next });
    }
  };

  const isActive = (c: ChipDef) =>
    c.group === "scope" ? filters.scope === c.key : filters.state === c.key;

  return (
    <View style={st.wrap}>
      {/* Search */}
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
          style={[st.icon, { color: focused ? t.text.link : t.text.muted }]}
        >
          ⌕
        </Text>
        <TextInput
          style={[st.input, { color: t.text.primary }]}
          placeholder="Rechercher…"
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

      {/* Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.chipScroll}
        contentContainerStyle={st.chipRow}
      >
        {CHIPS.map((c, i) => {
          const divider = i > 0 && c.group !== CHIPS[i - 1].group;
          return (
            <React.Fragment key={c.key}>
              {divider && (
                <View style={[st.sep, { backgroundColor: t.border.normal }]} />
              )}
              <Chip
                label={c.label}
                chipKey={c.key}
                active={isActive(c)}
                onPress={() => handleChip(c)}
                loading={c.key === "system" && !!systemAppsLoading}
                spinDeg={spinDeg}
              />
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 8 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 8,
  },
  icon: { fontSize: 15, lineHeight: 19 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  clearBtn: {
    width: 17,
    height: 17,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 8, fontWeight: "700" },

  chipScroll: { marginHorizontal: -14 },
  chipRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.1 },
  chipSpin: { fontSize: 9 },
  sep: {
    width: StyleSheet.hairlineWidth,
    height: 13,
    marginHorizontal: 3,
    opacity: 0.4,
    borderRadius: 1,
  },
});
