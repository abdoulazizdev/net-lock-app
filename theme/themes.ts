/**
 * theme/themes.ts — Couche sémantique du design system
 *
 * Chaque clé décrit un USAGE, pas une couleur : `t.text.secondary`,
 * `t.intent.blocked.accent`. Les deux thèmes exposent strictement la même
 * forme (`ThemeTokens`), ce qui garantit qu'un écran écrit pour l'un
 * fonctionne pour l'autre.
 */

import { Palette, Radius } from "./tokens";
import type { TextStyle, ViewStyle } from "react-native";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Palette d'un état : fond teinté, bordure, couleur pleine, texte lisible. */
export type IntentTokens = {
  /** Fond très légèrement teinté — cartes, bannières. */
  bg: string;
  /** Bordure du fond teinté. */
  border: string;
  /** Couleur pleine — points, barres, icônes, remplissages. */
  accent: string;
  /** Texte lisible sur `bg` (contraste ≥ 4.5:1). */
  text: string;
  /** Texte lisible posé sur `accent`. */
  onAccent: string;
};

export type ThemeTokens = {
  scheme: "light" | "dark";

  /** Surfaces, de la plus profonde à la plus haute. */
  bg: {
    /** Fond de page. */
    page: string;
    /** Carte / surface de premier niveau. */
    card: string;
    /** Surface secondaire — champs, cellules imbriquées. */
    cardAlt: string;
    /** Surface enfoncée — pistes de progression, fonds de groupe. */
    cardSunken: string;
    /** Surface flottante — bottom sheets, menus, popovers. */
    elevated: string;
    /** Fond d'en-tête. */
    header: string;
    /** Fond teinté à la couleur de marque. */
    accent: string;
    /** Voile derrière une modale. */
    scrim: string;
  };

  text: {
    primary: string;
    secondary: string;
    muted: string;
    /** Le plus discret — séparateurs textuels, horodatages. */
    faint: string;
    /** Texte sur fond sombre en thème clair (et inversement). */
    inverse: string;
    inverseAlt: string;
    /** Lien / action textuelle. */
    link: string;
    /** Texte posé sur la couleur de marque pleine. */
    onBrand: string;
  };

  border: {
    /** Séparateurs, hairlines. */
    light: string;
    /** Contour de carte, de champ. */
    normal: string;
    /** Contour appuyé — élément sélectionné. */
    strong: string;
    /** Anneau de focus clavier / champ actif. */
    focus: string;
  };

  /** Couleur de marque et ses variations. */
  brand: {
    base: string;
    pressed: string;
    /** Fond teinté marque. */
    soft: string;
    softBorder: string;
    onBase: string;
    /** Départ / fin d'un dégradé de marque (simulé par calques). */
    gradientFrom: string;
    gradientTo: string;
  };

  /** États métier. Chacun suit la forme `IntentTokens`. */
  intent: {
    /** App bloquée, trafic coupé. */
    blocked: IntentTokens;
    /** App autorisée, trafic ouvert. */
    allowed: IntentTokens;
    /** Avertissement, limite atteinte. */
    warning: IntentTokens;
    /** Session Focus, Premium. */
    focus: IntentTokens;
    /** Action destructrice. */
    danger: IntentTokens;
    /** Information neutre, réseau. */
    info: IntentTokens;
    /** Neutre — chips inactifs, métadonnées. */
    neutral: IntentTokens;
  };

  /** Ombres prêtes à l'emploi, calibrées par thème. */
  shadow: {
    none: ViewStyle;
    sm: ViewStyle;
    md: ViewStyle;
    lg: ViewStyle;
    xl: ViewStyle;
  };

  /** Style de la barre de statut système. */
  statusBar: "light-content" | "dark-content";

  /** Teinte du `RefreshControl`. */
  refreshTint: string;

  // ── Compatibilité ──────────────────────────────────────────────────────────
  // Alias conservés pour les écrans pas encore migrés. Préférer `intent.*`.
  blocked: IntentTokens;
  allowed: IntentTokens;
  warning: IntentTokens;
  focus: IntentTokens;
  danger: IntentTokens;
  vpnOn: IntentTokens & { dot: string };
  vpnOff: IntentTokens & { dot: string };
  shadowColor: string;
  shadowOpacity: number;
  headerBtnBg: string;
  headerBtnBorder: string;
  headerBtnText: string;
};

