import Constants from "expo-constants";
import * as Device from "expo-device";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export interface AppInfo {
  // Identité
  appName: string;
  bundleId: string;

  // Version
  version: string; // ex: "1.0.0"
  buildNumber: string; // ex: "42"
  fullVersion: string; // ex: "1.0.0 (42)"

  // Appareil
  deviceName: string | null;
  deviceModel: string | null;
  osName: string;
  osVersion: string;

  // Environnement
  isDevice: boolean;
  platform: "ios" | "android" | "web";

  // État
  loading: boolean;
}

export function useAppInfo(): AppInfo {
  const [info, setInfo] = useState<AppInfo>({
    appName: "NetOff",
    bundleId: "",
    version: "—",
    buildNumber: "—",
    fullVersion: "—",
    deviceName: null,
    deviceModel: null,
    osName: Platform.OS,
    osVersion: "—",
    isDevice: false,
    platform: Platform.OS as "ios" | "android" | "web",
    loading: true,
  });

  useEffect(() => {
    // Constants.expoConfig is available in all Expo environments (managed + bare)
    const expoConfig = Constants.expoConfig ?? Constants.manifest;
    const version = (expoConfig as any)?.version ?? "—";
    // buildNumber (iOS) / versionCode (Android) stored under ios/android in config
    const buildNumber =
      Platform.OS === "ios"
        ? String((expoConfig as any)?.ios?.buildNumber ?? "—")
        : String((expoConfig as any)?.android?.versionCode ?? "—");

    const appName =
      (expoConfig as any)?.name ?? Constants.deviceName ?? "NetOff";
    const bundleId =
      Platform.OS === "ios"
        ? ((expoConfig as any)?.ios?.bundleIdentifier ?? "")
        : ((expoConfig as any)?.android?.package ?? "");

    setInfo({
      appName,
      bundleId,
      version,
      buildNumber,
      fullVersion: `${version} (${buildNumber})`,
      deviceName: Device.deviceName ?? null,
      deviceModel: Device.modelName ?? null,
      osName: Device.osName ?? Platform.OS,
      osVersion: Device.osVersion ?? "—",
      isDevice: Device.isDevice ?? false,
      platform: Platform.OS as "ios" | "android" | "web",
      loading: false,
    });
  }, []);

  return info;
}
