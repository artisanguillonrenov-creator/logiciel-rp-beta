# Diagnostic du pod — écran Narrateur IA / Technique

Le bouton **Tester la compatibilité du pod** se trouve dans le **mode concepteur → Narrateur IA → Technique**.

## Utilisation sur tablette Android

1. Le pod RunPod doit être déjà actif et son port d'inférence 8000 accessible.
2. Appuyer sur **Tester la compatibilité du pod** puis **Confirmer et lancer les tests**. Une confirmation est indispensable pour éviter une génération payante involontaire.
3. Le test lit l'état HTTP du serveur, `/v1/models`, `/props`, puis appelle `/tokenize` avec une phrase française contenant accents, guillemets et emoji.
4. Si la génération minimale à 3 tokens fonctionne, le diagnostic soumet une requête de 3 tokens pour chacun des **19 paramètres proposés**. Un seul sampler est ajouté à chaque requête, sur fond constant. Maximum **20 générations** par test complet.
5. L'écran indique **HTTP accepté**, **refusé**, **indéterminé** ou **non testé** avec le code HTTP et la durée de chaque sonde. Il est possible de demander l'annulation en cours de test.
6. Pour arrêter la facturation GPU après usage, arrêter le pod sur RunPod : le bouton d'annulation ne coupe que les tests, **jamais** le pod.

## Ce qui est prouvé et ce qui ne l'est pas

- **HTTP accepté** signifie que le serveur a renvoyé une réponse JSON compatible chat avec choix de génération en présence du paramètre. Le serveur peut avoir **ignoré** ce paramètre. Ni son application ni son effet narratif ne sont certifiés par cet essai.
- **Refusé** signifie rejet du paramètre avec HTTP 400 ou 422.
- Les erreurs 5xx, réponses HTTP dépourvues de choix, problèmes réseau et timeouts sont **indéterminés**.
- **Non testé** signifie que la génération témoin est impossible, que le test a été annulé, ou que la sonde n'a pas encore été lancée.
- Le tokenizer utilisé est celui du serveur accessible, pas un estimateur. La vérification du nombre de tokens ne certifie pas la qualité d'une longue réponse RP.
- La liste des modèles et le chemin de modèle déclarés peuvent refléter des alias ou des métadonnées du serveur. Ils ne prouvent pas une version précise de llama.cpp.
- Il ne s'agit pas d'un benchmark de génération de 120 tours, ni de mesures de cohérence narrative.

## Sécurité

Les tests utilisent les mêmes URL de pod que l'application. **Aucune clé RunPod n'est affichée** ; aucun terminal, commande distante, migration, redémarrage ni écriture de paramètres n'est effectuée. Les résultats restent dans l'état temporaire de l'écran ; ils n'activent pas les samplers et n'affectent pas les profils Production, Test et Benchmark.

Les requêtes sont séquentielles et ont un délai maximal de 25 secondes chacune pour les générations. Une requête en cours peut encore consommer des ressources pendant son annulation. Il n'y a **pas de démarrage automatique ni arrêt automatique du pod** par cette fonctionnalité. Le pod est facturable indépendamment du diagnostic.

La présence du bouton est testée par les vérifications TypeScript/Expo. Les tests unitaires injectent un serveur simulé : les 19 compatibilités du pod réel ne peuvent être confirmées qu'avec un test manuel sur le GPU autorisé.
