/**
 * lib/format.ts — Formatage de texte et de nombres
 *
 * Toute la mise en forme visible passe par ici : accords au pluriel, durées,
 * dates relatives. Dupliquer un `${n} app${n > 1 ? "s" : ""}` dans chaque
 * écran finit toujours par produire des incohérences.
 */

const DAY_NAMES_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_NAMES_INITIAL = ["D", "L", "M", "M", "J", "V", "S"];

// ─── Pluriel ─────────────────────────────────────────────────────────────────

/**
 * Accorde un mot et le préfixe du nombre.
 *   plural(1, "app")            → "1 app"
 *   plural(3, "app")            → "3 apps"
 *   plural(2, "bloquée")        → "2 bloquées"
 *   plural(0, "profil", "profils") → "0 profil"
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count > 1 ? (pluralForm ?? `${singular}s`) : singular;
  return `${count} ${word}`;
}

// ─── Durées ──────────────────────────────────────────────────────────────────

/**
 * Durée lisible à partir de minutes.
 *   humanMinutes(45)   → "45 min"
 *   humanMinutes(90)   → "1 h 30"
 *   humanMinutes(120)  → "2 h"
 *   humanMinutes(1500) → "1 j 1 h"
 */
export function humanMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  if (hours < 24) return rest > 0 ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days} j ${restHours} h` : `${days} j`;
}

/**
 * Compte à rebours depuis des millisecondes : `M:SS` ou `H:MM:SS`.
 * Arrondi au supérieur pour que l'affichage n'atteigne 0 qu'à la fin réelle.
 */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Découpe un compte à rebours pour un affichage en gros chiffres. */
export function countdownParts(ms: number): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Heure sur 24 h : `hourMinute(9, 5)` → "09:05". */
export function hourMinute(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** Date relative courte : « À l'instant », « Il y a 12 min », « Hier », « 4 mars ». */
export function relativeTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Hier";
  if (diffD < 7) return `Il y a ${diffD} jours`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Libellé de jour : « Aujourd'hui », « Hier », sinon « lundi 4 mars ». */
export function dayLabel(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Heure locale courte : "14:32". */
export function clockTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Jours de la semaine ─────────────────────────────────────────────────────
// Convention : 0 = dimanche, comme `Date.getDay()`.

export const WEEKDAYS_INITIAL = DAY_NAMES_INITIAL;
export const WEEKDAYS_SHORT = DAY_NAMES_SHORT;

/**
 * Résume une sélection de jours.
 *   daysLabel([1,2,3,4,5])       → "En semaine"
 *   daysLabel([0,6])             → "Week-end"
 *   daysLabel([0,1,2,3,4,5,6])   → "Tous les jours"
 *   daysLabel([1,3])             → "Lun, Mer"
 */
export function daysLabel(days: number[]): string {
  if (days.length === 0) return "Aucun jour";
  const set = new Set(days);
  if (set.size === 7) return "Tous les jours";
  const isWeekdays = [1, 2, 3, 4, 5].every((d) => set.has(d)) && set.size === 5;
  if (isWeekdays) return "En semaine";
  const isWeekend = set.has(0) && set.has(6) && set.size === 2;
  if (isWeekend) return "Week-end";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES_SHORT[d])
    .join(", ");
}

// ─── Nombres ─────────────────────────────────────────────────────────────────

/** Pourcentage entier, borné à [0, 100]. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

/** Taille de fichier lisible. */
export function fileSize(bytes: number): string {
  if (bytes <= 0) return "—";
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0).replace(".", ",")} ${units[unit]}`;
}
