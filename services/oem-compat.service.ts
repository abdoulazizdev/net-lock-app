/**
 * oem-compat.service.ts
 * Wrapper JS autour d'OemCompatModule (natif Kotlin).
 * Fournit les infos OEM, le statut batterie et les helpers d'ouverture de paramètres.
 */
import { NativeModules, Platform } from "react-native";

const { OemCompatModule } = NativeModules;

export interface DeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  androidVersion: string;
  sdkInt: number;
  oem: OemType; // clé normalisée
  isBatteryOptimized: boolean; // true = on est dans la liste d'optimisation = mauvais
  hasAutoStartSetting: boolean; // true = l'appareil a un écran AutoStart dédié
}

export type OemType =
  | "huawei"
  | "xiaomi"
  | "oppo"
  | "vivo"
  | "samsung"
  | "sony"
  | "motorola"
  | "lenovo"
  | "asus"
  | "generic";

/** Labels et instructions par OEM — affichés dans l'UI */
export const OEM_GUIDANCE: Record<
  OemType,
  {
    name: string;
    batteryLabel: string;
    batterySteps: string[];
    autoStartLabel: string;
    autoStartSteps: string[];
    severity: "high" | "medium" | "low";
  }
> = {
  huawei: {
    name: "Huawei / Honor (EMUI)",
    severity: "high",
    batteryLabel: "Gestion du lancement des apps",
    batterySteps: [
      'Ouvrir "Gestionnaire du téléphone"',
      'Appuyer sur "Démarrage des applis"',
      'Trouver NetOff → désactiver "Gestion automatique"',
      'Activer "Démarrage automatique", "Démarrage secondaire", "Exécution en arrière-plan"',
    ],
    autoStartLabel: "Démarrage automatique (AutoStart)",
    autoStartSteps: [
      'Aller dans Paramètres → Apps → "NetOff"',
      'Appuyer sur "Batterie" → sélectionner "Aucune restriction"',
      'Revenir → activer "Démarrage automatique"',
    ],
  },
  xiaomi: {
    name: "Xiaomi / Redmi / POCO (MIUI)",
    severity: "high",
    batteryLabel: "Économiseur de batterie — Aucune restriction",
    batterySteps: [
      'Aller dans Paramètres → Apps → "NetOff" → Batterie',
      'Sélectionner "Aucune restriction" (pas Optimisé)',
      'Revenir → activer "AutoStart"',
    ],
    autoStartLabel: "AutoStart",
    autoStartSteps: [
      'Ouvrir "Sécurité" (Security Center)',
      'Aller dans "Gestion des autorisations" → "AutoStart"',
      "Activer NetOff",
    ],
  },
  oppo: {
    name: "Oppo / Realme / OnePlus (ColorOS)",
    severity: "high",
    batteryLabel: "Consommation d'énergie en arrière-plan",
    batterySteps: [
      'Paramètres → Batterie → "Consommation en arrière-plan"',
      'Trouver NetOff → sélectionner "Ne jamais mettre en veille"',
    ],
    autoStartLabel: "AutoStart (Démarrage automatique)",
    autoStartSteps: [
      'Paramètres → Gestion des applis → "NetOff"',
      'Activer "Démarrage automatique" et "Exécution en arrière-plan"',
    ],
  },
  vivo: {
    name: "Vivo / iQOO (FuntouchOS)",
    severity: "high",
    batteryLabel: "Arrière-plan élevé",
    batterySteps: [
      'iManager → App Manager → "NetOff"',
      'Activer "Autoriser l\'exécution en arrière-plan"',
    ],
    autoStartLabel: "Gestionnaire de démarrage",
    autoStartSteps: [
      'iManager → App Manager → "Start Up Manager"',
      "Activer NetOff dans la liste",
    ],
  },
  samsung: {
    name: "Samsung (OneUI)",
    severity: "medium",
    batteryLabel: "Utilisation de la batterie — Sans restriction",
    batterySteps: [
      'Paramètres → Batterie → "Utilisation de la batterie pour les applis"',
      'Trouver NetOff → sélectionner "Sans restriction"',
    ],
    autoStartLabel: "Non requis (OneUI)",
    autoStartSteps: [
      "Samsung est moins restrictif que d'autres OEM.",
      'Si le VPN se coupe, vérifiez Paramètres → DevCare → Batterie → "Plus de paramètres" → "Apps en veille".',
    ],
  },
  sony: {
    name: "Sony (Android stock)",
    severity: "low",
    batteryLabel: "STAMINA Mode — exception",
    batterySteps: [
      'Paramètres → Batterie → "STAMINA mode"',
      "Ajouter NetOff dans les exceptions si le mode est actif",
    ],
    autoStartLabel: "Non requis",
    autoStartSteps: [
      "Sony utilise Android proche du stock — peu de restrictions.",
    ],
  },
  motorola: {
    name: "Motorola",
    severity: "low",
    batteryLabel: "Batterie — Gestion",
    batterySteps: [
      "Paramètres → Apps → NetOff → Batterie",
      'Sélectionner "Sans restriction"',
    ],
    autoStartLabel: "Non requis",
    autoStartSteps: ["Motorola utilise Android proche du stock."],
  },
  lenovo: {
    name: "Lenovo",
    severity: "medium",
    batteryLabel: "Gestionnaire de la batterie",
    batterySteps: ["Security App → Pure Background → autoriser NetOff"],
    autoStartLabel: "Pure Background",
    autoStartSteps: [
      "Security App → Pure Background → autoriser NetOff en arrière-plan",
    ],
  },
  asus: {
    name: "Asus (ZenUI)",
    severity: "medium",
    batteryLabel: "Mobile Manager — AutoStart",
    batterySteps: [
      'Ouvrir "Mobile Manager" → AutoStart Manager',
      "Activer NetOff dans la liste",
    ],
    autoStartLabel: "AutoStart Manager",
    autoStartSteps: ["Mobile Manager → AutoStart Manager → activer NetOff"],
  },
  generic: {
    name: "Android standard",
    severity: "low",
    batteryLabel: "Optimisation de la batterie",
    batterySteps: [
      "Paramètres → Apps → NetOff → Batterie",
      'Sélectionner "Sans restriction" ou "Non optimisé"',
    ],
    autoStartLabel: "Non requis",
    autoStartSteps: [
      "Votre appareil utilise Android standard — peu de restrictions.",
    ],
  },
};

