# Bibliothèque universelle d'actions apprise à Prax

La « Bibliothèque universelle Prax-Elyndor » (616 actions, 28 domaines, licence MIT) a été enrichie,
dédoublonnée et apprise au narrateur Prax. Prax ne se limite plus à une vingtaine de gestes sociaux :
il reconnaît **572 actions** (5 595 expressions françaises) et en joue la mécanique dans son propre
moteur. Le moteur reste unique, tout comme la base de faits : la bibliothèque n'ajoute aucun moteur parallèle.

## Ce qui a été fait

1. **Enrichissement** (`tools/bibliotheque/SCHEMA_ENRICHISSEMENT.md`) : chaque action reçoit
   - une famille de mécanique parmi 18 ;
   - 6 à 15 expressions de joueur (infinitif, première personne, demande à la deuxième personne) ;
   - ses paramètres : cible, rôle qui peut répondre, autorité exigée, valence sociale, axe de relation,
     risque, durée, fatigue, prix d'après le lore en cuivres, compétence, lieu requis, produit,
     statuts posés, observable ou non, légal ou non ;
   - trois récits : celui du joueur, la réussite, l'échec.

   Le prix et la loi suivent le lore officiel : 1 or = 10 argent = 100 cuivre ; une chambre coûte 10 cuivres,
   un repas 3, un apprentissage 50.
2. **Dédoublonnage** (`tools/bibliotheque/fusion.py`).
   - 44 actions sont fusionnées dans celle qu'on garde (`fusionnees`) ; par exemple, *subtiliser* va dans *voler*.
   - 3 renvois circulaires entre lots sont tranchés.
   - Une expression ne sert jamais à deux actions.
   - 28 actions sont déjà jouées par le narrateur (`equivalentPrax` : saluer, payer, attaquer, marchander…).
     Elles passent par ses mécaniques existantes : le comportement n'est pas codé deux fois.
3. **Mécaniques natives** (`src/prax/bibliotheque/familles.ts`) : des pratiques Prax ordinaires
   (conditions, effets, dé du moteur, témoins, réputation), une par mode d'exécution.
   - Quand une action sert pour la première fois dans une partie, ses paramètres entrent dans l'état
     sous forme de faits `acte.<slug>.*` (`faitsActe`).
   - Les PNJ réagissent à l'acte selon des motivations `bib-*`, que le planificateur pèse.
4. **Compréhension et récit** (`src/engine/praxNarrateur/bibliotheque.ts`) :
   - l'expression la plus précise l'emporte, puis la même sans les pronoms (« je **lui** demande son nom »),
     puis la racine du verbe (« j'observe la salle ») ;
   - le montant se lit en cuivres (« 3 pièces d'or et 5 d'argent » = 350) ;
   - l'objet se lit tel qu'il est nommé, et « ma lanterne » devient « ta lanterne » dans le récit ;
   - l'interlocuteur est celui qu'on nomme, sinon quelqu'un qui a le rôle voulu, sinon le vendeur présent ;
   - quand c'est impossible, Prax dit pourquoi : rôle requis, lieu adapté, bourse, objet absent,
     arrêts, acte de meneur de jeu.

## Les modes d'exécution

| Mode | Ce que Prax joue | Réactions des PNJ |
|---|---|---|
| parole | l'acte touche la relation sur l'axe voulu (affection, respect, confiance, peur, hostilité) ; un acte négatif met en colère et se voit | accueille favorablement, reste froid, réplique, encaisse |
| requête | la demande attend une réponse ; un acte payant crée une dette `du.*` que « je paie » règle | accorde, accepte contre paiement, refuse, renvoie vers qui peut (rôles du catalogue) |
| information | la question attend une réponse | renseigne, se dérobe |
| influence | la pression pèse sur l'axe visé ; résister durcit l'hostilité | cède (statut posé), résiste |
| transaction | voir ci-dessous | accepte, contre-offre, refuse, constate l'insolvabilité, achète, refuse d'acheter, remercie |
| objet | prendre, poser, donner, s'équiper ou retirer, ouvrir, fermer, verrouiller ou déverrouiller, allumer, éteindre, examiner, briser, manipuler, avec des objets réels dans le lieu | accepte ou refuse un cadeau |
| repos | efface la fatigue, pose « reposé » | — |
| tentative | dé du moteur selon le risque et la compétence (faible 3/4 ou 7/8, moyen 1/2 ou 3/4, élevé 1/4 ou 1/2) ; réussite : statuts, produit fabriqué ; fatigue ; un acte illégal vu devient un délit | un acte hostile appelle une riposte |

**Transactions.** Les montants sont en cuivres et passent par la bourse de chacun : joueur 500,
marchand 5 000, autres 100 selon le rôle, captif 0.
- Chaque offre porte une **valeur de référence** : le prix courant de l'objet (table d'après le lore),
  sinon le prix indicatif de l'acte, sinon 5 pièces d'argent.
