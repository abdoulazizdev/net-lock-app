import { useTheme } from "@/theme";
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

const CHIPS: Array<{
  key: ScopeKey | StateKey;
  label: string;
  group: "scope" | "state";
}> = [
  { key: "all", label: "Toutes", group: "scope" },
  { key: "user", label: "Installées", group: "scope" },
  { key: "system", label: "Système", group: "scope" },
  { key: "any", label: "Tous états", group: "state" },
  { key: "allowed", label: "Autorisées", group: "state" },
  { key: "blocked", label: "Bloquées", group: "state" },
];

function activeColors(
  key: ScopeKey | StateKey,
  t: ReturnType<typeof useTheme>["t"],
) {
  if (key === "blocked")
    return { bg: t.blocked.bg, border: t.blocked.border, text: t.blocked.text };
  if (key === "allowed")
    return { bg: t.allowed.bg, border: t.allowed.accent, text: t.allowed.text };
  return { bg: t.bg.accent, border: t.border.focus, text: t.text.link };
}

function Chip({
  label,
  active,
  chipKey,
  onPress,
  loading,
  spinDeg,
}: {
  label: string;
  active: boolean;
  chipKey: ScopeKey | StateKey;
  onPress: () => void;
  loading?: boolean;
  spinDeg?: Animated.AnimatedInterpolation<string>;
}) {
  const { t } = useTheme();
  const colors = activeColors(chipKey, t);
  const sc = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(sc, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(sc, {
        toValue: 1,
        tension: 300,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View
        style={[
          st.chip,
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          active && { backgroundColor: colors.bg, borderColor: colors.border },
          { transform: [{ scale: sc }] },
        ]}
      >
        {loading && spinDeg && (
          <Animated.Text
            style={[
              st.chipIcon,
              { color: t.text.link, transform: [{ rotate: spinDeg }] },
            ]}
          >
            ◌
          </Animated.Text>
        )}
        <Text
          style={[
            st.chipLabel,
            { color: active ? colors.text : t.text.secondary },
            active && { fontWeight: "700" },
          ]}
        >
          {loading ? "…" : label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

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

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
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

  const setScope = (s: ScopeKey) => onFiltersChange({ ...filters, scope: s });
  const setState = (s: StateKey) => onFiltersChange({ ...filters, state: s });
  const isActive = (key: ScopeKey | StateKey, group: "scope" | "state") =>
    group === "scope" ? filters.scope === key : filters.state === key;

  return (
    <View style={st.wrap}>
      {/* Search box — full width */}
      <Animated.View
        style={[
          st.searchBox,
          { borderColor, backgroundColor: t.bg.card },
          {
            shadowOpacity,
            shadowColor: t.border.focus,
            shadowOffset: { width: 0, height: 3 },
            shadowRadius: 8,
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
            onPress={() => onQueryChange("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[st.clearBtn, { backgroundColor: t.bg.cardAlt }]}>
              <Text style={[st.clearBtnText, { color: t.text.muted }]}>✕</Text>
            </View>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Chips — second row, scrollable */}
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
                <View
                  style={[st.divider, { backgroundColor: t.border.light }]}
                />
              )}
              <Chip
                label={c.label}
                chipKey={c.key}
                active={isActive(c.key, c.group)}
                onPress={() =>
                  c.group === "scope"
                    ? setScope(c.key as ScopeKey)
                    : setState(c.key as StateKey)
                }
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
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    gap: 9,
  },
  searchIcon: { fontSize: 15, lineHeight: 19 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 8, fontWeight: "700" },

  chipScroll: { marginHorizontal: -16 },
  chipRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIcon: { fontSize: 9 },
  chipLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.1 },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    marginHorizontal: 3,
    borderRadius: 1,
    opacity: 0.4,
  },
});
