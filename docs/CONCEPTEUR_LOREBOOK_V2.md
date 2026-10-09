# Concepteur Elyndor V2 — navigation et Lorebook

## Navigation
L'écran « Réglages concepteur » n'affiche plus les détails des catégories sous les cartes. Il sert d'accueil. Chacune des 14 cartes ouvre sa propre page native React Navigation, avec retour Android. Les catégories « À développer » restent distinctes des fonctions actives.

## Lorebook
- Les 102 entrées de \`src/data/elyndorLore.json\` sont une base immuable. Les différences éditées, nouvelles fiches et brouillons sont conservés localement dans la clé AsyncStorage \`@elyndor/concepteur/lorebook-v1\`.
- Bibliothèque mixte : dossiers/sous-dossiers virtuels, catégories, filtres de statut, recherche intégrale et écran de fiche.
- Fiche : quatre onglets Contenu, Activation, Avancé, Diagnostic. Saisie du texte, clés principales/secondaires/négatives, priorité, portée, activation et dossiers.
- Fiches ordinaires : sauvegarde immédiate. Fiches constantes / royaumes / profils / personnages officiels : brouillon obligatoire suivi d'une confirmation de publication. Les nouvelles fiches débutent également en brouillon.
- Le Lore Core du code \`src/data/loreCore.ts\` n'est jamais modifié. Les métamoteurs V2.1 restent séparés.
- Historique borné à huit états, possibilité de restauration. Export JSON différentiel sans secrets ; import depuis le presse-papier dans les brouillons uniquement.
- Un bouton Assistant IA rédige, enrichit, réécrit ou vérifie la cohérence. Paramètres : court/détaillé/encyclopédique et fidélité stricte/créative. La proposition est **prévisualisée** ; « Accepter dans le formulaire » ne publie pas la fiche. L'IA ne peut pas transformer une fiche en « constante ».
- Lore émergent : explorer des entrées permanentes des 30 histoires locales récentes et en proposer une copie dans un brouillon de fiche. Les faits propres à la partie ne changent jamais automatiquement le canon global.
- Diagnostic : simulation **lexicale** au moyen du vrai sélecteur de passages, mais ce n'est pas une preuve d'injection réelle. Les embeddings, la scène et l'état du monde changent le résultat du vrai tour.
- Une fiche désactivée n'est plus injectée par la sélection de passages. Les éditions publiées sont relues avant chaque nouveau tour dans \`generateTurn.ts\` ; les vecteurs sont recomputés si le contenu change d'empreinte. Les rôles nommés dans \`canonElyndor.ts\` et le Lore Core restent statiques/protégés.

## Limites importantes
- Les modifications sont locales à la tablette : aucun accès automatique au dépôt GitHub et aucune synchronisation multi-appareil des publications. L'export permet une reprise manuelle de travail.
- Le mode concepteur actuel n'est pas encore authentifié par un code administrateur : **ne pas distribuer cette interface à des joueurs** avant mise en place d'un contrôle d'accès effectif. Aucun secret de RunPod ou de fournisseur n'est exposé.
- Les vérifications IA sont approximatives : contexte de référence limité à plusieurs fiches pertinentes et aucune garantie de non-contradiction. Il faut une validation humaine.
- Le chemin des rôles canoniques et les invariants de code ne doivent pas être remplacés silencieusement par une modification de lore. Une étape séparée sera nécessaire pour des changements structurants officiels.

## Vérifications requises avant fusion
\`npm test\`, \`npx tsc --noEmit\`, \`npx expo export -p web\`, APK Android, contrôles manuels tactile et édition.