- Au moins la valeur : le marchand accepte, l'argent et l'objet changent de mains d'un seul geste.
- Entre la moitié et la valeur : il fait une contre-offre à sa valeur ; « j'accepte ta contre-offre » paie.
- Sous la moitié : il refuse.
- Une offre plus grosse que la bourse : il le constate.
- En vente, le joueur cède un objet qu'il possède, et le marchand achète jusqu'à la valeur.

**Loi.** Les objets d'un lieu appartiennent à qui y tient commerce ou accueille.
- Les prendre, ou tenter un acte illégal devant témoins, fait un délit.
- Le témoin juge l'auteur « hors-la-loi » (réputation de Prax). Un garde présent l'arrête.
- Aux arrêts, on ne peut plus rien tenter avant d'avoir payé son amende au garde (5 pièces d'argent
  par défaut, ou le montant dit). L'amende éteint les poursuites.
- La mort du personnage joueur n'est jamais automatique, et la captivité reste un statut, jamais un objet.

**Performance.** Le personnage du joueur est lié à une pratique vide (`spectateur`) : le planificateur des
PNJ ne simule jamais ses choix, mais la compréhension voit toutes ses actions possibles. Les actions de la
bibliothèque ne s'instancient que pour les actes déjà employés dans la partie.

## Maturité

L'échelle est celle de la bibliothèque d'origine (`maturite()` dans `catalogue.ts`) :
- **L1** : l'action est reconnue et classée, mais ce n'est pas une action de scène ; elle relève du meneur de jeu.
- **L2** : les préconditions sont évaluées sur l'état Prax, et l'action se tente au dé avec fatigue et témoins,
  sans effet propre sur le monde.
- **L3** : des effets propres sont appliqués et sauvegardés (argent, objets, statuts, produit, relations),
  et les PNJ y réagissent.
- **L4** suppose des essais variés sur Android : il se constate sur l'appareil, le code ne l'attribue pas.

| | L3 | L2 | L1 |
|---|---|---|---|
| **Total (572)** | **371** | **192** | **9** |
| requête (90), parole (35), transaction (41), influence (12), information (10), repos (12) | toutes | — | — |
| objet (49) | 19 | 30 (« manipuler » : nettoyer, peser, remplir…) | — |
| tentative (323) | 152 | 162 | 9 (création du monde) |

Par domaine :

| Domaine | Actions | L3 | L2 | L1 |
|---|---|---|---|---|
| administration | 15 | 11 | 4 | 0 |
| artisanat | 35 | 30 | 5 | 0 |
| combat | 28 | 22 | 6 | 0 |
| commerce | 37 | 33 | 4 | 0 |
| creation_monde | 9 | 0 | 0 | 9 |
| deplacement | 28 | 3 | 25 | 0 |
| diplomatie | 12 | 10 | 2 | 0 |
| economie | 17 | 11 | 6 | 0 |
| exploration | 19 | 3 | 16 | 0 |
| faction | 16 | 12 | 4 | 0 |
| famille | 13 | 13 | 0 | 0 |
| furtivite | 20 | 11 | 9 | 0 |
| guilde | 18 | 15 | 3 | 0 |
| immobilier | 14 | 12 | 2 | 0 |
| justice | 28 | 24 | 4 | 0 |
| magie | 25 | 9 | 16 | 0 |
| metier | 9 | 6 | 3 | 0 |
| nature | 13 | 10 | 3 | 0 |
| objets | 44 | 17 | 27 | 0 |
| politique | 24 | 17 | 7 | 0 |
| religion | 14 | 8 | 6 | 0 |
| sante | 10 | 8 | 2 | 0 |
| savoir | 20 | 5 | 15 | 0 |
| social | 42 | 42 | 0 | 0 |
| spectacle | 13 | 3 | 10 | 0 |
| survie | 28 | 22 | 6 | 0 |
| temps | 10 | 8 | 2 | 0 |
| transport | 11 | 6 | 5 | 0 |

