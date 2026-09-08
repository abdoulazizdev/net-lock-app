# Sécurité des données — déclaration Google Play

> Problème signalé le 8 sept. sur le code de version **44** :
> « Formulaire incorrect relatif à la sécurité des données — données de
> l'utilisateur transmises hors de l'appareil non divulguées :
> **ID de l'appareil ou autres ID** ».

Ce n'est pas un bug de l'application : NetOff transmet bien un identifiant,
mais le formulaire ne le déclarait pas. On garde la fonctionnalité
(**Option 1** du dépannage Play) et on déclare ce qui sort réellement.

---

## 1. Ce qui sort de l'appareil — audit

| Source | Sort de l'appareil ? | Ce qui est transmis |
| --- | --- | --- |
| Tunnel VPN (`NetLockVpnService`) | **Non** | Le tunnel est local, aucun trafic n'est relayé vers un serveur. |
| Règles, profils, statistiques | **Non** | `AsyncStorage` / `SecureStore`, jamais synchronisés. |
| Liste des apps installées | **Non** | Lue par le module natif, reste en mémoire locale. |
| Export / import | **Non** | Fichier choisi par l'utilisateur, lu en `file://`. |
| Notifications | **Non** | Notifications **locales** uniquement : aucun `google-services.json`, aucun jeton push demandé. |
| **RevenueCat** (`react-native-purchases`) | **Oui** | Identifiant anonyme d'utilisateur généré par le SDK, métadonnées d'appareil, état de l'abonnement. |
| **Play Billing** (via RevenueCat) | **Oui** | Achat et historique d'achat, gérés par Google Play. |

Vérifications faites sur le manifeste fusionné
(`android/app/build/intermediates/merged_manifests/release/…`) :

- **aucune** permission `com.google.android.gms.permission.AD_ID` — pas
  d'identifiant publicitaire. Elle est désormais explicitement bloquée dans
  `app.json` (`android.blockedPermissions`) pour qu'aucune mise à jour de
  dépendance ne la réintroduise ;
- `collectDeviceIdentifiers()` de RevenueCat n'est **jamais** appelé ;
- aucun `fetch()` vers un domaine tiers dans le code applicatif.

**Conclusion : le seul émetteur est RevenueCat, et uniquement pour les achats.**

---

## 2. Déclaration à saisir

Play Console › **Règles et programmes** › **Contenu de l'application** ›
**Sécurité des données**.

### Aperçu

| Question | Réponse |
| --- | --- |
| Votre appli collecte-t-elle ou partage-t-elle des données utilisateur ? | **Oui** |
| Toutes les données collectées sont-elles chiffrées en transit ? | **Oui** (HTTPS, RevenueCat et Play Billing) |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** — sur demande à `abdoulaziz.dev@gmail.com` |

### Types de données à cocher

**a) ID de l'appareil ou autres ID** — c'est le type manquant qui a déclenché
l'avertissement.

- Collectées : **Oui** — Partagées : **Non**
- Traitées de manière éphémère : **Non**
- Collecte obligatoire : **Oui** (le SDK d'achat s'initialise au lancement)
- Finalités : **Fonctionnalités de l'application** et
  **Prévention des fraudes, sécurité et conformité**
  *(validation des achats et restauration de l'abonnement)*

**b) Informations financières › Historique des achats** — à cocher aussi si ce
n'est pas déjà fait : RevenueCat et Play Billing reçoivent l'état de
l'abonnement.

- Collectées : **Oui** — Partagées : **Non**
- Traitées de manière éphémère : **Non**
- Collecte obligatoire : **Oui**
- Finalité : **Fonctionnalités de l'application**

### À ne pas cocher

Position, contacts, messages, photos, fichiers, historique de navigation,
informations de santé, **identifiant publicitaire**, données de diagnostic
(aucun SDK de crash reporting n'est intégré).

### Page « Identifiant publicitaire »

Contenu de l'application › **Identifiant publicitaire** → **Non**, l'appli
n'utilise pas d'identifiant publicitaire (permission bloquée).

---

## 3. Cohérence : politique de confidentialité et écran « À propos »

Google compare la déclaration, la politique de confidentialité et ce que dit
l'application. Le paragraphe suivant doit figurer dans la politique de
confidentialité publiée :

> NetOff fonctionne hors ligne : le filtrage réseau, les règles, les profils et
> les statistiques restent sur l'appareil et ne sont transmis à personne. Seul
> l'achat de la version Pro fait appel à des tiers : Google Play (facturation)
> et RevenueCat (validation de l'abonnement). Ces services reçoivent un
> identifiant anonyme généré pour l'appareil, les métadonnées techniques de
> l'appareil et l'état de l'abonnement. Aucun identifiant publicitaire n'est
> collecté, aucune donnée n'est vendue ni partagée à des fins publicitaires.
> Pour demander la suppression de ces données : abdoulaziz.dev@gmail.com.

L'écran **Réglages › À propos › Confidentialité** a été mis à jour dans le même
sens (`app/settings/about.tsx`) : la mention « aucune donnée envoyée à un
tiers » était fausse tant que RevenueCat est embarqué, et une affirmation de ce
genre suffit à faire rejeter une nouvelle déclaration.

---

## 4. Après la correction

1. Enregistrer le formulaire : il s'applique à **toutes** les versions déjà
   publiées, y compris le code de version 44 — l'avertissement se lève sans
   nouveau build.
2. Le prochain build embarque en plus le blocage de `AD_ID` et le texte
   « À propos » corrigé.
3. **Option 2 (supprimer la fonctionnalité) écartée** : elle reviendrait à
   retirer les achats intégrés, donc la version Pro.

## 5. Règle pour la suite

Toute nouvelle dépendance qui parle au réseau (analytics, crash reporting,
publicité, notifications push) impose de **remettre à jour ce formulaire avant
publication**. Vérifier après ajout :

```bash
grep -o 'uses-permission android:name="[^"]*"' \
  android/app/build/intermediates/merged_manifests/release/*/AndroidManifest.xml | sort -u
```
