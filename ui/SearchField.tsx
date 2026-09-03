/**
 * ui/SearchField.tsx — Champ de recherche et champ de saisie
 *
 * `SearchField` : recherche avec effacement, contour animé au focus.
 * `TextField`   : saisie générique avec libellé, aide et état d'erreur.
 */

import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Duration, Radius, Spacing, Typography, useTheme } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

// ─── Recherche ───────────────────────────────────────────────────────────────

export type SearchFieldProps = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Élément posé à droite du champ (bouton de filtres…). */
  trailing?: React.ReactNode;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SearchField({
  value,
  onChangeText,
  placeholder = "Rechercher…",
  trailing,
  autoFocus = false,
  style,
}: SearchFieldProps) {
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: Duration.fast });
  }, [focused, focus]);

  const animated = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [t.border.light, t.border.focus],
    ),
  }));

  return (
    <View style={[st.searchRow, style]}>
      <Animated.View
        style={[st.search, { backgroundColor: t.bg.cardAlt }, animated]}
      >
        <Icon name="magnify" size={18} color={focused ? t.brand.base : t.text.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.text.faint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          selectionColor={t.brand.base}
          style={[st.input, { color: t.text.primary }]}
        />
        {value.length > 0 ? (
          <IconButton
            icon="close-circle"
            size="sm"
            variant="plain"
            color={t.text.muted}
            onPress={() => onChangeText("")}
            accessibilityLabel="Effacer la recherche"
          />
        ) : null}
      </Animated.View>
      {trailing}
    </View>
  );
}

// ─── Saisie ──────────────────────────────────────────────────────────────────

export type TextFieldProps = Omit<TextInputProps, "style"> & {
  label?: string;
  /** Texte d'aide sous le champ. Remplacé par `error` s'il y en a un. */
  hint?: string;
  error?: string;
  icon?: IconName;
  /** Compteur de caractères — nécessite `maxLength`. */
  counter?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({
  label,
  hint,
  error,
  icon,
  counter = false,
  maxLength,
  value,
  multiline,
  containerStyle,
  ...rest
}: TextFieldProps) {
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: Duration.fast });
  }, [focused, focus]);

  const animated = useAnimatedStyle(() => ({
    borderColor: error
      ? t.intent.danger.accent
      : interpolateColor(focus.value, [0, 1], [t.border.normal, t.border.focus]),
  }));

  return (
    <View style={[st.fieldWrap, containerStyle]}>
      {label ? (
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      ) : null}

      <Animated.View
        style={[
          st.field,
          multiline && st.fieldMultiline,
          { backgroundColor: t.bg.cardAlt },
          animated,
        ]}
      >
        {icon ? (
          <Icon
            name={icon}
            size={18}
            color={focused ? t.brand.base : t.text.muted}
            style={multiline ? st.fieldIconTop : undefined}
          />
        ) : null}
        <TextInput
          {...rest}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          placeholderTextColor={t.text.faint}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          selectionColor={t.brand.base}
          style={[st.input, multiline && st.inputMultiline, { color: t.text.primary }]}
        />
      </Animated.View>

      <View style={st.fieldFooter}>
        {error ? (
          <Text variant="footnote" tone="danger" style={st.flex}>
            {error}
          </Text>
        ) : hint ? (
          <Text variant="footnote" tone="faint" style={st.flex}>
            {hint}
          </Text>
        ) : (
          <View style={st.flex} />
        )}
        {counter && maxLength ? (
          <Text variant="footnote" tone="faint" tabular>
            {(value?.length ?? 0)}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: 42,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    padding: 0,
    ...Typography.body,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  fieldWrap: { gap: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 46,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  fieldMultiline: { alignItems: "flex-start", paddingVertical: Spacing.md },
  fieldIconTop: { marginTop: 2 },
  fieldFooter: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  flex: { flex: 1 },
});
