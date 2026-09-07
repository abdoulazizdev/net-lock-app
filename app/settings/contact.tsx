/**
 * app/settings/contact.tsx — Nous écrire
 *
 * Prépare un message pré-rempli avec le contexte technique (version, modèle,
 * version d'Android) : sans ces informations, la moitié des signalements de
 * bug ne mènent à rien.
 *
 * Le formulaire dépend d'une application e-mail configurée — ce qui n'est pas
 * garanti. WhatsApp et les coordonnées en clair sont donc proposés d'emblée :
 * il doit toujours rester une façon de nous joindre.
 */

import * as Linking from "expo-linking";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SUPPORT, mailtoUrl, whatsappUrl } from "@/config/support";
import { useAppInfo } from "@/hooks/useAppInfo";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppBar,
  Button,
  Card,
  Icon,
  Screen,
  ScreenScroll,
  Section,
  Switch,
  Text,
  TextField,
  Touchable,
  toast,
  type IconName,
} from "@/ui";

const MESSAGE_MIN = 10;

const SUBJECTS: { key: string; label: string; icon: IconName; hint: string }[] = [
  {
    key: "bug",
    label: "Un problème",
    icon: "bug-outline",
    hint: "Le blocage ne fonctionne pas, l'app se ferme…",
  },
  {
    key: "idea",
    label: "Une idée",
    icon: "lightbulb-on-outline",
    hint: "Une fonctionnalité qui vous manque",
  },
  {
    key: "billing",
    label: "Abonnement",
    icon: "credit-card-outline",
    hint: "Paiement, restauration, code promotionnel",
  },
  {
    key: "other",
    label: "Autre",
    icon: "message-outline",
    hint: "Toute autre question",
  },
];

export default function ContactScreen() {
  const { t } = useTheme();
  const appInfo = useAppInfo();

  const [subject, setSubject] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [includeDevice, setIncludeDevice] = useState(true);

  const deviceLine = useMemo(
    () =>
      `NetOff ${appInfo.fullVersion} · ${appInfo.deviceModel ?? "appareil inconnu"} · ${appInfo.osName} ${appInfo.osVersion}`,
    [appInfo],
  );

  const canSend = subject !== null && message.trim().length >= MESSAGE_MIN;

  const send = useCallback(async () => {
    const selected = SUBJECTS.find((s) => s.key === subject);
    const body = [
      message.trim(),
      "",
      "—",
      includeDevice ? deviceLine : "",
    ]
      .filter(Boolean)
      .join("\n");

    const url = mailtoUrl(`[NetOff] ${selected?.label ?? "Message"}`, body);

    try {
      await Linking.openURL(url);
    } catch {
      // Pas d'app e-mail : on bascule sur WhatsApp avec le même message plutôt
      // que de laisser l'utilisateur devant un bouton qui ne fait rien.
      try {
        await Linking.openURL(whatsappUrl(body));
      } catch {
        toast.error(`Écrivez-nous à ${SUPPORT.email}`);
      }
    }
  }, [subject, message, includeDevice, deviceLine]);

  const openWhatsApp = useCallback(async () => {
    const body = [message.trim(), includeDevice ? deviceLine : ""]
      .filter(Boolean)
      .join("\n\n");
    try {
      await Linking.openURL(whatsappUrl(body || "Bonjour, "));
    } catch {
      toast.error(`WhatsApp indisponible — ${SUPPORT.whatsappDisplay}`);
    }
  }, [message, includeDevice, deviceLine]);

  return (
    <Screen>
      <AppBar title="Nous écrire" back />

      <ScreenScroll contentContainerStyle={st.content}>
        <Section
          title="Contact direct"
          footnote="La réponse arrive plus vite par WhatsApp."
        >
          <View style={st.directRow}>
            <Button
              label="WhatsApp"
              icon="whatsapp"
              variant="secondary"
              onPress={openWhatsApp}
              style={st.flex}
            />
            <Button
              label="E-mail"
              icon="email-outline"
              variant="secondary"
              onPress={() =>
                Linking.openURL(mailtoUrl("[NetOff]")).catch(() =>
                  toast.error(`Écrivez-nous à ${SUPPORT.email}`),
                )
              }
              style={st.flex}
            />
          </View>
          <Text variant="footnote" tone="faint" center selectable>
            {SUPPORT.whatsappDisplay} · {SUPPORT.email}
          </Text>
        </Section>

        <Section title="Sujet">
          <View style={st.grid}>
            {SUBJECTS.map((option) => {
              const active = subject === option.key;
              return (
                <Touchable
                  key={option.key}
                  onPress={() => setSubject(option.key)}
                  feedback="strong"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    st.subject,
                    {
                      backgroundColor: active ? t.brand.soft : t.bg.card,
                      borderColor: active ? t.brand.base : t.border.light,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <Icon
                    name={option.icon}
                    size={20}
                    color={active ? t.brand.base : t.text.muted}
                  />
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {option.label}
                  </Text>
                  <Text variant="footnote" tone="muted" numberOfLines={2}>
                    {option.hint}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </Section>

        <Section title="Message">
          <TextField
            value={message}
            onChangeText={setMessage}
            placeholder="Décrivez ce qui se passe, et ce que vous attendiez."
            multiline
            maxLength={1200}
            counter
            hint={
              message.trim().length > 0 && message.trim().length < MESSAGE_MIN
                ? `Encore ${MESSAGE_MIN - message.trim().length} caractères`
                : undefined
            }
          />
        </Section>

        <Card style={st.deviceCard}>
          <View style={st.deviceRow}>
            <View style={st.flex}>
              <Text variant="headline">Joindre les informations techniques</Text>
              <Text variant="footnote" tone="muted">
                Version de l'app, modèle et version d'Android.
              </Text>
            </View>
            <Switch
              value={includeDevice}
              onValueChange={setIncludeDevice}
              accessibilityLabel="Joindre les informations techniques"
            />
          </View>
          {includeDevice ? (
            <View
              style={[
                st.devicePreview,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <Text variant="mono" tone="faint">
                {deviceLine}
              </Text>
            </View>
          ) : null}
        </Card>

        <Button
          label="Ouvrir mon application e-mail"
          icon="send-outline"
          onPress={send}
          disabled={!canSend}
          size="lg"
          fullWidth
        />

        <Text variant="footnote" tone="faint" center>
          Le message s'ouvre dans votre application de messagerie — rien n'est
          envoyé depuis NetOff.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  directRow: { flexDirection: "row", gap: Spacing.sm },
  subject: {
    flexGrow: 1,
    flexBasis: "46%",
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  deviceCard: { gap: Spacing.md },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  devicePreview: {
    padding: Spacing.sm,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
