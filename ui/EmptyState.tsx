/**
 * ui/EmptyState.tsx — États vides et d'erreur
 *
 * Un état vide dit toujours trois choses : ce qui manque, pourquoi, et quoi
 * faire ensuite. Sans action possible, on se limite au titre et au sous-titre.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Radius, Spacing, useTheme } from "@/theme";
import { Button, type ButtonVariant } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  /** Action secondaire, en dessous. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: "neutral" | "danger" | "warning";
  /** Version compacte, pour un état vide à l'intérieur d'une carte. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon = "tray-remove",
  title,
  message,
  actionLabel,
  onAction,
  actionVariant = "primary",
  secondaryLabel,
  onSecondary,
  tone = "neutral",
  compact = false,
  style,
}: EmptyStateProps) {
  const { t } = useTheme();

  const c =
    tone === "neutral"
      ? { bg: t.bg.cardAlt, border: t.border.light, fg: t.text.muted }
      : {
          bg: t.intent[tone].bg,
          border: t.intent[tone].border,
          fg: t.intent[tone].accent,
        };

  return (
    <View style={[st.wrap, compact && st.wrapCompact, style]}>
      <View
        style={[
          st.iconBox,
          compact && st.iconBoxCompact,
          { backgroundColor: c.bg, borderColor: c.border },
        ]}
      >
        <Icon name={icon} size={compact ? 22 : 30} color={c.fg} />
      </View>

      <View style={st.textBlock}>
        <Text variant={compact ? "headline" : "title3"} center numberOfLines={2}>
          {title}
        </Text>
        {message ? (
          <Text variant="callout" tone="muted" center>
            {message}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant={actionVariant} size={compact ? "sm" : "md"} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" size="sm" />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
  },
  wrapCompact: { gap: Spacing.md, paddingVertical: Spacing.xxl },
  iconBox: {
    width: 66,
    height: 66,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxCompact: { width: 48, height: 48, borderRadius: Radius.md },
  textBlock: { gap: Spacing.xs, alignItems: "center" },
});
