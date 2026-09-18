# Revue technique et produit — Elyndor / Logiciel RP Beta

**Révision examinée :** `ac737d7c82bf087d4627007c0d98b3e84cd90bf8`  
**Version affichée :** `1.28.2`  
**Périmètre :** application Expo / React Native, moteur narratif, stockage, fournisseurs LLM, automatisation, tests, export web et workflows GitHub. Cette revue n’a modifié aucun fichier du dépôt.

## Conclusion

Le projet est déjà **nettement plus avancé qu’une bêta de prototype**. La séparation entre le moteur déterministe et le modèle de langage est cohérente, les sauvegardes sont sérieusement traitées et le parcours web principal fonctionne sur un cas de migration lourd. Le prochain risque n’est donc pas l’absence de fonctionnalités : ce sont surtout la **maîtrise du budget de contexte**, la **résilience des appels réseau**, la **mise à niveau Expo** et la préparation du projet à une diffusion plus large.

La priorité absolue est de mettre en place un budget de tokens par fournisseur. Aujourd’hui, le projet charge les quinze métamoteurs à chaque tour. Ils représentent déjà 44 714 caractères et 6 799 mots, avant le lore, les faits, les dix derniers messages et la réponse réservée. Cette stratégie est incompatible avec la fenêtre locale déclarée à 4 096 tokens et peut augmenter fortement le coût ou les échecs des modèles distants. Il faut préserver les invariants narratifs, mais les compiler dans un contexte concis et mesuré.

## Ce qui fonctionne déjà très bien

Le dépôt a une **vision d’architecture claire** : le modèle produit le langage, tandis que les règles, la mémoire, le monde, les relations et le stockage restent du ressort du logiciel. Cette direction est visible dans le moteur, les migrations et le README, et constitue une vraie différenciation produit. [1]

Le stockage est particulièrement bien pensé pour une bêta. Les histoires passent par SQLite sur mobile et IndexedDB sur le web. Les écritures sont sérialisées, les migrations conservent la source en cas d’échec et les tests couvrent notamment les transactions, les branches et une histoire de 1 000 messages. Les clés API sont séparées des réglages ordinaires et utilisent SecureStore sur Android et iOS.

La livraison possède déjà une base saine : validation de pull request, vérification TypeScript, export web, prélecture GitHub Pages et workflows EAS. Le projet dispose aussi d’un vrai traitement des erreurs fournisseur, d’un filtrage de contenu par défaut restrictif et d’un mécanisme de déduplication pour les tâches d’automatisation.

## Résultats des validations réalisées

| Contrôle | Résultat | Observation |
|---|---:|---|
| Installation verrouillée | Réussie | `npm ci` a reproduit le lockfile. |
| Tests automatisés sous Node 24 | **68/68 réussis** | Aucun échec, annulation ou test ignoré. |
| Vérification TypeScript sous Node 24 | Réussie | `tsc --noEmit` est passé. |
| Export web Expo sous Node 24 | Réussi | L’export produit un site statique fonctionnel. |
| Parcours web de migration | Réussi | Une fixture de 1 000 messages a été migrée : la clé historique a disparu et IndexedDB contient une histoire. |
| Console navigateur | Propre | Aucun message de console après chargement et navigation vers la conversation. |
| `expo-doctor` | **19/21 contrôles** | Deux écarts de dépendances sont à corriger. |
| Audit production npm | **15 vulnérabilités modérées** | Aucune vulnérabilité haute ou critique ; les alertes proviennent de la chaîne Expo/navigation. |
| Empreinte web observée | 8,29 Mo transférés | Navigation accueil → conversation : 1,77 Mo de JavaScript, 4,35 Mo de PNG et 2,16 Mo de polices. L’export complet fait 27 Mo. |

> Le parcours web validé couvre le chargement de l’application, la migration d’une ancienne sauvegarde, l’ouverture de la conversation et le rendu d’un historique de 1 000 messages. Il ne couvre pas un vrai appel OpenRouter, Infermatic, OpenAI, ni un APK Android ou un appareil iOS.

## Priorités d’amélioration

