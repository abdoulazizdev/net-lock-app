import { Alert, NativeModules, Platform } from "react-native";
import StorageService from "./storage.service";

const { VpnModule, AppBlockModule, WidgetSyncModule } = NativeModules;

class VpnService {
  async startVpn(): Promise<boolean> {
    try {
      if (!VpnModule) {
        console.warn("VpnModule non disponible");
        return false;
      }
      const result = await VpnModule.startVpn();
      await this.syncRules();
      // Sync widget
      WidgetSyncModule?.updateVpnState(true);
      return result;
    } catch (error) {
      console.error("Erreur startVpn:", error);
      return false;
    }
  }

  async stopVpn(): Promise<void> {
    try {
      if (VpnModule) await VpnModule.stopVpn();
      WidgetSyncModule?.updateVpnState(false);
    } catch (error) {
      console.error("Erreur stopVpn:", error);
    }
  }

  async isVpnActive(): Promise<boolean> {
    try {
      if (!VpnModule) return false;
      return await VpnModule.isVpnActive();
    } catch {
      return false;
    }
  }

  async setRule(packageName: string, isBlocked: boolean): Promise<void> {
    try {
      await StorageService.saveRule({
        packageName,
        isBlocked,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.syncRules();

      // Mettre à jour le compteur dans le widget
      const rules = await StorageService.getRules();
      const blockedCount = rules.filter((r) => r.isBlocked).length;
      WidgetSyncModule?.updateBlockedCount(blockedCount);

      if (isBlocked && AppBlockModule) {
        Alert.alert(
          "Bloquer les notifications ?",
          "Le trafic réseau est bloqué. Pour bloquer aussi les notifications (ex: WhatsApp), désactivez-les dans les paramètres Android.",
          [
            { text: "Ignorer", style: "cancel" },
            {
              text: "Désactiver les notifications",
              onPress: () =>
                AppBlockModule.disableAppNotifications(packageName),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Erreur setRule:", error);
    }
  }

  getStatus(): { isActive: boolean; isNative: boolean; platform: string } {
    return { isActive: false, isNative: !!VpnModule, platform: Platform.OS };
  }

  async syncRules(): Promise<void> {
    if (!VpnModule) return;
    const rules = await StorageService.getRules();
    const blockedPackages = rules
      .filter((r) => r.isBlocked)
      .map((r) => r.packageName);
    await VpnModule.setBlockedApps(blockedPackages);
  }

  async simulateConnectionAttempt(
    packageName: string,
  ): Promise<"blocked" | "allowed"> {
    const rules = await StorageService.getRules();
    const rule = rules.find((r) => r.packageName === packageName);
    return rule?.isBlocked ? "blocked" : "allowed";
  }
}

export default new VpnService();
