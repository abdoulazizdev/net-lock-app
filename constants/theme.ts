// ─── theme.ts ─────────────────────────────────────────────────────────────────
// Thème NetOff — Blanc / Bleu (jour)
// Inspiré du logo : fond bleu dégradé #2A6DD9 → #1A4DB8, bouclier bleu clair,
// accents rouge-orange pour les éléments "bloqués".
//
// Usage :
//   import { Colors, Theme } from "@/theme";
//   style={{ backgroundColor: Colors.background.primary }}
//   style={Theme.card}
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet } from "react-native";

// ─── Palette brute ────────────────────────────────────────────────────────────
export const Colors = {
  // Bleus — couleur principale de la marque
  blue: {
    50: "#EBF3FE", // fond de page, arrière-plans
    100: "#C7DFFB", // fond de carte légère
    200: "#94C0F7", // bordures légères / accents discrets
    400: "#378ADD", // bleu moyen (icônes secondaires)
    500: "#2A6DD9", // bleu principal (boutons, liens, accents)
    600: "#1A4DB8", // bleu foncé (header, titre, bouton pressé)
    700: "#103A96", // bleu très foncé (texte sur fond clair)
    800: "#0A2870", // quasi-navy (texte d'en-tête)
  },

  // Gris neutres
  gray: {
    0: "#FFFFFF",
    50: "#F6F8FC", // fond de page
    100: "#EEF2F8", // fond de card
    150: "#E4EAF4", // fond de card légèrement enfoncée
    200: "#D0D8E8", // bordure légère
    300: "#B0BCCE", // bordure normale
    400: "#8A96A8", // texte secondaire foncé
    500: "#6A7688", // texte secondaire
    600: "#4A5468", // texte principal muted
    700: "#2A3448", // texte principal
    800: "#1A2238", // texte titre
  },

  // Rouge-orange — état "bloqué" (power button du logo)
  red: {
    50: "#FFF0EC",
    100: "#FFD5C8",
    200: "#FFA888",
    400: "#FF5733", // accent bloqué vif
    500: "#E84020", // rouge-orange principal
    600: "#C23010", // bouton danger pressé
  },

  // Vert — état "autorisé"
  green: {
    50: "#EDFAF3",
    100: "#C5EED8",
    400: "#2DBB70",
    500: "#1E9A58",
    600: "#146B3D",
  },

  // Ambre — avertissements / limites
  amber: {
    50: "#FFF8E6",
    100: "#FDECC0",
    400: "#F5A623",
    500: "#D4860A",
    600: "#A86200",
  },

  // Violet — Focus mode / Premium
  purple: {
    50: "#F0EEFE",
    100: "#D4CEFB",
    400: "#7B6EF6",
    500: "#5A4FD4",
    600: "#3D34A8",
  },
} as const;

// ─── Sémantique ───────────────────────────────────────────────────────────────
export const Semantic = {
  // Fonds
  bg: {
    page: Colors.gray[50], // fond général de l'app
    card: Colors.gray[0], // carte principale
    cardAlt: Colors.gray[100], // carte secondaire / input
    cardSunken: Colors.gray[150], // zone enfoncée / code
    header: Colors.blue[600], // header principal (bleu foncé du logo)
    headerLight: Colors.blue[500], // header secondaire
    accent: Colors.blue[50], // fond accent bleu très léger
  },

  // Textes
  text: {
    primary: Colors.gray[800], // titre, label principal
    secondary: Colors.gray[600], // label secondaire
    muted: Colors.gray[400], // hint, placeholder
    inverse: Colors.gray[0], // texte sur fond sombre (header)
    inverseAlt: Colors.blue[100], // texte secondaire sur fond sombre
    link: Colors.blue[500], // liens, actions
    brand: Colors.blue[600], // nom de l'app, éléments de marque
  },

  // Bordures
  border: {
    light: Colors.gray[200],
    normal: Colors.gray[300],
    strong: Colors.blue[200],
    accent: Colors.blue[500],
    focus: Colors.blue[500],
  },

  // États fonctionnels
  blocked: {
    bg: Colors.red[50],
    bgCard: "#FFF5F3",
    border: Colors.red[100],
    borderCard: Colors.red[200],
    accent: Colors.red[500],
    text: Colors.red[600],
    textMuted: Colors.red[400],
  },

  allowed: {
    bg: Colors.green[50],
    border: Colors.green[100],
    accent: Colors.green[400],
    text: Colors.green[600],
    textMuted: Colors.green[400],
  },

  vpnOn: {
    bg: Colors.green[50],
    border: Colors.green[100],
    dot: Colors.green[400],
    text: Colors.green[600],
  },

  vpnOff: {
    bg: Colors.red[50],
    border: Colors.red[100],
    dot: Colors.red[500],
    text: Colors.red[600],
  },

  warning: {
    bg: Colors.amber[50],
    border: Colors.amber[100],
    accent: Colors.amber[400],
    text: Colors.amber[600],
    textMuted: Colors.amber[500],
  },

  focus: {
    bg: Colors.purple[50],
    border: Colors.purple[100],
    accent: Colors.purple[400],
    text: Colors.purple[600],
  },

  premium: {
    bg: Colors.purple[50],
    border: Colors.purple[100],
    accent: Colors.purple[400],
    text: Colors.purple[600],
  },

  danger: {
    bg: Colors.red[50],
    border: Colors.red[100],
    accent: Colors.red[500],
    text: Colors.red[600],
  },
} as const;

