// ─── theme.ts ─────────────────────────────────────────────────────────────────
// NetOff — Système de thème dual : Jour (bleu/blanc) + Nuit (sombre)
//
// • Détection automatique selon l'heure : 7h–20h → Jour, sinon → Nuit
// • Override manuel possible via useTheme()
// • Tous les composants importent useTheme() au lieu de Colors directement
//
// Usage :
//   const { t, isDark, toggle } = useTheme();
//   style={{ backgroundColor: t.bg.page }}
//   style={{ color: t.text.primary }}
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ─── Palettes brutes (invariantes) ───────────────────────────────────────────
export const Colors = {
  blue: {
    50: "#EBF3FE",
    100: "#C7DFFB",
    200: "#94C0F7",
    400: "#378ADD",
    500: "#2A6DD9",
    600: "#1A4DB8",
    700: "#103A96",
    800: "#0A2870",
  },
  gray: {
    0: "#FFFFFF",
    50: "#F6F8FC",
    100: "#EEF2F8",
    150: "#E4EAF4",
    200: "#D0D8E8",
    300: "#B0BCCE",
    400: "#8A96A8",
    500: "#6A7688",
    600: "#4A5468",
    700: "#2A3448",
    800: "#1A2238",
  },
  dark: {
    0: "#07070F", // fond page
    50: "#0C0C16", // card
    100: "#111120", // card alt
    150: "#141428", // border légère
    200: "#1C1C2C", // border normale
    300: "#2A2A42", // border forte
    400: "#3A3A58", // texte muted foncé
    500: "#5A5A80", // texte secondaire
    600: "#8A8AAA", // texte muted
    700: "#C0C0D8", // texte principal
    800: "#EDEDFF", // texte titre
  },
  red: {
    50: "#FFF0EC",
    100: "#FFD5C8",
    200: "#FFA888",
    400: "#FF5733",
    500: "#E84020",
    600: "#C23010",
    dark50: "#180A08",
    dark100: "#2A1018",
    darkAccent: "#C04060",
  },
  green: {
    50: "#EDFAF3",
    100: "#C5EED8",
    400: "#2DBB70",
    500: "#1E9A58",
    600: "#146B3D",
    dark50: "#081410",
    dark100: "#0E3020",
    darkAccent: "#2DB870",
  },
  amber: {
    50: "#FFF8E6",
    100: "#FDECC0",
    200: "#FCD38C",
    400: "#F5A623",
    500: "#D4860A",
    600: "#A86200",
    700: "#7C4E00",
    dark50: "#100C04",
    dark100: "#3A2800",
    darkAccent: "#C07010",
  },
  purple: {
    50: "#F0EEFE",
    100: "#D4CEFB",
    200: "#AFA9EC",
    300: "#897EDD",
    400: "#7B6EF6",
    500: "#5A4FD4",
    600: "#3D34A8",
    700: "#2A2A96",
    dark50: "#16103A",
    dark100: "#4A3F8A",
  },
} as const;

// ─── Tokens sémantiques par thème ────────────────────────────────────────────
export type ThemeTokens = {
  // Fonds
  bg: {
    page: string; // fond général
    card: string; // carte principale
    cardAlt: string; // carte secondaire / input
    cardSunken: string; // zone enfoncée
    header: string; // header app
    accent: string; // fond accent
  };
  // Textes
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string; // sur fond sombre
    inverseAlt: string; // secondaire sur fond sombre
    link: string;
  };
  // Bordures
  border: {
    light: string;
    normal: string;
    strong: string;
    focus: string;
  };
  // États
  blocked: {
    bg: string;
    border: string;
    accent: string;
    text: string;
  };
  allowed: {
    bg: string;
    border: string;
    accent: string;
    text: string;
  };
  vpnOn: {
    bg: string;
    border: string;
    dot: string;
    text: string;
  };
  vpnOff: {
    bg: string;
    border: string;
    dot: string;
    text: string;
  };
  warning: {
    bg: string;
    border: string;
    accent: string;
    text: string;
  };
  focus: {
    bg: string;
    border: string;
    accent: string;
    text: string;
  };
  danger: {
    bg: string;
    border: string;
    accent: string;
    text: string;
  };
  // StatusBar
  statusBar: "light-content" | "dark-content";
  // Refresh control
  refreshTint: string;
  // Ombre des cards
  shadowColor: string;
  shadowOpacity: number;
  // Header buttons (sur fond bleu)
  headerBtnBg: string;
  headerBtnBorder: string;
  headerBtnText: string;
};

