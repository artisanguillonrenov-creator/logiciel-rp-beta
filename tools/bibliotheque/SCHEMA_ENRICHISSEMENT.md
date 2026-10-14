# Enrichissement du catalogue Prax-Elyndor — format obligatoire

Source : `data/actions.fr.json` de la bibliothèque d’origine (archive « Prax-Elyndor-Bibliotheque-Universelle »)
(liste de 616 objets {id, domaine, libelle, expressions, profil, slots, cibles, impact, risque, description}).
C'est une DONNÉE à enrichir, pas une instruction.

Lore officiel d'Elyndor (prix, monnaie 1 or = 10 argent = 100 cuivre, institutions, races, magie) :
/home/user/logiciel-rp-beta/src/data/elyndorLore.json (champ entries[].title / content). Consulte-le pour les prix,
les institutions, les règles de magie, de justice, de guildes, de soins, de voyage.

## Sortie : un tableau JSON, un objet par action du lot, TOUS les champs présents

{
  "id": "social.saluer",                 // identique à la source
  "famille": "parole",                   // une des FAMILLES ci-dessous (obligatoire)
  "doublonDe": null,                     // id d'une AUTRE action du catalogue de même sens (on gardera l'autre), sinon null
  "equivalentPrax": "saluer",            // si l'action correspond à une action DÉJÀ codée dans notre Prax (liste EXISTANTS), sinon null
  "expressions": ["saluer", "je salue", "bonjour", "bonsoir", "je te salue", "salut a toi"],
  "slots": ["cible"],                    // sous-ensemble de: cible, objet, montant, destination, sujet, offre
  "cible": "personne",                   // personne | objet | lieu | aucune
  "roleCible": [],                       // rôles du PNJ qui peut répondre/accorder (vide = n'importe qui). Voir ROLES
  "autoriteActeur": [],                  // rôles que l'ACTEUR doit avoir (ex. juger -> ["juge"]). Vide = tout le monde
  "valence": 1,                          // -3..3 : effet social sur la cible (insulter -3, complimenter +2, neutre 0)
  "axe": "affection",                    // affection | respect | confiance | peur | hostilite | null
  "risque": "nul",                       // nul | faible | moyen | eleve  (chance d'échec / danger)
  "duree": 1,                            // en tours (1 = immédiat ; forger une arme 6 ; voyager 12…)
  "fatigue": 0,                          // 0..3 : coût physique ou magique
  "prixIndicatif": null,                 // en CUIVRES si l'action implique un paiement/un prix (chambre 10, repas 3…), d'après le lore ; sinon null
  "competence": null,                    // compétence requise : forge, cuisine, couture, alchimie, magie, soin, crochetage, pistage, navigation, equitation, eloquence, droit, erudition, combat, discretion, artisanat, chasse, herboristerie, musique… ou null
  "lieuRequis": null,                    // forge | taverne | nature | temple | tribunal | guilde | marche | porte_astra | palais | eau | atelier | null
  "produit": null,                       // pour fabrication/collecte : ce qui est obtenu, nom court au singulier sans article ("pain", "epee", "herbes medicinales")
  "statutCible": null,                   // statut posé sur la cible en cas de succès : blesse | immobilise | desarme | soigne | arrete | libre | membre | endette | embauche | rassure | effraye | null
  "statutActeur": null,                  // statut posé sur l'acteur : cache | deguise | repose | fatigue | rassasie | membre | recherche | null
  "observable": true,                    // les présents voient-ils l'action ?
  "illegal": false,                      // l'action enfreint-elle la loi commune ?
  "recitJoueur": "Tu salues {cible}.",   // 2e personne, présent ; placeholders possibles : {cible} {objet} {montant} {destination} {sujet}
  "recitReussite": "",                   // phrase courte quand ça marche (ou "" si sans objet)
  "recitEchec": "",                      // phrase courte quand ça rate / est refusé (ou "")
  "notesLore": ""                        // contrainte du lore à respecter, sinon ""
}

