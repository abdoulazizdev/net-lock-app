/**
 * types/index.ts — Modèle de données de NetOff
 *
 * Ces formes sont celles réellement persistées (AsyncStorage) et échangées
 * avec les modules natifs. Elles ne changent pas sans migration : des
 * installations existantes contiennent déjà ces objets.
 *
 * Convention des jours de la semaine : 0 = dimanche, comme `Date.getDay()`.
 */

// ─── Applications ────────────────────────────────────────────────────────────

/** Application lue depuis le PackageManager Android. */
export interface InstalledApp {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
  /** Icône encodée en base64, absente sur les chargements « légers ». */
  icon?: string | null;
  /** L'app possède une activité lançable depuis l'écran d'accueil. */
  isLaunchable?: boolean;
  /** L'app est activée. Une app désactivée n'accède plus au réseau. */
  isEnabled?: boolean;
  /** Identifiant d'utilisateur Android (profils multiples). */
  userId?: number;
  /** L'app appartient à un profil professionnel. */
  isWorkProfile?: boolean;
}

// ─── Règles ──────────────────────────────────────────────────────────────────

/**
 * Règle d'accès réseau pour une application.
 * L'absence de règle équivaut à « autorisée ».
 */
export interface AppRule {
  packageName: string;
  isBlocked: boolean;
  /** Profil d'origine, lorsque la règle vient de l'activation d'un profil. */
  profileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Planifications ──────────────────────────────────────────────────────────

/**
 * Créneau appliqué à une application précise.
 * `endHour` inférieur à `startHour` signifie un créneau à cheval sur minuit.
 */
export interface Schedule {
  id: string;
  packageName: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  days: number[];
  isActive: boolean;
  action: "block" | "allow";
}

/** Créneau qui active ou met en pause un profil entier. */
export interface ProfileSchedule {
  id: string;
  label: string;
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  isActive: boolean;
  action: "activate" | "deactivate";
}

// ─── Profils ─────────────────────────────────────────────────────────────────

/**
 * Jeu de règles nommé. Un seul profil est actif à la fois — c'est lui qui
 * détermine les règles appliquées et les alarmes programmées.
 */
export interface Profile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  rules: AppRule[];
  schedules: ProfileSchedule[];
  createdAt: Date;
}

// ─── Statistiques ────────────────────────────────────────────────────────────

/** Compteurs par application, tenus côté JS (complémentaires du journal natif). */
export interface AppStats {
  packageName: string;
  blockedAttempts: number;
  allowedAttempts: number;
  lastAttempt?: Date;
  lastUpdated?: Date;
}

// ─── Sécurité ────────────────────────────────────────────────────────────────

/** Configuration du verrouillage de l'application. */
export interface AuthConfig {
  isPinEnabled: boolean;
  isBiometricEnabled: boolean;
  /** Présent uniquement en lecture depuis le stockage sécurisé. */
  pin?: string;
}
