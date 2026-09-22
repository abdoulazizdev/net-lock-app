/**
 * notification-guard.service.ts
 * Wrapper JS autour de NotificationGuardModule (natif Kotlin).
 *
 * Le problème qu'il règle : couper le réseau d'une application ne l'empêche
 * pas de sonner. Une notification push est livrée aux Services Google Play,
 * qui la remettent à l'app par un canal local — le tunnel VPN n'est jamais sur
 * ce chemin. Seul l'accès aux notifications d'Android permet de la retirer.
 */
import { NativeModules, Platform } from "react-native";

const { NotificationGuardModule } = NativeModules;

export interface NotificationGuardState {
  /** Accès aux notifications accordé dans les réglages Android. */
  granted: boolean;
  /** Interrupteur NetOff — l'utilisateur garde la main. */
  enabled: boolean;
  /** Notifications masquées depuis la dernière remise à zéro. */
  suppressed: number;
}

const UNAVAILABLE: NotificationGuardState = {
  granted: false,
  enabled: false,
  suppressed: 0,
};

class NotificationGuardService {
  /** Le garde n'existe que sur Android. */
  isSupported(): boolean {
    return Platform.OS === "android" && !!NotificationGuardModule;
  }

  async getState(): Promise<NotificationGuardState> {
    if (!this.isSupported()) return UNAVAILABLE;
    try {
      const state = await NotificationGuardModule.getState();
      return {
        granted: !!state?.granted,
        enabled: !!state?.enabled,
        suppressed: Number(state?.suppressed ?? 0),
      };
    } catch {
      return UNAVAILABLE;
    }
  }

  /** Active ou coupe le garde. Sans l'accès Android, il reste sans effet. */
  async setEnabled(enabled: boolean): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await NotificationGuardModule.setEnabled(enabled);
      return true;
    } catch {
      return false;
    }
  }

  /** Ouvre l'écran Android « Accès aux notifications » : aucune API ne le demande. */
  async openAccessSettings(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await NotificationGuardModule.openAccessSettings();
      return true;
    } catch {
      return false;
    }
  }

  async resetStats(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      await NotificationGuardModule.resetStats();
    } catch {}
  }
}

export default new NotificationGuardService();
