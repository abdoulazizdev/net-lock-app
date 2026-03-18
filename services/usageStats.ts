import { NativeModules } from "react-native";

const { UsageStatsModule } = NativeModules;

export const openUsageAccessSettings = () => {
  UsageStatsModule.openUsageAccessSettings();
};

export const getUsageStats = async () => {
  try {
    const data = await UsageStatsModule.getUsageStats();
    return data;
  } catch (e) {
    console.log(e);
    return [];
  }
};
