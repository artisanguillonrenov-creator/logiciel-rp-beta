# Atelier concepteur — Gestion de la cible RunPod V1

## Problème
Le pod Elyndor Cloud est initialement lu dans le fichier distant \`public/elyndor-cloud.json\`. Une migration RunPod nécessitait la modification de ce fichier GitHub ou du code, même pour un test personnel sur tablette.

## Fonction ajoutée
Dans **Réglages concepteur → RunPod et Cloud** :
- connaître l'identifiant réellement utilisé, sa source (intégrée, publiée, personnalisée) et les alias attendus ;
- saisir un autre **ID de pod RunPod**, strictement validé (8 à 32 caractères alphanumériques minuscules) ;
- tester les endpoints canoniques **en GET seulement** : port 8000 \`/v1/models\`, port 7860 \`/health\` et \`/v1/models\` ;
- enregistrer après confirmation la cible uniquement sur la tablette avec AsyncStorage, sans clé API ni URL libre ;
- revenir à la configuration publiée ou au secours embarqué avec confirmation ;
- recharger la configuration publiée à la demande.

## Invariants
- Ordre de résolution au premier appel après lancement : **personnalisé local → publié GitHub Pages → intégré**.
- Le client de narration, celui des images et les embeddings utilisent tous les URL issus du même pod courant. Aucune clé externe et aucun serveur LAN libre n'est configurable.
- Un diagnostic est **une réponse aux GET**, pas une garantie de capacité GPU, de démarrage autonome, de modèle chargé définitivement ni de vitesse de génération.
- Tester un pod peut provoquer un réveil et des frais hébergeur : l'interface le signale.
- Aucun appel à l'API d'administration RunPod n'est implémenté dans cette version. **Démarrage/arrêt, migrations et changement réel de modèles** exigent un backend administrateur avec autorisation forte et gestion serveur des secrets, avant exposition aux joueurs.
- Le mode concepteur est actuellement sans verrou fort : ne pas considérer son accès comme une preuve d'autorisation d'administration cloud. L'override reste **local à l'appareil** et n'accorde aucune capacité serveur.
- Les profils de l'atelier et les exports de configuration existants sont inchangés ; ils n'exportent ni clés, ni ID de pod local.

## Validation
\`npm test\`, \`npx tsc --noEmit\`, \`npx expo export -p web\`, compilation APK et vérification tactile.
