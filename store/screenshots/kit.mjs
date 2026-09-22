/**
 * store/screenshots/kit.mjs — briques de rendu des captures
 *
 * Les valeurs viennent de theme/tokens.ts et theme/themes.ts : les visuels
 * doivent montrer l'application telle qu'elle est, pas une interprétation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ─── Police d'icônes de l'app ────────────────────────────────────────────────

const ICON_DIR = path.join(
  root,
  "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons",
);
const glyphs = JSON.parse(
  fs.readFileSync(path.join(ICON_DIR, "glyphmaps/MaterialCommunityIcons.json"), "utf8"),
);
export const ICON_FONT_BASE64 = fs
  .readFileSync(path.join(ICON_DIR, "Fonts/MaterialCommunityIcons.ttf"))
  .toString("base64");

/** Icône Material Community, comme dans l'app. */
export function icon(name, size = 20, color = "currentColor", style = "") {
  const code = glyphs[name];
  if (code === undefined) throw new Error(`Icône inconnue : ${name}`);
  return `<i class="mci" style="font-size:${size}px;color:${color};${style}">&#${code};</i>`;
}

// ─── Palette (theme/tokens.ts) ───────────────────────────────────────────────

export const P = {
  brand: { 50: "#EEF1FF", 100: "#DFE4FF", 200: "#C0C9FF", 300: "#98A6FF", 400: "#7183FF", 500: "#5261F5", 600: "#3F4BDB", 700: "#3139AE", 800: "#252B85", 900: "#1B1F60" },
  violet: { 50: "#F4F1FE", 100: "#E9E3FD", 200: "#D3C7FB", 300: "#B7A4F8", 400: "#9B7CF5", 500: "#8257EC", 600: "#6C3FD1", 700: "#5631A6", 800: "#40257C", 900: "#2C1955" },
  green: { 50: "#EAFBF3", 100: "#CDF5E2", 200: "#9BE9C6", 300: "#5FD9A5", 400: "#2FC183", 500: "#17A268", 600: "#0F8153", 700: "#0C6241" },
  red: { 50: "#FEF0EE", 100: "#FDDCD8", 200: "#FBB8B0", 300: "#F78D82", 400: "#F0625A", 500: "#DE3F3D", 600: "#BC2C2E", 700: "#951F24" },
  amber: { 50: "#FFF7E8", 100: "#FDEBC6", 200: "#FBD78C", 300: "#F8BE4C", 400: "#EFA315", 500: "#CE8206", 700: "#7C4B06" },
  cyan: { 50: "#E8FAFC", 100: "#C7F2F8", 300: "#4FD0E4", 500: "#0E93AD", 700: "#0A5A6B" },
  slate: { 0: "#FFFFFF", 25: "#FBFCFD", 50: "#F5F7FA", 100: "#EDF0F5", 150: "#E4E8EF", 200: "#D8DDE7", 300: "#BEC5D2", 400: "#98A1B2", 500: "#737D8F", 600: "#545E70", 700: "#3A4354", 800: "#252D3B", 900: "#151A24" },
};

/** Thème Jour (theme/themes.ts → LightTheme). */
export const T = {
  page: P.slate[50],
  card: P.slate[0],
  cardAlt: P.slate[100],
  cardSunken: P.slate[150],
  textPrimary: P.slate[900],
  textSecondary: P.slate[600],
  textMuted: P.slate[500],
  textFaint: P.slate[400],
  borderLight: P.slate[150],
  borderNormal: P.slate[200],
  brand: P.brand[600],
  brandSoft: P.brand[50],
  brandSoftBorder: P.brand[100],
  blocked: { bg: P.red[50], border: "#F8D3CD", accent: P.red[500], text: P.red[700] },
  allowed: { bg: P.green[50], border: "#C4EFDB", accent: P.green[500], text: P.green[700] },
  warning: { bg: P.amber[50], border: "#F8E1B4", accent: P.amber[400], text: P.amber[700] },
  focus: { bg: P.violet[50], border: "#E0D7FC", accent: P.violet[500], text: P.violet[700] },
  info: { bg: P.cyan[50], border: "#BEECF4", accent: P.cyan[500], text: P.cyan[700] },
};

/**
 * Intentions utilisables comme fond teinté. `brand` n'en est pas une dans le
 * thème (c'est une couleur pleine) : on lui fabrique son équivalent, sans quoi
 * les tuiles concernées se retrouvent sans fond ni bordure.
 */
export const TONE = {
  brand: { bg: T.brandSoft, border: T.brandSoftBorder, accent: T.brand, text: T.brand },
  blocked: T.blocked,
  allowed: T.allowed,
  warning: T.warning,
  focus: T.focus,
  info: T.info,
};

// ─── Composants (miroirs de ui/) ─────────────────────────────────────────────

/** Pastille colorée d'une app, comme ui/AppAvatar. */
export function appAvatar(letter, hue, size = 40) {
  return `<div class="avatar" style="width:${size}px;height:${size}px;border-radius:${size * 0.3}px;
    background:hsl(${hue} 72% 94%);color:hsl(${hue} 60% 34%);font-size:${size * 0.42}px">${letter}</div>`;
}

/** Interrupteur, comme ui/Switch. */
export function toggle(on, tone = "brand") {
  const accent = tone === "blocked" ? T.blocked.accent : tone === "allowed" ? T.allowed.accent : T.brand;
  return `<div class="switch ${on ? "on" : ""}" style="${on ? `background:${accent}` : ""}">
    <div class="knob"></div></div>`;
}

/** Étiquette, comme ui/Badge. */
export function badge(label, tone = "focus") {
  const c = T[tone] ?? T.focus;
  return `<span class="badge" style="background:${c.bg};color:${c.text};border-color:${c.border}">${label}</span>`;
}

/** Titre de section, comme ui/Section. */
export function section(title, body, action = "") {
  return `<div class="section">
    <div class="sectionHead"><span class="overline">${title}</span>${action}</div>
    ${body}
  </div>`;
}

/** Barre d'onglets du bas. */
export function tabBar(active) {
  const tabs = [
    { key: "home", icon: "shield-check", label: "Accueil" },
    { key: "apps", icon: "apps", label: "Apps" },
    { key: "profiles", icon: "account-multiple-outline", label: "Profils" },
    { key: "stats", icon: "chart-box-outline", label: "Stats" },
  ];
  return `<div class="tabbar">${tabs
    .map((tab) => {
      const on = tab.key === active;
      return `<div class="tab ${on ? "on" : ""}">
        <div class="tabIcon">${icon(tab.icon, 22, on ? T.brand : T.textFaint)}</div>
        <span style="color:${on ? T.brand : T.textFaint}">${tab.label}</span>
      </div>`;
    })
    .join("")}</div>`;
}

/** En-tête d'écran, comme ui/AppBar. */
export function appBar(title, { back = false, trailing = "" } = {}) {
  return `<div class="appbar">
    ${back ? `<div class="appbarBtn">${icon("chevron-left", 22, T.textSecondary)}</div>` : ""}
    <span class="appbarTitle">${title}</span>
    <div class="appbarSpacer"></div>
    ${trailing}
  </div>`;
}
