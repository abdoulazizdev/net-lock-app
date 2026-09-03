/**
 * ui/Segmented.tsx — Contrôle segmenté
 *
 * Onglets courts (2 à 4 segments) avec un indicateur glissant. Au-delà de 4,
 * ou si les libellés sont longs, préférer `Tabs` (défilement horizontal).
 */

import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { DISABLED_OPACITY, Radius, Spacing, Spring, useTheme } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { Touchable } from "./Touchable";

export type SegmentOption<K extends string> = {
  key: K;
  label: string;
  icon?: IconName;
  /** Compteur affiché après le libellé. */
  count?: number;
  /** Réservé aux abonnés — cadenas + libellé grisé. */
  locked?: boolean;
};

export type SegmentedProps<K extends string> = {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** `pill` posé sur la page, `inset` dans une carte. */
  variant?: "pill" | "inset";
  style?: StyleProp<ViewStyle>;
};

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  variant = "pill",
  style,
}: SegmentedProps<K>) {
  const { t } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const segment = width > 0 ? width / options.length : 0;
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withSpring(index * segment, Spring.default);
  }, [index, segment, offset]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - PADDING * 2),
    [],
  );

  return (
    <View
      onLayout={onLayout}
      style={[
        st.track,
        {
          backgroundColor: variant === "pill" ? t.bg.cardAlt : t.bg.cardSunken,
          borderColor: t.border.light,
        },
        style,
      ]}
    >
      {segment > 0 ? (
        <Animated.View
          style={[
            st.indicator,
            {
              width: segment,
              backgroundColor: t.bg.card,
              borderColor: t.border.normal,
            },
            t.shadow.sm,
            indicator,
          ]}
        />
      ) : null}

      {options.map((o) => {
        const active = o.key === value;
        return (
          <Touchable
            key={o.key}
            onPress={() => onChange(o.key)}
            feedback="none"
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={st.segment}
          >
            <View style={[st.segmentInner, o.locked && st.locked]}>
              {o.icon ? (
                <Icon
                  name={o.icon}
                  size={15}
                  color={active ? t.brand.base : t.text.muted}
                />
              ) : null}
              <Text
                variant="caption"
                color={active ? t.text.primary : t.text.muted}
                numberOfLines={1}
              >
                {o.label}
                {o.count !== undefined ? ` ${o.count}` : ""}
              </Text>
              {o.locked ? (
                <Icon name="lock" size={11} color={t.intent.focus.accent} />
              ) : null}
            </View>
          </Touchable>
        );
      })}
    </View>
  );
}

// ─── Tabs (défilables) ───────────────────────────────────────────────────────

/**
 * Onglets défilables avec soulignement animé. Pour 4 onglets ou plus, ou des
 * libellés de longueur variable.
 */
export function Tabs<K extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedProps<K>) {
  const { t } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.tabsContent}
      style={[st.tabs, { borderBottomColor: t.border.light }, style]}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Touchable
            key={o.key}
            onPress={() => onChange(o.key)}
            feedback="none"
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              st.tab,
              { borderBottomColor: active ? t.brand.base : "transparent" },
            ]}
          >
            {o.icon ? (
              <Icon
                name={o.icon}
                size={16}
                color={active ? t.brand.base : t.text.muted}
              />
            ) : null}
            <Text
              variant="headline"
              color={active ? t.text.primary : t.text.muted}
              numberOfLines={1}
            >
              {o.label}
            </Text>
            {o.count !== undefined ? (
              <Text variant="caption" tone="faint" tabular>
                {o.count}
              </Text>
            ) : null}
            {o.locked ? (
              <Icon name="lock" size={12} color={t.intent.focus.accent} />
            ) : null}
          </Touchable>
        );
      })}
    </ScrollView>
  );
}

const PADDING = 3;

const st = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: PADDING,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  indicator: {
    position: "absolute",
    top: PADDING,
    left: PADDING,
    bottom: PADDING,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  segment: { flex: 1 },
  segmentInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: Spacing.sm,
  },
  locked: { opacity: DISABLED_OPACITY + 0.2 },
  tabs: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  tabsContent: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
  },
});
