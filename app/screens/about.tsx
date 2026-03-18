import { useAppInfo } from "@/hooks/useAppInfo";
import { Colors, Semantic, useTheme } from "@/theme";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONTACT_EMAIL = "abdoulaziz.dev@gmail.com";

function useStagger(count: number, delay = 55) {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;
  useEffect(() => {
    Animated.stagger(
      delay,
      anims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, []);
  return anims;
}

function Section({
  anim,
  children,
}: {
  anim: Animated.Value;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { t } = useTheme();
  return (
    <View style={row.container}>
      <Text style={[row.label, { color: t.text.secondary }]}>{label}</Text>
      <Text style={[row.value, { color: t.text.primary }]}>{value}</Text>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  desc,
  accent,
}: {
  icon: string;
  title: string;
  desc: string;
  accent?: string;
}) {
  const { t } = useTheme();
  return (
    <View style={feat.container}>
      <View
        style={[
          feat.iconWrap,
          { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
          accent
            ? { backgroundColor: accent + "18", borderColor: accent + "40" }
            : {},
        ]}
      >
        <Text
          style={[
            feat.icon,
            { color: t.text.muted },
            accent ? { color: accent } : {},
          ]}
        >
          {icon}
        </Text>
      </View>
      <View style={feat.text}>
        <Text style={[feat.title, { color: t.text.primary }]}>{title}</Text>
        <Text style={[feat.desc, { color: t.text.secondary }]}>{desc}</Text>
      </View>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { t } = useTheme();
  return (
    <TouchableOpacity
      style={lnk.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[lnk.icon, { color: t.text.muted }]}>{icon}</Text>
      <Text
        style={[lnk.label, { color: danger ? t.danger.text : t.text.primary }]}
      >
        {label}
      </Text>
      <Text style={[lnk.arrow, { color: t.border.normal }]}>›</Text>
    </TouchableOpacity>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  const { t } = useTheme();
  return (
    <View style={stat.container}>
      <Text style={[stat.value, { color: t.text.link }]}>{value}</Text>
      <Text style={[stat.label, { color: t.text.muted }]}>{label}</Text>
    </View>
  );
}

function FeatureGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(true);
  return (
    <View
      style={[
        s.card,
        { backgroundColor: t.bg.card, borderColor: t.border.light },
      ]}
    >
      <TouchableOpacity
        style={[grp.header, { borderBottomColor: t.border.light }]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={[grp.title, { color: t.text.secondary }]}>{title}</Text>
        <Text style={[grp.chevron, { color: t.text.muted }]}>
          {open ? "⌃" : "⌄"}
        </Text>
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

function TechBadge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={[
        tech.badge,
        { backgroundColor: color + "18", borderColor: color + "40" },
      ]}
    >
      <Text style={[tech.label, { color }]}>{label}</Text>
    </View>
  );
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const appInfo = useAppInfo();
  const anims = useStagger(11, 50);

  return (
    <View style={[s.container, { backgroundColor: t.bg.page }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Semantic.bg.header}
      />
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: Semantic.bg.header,
            borderBottomColor: "rgba(255,255,255,.1)",
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>À propos</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Hero */}
        <Section anim={anims[0]}>
          <View style={s.hero}>
            <View style={s.logoWrap}>
              <View
                style={[
                  s.logoOuter,
                  {
                    backgroundColor: Colors.purple[50],
                    borderColor: Colors.purple[100],
                  },
                ]}
              >
                <View style={s.logoInner}>
                  <Text style={s.logoIcon}>◉</Text>
                </View>
              </View>
              <View style={[s.ring, s.ring1]} />
              <View style={[s.ring, s.ring2]} />
            </View>
            <Text style={[s.appName, { color: t.text.primary }]}>
              {appInfo.appName}
            </Text>
            <Text style={[s.appTagline, { color: t.text.muted }]}>
              Contrôle réseau intelligent
            </Text>
            <View style={s.versionRow}>
              <View
                style={[
                  s.versionBadge,
                  {
                    backgroundColor: Colors.purple[50],
                    borderColor: Colors.purple[100],
                  },
                ]}
              >
                <Text style={[s.versionText, { color: Colors.purple[600] }]}>
                  {appInfo.loading ? "…" : `v${appInfo.version}`}
                </Text>
              </View>
              <View
                style={[
                  s.buildBadge,
                  {
                    backgroundColor: t.bg.cardAlt,
                    borderColor: t.border.light,
                  },
                ]}
              >
                <Text style={[s.buildText, { color: t.text.muted }]}>
                  {appInfo.loading ? "…" : `build ${appInfo.buildNumber}`}
                </Text>
              </View>
            </View>
            <View
              style={[
                s.statsRow,
                { backgroundColor: t.bg.cardAlt, borderColor: t.border.light },
              ]}
            >
              <StatPill value="VPN" label="local" />
              <View
                style={[s.statsDivider, { backgroundColor: t.border.light }]}
              />
              <StatPill value="100%" label="privé" />
              <View
                style={[s.statsDivider, { backgroundColor: t.border.light }]}
              />
              <StatPill value="∞" label="profils" />
              <View
                style={[s.statsDivider, { backgroundColor: t.border.light }]}
              />
              <StatPill value="0" label="collecte" />
            </View>
          </View>
        </Section>

        {/* Mission */}
        <Section anim={anims[1]}>
          <View
            style={[
              s.missionCard,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <View
              style={[s.missionAccent, { backgroundColor: Colors.purple[400] }]}
            />
            <Text style={[s.missionTitle, { color: t.text.primary }]}>
              Notre mission
            </Text>
            <Text style={[s.missionText, { color: t.text.secondary }]}>
              NetOff vous donne un contrôle total sur les connexions réseau de
              vos applications. Via un VPN local Android natif, chaque tentative
              de connexion est analysée et filtrée selon vos profils — sans
              qu'aucune donnée ne quitte votre appareil.
            </Text>
          </View>
        </Section>

        {/* Fonctionnalités */}
        <Section anim={anims[2]}>
          <Text style={[s.sectionLabel, { color: t.text.muted }]}>
            FONCTIONNALITÉS
          </Text>
          <FeatureGroup title="Contrôle & VPN">
            <FeatureItem
              icon="◈"
              title="VPN local natif"
              desc="Filtrage via VpnService Android. Aucune donnée ne quitte l'appareil. Règles globales ou par profil, synchronisées instantanément."
              accent={Colors.purple[400]}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <FeatureItem
              icon="◎"
              title="Blocage par application"
              desc="Liste complète des apps installées (utilisateur + système). Blocage ou autorisation d'un tap, avec fiche détaillée par app."
              accent={Colors.purple[400]}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <FeatureItem
              icon="⊡"
              title="Widget écran d'accueil"
              desc="Statut VPN en temps réel, compteur d'apps bloquées et toggle — sans ouvrir l'app. Mise à jour instantanée."
              accent={Colors.purple[400]}
            />
          </FeatureGroup>
        </Section>

        <Section anim={anims[3]}>
          <FeatureGroup title="Profils & Planifications">
            <FeatureItem
              icon="◷"
              title="Profils personnalisés"
              desc="Groupes de règles nommés : Travail, Soirée, Enfants… Activation manuelle ou automatique selon des créneaux hebdomadaires."
              accent={Colors.green[400]}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <FeatureItem
              icon="⊙"
              title="Planifications hebdomadaires"
              desc="Alarmes via AlarmManager — activation/désactivation automatique à des jours et heures précis. Se reprogramment 7 jours après chaque déclenchement et survivent aux reboots."
              accent={Colors.green[400]}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <FeatureItem
              icon="◉"
              title="Persistance au redémarrage"
              desc="VPN et sessions relancés automatiquement après un reboot via BootReceiver. État sauvegardé en SharedPreferences natif."
              accent={Colors.green[400]}
            />
          </FeatureGroup>
        </Section>

        <Section anim={anims[4]}>
          <FeatureGroup title="Focus & Sécurité">
            <FeatureItem
              icon="◔"
              title="Mode Focus"
              desc="Session de blocage minutée (25 min à 4h). Impossible d'annuler sans maintenir 5 secondes. Notification persistante avec compte à rebours. Fin automatique même app fermée."
              accent={Colors.red[400]}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <FeatureItem
              icon="◈"
              title="Authentification"
              desc="PIN applicatif (4–6 chiffres) et/ou biométrie/PIN téléphone. Les deux méthodes sont indépendantes et cumulables. Configuration dans Paramètres."
              accent={Colors.red[400]}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <FeatureItem
              icon="◎"
              title="Import / Export"
              desc="Export JSON de toutes les règles et profils via le partage Android. Import avec validation et remplacement des données existantes."
              accent={Colors.red[400]}
            />
          </FeatureGroup>
        </Section>

        <Section anim={anims[5]}>
          <FeatureGroup title="Statistiques & Historique">
            <FeatureItem
              icon="◉"
              title="Historique des connexions"
              desc="Log de toutes les tentatives (bloquées/autorisées) avec horodatage. Limité à 500 entrées, effaçable."
              accent={Colors.amber[400]}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <FeatureItem
              icon="◷"
              title="3 vues dans Stats"
              desc="Vue d'ensemble avec top apps — historique chronologique groupé par date — détail par application avec ratio et dernière activité."
              accent={Colors.amber[400]}
            />
          </FeatureGroup>
        </Section>

        {/* App info */}
        <Section anim={anims[6]}>
          <Text style={[s.sectionLabel, { color: t.text.muted }]}>
            INFORMATIONS
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <InfoRow
              label="Version"
              value={appInfo.loading ? "…" : appInfo.fullVersion}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow
              label="Bundle ID"
              value={appInfo.loading ? "…" : appInfo.bundleId || "—"}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow
              label="Plateforme"
              value={
                appInfo.loading ? "…" : `${appInfo.osName} ${appInfo.osVersion}`
              }
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow
              label="Appareil"
              value={appInfo.loading ? "…" : (appInfo.deviceModel ?? "—")}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow
              label="Environnement"
              value={
                appInfo.loading
                  ? "…"
                  : appInfo.isDevice
                    ? "Appareil réel"
                    : "Émulateur"
              }
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow label="Données collectées" value="Aucune" />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow label="Connexion requise" value="Non" />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow label="Stockage des règles" value="Local (SharedPrefs)" />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <InfoRow label="Entrées historique max" value="500" />
          </View>
        </Section>

        {/* Privacy */}
        <Section anim={anims[7]}>
          <View
            style={[
              s.privacyCard,
              { backgroundColor: t.allowed.bg, borderColor: t.allowed.border },
            ]}
          >
            <View
              style={[
                s.privacyIconWrap,
                {
                  backgroundColor: t.allowed.bg,
                  borderColor: t.allowed.border,
                },
              ]}
            >
              <Text style={[s.privacyIcon, { color: t.allowed.accent }]}>
                ◈
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.privacyTitle, { color: t.allowed.text }]}>
                100% privé, 100% local
              </Text>
              <Text style={[s.privacyText, { color: t.allowed.text }]}>
                NetOff ne collecte aucune donnée personnelle. Le VPN fonctionne
                entièrement sur votre appareil via VpnService Android. Vos
                règles, profils, statistiques et historique restent sur votre
                téléphone.
              </Text>
            </View>
          </View>
        </Section>

        {/* Technologie */}
        <Section anim={anims[8]}>
          <Text style={[s.sectionLabel, { color: t.text.muted }]}>
            TECHNOLOGIE
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <View style={s.techRow}>
              <TechBadge label="VpnService" color={Colors.purple[400]} />
              <TechBadge label="AlarmManager" color={Colors.green[400]} />
              <TechBadge label="BootReceiver" color={Colors.green[400]} />
              <TechBadge label="SharedPreferences" color={Colors.amber[400]} />
              <TechBadge label="LocalAuthentication" color={Colors.red[400]} />
              <TechBadge label="WidgetSyncModule" color={Colors.purple[400]} />
            </View>
          </View>
        </Section>

        {/* Liens */}
        <Section anim={anims[9]}>
          <Text style={[s.sectionLabel, { color: t.text.muted }]}>LIENS</Text>
          <View
            style={[
              s.card,
              { backgroundColor: t.bg.card, borderColor: t.border.light },
            ]}
          >
            <LinkRow
              icon="◎"
              label="Politique de confidentialité"
              onPress={() => {}}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <LinkRow
              icon="◈"
              label="Conditions d'utilisation"
              onPress={() => {}}
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <LinkRow
              icon="◷"
              label="Signaler un problème"
              onPress={() =>
                Linking.openURL(
                  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[NetOff] Signaler un problème")}`,
                )
              }
            />
            <View style={[s.divider, { backgroundColor: t.border.light }]} />
            <LinkRow icon="⊙" label="Changelog" onPress={() => {}} />
          </View>
        </Section>

        {/* Footer */}
        <Section anim={anims[10]}>
          <View style={s.footer}>
            <Text style={[s.footerLogo, { color: Colors.purple[400] }]}>
              ◉ NetOff
            </Text>
            <Text style={[s.footerCopy, { color: t.text.muted }]}>
              © {new Date().getFullYear()} — Fait avec soin
            </Text>
            <Text style={[s.footerSub, { color: t.border.normal }]}>
              Votre réseau, vos règles.
            </Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { marginBottom: 12 },
  backText: { color: Colors.gray[0], fontSize: 14, fontWeight: "600" },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -1.5,
  },
  scroll: { paddingHorizontal: 22, paddingTop: 28 },
  hero: { alignItems: "center", marginBottom: 32 },
  logoWrap: {
    width: 96,
    height: 96,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoOuter: {
    width: 80,
    height: 80,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.purple[400],
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.purple[400],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logoIcon: { fontSize: 26, color: Colors.gray[0] },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.purple[100],
  },
  ring1: { width: 96, height: 96 },
  ring2: { width: 116, height: 116, borderColor: Colors.purple[50] },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -2,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  versionRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  versionBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  versionText: { fontSize: 12, fontWeight: "700" },
  buildBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  buildText: { fontSize: 12, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  statsDivider: { width: 1, height: 28, marginHorizontal: 8 },
  missionCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    marginBottom: 28,
    overflow: "hidden",
  },
  missionAccent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  missionTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  missionText: { fontSize: 14, lineHeight: 22 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  divider: { height: 1, marginHorizontal: 16 },
  techRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 28,
  },
  privacyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  privacyIcon: { fontSize: 18 },
  privacyTitle: { fontSize: 14, fontWeight: "800", marginBottom: 6 },
  privacyText: { fontSize: 13, lineHeight: 20 },
  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
    marginTop: 12,
  },
  footerLogo: { fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
  footerCopy: { fontSize: 12, fontWeight: "500" },
  footerSub: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
});
const feat = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  icon: { fontSize: 16 },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 12, lineHeight: 18 },
});
const row = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: { fontSize: 14, fontWeight: "500" },
  value: { fontSize: 14, fontWeight: "600" },
});
const lnk = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: { fontSize: 14 },
  label: { flex: 1, fontSize: 14, fontWeight: "500" },
  arrow: { fontSize: 20, fontWeight: "300" },
});
const stat = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  value: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginTop: 2 },
});
const grp = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  chevron: { fontSize: 14 },
});
const tech = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});
