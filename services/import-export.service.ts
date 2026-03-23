import { AppRule, Profile } from "@/types";
import * as DocumentPicker from "expo-document-picker";
import { Share } from "react-native";
import StorageService from "./storage.service";

export interface ExportData {
  version: number;
  exportedAt: string;
  appName: string;
  rules: AppRule[];
  profiles: Profile[];
}

class ImportExportService {
  async exportRules(): Promise<void> {
    const [rules, profiles] = await Promise.all([
      StorageService.getRules(),
      StorageService.getProfiles(),
    ]);
    const data: ExportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      appName: "NetOff",
      rules,
      profiles,
    };
    await Share.share(
      { message: JSON.stringify(data, null, 2), title: "Export NetOff" },
      { dialogTitle: "Exporter les règles NetOff" },
    );
  }

  async importRules(
    mode: "merge" | "replace" = "merge",
  ): Promise<{ rules: number; profiles: number }> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "*/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0])
      throw new Error("Import annulé.");

    // fetch() fonctionne avec tous les URIs file:// sans dépendance FileSystem
    const response = await fetch(result.assets[0].uri);
    if (!response.ok) throw new Error("Impossible de lire le fichier.");
    const content = await response.text();

    let data: ExportData;
    try {
      data = JSON.parse(content);
    } catch {
      throw new Error("Fichier invalide ou corrompu.");
    }

    this.validate(data);

    if (mode === "replace") {
      const existing = await StorageService.getRules();
      for (const r of existing) await StorageService.deleteRule(r.packageName);
    }

    for (const rule of data.rules) {
      await StorageService.saveRule({
        ...rule,
        createdAt: new Date(rule.createdAt),
        updatedAt: new Date(),
      });
    }

    let profileCount = 0;
    for (const profile of data.profiles ?? []) {
      await StorageService.saveProfile({
        ...profile,
        id: `imported_${profile.id}_${Date.now()}`,
        isActive: false,
        createdAt: new Date(profile.createdAt),
        rules: (profile.rules ?? []).map((r) => ({
          ...r,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(),
        })),
        schedules: profile.schedules ?? [],
      });
      profileCount++;
    }
    return { rules: data.rules.length, profiles: profileCount };
  }

  private validate(data: ExportData): void {
    if (!data || typeof data.version !== "number")
      throw new Error("Version manquante.");
    if (!Array.isArray(data.rules)) throw new Error("Règles invalides.");
    for (const r of data.rules) {
      if (!r.packageName || typeof r.isBlocked !== "boolean")
        throw new Error(`Règle invalide : ${JSON.stringify(r)}`);
    }
  }
}

export default new ImportExportService();
