import {
  Alert,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";
import StorageService from "./storage.service";

const { VpnModule, AppBlockModule, WidgetSyncModule } = NativeModules;

// Écouter l'événement de permission requis
if (VpnModule) {
  const emitter = new NativeEventEmitter(VpnModule);
  emitter.addListener("VPN_PERMISSION_DENIED", () => {
    Alert.alert(
      "Permission VPN refusée",
      "NetOff a besoin de la permission VPN pour bloquer les applications. Veuillez l'accepter.",
    );
  });
}

class VpnService {
  async startVpn(): Promise<boolean> {
    try {
      if (!VpnModule) {
        console.warn("VpnModule non disponible");
        return false;
      }
      // startVpn gère la permission Android en interne
      // Si permission requise → dialog Android → onActivityResult → résolution
      const result = await VpnModule.startVpn();
      if (result) {
        await this.syncRules();
        WidgetSyncModule?.updateVpnState(true);
      }
      return result;
    } catch (error: any) {
      if (error?.code === "PERMISSION_DENIED") {
        Alert.alert(
          "Permission refusée",
          "La permission VPN est nécessaire pour bloquer les apps.",
        );
      } else {
        console.error("Erreur startVpn:", error);
      }
      return false;
    }
  }

  async stopVpn(): Promise<void> {
    try {
      if (!VpnModule) return;
      await VpnModule.stopVpn();
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

      const rules = await StorageService.getRules();
      const count = rules.filter((r) => r.isBlocked).length;
      WidgetSyncModule?.updateBlockedCount(count);

      if (isBlocked && AppBlockModule) {
        Alert.alert(
          "Bloquer les notifications ?",
          "Pour bloquer aussi les notifications (ex: WhatsApp), désactivez-les dans les paramètres Android.",
          [
            { text: "Ignorer", style: "cancel" },
            {
              text: "Désactiver",
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
    const blocked = rules.filter((r) => r.isBlocked).map((r) => r.packageName);
    await VpnModule.setBlockedApps(blocked);
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