| Priorité | Sujet | Constats | Décision recommandée |
|---|---|---|---|
| P0 | Budget de contexte et compatibilité du modèle local | Les 15 métamoteurs restent actifs sans plafond. Leur texte seul dépasse très vraisemblablement la fenêtre locale de 4 096 tokens, puis le système ajoute jusqu’à 18 entrées de lore, mémoire, état du monde et historique récent. | Introduire un budget de tokens par fournisseur/modèle, réserver la place de la réponse, mesurer chaque segment du prompt et sélectionner ou résumer les blocs en fonction de ce budget. |
| P1 | Résilience, coût et état de validation | Un tour peut appeler le narrateur, le validateur et parfois un réparateur. Les mises à jour périodiques lancent plusieurs moteurs. Les `fetch` n’ont ni délai d’expiration ni annulation utilisateur. En cas d’échec du validateur LLM, le code autorise silencieusement la réponse. | Ajouter annulation, timeout, statut de validation dégradé, budget de requêtes/coût par campagne et métriques de latence. Ne pas présenter une réponse comme validée si seul le contrôle heuristique a fonctionné. |
| P1 | Dépendances Expo et vulnérabilités | `expo-doctor` détecte dix versions SDK 57 décalées et la dépendance directe `expo-modules-core`. `npm audit` remonte 15 alertes modérées transitives. | Créer une branche de maintenance, exécuter `npx expo install --check`, appliquer les versions SDK 57 compatibles, puis refaire les contrôles web et natifs. Éviter `npm audit fix --force`, qui propose une trajectoire Expo non sûre. |
| P1 | Confidentialité des clés et des récits | Le comportement natif est bon. Sur le web, la persistance durable est explicitement non chiffrée. L’histoire, les descriptions de personnage, le lore et parfois les images sont envoyés aux fournisseurs activés. Il n’existe pas de politique de confidentialité ni de procédure de sécurité publiée. | Ajouter `PRIVACY.md` et `SECURITY.md`, une notice avant l’activation d’un fournisseur, des liens vers les politiques des services et une explication simple de l’effacement/export local. Ne jamais présenter le code local de profil adulte comme une protection de sécurité. |
| P1 | Packs de contenu et prompt injection | Un pack n’exécute pas de code, ce qui est très bien. En revanche, il accepte un nombre et une taille illimités d’entrées, puis injecte leur texte dans le contexte du modèle. | Valider un schéma avec limites de taille et de nombre, associer provenance/version au pack, traiter explicitement son contenu comme une donnée de référence à autorité inférieure et tester les instructions malveillantes, les doublons et les gros imports. |
| P2 | Couverture de tests orientée parcours | Les 68 tests protègent bien stockage, fournisseurs et automatisation. En revanche, aucun test ne référence les écrans, et le parcours complet `générer → valider → réparer → sauvegarder` n’est pas testé avec un fournisseur simulé. | Ajouter des tests d’intégration déterministes du moteur et des tests E2E : activation, réglages, création, migration, erreur réseau, import de pack, export et conversation longue. |
| P2 | Poids et performance web | Le chargement constaté dépasse 8 Mo dès la navigation vers une conversation. Les fonds PNG et les familles de polices dominent. | Définir un budget de performance, créer des variantes web compressées et responsives, sous-ensembler les polices, charger les images d’écran seulement à la navigation et mesurer sur réseau mobile simulé. |
| P2 | Release engineering et gouvernance | Les déploiements web, OTA et APK sont attachés au nom de branche `claude/new-session-glwy6e`; le vérificateur de version l’est aussi. Le dépôt ne contient ni Dependabot, ni modèles d’issues/PR, ni changelog, ni politique sécurité/confidentialité. | Introduire une branche de release stable, paramétrer l’URL de version, séparer preview et production avec environnements GitHub, réduire les permissions des workflows, et ajouter les fichiers de gouvernance manquants. |
| P3 | Accessibilité et internationalisation | L’interface utilise beaucoup de contrôles tactiles, mais les métadonnées d’accessibilité ne couvrent pas tous les contrôles. La traduction à la volée passe aussi par le modèle configuré, donc elle ajoute des requêtes et peut tomber en repli français. | Auditer VoiceOver/TalkBack, ajouter rôles, libellés et annonces d’état, vérifier le grossissement du texte et indiquer clairement quand une traduction est en attente, indisponible ou consomme une requête. |

## Plan de mise en œuvre recommandé

### 1. Stabiliser le contexte avant toute nouvelle fonctionnalité

Conserver les règles immuables, mais les représenter dans un **noyau compact** qui reste toujours présent. Rendre le reste des métamoteurs sélectionnable ou pré-résumé. Le constructeur de prompt devrait recevoir un objet de capacité par modèle : fenêtre de contexte, réserve de sortie et seuil d’avertissement. Avant l’appel, un compteur doit répartir le budget entre règles, personnage, mémoire, lore, monde et historique. Le diagnostic concepteur peut afficher cette répartition sans exposer de secret.

