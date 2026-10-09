# Elyndor — mode d'emploi de l'atelier Narrateur IA / Contexte et mémoire

## Accès
Sur la tablette Android, activer le **mode concepteur**, ouvrir **Réglages concepteur** et choisir la page **Narrateur IA** ou **Contexte et mémoire**. Aucun terminal et aucun démarrage du pod ne sont nécessaires pour lire ou modifier les paramètres locaux.

### Profils de configuration
Les profils **Production, Test, Benchmark** sont versionnés localement par `depotConfiguration.ts` (AsyncStorage), avec historique et import/export. Les parties prenantes ordinaires utilisent le profil **Production** de leur propre appareil. Ce paramétrage n'est pas une console d'administration centralisée des futurs abonnés. Il ne doit pas être présenté comme une publication globale.

## Narrateur IA — quatre parties

1. **Règles fondamentales** : lecture des vraies règles, de l'identité narrative et des responsabilités M01–M15. Les règles immuables ne sont jamais modifiables depuis un écran, même dans le profil Test. L'éditeur sécurisé porte uniquement sur l'interprétation, et non sur ces invariants. Priorité : code immuable et canon > choix existants de l'histoire > préférences d'interprétation.
2. **Styles narratifs** : quatre profils existants, associés sans changement aux identifiants `heroique_epique`, `sombre_realiste`, `mysterieux_intrigant`, `leger_aventureux`. Densité, cadence et focalisation sont des choix typés avec validation stricte. Chaque changement remplace la formulation **Ton** dans le prompt via `instructionStyle` ; il n'ajoute pas de couche contradictoire. L'écran affiche l'instruction effectivement calculée. Ce comparatif de texte ne constitue pas encore un test A/B de génération réelle.
3. **Paramètres de l'aventure** : les six champs min/max Court (140–160), Moyen (215–235) et Long (280–320) restent des **champs numériques**. La page définit aussi les valeurs initiales des huit options que le joueur voit lors de la création d'une **nouvelle** histoire : ton, créativité, longueur, violence, romance, humour, rythme, liberté. Le joueur peut les modifier ; une histoire déjà sauvegardée conserve ses choix. Les nuances des niveaux proviennent toujours des fonctions validées de `promptBuilder.ts` et des règles de profil de contenu : elles ne sont **pas** librement réécrites par ce panneau.
4. **Paramètres techniques IA** : correction de température de créativité (bornée 0–2) et 19 paramètres potentiellement transmis au serveur `llama.cpp`. L'envoi est **désactivé par défaut**, avec sélection individuelle des champs. Quand Mirostat est actif, Top-P, Top-K, Min-P et Typical-P ne sont plus transmis par le client. **Attention :** ces valeurs ne sont pas certifiées compatibles avec la version du binaire RunPod effectivement chargée. Le tableau `NARRATEUR_COMPAT_LLAMA_20261009.md` documente la preuve disponible. Le contrôle de longueur et la validation de l'histoire restent distincts de la configuration des samplers.

Le code normalise maintenant la narration avant le dernier comptage et revalide le texte après régénération ; aucun vieux STATE DELTA ne doit être adopté tel quel lorsque le texte a changé.

## Contexte et mémoire

- **Lecture du dernier tour** : mesures réellement enregistrées avec le message du narrateur. Affiche les étapes de recherche, la voie lexicale/sémantique, les passages retenus si disponibles, les données d'état et les protections mobilisées.
- **Mémoire persistante** : historique, résumé, faits, entrées de lore émergent, événements et engagements ouverts. Ce sont des **comptes**, pas une preuve que tous ces éléments ont été envoyés intégralement au modèle.
- **Budget d'entrée** : quantité de caractères effectivement construite pour le prompt système et l'historique, avec plafonds de préparation. Les caractères ne sont pas des tokens. Les troncatures ne sont pas reconstruites si elles n'étaient pas diagnostiquées à l'époque.
- **Budget de sortie et latence** : nombre exact de tokens de narration uniquement si le statut de `/tokenize` est enregistré « exact ». Les statistiques d'appels regroupent génération, validation et éventuelle régénération ; elles ne correspondent **pas** à la longueur du texte affiché. P50/P95 sont calculés uniquement sur les diagnostics effectivement persistés (maximum 120 tours).
- **Budget de recherche** : source unique des réglages existants `budgetLorePassages` (caractères) et `maxSouvenirs` (nombre maximal). Aucun pourcentage de contexte fictif, aucun « coût en euros » déduit de l'usage API.
- **Métamoteurs** : statuts M01–M15 basés sur le contrat narratif effectivement tracé, pas sur l'exécution de quinze agents indépendants.
- **Confidentialité** : l'atelier n'affiche les détails d'histoire que localement dans l'espace concepteur. Le partage anonymisé reste dans **Instantanés et historique** ; ne jamais exporter les textes ou les secrets automatiquement.

## Recette et limites

CI requise : `npm test`, `npx tsc --noEmit`, `npx expo export -p web`. Les tests sur 120 tours de narration utilisent un **mock de comptage** ; ils démontrent un contrat logiciel, pas la stabilité du modèle après 120 tours réels. En l'absence d'autorisation de démarrer RunPod, il reste impossible de certifier les 19 samplers, le tokenizer du modèle réel, la latence longue durée, les effets créatifs et la qualité de cohérence sous charge.

Pour une recette RunPod payante, prendre les mesures (binaire, modèle, tokenizer, JSON des clés, résultats Court/Moyen/Long, latences) en une session courte préparée et arrêter le pod dès la fin. Ne pas fusionner cette PR en prétendant que ces essais ont déjà été effectués.
