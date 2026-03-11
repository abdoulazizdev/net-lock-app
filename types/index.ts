export interface InstalledApp {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
  icon?: string | null;
}

export interface AppRule {
  packageName: string;
  isBlocked: boolean;
  profileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Schedule {
  id: string;
  packageName: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  days: number[]; // 0=Dim, 1=Lun, ..., 6=Sam
  isActive: boolean;
  action: "block" | "allow";
}

export interface ProfileSchedule {
  id: string;
  label: string;
  days: number[]; // 0=Dim, 1=Lun, ..., 6=Sam
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  isActive: boolean;
  action: "activate" | "deactivate"; // active ou désactive le profil
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  rules: AppRule[];
  schedules: ProfileSchedule[];
  createdAt: Date;
}

export interface AppStats {
  packageName: string;
  blockedAttempts: number;
  allowedAttempts: number;
  lastAttempt?: Date;
  lastUpdated?: Date;
}

export interface AuthConfig {
  isPinEnabled: boolean;
  isBiometricEnabled: boolean;
  pin?: string;
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
