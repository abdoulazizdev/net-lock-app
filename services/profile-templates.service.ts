import { Profile } from "@/types";
import AppListService from "./app-list.service";
import StorageService from "./storage.service";
import { FREE_LIMITS } from "./subscription.service";

export interface ProfileTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  packages: string[];
  keywords: string[];
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

export interface CreateResult {
  profile: Profile;
  /** Apps réellement bloquées */
  blockedCount: number;
  /** Apps détectées au total (avant limitation) */
  detectedCount: number;
  /** true si la liste a été tronquée à cause de la limite gratuite */
  wasTruncated: boolean;
}

class ProfileTemplatesService {
  /**
   * Crée un profil depuis un template.
   * Respecte FREE_LIMITS.MAX_BLOCKED_APPS pour les utilisateurs gratuits.
   *
   * @param template  Le template à utiliser
   * @param isPremium true si l'utilisateur a un abonnement Premium
   */
  async createFromTemplate(
    template: ProfileTemplate,
    isPremium: boolean,
  ): Promise<CreateResult> {
    const installed = await AppListService.getAllApps();
    const installedPkgs = new Set(installed.map((a) => a.packageName));

    const exactMatches = template.packages.filter((pkg) =>
      installedPkgs.has(pkg),
    );
    const keywordMatches = installed
      .filter((app) => {
        const name = app.appName.toLowerCase();
        const pkg = app.packageName.toLowerCase();
        return template.keywords.some(
          (kw) => name.includes(kw) || pkg.includes(kw),
        );
      })
      .map((a) => a.packageName);

    const allPkgs = [...new Set([...exactMatches, ...keywordMatches])];
    const detectedCount = allPkgs.length;

    // Limiter pour les utilisateurs gratuits
    const limit = isPremium ? Infinity : FREE_LIMITS.MAX_BLOCKED_APPS;
    const finalPkgs = allPkgs.slice(0, limit);
    const wasTruncated =
      !isPremium && allPkgs.length > FREE_LIMITS.MAX_BLOCKED_APPS;

    const profile: Profile = {
      id: `profile_${template.id}_${Date.now()}`,
      name: template.name,
      description: template.description,
      isActive: false,
      rules: finalPkgs.map((pkg) => ({
        packageName: pkg,
        isBlocked: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      schedules: [],
      createdAt: new Date(),
    };

    await StorageService.saveProfile(profile);
    return {
      profile,
      blockedCount: finalPkgs.length,
      detectedCount,
      wasTruncated,
    };
  }

  /** Compte les apps du template installées sur l'appareil */
  async countInstalled(template: ProfileTemplate): Promise<number> {
    const installed = await AppListService.getAllApps();
    const pkgs = new Set(installed.map((a) => a.packageName));
    return template.packages.filter((p) => pkgs.has(p)).length;
  }
}

export default new ProfileTemplatesService();