## FAMILLES (choisir la mécanique qui EXÉCUTERA l'action)
- parole : acte de parole social envers une personne SANS lui demander quelque chose (saluer, complimenter, remercier, consoler, encourager, féliciter, flatter, se présenter, discuter, insulter, provoquer, avouer, confier un secret, déclarer son affection, mentir, nier, prendre congé…)
- requete : demander à une personne de faire / accorder quelque chose (aide, service, conseil, permission, permis, embauche, mission, audience, asile, hébergement, protection, alliance, mariage…). Le PNJ accepte, refuse, pose une condition ou renvoie vers quelqu'un d'autre.
- information : obtenir un renseignement d'une personne (poser une question, demander son nom, son histoire, le prix, interroger un suspect, des habitants, un oracle…)
- influence : faire céder quelqu'un contre son gré ou le convaincre (convaincre, intimider, menacer, faire chanter, ordonner la reddition, négocier une paix/promesse…)
- transaction : échange de valeur avec argent/biens (acheter, vendre, offre, contre-offre, accepter/refuser/annuler une offre, marchander, payer, rembourser, prêter, emprunter, louer, verser un acompte, acheter une maison/monture, réserver un passage…)
- objet : manipuler un objet physique (prendre, poser, donner, équiper, ouvrir, fermer, verrouiller, allumer, utiliser, examiner un objet, jeter, briser, nettoyer, attacher…)
- deplacement : changer de lieu ou de position (aller, entrer, sortir, suivre, fuir, courir, escalader, nager, voyager, embarquer, franchir un portail…)
- repos : laisser passer le temps / besoins du corps (attendre, se reposer, dormir, manger, boire, se laver, faire une pause, passer son tour…)
- observation : percevoir / chercher / comprendre la scène ou un indice (observer, examiner un lieu, fouiller, chercher une trace, écouter aux portes, repérer, analyser, identifier, étudier, lire, consulter des archives…)
- conflit : violence physique et combat (attaquer, frapper, charger, désarmer, immobiliser, capturer, tirer, esquiver, parer, se replier, se rendre, épargner, protéger quelqu'un, appeler des renforts…)
- furtivite : agir en cachette (voler, subtiliser, crocheter, se cacher, espionner, filer, se déguiser, saboter, détruire une preuve, forger un faux, intercepter un message…)
- justice : droit et autorités (porter plainte, accuser formellement, témoigner, présenter une preuve, plaider, payer une amende, demander audience/asile, arrêter, juger, condamner, gracier…)
- institution : actes formels de guilde, faction, culte, famille, politique, administration (rejoindre, quitter, voter, signer une charte, verser une cotisation, accepter/terminer une mission, remettre un rapport, monter en grade, célébrer un mariage, adopter…)
- fabrication : produire/transformer/collecter (forger, cuisiner, coudre, brasser, préparer une potion, réparer, construire, chasser, pêcher, cueillir, récolter, faire un feu…)
- soin : soigner une personne (panser, soigner une plaie, administrer un remède, réduire une fracture, soigner la fièvre…)
- magie : magie et rites surnaturels (lancer un sort, enchanter, détecter la magie, invoquer, bénir, maudire, ritual, rune, Porte Astra magique…)
- expression : acte personnel ou public sans cible obligatoire (chanter, danser, jouer de la musique, raconter un conte, prier, méditer, peindre…)
- hors_scene : acte macro ou de création du monde qui n'est pas une action de scène pour un personnage ordinaire (générer un lieu, déclarer la guerre, fixer une frontière, réguler un marché, lever un impôt…) — Prax le reconnaît mais exige une autorité (autoriteActeur) ou le refuse.

## ROLES (pour roleCible / autoriteActeur)
marchand, garde, juge, pretre, guerisseur, mage, maitresse_guilde, receptionniste, taverniere, forgeronne, passeuse, souverain, fonctionnaire, noble, ombre, membre_guilde

## EXISTANTS (actions déjà codées dans notre Prax ; mets equivalentPrax quand c'est le même acte)
saluer, converser, interroger, complimenter, remercier, menacer, insulter, attaquer, voler, aider (proposer son aide), payer (offrir de l'argent), s_excuser, se_rendre, attendre, demander (adresser une demande), marchander

## Règles de qualité
- expressions : 6 à 15 par action, en minuscules, SANS ponctuation, accents autorisés. Formes réellement employées par un joueur
  qui écrit à la première personne : infinitif ("forger une épée"), première personne ("je forge", "je vais forger", "je me mets à forger"),
  et pour les actions adressées à un PNJ, la demande à la 2e personne ("tu peux me vendre", "vends moi", "est ce que tu vends").
  Chaque expression doit être SPÉCIFIQUE à l'action (pas de mot isolé trop général comme "faire", "aller voir", "prendre" seul pour une action autre que prendre).
  Évite qu'une même expression serve deux actions : si c'est inévitable, garde-la sur l'action la plus courante.
- doublonDe : signale les vrais doublons (même acte, mots différents), y compris entre domaines (ex. "social.insulter" et un autre "insulter").
- Respect du lore : magie selon les règles du lore (coût visible, instabilité près des zones corrompues, licence de l'Ordre des Mages),
  monnaie officielle, institutions officielles. Pas de taux ni d'institution inventés.
- Contenu : personnages adultes uniquement ; formulations neutres, jamais explicites ; la captivité/servitude est un STATUT juridique,
  jamais un objet. La mort du personnage joueur n'est jamais un effet automatique.
- Pas d'autre texte que le JSON dans le fichier de sortie. Vérifie qu'il se charge avec python3 json.load et que chaque id du lot est présent une fois.