## Tests (`tests/praxBibliotheque.test.ts`, 13 tests)

- **Catalogue** : il est complet (616 = 572 gardées + 44 fusionnées), les identifiants sont uniques,
  aucune expression n'est partagée, et chaque action a sa mécanique.
- **Montants** : ils se lisent et se formatent en cuivres.
- **Compréhension** : les pronoms intercalés et les verbes conjugués sont reconnus ; une phrase banale
  ne déclenche rien.
- **Marché complet** :
  1. l'offre est trop basse ;
  2. le marchand fait une contre-offre à 3 pièces d'argent ;
  3. « j'accepte » : 30 cuivres changent de bourse et la lanterne de mains, et le narrateur conclut ;
  4. le joueur revend la lanterne au juste prix.
- **Refus et lieu** :
  - une offre sous le plancher est refusée ;
  - une offre au-delà de la bourse est constatée par le marchand ;
  - un don au-delà de la bourse est refusé avec la raison ;
  - une chambre se loue au prix du lore.
- **Loi** : prendre le bien d'autrui devant la garde mène à l'arrestation. Aux arrêts, on ne peut plus rien
  tenter ; l'amende payée libère.
- **Objets du lieu** : prendre, examiner, poser ; reposer un objet qu'on n'a plus est refusé.
- **Raisons données** : rôle d'un juge, forge requise, acte de meneur de jeu.
- **Forge** : à la forge, forger se tente au dé.
- **Paroles, questions, requêtes** : une parole, une question et une requête obtiennent chacune une
  réaction de PNJ.
- **Reprise** : le jeu est déterministe et reprend depuis la sauvegarde, sans saisie résiduelle ; une partie Prax sauvegardée avant la bibliothèque est mise à niveau à la reprise.

Le test statique du narrateur installe les 572 actions et passe le vérificateur de Prax : aucune condition
morte, aucune variable libre, aucune incohérence de cardinalité.

## Limites connues

- **Une action par message.** « Je prends la chope puis je la pose » joue la première action reconnue.
- **Achat sans prix.** Un achat sans prix annoncé passe par la demande et le marchandage du narrateur,
  qui ne déplacent pas encore d'argent. Exceptions : un acte au prix fixé par le lore (« je loue une chambre »),
  et un prix annoncé (« pour 2 pièces d'argent »). Une question (« tu as une chambre ? ») reste une demande.
- **Compétences du personnage.** Elles ne sont pas encore lues dans sa fiche : les tentatives se font sans
  compétence, avec des chances plus faibles.
- **Contenu des réponses.** Une réponse d'information (« il te donne son nom ») ne sait pas ce que le PNJ
  sait vraiment. Le compte rendu transmet l'acte, pour que le futur modèle IA donne le contenu.
- **Choix des lots à trancher plus tard.** Les agents d'enrichissement les ont signalés :
  - *commencer* et *arrêter le travail* sont rangés en repos ;
  - *celebrer_mariage* exige un prêtre ;
  - le droit d'asile est donné au souverain, au prêtre et au noble ;
  - rejoindre le Culte des Voiles est illégal selon le lore, mais seulement noté (`illegal` reste faux) ;
  - quelques compétences sont hors de la liste de départ (orfèvrerie, tannerie, danse…).

## Régénérer le catalogue

```
python3 -I tools/bibliotheque/fusion.py <bibliothèque>/data/actions.fr.json <dossier des lots> src/prax/bibliotheque/catalogue.json --strict
```
