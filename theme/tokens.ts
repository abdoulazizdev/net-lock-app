/**
 * theme/tokens.ts — Primitives du design system NetOff
 *
 * Ce fichier ne contient QUE des valeurs brutes, invariantes, sans sémantique
 * de thème. La couche sémantique (quelle couleur pour quel usage) vit dans
 * `theme/themes.ts`.
 *
 * Règle : un composant ne référence jamais `Palette` directement pour une
 * couleur d'interface — il passe par `useTheme().t`. `Palette` reste accessible
 * pour les cas invariants (dégradés de marque, illustrations).
 */

// ─── Palette ─────────────────────────────────────────────────────────────────

export const Palette = {
  /** Marque — indigo profond, lisible sur clair comme sur sombre. */
  brand: {
    50: "#EEF1FF",
    100: "#DFE4FF",
    200: "#C0C9FF",
    300: "#98A6FF",
    400: "#7183FF",
    500: "#5261F5",
    600: "#3F4BDB",
    700: "#3139AE",
    800: "#252B85",
    900: "#1B1F60",
  },
  /** Accent secondaire — violet, utilisé pour Focus et Premium. */
  violet: {
    50: "#F4F1FE",
    100: "#E9E3FD",
    200: "#D3C7FB",
    300: "#B7A4F8",
    400: "#9B7CF5",
    500: "#8257EC",
    600: "#6C3FD1",
    700: "#5631A6",
    800: "#40257C",
    900: "#2C1955",
  },
  /** Vert — autorisé, succès, connexion active. */
  green: {
    50: "#EAFBF3",
    100: "#CDF5E2",
    200: "#9BE9C6",
    300: "#5FD9A5",
    400: "#2FC183",
    500: "#17A268",
    600: "#0F8153",
    700: "#0C6241",
    800: "#0A4630",
    900: "#062F21",
  },
  /** Rouge — bloqué, danger, destruction. */
  red: {
    50: "#FEF0EE",
    100: "#FDDCD8",
    200: "#FBB8B0",
    300: "#F78D82",
    400: "#F0625A",
    500: "#DE3F3D",
    600: "#BC2C2E",
    700: "#951F24",
    800: "#6E171C",
    900: "#4A1014",
  },
  /** Ambre — avertissement, limite atteinte, planification. */
  amber: {
    50: "#FFF7E8",
    100: "#FDEBC6",
    200: "#FBD78C",
    300: "#F8BE4C",
    400: "#EFA315",
    500: "#CE8206",
    600: "#A56405",
    700: "#7C4B06",
    800: "#573406",
    900: "#3A2204",
  },
  /** Cyan — information, réseau, Wi-Fi. */
  cyan: {
    50: "#E8FAFC",
    100: "#C7F2F8",
    200: "#8FE4F0",
    300: "#4FD0E4",
    400: "#1FB4CE",
    500: "#0E93AD",
    600: "#0A748B",
    700: "#0A5A6B",
    800: "#08404C",
    900: "#052B33",
  },
  /** Neutres clairs — surfaces et textes du thème Jour. */
  slate: {
    0: "#FFFFFF",
    25: "#FBFCFD",
    50: "#F5F7FA",
    100: "#EDF0F5",
    150: "#E4E8EF",
    200: "#D8DDE7",
    300: "#BEC5D2",
    400: "#98A1B2",
    500: "#737D8F",
    600: "#545E70",
    700: "#3A4354",
    800: "#252D3B",
    900: "#151A24",
  },
  /** Neutres sombres — surfaces et textes du thème Nuit. */
  ink: {
    0: "#08090C",
    25: "#0B0D11",
    50: "#0F1116",
    100: "#14171E",
    150: "#191D25",
    200: "#20242E",
    300: "#282E3A",
    400: "#343B49",
    500: "#4A5261",
    600: "#6B7484",
    700: "#98A1B0",
    800: "#C8CFDB",
    900: "#F1F4F9",
  },
  /** Transparences réutilisables. */
  alpha: {
    white04: "rgba(255,255,255,0.04)",
    white06: "rgba(255,255,255,0.06)",
    white08: "rgba(255,255,255,0.08)",
    white12: "rgba(255,255,255,0.12)",
    white16: "rgba(255,255,255,0.16)",
    white24: "rgba(255,255,255,0.24)",
    white40: "rgba(255,255,255,0.40)",
    white64: "rgba(255,255,255,0.64)",
    black04: "rgba(9,11,16,0.04)",
    black06: "rgba(9,11,16,0.06)",
    black08: "rgba(9,11,16,0.08)",
    black12: "rgba(9,11,16,0.12)",
    black24: "rgba(9,11,16,0.24)",
    black40: "rgba(9,11,16,0.40)",
    black64: "rgba(9,11,16,0.64)",
  },
} as const;

