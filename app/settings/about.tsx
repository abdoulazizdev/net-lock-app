/**
 * app/settings/about.tsx — À propos
 *
 * Ce que fait l'app, ce qu'elle ne fait pas, et sur quoi elle tourne. La
 * section « confidentialité » est ici parce qu'une app qui demande la
 * permission VPN doit dire noir sur blanc ce qu'elle fait du trafic.
 */

import * as Linking from "expo-linking";
import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { SUPPORT, mailtoUrl, whatsappUrl } from "@/config/support";
import { useAppInfo } from "@/hooks/useAppInfo";
import { Radius, Spacing, useTheme } from "@/theme";
import {
  AppBar,
  Badge,
  Card,
  Icon,
  ListGroup,
  ListRow,
  Screen,
  ScreenScroll,
  Section,
  Text,
  type IconName,
} from "@/ui";

const CAPABILITIES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "shield-off-outline",
    title: "Couper le réseau app par app",
    body: "Un VPN local écarte le trafic des applications que vous désignez.",
  },
  {
    icon: "calendar-clock",
    title: "Planifier les règles",
    body: "Des alarmes système appliquent vos créneaux, même app fermée.",
  },
  {
    icon: "account-multiple-outline",
    title: "Profils",
    body: "Des jeux de règles nommés, activables d'un geste.",
  },
  {
    icon: "target",
    title: "Sessions Focus",
    body: "Un blocage à durée fixe, difficile à interrompre sur un coup de tête.",
  },
  {
    icon: "chart-box-outline",
    title: "Statistiques locales",
    body: "Ce qui a été bloqué, quand, et par quelle application.",
  },
];

const PRIVACY: { icon: IconName; text: string }[] = [
  { icon: "wifi-off", text: "Aucun serveur distant : le tunnel ne sort pas de l'appareil." },
  { icon: "database-off-outline", text: "Aucun compte, aucune donnée envoyée à un tiers." },
  { icon: "eye-off-outline", text: "Le contenu de vos connexions n'est ni lu ni enregistré." },
  { icon: "cellphone-lock", text: "Règles, profils et statistiques restent en local." },
];


export default function AboutScreen() {
  const { t } = useTheme();
  const appInfo = useAppInfo();

  return (
    <Screen>
      <AppBar title="À propos" back />

      <ScreenScroll contentContainerStyle={st.content}>
        <View style={st.identity}>
          <View
            style={[
              st.logo,
              { backgroundColor: t.brand.soft, borderColor: t.brand.softBorder },
            ]}
          >
            <Image
              source={require("@/assets/images/netoff-logo.png")}
              style={st.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text variant="title1">NetOff</Text>
          <Text variant="callout" tone="muted" center>
            Contrôle du réseau, application par application.
          </Text>
          <Badge label={appInfo.loading ? "…" : appInfo.fullVersion} tone="brand" size="md" />
        </View>

        <Section title="Ce que fait NetOff">
          <Card style={st.list}>
            {CAPABILITIES.map((item) => (
              <View key={item.title} style={st.item}>
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
            ))}
          </Card>
        </Section>

        <Section title="Confidentialité">
          <Card
            style={[
              st.list,
              { backgroundColor: t.intent.allowed.bg, borderColor: t.intent.allowed.border },
            ]}
          >
            {PRIVACY.map((item) => (
              <View key={item.text} style={st.privacyItem}>
                <Icon name={item.icon} size={16} color={t.intent.allowed.accent} />
                <Text variant="callout" tone="secondary" style={st.flex}>
                  {item.text}
                </Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Limites connues">
          <Card style={st.list}>
            <LimitRow
              icon="apple-ios"
              text="iOS n'autorise pas une app tierce à filtrer le trafic des autres apps : NetOff est une application Android."
            />
            <LimitRow
              icon="battery-alert-variant-outline"
              text="Certaines surcouches constructeur suspendent les services d'arrière-plan. Voir Réglages › Compatibilité."
            />
            <LimitRow
              icon="shield-half-full"
              text="Le blocage porte sur l'accès réseau, pas sur le lancement des applications."
            />
          </Card>
        </Section>

        <Section title="Appareil">
          <ListGroup inset={Spacing.lg}>
            <ListRow title="Version" value={appInfo.fullVersion} />
            <ListRow title="Identifiant" value={appInfo.bundleId || "—"} />
            <ListRow title="Système" value={`${appInfo.osName} ${appInfo.osVersion}`} />
            <ListRow title="Modèle" value={appInfo.deviceModel ?? "—"} />
          </ListGroup>
        </Section>

        <Section title="Liens">
          <ListGroup>
            <ListRow
              icon="whatsapp"
              title="WhatsApp"
              subtitle={SUPPORT.whatsappDisplay}
              trailing="chevron"
              onPress={() => Linking.openURL(whatsappUrl("Bonjour, ")).catch(() => {})}
            />
            <ListRow
              icon="email-outline"
              title="Écrire au développeur"
              subtitle={SUPPORT.email}
              trailing="chevron"
              onPress={() => Linking.openURL(mailtoUrl("[NetOff]")).catch(() => {})}
            />
          </ListGroup>
        </Section>

        <Text variant="footnote" tone="faint" center>
          Conçu et développé par Abdoulaziz.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

function LimitRow({ icon, text }: { icon: IconName; text: string }) {
  const { t } = useTheme();
  return (
    <View style={st.privacyItem}>
      <Icon name={icon} size={16} color={t.text.muted} />
      <Text variant="callout" tone="muted" style={st.flex}>
        {text}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.xl, paddingTop: Spacing.sm },
  identity: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.lg },
  logo: {
    width: 78,
    height: 78,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  logoImage: { width: 46, height: 46 },
  list: { gap: Spacing.lg },
  item: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyItem: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
  flex: { flex: 1 },
});
