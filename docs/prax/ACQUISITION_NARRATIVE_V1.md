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
5. Une distinction basique entre discours direct, citation, hypothèse et
   parole rapportée empêche de prendre certains énoncés non factuels pour une
   attaque, un vol ou un achat réalisé.
6. Quelques formes grammaticales (présent français et groupe nominal) sont
   désormais produites nativement par Prax, avec refus des flexions non couvertes.
7. Le narrateur test utilise cette composition native pour huit réactions
   verbales : écoute aimable, rebuffade, esquive, cession, résistance, retour
   d'insulte, rejet d'excuses et pardon. Toutes les autres réponses restent
   gérées par l'existant.

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
combinatoire limitée (présent et accord du groupe nominal seulement). La présence de formules lexicales courtes n'est pas
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
- Test complet : `npm test` et `npx tsc --noEmit` en CI de PR.
- Mesures Android : **non effectuées** ; ne pas annoncer de gains sur appareil.
- Comparaison stylistique à un LLM : **non effectuée**.
- Aucune fusion automatique, aucune migration de sauvegarde.
