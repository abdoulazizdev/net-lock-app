import { NativeModules, Platform } from "react-native";
import { InstalledApp } from "../types";

const { AppListModule } = NativeModules;

class AppListService {
  async getInstalledApps(): Promise<InstalledApp[]> {
    try {
      if (Platform.OS === "android" && AppListModule) {
        const apps = await AppListModule.getInstalledApps();
        return apps.map((app: any) => ({
          packageName: app.packageName,
          appName: app.appName,
          isSystemApp: app.isSystemApp ?? false,
          icon: app.icon ?? null,
        }));
      }
      return this.getMockApps();
    } catch (error) {
      console.error("Erreur récupération apps:", error);
      return this.getMockApps();
    }
  }

  async getAppByPackage(packageName: string): Promise<InstalledApp | null> {
    const apps = await this.getInstalledApps();
    return apps.find((app) => app.packageName === packageName) || null;
  }

  async getNonSystemApps(): Promise<InstalledApp[]> {
    const apps = await this.getInstalledApps();
    return apps.filter((app) => !app.isSystemApp);
  }

  async searchApps(query: string): Promise<InstalledApp[]> {
    const apps = await this.getInstalledApps();
    const lowerQuery = query.toLowerCase();
    return apps.filter(
      (app) =>
        app.appName.toLowerCase().includes(lowerQuery) ||
        app.packageName.toLowerCase().includes(lowerQuery),
    );
  }

  private getMockApps(): InstalledApp[] {
    return [
      {
        packageName: "com.android.chrome",
        appName: "Chrome",
        isSystemApp: false,
      },
      {
        packageName: "com.facebook.katana",
        appName: "Facebook",
        isSystemApp: false,
      },
      {
        packageName: "com.instagram.android",
        appName: "Instagram",
        isSystemApp: false,
      },
      { packageName: "com.whatsapp", appName: "WhatsApp", isSystemApp: false },
      {
        packageName: "com.twitter.android",
        appName: "Twitter",
        isSystemApp: false,
      },
      {
        packageName: "com.spotify.music",
        appName: "Spotify",
        isSystemApp: false,
      },
      {
        packageName: "com.google.android.youtube",
        appName: "YouTube",
        isSystemApp: false,
      },
      {
        packageName: "com.netflix.mediaclient",
        appName: "Netflix",
        isSystemApp: false,
      },
      {
        packageName: "com.snapchat.android",
        appName: "Snapchat",
        isSystemApp: false,
      },
      { packageName: "com.tiktok", appName: "TikTok", isSystemApp: false },
      {
        packageName: "com.android.settings",
        appName: "Paramètres",
        isSystemApp: true,
      },
      {
        packageName: "com.android.vending",
        appName: "Play Store",
        isSystemApp: true,
      },
    ];
  }
}

export default new AppListService();
