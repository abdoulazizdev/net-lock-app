/**
 * features/security/useParentalGuard.tsx — Garde-fou du contrôle parental
 *
 * Protège une action derrière le PIN parent. Le hook renvoie une fonction
 * `guard` à await avant l'action, et le composant modal à monter dans l'écran :
 *
 *   const { guard, ParentalGate } = useParentalGuard();
 *
 *   const toggle = async () => {
 *     if (!(await guard("toggle_vpn"))) return;   // PIN refusé
 *     await VpnService.startVpn();
 *   };
 *
 *   return <Screen>… <ParentalGate /></Screen>;
 *
 * Quand le contrôle parental est désactivé, `guard` renvoie `true`
 * immédiatement sans rien afficher.
 */

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import ParentalControlService, {
  type ProtectedAction,
} from "@/services/parental-control.service";
import { Spacing, useTheme } from "@/theme";
import { Button, Dialog, Icon, Text } from "@/ui";
import { PIN_LENGTH, PinDots, PinPad } from "./PinPad";

/** Libellé affiché pour chaque action protégée. */
const ACTION_LABELS: Record<ProtectedAction, string> = {
  toggle_vpn: "Modifier la protection réseau",
  toggle_block_app: "Modifier le blocage d'une app",
  open_settings: "Ouvrir les paramètres",
  change_rules: "Modifier les règles",
  disable_parental: "Désactiver le contrôle parental",
};

const MAX_ATTEMPTS = 5;

export function useParentalGuard() {
  const { t } = useTheme();
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<ProtectedAction | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setVisible(false);
    setPin("");
    setError(false);
    setAttempts(0);
    setAction(null);
  }, []);

  /** À await avant toute action protégée. `true` = action autorisée. */
  const guard = useCallback(
    async (next: ProtectedAction): Promise<boolean> => {
      if (await ParentalControlService.isActionAllowed(next)) return true;
      setAction(next);
      setPin("");
      setError(false);
      setAttempts(0);
      setVisible(true);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    [],
  );

  const submit = useCallback(
    async (candidate: string) => {
      if (await ParentalControlService.verifyParentalPin(candidate)) {
        settle(true);
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setError(true);
      setPin("");
      if (next >= MAX_ATTEMPTS) settle(false);
    },
    [attempts, settle],
  );

  const remaining = MAX_ATTEMPTS - attempts;

  const ParentalGate = useCallback(
    () => (
      <Dialog
        visible={visible}
        onClose={() => settle(false)}
        title="Code parent requis"
        message={
          action
            ? `${ACTION_LABELS[action]} est protégé par le contrôle parental.`
            : undefined
        }
        dismissible
        actions={
          <Button label="Annuler" variant="ghost" onPress={() => settle(false)} />
        }
      >
        <View style={st.body}>
          <View
            style={[
              st.iconBox,
              {
                backgroundColor: t.intent.focus.bg,
                borderColor: t.intent.focus.border,
              },
            ]}
          >
            <Icon name="shield-lock-outline" size={24} color={t.intent.focus.accent} />
          </View>

          <PinDots filled={pin.length} error={error} />

          {error ? (
            <Text variant="footnote" tone="danger" center>
              {remaining > 1
                ? `Code incorrect — ${remaining} essais restants`
                : "Dernier essai avant annulation"}
            </Text>
          ) : (
            <Text variant="footnote" tone="faint" center>
              Saisissez le code à {PIN_LENGTH} chiffres
            </Text>
          )}

          <PinPad
            value={pin}
            onChange={(next) => {
              setError(false);
              setPin(next);
            }}
            onComplete={submit}
          />
        </View>
      </Dialog>
    ),
    [visible, action, pin, error, remaining, submit, settle, t],
  );

  return { guard, ParentalGate };
}

const st = StyleSheet.create({
  body: { alignItems: "center", gap: Spacing.lg, paddingTop: Spacing.xs },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