// ─── Espacements ─────────────────────────────────────────────────────────────
// Échelle de 4pt. `gutter` est la marge horizontale standard des écrans.

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  gutter: 16,
} as const;

// ─── Rayons ──────────────────────────────────────────────────────────────────

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

// ─── Typographie ─────────────────────────────────────────────────────────────
// Une seule échelle, utilisée par `<Text variant="…">`. Les tailles display
// portent un tracking négatif (resserrement) pour un rendu « produit ».

export type TypeVariant =
  | "display"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "bodyStrong"
  | "callout"
  | "footnote"
  | "caption"
  | "overline"
  | "mono";

export const Typography: Record<
  TypeVariant,
  {
    fontSize: number;
    lineHeight: number;
    fontWeight: "400" | "500" | "600" | "700" | "800";
    letterSpacing: number;
    textTransform?: "uppercase";
  }
> = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1.1,
  },
  title1: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.7 },
  title2: { fontSize: 21, lineHeight: 27, fontWeight: "700", letterSpacing: -0.45 },
  title3: { fontSize: 17, lineHeight: 23, fontWeight: "700", letterSpacing: -0.25 },
  headline: { fontSize: 15, lineHeight: 21, fontWeight: "700", letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400", letterSpacing: -0.05 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600", letterSpacing: -0.05 },
  callout: { fontSize: 13.5, lineHeight: 19, fontWeight: "500", letterSpacing: 0 },
  footnote: { fontSize: 12.5, lineHeight: 17, fontWeight: "500", letterSpacing: 0.05 },
  caption: { fontSize: 11.5, lineHeight: 15, fontWeight: "600", letterSpacing: 0.15 },
  overline: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  mono: { fontSize: 12.5, lineHeight: 18, fontWeight: "500", letterSpacing: 0.2 },
};

// ─── Mouvement ───────────────────────────────────────────────────────────────
// Deux familles : `Duration` pour les timings, `Spring` pour les ressorts
// Reanimated. Utiliser un ressort dès qu'un élément se déplace ou change de
// taille ; un timing pour l'opacité et la couleur.

export const Duration = {
  instant: 90,
  fast: 140,
  base: 200,
  slow: 280,
  slower: 380,
} as const;

export const Spring = {
  /** Réactif, sans rebond — boutons, sélections. */
  snappy: { damping: 26, stiffness: 340, mass: 0.9 },
  /** Standard — cartes, panneaux, réordonnancement. */
  default: { damping: 22, stiffness: 210, mass: 1 },
  /** Doux avec un léger rebond — apparitions, bottom sheets. */
  gentle: { damping: 18, stiffness: 150, mass: 1 },
  /** Rebond marqué — badges, célébrations. */
  bouncy: { damping: 12, stiffness: 220, mass: 0.9 },
} as const;

// ─── Divers ──────────────────────────────────────────────────────────────────

/** Zone tactile étendue standard pour les petites cibles. */
export const HitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Hauteur de la barre d'onglets, hors safe-area. */
export const TAB_BAR_HEIGHT = 60;

/** Opacité appliquée à un élément désactivé. */
export const DISABLED_OPACITY = 0.42;
