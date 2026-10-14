# Prax — Acquisition narrative native V1

Référence : chantier du 14 octobre 2026, sur la branche `feat/prax-acquisition-narrative-v1-20261014`.
Point de départ : PR Prax #113 à `d266b8e57a344b56a7fcb43a6032347bbd9f7540`.

## Ce qui a été réellement intégré

La compétence `prax-expression-fr-v1` vit dans le vocabulaire **natif**
`src/prax/vocab/conversation.ts`, déjà chargé par `src/prax/vocab/index.ts`.
Ce n'est pas un moteur de dialogue indépendant ni un LLM entraîné.

1. Une intention de parole (décidée dans le monde Prax) devient un texte par
   **composition de constituants** et de formulations.
2. Une signature de voix stable par identifiant de locuteur fournit une
   première différenciation d'expression. Un registre attesté peut la remplacer.
3. Les variations sont déterministes pour une même entrée et une même graine de
   variante. Aucun état de Prax n'est muté par la réalisation linguistique.
4. Les connaissances linguistiques sont des **définitions versionnées dans le
   code Prax** ; leur disponibilité n'est pas liée à une partie ou une mémoire
   parallèle. Les sauvegardes conservent uniquement le monde et ses événements.
5. Une distinction entre discours direct, citation, hypothèse, négation,
   éventualité et parole rapportée évite d'exécuter automatiquement les
   actions simplement mentionnées par le joueur.
6. Des formes grammaticales (présent français, groupes nominaux, accords
   adjectivaux courants) sont produites nativement, avec abstention lorsque
   la flexion ne peut être assurée.
7. Le narrateur expérimental utilise désormais dix-huit intentions de parole
   composées nativement. Les actions sociales continuent d'être décidées par
   le moteur Prax.
8. Les voix dialoguées consultent les relations que Prax vient de calculer
   (hostilité, peur, affection, confiance), sans calculer une nouvelle
   personnalité parallèle.
9. Les actes de parole ne fabriquent plus de gestes fictifs ; les rumeurs ne
   deviennent pas des témoignages oculaires inventés.
10. L'historique déjà sauvegardé dans l'application sert à éviter les
    répliques strictement répétées, sans nouvelle mémoire.
11. La parole hypothétique, citée ou rapportée du joueur est conservée
    textuellement dans la narration, sans réaliser l'action citée.


## Couverture de l'entraînement préparé (état vérifiable)

Le dossier préparé comprend **77 principes G1-G7**, **144 cas guidés** et
**60 exercices grammaticaux**. Sa fonction est de guider l'acquisition, et non
de donner l'illusion d'un apprentissage neuronal par lecture d'un fichier.

| Phase | Connaissances intégrées au cœur de Prax | Lacunes persistantes |
|---|---|---|
| G1 Français | Présent, imparfait, passé composé contrôlé, accords nominaux/adjectivaux partiels, élision, propositions composées | Analyse syntaxique générale, exceptions complètes, pronominalisation, subjonctif |
| G2 Pragmatique | Distinctions direct/cité/rapporté/hypothétique/négatif/rectificatif, provenance, questions simples | Ironie, inférences complexes, sous-entendus non explicites |
| G3 Conversation | 18 actes de parole composés dans le vocabulaire natif, continuité et interactions déjà présentes dans le moteur social | Négociation verbale libre, conversation de groupe ouverte |
| G4 Voix | Variation par locuteur, registre modulé par les relations existantes | Voix littéraire profonde, variation individualisée du lexique, tutoiement/vouvoiement complet |
| G5 Mise en scène | Préservation des faits, cadrage selon ce qui est perceptible, pas d'invention de gestes, détails de scène vérifiés | Dramaturgie longue, transitions et focalisation stylistique évolutive |
| G6 Variation | Ordre circonstanciel et choix composés, évitement de répétitions selon l'historique existant | Paraphrases ouvertes, images littéraires originales |
| G7 Vérification | Tests de causalité, chiffres, noms, citations, faux actes, sauvegarde et couverture historique | Benchmark humain, mesures Android, comparaison LLM et scènes aveugles complètes |

Cette table **n'atteste pas** que les 77 principes ou 144 cas sont tous
assimilés. Un critère de réussite n'est acquis que si un test dédié vérifie
la généralisation au-delà des exemples.

La branche demeure une intégration expérimentale, non fusionnée. Le workflow
dédié couvre les anciens tests Prax et les nouveaux, les types TypeScript
ainsi que l'export web. Le workflow général peut rester rouge sur les six
tests historiques liés aux contrôles de longueur du narrateur non Prax.

## G0 : ce que nous pouvons réellement affirmer

Prax **n'apprend pas automatiquement un corpus** : pas de fine-tuning, pas
de réseau neuronal ni de mécanisme général d'induction de règles à partir des
144 exemples. Ici, l'« acquisition » signifie **incorporation symbolique de
savoir-faire codé** et réutilisable dans des scènes nouvelles. Ce premier
palier peut être vérifié (noms et sujets inédits, conservation des valeurs,
restauration de l'état). Les exemples restent une matière de formation pour les
évolutions ultérieures ; il serait mensonger de prétendre que les 77 principes
sont déjà maîtrisés.

## Invariants

- Décisions, offres et faits viennent de Prax, pas de la formulation.
- Le vocabulaire narratif n'altère ni `State` ni son planificateur.
- Des prix sont reproduits tels que décidés, jamais inventés.
- Absence de fait pour `informer` : refus explicite de produire le texte.
- Identités, actes du joueur, chronologie et témoignages préservés.
- Aucun composant externe réutilisé ; productions originales uniquement.
- Règles liées à l'intimité, au commerce ou aux autres bibliothèques non modifiées.

## Limites et travaux restants

La V1 ne remplace pas un LLM narratif. Elle ne comprend pas librement le
français, ne couvre que certains actes de dialogue et possède une grammaire
combinatoire limitée (présent, noms, adjectifs et quelques actes de parole). La présence de formules lexicales courtes n'est pas
l'équivalent d'une improvisation générale. Les descriptions visuelles,
les voix individuelles fondées sur la personnalité réelle du monde, le contrôle
stylistique longue durée et la réalisation grammaticale complète restent à
développer dans les compétences natives existantes.

Les corpus originaux et les tests aveugles préparés restent séparés du code.
Aucune licence de source tierce n'a été incorporée.

## Vérification

- Tests `tests/praxAcquisitionNarrative.test.ts` :
  modalité du discours, montant invariant, abstention, générativité de base,
  variations stables, absence de mutation de monde, reprise après sauvegarde,
  conjugaison et accords sur des mots nouveaux.
- Workflow ciblé `prax-acquisition-narrative.yml` : compile les tests,
  exécute seulement le lot ajouté, vérifie le TypeScript général, exporte le
  web ; il isole ce lot des six tests historiques connus défaillants.
- Le workflow général `npm test` échoue encore sur six tests préexistants
  (`deltaEtatSepare` et `narrateurConcepteur`).
- Mesures Android : **non effectuées** ; ne pas annoncer de gains sur appareil.
- Comparaison stylistique à un LLM : **non effectuée**.
- Aucune fusion automatique, aucune migration de sauvegarde.