// ─── Fabriques ───────────────────────────────────────────────────────────────

function shadow(color: string, opacity: number) {
  const at = (
    height: number,
    radius: number,
    mult: number,
    elevation: number,
  ): ViewStyle => ({
    shadowColor: color,
    shadowOffset: { width: 0, height },
    shadowOpacity: opacity * mult,
    shadowRadius: radius,
    elevation,
  });
  return {
    none: { shadowOpacity: 0, elevation: 0 } as ViewStyle,
    sm: at(1, 3, 0.7, 1),
    md: at(4, 10, 1, 4),
    lg: at(10, 24, 1.25, 10),
    xl: at(20, 40, 1.5, 20),
  };
}

// ─── Thème Jour ──────────────────────────────────────────────────────────────

const lightIntents = {
  blocked: {
    bg: Palette.red[50],
    border: "#F8D3CD",
    accent: Palette.red[500],
    text: Palette.red[700],
    onAccent: "#FFFFFF",
  },
  allowed: {
    bg: Palette.green[50],
    border: "#C4EFDB",
    accent: Palette.green[500],
    text: Palette.green[700],
    onAccent: "#FFFFFF",
  },
  warning: {
    bg: Palette.amber[50],
    border: "#F8E1B4",
    accent: Palette.amber[400],
    text: Palette.amber[700],
    onAccent: "#3A2204",
  },
  focus: {
    bg: Palette.violet[50],
    border: "#E0D7FC",
    accent: Palette.violet[500],
    text: Palette.violet[700],
    onAccent: "#FFFFFF",
  },
  danger: {
    bg: Palette.red[50],
    border: "#F8D3CD",
    accent: Palette.red[600],
    text: Palette.red[700],
    onAccent: "#FFFFFF",
  },
  info: {
    bg: Palette.cyan[50],
    border: "#BEECF4",
    accent: Palette.cyan[500],
    text: Palette.cyan[700],
    onAccent: "#FFFFFF",
  },
  neutral: {
    bg: Palette.slate[100],
    border: Palette.slate[200],
    accent: Palette.slate[500],
    text: Palette.slate[700],
    onAccent: "#FFFFFF",
  },
} satisfies Record<string, IntentTokens>;

export const LightTheme: ThemeTokens = {
  scheme: "light",
  bg: {
    page: Palette.slate[50],
    card: Palette.slate[0],
    cardAlt: Palette.slate[100],
    cardSunken: Palette.slate[150],
    elevated: Palette.slate[0],
    header: Palette.slate[50],
    accent: Palette.brand[50],
    scrim: "rgba(17,22,34,0.44)",
  },
  text: {
    primary: Palette.slate[900],
    secondary: Palette.slate[600],
    muted: Palette.slate[500],
    faint: Palette.slate[400],
    inverse: Palette.slate[0],
    inverseAlt: "rgba(255,255,255,0.72)",
    link: Palette.brand[600],
    onBrand: "#FFFFFF",
  },
  border: {
    light: Palette.slate[150],
    normal: Palette.slate[200],
    strong: Palette.brand[200],
    focus: Palette.brand[500],
  },
  brand: {
    base: Palette.brand[600],
    pressed: Palette.brand[700],
    soft: Palette.brand[50],
    softBorder: Palette.brand[100],
    onBase: "#FFFFFF",
    gradientFrom: Palette.brand[600],
    gradientTo: Palette.violet[600],
  },
  intent: lightIntents,
  shadow: shadow("#0B1836", 0.1),
  statusBar: "dark-content",
  refreshTint: Palette.brand[600],

  blocked: lightIntents.blocked,
  allowed: lightIntents.allowed,
  warning: lightIntents.warning,
  focus: lightIntents.focus,
  danger: lightIntents.danger,
  vpnOn: { ...lightIntents.allowed, dot: lightIntents.allowed.accent },
  vpnOff: { ...lightIntents.blocked, dot: lightIntents.blocked.accent },
  shadowColor: "#0B1836",
  shadowOpacity: 0.1,
  headerBtnBg: Palette.slate[100],
  headerBtnBorder: Palette.slate[200],
  headerBtnText: Palette.slate[700],
};

