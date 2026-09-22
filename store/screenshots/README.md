# Captures de la fiche Google Play

7 visuels en **1080 × 1920** (format téléphone Play), générés depuis le code :

```bash
node store/screenshots/build.mjs   # → store/screenshots/out/*.png
```

| Fichier | Accroche | Écran montré |
| --- | --- | --- |
| `01-protection.png` | Coupez Internet, app par app | Accueil, protection active |
| `02-apps.png` | Un interrupteur par application | Liste des applications |
| `03-focus.png` | Un Focus qu'on n'annule pas | Session Focus en cours |
| `04-notifications.png` | Même plus de notifications | Garde des notifications |
| `05-allowlist.png` | Tout couper, sauf l'essentiel | Mode liste blanche |
| `06-profiles.png` | Un profil pour chaque moment | Profils et planifications |
| `07-stats.png` | Voyez le temps que vous regagnez | Statistiques |

## Comment c'est fabriqué

- `kit.mjs` — palette et composants, recopiés de `theme/tokens.ts`,
  `theme/themes.ts` et `ui/`. Les icônes viennent de la vraie police de l'app
  (`@expo/vector-icons`), pas d'un jeu approchant.
- `screens.mjs` — les écrans, écrits à **390 pt de large** comme en React
  Native, puis mis à l'échelle. Changer une couleur du thème et relancer le
  script suffit à mettre les visuels à jour.
- `build.mjs` — le cadre (fond, accroche, mockup) et le rendu par Chrome
  headless (`CHROME_BIN` pour pointer un autre binaire).

## Avant de les publier

Ce sont des **recompositions fidèles** de l'interface, pas des captures d'écran
brutes : l'agencement, les couleurs et les libellés sont ceux de l'app, les
chiffres sont des exemples plausibles. C'est la pratique courante sur les
fiches store, et Play l'accepte tant que les visuels montrent bien
l'application. Deux règles à tenir :

1. **Ne jamais montrer une fonctionnalité absente.** Le visuel
   `04-notifications` suppose que le garde de notifications est livré dans la
   version publiée — il l'est depuis la version qui ajoute
   `NotificationGuardService`. Retirez ce visuel si vous publiez une version
   antérieure.
2. **Rejouer le script après un changement d'interface**, sinon la fiche montre
   une app qui n'existe plus.

Les noms d'applications tierces (Instagram, TikTok, YouTube…) apparaissent en
texte, sans leur logo ni leur charte : c'est un usage nominatif, celui que fait
déjà l'app quand elle liste les applications installées.
