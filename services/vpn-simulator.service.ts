/**
 * Service de simulation VPN pour le prototype Expo
 * En production, ce service sera remplacé par le module natif Android
 */

import { NativeModules, Platform } from 'react-native';
import StorageService from './storage.service';

// Interface du module natif (sera implémenté en Kotlin)
interface VpnNativeModule {
  startVpn: () => Promise<boolean>;
  stopVpn: () => Promise<boolean>;
  setRule: (packageName: string, isBlocked: boolean) => Promise<void>;
  isVpnActive: () => Promise<boolean>;
}

class VpnSimulatorService {
  private isActive: boolean = false;
  private nativeModule: VpnNativeModule | null = null;

  constructor() {
    // Tente de charger le module natif si disponible
    if (Platform.OS === 'android' && NativeModules.VpnControlModule) {
      this.nativeModule = NativeModules.VpnControlModule as VpnNativeModule;
      console.log('✅ Module VPN natif détecté');
    } else {
      console.log('⚠️ Mode simulation VPN (pas de module natif)');
    }
  }

  /**
   * Démarre le service VPN
   */
  async startVpn(): Promise<boolean> {
    try {
      if (this.nativeModule) {
        // Utilise le module natif si disponible
        const result = await this.nativeModule.startVpn();
        this.isActive = result;
        return result;
      } else {
        // Mode simulation
        console.log('🔄 Simulation: Démarrage du VPN');
        this.isActive = true;
        await this.syncRules();
        return true;
      }
    } catch (error) {
      console.error('Erreur lors du démarrage du VPN:', error);
      return false;
    }
  }

  /**
   * Arrête le service VPN
   */
  async stopVpn(): Promise<boolean> {
    try {
      if (this.nativeModule) {
        const result = await this.nativeModule.stopVpn();
        this.isActive = !result;
        return result;
      } else {
        console.log('🔄 Simulation: Arrêt du VPN');
        this.isActive = false;
        return true;
      }
    } catch (error) {
      console.error('Erreur lors de l\'arrêt du VPN:', error);
      return false;
    }
  }

  /**
   * Vérifie si le VPN est actif
   */
  async isVpnActive(): Promise<boolean> {
    try {
      if (this.nativeModule) {
        return await this.nativeModule.isVpnActive();
      }
      return this.isActive;
    } catch (error) {
      console.error('Erreur lors de la vérification du VPN:', error);
      return false;
    }
  }

  /**
   * Applique une règle de blocage/autorisation pour une app
   */
  async setRule(packageName: string, isBlocked: boolean): Promise<void> {
    try {
      if (this.nativeModule) {
        await this.nativeModule.setRule(packageName, isBlocked);
      } else {
        console.log(`🔄 Simulation: ${isBlocked ? 'Blocage' : 'Autorisation'} de ${packageName}`);
      }

      // Sauvegarde la règle dans le stockage
      const existingRule = await StorageService.getRuleByPackage(packageName);
      await StorageService.saveRule({
        packageName,
        isBlocked,
        profileId: existingRule?.profileId,
        schedules: existingRule?.schedules,
        createdAt: existingRule?.createdAt || new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Erreur lors de l\'application de la règle:', error);
      throw error;
    }
  }

  /**
   * Synchronise toutes les règles avec le VPN
   */
  async syncRules(): Promise<void> {
    try {
      const rules = await StorageService.getRules();
      
      for (const rule of rules) {
        if (this.shouldApplyRule(rule)) {
          await this.setRule(rule.packageName, rule.isBlocked);
        }
      }

      console.log(`✅ ${rules.length} règle(s) synchronisée(s)`);
    } catch (error) {
      console.error('Erreur lors de la synchronisation des règles:', error);
      throw error;
    }
  }

  /**
   * Détermine si une règle doit être appliquée selon les horaires
   */
  private shouldApplyRule(rule: any): boolean {
    if (!rule.schedules || rule.schedules.length === 0) {
      return true; // Pas de restriction horaire
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const schedule of rule.schedules) {
      // Vérifie si le jour actuel est dans la plage
      if (schedule.dayOfWeek.includes(currentDay)) {
        // Vérifie si l'heure actuelle est dans la plage
        if (currentTime >= schedule.startTime && currentTime <= schedule.endTime) {
          return schedule.isBlocked;
        }
      }
    }

    return !rule.isBlocked; // Inverse par défaut hors horaires
  }

  /**
   * Simule une tentative de connexion (pour les statistiques)
   */
  async simulateConnectionAttempt(packageName: string): Promise<'blocked' | 'allowed'> {
    const rule = await StorageService.getRuleByPackage(packageName);
    
    if (!rule || !rule.isBlocked) {
      await StorageService.incrementStat(packageName, 'allowed');
      return 'allowed';
    } else {
      await StorageService.incrementStat(packageName, 'blocked');
      return 'blocked';
    }
  }

  /**
   * Obtient le statut du service
   */
  getStatus(): {
    isActive: boolean;
    isNative: boolean;
    platform: string;
  } {
    return {
      isActive: this.isActive,
      isNative: this.nativeModule !== null,
      platform: Platform.OS,
    };
  }
}

export default new VpnSimulatorService();