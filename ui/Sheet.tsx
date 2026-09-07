/**
 * ui/Sheet.tsx — Panneaux modaux
 *
 * `Sheet`  : panneau ancré en bas, fermable au glissement vers le bas.
 * `Dialog` : boîte centrée, pour une confirmation courte.
 *
 * Le glissement passe par Gesture Handler et Reanimated : le panneau suit le
 * doigt sans latence, et se referme si la vitesse ou la distance dépasse le
 * seuil. Une modale sans geste de fermeture donne l'impression d'être piégé.
 *
 * Deux règles héritées de bugs réels :
 *   — le geste n'est capté que sur la poignée et l'en-tête, jamais sur le
 *     corps : sinon il vole le défilement et le bas du contenu devient
 *     inatteignable ;
 *   — la hauteur du clavier est retranchée à la main. En affichage bord à
 *     bord, une `Modal` translucide n'est pas redimensionnée par Android :
 *     sans ce calcul, le clavier recouvre le champ et son bouton.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Duration, Radius, Spacing, Spring, useTheme } from "@/theme";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

/** Fraction de la hauteur du panneau à dépasser pour déclencher la fermeture. */
const DISMISS_RATIO = 0.32;
const DISMISS_VELOCITY = 900;

// ─── Sheet ───────────────────────────────────────────────────────────────────

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Actions collées en bas, hors de la zone défilante. */
  footer?: React.ReactNode;
  /**
   * Message d'erreur affiché juste au-dessus du pied. À utiliser plutôt qu'un
   * toast : un panneau modal recouvre la zone de notifications.
   */
  error?: string | null;
  /** Le contenu défile (par défaut). `false` pour un panneau court et fixe. */
  scrollable?: boolean;
  /** Empêche la fermeture par glissement, retour ou tap sur le voile. */
  dismissible?: boolean;
  /** Hauteur maximale, en fraction de l'écran. */
  maxHeightRatio?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Accès à la zone défilante — pour amener une section à l'écran. */
  scrollRef?: React.RefObject<ScrollView | null>;
  children?: React.ReactNode;
};

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  footer,
  error,
  scrollable = true,
  dismissible = true,
  maxHeightRatio = 0.88,
  contentStyle,
  scrollRef,
  children,
}: SheetProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const translateY = useSharedValue(screenH);
  const backdrop = useSharedValue(0);
  const sheetHeight = useSharedValue(screenH * 0.5);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, Spring.gentle);
      backdrop.value = withTiming(1, { duration: Duration.base });
    } else {
      translateY.value = withTiming(screenH, { duration: Duration.base });
      backdrop.value = withTiming(0, { duration: Duration.fast });
    }
  }, [visible, screenH, translateY, backdrop]);

  // Hauteur du clavier : la modale est translucide, Android ne la redimensionne
  // pas — on remonte le panneau nous-mêmes.
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    if (!visible) {
      setKeyboard(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) =>
      setKeyboard(e.endCoordinates?.height ?? 0),
    );
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboard(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible]);

  // Le bouton retour Android ferme le panneau plutôt que l'écran.
  useEffect(() => {
    if (!visible || !dismissible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, dismissible, onClose]);

  const close = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onChange((e) => {
      // Vers le haut, on résiste : le panneau n'est pas extensible.
      translateY.value = Math.max(0, translateY.value + e.changeY);
    })
    .onEnd((e) => {
      const far = translateY.value > sheetHeight.value * DISMISS_RATIO;
      const fast = e.velocityY > DISMISS_VELOCITY;
      if (far || fast) {
        translateY.value = withTiming(sheetHeight.value, {
          duration: Duration.fast,
        });
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, Spring.default);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={st.modalRoot}>
        <Animated.View style={[st.backdrop, { backgroundColor: t.bg.scrim }, backdropStyle]}>
          <Pressable
            style={st.backdropPress}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          />
        </Animated.View>

        <Animated.View
          onLayout={(e) => {
            sheetHeight.value = e.nativeEvent.layout.height;
          }}
          style={[
            st.sheet,
            {
              backgroundColor: t.bg.elevated,
              borderColor: t.border.normal,
              maxHeight: Math.max(240, (screenH - keyboard) * maxHeightRatio),
              marginBottom: keyboard,
              paddingBottom: keyboard > 0 ? Spacing.md : insets.bottom + Spacing.lg,
            },
            t.shadow.xl,
            sheetStyle,
          ]}
        >
          {/* Le geste de fermeture ne vit que sur cet en-tête : le corps garde
              son défilement, quel que soit l'endroit où le doigt se pose. */}
          <GestureDetector gesture={pan}>
            <View>
              {dismissible ? (
                <View style={st.grabberZone}>
                  <View style={[st.grabber, { backgroundColor: t.border.strong }]} />
                </View>
              ) : (
                <View style={st.grabberSpacer} />
              )}

              {title ? (
                <View style={st.header}>
                  <View style={st.headerText}>
                    <Text variant="title2" numberOfLines={2}>
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text variant="callout" tone="muted" numberOfLines={3}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {dismissible ? (
                    <IconButton
                      icon="close"
                      variant="soft"
                      onPress={close}
                      accessibilityLabel="Fermer"
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </GestureDetector>

          {scrollable ? (
            <ScrollView
              ref={scrollRef}
              style={st.bodyScroll}
              contentContainerStyle={[st.body, contentStyle]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[st.body, contentStyle]}>{children}</View>
          )}

          {error ? (
            <View
              style={[
                st.error,
                {
                  backgroundColor: t.intent.danger.bg,
                  borderColor: t.intent.danger.border,
                },
              ]}
            >
              <Text variant="footnote" tone="danger">
                {error}
              </Text>
            </View>
          ) : null}

          {footer ? (
            <View style={[st.footer, { borderTopColor: t.border.light }]}>{footer}</View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

export type DialogProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  /** Boutons ; utiliser `ButtonRow` pour les aligner. */
  actions?: React.ReactNode;
  dismissible?: boolean;
  children?: React.ReactNode;
};

export function Dialog({
  visible,
  onClose,
  title,
  message,
  actions,
  dismissible = true,
  children,
}: DialogProps) {
  const { t } = useTheme();
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, Spring.gentle);
      opacity.value = withTiming(1, { duration: Duration.fast });
    } else {
      scale.value = withTiming(0.94, { duration: Duration.fast });
      opacity.value = withTiming(0, { duration: Duration.fast });
    }
  }, [visible, scale, opacity]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
    >
      <View style={[st.dialogRoot, { backgroundColor: t.bg.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissible ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <Animated.View
          style={[
            st.dialog,
            { backgroundColor: t.bg.elevated, borderColor: t.border.normal },
            t.shadow.xl,
            boxStyle,
          ]}
        >
          <Text variant="title3" numberOfLines={3}>
            {title}
          </Text>
          {message ? (
            <Text variant="body" tone="secondary">
              {message}
            </Text>
          ) : null}
          {children}
          {actions ? <View style={st.dialogActions}>{actions}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  backdropPress: { flex: 1 },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  grabberZone: { alignItems: "center", paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  grabberSpacer: { height: Spacing.xl },
  grabber: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerText: { flex: 1, gap: Spacing.xs },
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm, gap: Spacing.md },
  error: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  dialogRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xxl },
  dialog: {
    width: "100%",
    maxWidth: 400,
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  dialogActions: { gap: Spacing.sm, paddingTop: Spacing.xs },
});
