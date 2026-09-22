/**
 * app/settings/notifications.tsx — Notifications des apps bloquées
 *
 * Couper le réseau d'une application ne l'empêche pas de sonner : une
 * notification push est livrée aux Services Google Play, qui la remettent à
 * l'app par un canal local. Le tunnel VPN n'est jamais sur ce chemin.
 *
 * Android n'offre qu'une seule prise : l'accès aux notifications, que
 * l'utilisateur doit accorder à la main. Cet écran l'explique, l'ouvre, et
 * laisse l'interrupteur à l'utilisateur.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View, type AppStateStatus } from "react-native";

import NotificationGuardService, {
  type NotificationGuardState,
} from "@/services/notification-guard.service";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppBar,
  Button,
  Card,
  Divider,
  Icon,
  Screen,
  ScreenScroll,
  Section,
  Switch,
  Text,
  toast,
  type IconName,
} from "@/ui";

const HOW_IT_WORKS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "cloud-off-outline",
    title: "Pourquoi le blocage réseau ne suffit pas",
    body: "Une notification push ne passe pas par la connexion de l'application : les Services Google Play la reçoivent, puis la transmettent à l'app sur l'appareil. Couper son réseau ne l'arrête donc pas.",
  },
  {
    icon: "bell-cancel-outline",
    title: "Ce que fait le garde",
    body: "Il retire la notification dès qu'elle apparaît, tant que l'app est bloquée et que la protection réseau est active. Coupez la protection, les notifications reviennent.",
  },
  {
    icon: "shield-check-outline",
    title: "Ce qu'il ne touche jamais",
    body: "Les appels entrants, les alarmes, l'interface système et la téléphonie passent toujours — même pour une app bloquée.",
  },
];

export default function NotificationSettingsScreen() {
  const { t } = useTheme();
  const supported = NotificationGuardService.isSupported();

  const [state, setState] = useState<NotificationGuardState>({
    granted: false,
    enabled: false,
    suppressed: 0,
  });
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    setState(await NotificationGuardService.getState());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // L'accès se donne dans les réglages Android : au retour dans l'app, il faut
  // relire l'état, sinon l'écran affiche encore « non accordé ».
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        refresh();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  const toggle = useCallback(
    async (next: boolean) => {
      setState((s) => ({ ...s, enabled: next }));
      const ok = await NotificationGuardService.setEnabled(next);
      if (!ok) {
        toast.error("Réglage impossible sur cet appareil.");
        refresh();
        return;
      }
      if (next && !state.granted) {
        toast.info("Accordez l'accès aux notifications pour que le garde agisse.");
      }
      refresh();
    },
    [refresh, state.granted],
  );

  const openAccess = useCallback(async () => {
    const ok = await NotificationGuardService.openAccessSettings();
    if (!ok) {
      toast.error("Écran introuvable — Réglages › Notifications › Accès aux notifications.");
      return;
    }
    toast.info("Activez NetOff dans la liste, puis revenez.");
  }, []);

  const reset = useCallback(async () => {
    await NotificationGuardService.resetStats();
    refresh();
  }, [refresh]);

  const active = supported && state.granted && state.enabled;

  return (
    <Screen>
      <AppBar title="Notifications bloquées" back />

      <ScreenScroll contentContainerStyle={st.content}>
        {!supported ? (
          <Card style={st.card}>
            <Text variant="headline">Indisponible sur cet appareil</Text>
            <Text variant="footnote" tone="muted">
              Le masquage des notifications repose sur une fonction Android.
            </Text>
          </Card>
        ) : (
          <>
            {/* État */}
            <Card
              style={[
                st.card,
                {
                  backgroundColor: active ? t.intent.allowed.bg : t.bg.card,
                  borderColor: active ? t.intent.allowed.border : t.border.light,
                },
              ]}
            >
              <View style={st.statusRow}>
                <View
                  style={[
                    st.statusIcon,
                    {
                      backgroundColor: active ? t.intent.allowed.bg : t.bg.cardAlt,
                      borderColor: active ? t.intent.allowed.border : t.border.light,
                    },
                  ]}
                >
                  <Icon
                    name={active ? "bell-cancel-outline" : "bell-outline"}
                    size={22}
                    color={active ? t.intent.allowed.accent : t.text.muted}
                  />
                </View>
                <View style={st.flex}>
                  <Text variant="headline">
                    {active ? "Garde actif" : "Garde inactif"}
                  </Text>
                  <Text variant="footnote" tone="muted">
                    {loading
                      ? "…"
                      : active
                        ? "Les notifications des apps bloquées sont retirées."
                        : state.enabled && !state.granted
                          ? "Il manque l'accès aux notifications d'Android."
                          : "Les apps bloquées peuvent encore vous notifier."}
                  </Text>
                </View>
                <Switch
                  value={state.enabled}
                  onValueChange={toggle}
                  accessibilityLabel="Masquer les notifications des apps bloquées"
                />
              </View>

              {state.enabled && !state.granted ? (
                <>
                  <Divider />
                  <Text variant="footnote" tone="secondary">
                    Android demande une autorisation explicite pour lire et retirer
                    les notifications. NetOff ne s'en sert que pour masquer celles
                    des apps que vous avez bloquées : leur contenu n'est ni lu, ni
                    enregistré, ni transmis.
                  </Text>
                  <Button
                    label="Accorder l'accès aux notifications"
                    icon="shield-key-outline"
                    onPress={openAccess}
                    fullWidth
                  />
                </>
              ) : null}
            </Card>

            {state.suppressed > 0 ? (
              <Card style={st.card}>
                <View style={st.statusRow}>
                  <View style={st.flex}>
                    <Text variant="title3" tabular>
                      {state.suppressed}
                    </Text>
                    <Text variant="footnote" tone="muted">
                      notification{state.suppressed > 1 ? "s" : ""} masquée
                      {state.suppressed > 1 ? "s" : ""} depuis la remise à zéro
                    </Text>
                  </View>
                  <Button label="Remettre à zéro" variant="ghost" size="sm" onPress={reset} />
                </View>
              </Card>
            ) : null}

            <Section title="Comment ça marche">
              <Card style={st.list}>
                {HOW_IT_WORKS.map((item, i) => (
                  <View key={item.title}>
                    {i > 0 ? <Divider /> : null}
                    <View style={st.item}>
                      <View
                        style={[
                          st.itemIcon,
                          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
                        ]}
                      >
                        <Icon name={item.icon} size={17} color={t.brand.base} />
                      </View>
                      <View style={st.flex}>
                        <Text variant="bodyStrong">{item.title}</Text>
                        <Text variant="footnote" tone="muted">
                          {item.body}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            </Section>

            {state.granted ? (
              <Button
                label="Gérer l'accès dans Android"
                icon="cog-outline"
                variant="secondary"
                onPress={openAccess}
                fullWidth
              />
            ) : null}
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  card: { gap: Spacing.md },
  list: { gap: Spacing.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  item: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
});
