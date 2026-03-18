import { Colors, useTheme } from "@/theme";
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

const SCOPE_FILTERS = [
  { key: "all" as ScopeKey, label: "Tous", icon: "◈" },
  { key: "user" as ScopeKey, label: "Installées", icon: "◎" },
  { key: "system" as ScopeKey, label: "Système", icon: "◉" },
];
const STATE_FILTERS = [
  { key: "any" as StateKey, label: "Tout état", icon: "◌" },
  { key: "allowed" as StateKey, label: "Autorisées", icon: "●" },
  { key: "blocked" as StateKey, label: "Bloquées", icon: "✕" },
];

// Chip colors are semantic — same meaning in both themes
function chipColors(
  key: ScopeKey | StateKey,
  t: ReturnType<typeof useTheme>["t"],
) {
  if (key === "all" || key === "user")
    return { bg: t.bg.accent, border: t.border.focus, text: t.text.link };
  if (key === "system")
    return {
      bg: t.bg.cardAlt,
      border: t.border.normal,
      text: t.text.secondary,
    };
  if (key === "allowed")
    return { bg: t.allowed.bg, border: t.allowed.accent, text: t.allowed.text };
  if (key === "blocked")
    return { bg: t.blocked.bg, border: t.blocked.accent, text: t.blocked.text };
  return { bg: t.bg.cardAlt, border: t.border.light, text: t.text.muted };
}

function Chip({
  icon,
  label,
  active,
  chipKey,
  onPress,
  spinner,
  spinDeg,
  dimmed,
  dot,
}: {
  icon: string;
  label: string;
  active: boolean;
  chipKey: ScopeKey | StateKey;
  onPress: () => void;
  spinner?: boolean;
  spinDeg?: Animated.AnimatedInterpolation<string>;
  dimmed?: boolean;
  dot?: boolean;
}) {
  const { t } = useTheme();
  const colors = chipColors(chipKey, t);
  return (
    <TouchableOpacity
      style={[
        st.chip,
        { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
        active && { backgroundColor: colors.bg, borderColor: colors.border },
        dimmed && st.chipDimmed,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {spinner && spinDeg ? (
        <Animated.Text
          style={[
            st.chipIcon,
            { color: t.text.link, transform: [{ rotate: spinDeg }] },
          ]}
        >
          ◌
        </Animated.Text>
      ) : (
        <Text
          style={[st.chipIcon, { color: active ? colors.text : t.text.muted }]}
        >
          {icon}
        </Text>
      )}
      <Text
        style={[
          st.chipLabel,
          { color: active ? colors.text : t.text.secondary },
        ]}
      >
        {spinner ? "Chargement…" : label}
      </Text>
      {dot && (
        <View style={[st.chipDot, { backgroundColor: t.border.strong }]} />
      )}
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
  const [inputFocused, setInputFocused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const focusBorder = useRef(new Animated.Value(0)).current;
  const panelHeight = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const chevronRot = useRef(new Animated.Value(0)).current;
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
    Animated.timing(focusBorder, {
      toValue: inputFocused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [inputFocused]);

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
    outputRange: [t.border.light, t.border.focus],
  });
  const bgColor = focusBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [t.bg.card, t.bg.accent],
  });
  const chevronAngle = chevronRot.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const spinDeg = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const activeCount =
    (filters.scope !== "all" ? 1 : 0) + (filters.state !== "any" ? 1 : 0);
  const setScope = (scope: ScopeKey) => onFiltersChange({ ...filters, scope });
  const setState = (state: StateKey) => onFiltersChange({ ...filters, state });

  return (
    <View style={st.wrapper}>
      <View style={st.searchRow}>
        <Animated.View
          style={[
            st.searchContainer,
            { borderColor, backgroundColor: bgColor },
          ]}
        >
          <Text
            style={[
              st.searchIcon,
              { color: inputFocused ? t.text.link : t.text.muted },
            ]}
          >
            ⌕
          </Text>
          <TextInput
            style={[st.searchInput, { color: t.text.primary }]}
            placeholder="Rechercher une application…"
            placeholderTextColor={t.text.muted}
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
              style={st.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[st.clearIcon, { backgroundColor: t.bg.cardAlt }]}>
                <Text style={[st.clearIconText, { color: t.text.secondary }]}>
                  ✕
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        <TouchableOpacity
          style={[
            st.filterToggle,
            { backgroundColor: t.bg.card, borderColor: t.border.light },
            panelOpen && {
              backgroundColor: t.bg.accent,
              borderColor: t.border.focus,
            },
            activeCount > 0 && { borderColor: t.border.focus },
          ]}
          onPress={() => setPanelOpen((v) => !v)}
          activeOpacity={0.7}
        >
          {activeCount > 0 && (
            <View
              style={[
                st.filterBadge,
                { backgroundColor: Colors.blue[600], borderColor: t.bg.page },
              ]}
            >
              <Text style={[st.filterBadgeText, { color: Colors.gray[0] }]}>
                {activeCount}
              </Text>
            </View>
          )}
          <Text
            style={[
              st.filterToggleIcon,
              {
                color:
                  panelOpen || activeCount > 0 ? t.text.link : t.text.muted,
              },
            ]}
          >
            ⊟
          </Text>
          <Animated.Text
            style={[
              st.filterChevron,
              { color: t.text.muted, transform: [{ rotate: chevronAngle }] },
            ]}
          >
            ⌄
          </Animated.Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          st.panel,
          { height: panelHeight, opacity: panelOpacity, overflow: "hidden" },
        ]}
      >
        <View style={st.panelInner}>
          <View style={st.filterRow}>
            <Text style={[st.filterRowLabel, { color: t.text.muted }]}>
              APPS
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.chipRow}
            >
              {SCOPE_FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  icon={f.icon}
                  label={f.label}
                  chipKey={f.key}
                  active={filters.scope === f.key}
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
          <View style={st.filterRow}>
            <Text style={[st.filterRowLabel, { color: t.text.muted }]}>
              ÉTAT
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.chipRow}
            >
              {STATE_FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  icon={f.icon}
                  label={f.label}
                  chipKey={f.key}
                  active={filters.state === f.key}
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

const st = StyleSheet.create({
  wrapper: { gap: 0 },
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
  searchIcon: { fontSize: 16, marginRight: 8, lineHeight: 20 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  clearBtn: { marginLeft: 6 },
  clearIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  clearIconText: { fontSize: 9, fontWeight: "700" },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  filterBadgeText: { fontSize: 9, fontWeight: "800" },
  filterToggleIcon: { fontSize: 15 },
  filterChevron: { fontSize: 13, lineHeight: 16 },
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
    letterSpacing: 1.5,
    width: 30,
    flexShrink: 0,
  },
  chipRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDimmed: { opacity: 0.45 },
  chipIcon: { fontSize: 10 },
  chipLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  chipDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 2 },
});
