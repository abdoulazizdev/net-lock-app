import { useAppInfo } from "@/hooks/useAppInfo";
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

// ─── Staggered fade-in hook ───────────────────────────────────────────────────
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

// ─── Section wrapper ──────────────────────────────────────────────────────────
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

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={row.container}>
      <Text style={row.label}>{label}</Text>
      <Text style={row.value}>{value}</Text>
    </View>
  );
}

// ─── Feature item ─────────────────────────────────────────────────────────────
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
  return (
    <View style={feat.container}>
      <View
        style={[
          feat.iconWrap,
          accent
            ? { backgroundColor: accent + "18", borderColor: accent + "40" }
            : {},
        ]}
      >
        <Text style={[feat.icon, accent ? { color: accent } : {}]}>{icon}</Text>
      </View>
      <View style={feat.text}>
        <Text style={feat.title}>{title}</Text>
        <Text style={feat.desc}>{desc}</Text>
      </View>
    </View>
  );
}

// ─── Link row ─────────────────────────────────────────────────────────────────
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
  return (
    <TouchableOpacity
      style={lnk.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={lnk.icon}>{icon}</Text>
      <Text style={[lnk.label, danger && lnk.labelDanger]}>{label}</Text>
      <Text style={lnk.arrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <View style={stat.container}>
      <Text style={stat.value}>{value}</Text>
      <Text style={stat.label}>{label}</Text>
    </View>
  );
}

// ─── Feature section with collapsible ────────────────────────────────────────
function FeatureGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={grp.header}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={grp.title}>{title}</Text>
        <Text style={grp.chevron}>{open ? "⌃" : "⌄"}</Text>
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const appInfo = useAppInfo();
  const anims = useStagger(11, 50);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>À propos</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <Section anim={anims[0]}>
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <View style={styles.logoOuter}>
                <View style={styles.logoInner}>
                  <Text style={styles.logoIcon}>◉</Text>
                </View>
              </View>
              <View style={[styles.ring, styles.ring1]} />
              <View style={[styles.ring, styles.ring2]} />
            </View>

            <Text style={styles.appName}>{appInfo.appName}</Text>
            <Text style={styles.appTagline}>Contrôle réseau intelligent</Text>

            <View style={styles.versionRow}>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>
                  {appInfo.loading ? "…" : `v${appInfo.version}`}
                </Text>
              </View>
              <View style={styles.buildBadge}>
                <Text style={styles.buildText}>
                  {appInfo.loading ? "…" : `build ${appInfo.buildNumber}`}
                </Text>
              </View>
            </View>

            {/* Quick stats */}
            <View style={styles.statsRow}>
              <StatPill value="VPN" label="local" />
              <View style={styles.statsDivider} />
              <StatPill value="100%" label="privé" />
              <View style={styles.statsDivider} />
              <StatPill value="∞" label="profils" />
              <View style={styles.statsDivider} />
              <StatPill value="0" label="collecte" />
            </View>
          </View>
        </Section>

        {/* ── Mission ───────────────────────────────────────────────────── */}
        <Section anim={anims[1]}>
          <View style={styles.missionCard}>
            <View style={styles.missionAccent} />
            <Text style={styles.missionTitle}>Notre mission</Text>
            <Text style={styles.missionText}>
              NetOff vous donne un contrôle total sur les connexions réseau de
              vos applications. Via un VPN local Android natif, chaque tentative
              de connexion est analysée et filtrée selon vos profils — sans
              qu'aucune donnée ne quitte votre appareil.
            </Text>
          </View>
        </Section>

        {/* ── Fonctionnalités principales ───────────────────────────────── */}
        <Section anim={anims[2]}>
          <Text style={styles.sectionLabel}>FONCTIONNALITÉS</Text>
          <FeatureGroup title="Contrôle & VPN">
            <FeatureItem
              icon="◈"
              title="VPN local natif"
              desc="Filtrage via VpnService Android. Aucune donnée ne quitte l'appareil. Règles globales ou par profil, synchronisées instantanément."
              accent="#7B6EF6"
            />
            <View style={styles.divider} />
            <FeatureItem
              icon="◎"
              title="Blocage par application"
              desc="Liste complète des apps installées (utilisateur + système). Blocage ou autorisation d'un tap, avec fiche détaillée par app."
              accent="#7B6EF6"
            />
            <View style={styles.divider} />
            <FeatureItem
              icon="⊡"
              title="Widget écran d'accueil"
              desc="Statut VPN en temps réel, compteur d'apps bloquées et toggle — sans ouvrir l'app. Mise à jour instantanée."
              accent="#7B6EF6"
            />
          </FeatureGroup>
        </Section>

        <Section anim={anims[3]}>
          <FeatureGroup title="Profils & Planifications">
            <FeatureItem
              icon="◷"
              title="Profils personnalisés"
              desc="Groupes de règles nommés : Travail, Soirée, Enfants… Activation manuelle ou automatique selon des créneaux hebdomadaires."
              accent="#3DDB8A"
            />
            <View style={styles.divider} />
            <FeatureItem
              icon="⊙"
              title="Planifications hebdomadaires"
              desc="Alarmes via AlarmManager — activation/désactivation automatique à des jours et heures précis. Se reprogramment 7 jours après chaque déclenchement et survivent aux reboots."
              accent="#3DDB8A"
            />
            <View style={styles.divider} />
            <FeatureItem
              icon="◉"
              title="Persistance au redémarrage"
              desc="VPN et sessions relancés automatiquement après un reboot via BootReceiver. État sauvegardé en SharedPreferences natif."
              accent="#3DDB8A"
            />
          </FeatureGroup>
        </Section>

        <Section anim={anims[4]}>
          <FeatureGroup title="Focus & Sécurité">
            <FeatureItem
              icon="◔"
              title="Mode Focus"
              desc="Session de blocage minutée (25 min à 4h). Impossible d'annuler sans maintenir 5 secondes. Notification persistante avec compte à rebours. Fin automatique même app fermée."
              accent="#FF6B6B"
            />
            <View style={styles.divider} />
            <FeatureItem
              icon="◈"
              title="Authentification"
              desc="PIN applicatif (4–6 chiffres) et/ou biométrie/PIN téléphone. Les deux méthodes sont indépendantes et cumulables. Configuration dans Paramètres."
              accent="#FF6B6B"
            />
            <View style={styles.divider} />
            <FeatureItem
              icon="◎"
              title="Import / Export"
              desc="Export JSON de toutes les règles et profils via le partage Android. Import avec validation et remplacement des données existantes."
              accent="#FF6B6B"
            />
          </FeatureGroup>
        </Section>

        <Section anim={anims[5]}>
          <FeatureGroup title="Statistiques & Historique">
            <FeatureItem
              icon="◉"
              title="Historique des connexions"
              desc="Log de toutes les tentatives (bloquées/autorisées) avec horodatage. Limité à 500 entrées, effaçable."
              accent="#F0A500"
            />
            <View style={styles.divider} />
            <FeatureItem
              icon="◷"
              title="3 vues dans Stats"
              desc="Vue d'ensemble avec top apps — historique chronologique groupé par date — détail par application avec ratio et dernière activité."
              accent="#F0A500"
            />
          </FeatureGroup>
        </Section>

        {/* ── App info ──────────────────────────────────────────────────── */}
        <Section anim={anims[6]}>
          <Text style={styles.sectionLabel}>INFORMATIONS</Text>
          <View style={styles.card}>
            <InfoRow
              label="Version"
              value={appInfo.loading ? "…" : appInfo.fullVersion}
            />
            <View style={styles.divider} />
            <InfoRow
              label="Bundle ID"
              value={appInfo.loading ? "…" : appInfo.bundleId || "—"}
            />
            <View style={styles.divider} />
            <InfoRow
              label="Plateforme"
              value={
                appInfo.loading ? "…" : `${appInfo.osName} ${appInfo.osVersion}`
              }
            />
            <View style={styles.divider} />
            <InfoRow
              label="Appareil"
              value={appInfo.loading ? "…" : (appInfo.deviceModel ?? "—")}
            />
            <View style={styles.divider} />
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
            <View style={styles.divider} />
            <InfoRow label="Données collectées" value="Aucune" />
            <View style={styles.divider} />
            <InfoRow label="Connexion requise" value="Non" />
            <View style={styles.divider} />
            <InfoRow label="Stockage des règles" value="Local (SharedPrefs)" />
            <View style={styles.divider} />
            <InfoRow label="Entrées historique max" value="500" />
          </View>
        </Section>

        {/* ── Privacy ───────────────────────────────────────────────────── */}
        <Section anim={anims[7]}>
          <View style={styles.privacyCard}>
            <View style={styles.privacyIconWrap}>
              <Text style={styles.privacyIcon}>◈</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>100% privé, 100% local</Text>
              <Text style={styles.privacyText}>
                NetOff ne collecte aucune donnée personnelle. Le VPN fonctionne
                entièrement sur votre appareil via VpnService Android. Vos
                règles, profils, statistiques et historique restent sur votre
                téléphone. Aucune requête vers un serveur externe n'est
                effectuée.
              </Text>
            </View>
          </View>
        </Section>

        {/* ── Technologie ───────────────────────────────────────────────── */}
        <Section anim={anims[8]}>
          <Text style={styles.sectionLabel}>TECHNOLOGIE</Text>
          <View style={styles.card}>
            <View style={styles.techRow}>
              <TechBadge label="VpnService" color="#7B6EF6" />
              <TechBadge label="AlarmManager" color="#3DDB8A" />
              <TechBadge label="BootReceiver" color="#3DDB8A" />
              <TechBadge label="SharedPreferences" color="#F0A500" />
              <TechBadge label="LocalAuthentication" color="#FF6B6B" />
              <TechBadge label="WidgetSyncModule" color="#7B6EF6" />
            </View>
          </View>
        </Section>

        {/* ── Links ─────────────────────────────────────────────────────── */}
        <Section anim={anims[9]}>
          <Text style={styles.sectionLabel}>LIENS</Text>
          <View style={styles.card}>
            <LinkRow
              icon="◎"
              label="Politique de confidentialité"
              onPress={() => Linking.openURL("https://example.com/privacy")}
            />
            <View style={styles.divider} />
            <LinkRow
              icon="◈"
              label="Conditions d'utilisation"
              onPress={() => Linking.openURL("https://example.com/terms")}
            />
            <View style={styles.divider} />
            <LinkRow
              icon="◷"
              label="Signaler un problème"
              onPress={() => Linking.openURL("mailto:support@netoff.app")}
            />
            <View style={styles.divider} />
            <LinkRow
              icon="⊙"
              label="Changelog"
              onPress={() => Linking.openURL("https://example.com/changelog")}
            />
          </View>
        </Section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <Section anim={anims[9]}>
          <View style={styles.footer}>
            <Text style={styles.footerLogo}>◉ NetOff</Text>
            <Text style={styles.footerCopy}>
              © {new Date().getFullYear()} — Fait avec soin
            </Text>
            <Text style={styles.footerSub}>Votre réseau, vos règles.</Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

// ─── Tech badge ───────────────────────────────────────────────────────────────
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080810" },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  backBtn: { marginBottom: 12 },
  backText: { color: "#3DDB8A", fontSize: 14, fontWeight: "600" },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -1.5,
  },

  scroll: { paddingHorizontal: 22, paddingTop: 28 },

  // ── Hero
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
    backgroundColor: "#7B6EF618",
    borderWidth: 1,
    borderColor: "#7B6EF640",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#7B6EF6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7B6EF6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logoIcon: { fontSize: 26, color: "#F0F0FF" },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#7B6EF620",
  },
  ring1: { width: 96, height: 96 },
  ring2: { width: 116, height: 116, borderColor: "#7B6EF610" },

  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#F0F0FF",
    letterSpacing: -2,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 14,
    color: "#3A3A58",
    fontWeight: "500",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  versionRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  versionBadge: {
    backgroundColor: "#7B6EF618",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#7B6EF640",
  },
  versionText: { fontSize: 12, color: "#9B8FFF", fontWeight: "700" },
  buildBadge: {
    backgroundColor: "#14141E",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#1C1C2C",
  },
  buildText: { fontSize: 12, color: "#3A3A58", fontWeight: "600" },

  // ── Stats row
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#1C1C2C",
    marginHorizontal: 8,
  },

  // ── Mission card
  missionCard: {
    backgroundColor: "#0E0E18",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1C1C2C",
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
    backgroundColor: "#7B6EF6",
  },
  missionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F0F0FF",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  missionText: {
    fontSize: 14,
    color: "#5A5A80",
    lineHeight: 22,
  },

  // ── Section label + card
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E2E48",
    letterSpacing: 2,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#0E0E18",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1C1C2C",
    marginBottom: 14,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "#13131F",
    marginHorizontal: 16,
  },

  // ── Tech row
  techRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 16,
  },

  // ── Privacy card
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#0D221880",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#3DDB8A30",
    marginBottom: 28,
  },
  privacyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#3DDB8A15",
    borderWidth: 1,
    borderColor: "#3DDB8A40",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  privacyIcon: { fontSize: 18, color: "#3DDB8A" },
  privacyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3DDB8A",
    marginBottom: 6,
  },
  privacyText: {
    fontSize: 13,
    color: "#4A8A6A",
    lineHeight: 20,
  },

  // ── Footer
  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
    marginTop: 12,
  },
  footerLogo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7B6EF6",
    letterSpacing: -0.5,
  },
  footerCopy: {
    fontSize: 12,
    color: "#2E2E48",
    fontWeight: "500",
  },
  footerSub: {
    fontSize: 11,
    color: "#1E1E30",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

// ─── Feature item styles ───────────────────────────────────────────────────────
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
    backgroundColor: "#7B6EF618",
    borderWidth: 1,
    borderColor: "#7B6EF630",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  icon: { fontSize: 16, color: "#7B6EF6" },
  text: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E8E8F8",
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    color: "#3A3A58",
    lineHeight: 18,
  },
});

// ─── Info row styles ──────────────────────────────────────────────────────────
const row = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: { fontSize: 14, color: "#5A5A80", fontWeight: "500" },
  value: { fontSize: 14, color: "#E8E8F8", fontWeight: "600" },
});

// ─── Link row styles ──────────────────────────────────────────────────────────
const lnk = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: { fontSize: 14, color: "#5A5A80" },
  label: { flex: 1, fontSize: 14, color: "#E8E8F8", fontWeight: "500" },
  labelDanger: { color: "#D04070" },
  arrow: { fontSize: 20, color: "#2E2E48", fontWeight: "300" },
});

// ─── Stat pill styles ─────────────────────────────────────────────────────────
const stat = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  value: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9B8FFF",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    color: "#2E2E48",
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

// ─── Feature group styles ─────────────────────────────────────────────────────
const grp = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#13131F",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5A5A80",
    letterSpacing: 0.3,
  },
  chevron: {
    fontSize: 14,
    color: "#2E2E48",
  },
});

// ─── Tech badge styles ─────────────────────────────────────────────────────────
const tech = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
