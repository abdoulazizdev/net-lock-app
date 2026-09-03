/**
 * services/app-info.service.ts — Fiche détaillée d'une application
 *
 * Enveloppe typée d'`AppInfoModule` (Kotlin). Chaque appel est tolérant :
 * hors Android, ou si le module n'est pas enregistré, on renvoie `null` ou
 * `false` plutôt que de laisser une exception remonter dans l'interface.
 */

import { NativeModules, Platform } from "react-native";

const { AppInfoModule } = NativeModules;

export interface AppDetails {
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  isSystemApp: boolean;
  isEnabled: boolean;
  /** L'app possède une activité de lancement. */
  isLaunchable: boolean;
  notificationsEnabled: boolean;
  firstInstallTime: number;
  lastUpdateTime: number;
  apkSizeBytes: number;
  /** Permissions déclarées dans le manifeste de l'app. */
  permissions: string[];
  sourceDir: string;
}

const available = () => Platform.OS === "android" && !!AppInfoModule;

class AppInfoService {
  async getDetails(packageName: string): Promise<AppDetails | null> {
    if (!available()) return null;
    try {
      const raw = await AppInfoModule.getAppDetails(packageName);
      return {
        ...raw,
        permissions: Array.isArray(raw?.permissions) ? raw.permissions : [],
      } as AppDetails;
    } catch {
      return null;
    }
  }

  /** Ouvre la fiche système de l'app. */
  async openSettings(packageName: string): Promise<boolean> {
    return this.call(() => AppInfoModule.openAppSettings(packageName));
  }

  async openNotificationSettings(packageName: string): Promise<boolean> {
    return this.call(() => AppInfoModule.openNotificationSettings(packageName));
  }

  async openStorageSettings(packageName: string): Promise<boolean> {
    return this.call(() => AppInfoModule.openStorageSettings(packageName));
  }

  async launch(packageName: string): Promise<boolean> {
    return this.call(() => AppInfoModule.launchApp(packageName));
  }

  /** Déclenche la désinstallation — c'est le système qui confirme. */
  async uninstall(packageName: string): Promise<boolean> {
    return this.call(() => AppInfoModule.uninstallApp(packageName));
  }

  private async call(fn: () => Promise<unknown>): Promise<boolean> {
    if (!available()) return false;
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  }
}

/** Permissions considérées comme sensibles — mises en avant dans la fiche. */
const SENSITIVE_PERMISSIONS = new Set([
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.READ_CONTACTS",
  "android.permission.WRITE_CONTACTS",
  "android.permission.READ_SMS",
  "android.permission.SEND_SMS",
  "android.permission.READ_CALL_LOG",
  "android.permission.READ_PHONE_STATE",
  "android.permission.BODY_SENSORS",
  "android.permission.READ_CALENDAR",
  "android.permission.QUERY_ALL_PACKAGES",
  "android.permission.SYSTEM_ALERT_WINDOW",
]);

export function isSensitivePermission(permission: string): boolean {
  return SENSITIVE_PERMISSIONS.has(permission);
}

/** Dernier segment d'une permission : `…permission.CAMERA` → « CAMERA ». */
export function shortPermission(permission: string): string {
  return permission.split(".").pop() ?? permission;
}

export default new AppInfoService();
