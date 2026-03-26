import { Colors, useTheme } from "@/theme";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VpnActivationModalProps {
  visible: boolean;
  appName: string;
  onActivate: () => void;
  onDismiss: () => void;
}

// ─── Shield pulse rings ───────────────────────────────────────────────────────
const ShieldRings = React.memo(function ShieldRings() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 500);
    const a3 = pulse(ring3, 1000);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  const makeRingStyle = (anim: Animated.Value, size: number) => ({
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1.5,
    borderColor: "rgba(248,113,113,0.55)",
    opacity: anim.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0, 0.8, 0],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.6, 1.6],
        }),
      },
    ],
  });

  return (
    <>
      <Animated.View style={makeRingStyle(ring1, 100)} />
      <Animated.View style={makeRingStyle(ring2, 100)} />
      <Animated.View style={makeRingStyle(ring3, 100)} />
    </>
  );
});

// ─── VpnActivationModal ───────────────────────────────────────────────────────
export const VpnActivationModal = React.memo(function VpnActivationModal({
  visible,
  appName,
  onActivate,
  onDismiss,
}: VpnActivationModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  // Animation refs
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  // Internal visibility so we can animate out before unmounting
  const [internalVisible, setInternalVisible] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
    }
  }, [visible]);

  useEffect(() => {
    if (internalVisible && visible) {
      // Animate in
      backdropOpacity.setValue(0);
      cardTranslateY.setValue(60);
      cardOpacity.setValue(0);
      iconBounce.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          tension: 220,
          friction: 22,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Bounce icon after card settled
        Animated.sequence([
          Animated.timing(iconBounce, {
            toValue: -8,
            duration: 200,
            easing: Easing.out(Easing.back(3)),
            useNativeDriver: true,
          }),
          Animated.spring(iconBounce, {
            toValue: 0,
            tension: 300,
            friction: 14,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [internalVisible, visible]);

  const animateOut = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 40,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInternalVisible(false);
      cb();
    });
  };

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={() => animateOut(onDismiss)}
    >
      <TouchableWithoutFeedback onPress={() => animateOut(onDismiss)}>
        <Animated.View style={[pm.backdrop, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                pm.sheet,
                {
                  backgroundColor: t.bg.card,
                  borderColor: t.border.light,
                  paddingBottom: insets.bottom + 16,
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslateY }],
                },
              ]}
            >
              {/* Drag handle */}
              <View style={[pm.handle, { backgroundColor: t.border.normal }]} />

              {/* Icon area */}
              <Animated.View
                style={[
                  pm.iconArea,
                  { transform: [{ translateY: iconBounce }] },
                ]}
              >
                <ShieldRings />
                <View
                  style={[
                    pm.haloOuter,
                    {
                      backgroundColor: t.danger.bg,
                      borderColor: t.danger.border,
                    },
                  ]}
                />
                <View
                  style={[
                    pm.haloMid,
                    {
                      backgroundColor: t.danger.bg,
                      borderColor: t.danger.border,
                    },
                  ]}
                />
                <View
                  style={[
                    pm.iconBox,
                    {
                      backgroundColor: t.danger.bg,
                      borderColor: t.danger.accent,
                    },
                  ]}
                >
                  <Text style={pm.iconEmoji}>🛡️</Text>
                </View>
              </Animated.View>

              {/* Texts */}
              <Text style={[pm.title, { color: t.text.primary }]}>
                VPN désactivé
              </Text>
              <Text style={[pm.subtitle, { color: t.text.secondary }]}>
                {"Vous venez de bloquer "}
                <Text style={[pm.subtitleAccent, { color: t.text.primary }]}>
                  {appName}
                </Text>
                {", mais le VPN est éteint."}
              </Text>

              {/* Info box */}
              <View
                style={[
                  pm.infoBox,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
                ]}
              >
                <Text style={pm.infoIcon}>ℹ️</Text>
                <Text style={[pm.infoText, { color: t.text.muted }]}>
                  Sans VPN actif, les règles de blocage ne sont{" "}
                  <Text style={{ fontWeight: "700", color: t.text.secondary }}>
                    pas appliquées
                  </Text>{" "}
                  et l'application peut toujours accéder au réseau.
                </Text>
              </View>

              <View style={[pm.sep, { backgroundColor: t.border.light }]} />

              {/* Actions */}
              <View style={pm.actions}>
                <TouchableOpacity
                  style={[
                    pm.btnSecondary,
                    {
                      backgroundColor: t.bg.cardAlt,
                      borderColor: t.border.normal,
                    },
                  ]}
                  onPress={() => animateOut(onDismiss)}
                  activeOpacity={0.72}
                >
                  <Text style={[pm.btnSecondaryText, { color: t.text.muted }]}>
                    Pas maintenant
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    pm.btnPrimary,
                    { backgroundColor: Colors.green[500] },
                  ]}
                  onPress={() => animateOut(onActivate)}
                  activeOpacity={0.82}
                >
                  <Text style={pm.btnPrimaryIcon}>⚡</Text>
                  <Text style={pm.btnPrimaryText}>Activer le VPN</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const pm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,13,30,0.78)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 32,
    alignItems: "center",
  },

  // Handle
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 28,
  },

  // Icon
  iconArea: {
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  haloOuter: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 30,
    borderWidth: 1,
  },
  haloMid: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1,
  },
  iconBox: {
    width: 62,
    height: 62,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 28, lineHeight: 34 },

  // Text
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },
  subtitleAccent: {
    fontWeight: "700",
  },

  // Info box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: "100%",
  },
  infoIcon: { fontSize: 13, lineHeight: 19, flexShrink: 0, marginTop: 1 },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
  },

  // Separator
  sep: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    marginVertical: 22,
  },

  // Buttons
  actions: { width: "100%", gap: 10 },

  btnSecondary: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  btnPrimary: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: Colors.green[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.52,
    shadowRadius: 18,
    elevation: 10,
  },
  btnPrimaryIcon: { fontSize: 16, lineHeight: 22 },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
});
