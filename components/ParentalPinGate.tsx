/**
 * ParentalPinGate.tsx
 *
 * Modal PIN parent universel.
 * Utiliser avec le hook useParentalGuard() pour protéger n'importe quelle action.
 *
 * Usage :
 *   const { guard, ParentalModal } = useParentalGuard();
 *
 *   // Dans le JSX :
 *   <ParentalModal />
 *
 *   // Pour protéger une action :
 *   const handleToggleVpn = async () => {
 *     const ok = await guard("toggle_vpn");
 *     if (!ok) return;            // PIN refusé → rien
 *     await VpnService.startVpn();
 *   };
 */
import ParentalControlService, {
    ProtectedAction,
} from "@/services/parental-control.service";
import { Colors, useTheme } from "@/theme";
import React, { useCallback, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Modal,
    StyleSheet,
    TouchableOpacity,
    View
} from "react-native";
import { Text } from "react-native-paper";

// ── PIN Pad compact ────────────────────────────────────────────────────────────
function MiniPinPad({
  pin,
  onDigit,
  onDelete,
  shakeAnim,
}: {
  pin: string;
  onDigit: (d: string) => void;
  onDelete: () => void;
  shakeAnim: Animated.Value;
}) {
  const { t } = useTheme();
  const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <View style={pp.wrap}>
      {/* Points */}
      <Animated.View
        style={[pp.dots, { transform: [{ translateX: shakeAnim }] }]}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              pp.dot,
              i < pin.length
                ? { backgroundColor: Colors.blue[500] }
                : {
                    backgroundColor: t.bg.cardAlt,
                    borderWidth: 1,
                    borderColor: t.border.normal,
                  },
            ]}
          />
        ))}
      </Animated.View>
      {/* Grille */}
      <View style={pp.grid}>
        {DIGITS.map((d, idx) => {
          if (d === "") return <View key={idx} style={pp.cell} />;
          return (
            <TouchableOpacity
              key={idx}
              style={pp.cell}
              onPress={() => (d === "⌫" ? onDelete() : onDigit(d))}
              activeOpacity={0.5}
            >
              <Text
                style={[
                  pp.digit,
                  { color: d === "⌫" ? t.text.muted : t.text.primary },
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const pp = StyleSheet.create({
  wrap: { alignItems: "center", gap: 18, width: "100%" },
  dots: { flexDirection: "row", gap: 12 },
  dot: { width: 13, height: 13, borderRadius: 6.5 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 270,
    justifyContent: "center",
  },
  cell: {
    width: 90,
    height: 64,
    justifyContent: "center",
    alignItems: "center",
  },
  digit: { fontSize: 24, fontWeight: "600" },
});

// ── Hook ────────────────────────────────────────────────────────────────────────
export function useParentalGuard() {
  const { t } = useTheme();
  const [visible, setVisible] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Résolveur de la promesse en cours
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 5,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  /**
   * Appeler avant toute action protégée.
   * - Si parental désactivé → retourne true immédiatement
   * - Si parental activé   → ouvre le modal PIN, retourne true si PIN correct
   */
  const guard = useCallback(
    async (_action: ProtectedAction): Promise<boolean> => {
      const allowed = await ParentalControlService.isActionAllowed(_action);
      if (allowed) return true;

      // Ouvrir le modal et attendre la résolution
      return new Promise<boolean>((resolve) => {
        setPin("");
        resolverRef.current = resolve;
        setVisible(true);
      });
    },
    [],
  );

  const handleDigit = useCallback((d: string) => {
    setPin((prev) => (prev.length < 6 ? prev + d : prev));
  }, []);

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (pin.length < 4) {
      shake();
      return;
    }
    setLoading(true);
    try {
      const ok = await ParentalControlService.verifyParentalPin(pin);
      if (ok) {
        setVisible(false);
        setPin("");
        resolverRef.current?.(true);
        resolverRef.current = null;
      } else {
        shake();
        setPin("");
        Alert.alert("PIN incorrect", "Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  }, [pin, shake]);

  const handleCancel = useCallback(() => {
    setVisible(false);
    setPin("");
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  // Auto-confirmer quand 6 chiffres saisis
  React.useEffect(() => {
    if (pin.length === 6) handleConfirm();
  }, [pin]);

  const ParentalModal = useCallback(
    () => (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={[gm.overlay]}>
          <TouchableOpacity
            style={gm.backdrop}
            activeOpacity={1}
            onPress={handleCancel}
          />
          <View
            style={[
              gm.card,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            {/* Icon */}
            <View
              style={[
                gm.iconWrap,
                { backgroundColor: t.bg.accent, borderColor: t.border.strong },
              ]}
            >
              <Text style={{ fontSize: 26 }}>👶</Text>
            </View>
            <Text style={[gm.title, { color: t.text.primary }]}>
              Contrôle parental
            </Text>
            <Text style={[gm.sub, { color: t.text.muted }]}>
              Saisissez le PIN parent pour continuer
            </Text>

            <MiniPinPad
              pin={pin}
              onDigit={handleDigit}
              onDelete={handleDelete}
              shakeAnim={shakeAnim}
            />

            <TouchableOpacity
              style={[
                gm.btn,
                {
                  backgroundColor:
                    pin.length >= 4 ? Colors.blue[600] : t.bg.cardAlt,
                },
              ]}
              onPress={handleConfirm}
              disabled={loading || pin.length < 4}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  gm.btnText,
                  { color: pin.length >= 4 ? "#fff" : t.text.muted },
                ]}
              >
                {loading ? "…" : "Confirmer"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              style={gm.cancelBtn}
              activeOpacity={0.7}
            >
              <Text style={[gm.cancelText, { color: t.text.muted }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    ),
    [visible, pin, loading, t],
  );

  return { guard, ParentalModal };
}

const gm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  card: {
    width: "85%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 14,
    zIndex: 1,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  sub: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  btn: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 32,
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  btnText: { fontSize: 15, fontWeight: "800" },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 13, fontWeight: "500" },
});

export default useParentalGuard;