// ─── Thème Nuit ──────────────────────────────────────────────────────────────
// En sombre, les fonds teintés sont très désaturés (sinon ils « brillent ») et
// les accents sont éclaircis d'un cran pour rester lisibles.

const darkIntents = {
  blocked: {
    bg: "#22110F",
    border: "#3A1A17",
    accent: Palette.red[400],
    text: "#F79289",
    onAccent: "#2A0C0A",
  },
  allowed: {
    bg: "#082016",
    border: "#0F3527",
    accent: Palette.green[300],
    text: "#6EDDAC",
    onAccent: "#03150E",
  },
  warning: {
    bg: "#221803",
    border: "#3A2A08",
    accent: Palette.amber[300],
    text: "#F7C769",
    onAccent: "#221803",
  },
  focus: {
    bg: "#191131",
    border: "#2C1F55",
    accent: Palette.violet[300],
    text: "#BFA9FA",
    onAccent: "#150C2E",
  },
  danger: {
    bg: "#22110F",
    border: "#3A1A17",
    accent: Palette.red[400],
    text: "#F79289",
    onAccent: "#2A0C0A",
  },
  info: {
    bg: "#07202A",
    border: "#0B3542",
    accent: Palette.cyan[300],
    text: "#63D6E8",
    onAccent: "#03161C",
  },
  neutral: {
    bg: Palette.ink[150],
    border: Palette.ink[300],
    accent: Palette.ink[600],
    text: Palette.ink[800],
    onAccent: Palette.ink[0],
  },
} satisfies Record<string, IntentTokens>;

export const DarkTheme: ThemeTokens = {
  scheme: "dark",
  bg: {
    page: Palette.ink[0],
    card: Palette.ink[50],
    cardAlt: Palette.ink[100],
    cardSunken: Palette.ink[150],
    elevated: Palette.ink[100],
    header: Palette.ink[0],
    accent: "#141833",
    scrim: "rgba(4,5,8,0.66)",
  },
  text: {
    primary: Palette.ink[900],
    secondary: Palette.ink[700],
    muted: Palette.ink[600],
    faint: Palette.ink[500],
    inverse: Palette.ink[0],
    inverseAlt: "rgba(241,244,249,0.72)",
    link: Palette.brand[300],
    onBrand: "#FFFFFF",
  },
  border: {
    light: Palette.ink[200],
    normal: Palette.ink[300],
    strong: Palette.ink[400],
    focus: Palette.brand[400],
  },
  brand: {
    base: Palette.brand[500],
    pressed: Palette.brand[600],
    soft: "#141833",
    softBorder: "#232A55",
    onBase: "#FFFFFF",
    gradientFrom: Palette.brand[500],
    gradientTo: Palette.violet[500],
  },
  intent: darkIntents,
  shadow: shadow("#000000", 0.5),
  statusBar: "light-content",
  refreshTint: Palette.brand[300],

  blocked: darkIntents.blocked,
  allowed: darkIntents.allowed,
  warning: darkIntents.warning,
  focus: darkIntents.focus,
  danger: darkIntents.danger,
  vpnOn: { ...darkIntents.allowed, dot: darkIntents.allowed.accent },
  vpnOff: { ...darkIntents.blocked, dot: darkIntents.blocked.accent },
  shadowColor: "#000000",
  shadowOpacity: 0.5,
  headerBtnBg: Palette.ink[100],
  headerBtnBorder: Palette.ink[200],
  headerBtnText: Palette.ink[800],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Style de carte standard : surface + contour + rayon. */
export function cardStyle(t: ThemeTokens, radius: number = Radius.lg): ViewStyle {
  return {
    backgroundColor: t.bg.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: t.border.light,
  };
}

/** Style de texte tabulaire — chiffres alignés dans les statistiques. */
export const tabularNums: TextStyle = {
  fontVariant: ["tabular-nums"],
};
