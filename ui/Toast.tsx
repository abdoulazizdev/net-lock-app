/**
 * ui/Toast.tsx — Notifications éphémères
 *
 * Monter `<ToastHost />` une fois à la racine, puis appeler `toast()` depuis
 * n'importe où — y compris hors composant (services, gestionnaires d'erreur) :
 *
 *   toast.success("Profil activé");
 *   toast.error("Impossible de démarrer le VPN");
 *   toast({ message: "3 apps bloquées", action: { label: "Voir", onPress } });
 *
 * Une seule notification à la fois : la nouvelle remplace l'ancienne, ce qui
 * évite les piles illisibles.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Duration, Radius, Spacing, Spring, useTheme, type ThemeTokens } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { Touchable } from "./Touchable";

export type ToastTone = "neutral" | "success" | "error" | "warning" | "info";

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  icon?: IconName;
  /** Durée d'affichage en ms. `0` pour rester jusqu'à l'action ou au tap. */
  duration?: number;
  action?: { label: string; onPress: () => void };
};

type ToastEntry = ToastOptions & { id: number };

const DEFAULT_DURATION = 3200;
const DEFAULT_ICONS: Record<ToastTone, IconName> = {
  neutral: "information-outline",
  success: "check-circle-outline",
  error: "alert-circle-outline",
  warning: "alert-outline",
  info: "information-outline",
};

// ─── Bus ─────────────────────────────────────────────────────────────────────
// Un simple abonné (le host monté) : `toast()` reste appelable hors React.

let subscriber: ((entry: ToastEntry | null) => void) | null = null;
let nextId = 1;

function show(options: ToastOptions | string) {
  const opts = typeof options === "string" ? { message: options } : options;
  subscriber?.({ ...opts, id: nextId++ });
}

export const toast = Object.assign(show, {
  success: (message: string, action?: ToastOptions["action"]) =>
    show({ message, tone: "success", action }),
  error: (message: string, action?: ToastOptions["action"]) =>
    show({ message, tone: "error", action }),
  warning: (message: string, action?: ToastOptions["action"]) =>
    show({ message, tone: "warning", action }),
  info: (message: string, action?: ToastOptions["action"]) =>
    show({ message, tone: "info", action }),
  hide: () => subscriber?.(null),
});

// ─── Host ────────────────────────────────────────────────────────────────────

function palette(t: ThemeTokens, tone: ToastTone) {
  switch (tone) {
    case "success":
      return { accent: t.intent.allowed.accent, text: t.intent.allowed.text };
    case "error":
      return { accent: t.intent.danger.accent, text: t.intent.danger.text };
    case "warning":
      return { accent: t.intent.warning.accent, text: t.intent.warning.text };
    case "info":
      return { accent: t.intent.info.accent, text: t.intent.info.text };
    default:
      return { accent: t.brand.base, text: t.text.primary };
  }
}

/**
 * Zone d'affichage des notifications. À monter une seule fois, au-dessus de
 * la navigation. `bottomOffset` laisse la place à la barre d'onglets.
 */
export function ToastHost({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<ToastEntry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    translateY.value = withTiming(120, { duration: Duration.base });
    opacity.value = withTiming(0, { duration: Duration.fast });
    // Laisse l'animation se terminer avant de démonter le contenu.
    timer.current = setTimeout(() => setEntry(null), Duration.base);
  }, [clearTimer, translateY, opacity]);

  useEffect(() => {
    subscriber = (next) => {
      if (!next) {
        dismiss();
        return;
      }
      clearTimer();
      setEntry(next);
      translateY.value = withSpring(0, Spring.gentle);
      opacity.value = withTiming(1, { duration: Duration.fast });
      const duration = next.duration ?? DEFAULT_DURATION;
      if (duration > 0) timer.current = setTimeout(dismiss, duration);
    };
    return () => {
      subscriber = null;
      clearTimer();
    };
  }, [dismiss, clearTimer, translateY, opacity]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!entry) return null;

  const tone = entry.tone ?? "neutral";
  const c = palette(t, tone);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        st.host,
        { bottom: insets.bottom + bottomOffset + Spacing.lg },
        anim,
      ]}
    >
      <View
        style={[
          st.toast,
          { backgroundColor: t.bg.elevated, borderColor: t.border.normal },
          t.shadow.lg,
        ]}
      >
        <View style={[st.stripe, { backgroundColor: c.accent }]} />
        <Icon name={entry.icon ?? DEFAULT_ICONS[tone]} size={18} color={c.accent} />
        <Text variant="callout" numberOfLines={2} style={st.message}>
          {entry.message}
        </Text>
        {entry.action ? (
          <Touchable
            onPress={() => {
              entry.action?.onPress();
              dismiss();
            }}
            feedback="strong"
            style={[st.action, { borderColor: c.accent }]}
          >
            <Text variant="caption" color={c.accent} numberOfLines={1}>
              {entry.action.label}
            </Text>
          </Touchable>
        ) : (
          <Touchable
            onPress={dismiss}
            feedback="none"
            hitSlop={10}
            accessibilityLabel="Fermer"
          >
            <Icon name="close" size={15} color={t.text.muted} />
          </Touchable>
        )}
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  host: {
    position: "absolute",
    left: Spacing.gutter,
    right: Spacing.gutter,
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  stripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  message: { flex: 1 },
  action: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
});