class OemCompatService {
  private _cachedInfo: DeviceInfo | null = null;

  async getDeviceInfo(): Promise<DeviceInfo | null> {
    if (Platform.OS !== "android") return null;
    if (this._cachedInfo) return this._cachedInfo;
    try {
      if (!OemCompatModule) return null;
      const info = await OemCompatModule.getDeviceInfo();
      this._cachedInfo = info as DeviceInfo;
      return this._cachedInfo;
    } catch (e) {
      console.warn("OemCompatService.getDeviceInfo:", e);
      return null;
    }
  }

  getGuidance(oem: OemType) {
    return OEM_GUIDANCE[oem] ?? OEM_GUIDANCE.generic;
  }

  async isBatteryOptimized(): Promise<boolean> {
    if (Platform.OS !== "android" || !OemCompatModule) return false;
    try {
      return await OemCompatModule.isBatteryOptimized();
    } catch {
      return false;
    }
  }

  /** Ouvre l'écran batterie/background le plus adapté à l'OEM */
  async openBatterySettings(): Promise<void> {
    if (!OemCompatModule) return;
    try {
      await OemCompatModule.openBatteryOptimizationSettings();
    } catch (e) {
      console.warn("openBatterySettings:", e);
    }
  }

  /** Ouvre l'écran AutoStart (Huawei/Xiaomi/Oppo/Vivo) */
  async openAutoStartSettings(): Promise<void> {
    if (!OemCompatModule) return;
    try {
      await OemCompatModule.openAutoStartSettings();
    } catch (e) {
      console.warn("openAutoStartSettings:", e);
    }
  }

  /** Demande la whitelist "ignorer optimisation batterie" Android standard */
  async requestIgnoreBatteryOptimization(): Promise<void> {
    if (!OemCompatModule) return;
    try {
      await OemCompatModule.requestIgnoreBatteryOptimization();
    } catch (e) {
      console.warn("requestIgnoreBatteryOptimization:", e);
    }
  }

  /** Ouvre les paramètres de notifications de l'app */
  async openNotificationSettings(): Promise<void> {
    if (!OemCompatModule) return;
    try {
      await OemCompatModule.openNotificationSettings();
    } catch (e) {
      console.warn("openNotificationSettings:", e);
    }
  }

  invalidateCache() {
    this._cachedInfo = null;
  }
}

export default new OemCompatService();
