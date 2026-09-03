/**
 * ui/Screen.tsx — Ossature d'écran
 *
 *   const { scrollY, onScroll } = useScrollY();
 *
 *   <Screen>
 *     <AppBar title="Paramètres" back scrollY={scrollY} />
 *     <ScreenScroll onScroll={onScroll}> … </ScreenScroll>
 *   </Screen>
 *
 * `Screen` pose le fond, la safe-area haute et la barre de statut.
 * `AppBar` gagne sa bordure et son fond au défilement — le contenu paraît
 * passer sous la barre au lieu de s'y cogner.
 */

import { router } from "expo-router";
import React from "react";
import {
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spacing, useTheme } from "@/theme";
import { IconButton } from "./IconButton";
import { Text } from "./Text";
import type { IconName } from "./Icon";

/** Décalage à partir duquel l'AppBar est considérée « décollée ». */
const STICKY_THRESHOLD = 6;

/** Position de défilement partagée + gestionnaire à brancher sur la liste. */
export function useScrollY() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return { scrollY, onScroll };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export type ScreenProps = {
  children?: React.ReactNode;
  /** Applique la safe-area haute (à désactiver si l'AppBar la gère). */
  topInset?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  topInset = true,
  backgroundColor,
  style,
}: ScreenProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        st.screen,
        { backgroundColor: backgroundColor ?? t.bg.page },
        topInset && { paddingTop: insets.top },
        style,
      ]}
    >
      <StatusBar
        barStyle={t.statusBar}
        backgroundColor="transparent"
        translucent
      />
      {children}
    </View>
  );
}

/** ScrollView préconfigurée : rembourrage bas sûr, rebond désactivé. */
export const ScreenScroll = React.forwardRef<
  React.ComponentRef<typeof Animated.ScrollView>,
  React.ComponentProps<typeof Animated.ScrollView> & { bottomInset?: number }
>(function ScreenScroll({ contentContainerStyle, bottomInset = 32, ...rest }, ref) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.ScrollView
      ref={ref}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      {...rest}
      contentContainerStyle={[
        { paddingBottom: insets.bottom + bottomInset },
        contentContainerStyle,
      ]}
    />
  );
});

// ─── AppBar ──────────────────────────────────────────────────────────────────

export type AppBarAction = {
  icon: IconName;
  onPress: () => void;
  label: string;
  /** Pastille d'alerte sur l'icône. */
  badge?: boolean;
};

export type AppBarProps = {
  title: string;
  subtitle?: string;
  /** Affiche le bouton retour. Passer une fonction pour un comportement custom. */
  back?: boolean | (() => void);
  actions?: AppBarAction[];
  /** Contenu libre à droite — prioritaire sur `actions`. */
  right?: React.ReactNode;
  /** Rend la bordure et le fond dépendants du défilement. */
  scrollY?: SharedValue<number>;
  /** Le titre est masqué tant que la page n'a pas défilé (grand titre en dessous). */
  hideTitleUntilScroll?: boolean;
  /** Bandeau libre sous la barre (recherche, onglets…). */
  below?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppBar({
  title,
  subtitle,
  back,
  actions,
  right,
  scrollY,
  hideTitleUntilScroll = false,
  below,
  style,
}: AppBarProps) {
  const { t } = useTheme();

  const chrome = useAnimatedStyle(() => {
    const y = scrollY?.value ?? 0;
    const stuck = y > STICKY_THRESHOLD ? 1 : 0;
    return {
      borderBottomColor: t.border.light,
      borderBottomWidth: stuck ? StyleSheet.hairlineWidth : 0,
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    if (!hideTitleUntilScroll) return { opacity: 1 };
    const y = scrollY?.value ?? 0;
    // Le titre apparaît quand le grand titre a quitté l'écran.
    return { opacity: Math.min(1, Math.max(0, (y - 24) / 28)) };
  });

  const onBack = typeof back === "function" ? back : undefined;

  return (
    <Animated.View
      style={[st.appBar, { backgroundColor: t.bg.header }, chrome, style]}
    >
      <View style={st.appBarRow}>
        {back ? (
          <IconButton
            icon="chevron-left"
            size="md"
            variant="soft"
            onPress={onBack ?? defaultBack}
            accessibilityLabel="Retour"
          />
        ) : null}

        <Animated.View style={[st.appBarTitle, titleStyle]}>
          <Text variant="title3" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="footnote" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>

        <View style={st.appBarActions}>
          {right ??
            actions?.map((a) => (
              <View key={a.label} style={st.actionWrap}>
                <IconButton
                  icon={a.icon}
                  size="md"
                  variant="soft"
                  onPress={a.onPress}
                  accessibilityLabel={a.label}
                />
                {a.badge ? (
                  <View
                    style={[
                      st.actionBadge,
                      {
                        backgroundColor: t.intent.warning.accent,
                        borderColor: t.bg.header,
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
        </View>
      </View>
      {below}
    </Animated.View>
  );
}

/** Retour par défaut : remonte la pile, ou rejoint les onglets si elle est vide. */
function defaultBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

/**
 * Grand titre placé en haut du contenu défilant, façon iOS/Material 3 : il
 * défile avec la page tandis que l'AppBar garde le titre compact.
 */
export function LargeTitle({
  title,
  subtitle,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[st.largeTitle, style]}>
      <View style={st.largeTitleText}>
        <Text variant="display" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="callout" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1 },
  appBar: { zIndex: 10 },
  appBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 54,
    paddingHorizontal: Spacing.md,
  },
  appBarTitle: { flex: 1, paddingHorizontal: Spacing.xs },
  appBarActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionWrap: { position: "relative" },
  actionBadge: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  largeTitle: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  largeTitleText: { flex: 1, gap: Spacing.xs },
});
