# Fiabilité et immersion — premier lot

Base : `1e23675d06608ae473eafc16996c3cfb1e112e91`, après fusion de la PR #3.
La branche de référence du dépôt est `claude/new-session-glwy6e`.

## Changements livrés

- Histoires dans `elyndor-histoires.db` (SQLite natif) ou `elyndor-histoires`
  (IndexedDB web). Métadonnées, état narratif et messages sont confirmés dans
  une seule transaction. L'index est dérivé des métadonnées enregistrées.
- Un enregistrement par message, identifié par **histoire + message**, pour
  isoler les branches. Ajout, édition, épinglage, réaction, régénération et
  suppression sont pris en charge. Seuls les messages modifiés sont réécrits.
- Clés OpenRouter, Infermatic et embeddings séparées des autres réglages :
  SecureStore sur Android/iOS ; `sessionStorage` sur le web, `localStorage`
  uniquement après choix explicite. Le code de profil de contenu n'est pas
  un secret d'authentification et conserve son fonctionnement de bêta.
- Portraits natifs affichés via leur URI de fichier. La conversion en base64
  se fait seulement lors d'un envoi de référence au générateur d'images.
- Portrait de 32 px au début des répliques nommées ; aucune image insérée
  dans la prose. Les prénoms ambigus et rôles génériques n'héritent plus du
  visage d'un PNJ choisi par approximation.
- Barre de conversation réduite à Continuer et Actions du récit. Galerie
  de portraits séparée du diagnostic. Diagnostic et compteurs techniques
  réservés au mode concepteur, sans recalcul de diagnostic en mode joueur.
- Réglages de connexion regroupés dans une section repliable ; profil de
  contenu et images restent directement accessibles.

## Migration et erreurs

Les clés `@rp_beta/story/*` sont découvertes même si l'ancien index manque.
Chaque histoire passe par les migrations de schéma existantes puis par une
écriture transactionnelle. Sa copie AsyncStorage est retirée **après** la
confirmation. Un transfert repris ignore une histoire déjà présente dans
le nouveau stockage et termine le nettoyage ; il ne réintroduit pas un état
plus ancien. L'index historique est retiré quand le transfert est terminé.

Un JSON corrompu, une identité incohérente ou une version future interrompt
la migration sans supprimer la source fautive. Les écrans affichent une
erreur et permettent de réessayer au lieu de présenter une liste vide comme
si les histoires avaient disparu. Une réponse affichée mais non enregistrée
reste disponible pour une nouvelle tentative de sauvegarde sans appel LLM.

La migration des clés écrit d'abord dans le stockage dédié, puis retire
les champs secrets des réglages. Si ce stockage refuse l'écriture, la source
historique reste intacte ; aucun repli ne réenregistre les nouvelles clés
dans AsyncStorage.

## Limites conservées

- L'état narratif (mémoire, social, monde, directeur, lore) reste un objet
  JSON séparé des messages ; il n'est pas encore normalisé par entité.
- La comparaison des messages et le chargement du récit restent linéaires
  dans la longueur de l'histoire. Ce lot réduit les écritures disque et le
  quota localStorage, pas tous les coûts mémoire des campagnes très longues.
- Les écritures de cette instance sont sérialisées. Des modifications de
  la même histoire depuis plusieurs onglets ne sont pas fusionnées.
- Le stockage reste local à l'appareil et à l'origine du site. Effacer les
  données du navigateur ou désinstaller l'app peut effacer les histoires.
- Les exports TXT/PDF/EPUB restent des documents de lecture, pas des archives
  de restauration du moteur. Aucun export/import de sauvegarde complète ajouté.
- Le mode concepteur est un réglage de bêta accessible, pas une authentification.
- L'observateur narratif unique, les références canoniques entre moteurs,
  l'aventure rapide, les chapitres et la galerie durable des scènes restent
  des chantiers séparés. Les contrôles de contenu restent ceux du moteur actuel.

## Vérification

```bash
npm ci
npm test
npx tsc --noEmit
npx expo export -p web
npx expo export -p android --output-dir /tmp/elyndor-export-android
```

Les tests couvrent 1 000 messages, les éditions et suppressions, les branches,
les migrations v1 → v9, les interruptions, le refus d'un schéma futur, les
écritures simultanées et la capture de l'état avant attente. Le SQL de
l'adaptateur natif est exécuté contre SQLite réel via Node ; IndexedDB est
testé avec `fake-indexeddb`. Les clés sont testées avec des valeurs fictives.

Prévisualisation reproductible après export web : `node tests/preview-web.cjs`,
puis ouvrir `http://localhost:8082/fixture.html` dans un navigateur de test.
Le bouton prépare une campagne fictive de 1 000 messages dans l'ancien format,
sans clé API ni appel payant. Cette page n'est pas incluse dans `dist/`.

Le contrôle visuel n'a pas pu être exécuté dans l'environnement de travail :
le navigateur distant bloque les URL locales. Aucun test sur tablette ni
vérification réelle du Keystore/Keychain n'est revendiqué. Avant validation
de livraison : vérifier migration d'une copie de campagne, redémarrage,
portraits, menus et conservation des clés sur un APK comprenant les modules.

## Livraison

SQLite et SecureStore requièrent **un nouvel APK**. Le runtime `fingerprint`
existant évite une OTA incompatible avec les anciens binaires. Les workflows
utilisent maintenant Node 24. La PR reste à fusionner manuellement, après audit
du commit exact et vérification native ; aucune fusion automatique.

Références Expo versionnées : [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/),
[SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/),
[FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/).
