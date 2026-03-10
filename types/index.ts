/**
 * Types principaux de l'application
 */

export interface InstalledApp {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
  icon?: string | null; // base64 sur Android
}

export interface AppRule {
  packageName: string;
  isBlocked: boolean;
  profileId?: string;
  schedules?: Schedule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Schedule {
  id: string;
  dayOfWeek: number[]; // 0 = dimanche, 6 = samedi
  startTime: string; // format HH:mm
  endTime: string; // format HH:mm
  isBlocked: boolean;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  rules: AppRule[];
  createdAt: Date;
}

export interface AppStats {
  packageName: string;
  blockedAttempts: number;
  allowedAttempts: number;
  lastAttempt?: Date;
}

export interface AuthConfig {
  isPinEnabled: boolean;
  isBiometricEnabled: boolean;
  pin?: string; // Hash du PIN
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  AppDetail: { packageName: string };
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Profiles: undefined;
  Stats: undefined;
};