// ─── Thème JOUR (bleu/blanc) ──────────────────────────────────────────────────
export const LightTheme: ThemeTokens = {
  bg: {
    page: Colors.gray[50],
    card: Colors.gray[0],
    cardAlt: Colors.gray[100],
    cardSunken: Colors.gray[150],
    header: Colors.blue[600],
    accent: Colors.blue[50],
  },
  text: {
    primary: Colors.gray[800],
    secondary: Colors.gray[600],
    muted: Colors.gray[400],
    inverse: Colors.gray[0],
    inverseAlt: Colors.blue[200],
    link: Colors.blue[500],
  },
  border: {
    light: Colors.gray[200],
    normal: Colors.gray[300],
    strong: Colors.blue[200],
    focus: Colors.blue[500],
  },
  blocked: {
    bg: Colors.red[50],
    border: Colors.red[100],
    accent: Colors.red[500],
    text: Colors.red[600],
  },
  allowed: {
    bg: Colors.green[50],
    border: Colors.green[100],
    accent: Colors.green[400],
    text: Colors.green[600],
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
  },
  focus: {
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
  statusBar: "light-content",
  refreshTint: Colors.blue[500],
  shadowColor: Colors.blue[600],
  shadowOpacity: 0.06,
  headerBtnBg: "rgba(255,255,255,.12)",
  headerBtnBorder: "rgba(255,255,255,.2)",
  headerBtnText: Colors.blue[100],
};

// ─── Thème NUIT (sombre) ──────────────────────────────────────────────────────
export const DarkTheme: ThemeTokens = {
  bg: {
    page: Colors.dark[0],
    card: Colors.dark[50],
    cardAlt: Colors.dark[100],
    cardSunken: Colors.dark[100],
    header: Colors.blue[600], // header reste bleu dans les 2 thèmes
    accent: Colors.purple.dark50,
  },
  text: {
    primary: Colors.dark[800],
    secondary: Colors.dark[600],
    muted: Colors.dark[400],
    inverse: Colors.gray[0],
    inverseAlt: Colors.blue[200],
    link: Colors.blue[400],
  },
  border: {
    light: Colors.dark[150],
    normal: Colors.dark[200],
    strong: Colors.dark[300],
    focus: Colors.blue[400],
  },
  blocked: {
    bg: Colors.red.dark50,
    border: Colors.red.dark100,
    accent: Colors.red.darkAccent,
    text: Colors.red.darkAccent,
  },
  allowed: {
    bg: Colors.green.dark50,
    border: Colors.green.dark100,
    accent: Colors.green.darkAccent,
    text: Colors.green.darkAccent,
  },
  vpnOn: {
    bg: Colors.green.dark50,
    border: Colors.green.dark100,
    dot: Colors.green.darkAccent,
    text: Colors.green.darkAccent,
  },
  vpnOff: {
    bg: Colors.red.dark50,
    border: Colors.red.dark100,
    dot: Colors.red.darkAccent,
    text: Colors.red.darkAccent,
  },
  warning: {
    bg: Colors.amber.dark50,
    border: Colors.amber.dark100,
    accent: Colors.amber.darkAccent,
    text: Colors.amber.darkAccent,
  },
  focus: {
    bg: Colors.purple.dark50,
    border: Colors.purple.dark100,
    accent: Colors.purple[400],
    text: "#9B8FFF",
  },
  danger: {
    bg: Colors.red.dark50,
    border: Colors.red.dark100,
    accent: Colors.red.darkAccent,
    text: Colors.red.darkAccent,
  },
  statusBar: "light-content",
  refreshTint: Colors.purple[400],
  shadowColor: "#000000",
  shadowOpacity: 0.3,
  headerBtnBg: "rgba(255,255,255,.1)",
  headerBtnBorder: "rgba(255,255,255,.15)",
  headerBtnText: Colors.blue[100],
};

// ─── Logique de détection auto ────────────────────────────────────────────────
const STORAGE_KEY = "@netoff_theme_override";
const DAY_START = 7; // 7h00
const DAY_END = 20; // 20h00

function isNightTime(): boolean {
  const h = new Date().getHours();
  return h < DAY_START || h >= DAY_END;
}

export type ThemeMode = "auto" | "light" | "dark";

// ─── Context ──────────────────────────────────────────────────────────────────
type ThemeContextValue = {
  t: ThemeTokens; // tokens du thème actif
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void; // bascule light ↔ dark (passe en mode manuel)
};

export const NetOffThemeContext = createContext<ThemeContextValue>({
  t: LightTheme,
  isDark: false,
  mode: "auto",
  setMode: () => {},
  toggle: () => {},
});

export function NetOffThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [autoIsDark, setAutoIsDark] = useState(isNightTime());

  // Charger le mode sauvegardé
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "auto") setModeState(v);
    });
  }, []);

  // Rafraîchir la détection auto toutes les minutes
  useEffect(() => {
    const id = setInterval(() => setAutoIsDark(isNightTime()), 60_000);
    return () => clearInterval(id);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  }, []);

  // isDark calculé AVANT toggle pour éviter la référence temporelle
  const isDark = mode === "dark" ? true : mode === "light" ? false : autoIsDark;

  const toggle = useCallback(() => {
    setMode(isDark ? "light" : "dark");
  }, [isDark, setMode]);

  const t = isDark ? DarkTheme : LightTheme;

  return (
    <NetOffThemeContext.Provider value={{ t, isDark, mode, setMode, toggle }}>
      {children}
    </NetOffThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(NetOffThemeContext);
}

// ─── Semantic (rétrocompat — pointe vers LightTheme) ─────────────────────────
// À utiliser UNIQUEMENT pour les valeurs invariantes (header toujours bleu).
// Pour le reste, préférer useTheme().t.*
export const Semantic = {
  bg: {
    header: Colors.blue[600],
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;