// ─── Typographie ──────────────────────────────────────────────────────────────
export const Typography = {
  // Titres
  screenTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.gray[0], // sur header bleu
    letterSpacing: -1.2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.gray[800],
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.gray[800],
  },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray[500],
    letterSpacing: 1.5,
  },
  // Corps
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: Colors.gray[500],
    lineHeight: 18,
  },
  mono: {
    fontSize: 11,
    fontFamily: "monospace" as const,
    color: Colors.gray[400],
  },
  // Badges
  badge: {
    fontSize: 9,
    fontWeight: "800" as const,
    letterSpacing: 1.2,
  },
} as const;

// ─── Radius ───────────────────────────────────────────────────────────────────
export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

// ─── Ombres ───────────────────────────────────────────────────────────────────
export const Shadow = {
  card: {
    shadowColor: Colors.blue[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  button: {
    shadowColor: Colors.blue[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    shadowColor: Colors.blue[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// ─── Composants réutilisables (StyleSheet) ────────────────────────────────────
export const Theme = StyleSheet.create({
  // ── Conteneurs
  screen: {
    flex: 1,
    backgroundColor: Semantic.bg.page,
  },

  // ── Header bleu
  header: {
    backgroundColor: Semantic.bg.header,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 0,
    ...Shadow.header,
  },
  headerTitle: {
    ...Typography.screenTitle,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.blue[200],
    fontWeight: "500",
    marginTop: 2,
  },
  backBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  backText: {
    fontSize: 14,
    color: Colors.blue[100],
    fontWeight: "600",
  },

  // ── Cards
  card: {
    backgroundColor: Semantic.bg.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Semantic.border.light,
    overflow: "hidden" as const,
    ...Shadow.card,
  },
  cardAlt: {
    backgroundColor: Semantic.bg.cardAlt,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Semantic.border.light,
    overflow: "hidden" as const,
  },
  cardAccentBlue: {
    backgroundColor: Semantic.bg.accent,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.blue[200],
    overflow: "hidden" as const,
  },

  // ── Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.gray[400],
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 6,
  },

  // ── Séparateur
  divider: {
    height: 1,
    backgroundColor: Semantic.border.light,
    marginHorizontal: Spacing.lg,
  },

  // ── Rows
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  // ── Bouton principal (bleu)
  btnPrimary: {
    backgroundColor: Semantic.bg.headerLight,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: "center" as const,
    ...Shadow.button,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.gray[0],
    letterSpacing: -0.2,
  },
  btnPrimaryDisabled: {
    backgroundColor: Colors.blue[200],
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: "center" as const,
  },

  // ── Bouton secondaire
  btnSecondary: {
    backgroundColor: Semantic.bg.card,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: Semantic.border.normal,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.gray[700],
  },

  // ── Bouton danger
  btnDanger: {
    backgroundColor: Semantic.danger.bg,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: Semantic.danger.border,
  },
  btnDangerText: {
    fontSize: 15,
    fontWeight: "800",
    color: Semantic.danger.text,
  },

  // ── Toggle
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center" as const,
    borderWidth: 1,
  },
  toggleTrackOn: {
    backgroundColor: Colors.blue[50],
    borderColor: Colors.blue[400],
  },
  toggleTrackOff: {
    backgroundColor: Colors.gray[100],
    borderColor: Colors.gray[200],
  },
  toggleThumbOn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.blue[500],
    alignSelf: "flex-end" as const,
    marginRight: 2,
  },
  toggleThumbOff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gray[300],
    alignSelf: "flex-start" as const,
    marginLeft: 2,
  },

  // ── Input
  input: {
    backgroundColor: Semantic.bg.cardAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Semantic.border.light,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.gray[800],
  },
  inputFocused: {
    borderColor: Semantic.border.focus,
    backgroundColor: Semantic.bg.card,
  },

  // ── Badge
  badgeFree: {
    backgroundColor: Colors.gray[100],
    borderRadius: Radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  badgeFreeText: {
    ...Typography.badge,
    color: Colors.gray[500],
  },
  badgePro: {
    backgroundColor: Colors.purple[50],
    borderRadius: Radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.purple[100],
  },
  badgeProText: {
    ...Typography.badge,
    color: Colors.purple[600],
  },

  // ── App row (liste apps)
  appRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: Semantic.bg.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Semantic.border.light,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    gap: 12,
  },
  appRowBlocked: {
    backgroundColor: Semantic.blocked.bgCard,
    borderColor: Semantic.blocked.borderCard,
  },

  // ── Accent bar (côté gauche des cards)
  accentBar: {
    position: "absolute" as const,
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },

  // ── Icône app
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    overflow: "hidden" as const,
  },
  appIconWrapBlocked: {
    backgroundColor: Colors.red[50],
    borderColor: Colors.red[100],
  },

  // ── VPN pill
  vpnPillOn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    backgroundColor: Semantic.vpnOn.bg,
    borderWidth: 1,
    borderColor: Semantic.vpnOn.border,
  },
  vpnPillOff: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    backgroundColor: Semantic.vpnOff.bg,
    borderWidth: 1,
    borderColor: Semantic.vpnOff.border,
  },

  // ── Focus button
  focusBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    backgroundColor: Colors.purple[50],
    borderWidth: 1,
    borderColor: Colors.purple[100],
  },
  focusBtnActive: {
    backgroundColor: Colors.purple[100],
    borderColor: Colors.purple[400],
  },

  // ── FAB
  fab: {
    position: "absolute" as const,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Semantic.bg.header,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    ...Shadow.button,
  },

  // ── Empty state
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.blue[50],
    borderWidth: 1,
    borderColor: Colors.blue[200],
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: 16,
  },

  // ── Stat card
  statCard: {
    flex: 1,
    backgroundColor: Semantic.bg.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Semantic.border.light,
    padding: 14,
    alignItems: "center" as const,
    ...Shadow.card,
  },
  statCardBlocked: {
    backgroundColor: Semantic.blocked.bg,
    borderColor: Semantic.blocked.border,
  },
  statCardAllowed: {
    backgroundColor: Semantic.allowed.bg,
    borderColor: Semantic.allowed.border,
  },

  // ── Banner limite
  limitBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    backgroundColor: Semantic.warning.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Semantic.warning.border,
    padding: 14,
    marginBottom: 14,
  },

  // ── Banner privacité / info
  infoBanner: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 12,
    backgroundColor: Colors.blue[50],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.blue[200],
    padding: 14,
  },

  // ── Schedule card
  scheduleCard: {
    backgroundColor: Semantic.bg.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Semantic.border.light,
    padding: 16,
    paddingLeft: 20,
    marginBottom: 8,
    overflow: "hidden" as const,
    ...Shadow.card,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne les styles de status bar pour le header bleu */
export const statusBarStyle = "light-content" as const;
export const statusBarBg = Semantic.bg.header;

/** Teinte du RefreshControl */
export const refreshTint = Colors.blue[500];

/** Couleur de l'indicateur de chargement */
export const spinnerColor = Colors.blue[500];

/** Couleur de sélection / focus des inputs */
export const selectionColor = Colors.blue[400];
