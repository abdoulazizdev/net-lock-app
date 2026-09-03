/**
 * ui/Touchable.tsx — Zone tactile standard
 *
 * Remplace `TouchableOpacity` partout : au lieu d'un simple fondu, l'élément
 * se comprime légèrement sur un ressort Reanimated (piloté par l'UI thread,
 * donc insensible aux blocages du thread JS) et déclenche un retour haptique.
 *
 *   <Touchable onPress={…}>            // carte : compression discrète
 *   <Touchable feedback="strong">      // bouton : compression marquée
 *   <Touchable feedback="none">        // ligne de liste pleine largeur
 */

import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { DISABLED_OPACITY, Spring } from "@/theme";

/** Intensité de la compression au toucher. */
export type PressFeedback = "none" | "subtle" | "strong";

/** Retour haptique déclenché au relâchement. */
export type HapticStyle = "none" | "selection" | "light" | "medium" | "success" | "warning";

const SCALE: Record<PressFeedback, number> = {
  none: 1,
  subtle: 0.985,
  strong: 0.955,
};

export type TouchableProps = Omit<PressableProps, "style"> & {
  feedback?: PressFeedback;
  haptic?: HapticStyle;
  /** Opacité appliquée pendant l'appui, en plus de l'échelle. */
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

function fireHaptic(style: HapticStyle) {
  switch (style) {
    case "none":
      return;
    case "selection":
      Haptics.selectionAsync().catch(() => {});
      return;
    case "light":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    case "medium":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    case "success":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      return;
    case "warning":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      return;
  }
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Touchable = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  TouchableProps
>(function Touchable(
  {
    feedback = "subtle",
    haptic = "selection",
    pressedOpacity = 0.9,
    style,
    onPress,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const pressed = useSharedValue(0);

  // Animer directement le Pressable évite un View intermédiaire qui casserait
  // les mises en page en `flex: 1`.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - SCALE[feedback]) }],
    opacity: 1 - pressed.value * (1 - pressedOpacity),
  }));

  const handlePressIn = useCallback(() => {
    pressed.value = withSpring(1, Spring.snappy);
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, Spring.snappy);
  }, [pressed]);

  const handlePress = useCallback<NonNullable<PressableProps["onPress"]>>(
    (e) => {
      fireHaptic(haptic);
      onPress?.(e);
    },
    [haptic, onPress],
  );

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, disabled && { opacity: DISABLED_OPACITY }, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
});
