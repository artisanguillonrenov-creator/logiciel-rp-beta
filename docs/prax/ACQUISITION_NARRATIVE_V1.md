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
7. Le narrateur expérimental utilise désormais dix-neuf types d'événements rendus par des intentions natives
   composées nativement. Les actions sociales continuent d'être décidées par
   le moteur Prax.
8. Les voix dialoguées consultent les relations que Prax vient de calculer
   (hostilité, peur, affection, confiance), sans calculer une nouvelle
   personnalité parallèle.
9. Les actes de parole ne fabriquent plus de gestes fictifs ; les rumeurs ne
   deviennent pas des témoignages oculaires inventés.
10. L'historique déjà sauvegardé dans l'application sert à éviter les
    répliques strictement répétées, sans nouvelle mémoire.
11. La trace des compétences réellement utilisées est jointe au compte rendu
    Prax du tour et peut être consultée dans les diagnostics du concepteur.
12. Le passé composé et l'imparfait sont réalisés dans un sous-ensemble
    contrôlé : le générateur refuse les formes dont il ignore l'accord.
13. Les observations hors du champ perceptif du joueur, les états mentaux
    privés et les succès d'attaque non attestés ne sont plus inventés.
14. La parole hypothétique, citée, rectificative ou rapportée du joueur est conservée
    textuellement dans la narration, sans réaliser l'action citée.


## Couverture de l'entraînement préparé (état vérifiable)

Le dossier préparé comprend **77 principes G1-G7**, **144 cas guidés** et
**60 exercices grammaticaux**. Sa fonction est de guider l'acquisition, et non
de donner l'illusion d'un apprentissage neuronal par lecture d'un fichier.

| Phase | Connaissances intégrées au cœur de Prax | Lacunes persistantes |
|---|---|---|
| G1 Français | Présent, imparfait, passé composé contrôlé, accords nominaux/adjectivaux partiels, élision, propositions composées | Analyse syntaxique générale, exceptions complètes, pronominalisation, subjonctif |
| G2 Pragmatique | Distinctions direct/cité/rapporté/hypothétique/négatif/rectificatif, provenance, questions simples | Ironie, inférences complexes, sous-entendus non explicites |
| G3 Conversation | 19 types de rendus dialogués composés dans le vocabulaire natif, continuité et interactions déjà présentes dans le moteur social | Négociation verbale libre, conversation de groupe ouverte |
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

- Tests `tests/praxAcquisitionNarrative.test.ts` et
  `tests/praxNarrateur.test.ts` :
  modalité du discours, montant invariant, abstention, générativité de base,
  variations stables, absence de mutation de monde, reprise après sauvegarde,
  conjugaison et accords sur des mots nouveaux.
- Workflow ciblé `prax-acquisition-narrative.yml` : compile les tests,
  exécute le lot narratif historique **et** celui ajouté, vérifie le
  TypeScript général et exporte le web. Il isole les six tests historiques
  défaillants d'autres fonctionnalités du narrateur.
- Le workflow général `npm test` échoue encore sur six tests préexistants
  (`deltaEtatSepare` et `narrateurConcepteur`).
- Mesures Android : **non effectuées** ; ne pas annoncer de gains sur appareil.
- Comparaison stylistique à un LLM : **non effectuée**.
- Aucune fusion automatique, aucune migration de sauvegarde.

## Condition réelle de clôture

Les résultats de la suite dédiée constituent une preuve de fonctionnement du
**palier symbolique** implémenté, pas une mesure de qualité équivalente à un
modèle de langage. Le benchmark sur les 54 cas aveugles et 16 scènes multitours,
la couverture exhaustive des 77 principes et les mesures sur Android restent
non démontrés. Les exemples du dossier ne sont pas importés comme répliques
préfabriquées : cela contredirait l'objectif de généralisation. Les correctifs
suivants devront rester dans le code natif de Prax, sans service externe.

## Corrections après audit

- **Demandes polies.** « Je voudrais… », « j'aimerais… » et « je pourrais avoir… » redeviennent des demandes
  au PNJ : seule une éventualité violente reste une parole. Un achat ou une location sans prix annoncé
  reste une demande au vendeur.
- **Menaces conditionnelles.** Une violence promise à l'interlocuteur (« si tu ne me rends pas ma bourse,
  je te frappe », « je pourrais te tuer ») devient une **menace**, avec les mots exacts du joueur. Ce n'est
  jamais une attaque. Une hypothèse posée en question reste une parole.
- **Questions et affirmations adressées.** « Je demande si tu as… » est une question au PNJ, et
  « je dis que tu es… » se raconte comme tes mots (« Tu dis à … »), pas comme des propos rapportés.
- **Répliques informatives.** *renvoyer* et *proposer* gardent les répliques du narrateur (« vois plutôt un
  marchand », « ça se paie »), sans les gestes inventés.
- **Français.**
  - Une espace avant « ? », « ! », « : » et « ; ».
  - « Il se dit qu'Arwen… » devant une voyelle.
  - « Tu évoques une hypothèse devant… », « Tu dis à… ».
- `statutEnonce` est inchangé ; seule la façon dont la compréhension s'en sert a changé.
  Tests : `tests/praxNarrateur.test.ts`, « demande polie, question adressée, menace conditionnelle ».
