declare module "react-native-installed-apps" {
  interface AppInfo {
    packageName: string;
    appName: string;
    isSystemApp: boolean;
    icon: string | null; // base64
  }

  const RNInstalledApps: {
    getApps(): Promise<AppInfo[]>;
    getNonSystemApps(): Promise<AppInfo[]>;
  };

  export default RNInstalledApps;
}
