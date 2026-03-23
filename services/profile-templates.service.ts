import { Profile } from "@/types";
import AppListService from "./app-list.service";
import StorageService from "./storage.service";

export interface ProfileTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  packages: string[]; // packageNames ciblés
  keywords: string[]; // mots-clés pour la détection automatique
}

export const TEMPLATES: ProfileTemplate[] = [
  {
    id: "social",
    name: "Réseaux sociaux",
    description: "Instagram, TikTok, Facebook, Twitter, Snapchat...",
    icon: "📱",
    color: "#E91E8C",
    packages: [
      "com.instagram.android",
      "com.zhiliaoapp.musically",
      "com.facebook.katana",
      "com.twitter.android",
      "com.snapchat.android",
      "com.pinterest",
      "com.reddit.frontpage",
      "com.linkedin.android",
      "com.discord",
      "com.tumblr",
      "com.vkontakte.android",
    ],
    keywords: [
      "social",
      "instagram",
      "tiktok",
      "facebook",
      "twitter",
      "snapchat",
    ],
  },
  {
    id: "work",
    name: "Mode Travail",
    description: "Bloque les distractions pendant les heures de bureau.",
    icon: "💼",
    color: "#1A4DB8",
    packages: [
      "com.instagram.android",
      "com.zhiliaoapp.musically",
      "com.facebook.katana",
      "com.twitter.android",
      "com.snapchat.android",
      "com.king.candycrushsaga",
      "com.supercell.clashofclans",
      "com.netflix.mediaclient",
      "com.google.android.youtube",
      "com.reddit.frontpage",
    ],
    keywords: ["game", "social", "netflix", "youtube", "candy"],
  },
  {
    id: "sleep",
    name: "Sommeil",
    description: "Pas de distraction la nuit. Uniquement les appels.",
    icon: "🌙",
    color: "#5A4FD4",
    packages: [
      "com.instagram.android",
      "com.zhiliaoapp.musically",
      "com.facebook.katana",
      "com.twitter.android",
      "com.snapchat.android",
      "com.reddit.frontpage",
      "com.netflix.mediaclient",
      "com.google.android.youtube",
      "com.discord",
      "com.whatsapp",
      "org.telegram.messenger",
    ],
    keywords: ["social", "stream", "video", "game", "chat"],
  },
  {
    id: "child",
    name: "Enfant",
    description: "Protéger les enfants des contenus inappropriés.",
    icon: "👶",
    color: "#3DDB8A",
    packages: [
      "com.instagram.android",
      "com.zhiliaoapp.musically",
      "com.facebook.katana",
      "com.twitter.android",
      "com.snapchat.android",
      "com.tinder",
      "com.reddit.frontpage",
      "com.discord",
    ],
    keywords: ["social", "dating", "tinder", "discord", "reddit"],
  },
  {
    id: "gaming",
    name: "Pause jeux",
    description: "Bloquer les jeux pour être plus productif.",
    icon: "🎮",
    color: "#FF5733",
    packages: [
      "com.king.candycrushsaga",
      "com.supercell.clashofclans",
      "com.supercell.clashroyale",
      "com.mojang.minecraftpe",
      "com.roblox.client",
      "com.ea.games.fifa_row",
      "com.activision.callofduty.shooter",
    ],
    keywords: ["game", "clash", "candy", "roblox", "minecraft", "call of duty"],
  },
  {
    id: "detox",
    name: "Détox numérique",
    description: "Déconnexion totale. Uniquement l'essentiel.",
    icon: "🧘",
    color: "#4D9FFF",
    packages: [
      "com.instagram.android",
      "com.zhiliaoapp.musically",
      "com.facebook.katana",
      "com.twitter.android",
      "com.snapchat.android",
      "com.reddit.frontpage",
      "com.netflix.mediaclient",
      "com.google.android.youtube",
      "com.discord",
      "com.king.candycrushsaga",
      "com.amazon.mShop.android.shopping",
      "com.pinterest",
      "com.linkedin.android",
    ],
    keywords: ["social", "stream", "shop", "game", "news"],
  },
];

class ProfileTemplatesService {
  /**
   * Crée un profil à partir d'un template en ne gardant que
   * les apps réellement installées sur l'appareil.
   */
  async createFromTemplate(template: ProfileTemplate): Promise<Profile> {
    const installed = await AppListService.getAllApps();
    const installedPkgs = new Set(installed.map((a) => a.packageName));

    // Apps exactement correspondantes
    const exactMatches = template.packages.filter((pkg) =>
      installedPkgs.has(pkg),
    );

    // Apps correspondant par mots-clés (pour capturer les variantes)
    const keywordMatches = installed
      .filter((app) => {
        const name = app.appName.toLowerCase();
        const pkg = app.packageName.toLowerCase();
        return template.keywords.some(
          (kw) => name.includes(kw) || pkg.includes(kw),
        );
      })
      .map((a) => a.packageName);

    // Union dédupliquée
    const allPkgs = [...new Set([...exactMatches, ...keywordMatches])];

    const profile: Profile = {
      id: `profile_${template.id}_${Date.now()}`,
      name: template.name,
      description: template.description,
      isActive: false,
      rules: allPkgs.map((pkg) => ({
        packageName: pkg,
        isBlocked: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      schedules: [],
      createdAt: new Date(),
    };

    await StorageService.saveProfile(profile);
    return profile;
  }

  /** Compte les apps du template qui sont installées */
  async countInstalled(template: ProfileTemplate): Promise<number> {
    const installed = await AppListService.getAllApps();
    const pkgs = new Set(installed.map((a) => a.packageName));
    return template.packages.filter((p) => pkgs.has(p)).length;
  }
}

export default new ProfileTemplatesService();
