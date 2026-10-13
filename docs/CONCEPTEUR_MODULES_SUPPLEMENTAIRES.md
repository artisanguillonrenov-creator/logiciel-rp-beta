# Concepteur — modules supplémentaires reliés

## Atelier visuel : configuration unique (V3)
\`src/concepteur/reglagesVisuels.ts\` (schéma 3, clé \`@elyndor/concepteur/visuel-v3\`) porte l'identité artistique globale, la consigne d'extraction universelle du narrateur, le positif et le négatif globaux, le cadrage, les références et les paramètres techniques par format. Toute image passe par \`src/engine/serviceVisuel.ts\`, qui n'envoie au générateur que ce qu'il prend en charge. L'ancienne configuration (\`visuel-v1\`) est migrée sans être modifiée. Détails : \`docs/ILLUSTRATION_V3.md\`.

**Ce que la fonction ne fait pas :** elle n'installe pas de module sur RunPod, ne remplace pas le modèle d'images et ne génère jamais d'image d'essai sans confirmation. Les protections du profil Grand public restent appliquées séparément.

## Maintenance : actions fonctionnelles à la demande
- Vérification du catalogue \`version.json\` par \`verifierMiseAJour\`; ouverture contrôlée des destinations GitHub/Expo officielles ;
- réessai des routines échouées à travers \`retryFailedAutomationJobs\` ;
- purge **confirmée** du cache d'embeddings, sans supprimer les histoires ;
- audit de la dernière histoire via le composant existant.

Il n'y a ni installation silencieuse d'APK, ni redémarrage serveur à distance, ni suppression massive du stockage. La version annoncée dans \`version.json\` peut être en retard sur les builds Android GitHub Actions : la comparaison n'est pas une attestation que l'APK courant est dernier.

## Administration commerciale : prévision uniquement
Le module commercial reçoit un simulateur mensuel local versionné \`@elyndor/concepteur/commercial-scenario-v1\` : montant d'abonnement, nombre d'abonnés envisagés, infrastructure et autres charges renseignées, frais de paiement supposés. Il calcule les recettes théoriques, charges saisies et différence **avant fiscalité**. Ce n'est pas un calcul de net fiscal ; il n'accède à aucune donnée bancaire, abonnement ni compte client.

**Non implémentés, car nécessitant un serveur sécurisé et des prestataires externes** : paiement et prélèvement réels, nombre d'abonnés constaté, facturation, remboursement, accès administrateur autorisé, gestion des droits joueurs, gestion commerciale automatisée. Ne pas considérer le simulateur comme une administration commerciale opérationnelle.

## Préservation
Les réglages introduits sont isolés des trois profils du concepteur existants, des histoires, du Lorebook et des données de paiement. Les sections Atelier visuel, Maintenance, Administration commerciale disposent chacune de leur page native via \`ModuleConcepteur\`. Les métamoteurs restent des responsabilités narratives mesurées, et non des moteurs autonomes désactivables.

## Validation avant fusion
\`npm test\`, \`npx tsc --noEmit\`, \`npx expo export -p web\`, compilation Android puis vérification tactile des actions.
