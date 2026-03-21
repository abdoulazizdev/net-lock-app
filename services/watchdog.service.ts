import { NativeModules } from "react-native";
const { WatchdogModule } = NativeModules;

class WatchdogService {
  async start(): Promise<void> {
    try {
      if (WatchdogModule) await WatchdogModule.start();
    } catch (e) {
      console.warn("Watchdog start:", e);
    }
  }
  async stop(): Promise<void> {
    try {
      if (WatchdogModule) await WatchdogModule.stop();
    } catch (e) {
      console.warn("Watchdog stop:", e);
    }
  }
  async isRunning(): Promise<boolean> {
    try {
      return WatchdogModule ? await WatchdogModule.isRunning() : false;
    } catch {
      return false;
    }
  }
}
export default new WatchdogService();
