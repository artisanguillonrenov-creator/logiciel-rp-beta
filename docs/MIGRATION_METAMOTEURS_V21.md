# Migration ciblée des méta-moteurs V2.1 vers la branche de production

Source préservée : \`gpt/metamoteurs-v2-1-native\`.

Cible : branche de production \`claude/new-session-glwy6e\`.

## Changements
- Transfert du code \`src/engine/narrativeBehaviorKernel.ts\` : M01–M15, décision locale par tour et contrat narratif compact.
- Raccordement effectif de ce contrat à \`construireCtxBase\`, puis à \`construireSystemPrompt\` (tours ordinaires, régénération, débogage, contexte pour illustration).
- Remplacement de la transmission automatique des 15 textes \`[MÉTA]\` (ancien \`metamoteurs.json\`) par le contrat conditionnel. Le fichier de données est conservé tel quel pour ne pas altérer le lore historique et pouvoir comparer les anciennes versions.
- Trace dans les diagnostics de tour et \`debugLore.metamoteurs\` des **responsabilités sélectionnées** et des raisons d'activation.
- Conservation des pipelines actuels (mémoire V13, validation d'état, recherche, fiche de scène, sécurité) sans copier leurs anciennes versions depuis la branche source.
- Le rappel de registre adulte n'impose plus artificiellement une intensité maximale dans les scènes calmes ; il reste conditionnel aux curseurs et aux situations.

## Limites de portée
Ce transfert rend les *15 responsabilités V2.1* présentes, sélectionnées par code et effectivement transmises au narrateur. Il ne prétend pas que 15 sous-moteurs indépendants de calcul/validation ont tous été implémentés. Les noyaux codés déjà existants pour la mémoire, les relations, la validation de continuité et l'état continuent de fonctionner indépendamment.

## Vérifications
Tests d'activation M01–M15, scène calme et scène complexe, présence du contrat dans le prompt et absence des 15 grandes fiches textuelles. Validation GitHub : \`npm test\`, \`npx tsc --noEmit\`, \`expo export -p web\`. Une APK compilée depuis la branche cible est nécessaire pour appliquer les changements au narrateur (ou OTA selon compatibilité, sans nouveau module natif dans ce transfert).
