# NetOff

Contrôle de l'accès à internet, application par application, sur Android.

NetOff monte un **VPN local** (aucun serveur distant) et abandonne le trafic des
applications que vous désignez. Le blocage peut être permanent, planifié par
créneaux, groupé en profils, ou limité à une session Focus.

---

## Fonctionnalités

| Domaine | Détail |
| --- | --- |
| Blocage réseau | Par app, avec condition Wi-Fi / données mobiles |
| Liste blanche | Tout bloquer sauf une sélection — mode le plus strict |
| Profils | Jeux de règles nommés, activables d'un geste |
| Planifications | Créneaux par app ou par profil, via `AlarmManager` |
| Focus | Session à durée fixe, résiste à la fermeture de l'app, sortie par appui maintenu |
| Minuterie | Blocage court et réversible d'un tap |
| Statistiques | Journal des connexions, détail par app, séries et badges |
| Sécurité | Verrouillage par code PIN et biométrie, contrôle parental séparé |
| Compatibilité | Diagnostic des restrictions constructeur (Huawei, Xiaomi, Oppo…) |
| Widget | État de la protection et bascule depuis l'écran d'accueil |

> **iOS n'est pas supporté.** Aucune API publique ne permet à une app tierce de
> filtrer le trafic des autres applications ; le projet iOS existe uniquement
> pour que le build Expo reste valide.

---

## Démarrage

```bash
npm install
npm run android        # build natif + lancement (dev client requis)
npm run check          # types de routes + TypeScript + ESLint
```

Le projet est en **workflow bare** : les dossiers `android/` et `ios/` sont
versionnés. Les modules natifs Kotlin ne passent pas par un plugin Expo, une
modification de `android/` demande donc un nouveau build.

### Scripts

| Script | Rôle |
| --- | --- |
| `npm start` | Serveur de développement Metro |
| `npm run android` | Compile et installe le build natif |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run routes` | Régénère `.expo/types/router.d.ts` sans lancer Metro |
| `npm run check` | Les trois vérifications d'affilée |

---

## Architecture

```
app/                  Routes expo-router — écrans uniquement, aucune logique métier
  (tabs)/             Accueil · Apps · Profils · Stats
  application/[…]     Détail d'une application
  profile/[…]         Détail d'un profil
  settings/           Réglages, éclatés par domaine
  lock.tsx            Verrouillage au lancement
  onboarding.tsx      Première configuration

features/             Logique par domaine : hooks + composants dédiés
  apps/               Catalogue d'apps, filtres, ligne de liste
  home/               Données et cartes du tableau de bord
  premium/            Abonnement, limites gratuites, paywall
  profiles/           Profils et modèles
  schedule/           Éditeur et affichage des créneaux
  security/           Pavé PIN, garde-fou parental
  sessions/           Focus et minuterie
  stats/              Panneaux statistiques, bilan hebdomadaire
  system/             Démarrage, mises à jour Play
  vpn/                État de la protection, explications de permission

ui/                   Kit d'interface — la seule source de composants visuels
theme/                Design system : tokens.ts (primitives) + themes.ts (sémantique)
lib/                  Helpers purs (formatage, pluriels, durées)
services/             Ponts vers les modules natifs et le stockage
types/                Modèle de données persisté
android/…/netoff/     Modules et services Kotlin (VPN, alarmes, journal, widget)
```

### Règles de contribution

1. **Aucune couleur ni taille en dur dans un écran.** Tout passe par
   `useTheme().t` et les tokens de `theme/tokens.ts`.
2. **Aucun composant visuel défini dans `app/`.** Un besoin non couvert
   s'ajoute à `ui/` (générique) ou à `features/<domaine>/` (métier).
3. **Les écrans ne parlent pas aux services.** Ils consomment un hook de
   `features/`, qui seul connaît `services/`.
4. **Les animations passent par Reanimated**, jamais par l'API `Animated`
   historique : elles tournent alors sur l'UI thread et restent fluides pendant
   le chargement de plusieurs centaines d'apps.
5. **Une règle gratuite se vérifie via `usePremium().limits`**, jamais en
   comparant un compteur à `FREE_LIMITS` dans un écran.

---

## Fonctionnement du blocage

```
Écran → hook features/ → service JS → module natif Kotlin → NetLockVpnService
```

1. Une règle est écrite dans `AsyncStorage` (`StorageService`).
2. `VpnService.setRule` pousse la liste des packages bloqués dans les
   `SharedPreferences` **avant** de démarrer le service : celui-ci lit les
   règles au démarrage, ce qui évite une fenêtre où le tunnel tourne à vide.
3. `NetLockVpnService` établit le tunnel et abandonne les paquets des packages
   listés. En mode liste blanche, le tunnel capture tout et exclut les apps
   autorisées — plus robuste face aux surcouches constructeur.
4. Les planifications sont confiées à `AlarmManager` (`ScheduleModule`), donc
   appliquées même app fermée.

Le trafic n'est ni lu, ni stocké, ni transmis. Seuls des compteurs
« bloqué / autorisé » par package sont conservés localement.

---

## Points d'attention

- **Restrictions constructeur.** Certaines surcouches suspendent les services
  d'arrière-plan. Réglages › Compatibilité détecte le fabricant et ouvre les
  écrans système concernés. `WatchdogService` relance le tunnel s'il tombe.
- **Permission VPN.** Android affiche un avertissement générique et anxiogène.
  Il est expliqué avant d'être déclenché (`features/vpn/VpnPrompts.tsx`) — c'est
  ce qui fait la différence sur le taux d'acceptation.
- **Achats.** Les clés RevenueCat vivent dans `config/revenuecat.ts`. Sans clé
  valide, le paywall affiche des prix indicatifs et n'autorise que l'activation
  par code promotionnel.
