/**
 * Service de récupération de la liste des applications installées
 * Utilise un module natif sur Android, simulé sur autres plateformes
 */

import { NativeModules, Platform } from 'react-native';
import { InstalledApp } from '../types';

interface AppListNativeModule {
  getInstalledApps: () => Promise<InstalledApp[]>;
}

class AppListService {
  private nativeModule: AppListNativeModule | null = null;

  constructor() {
    if (Platform.OS === 'android' && NativeModules.AppListModule) {
      this.nativeModule = NativeModules.AppListModule as AppListNativeModule;
      console.log('✅ Module liste d\'apps natif détecté');
    } else {
      console.log('⚠️ Mode simulation liste d\'apps');
    }
  }

  /**
   * Récupère la liste des applications installées
   */
  async getInstalledApps(): Promise<InstalledApp[]> {
    try {
      if (this.nativeModule) {
        // Utilise le module natif
        return await this.nativeModule.getInstalledApps();
      } else {
        // Mode simulation avec des apps fictives
        return this.getMockApps();
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des apps:', error);
      return this.getMockApps();
    }
  }

  /**
   * Récupère une app spécifique par package name
   */
  async getAppByPackage(packageName: string): Promise<InstalledApp | null> {
    const apps = await this.getInstalledApps();
    return apps.find(app => app.packageName === packageName) || null;
  }

  /**
   * Filtre les apps système
   */
  async getNonSystemApps(): Promise<InstalledApp[]> {
    const apps = await this.getInstalledApps();
    return apps.filter(app => !app.isSystemApp);
  }

  /**
   * Recherche des apps par nom
   */
  async searchApps(query: string): Promise<InstalledApp[]> {
    const apps = await this.getInstalledApps();
    const lowerQuery = query.toLowerCase();
    
    return apps.filter(app => 
      app.appName.toLowerCase().includes(lowerQuery) ||
      app.packageName.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Apps de démonstration pour le mode simulation
   */
  private getMockApps(): InstalledApp[] {
    return [
      {
        packageName: 'com.android.chrome',
        appName: 'Chrome',
        isSystemApp: false,
      },
      {
        packageName: 'com.facebook.katana',
        appName: 'Facebook',
        isSystemApp: false,
      },
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        isSystemApp: false,
      },
      {
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        isSystemApp: false,
      },
      {
        packageName: 'com.twitter.android',
        appName: 'Twitter',
        isSystemApp: false,
      },
      {
        packageName: 'com.spotify.music',
        appName: 'Spotify',
        isSystemApp: false,
      },
      {
        packageName: 'com.google.android.youtube',
        appName: 'YouTube',
        isSystemApp: false,
      },
      {
        packageName: 'com.netflix.mediaclient',
        appName: 'Netflix',
        isSystemApp: false,
      },
      {
        packageName: 'com.snapchat.android',
        appName: 'Snapchat',
        isSystemApp: false,
      },
      {
        packageName: 'com.tiktok',
        appName: 'TikTok',
        isSystemApp: false,
      },
      {
        packageName: 'com.android.settings',
        appName: 'Paramètres',
        isSystemApp: true,
      },
      {
        packageName: 'com.android.vending',
        appName: 'Play Store',
        isSystemApp: true,
      },
    ];
  }
}

export default new AppListService();