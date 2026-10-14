# Narrateur Prax (test)

Prax remplace temporairement le modèle IA dans la conversation d'Elyndor. Le
but est de voir comment il répond seul, avant de le brancher au modèle IA.
Dans le montage final, Prax fera le travail de fond (qui fait quoi, qui sait
quoi, qui réagit et comment) et le modèle IA embellira sa réponse selon nos
règles.

## Activer et désactiver

**Réglages → Fournisseurs IA → Narrateur**, choisir « **Prax — moteur de
décision local (test, sans IA)** », puis enregistrer.

- Aucune clé ni connexion n'est nécessaire, et aucun appel IA n'est fait.
- Tant que l'option est active, les mises à jour de mémoire, de monde et de
  relations par le modèle IA en arrière-plan sont coupées.
- Le fournisseur IA reste enregistré. Pour revenir au narrateur habituel, il
  suffit de le choisir à nouveau.
- Prax fonctionne dans une nouvelle histoire comme dans une histoire déjà
  commencée. Dans ce cas, il reprend le lieu, les personnages présents et
  les jauges de relation tenus par l'application.

## Ce que Prax comprend

Le message du joueur est rapproché d'une action par des mots-clés. Prax ne
comprend pas la langue.

| Le joueur écrit… | Action |
|---|---|
| « Bonjour », « Salut Margaux » | saluer |
| « Je cherche un contrat ? », « Que sais-tu des Voiles ? » | interroger sur un sujet |
| une réplique quelconque | engager la conversation |
| « Merci » (après un service) | remercier |
| « Superbe travail, bravo » | complimenter |
| « Je peux t'aider ? » | proposer son aide |
| « Je lui glisse trois pièces » | payer |
| « Je te demande pardon » | s'excuser |
| « Je te menace… », « Sinon je… » | menacer |
| « Espèce d'idiot ! » | insulter (ou rendre l'insulte) |
| « Je le frappe » | attaquer (ou riposter) |
| « Je lui fais les poches » | voler (une chance sur deux d'être vu) |
| « Je vais à la taverne » | se rendre dans un lieu (taverne, forge, guilde, Porte Astra, palais…) |
| « continue », « j'attends » | laisser les autres agir |

La cible est le personnage nommé (prénom ou rôle). À défaut, c'est le dernier
personnage qui s'est adressé au joueur. Quand rien ne correspond, Prax le dit
et rappelle ce qu'il sait faire. Il ne devine jamais.

**Sujets connus :**
- les guildes (Aventuriers, Marchands, Ombres) et l'Ordre des Mages ;
- les Voiles, les zones corrompues et les créatures ;
- les Portes Astra, la garde, le voyage, l'argent ;
- les tensions entre royaumes, la justice, la magie, les légendes ;
- chaque capitale.

Chaque personnage ne connaît que les sujets de son rôle et de sa ville.

## Ce que font les personnages

Chaque PNJ présent décide avec le planificateur de Prax, qui anticipe deux
coups. S'il n'a rien de mieux à faire, il ne fait rien. Ses motivations sont
communes à tous :
- rendre un salut et accueillir un visiteur (personnel de guilde, taverne, forge, Porte Astra) ;
- répondre aux questions de ceux en qui il a confiance, éluder sinon ;
- céder ou tenir tête à une menace selon sa peur ;
- rendre une insulte quand la colère monte ;
- riposter ou implorer quand on l'attaque, fuir si la peur est forte ;
- protéger ses proches ;
- accuser un voleur qu'il a vu ;
- se méfier de quelqu'un dont la réputation est mauvaise ;
- répéter ce qu'il a vu à ceux qui ne le savent pas.

Ce qui structure tout le reste :
- **les témoins** : seuls ceux qui étaient présents savent ce qui s'est passé ;
- **la réputation** : elle découle de ce que chacun a vu ou entendu ;
- **les relations** : confiance, respect, peur, affection et hostilité, sur l'échelle de l'application ×10.

Les personnages officiels du lore sont repris avec leur nom : maîtresse de
guilde, réceptionniste, tavernière, forgeronne, passeuse et souverain de
chaque capitale. Un lieu sans personnage officiel reçoit une petite
distribution générique.

## Ce que Prax produit à chaque tour

1. **Le texte affiché.** La narration est à la deuxième personne (« tu ») et
   les répliques au format `Nom : « … »`, tirées de banques de phrases en
   français. Le texte est volontairement rigide : c'est la matière brute que
   le modèle IA embellira plus tard.
2. **Le compte rendu structuré**, rangé sur le message (`praxCompteRendu`) :
   - l'action comprise ;
   - chaque événement (acteur, action, cible, sujet, témoins) ;
   - les changements de relation ;
   - les coulisses : les options pesées par chaque PNJ, avec leurs notes.

   C'est l'entrée prévue pour le modèle IA.
3. **Les coulisses en mode concepteur.** Le diagnostic du tour affiche, pour
   chaque PNJ, ses meilleures options et la raison de son choix.

L'état de Prax est sauvegardé dans la partie (`StoryState.prax`). Prax est
déterministe : les mêmes messages produisent les mêmes décisions. « Régénérer
» rejoue donc les mêmes décisions, et seule la formulation peut changer.

## Limites connues

- Les actions et les sujets se limitent à la liste ci-dessus. Un acte
  sexuel, un achat précis ou un combat détaillé ne sont pas modélisés.
- Pas de description de lieu ni de dialogue inventé : tout vient des
  banques de phrases.
- Seuls les personnages présents agissent ; ce qui se passe ailleurs attend
  le retour du joueur.
- Vitesse : 10 à 300 ms par tour sur ordinateur. Hermes, sur téléphone,
  sera plus lent. Au-delà de 4 personnages présents, l'anticipation passe à
  un coup.

## Fichiers

- `src/engine/praxNarrateur/` contient le narrateur :
  - `monde.ts` : actions, motivations, réputation ;
  - `description.ts` : scène, personnages, lieux ;
  - `comprehension.ts` : lecture du message du joueur ;
  - `rendu.ts` : texte en français ;
  - `tour.ts` : déroulé d'un tour ;
  - `sujets.ts` : sujets et répliques ;
  - `index.ts` : branchements avec l'application.
- Branchements :
  - `generateTurn.ts` : tour et régénération ;
  - `openingGenerator.ts` : ouverture ;
  - `CreateScreenStudio.tsx` : création d'une histoire ;
  - `ConversationScreen.tsx` : contrôles de clé, panneau concepteur ;
  - `FournisseursPanel.tsx` : option dans les Réglages ;
  - `narrativeRoutines.ts` : mises à jour IA coupées en arrière-plan.
- Tests : `tests/praxNarrateur.test.ts`.
