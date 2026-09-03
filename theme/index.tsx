/**
 * theme/index.tsx — Point d'entrée du design system
 *
 *   import { useTheme, useThemedStyles, Spacing, Radius } from "@/theme";
 *
 *   const { t, isDark } = useTheme();
 *   style={{ backgroundColor: t.bg.card, borderColor: t.border.light }}
 *
 * Modes disponibles :
 *   • system   — suit le réglage d'Android/iOS (défaut)
 *   • light    — forcé clair
 *   • dark     — forcé sombre
 *   • schedule — clair de 7 h à 20 h, sombre le reste du temps
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import { Palette } from "./tokens";
import { DarkTheme, LightTheme, type ThemeTokens } from "./themes";

export * from "./tokens";
export * from "./themes";

const STORAGE_KEY = "@netoff_theme_mode";
/** Ancienne clé (v1) — migrée au premier lancement. */
const LEGACY_KEY = "@netoff_theme_override";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;

export type ThemeMode = "system" | "light" | "dark" | "schedule";

export const THEME_MODES: { key: ThemeMode; label: string; icon: string }[] = [
  { key: "system", label: "Système", icon: "cellphone-cog" },
  { key: "light", label: "Clair", icon: "white-balance-sunny" },
  { key: "dark", label: "Sombre", icon: "weather-night" },
  { key: "schedule", label: "Horaire", icon: "clock-outline" },
];

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h < DAY_START_HOUR || h >= DAY_END_HOUR;
}

function parseMode(raw: string | null): ThemeMode | null {
  switch (raw) {
    case "system":
    case "light":
    case "dark":
    case "schedule":
      return raw;
    // v1 : "auto" désignait la bascule horaire.
    case "auto":
      return "schedule";
    default:
      return null;
  }
}

// ─── Contexte ────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  /** Tokens du thème actif. */
  t: ThemeTokens;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  /** Bascule clair ↔ sombre en passant en mode manuel. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  t: DarkTheme,
  isDark: true,
  mode: "system",
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [scheduleIsNight, setScheduleIsNight] = useState(isNightHour);

  // Charge le mode persisté (et migre l'ancienne clé).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = parseMode(await AsyncStorage.getItem(STORAGE_KEY));
        if (stored) {
          if (!cancelled) setModeState(stored);
          return;
        }
        const legacy = parseMode(await AsyncStorage.getItem(LEGACY_KEY));
        if (legacy && !cancelled) {
          setModeState(legacy);
          await AsyncStorage.setItem(STORAGE_KEY, legacy);
          await AsyncStorage.removeItem(LEGACY_KEY);
        }
      } catch {
        // Pas de persistance disponible : on reste sur "system".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Le mode horaire est le seul à devoir être réévalué périodiquement.
  useEffect(() => {
    if (mode !== "schedule") return;
    setScheduleIsNight(isNightHour());
    const id = setInterval(() => setScheduleIsNight(isNightHour()), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const isDark = ((): boolean => {
    switch (mode) {
      case "light":
        return false;
      case "dark":
        return true;
      case "schedule":
        return scheduleIsNight;
      default:
        // `useColorScheme()` peut renvoyer null avant que le natif réponde :
        // on privilégie alors le sombre, cohérent avec le splash de l'app.
        return systemScheme !== "light";
    }
  })();

  const toggle = useCallback(
    () => setMode(isDark ? "light" : "dark"),
    [isDark, setMode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ t: isDark ? DarkTheme : LightTheme, isDark, mode, setMode, toggle }),
    [isDark, mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// ─── Compatibilité v1 ────────────────────────────────────────────────────────
// Ponts conservés le temps que tous les écrans passent aux nouveaux tokens.
// Ne rien ajouter ici — et préférer `useTheme().t` / `Palette` dans du code neuf.

export { ThemeProvider as NetOffThemeProvider };

export const Semantic = { bg: { header: Palette.brand[600] } } as const;

/** @deprecated Utiliser `Palette` (theme/tokens.ts). */
export const Colors = {
  blue: {
    50: Palette.brand[50],
    100: Palette.brand[100],
    200: Palette.brand[200],
    400: Palette.brand[400],
    500: Palette.brand[500],
    600: Palette.brand[600],
    700: Palette.brand[700],
    800: Palette.brand[800],
  },
  gray: {
    0: Palette.slate[0],
    50: Palette.slate[50],
    100: Palette.slate[100],
    150: Palette.slate[150],
    200: Palette.slate[200],
    300: Palette.slate[300],
    400: Palette.slate[400],
    500: Palette.slate[500],
    600: Palette.slate[600],
    700: Palette.slate[700],
    800: Palette.slate[900],
  },
  dark: {
    0: Palette.ink[0],
    50: Palette.ink[50],
    100: Palette.ink[100],
    150: Palette.ink[150],
    200: Palette.ink[200],
    300: Palette.ink[300],
    400: Palette.ink[500],
    500: Palette.ink[500],
    600: Palette.ink[600],
    700: Palette.ink[700],
    800: Palette.ink[900],
  },
  red: {
    50: Palette.red[50],
    100: Palette.red[100],
    200: Palette.red[200],
    400: Palette.red[400],
    500: Palette.red[500],
    600: Palette.red[600],
    dark50: DarkTheme.intent.blocked.bg,
    dark100: DarkTheme.intent.blocked.border,
    darkAccent: DarkTheme.intent.blocked.accent,
  },
  green: {
    50: Palette.green[50],
    100: Palette.green[100],
    200: Palette.green[200],
    400: Palette.green[400],
    500: Palette.green[500],
    600: Palette.green[600],
    dark50: DarkTheme.intent.allowed.bg,
    dark100: DarkTheme.intent.allowed.border,
    darkAccent: DarkTheme.intent.allowed.accent,
  },
  amber: {
    50: Palette.amber[50],
    100: Palette.amber[100],
    200: Palette.amber[200],
    400: Palette.amber[400],
    500: Palette.amber[500],
    600: Palette.amber[600],
    700: Palette.amber[700],
    dark50: DarkTheme.intent.warning.bg,
    dark100: DarkTheme.intent.warning.border,
    darkAccent: DarkTheme.intent.warning.accent,
  },
  purple: {
    50: Palette.violet[50],
    100: Palette.violet[100],
    200: Palette.violet[200],
    300: Palette.violet[300],
    400: Palette.violet[400],
    500: Palette.violet[500],
    600: Palette.violet[600],
    700: Palette.violet[700],
    dark50: DarkTheme.intent.focus.bg,
    dark100: DarkTheme.intent.focus.border,
  },
} as const;
