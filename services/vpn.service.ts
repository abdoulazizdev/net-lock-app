import { Alert, NativeModules, Platform } from "react-native";
import StorageService from "./storage.service";

const { VpnModule, AppBlockModule, WidgetSyncModule } = NativeModules;

export interface BlockabilityResult {
  canBlock: boolean;
  reason: "work_profile" | "system_app" | "";
}

class VpnService {
  async startVpn(): Promise<boolean> {
    try {
      if (!VpnModule) {
        console.warn("VpnModule non disponible");
        return false;
      }
      await VpnModule.startVpn();
      await this.syncRules();
      WidgetSyncModule?.updateVpnState(true);
      return true;
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
    } catch (error: any) {
      if (error?.code === "FOCUS_ACTIVE") {
        Alert.alert(
          "Session Focus active",
          "Arrêtez la session Focus avant de désactiver le VPN.",
        );
      } else {
        console.error("Erreur stopVpn:", error);
      }
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
      // Nettoyer le packageName avant de sauvegarder
      const cleanPkg = packageName.split("@")[0].trim();

      await StorageService.saveRule({
        packageName: cleanPkg,
        isBlocked,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.syncRules();

      const rules = await StorageService.getRules();
      const count = rules.filter((r) => r.isBlocked).length;
      WidgetSyncModule?.updateBlockedCount(count);

      // if (isBlocked && AppBlockModule) {
      //   Alert.alert(
      //     "Bloquer les notifications ?",
      //     "Pour bloquer aussi les notifications (ex: WhatsApp), désactivez-les dans les paramètres Android.",
      //     [
      //       { text: "Ignorer", style: "cancel" },
      //       {
      //         text: "Désactiver",
      //         onPress: () => AppBlockModule.disableAppNotifications(cleanPkg),
      //       },
      //     ],
      //   );
      // }
    } catch (error) {
      console.error("Erreur setRule:", error);
    }
  }

  /**
   * Vérifie si une app peut être bloquée efficacement.
   * Les apps dans un profil clone/travail ne peuvent pas être bloquées
   * via VPN depuis le profil principal sans root.
   */
  async canBlockPackage(packageName: string): Promise<BlockabilityResult> {
    try {
      if (!VpnModule?.canBlockPackage) return { canBlock: true, reason: "" };
      return await VpnModule.canBlockPackage(packageName);
    } catch {
      return { canBlock: true, reason: "" };
    }
  }

  getStatus(): { isActive: boolean; isNative: boolean; platform: string } {
    return { isActive: false, isNative: !!VpnModule, platform: Platform.OS };
  }

  async syncRules(): Promise<void> {
    if (!VpnModule) return;
    const rules = await StorageService.getRules();
    const blocked = rules
      .filter((r) => r.isBlocked)
      .map((r) => r.packageName.split("@")[0].trim()) // nettoyer au cas où
      .filter((p) => p.length > 0);
    await VpnModule.setBlockedApps(blocked);
  }

  async simulateConnectionAttempt(
    packageName: string,
  ): Promise<"blocked" | "allowed"> {
    const rules = await StorageService.getRules();
    const rule = rules.find((r) => r.packageName === packageName.split("@")[0]);
    return rule?.isBlocked ? "blocked" : "allowed";
  }
}

export default new VpnService();
