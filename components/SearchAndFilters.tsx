import { useTheme } from "@/theme";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ScopeKey = "all" | "user" | "system";
export type StateKey = "any" | "allowed" | "blocked";
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

// ─── Chip ──────────────────────────────────────────────────────────────────────
function Chip({
  label,
  icon,
  active,
  onPress,
  variant = "neutral",
  disabled = false,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  variant?: "neutral" | "blocked" | "allowed";
  disabled?: boolean;
}) {
  const { t } = useTheme();
  const sc = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(sc, {
        toValue: 0.9,
        duration: 60,
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

  const bgColor = active
    ? variant === "blocked"
      ? t.blocked.bg
      : variant === "allowed"
        ? t.allowed.bg
        : t.bg.accent
    : t.bg.cardAlt;

  const borderColor = active
    ? variant === "blocked"
      ? t.blocked.border
      : variant === "allowed"
        ? t.allowed.border
        : t.border.strong
    : t.border.normal;

  const iconColor = active
    ? variant === "blocked"
      ? t.blocked.accent
      : variant === "allowed"
        ? t.allowed.accent
        : t.text.link
    : t.text.muted;

  const labelColor = active
    ? variant === "blocked"
      ? t.blocked.accent
      : variant === "allowed"
        ? t.allowed.accent
        : t.text.link
    : t.text.secondary;

  return (
    <TouchableOpacity
      onPress={press}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      disabled={disabled}
    >
      <Animated.View
        style={[
          sh.chip,
          { backgroundColor: bgColor, borderColor },
          disabled && { opacity: 0.45 },
          { transform: [{ scale: sc }] },
        ]}
      >
        <Text style={[sh.chipIcon, { color: iconColor }]}>{icon}</Text>
        <Text
          style={[
            sh.chipLabel,
            { color: labelColor },
            active && { fontWeight: "700" },
          ]}
        >
          {label}
        </Text>
        {active && (
          <View style={[sh.chipCheck, { backgroundColor: borderColor }]}>
            <Text style={sh.chipCheckText}>✓</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── FiltersModal ──────────────────────────────────────────────────────────────
function FiltersModal({
  visible,
  filters,
  onFiltersChange,
  onClose,
  systemAppsLoading,
}: {
  visible: boolean;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  onClose: () => void;
  systemAppsLoading?: boolean;
}) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(500)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Inner visibility drives the Modal's `visible` prop so we can animate out
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      // Small tick so the modal is mounted before we animate
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 240,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            tension: 280,
            friction: 28,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      // Animate out then unmount
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 500,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRendered(false);
        translateY.setValue(500);
        backdropOpacity.setValue(0);
      });
    }
  }, [visible]);

  const handleScope = (scope: ScopeKey) => {
    onFiltersChange({ ...filters, scope });
    onClose();
  };

  const handleState = (state: StateKey) => {
    const next: StateKey = filters.state === state ? "any" : state;
    onFiltersChange({ ...filters, state: next });
    onClose();
  };

  const handleReset = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    onFiltersChange(DEFAULT_FILTERS);
    onClose();
  };

  const activeCount =
    (filters.scope !== "all" ? 1 : 0) + (filters.state !== "any" ? 1 : 0);

  if (!rendered) return null;

  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[sh.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          sh.sheet,
          {
            backgroundColor: t.bg.card,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={[sh.handle, { backgroundColor: t.border.normal }]} />

        {/* Header */}
        <View style={sh.sheetHeader}>
          <Text style={[sh.sheetTitle, { color: t.text.primary }]}>
            Filtres avancés
          </Text>
          {activeCount > 0 && (
            <TouchableOpacity
              onPress={handleReset}
              activeOpacity={0.7}
              style={[
                sh.resetBtn,
                { borderColor: t.border.normal, backgroundColor: t.bg.cardAlt },
              ]}
            >
              <Text style={[sh.resetBtnText, { color: t.text.secondary }]}>
                Réinitialiser
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Section : Portée */}
        <View style={sh.section}>
          <Text style={[sh.sectionTitle, { color: t.text.muted }]}>PORTÉE</Text>
          <View style={sh.chipRow}>
            <Chip
              label="Toutes"
              icon="◉"
              active={filters.scope === "all"}
              onPress={() => handleScope("all")}
            />
            <Chip
              label="Installées"
              icon="⬇"
              active={filters.scope === "user"}
              onPress={() => handleScope("user")}
            />
            <Chip
              label={systemAppsLoading ? "Chargement…" : "Système"}
              icon={systemAppsLoading ? "◌" : "⚙"}
              active={filters.scope === "system"}
              onPress={() => handleScope("system")}
              disabled={!!systemAppsLoading}
            />
          </View>
        </View>

        {/* Divider */}
        <View style={[sh.divider, { backgroundColor: t.border.light }]} />

        {/* Section : État */}
        <View style={sh.section}>
          <Text style={[sh.sectionTitle, { color: t.text.muted }]}>ÉTAT</Text>
          <View style={sh.chipRow}>
            <Chip
              label="Toutes"
              icon="◎"
              active={filters.state === "any"}
              onPress={() => handleState("any")}
            />
            <Chip
              label="Bloquées"
              icon="⊘"
              active={filters.state === "blocked"}
              onPress={() => handleState("blocked")}
              variant="blocked"
            />
            <Chip
              label="Autorisées"
              icon="✓"
              active={filters.state === "allowed"}
              onPress={() => handleState("allowed")}
              variant="allowed"
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── SearchAndFilters (main export) ───────────────────────────────────────────
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
  const [modalVisible, setModalVisible] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const filterBtnScale = useRef(new Animated.Value(1)).current;

  const activeCount =
    (filters.scope !== "all" ? 1 : 0) + (filters.state !== "any" ? 1 : 0);
  const hasActive = activeCount > 0;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const openModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.timing(filterBtnScale, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(filterBtnScale, {
        toValue: 1,
        tension: 340,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();
    setModalVisible(true);
  };

  const inputBorder = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.border.light, t.border.focus],
  });
  const inputShadow = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08],
  });

  return (
    <>
      <View style={sh.row}>
        {/* ── Search input ── */}
        <Animated.View
          style={[
            sh.searchBox,
            {
              backgroundColor: t.bg.cardAlt,
              borderColor: inputBorder,
              shadowOpacity: inputShadow,
              shadowColor: t.border.focus,
              shadowOffset: { width: 0, height: 3 },
              shadowRadius: 10,
            },
          ]}
        >
          <Text
            style={[
              sh.searchIcon,
              { color: focused ? t.text.link : t.text.muted },
            ]}
          >
            ⌕
          </Text>
          <TextInput
            style={[sh.input, { color: t.text.primary }]}
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
              <View
                style={[
                  sh.clearBtn,
                  { backgroundColor: t.border.normal + "66" },
                ]}
              >
                <Text style={[sh.clearBtnText, { color: t.text.muted }]}>
                  ✕
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── Filters button ── */}
        <Animated.View style={{ transform: [{ scale: filterBtnScale }] }}>
          <TouchableOpacity
            onPress={openModal}
            activeOpacity={1}
            style={[
              sh.filterBtn,
              {
                backgroundColor: hasActive ? t.bg.accent : t.bg.cardAlt,
                borderColor: hasActive ? t.border.strong : t.border.light,
              },
            ]}
            accessibilityLabel="Ouvrir les filtres"
            accessibilityRole="button"
          >
            {/* Sliders icon */}
            <View style={sh.sliderIcon}>
              <View
                style={[
                  sh.sliderLine,
                  {
                    width: 14,
                    backgroundColor: hasActive ? t.text.link : t.text.muted,
                  },
                ]}
              />
              <View
                style={[
                  sh.sliderLine,
                  {
                    width: 10,
                    backgroundColor: hasActive ? t.text.link : t.text.muted,
                  },
                ]}
              />
              <View
                style={[
                  sh.sliderLine,
                  {
                    width: 6,
                    backgroundColor: hasActive ? t.text.link : t.text.muted,
                  },
                ]}
              />
            </View>
            {/* Active badge */}
            {hasActive && (
              <View style={[sh.badge, { backgroundColor: t.text.link }]}>
                <Text style={sh.badgeText}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <FiltersModal
        visible={modalVisible}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onClose={() => setModalVisible(false)}
        systemAppsLoading={systemAppsLoading}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  // ── Search row ──
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBox: {
    flex: 1,
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

  // ── Filter button ──
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderIcon: {
    gap: 3.5,
    alignItems: "flex-end",
  },
  sliderLine: {
    height: 1.5,
    borderRadius: 1,
  },
  badge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 11,
  },

  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,13,30,0.55)",
  },

  // ── Bottom sheet ──
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },

  // ── Sheet header ──
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Sections ──
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginBottom: 20,
  },

  // ── Chips ──
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipIcon: {
    fontSize: 12,
    lineHeight: 16,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  chipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  chipCheckText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 11,
  },
});
