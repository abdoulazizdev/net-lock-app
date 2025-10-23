/**
 * Service de gestion du stockage local
 * Gère les règles, profils, statistiques et configuration d'authentification
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppRule, AppStats, AuthConfig, Profile } from '../types';

const STORAGE_KEYS = {
  RULES: '@app_rules',
  PROFILES: '@profiles',
  STATS: '@app_stats',
  AUTH_CONFIG: '@auth_config',
  ACTIVE_PROFILE: '@active_profile',
};

class StorageService {
  // ============= RÈGLES =============
  
  async getRules(): Promise<AppRule[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RULES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erreur lors de la récupération des règles:', error);
      return [];
    }
  }

  async saveRule(rule: AppRule): Promise<void> {
    try {
      const rules = await this.getRules();
      const index = rules.findIndex(r => r.packageName === rule.packageName);
      
      if (index >= 0) {
        rules[index] = { ...rule, updatedAt: new Date() };
      } else {
        rules.push({ ...rule, createdAt: new Date(), updatedAt: new Date() });
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la règle:', error);
      throw error;
    }
  }

  async deleteRule(packageName: string): Promise<void> {
    try {
      const rules = await this.getRules();
      const filtered = rules.filter(r => r.packageName !== packageName);
      await AsyncStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Erreur lors de la suppression de la règle:', error);
      throw error;
    }
  }

  async getRuleByPackage(packageName: string): Promise<AppRule | null> {
    const rules = await this.getRules();
    return rules.find(r => r.packageName === packageName) || null;
  }

  // ============= PROFILS =============

  async getProfiles(): Promise<Profile[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erreur lors de la récupération des profils:', error);
      return [];
    }
  }

  async saveProfile(profile: Profile): Promise<void> {
    try {
      const profiles = await this.getProfiles();
      const index = profiles.findIndex(p => p.id === profile.id);
      
      if (index >= 0) {
        profiles[index] = profile;
      } else {
        profiles.push(profile);
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du profil:', error);
      throw error;
    }
  }

  async deleteProfile(profileId: string): Promise<void> {
    try {
      const profiles = await this.getProfiles();
      const filtered = profiles.filter(p => p.id !== profileId);
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Erreur lors de la suppression du profil:', error);
      throw error;
    }
  }

  async getActiveProfile(): Promise<Profile | null> {
    try {
      const profileId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
      if (!profileId) return null;
      
      const profiles = await this.getProfiles();
      return profiles.find(p => p.id === profileId) || null;
    } catch (error) {
      console.error('Erreur lors de la récupération du profil actif:', error);
      return null;
    }
  }

  async setActiveProfile(profileId: string | null): Promise<void> {
    try {
      if (profileId) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
      }
    } catch (error) {
      console.error('Erreur lors de la définition du profil actif:', error);
      throw error;
    }
  }

  // ============= STATISTIQUES =============

  async getStats(): Promise<AppStats[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erreur lors de la récupération des stats:', error);
      return [];
    }
  }

  async incrementStat(packageName: string, type: 'blocked' | 'allowed'): Promise<void> {
    try {
      const stats = await this.getStats();
      let stat = stats.find(s => s.packageName === packageName);
      
      if (!stat) {
        stat = {
          packageName,
          blockedAttempts: 0,
          allowedAttempts: 0,
        };
        stats.push(stat);
      }
      
      if (type === 'blocked') {
        stat.blockedAttempts++;
      } else {
        stat.allowedAttempts++;
      }
      
      stat.lastAttempt = new Date();
      
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (error) {
      console.error('Erreur lors de la mise à jour des stats:', error);
    }
  }

  async clearStats(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.STATS);
    } catch (error) {
      console.error('Erreur lors de la suppression des stats:', error);
      throw error;
    }
  }

  // ============= AUTHENTIFICATION =============

  async getAuthConfig(): Promise<AuthConfig> {
    try {
      const pin = await SecureStore.getItemAsync('user_pin');
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_CONFIG);
      const config = data ? JSON.parse(data) : {};
      
      return {
        isPinEnabled: !!pin,
        isBiometricEnabled: config.isBiometricEnabled || false,
        pin: pin || undefined,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de la config auth:', error);
      return {
        isPinEnabled: false,
        isBiometricEnabled: false,
      };
    }
  }

  async savePin(pin: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('user_pin', pin);
      await this.updateAuthConfig({ isPinEnabled: true });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du PIN:', error);
      throw error;
    }
  }

  async verifyPin(pin: string): Promise<boolean> {
    try {
      const storedPin = await SecureStore.getItemAsync('user_pin');
      return storedPin === pin;
    } catch (error) {
      console.error('Erreur lors de la vérification du PIN:', error);
      return false;
    }
  }

  async updateAuthConfig(partial: Partial<AuthConfig>): Promise<void> {
    try {
      const current = await this.getAuthConfig();
      const updated = { ...current, ...partial };
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_CONFIG, JSON.stringify(updated));
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la config auth:', error);
      throw error;
    }
  }

  // ============= EXPORT / IMPORT =============

  async exportData(): Promise<string> {
    try {
      const rules = await this.getRules();
      const profiles = await this.getProfiles();
      const stats = await this.getStats();
      
      const data = {
        rules,
        profiles,
        stats,
        exportDate: new Date().toISOString(),
        version: '1.0',
      };
      
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      throw error;
    }
  }

  async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      
      if (data.rules) {
        await AsyncStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(data.rules));
      }
      if (data.profiles) {
        await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(data.profiles));
      }
      if (data.stats) {
        await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(data.stats));
      }
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      throw error;
    }
  }
}

export default new StorageService();