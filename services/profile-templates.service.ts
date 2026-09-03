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
   * Crée un profil depuis un modèle.
   *
   * Deux sources de correspondance, volontairement asymétriques :
   *   • les packages listés explicitement sont cherchés parmi *toutes* les
   *     apps, y compris préinstallées par le constructeur ;
   *   • les mots-clés ne sont appliqués qu'aux apps installées par
   *     l'utilisateur — un mot comme « chat » ou « game » attraperait sinon
   *     des composants système sans rapport.
   *
   * @param template  modèle à appliquer
   * @param isPremium un compte gratuit est limité à `FREE_LIMITS.MAX_BLOCKED_APPS`
   */
  async createFromTemplate(
    template: ProfileTemplate,
    isPremium: boolean,
  ): Promise<CreateResult> {
    const [allApps, userApps] = await Promise.all([
      AppListService.getAllApps(),
      AppListService.getUserApps(),
    ]);

    const installed = new Set(allApps.map((app) => app.packageName));
    const exactMatches = template.packages.filter((pkg) => installed.has(pkg));

    const keywordMatches = userApps
      .filter((app) => {
        const haystack = `${app.appName} ${app.packageName}`.toLowerCase();
        return template.keywords.some((keyword) => haystack.includes(keyword));
      })
      .map((app) => app.packageName);

    const detected = [...new Set([...exactMatches, ...keywordMatches])];
    const limit = isPremium ? Infinity : FREE_LIMITS.MAX_BLOCKED_APPS;
    const selected = detected.slice(0, limit);
    const now = new Date();

    const profile: Profile = {
      id: `profile_${template.id}_${Date.now().toString(36)}`,
      name: template.name,
      description: template.description,
      isActive: false,
      rules: selected.map((packageName) => ({
        packageName,
        isBlocked: true,
        createdAt: now,
        updatedAt: now,
      })),
      schedules: [],
      createdAt: now,
    };

    await StorageService.saveProfile(profile);
    return {
      profile,
      blockedCount: selected.length,
      detectedCount: detected.length,
      wasTruncated: detected.length > selected.length,
    };
  }

  /**
   * Nombre d'apps du modèle présentes sur l'appareil, pour tous les modèles.
   *
   * Une seule lecture de l'inventaire : appeler un compteur par modèle
   * déclenchait autant de scans du PackageManager, ce qui bloquait
   * l'ouverture du panneau de modèles.
   */
  async countInstalled(
    templates: ProfileTemplate[] = TEMPLATES,
  ): Promise<Record<string, number>> {
    const apps = await AppListService.getAllApps();
    const installed = new Set(apps.map((app) => app.packageName));
    return Object.fromEntries(
      templates.map((template) => [
        template.id,
        template.packages.filter((pkg) => installed.has(pkg)).length,
      ]),
    );
  }
}

export default new ProfileTemplatesService();