La règle de test à ajouter est simple : pour chaque profil de contenu et chaque moteur, le prompt construit ne dépasse jamais la fenêtre disponible. Les tests doivent aussi vérifier que les règles d’agentivité et de canon restent présentes même lorsque le budget est serré. Cette amélioration rendra le mode local réellement exploitable et rendra les coûts distants prévisibles.

### 2. Rendre les opérations réseau annulables et explicites

Toutes les requêtes distantes devraient accepter un `AbortSignal`, avec une limite de temps adaptée au type d’opération. L’écran de conversation doit permettre d’annuler une génération et ignorer tout résultat arrivé après l’annulation. Les erreurs transitoires doivent être distinguées des erreurs de clé, de modèle ou de contenu. Une réponse dont la validation LLM n’a pas pu être effectuée doit afficher un état « validation limitée », plutôt que d’être assimilée à une validation complète.

Un petit tableau de bord concepteur serait utile : appels par tour, appels de réparation, temps de génération, délais d’attente, motifs d’échec et taille estimée du prompt. Il aidera à régler les modèles sans deviner.

### 3. Traiter la maintenance Expo comme une livraison contrôlée

La correction des écarts Expo doit être isolée dans une pull request de maintenance. Il faut d’abord mettre à jour les patchs compatibles avec SDK 57, puis exécuter les trois portes actuelles : tests, TypeScript et export web. Comme l’application utilise SQLite, SecureStore, reconnaissance vocale et un module LiteRT natif, un build Android de validation est nécessaire avant diffusion. `expo-modules-core` mérite une attention particulière : Expo Doctor recommande de ne pas l’installer directement, mais `expo-litert-lm` le déclare aussi comme peer dependency. Il faut donc supprimer ou exclure la dépendance seulement après avoir validé la résolution npm et le build natif.

### 4. Préparer une diffusion responsable

Une politique de confidentialité courte suffit pour commencer, à condition qu’elle dise clairement quelles données partent vers quel fournisseur, ce qui reste sur l’appareil, le comportement du stockage web et la procédure d’effacement. Une politique de sécurité doit donner un canal de signalement privé. Ces deux documents sont importants avant d’inviter des testeurs externes, surtout avec des récits personnels, des clés API personnelles et un profil de contenu adulte.

### 5. Étendre les tests là où le risque utilisateur est réel

Le prochain lot de tests doit privilégier les transitions visibles : démarrer sans clé, changer de fournisseur, annuler une réponse lente, migrer une histoire, reprendre après une sauvegarde, importer un pack hostile ou trop gros, supprimer une histoire et exporter une conversation. Maestro pour Android et Playwright pour le build web constituent une combinaison raisonnable. Les tests de moteur doivent utiliser des réponses fournisseur simulées afin de rester rapides, gratuits et reproductibles.

## Améliorations produit à forte valeur

Le produit gagnerait à afficher une estimation simple avant les actions coûteuses : modèle actif, nombre approximatif d’appels prévus, illustration payante ou gratuite et taille du contexte. Ce n’est pas seulement un détail technique : l’utilisateur comprendrait pourquoi une réponse peut prendre du temps et garderait le contrôle de son compte fournisseur.

Le mode « local » mérite un parcours guidé séparé. Il peut vérifier l’espace disponible, la mémoire de l’appareil, la compatibilité Android, la taille maximale de contexte réellement utilisable et proposer un profil narratif condensé. Aujourd’hui, la promesse locale est intéressante, mais elle est fragilisée par un prompt beaucoup plus volumineux que sa fenêtre déclarée.

Enfin, le README est déjà soigné. Pour faciliter les contributions, un schéma d’architecture par module du moteur, un changelog lisible et quelques captures réelles de l’application seraient les meilleures améliorations non techniques immédiates.

## Limites de cette revue

La revue a vérifié le code, le build web, la migration et la console du navigateur. Elle n’a pas effectué de test avec de vraies clés ou de contenu utilisateur réel, n’a pas généré d’images payantes, n’a pas construit l’APK Android, et n’a pas audité les réglages GitHub non présents dans le dépôt, comme la protection de branche, la rotation des secrets ou les alertes de sécurité. Ces éléments doivent être contrôlés avant une diffusion publique plus large.

## Références

[1]: https://github.com/artisanguillonrenov-creator/logiciel-rp-beta/tree/ac737d7c82bf087d4627007c0d98b3e84cd90bf8 "Logiciel RP Beta — révision examinée"
[2]: https://docs.expo.dev/versions/v57.0.0/ "Documentation Expo SDK 57"
