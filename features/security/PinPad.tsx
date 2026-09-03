/**
 * features/security/PinPad.tsx — Pavé numérique
 *
 * Un seul pavé pour les trois usages : verrouillage de l'app, changement de
 * code, et PIN parent. Le composant ne décide de rien — il remonte le code
 * saisi, et déclenche `onComplete` quand la longueur attendue est atteinte.
 */

import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Radius, Spacing, Spring, useTheme } from "@/theme";
import { Icon, Text, Touchable } from "@/ui";

export const PIN_LENGTH = 6;
/** Longueur minimale acceptée à la création. */
export const PIN_MIN_LENGTH = 4;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"] as const;

// ─── Points de saisie ────────────────────────────────────────────────────────

export function PinDots({
  length,
  filled,
  error = false,
  size = 13,
}: {
  length?: number;
  filled: number;
  /** Déclenche une secousse et colore les points en rouge. */
  error?: boolean;
  size?: number;
}) {
  const { t } = useTheme();
  const count = length ?? PIN_LENGTH;
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-9, { duration: 55 }),
      withTiming(9, { duration: 55 }),
      withTiming(-6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, [error, shake]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const accent = error ? t.intent.danger.accent : t.brand.base;

  return (
    <Animated.View style={[st.dots, anim]}>
      {Array.from({ length: count }, (_, i) => (
        <PinDot key={i} active={i < filled} size={size} accent={accent} />
      ))}
    </Animated.View>
  );
}

function PinDot({
  active,
  size,
  accent,
}: {
  active: boolean;
  size: number;
  accent: string;
}) {
  const { t } = useTheme();
  const scale = useSharedValue(active ? 1 : 0.72);

  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.72, Spring.bouncy);
  }, [active, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: active ? accent : t.bg.cardAlt,
          borderWidth: active ? 0 : 1,
          borderColor: t.border.normal,
        },
        anim,
      ]}
    />
  );
}

// ─── Pavé ────────────────────────────────────────────────────────────────────

export type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  /** Appelé dès que `value` atteint `length`. */
  onComplete?: (pin: string) => void;
  length?: number;
  /** Remplace la touche vide en bas à gauche par une action biométrique. */
  onBiometric?: () => void;
  biometricIcon?: "fingerprint" | "face-recognition";
  disabled?: boolean;
};

export function PinPad({
  value,
  onChange,
  onComplete,
  length = PIN_LENGTH,
  onBiometric,
  biometricIcon = "fingerprint",
  disabled = false,
}: PinPadProps) {
  const { t } = useTheme();

  // `onComplete` est déclenché par effet et non dans le gestionnaire de touche :
  // le parent voit ainsi toujours la valeur finale déjà appliquée.
  useEffect(() => {
    if (value.length === length) onComplete?.(value);
  }, [value, length, onComplete]);

  const press = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (disabled) return;
      if (key === "del") {
        onChange(value.slice(0, -1));
        return;
      }
      if (key === "bio") {
        onBiometric?.();
        return;
      }
      if (value.length >= length) return;
      onChange(value + key);
    },
    [disabled, value, length, onChange, onBiometric],
  );

  return (
    <View style={st.grid}>
      {KEYS.map((key) => {
        if (key === "bio" && !onBiometric) {
          return <View key={key} style={st.cell} />;
        }
        return (
          <Touchable
            key={key}
            onPress={() => press(key)}
            disabled={disabled}
            feedback="strong"
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={
              key === "del" ? "Effacer" : key === "bio" ? "Déverrouiller par biométrie" : key
            }
            style={st.cell}
          >
            <View
              style={[
                st.key,
                {
                  backgroundColor: key === "del" ? "transparent" : t.bg.cardAlt,
                  borderColor: key === "del" ? "transparent" : t.border.light,
                },
              ]}
            >
              {key === "del" ? (
                <Icon name="backspace-outline" size={21} color={t.text.muted} />
              ) : key === "bio" ? (
                <Icon name={biometricIcon} size={23} color={t.brand.base} />
              ) : (
                <Text variant="title2" tone="primary">
                  {key}
                </Text>
              )}
            </View>
          </Touchable>
        );
      })}
    </View>
  );
}

const KEY_SIZE = 68;

const st = StyleSheet.create({
  dots: { flexDirection: "row", gap: Spacing.md, justifyContent: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: KEY_SIZE * 3 + Spacing.lg * 2,
    gap: Spacing.lg,
    alignSelf: "center",
  },
  cell: { width: KEY_SIZE, height: KEY_SIZE },
  key: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
