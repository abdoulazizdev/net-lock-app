/**
 * in-app-update.service.ts
 * Wrapper JS pour InAppUpdateModule (Google Play In-App Updates).
 *
 * Flux recommandé par Google :
 *
 *   Au démarrage de l'app :
 *     1. checkForUpdate()      → retourne { updateAvailable, priority, staleDays }
 *     2. Si priority >= 4      → startImmediateUpdate() (obligatoire)
 *        Si staleDays >= 7     → startFlexibleUpdate()  (discret)
 *        Sinon                 → rien (ne pas être intrusif)
 *
 *   Si flexible update en attente (téléchargée mais pas installée) :
 *     → L'event "update:downloaded" est émis
 *     → Afficher un snackbar "Mise à jour prête — Relancer ?"
 *     → Si accepté : completeFlexibleUpdate() → redémarrage automatique
 */
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

const { InAppUpdateModule } = NativeModules;

export interface UpdateInfo {
  updateAvailable: boolean;
  priority: number; // 0-5, 5 = critique
  staleDays: number; // jours depuis dispo
  availableVersionCode: number;
  flexibleAllowed: boolean;
  immediateAllowed: boolean;
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "installed"
  | "failed";

export interface UpdateProgress {
  status: UpdateStatus;
  bytesDownloaded: number;
  totalBytes: number;
  percentComplete: number;
}

type UpdateListener = (info: UpdateInfo) => void;
type ProgressListener = (progress: UpdateProgress) => void;
type SimpleListener = () => void;

class InAppUpdateService {
  private _listeners: {
    onAvailable: UpdateListener[];
    onProgress: ProgressListener[];
    onDownloaded: SimpleListener[];
    onInstalled: SimpleListener[];
    onFailed: SimpleListener[];
  } = {
    onAvailable: [],
    onProgress: [],
    onDownloaded: [],
    onInstalled: [],
    onFailed: [],
  };

  constructor() {
    if (Platform.OS !== "android" || !InAppUpdateModule) return;

    DeviceEventEmitter.addListener("update:available", (info: UpdateInfo) => {
      this._listeners.onAvailable.forEach((l) => l(info));
    });

    DeviceEventEmitter.addListener("update:progress", (raw: any) => {
      const total = raw.totalBytes || 1;
      const progress: UpdateProgress = {
        status: raw.status,
        bytesDownloaded: raw.bytesDownloaded,
        totalBytes: raw.totalBytes,
        percentComplete: Math.round((raw.bytesDownloaded / total) * 100),
      };
      this._listeners.onProgress.forEach((l) => l(progress));
    });

    DeviceEventEmitter.addListener("update:downloaded", () => {
      this._listeners.onDownloaded.forEach((l) => l());
    });

    DeviceEventEmitter.addListener("update:installed", () => {
      this._listeners.onInstalled.forEach((l) => l());
    });

    DeviceEventEmitter.addListener("update:failed", () => {
      this._listeners.onFailed.forEach((l) => l());
    });
  }

  // ── API ───────────────────────────────────────────────────────────────────

  /**
   * Vérifie si une mise à jour est disponible.
   * Ne rien afficher si updateAvailable = false.
   */
  async checkForUpdate(): Promise<UpdateInfo | null> {
    if (Platform.OS !== "android" || !InAppUpdateModule) return null;
    try {
      return await InAppUpdateModule.checkForUpdate();
    } catch (e) {
      console.warn("InAppUpdateService.checkForUpdate:", e);
      return null;
    }
  }

  /**
   * Vérifie si une mise à jour flexible est déjà téléchargée (en attente).
   * À appeler au démarrage de l'app pour détecter les installations en attente.
   */
  async checkDownloadedUpdate(): Promise<boolean> {
    if (Platform.OS !== "android" || !InAppUpdateModule) return false;
    try {
      return await InAppUpdateModule.checkDownloadedUpdate();
    } catch {
      return false;
    }
  }

  /**
   * Démarre une mise à jour flexible (téléchargement en arrière-plan).
   * L'utilisateur peut continuer à utiliser l'app.
   */
  async startFlexibleUpdate(): Promise<boolean> {
    if (Platform.OS !== "android" || !InAppUpdateModule) return false;
    try {
      return await InAppUpdateModule.startFlexibleUpdate();
    } catch (e) {
      console.warn("startFlexibleUpdate:", e);
      return false;
    }
  }

  /**
   * Démarre une mise à jour immédiate (plein écran obligatoire).
   * Réservé aux mises à jour critiques (priority >= 4).
   */
  async startImmediateUpdate(): Promise<boolean> {
    if (Platform.OS !== "android" || !InAppUpdateModule) return false;
    try {
      return await InAppUpdateModule.startImmediateUpdate();
    } catch (e) {
      console.warn("startImmediateUpdate:", e);
      return false;
    }
  }

  /**
   * Lance l'installation d'une mise à jour flexible téléchargée.
   * L'app se relance automatiquement après installation.
   */
  async completeFlexibleUpdate(): Promise<void> {
    if (Platform.OS !== "android" || !InAppUpdateModule) return;
    try {
      await InAppUpdateModule.completeFlexibleUpdate();
    } catch (e) {
      console.warn("completeFlexibleUpdate:", e);
    }
  }

  /**
   * Logique de décision recommandée par Google :
   *   - Priority 5 ou staleDays >= 21  → IMMEDIATE (obligatoire)
   *   - Priority >= 3 ou staleDays >= 7 → FLEXIBLE (discret)
   *   - Sinon                           → ne rien faire (pas intrusif)
   */
  async handleUpdateIfAvailable(): Promise<"immediate" | "flexible" | "none"> {
    const info = await this.checkForUpdate();
    if (!info?.updateAvailable) return "none";

    if (info.priority >= 5 || info.staleDays >= 21) {
      if (info.immediateAllowed) {
        await this.startImmediateUpdate();
        return "immediate";
      }
    }
    if (info.priority >= 3 || info.staleDays >= 7) {
      if (info.flexibleAllowed) {
        await this.startFlexibleUpdate();
        return "flexible";
      }
    }
    return "none";
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  onAvailable(fn: UpdateListener) {
    this._listeners.onAvailable.push(fn);
  }
  onProgress(fn: ProgressListener) {
    this._listeners.onProgress.push(fn);
  }
  onDownloaded(fn: SimpleListener) {
    this._listeners.onDownloaded.push(fn);
  }
  onInstalled(fn: SimpleListener) {
    this._listeners.onInstalled.push(fn);
  }
  onFailed(fn: SimpleListener) {
    this._listeners.onFailed.push(fn);
  }
}

export default new InAppUpdateService();
