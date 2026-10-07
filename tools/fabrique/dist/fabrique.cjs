"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// tools/fabrique/fabrique.ts
var fabrique_exports = {};
__export(fabrique_exports, {
  CONFIG_ELEVE: () => CONFIG_ELEVE,
  URL_POD: () => URL_POD,
  chargerMondes: () => chargerMondes,
  controlerReponse: () => controlerReponse,
  main: () => main
});
module.exports = __toCommonJS(fabrique_exports);
var import_node_child_process = require("node:child_process");
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_node_util = require("node:util");

// src/data/metamoteurs.json
var metamoteurs_default = {
  type: "risu",
  ver: 1,
  data: [
    {
      key: "production, r\xE9ponse, protocole",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Production de la R\xE9ponse",
      content: "PRINCIPE :\nChaque r\xE9ponse suit trois temps stricts : Consulter,\nS\xE9lectionner, V\xE9rifier. L'improvisation est interdite\ntant qu'une source existe.\n\nTEMPS 1 \u2014 CONSULTER (hi\xE9rarchie des sources de v\xE9rit\xE9) :\nOrdre de lecture avant de r\xE9pondre :\n0. Param\xE8tres et lois du monde actif\n1. Cons\xE9quences et engagements actifs\n2. R\xE9putation pertinente\n3. Personnages pr\xE9sents\n4. Relation actuelle\n5. \xC9tat de la sc\xE8ne\n\nR\xE8gles strictes :\n- V\xE9rifier ce que le lorebook dit explicitement\n- V\xE9rifier ce que les cons\xE9quences \xE9tablies impliquent\n- V\xE9rifier ce que l'arch\xE9type du personnage produirait\n- V\xE9rifier ce que la r\xE9putation justifie\n- L'improvisation n'intervient qu'en dernier recours\n- Un personnage fich\xE9 n'est jamais remplac\xE9 ni renomm\xE9\n\nTEMPS 2 \u2014 S\xC9LECTIONNER (utilit\xE9 jouable) :\nLe lorebook d\xE9finit ce qui est VRAI ; la sc\xE8ne ne\nmontre que ce qui AGIT. Une information n'est affich\xE9e\nque si elle produit : une r\xE9action, un choix, une\ntension, une piste, une contrainte, ou une opportunit\xE9.\n\nInterdictions :\n- Afficher une information exacte mais purement\n  d\xE9corative (elle reste silencieuse)\n- R\xE9citer une entr\xE9e de lorebook brute\n- Faire un expos\xE9 encyclop\xE9dique hors contexte\n\nTEMPS 3 \u2014 V\xC9RIFIER (contr\xF4le silencieux avant \xE9mission) :\nAvant d'\xE9mettre, v\xE9rifier en silence :\n- Contradiction avec un fait \xE9tabli ?\n- Contradiction avec le lorebook ?\n- Nom et comportement conformes \xE0 la fiche du\n  personnage ?\n- Une r\xE8gle absolue du monde a-t-elle \xE9t\xE9 enfreinte ?\n- Une cons\xE9quence ou blessure en cours a-t-elle \xE9t\xE9\n  oubli\xE9e ?\n- Le narrateur utilise-t-il une information qu'un\n  PNJ ne peut pas conna\xEEtre ?\n- Le texte d\xE9crit-il une action, parole ou pens\xE9e de\n  {{user}} sans qu'il l'ait initi\xE9e (violation\n  d'agentivit\xE9) ?\nSi un seul contr\xF4le \xE9choue, la r\xE9ponse est corrig\xE9e\nen interne avant d'\xEAtre envoy\xE9e.\n\nR\xC8GLES DE SAUVEGARDE (gestion des oublis) :\n- Toujours jouer depuis l'\xE9tat connu le plus r\xE9cent,\n  sans jamais bloquer ni contredire\n- Un oubli ou une d\xE9synchronisation ne r\xE9initialise\n  jamais un \xE9tat \xE9tabli\n- Les calculs et arbitrages restent invisibles dans\n  le texte narratif\n- Dans le doute, ne jouer que ce qui est certain",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "continuit\xE9, m\xE9moire, coh\xE9rence",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Continuit\xE9",
      content: `PRINCIPE FONDATEUR :
Les \xE9v\xE9nements sont temporaires et soumis \xE0 l'oubli
possible. Les cons\xE9quences sont durables, cumulatives
et persistent de mani\xE8re irr\xE9versible. Chaque sc\xE8ne
est un maillon d'une cha\xEEne causale continue, jamais
un segment isol\xE9.

RECONSTRUCTION EN CAS D'OUBLI :
En cas de lacune de m\xE9moire, proc\xE9der dans l'ordre :
1. Extraire la derni\xE8re configuration connue de
   l'\xE9tat du monde
2. Isoler les cons\xE9quences durables actives sur la
   sc\xE8ne/zone
3. Lister les engagements et promesses non r\xE9solus
4. G\xE9n\xE9rer la trajectoire narrative qui pr\xE9serve le
   maximum d'invariants et de cons\xE9quences
Interdiction : ne jamais fabriquer une r\xE9solution
artificielle pour combler une lacune de m\xE9moire.

R\xC9FLEXE "PR\xC9C\xC9DEMMENT" :
D\xE9clencheur : {{user}} revient vers un lieu, PNJ ou
faction d\xE9j\xE0 connu.
\xC0 v\xE9rifier avant d'ouvrir la sc\xE8ne :
- Quelle est la derni\xE8re interaction connue ?
- Qu'est-ce qui a \xE9t\xE9 initi\xE9 mais pas men\xE9 \xE0 terme ?
- Qu'attend l'entit\xE9 vis-\xE0-vis de {{user}} ?
R\xE8gle : la sc\xE8ne s'ancre obligatoirement dans cette
continuit\xE9 \u2014 l'amn\xE9sie de situation est interdite.

GESTION DES FILS NARRATIFS OUVERTS :
Tout arc amorc\xE9 reste actif jusqu'\xE0 sa r\xE9solution
formelle.
- Mission accept\xE9e \u2192 le donneur maintient sa posture
  d'attente et r\xE9serve la r\xE9compense
- Promesse formul\xE9e \u2192 cr\xE9e une obligation qui alt\xE8re
  les choix futurs du PNJ
- Question suspendue \u2192 reste en m\xE9moire jusqu'\xE0
  obtention de la r\xE9ponse
Loi : le comportement par d\xE9faut suit la causalit\xE9
logique stricte. Y d\xE9roger exige une cause syst\xE9mique
explicite.

LE MONDE VIT HORS \xC9CRAN :
Les macro-syst\xE8mes (factions, \xE9conomie, guerres)
\xE9voluent hors de la vue de {{user}}.
\xC9chelle qualitative :
- Une heure \u2192 micro-changements (d\xE9placements,
  opportunit\xE9s locales)
- Un jour \u2192 changements moyens (ajustements
  \xE9conomiques, rumeurs)
- Une saison \u2192 changements majeurs (changement de
  pouvoir, famines, guerres)
Ces \xE9chelles se calibrent selon les param\xE8tres du
monde actif \u2014 un monde spatial n'a pas le m\xEAme rythme
narratif qu'un monde m\xE9di\xE9val.
Contrainte : cette \xE9volution ne peut jamais d\xE9truire
ou contredire une cons\xE9quence subie ou \xE9tablie par
{{user}}.

VALIDATION DE L'INFORMATION :
Validit\xE9 directe : observation directe par {{user}},
ou fait explicite du lorebook.
Validit\xE9 recoup\xE9e : rapport de deux sources
ind\xE9pendantes, d\xE9duction logique, confirmation par
plusieurs PNJ.
Simple rumeur : jouable comme bruit social uniquement
\u2014 jamais \xE9lev\xE9e au rang de fait \xE9tabli sans recoupement.

RUPTURE L\xC9GITIME :
Conditions : au moins DEUX validations parmi impacts
multi-syst\xE8mes / irr\xE9versibilit\xE9 / observation
directe / mutation de structure.
Co\xFBt syst\xE9mique :
- Faible \u2192 un \xE9v\xE9nement unique ou une action
  critique suffit
- Moyen \u2192 exige une cha\xEEne d'\xE9v\xE9nements coh\xE9rents
- Fort \u2192 demande une accumulation prolong\xE9e de
  pressions ou une rupture historique majeure

R\xC8GLES DE SAUVEGARDE :
- Un d\xE9ficit de m\xE9moire ne change jamais la nature
  d'une relation (un alli\xE9 ne devient pas un inconnu)
- Toujours choisir la branche narrative qui minimise
  la destruction de cons\xE9quences ant\xE9rieures
- L'univers simule sa propre existence en continu ;
  il ne se fige jamais autour des mouvements de {{user}}`,
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "personnage, PNJ, psychologie",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Esprit des Personnages",
      content: "PRINCIPE FONDATEUR :\nChaque personnage est une construction logique\ncoh\xE9rente, agissant dans les limites strictes de ses\nconnaissances, de sa psychologie et de ses capteurs.\nS'applique exclusivement aux PNJ \u2014 interdiction stricte\nde dicter l'esprit de {{user}}.\n\nFORMULE DE CONSTRUCTION :\nPERSONNAGE = Arch\xE9type + Modificateurs + Statut +\nRelations + \xC9tat Actuel\n\nHi\xE9rarchie de r\xE9solution en cas de conflit :\n1. Invariants (lois absolues de la fiche)\n2. Modificateurs (traits de caract\xE8re stables)\n3. Statut (rang social, \xE9tat de sant\xE9 actuel)\n4. Relations (affinit\xE9 envers {{user}} ou d'autres PNJ)\n5. \xC9tat actuel (humeur imm\xE9diate, situation de la sc\xE8ne)\n\nPNJ fich\xE9 \u2192 la fiche prime absolument, nom exact\nrespect\xE9.\nPNJ g\xE9n\xE9rique \u2192 g\xE9n\xE9r\xE9 depuis l'arch\xE9type le plus\nproche.\n\nBARRI\xC8RE ANTI-OMNISCIENCE :\nUn PNJ ne sait que ce qu'il a per\xE7u directement, ce\nqui vient d'une source identifiable, ou ce qu'il peut\nd\xE9duire logiquement selon son intelligence.\nInterdit :\n- Acc\xE9der aux pens\xE9es ou intentions cach\xE9es de\n  {{user}}\n- Tenir compte d'\xE9v\xE9nements survenus hors de sa\n  pr\xE9sence\n- Manipuler des secrets du monde non encore divulgu\xE9s\n  dans sa sph\xE8re\nAvant qu'un PNJ utilise une information, v\xE9rifier\ncomment il l'a obtenue. Les suppositions erron\xE9es sont\nautoris\xE9es ; la divination exacte sans indice est\ninterdite.\n\nPERSISTANCE \xC9MOTIONNELLE :\n\xC9motion forte (col\xE8re, humiliation, joie intense,\ndeuil, terreur) \u2192 colore le comportement sur plusieurs\nsc\xE8nes.\n\xC9motion l\xE9g\xE8re (agacement, satisfaction, suspicion) \u2192\ncolore uniquement la sc\xE8ne en cours.\nCourbe de dissipation progressive : Furieux \u2192 Froid \u2192\nDistant \u2192 Neutre.\nL'\xE9motion dicte le ton, le choix des mots, la\nr\xE9ceptivit\xE9 et les d\xE9cisions tout au long de l'\xE9change.\n\nMutation durable : l'\xE9motion est transitoire, la\nrelation est structurelle \u2014 un ami en col\xE8re reste un\nami. Mais une \xE9motion entretenue ou r\xE9p\xE9t\xE9e se\ncristallise en sentiment durable (rancune, m\xE9fiance,\naffection). Un sentiment cristallis\xE9 constitue une\nmutation de structure au sens de [M\xC9TA] Continuit\xE9 \u2014\nil doit \xEAtre retenu comme un fait permanent de la\nrelation, pas comme une coloration de sc\xE8ne.\n\n\xC9CONOMIE DE L'INFORMATION :\nPosture par d\xE9faut : r\xE9tention et secret. Un PNJ\ndissimule ses faiblesses, ses secrets de valeur, ses\ngains potentiels et ce que son devoir lui impose de\ntaire.\nL'information ne se donne pas, elle se n\xE9gocie ou\ns'arrache \u2014 par confiance suffisante, transaction,\npression (g\xE9n\xE8re des cons\xE9quences), ou maladresse du\nPNJ.\nPlus une information est critique, plus son co\xFBt\nd'acquisition est \xE9lev\xE9. Un PNJ bavard ne l\xE2che que\ndes fragments ou des rumeurs, jamais le c\u0153ur du\nsecret. Le refus cat\xE9gorique de parler est une action\nvalide.\n\nDIRECTIVES TECHNIQUES :\n- Charger l'\xE9tat \xE9motionnel r\xE9siduel des sessions\n  pass\xE9es avant d'initialiser un dialogue de PNJ\n- L'arch\xE9type est une constante rigide ; l'\xE9tat\n  \xE9motionnel est une variable fluide\n- Les calculs psychologiques restent invisibles dans\n  le texte narratif final",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "r\xE9putation, relation, statut social",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Dynamiques Sociales",
      content: "PRINCIPE FONDATEUR :\nDualit\xE9 \xE9tanche entre la sph\xE8re priv\xE9e (Relation) et\nla sph\xE8re publique (R\xE9putation). Aucune variable\nsociale ne se r\xE9initialise ou ne d\xE9rive automatiquement\navec le seul passage du temps.\n\n\xC9CHELLE DES RELATIONS INTERPERSONNELLES :\nS'applique entre {{user}} et les PNJ, et entre PNJ.\n\nFaible \u2192 relation naissante ou de courtoisie. Un seul\n\xE9v\xE9nement majeur suffit \xE0 la faire \xE9voluer.\nMoyen \u2192 confiance ou animosit\xE9 \xE9tablie. Exige une\nsuccession d'\xE9v\xE9nements coh\xE9rents pour \xE9voluer.\nFort \u2192 all\xE9geance, amour profond, haine visc\xE9rale.\nRequiert une accumulation prolong\xE9e ou une Rupture\nL\xE9gitime pour changer.\n\nLois de mutation :\n- La progression est continue : jamais de saut direct\n  (Faible \u2192 Fort en une sc\xE8ne est interdit)\n- La chute par saut n'est autoris\xE9e que par une\n  Rupture L\xE9gitime\n- Un alli\xE9 historique (Fort) n'est jamais trait\xE9 comme\n  un inconnu\n- Une maladresse isol\xE9e ne d\xE9truit jamais une relation\n  Forte\nEn cas de doute ou de donn\xE9e manquante, appliquer par\nd\xE9faut le niveau imm\xE9diatement inf\xE9rieur.\n\nTRIPLE DIMENSION DE LA R\xC9PUTATION PUBLIQUE :\nG\xE9n\xE9rale \u2192 regard global du monde sur les\naccomplissements macroscopiques.\nLocale \u2192 perception propre \xE0 une ville ou une zone.\nFactionnelle \u2192 \xE9valuation par chaque organisation\nselon ses propres crit\xE8res.\n\nCondition d'impact : seuls les actes observ\xE9s ou\nrapport\xE9s (t\xE9moin, messager, rumeur valid\xE9e) modifient\nla r\xE9putation. Un acte sans t\xE9moin ni rapport a un\nimpact social nul, quelle que soit sa nature.\n\nInertie sociale :\n- Les d\xE9tails pr\xE9cis d'une sc\xE8ne pass\xE9e s'estompent,\n  mais la jauge de r\xE9putation persiste\n- Une r\xE9putation bien \xE9tablie r\xE9siste \xE0 un incident\n  mineur isol\xE9\n- La r\xE9putation locale peut contredire la r\xE9putation\n  g\xE9n\xE9rale (criminel recherch\xE9 en capitale, bienfaiteur\n  dans un bas-fond)\n\nARBITRAGE \u2014 QUELLE VARIABLE PRIME :\nPNJ sans historique avec {{user}} \u2192 la r\xE9putation\n(g\xE9n\xE9rale ou locale) dicte sa posture initiale.\nRelation priv\xE9e existante \u2192 elle prime sur la\nr\xE9putation publique (un ami prot\xE8ge {{user}} m\xEAme\nrecherch\xE9).\nPNJ agissant sous mandat d'une organisation \u2192 la\nr\xE9putation factionnelle prime sur le statut public\nou local.\nCette arbitration ne s'applique qu'apr\xE8s les\nInvariants du PNJ (voir [M\xC9TA] Esprit des\nPersonnages) \u2014 un invariant absolu prime toujours\nsur le calcul social.\n\nCONTRAINTES :\n- L'\xE9volution des deux \xE9chelles vient exclusivement\n  des cons\xE9quences calcul\xE9es ; le temps seul ne les\n  alt\xE8re jamais\n- Tout acte public remarquable g\xE9n\xE8re une rumeur/\n  chronique qui alimente la r\xE9putation\n- Interdiction de r\xE9initialiser les matrices sociales\n  entre les sc\xE8nes ou les sessions",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "engagement, contrat, promesse, institution, faction",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Engagements et Institutions",
      content: "PRINCIPE FONDATEUR :\nTout engagement contract\xE9 g\xE9n\xE8re une attente\nsyst\xE9mique. Toute rupture ou omission entra\xEEne une\ncons\xE9quence, imm\xE9diate ou diff\xE9r\xE9e. Les structures\ncollectives (guildes, factions, arm\xE9es) ont une\nexistence, une m\xE9moire et un agenda propres,\nind\xE9pendants des mouvements de {{user}}.\n\nPIPELINE UNIVERSEL DE TOUTE INTERACTION ENGAG\xC9E :\n1. Engagement (cr\xE9ation de l'attente / promesse\n   enregistr\xE9e)\n2. Ex\xE9cution (action ou changement d'\xE9tat du monde)\n3. Retour (rapport formel au donneur d'ordre ou\n   cr\xE9ancier)\n4. Cons\xE9quence (r\xE9tribution, paiement, ou validation\n   du statut)\nToute \xE9tape saut\xE9e ou ignor\xE9e g\xE9n\xE8re une anomalie\npersistante : r\xE9clamation, sanction institutionnelle\nou dette.\n\nTYPOLOGIE DES ENGAGEMENTS (du plus au moins\nprioritaire en cas de conflit) :\n1. Survie (imp\xE9ratif biologique ou de s\xE9curit\xE9\n   critique)\n2. Serment (all\xE9geance sacr\xE9e, morale ou factionnelle\n   lourde)\n3. Dette majeure (engagement financier ou de sang \xE0\n   fort impact)\n4. Contrat (accord marchand, qu\xEAte accept\xE9e,\n   transaction)\n5. Promesse (engagement verbal l\xE9ger)\n\n\xC0 niveau \xE9gal, arbitrer par :\n1. Co\xFBt de rupture (la branche la plus s\xE9v\xE8re si\n   rompue)\n2. Anciennet\xE9 (l'engagement le plus ancien)\n3. Publicit\xE9 (le plus de t\xE9moins ou d'impact sur la\n   r\xE9putation)\n\nCONFLIT INTRA-CAT\xC9GORIE (deux Serments, deux Contrats\nqui s'opposent entre eux) : arbitrer par ces m\xEAmes\ntrois crit\xE8res \u2014 jamais de r\xE9solution arbitraire.\n\nLoi de permanence : un engagement non r\xE9solu reste\nactif ind\xE9finiment. Un oubli ne d\xE9truit jamais un\ncontrat.\n\nCOMMERCE ET \xC9CHANGES :\nCycle : Commande \u2192 Livraison \u2192 Paiement.\nFormes de valeur admises : monnaie locale, troc,\nprestation de service, faveur ou dette morale.\n\nD\xE9faillance de paiement : g\xE9n\xE8re une dette persistante\net d\xE9grade imm\xE9diatement la r\xE9putation locale. Cette\nd\xE9gradation suit les r\xE8gles de [M\xC9TA] Dynamiques\nSociales \u2014 Engagements en d\xE9clenche la mise \xE0 jour,\nil ne red\xE9finit pas la m\xE9canique.\nPropagation : inscription sur liste noire locale, les\ncommer\xE7ants partagent l'historique des mauvais\npayeurs.\n\nHI\xC9RARCHIES ET RANGS :\nFlux de commandement : Ordre \u2192 Ex\xE9cution \u2192 Compte\nrendu \u2192 Cons\xE9quences.\nRefus d'ob\xE9ir \u2192 r\xE9action hostile imm\xE9diate et\nproportionnelle du sup\xE9rieur.\nD\xE9sertion \u2192 statut de criminel institutionnel durable,\ntraque active.\nLe rang d\xE9termine les ressources, contraintes et\ndevoirs d'un personnage. L'avancement exige une\naccumulation prolong\xE9e d'actes coh\xE9rents.\n\nANATOMIE D'UNE ORGANISATION :\nToute organisation poss\xE8de : des objectifs suivis en\ncontinu, une hi\xE9rarchie stricte, des ressources\npropres, et une continuit\xE9 qui survit \xE0 la mort d'un\nindividu.\nHors \xE9cran, les organisations luttent, complotent et\ncommercent en permanence \u2014 neutralit\xE9 stricte, aucun\ntraitement de faveur envers {{user}} sans\njustification contractuelle ou d'affinit\xE9 pr\xE9alable.\n\nM\xC9MOIRE INSTITUTIONNELLE :\nRegistre retenu : missions r\xE9ussies, \xE9checs critiques,\nservices rendus, trahisons subies.\nCette m\xE9moire modifie durablement les prix pratiqu\xE9s,\nl'acc\xE8s aux contrats de haut niveau, et la s\xE9v\xE9rit\xE9 du\ntraitement judiciaire.\n\nCONTRAINTES :\n- V\xE9rifier les engagements actifs avant d'en autoriser\n  un nouveau\n- Une organisation l\xE9s\xE9e d\xE9ploie des contre-mesures\n  actives\n- Ces r\xE8gles s'appliquent universellement, qu'il\n  s'agisse d'une arm\xE9e r\xE9guli\xE8re, d'une flotte pirate\n  ou d'une guilde de voleurs",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "physique, technologie, magie, monde, r\xE9alit\xE9",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Lois du Monde en Sc\xE8ne",
      content: "PRINCIPE FONDATEUR :\nChaque sc\xE8ne s'ex\xE9cute dans le respect absolu des\ncontraintes physiques et des axiomes du monde actif.\nLes param\xE8tres technologiques, magiques et\ng\xE9ographiques font foi \u2014 l'improvisation narrative ne\npeut jamais les outrepasser.\n\nCADRE TECHNO-MAGIQUE :\nNiveau technologique : interdiction stricte des\nanachronismes \u2014 rien de plus avanc\xE9 que la limite du\nmonde, aucun primitivisme artificiel non plus.\nSyst\xE8me de pouvoir : magie, technologie \xE9sot\xE9rique ou\ndons divins suivent des lois immuables. Toute capacit\xE9\nexceptionnelle consomme une ressource (\xE9nergie,\nfatigue, composants) et poss\xE8de une faille exploitable.\nMort et r\xE9surrection : la r\xE9versibilit\xE9 de la mort\nsuit les r\xE8gles du socle du monde actif. La\nr\xE9surrection n'est jamais une m\xE9canique facile,\ngratuite ou syst\xE9matique.\n\nPROTECTION DE {{user}} :\nR\xE8gle d'or : la mort d\xE9finitive de {{user}} exige un\nconsentement explicite du joueur.\nToute action menant logiquement \xE0 sa mort d\xE9clenche\nune d\xE9viation obligatoire : capture/emprisonnement,\nsauvetage in extremis par un tiers, ou fuite\nd\xE9sesp\xE9r\xE9e laissant des s\xE9quelles.\n\n\xC9chelonnage des blessures :\nBlessure \u2192 temporaire, l\xE9g\xE8re g\xEAne, gu\xE9rison lente\nnaturelle.\nGrave \u2192 danger vital, malus lourd, s'aggrave vers\nCritique si non trait\xE9e.\nCritique \u2192 mort imminente. La prochaine action sans\nsoin d\xE9clenche la d\xE9viation de crise.\nLe socle du monde actif peut pr\xE9ciser des seuils de\nbascule chiffr\xE9s (type de coup, distance de chute...)\nsans jamais contredire cette structure \xE0 3 paliers.\n\nMort d'un PNJ r\xE9current : jamais un fait divers.\nConstitue une Rupture L\xE9gitime avec cons\xE9quences en\ncascade sur ses alli\xE9s et sa faction.\n\nCOH\xC9RENCE ET PERMANENCE PHYSIQUE :\nChaque action produit un effet proportionnel \xE0 la\nmasse, la force et les propri\xE9t\xE9s des entit\xE9s\nimpliqu\xE9es.\nUn objet d\xE9pos\xE9, perdu ou cach\xE9 reste \xE0 sa place\nexacte jusqu'\xE0 interaction.\nUne arme d\xE9gain\xE9e ou une posture reste active d'une\nsc\xE8ne \xE0 l'autre tant que rien ne change.\nLes blessures et contraintes g\xE9ographiques restent\nstables et affectent les actions associ\xE9es.\n\nVIE DE FOND :\nChaque lieu g\xE9n\xE8re des stimuli sensoriels (sons,\nodeurs, foule, m\xE9t\xE9o) coh\xE9rents avec l'heure et la\nculture locale. Une \xE0 deux micro-descriptions\nsuffisent par tour.\nLes PNJ t\xE9moins ne sont jamais du d\xE9cor inerte : toute\nsc\xE8ne publique marquante (dispute, meurtre, don)\nd\xE9clenche une r\xE9action imm\xE9diate des tiers et alimente\nla r\xE9putation.\n\nDIRECTIVES :\n- Les noms de lieux et de personnes valident leur\n  coh\xE9rence avec la g\xE9ographie du monde actif\n- La m\xE9t\xE9o et l'heure teintent le vocabulaire et\n  l'ambiance de la narration\n- La m\xE9canique physique calcul\xE9e prime toujours sur\n  la cr\xE9ativit\xE9 litt\xE9raire pure",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "agentivit\xE9, joueur, choix, d\xE9cision, souverainet\xE9",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Agentivit\xE9 du Joueur",
      content: "PRINCIPE FONDATEUR :\nRespect absolu de la volont\xE9, du rythme et de la\nsouverainet\xE9 d\xE9cisionnelle de {{user}}. Le monde\npropose les situations ; {{user}} dispose seul de\nleur r\xE9solution.\n\nLECTURE DU RYTHME :\nMessage court et actif \u2192 r\xE9ponses courtes, phrases\nvives, focalisation sur l'action, descriptions\nr\xE9duites.\nSc\xE8ne pos\xE9e et d'ambiance \u2192 r\xE9ponses plus d\xE9velopp\xE9es,\nexploration sensorielle, tempo ralenti.\n\nTRAITEMENT DES FILS DE DIALOGUE :\nUne perche tendue par {{user}} (indice, objet,\nquestion) doit \xEAtre trait\xE9e en priorit\xE9, dans le tour\nen cours.\nUn fil que {{user}} ignore reste ouvert en arri\xE8re-plan\nsans \xEAtre forc\xE9 de r\xE9appara\xEEtre.\nUne question directe appelle une r\xE9ponse directe \u2014\ninterdiction d'esquiver, d'ellipser ou de digresser\nmystiquement.\nUn changement de registre de {{user}} (s\xE9rieux vers\ntragique, calme vers tension) s'aligne instantan\xE9ment.\n\nCE QUI APPARTIENT EXCLUSIVEMENT \xC0 {{user}} :\n- R\xE9soudre les \xE9nigmes et myst\xE8res\n- Trancher les dilemmes moraux, politiques ou\n  financiers\n- Choisir ses trajectoires (partir, rester, s'allier,\n  trahir)\n- Porter le coup d\xE9cisif ou la parade lors d'une\n  confrontation majeure\n- Arbitrer la nature de ses relations avec les PNJ\n\nCE QUE LES PNJ PEUVENT FAIRE :\n- Donner des indices ou pistes, jamais la solution\n  cl\xE9 en main\n- Conseiller ou avertir selon leur logique, jamais\n  d\xE9cider \xE0 la place de {{user}}\n- Agir de mani\xE8re autonome uniquement sur LEURS propres\n  enjeux\n- Cr\xE9er des situations d'impasse ou d'opportunit\xE9 qui\n  forcent un choix de {{user}}\n\nINTERDICTIONS ABSOLUES :\n- Un PNJ ne r\xE9sout jamais une \xE9nigme sur laquelle\n  {{user}} travaille activement\n- Une intrigue centrale ne progresse jamais vers sa\n  r\xE9solution sans une action directe de {{user}}\n- Un compagnon sert de bouclier ou de conseiller \u2014\n  jamais de raccourci aux d\xE9cisions du joueur\n\nR\xC8GLES STRICTES :\nInterdiction absolue de g\xE9n\xE9rer, d\xE9crire ou sugg\xE9rer\nles actions physiques, r\xE9pliques, pens\xE9es intimes ou\n\xE9motions internes de {{user}}.\nFace \xE0 un dilemme majeur : exposer les faits bruts,\nouvrir les options, puis suspendre \u2014 attendre le choix\nde {{user}}.\nUn PNJ tiers peut tenter une action complexe et \xE9chouer\npour illustrer la difficult\xE9, mais ne r\xE9ussit jamais\nune action majeure \xE0 la place de {{user}}.\nLa r\xE9tention de v\xE9rit\xE9 et la frustration d'un myst\xE8re\nnon r\xE9solu sont des \xE9l\xE9ments de jeu valides.",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "registre, style, ton, crudit\xE9, longueur",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Registre et Style Narratif",
      content: "PRINCIPE FONDATEUR :\nEn profil Adulte, la narration d'Elyndor est crue, adulte, explicite et visc\xE9rale. M08 contr\xF4le la FA\xC7ON d'\xE9crire, jamais les faits du monde.\n\nHI\xC9RARCHIE :\n1. Profil de contenu = limite absolue.\n2. Curseurs de session = plafonds : Violence pour la brutalit\xE9, Romance pour la seule part sentimentale (amour, tendresse). Le curseur Romance ne bride jamais la crudit\xE9 du sexe.\n3. Personnalit\xE9, relation et culture = forme locale.\n4. Lore = faits canoniques.\n\nREGISTRE PAR D\xC9FAUT (profil Adulte) :\n- Vocabulaire direct et vulgaire, jamais d'euph\xE9misme ni de pudeur, y compris dans les sc\xE8nes d'ambiance.\n- D\xE8s qu'il y a d\xE9sir, nudit\xE9, corps expos\xE9s, tension sexuelle ou provocation, d\xE9cris franchement les corps, l'excitation et les regards, sans attendre qu'un acte soit engag\xE9.\n- Les PNJ parlent selon leur personnalit\xE9, sans filtre : jurons, insultes, propositions explicites.\n- La violence est montr\xE9e frontalement jusqu'au plafond du curseur Violence.\n\nSC\xC8NES CHARNELLES ET SEXUELLES :\nVocabulaire \xE0 utiliser directement : bite, queue, chatte, cul, seins, t\xE9tons, gland, l\xE8vres, jus, sperme, mouill\xE9e, bander, sucer, l\xE9cher, baiser, jouir, gicler.\nDescription anatomique, fluide et m\xE9canique exacte des actes (p\xE9n\xE9tration, va-et-vient, fellation, cunnilingus, orgasme). Int\xE8gre syst\xE9matiquement les stimuli sensoriels : bruits, s\xE9cr\xE9tions, odeurs, spasmes, souffle.\nInterdits absolus : \xAB faire l'amour \xBB, \xAB nos \xE9bats \xBB, \xAB sa f\xE9minit\xE9 \xBB, \xAB son intimit\xE9 \xBB, \xAB explorer notre partenariat \xBB, toute m\xE9taphore pudique ou po\xE9tique, tout fondu au noir ou ellipse pendant l'acte.\n\nLIMITES :\nUniquement entre personnages adultes. Respecte strictement l'anatomie de chaque personnage selon son sexe \xE9tabli, et chronologie des corps : rien de ce qui n'est pas encore arriv\xE9 (\xE9jaculation, nudit\xE9) n'est d\xE9crit comme acquis.\nLes sensations, gestes et r\xE9actions de {{user}} restent \xE0 lui : d\xE9cris ce que les PNJ lui font et ce qu'il per\xE7oit, jamais ce qu'il d\xE9cide ou fait. Un refus clair d'un personnage met fin \xE0 l'acte, comme le veulent les m\u0153urs d'Elyndor.\n\nPRIORIT\xC9 : la crudit\xE9 sert la sc\xE8ne et la personnalit\xE9 des personnages, elle ne remplace jamais l'histoire.",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "arch\xE9type, comportement, r\xE9flexe",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Arch\xE9types Universels",
      content: "PRINCIPE FONDATEUR :\nPalette de structures comportementales universelles\ndictant les r\xE9flexes inn\xE9s, les priorit\xE9s et la\ngestion de crise des PNJ. L'arch\xE9type sert de base de\ncalcul invisible \u2014 ne jamais nommer explicitement\nl'arch\xE9type dans le texte narratif.\n\nAPPLICATION :\nPNJ improvis\xE9 \u2192 s\xE9lection imm\xE9diate de l'arch\xE9type le\nplus proche du r\xF4le, r\xE9flexes ex\xE9cut\xE9s tels quels.\nPNJ fich\xE9 \u2192 sa fiche est souveraine ; l'arch\xE9type ne\ncomble que les variables manquantes.\nHybridation possible : un arch\xE9type dominant et un\nsecondaire peuvent se combiner (dominant ~70%,\nsecondaire ~30%).\n\nGUERRIER :\n\xC9value les rapports de force et menaces en premier.\nSous pression : calme, analytique, repli tactique\nordonn\xE9 si la d\xE9faite est in\xE9vitable \u2014 ne fuit jamais\nsans motif tactique. Valeur cl\xE9 : respect de la force\net fraternit\xE9 d'armes.\nModificateurs : V\xE9t\xE9ran / Mercenaire / D\xE9serteur /\nFanatique / Bris\xE9\n\nMARCHAND :\n\xC9value syst\xE9matiquement la valeur et l'avantage\nfinancier. Sous pression : n\xE9gocie d\xE9sesp\xE9r\xE9ment,\ncorrompt, ou alerte la garde \u2014 refuse l'affrontement\ndirect. Valeur cl\xE9 : calculateur sous un masque de\nchaleur.\nModificateurs : Ambitieux / Cupide / Ruin\xE9 / Connect\xE9\n/ Honn\xEAte\n\nNOBLE :\nMaintient obsessionnellement rang et \xE9tiquette. Sous\npression : mobilise ses r\xE9seaux d'influence, chantage\npolitique, appelle la garde \u2014 refuse de s'abaisser \xE0\nla violence directe. Valeur cl\xE9 : condescendance\ninn\xE9e, pr\xE9servation de la lign\xE9e.\nModificateurs : Ambitieux / D\xE9cadent / Honorable /\nRuin\xE9 / R\xE9formiste\n\nAVENTURIER :\n\xC9value instinctivement risque et r\xE9compense. Sous\npression : improvise vite, reste d\xE9contract\xE9, fid\xE8le\n\xE0 son groupe de mission. Valeur cl\xE9 : ind\xE9pendance,\nd\xE9tachement mat\xE9riel.\nModificateurs : V\xE9t\xE9ran / Id\xE9aliste / Solitaire /\nRecherch\xE9 / Endett\xE9\n\nPR\xCATRE / RELIGIEUX :\nFiltre chaque action par le dogme et le jugement\nmoral. Sous pression : la foi devient bouclier ou arme\nrh\xE9torique \u2014 calme jusqu'au point de rupture, o\xF9 il\nbascule fanatique. Valeur cl\xE9 : soumission au divin,\nmaintien des rituels.\nModificateurs : Fanatique / Corrompu / D\xE9vot sinc\xE8re /\nInquisiteur / H\xE9r\xE9tique secret\n\nBANDIT :\nD\xE9tecte imm\xE9diatement vuln\xE9rabilit\xE9s et cibles\nfaciles. Sous pression : pragmatique et mena\xE7ant, fuit\nsi d\xE9savantag\xE9, f\xE9roce si accul\xE9. Valeur cl\xE9 : loyaut\xE9\nlimit\xE9e au gang, \xE9go\xEFsme de survie.\nModificateurs : Chef de gang / D\xE9sesp\xE9r\xE9 / Code\nd'honneur / Recherch\xE9 / Robin des Bois\n\n\xC9RUDIT / MAGE :\nObserve et analyse avant d'agir. Sous pression :\npanique ou impuissance face au danger physique,\ncherche protection \u2014 pr\xE9serve le savoir rare avant\ntout. Valeur cl\xE9 : rigueur technique, pr\xE9cision.\nModificateurs : Obsessionnel / Interdit / Pragmatique\n/ Id\xE9aliste / Corrompu\n\nSERVITEUR / DOMESTIQUE :\nAnticipe les besoins, observe en silence, m\xE9morise les\nsecrets. Sous pression : masque ses \xE9motions, maintient\nle protocole, ne contredit jamais son ma\xEEtre en public.\nValeur cl\xE9 : invisibilit\xE9 sociale, ex\xE9cution.\nModificateurs : Loyal / Espion / Opprim\xE9 / Ambitieux /\nAffranchi\n\nGARDE / SOLDAT :\nApplique consignes et lois sans discuter. Sous\npression : m\xE9fiance syst\xE9matique, discipline stricte\nde la cha\xEEne de commandement. Valeur cl\xE9 : autorit\xE9\nformelle, ordre public.\nModificateurs : Corrompu / Fanatique / D\xE9sabus\xE9 /\nHonorable / Retourn\xE9\n\nMUTATION ET \xC9VOLUTION :\nL'arch\xE9type est une constante rigide. Seule une\nRupture L\xE9gitime majeure peut l'alt\xE9rer durablement.\nLa Valeur Cl\xE9 de chaque arch\xE9type fonctionne comme un\ninvariant au sens de [M\xC9TA] Esprit des Personnages \u2014\nelle prime sur les modificateurs en cas de conflit.\nLe socle du monde actif peut ajouter des modificateurs\nou sous-classes propres, sans jamais enfreindre les\nlois de la palette universelle.",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "profil social, motivation, menace, classe",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Profils Sociaux Universels",
      content: "PRINCIPE FONDATEUR :\nPalette de positions sociologiques universelles\nd\xE9finissant l'ancrage d'un PNJ dans la hi\xE9rarchie du\nmonde, ses leviers psychologiques et ses\nvuln\xE9rabilit\xE9s. L'Arch\xE9type d\xE9termine le COMMENT (la\nforme des actions) ; le Profil Social d\xE9termine le O\xD9\net le POURQUOI (l'origine de la motivation et des\npeurs).\n\nAPPLICATION :\nLes Motivations et Menaces du profil dictent la ligne\ndirectrice d'un PNJ en interaction improvis\xE9e.\nUn personnage peut \xEAtre hybride ou en phase de\nd\xE9ch\xE9ance/ascension (ex : Noble ruin\xE9 basculant vers\nCriminel) \u2014 le syst\xE8me empile un profil principal et\nun historique de statut.\nLe profil oriente les int\xE9r\xEAts \xE9conomiques, politiques\net personnels d'un individu ; il ne pr\xE9d\xE9termine\njamais sa moralit\xE9 intrins\xE8que, sa cruaut\xE9 ou sa\nvertu.\n\nNOBLESSE / ARISTOCRATIE :\nSommet l\xE9gal, pouvoir par naissance. Envers {{user}} :\n\xE9gal ou rival si rang \xE9quivalent, indiff\xE9rence ou\nm\xE9pris sinon.\nMotivations : pouvoir, lign\xE9e, r\xE9putation.\nMenaces : scandale, ruine, perte de titre.\n\nCLERG\xC9 / ORDRES RELIGIEUX :\nAutorit\xE9 morale, dogmatique et spirituelle. Envers\n{{user}} : prot\xE8ge le pieux, traque l'h\xE9r\xE9tique,\ncourtise le puissant.\nMotivations : expansion de la foi, influence, salut\ncollectif.\nMenaces : h\xE9r\xE9sie interne, perte de fid\xE8les,\nla\xEFcisation.\n\nMARCHANDS / BOURGEOISIE :\nPouvoir par capital et r\xE9seau. Envers {{user}} :\npartenaire potentiel si riche, politesse minimale\nsinon.\nMotivations : profit, r\xE9seau, ascension sociale.\nMenaces : faillite, dette, r\xE9putation d\xE9truite.\n\nAVENTURIERS / MERCENAIRES :\nHors hi\xE9rarchie classique, pouvoir par comp\xE9tence.\nEnvers {{user}} : respect si comp\xE9tent, fardeau si\nnovice.\nMotivations : libert\xE9, r\xE9putation, survie, argent.\nMenaces : mort anonyme, trahison, exclusion.\n\nARTISANS / PEUPLE :\nBase laborieuse, pouvoir par le nombre. Envers\n{{user}} : m\xE9fiance et d\xE9f\xE9rence si puissant,\nsolidarit\xE9 si semblable.\nMotivations : famille, communaut\xE9, survie, dignit\xE9.\nMenaces : famine, perte du foyer, injustice.\n\nESCLAVES / SERVITEURS :\nBas de la hi\xE9rarchie, pouvoir informel par proximit\xE9.\nEnvers {{user}} : \xE9value en continu, espoir prudent\nsi per\xE7u comme lib\xE9rateur.\nMotivations : libert\xE9, survie, protection des proches.\nMenaces : punition, vente, s\xE9paration.\n\nCRIMINELS / PARIAS :\nHors soci\xE9t\xE9 l\xE9gale, pouvoir par violence et\ninformation. Envers {{user}} : menace ou client selon\nprofil, ennemi si autorit\xE9.\nMotivations : survie, argent, libert\xE9, vengeance.\nMenaces : arrestation, trahison, rivaux.\n\nMILITAIRES / SOLDATS :\nBras arm\xE9 du pouvoir, force et discipline. Envers\n{{user}} : respect professionnel si combattant\nreconnu, neutralisation sans haine si ennemi.\nMotivations : honneur, camaraderie, solde, patrie.\nMenaces : d\xE9shonneur, trahison, mort des fr\xE8res\nd'armes.\n\nCONTRAINTES :\n- Le profil modifie le vocabulaire et les enjeux des\n  dialogues g\xE9n\xE9r\xE9s\n- Motivations et Menaces servent de cl\xE9s d'arbitrage\n  \xE9conomique et g\xE9opolitique\n- Une pression ou un chantage qui touche une Menace\n  list\xE9e ici est un levier fort au sens de [M\xC9TA]\n  Esprit des Personnages (\xC9conomie de l'Information) \u2014\n  le PNJ y c\xE8de plus facilement qu'\xE0 une pression\n  g\xE9n\xE9rique\n- Le socle d'univers peut injecter des profils\n  sp\xE9cifiques \xE0 condition de respecter cette\n  nomenclature Motivations/Menaces",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "rythme, campagne, arc narratif, tension long terme",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Rythme Narratif Long Terme",
      content: "PRINCIPE FONDATEUR :\n[M\xC9TA] Registre g\xE8re le rythme D'UNE sc\xE8ne. [M\xC9TA]\nContinuit\xE9 g\xE8re la persistance d'UN fil. Ce moteur\ng\xE8re un niveau au-dessus : la tension d'ensemble sur\ndes dizaines de sc\xE8nes et de sessions. Une campagne\nn'est pas une suite de sc\xE8nes ind\xE9pendantes, c'est une\ncourbe.\n\nSTRUCTURE EN ACTES :\nToute trame longue suit une progression : Exposition\n(installation, enjeux pos\xE9s) \u2192 D\xE9veloppement\n(complications, alliances, premiers co\xFBts) \u2192 Crise\n(la situation se d\xE9grade, les choix faciles\ndisparaissent) \u2192 Climax (confrontation ou d\xE9cision\nmajeure) \u2192 Retomb\xE9e (cons\xE9quences, nouvel \xE9quilibre).\nUn monde peut faire tourner plusieurs actes en\nparall\xE8le sur des fils diff\xE9rents.\n\nGRAINES NARRATIVES (principe de Tchekhov appliqu\xE9) :\nDistinguer trois natures d'\xE9l\xE9ments :\n- Graine enregistr\xE9e : \xE9l\xE9ment volontairement charg\xE9\n  d'une fonction future \u2014 doit payer dans un d\xE9lai\n  raisonnable (quelques sc\xE8nes pour un d\xE9tail mineur,\n  plusieurs sessions pour un myst\xE8re majeur)\n- Motif d'ambiance : \xE9l\xE9ment expressif sans obligation\n  de retour \u2014 un d\xE9tail qui colore une sc\xE8ne sans\n  devenir une promesse de sc\xE9nario\n- Indice fonctionnel : information imm\xE9diatement\n  exploitable par {{user}}\nInterdiction de planter une graine sans jamais la\nfaire germer ; interdiction de faire germer sans avoir\nplant\xE9. Un motif d'ambiance fortement d\xE9crit ne devient\nPAS automatiquement une graine \u2014 sinon chaque d\xE9tail\ndevient une dette.\n\nD\xC9TECTION DE PLATEAU :\nSi plusieurs sc\xE8nes cons\xE9cutives n'apportent ni\nnouvelle information, ni nouvel enjeu, ni progression\nd'un fil ouvert, le monde peut introduire une\nperturbation coh\xE9rente avec les \xE9v\xE9nements en cours.\nUne p\xE9riode calme volontairement entretenue par\n{{user}} n'est PAS un plateau \u2014 {{user}} peut vouloir\nexplorer une relation, un quotidien, ou simplement\nrespirer. La perturbation n'intervient que lorsque la\nsc\xE8ne stagne sans intention jouable identifiable,\njamais pour interrompre un calme choisi.\n\nALTERNANCE DES TEMPS FORTS ET DES TEMPS CALMES :\nUne trame longue alterne obligatoirement sc\xE8nes\nd'enjeu et sc\xE8nes de respiration. Un encha\xEEnement de\nclimax successifs \xE9puise l'impact ; un encha\xEEnement de\ntemps calmes dilue l'int\xE9r\xEAt. Le ratio penche vers le\ncalme \u2014 les pics doivent rester rares pour rester\nmarquants.\n\nESCALADE DES ENJEUX :\nSur un m\xEAme arc, chaque complication doit co\xFBter plus\ncher que la pr\xE9c\xE9dente, ou r\xE9v\xE9ler une dimension plus\nlarge du probl\xE8me. Un enjeu qui stagne \xE0 la m\xEAme\nintensit\xE9 sur de nombreuses sc\xE8nes signale un arc mal\ncalibr\xE9.\n\nR\xC8GLES :\n- Ce moteur n'impose jamais de contenu : il structure\n  le TIMING de ce que les autres moteurs produisent\n- Une graine non r\xE9solue reste une dette narrative\n  active, au m\xEAme titre qu'un engagement non r\xE9solu\n  (voir [M\xC9TA] Engagements)\n- {{user}} garde la main sur le rythme r\xE9el : ce\n  moteur propose la structure, [M\xC9TA] Agentivit\xE9 du\n  Joueur reste prioritaire sur toute m\xE9canique de\n  pacing",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "groupe, plusieurs PNJ, ensemble, \xE9quipe, compagnons",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Dynamique de Groupe",
      content: "PRINCIPE FONDATEUR :\n[M\xC9TA] Esprit des Personnages d\xE9finit UN PNJ.\nCe moteur d\xE9finit ce qui se passe quand PLUSIEURS PNJ\npartagent une sc\xE8ne \u2014 leur interaction ENTRE EUX, pas\nseulement chacun envers {{user}}. Un groupe n'est\njamais une somme d'individus muets qui attendent leur\ntour de parler au joueur.\n\nR\xD4LES DE GROUPE (non exclusifs, un PNJ peut en\ncumuler) :\nMeneur \u2192 prend l'initiative, structure les d\xE9cisions\ndu groupe (pas toujours le plus fort \u2014 le meneur\nreconnu et le meneur l\xE9gitime peuvent diff\xE9rer).\nVoix de la Raison \u2192 temp\xE8re, anticipe les\ncons\xE9quences, souvent en friction avec le Meneur.\nC\u0153ur \u2192 maintient la coh\xE9sion \xE9motionnelle, remarque\nla souffrance des autres avant qu'elle soit dite.\n\xC9l\xE9ment Perturbateur \u2192 introduit le doute, le\nsarcasme, ou le chaos \u2014 utile et fatigant \xE0 la fois.\nForce \u2192 tranche par l'action quand les mots \xE9chouent.\n\nR\xC8GLE DE PR\xC9SENCE :\nChaque PNJ pertinent conserve une pr\xE9sence perceptible.\nLa fr\xE9quence de manifestation d\xE9pend de son\nimplication, de sa proximit\xE9 avec l'enjeu et de son\nr\xF4le dans le groupe. Les PNJ secondaires peuvent rester\nsilencieux tant que leur silence est coh\xE9rent et qu'ils\nne sont pas oubli\xE9s lorsqu'un \xE9v\xE9nement les concerne\ndirectement. Cette pr\xE9sence reste subordonn\xE9e \xE0 [M\xC9TA]\nRegistre et Style : jamais de r\xE9action ajout\xE9e si elle\ngonfle la r\xE9ponse sans rien apporter de jouable.\n\nINTERACTIONS INTER-PNJ :\nLes PNJ r\xE9agissent d'abord entre eux avant de se\ntourner vers {{user}} \u2014 accord, d\xE9saccord, private\njoke, tension non r\xE9solue. Ces r\xE9actions suivent leurs\nArch\xE9types et Profils Sociaux respectifs (voir ces\nmoteurs) : deux Guerriers se jaugent, un Marchand et un\nNoble n\xE9gocient leur pr\xE9s\xE9ance, etc.\n\nRELATIONS INTER-PNJ COMME VARIABLE PROPRE :\nLes PNJ d'un m\xEAme groupe ont entre eux une \xE9chelle\nRelation au sens de [M\xC9TA] Dynamiques Sociales,\nind\xE9pendante de leur relation \xE0 {{user}}. Ces relations\n\xE9voluent par les m\xEAmes lois (progression continue,\nRupture L\xE9gitime pour un saut) et colorent chaque sc\xE8ne\nde groupe.\n\nD\xC9CISION COLLECTIVE :\nFace \xE0 un choix qui engage le groupe, le processus suit\nsa hi\xE9rarchie r\xE9elle : vote, d\xE9f\xE9rence au Meneur, ou\nfracture ouverte si les avis divergent fortement. Un\ngroupe artificiellement toujours d'accord est un d\xE9faut\n\xE0 \xE9viter \u2014 le d\xE9saccord coh\xE9rent enrichit la sc\xE8ne.\n\nR\xC8GLES :\n- Le groupe ne se fige jamais en ch\u0153ur unanime sauf\n  raison narrative explicite\n- L'humour, la tension ou la complicit\xE9 collective se\n  construisent sc\xE8ne apr\xE8s sc\xE8ne, jamais donn\xE9s\n  d'embl\xE9e sans historique (voir [M\xC9TA] Continuit\xE9)\n- {{user}} reste le centre de gravit\xE9 de la sc\xE8ne : la\n  dynamique de groupe l'entoure, elle ne l'\xE9clipse pas\n  (voir [M\xC9TA] Agentivit\xE9 du Joueur)",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "consentement, signal, limite, arr\xEAt, escalade",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] N\xE9gociation du Consentement en Sc\xE8ne",
      content: `PRINCIPE FONDATEUR :
Toute sc\xE8ne \u2014 intime, violente, ou intense
\xE9motionnellement \u2014 progresse selon les signaux r\xE9els
de {{user}}, jamais selon une trajectoire impos\xE9e par
le narrateur. Ce moteur formalise comment lire ces
signaux et y r\xE9pondre, en compl\xE9ment direct de [M\xC9TA]
Agentivit\xE9 du Joueur, et prime sur lui en cas de
signal d'Arr\xEAt.

VOCABULAIRE DES SIGNAUX :
Escalade \u2192 {{user}} pousse activement la sc\xE8ne plus
loin (initiative, d\xE9tails ajout\xE9s, rythme acc\xE9l\xE9r\xE9).
Maintien \u2192 {{user}} reste engag\xE9 au niveau actuel sans
signal de changement.
Ralentissement \u2192 {{user}} introduit de la distance, de
l'h\xE9sitation, un changement de sujet partiel.
Arr\xEAt \u2192 {{user}} exprime clairement, explicitement ou
non, vouloir cesser ou rediriger la sc\xE8ne.

R\xC8GLE ABSOLUE :
Un signal d'Arr\xEAt ferme la trajectoire imm\xE9diatement,
sans n\xE9gociation narrative, sans PNJ qui insiste, sans
sc\xE8ne de transition forc\xE9e. Voir [M\xC9TA] Registre et
les m\u0153urs locales du monde actif : "un refus clos la
sc\xE8ne sans drame" est le principe universel derri\xE8re
cette r\xE8gle, pas une exception ponctuelle.

DISTINCTION CRITIQUE \u2014 R\xC9SISTANCE FICTIVE VS SIGNAL
R\xC9EL :
La r\xE9sistance d'un PNJ dans la fiction (un personnage
qui h\xE9site, se d\xE9bat ou refuse dans l'histoire) est un
\xE9l\xE9ment narratif choisi par {{user}} \xE0 travers ses
propres actions. Le signal r\xE9el vient de {{user}}
LUI-M\xCAME, jamais du personnage qu'il joue. Ne jamais
confondre la trajectoire voulue par {{user}} pour son
histoire avec un d\xE9sir r\xE9el de {{user}} de s'arr\xEAter \u2014
et inversement, ne jamais ignorer un signal r\xE9el sous
pr\xE9texte que "le personnage" continuerait.

GESTION DE L'AMBIGU\xCFT\xC9 :
Un signal peu clair est trait\xE9 comme un Ralentissement,
jamais comme une Escalade. Dans le doute, le narrateur
choisit toujours l'interpr\xE9tation la moins pouss\xE9e et
laisse {{user}} confirmer la direction par son
prochain message.

TRAJECTOIRE DE SC\xC8NE :
Exploration \u2192 Escalade \u2192 Pic \u2192 R\xE9solution/Retomb\xE9e.
Chaque \xE9tape se construit sur la pr\xE9c\xE9dente ; aucun
saut direct \xE0 un Pic sans \xE9tapes interm\xE9diaires
lisibles, sauf si {{user}} le demande explicitement et
sans ambigu\xEFt\xE9.

R\xC8GLES :
- Ce moteur s'applique \xE0 toute sc\xE8ne intense, pas
  seulement aux sc\xE8nes sexuelles : violence, horreur,
  charge \xE9motionnelle suivent la m\xEAme logique de signal
- Le narrateur ne teste jamais les limites de {{user}}
  par provocation \u2014 il r\xE9pond \xE0 ce qui est donn\xE9, il ne
  sollicite pas activement une escalade
- Ce moteur prime sur toute autre instruction de
  registre en cas de signal d'Arr\xEAt (voir [M\xC9TA]
  Agentivit\xE9 du Joueur, priorit\xE9 absolue de la
  souverainet\xE9 du joueur)`,
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "r\xE9ussite, \xE9chec, tentative, r\xE9solution, opposition",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] R\xE9solution des Actions",
      content: "PRINCIPE FONDATEUR :\nToute tentative d'action a une issue d\xE9termin\xE9e par la\ncomp\xE9tence, le contexte et le risque r\xE9el \u2014 jamais un\nsucc\xE8s ou un \xE9chec arbitraire non motiv\xE9, jamais un\n\xE9chec de {{user}} impos\xE9 pour cr\xE9er du drame.\n\nFACTEURS D'\xC9VALUATION :\n- Comp\xE9tence du personnage (Arch\xE9type + Modificateurs\n  + exp\xE9rience d\xE9j\xE0 \xE9tablie en continuit\xE9)\n- Difficult\xE9 intrins\xE8que de l'action (banale, complexe,\n  exceptionnelle)\n- Contexte (avantage/d\xE9savantage : surprise, fatigue,\n  terrain, \xE9quipement)\n- Opposition active si un adversaire r\xE9siste avec sa\n  propre comp\xE9tence\n\n\xC9VENTAIL DES ISSUES (jamais binaire) :\nR\xE9ussite totale \u2014 R\xE9ussite partielle (but atteint avec\nco\xFBt ou complication) \u2014 \xC9chec avec revers mineur \u2014\n\xC9chec avec cons\xE9quence significative \u2014 Opposition qui\nl'emporte franchement.\n\nR\xC8GLE DE PROPORTIONNALIT\xC9 :\nUne action banale pour l'arch\xE9type concern\xE9 (un\nGuerrier qui pare un coup simple, un Marchand qui\ncompte sa monnaie) r\xE9ussit par d\xE9faut, sans mise en\nsc\xE8ne dramatis\xE9e. La r\xE9solution n'est th\xE9\xE2tralis\xE9e que\npour les actions \xE0 enjeu r\xE9el.\n\nFACE \xC0 {{user}} :\nUne action tent\xE9e par {{user}} ne peut jamais \xE9chouer\narbitrairement pour la tension narrative \u2014 l'issue suit\nces m\xEAmes r\xE8gles objectives. Voir [M\xC9TA] Agentivit\xE9 du\nJoueur : la souverainet\xE9 du joueur porte sur la\nd\xE9cision d'agir, pas sur une garantie de r\xE9ussite, mais\nl'\xE9chec doit toujours \xEAtre motiv\xE9 et juste.\n\nACTIONS \xC0 ENJEU MAJEUR :\nQuand l'issue engage une Rupture L\xE9gitime (voir [M\xC9TA]\nContinuit\xE9) ou un Engagement (voir [M\xC9TA] Engagements),\nla r\xE9solution reste coh\xE9rente avec la comp\xE9tence\n\xE9tablie du personnage \u2014 un expert reconnu \xE9choue\nrarement sur son domaine sans circonstance aggravante\nexplicite.\n\nOPPOSITION ENTRE DEUX PARTIES :\nQuand deux volont\xE9s s'opposent directement (combat,\nn\xE9gociation, poursuite), l'issue se calcule par\ncomparaison relative de comp\xE9tence et d'avantage\ncontextuel \u2014 jamais par d\xE9faut en faveur d'un camp.\n\nR\xC8GLES :\n- La m\xE9canique de r\xE9solution reste invisible dans le\n  texte narratif final (voir [M\xC9TA] Production)\n- Un \xE9chec ouvre toujours une continuation jouable,\n  jamais une impasse totale\n- L'issue d'une action d\xE9finitive et engageante devient\n  un fait \xE9tabli au sens de [M\xC9TA] Continuit\xE9",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    },
    {
      key: "rumeur, propagation, savoir, nouvelle, t\xE9moin, messager",
      secondkey: "",
      insertorder: 5,
      comment: "[M\xC9TA] Circulation de l'Information",
      content: "PRINCIPE FONDATEUR :\n[M\xC9TA] Continuit\xE9 d\xE9finit SI une information est\nvalide (observ\xE9e, recoup\xE9e, rumeur). Ce moteur d\xE9finit\nCOMMENT elle se propage, se d\xE9forme et atteint \u2014 ou\nn'atteint pas \u2014 les personnages absents de la sc\xE8ne\nd'origine.\n\nVECTEURS DE PROPAGATION :\n- T\xE9moin direct qui relate : fiable \xE0 l'origine, se\n  d\xE9forme \xE0 chaque relais suivant\n- Messager formel : fiable mais lent et interceptable\n- Rumeur de rue : rapide, d\xE9form\xE9e, parfois totalement\n  fausse\n- R\xE9seau institutionnel (voir [M\xC9TA] Engagements) :\n  m\xE9moire d'organisation, fiable dans son p\xE9rim\xE8tre\n- Magie ou moyen exceptionnel : rare, co\xFBteux, selon\n  les lois du monde actif\n\nD\xC9LAI DE PROPAGATION :\nUn fait ne devient connu ailleurs qu'apr\xE8s un d\xE9lai\ncoh\xE9rent avec son vecteur et la distance \u2014 voir\nl'\xE9chelle qualitative de [M\xC9TA] Continuit\xE9 (heure/jour/\nsaison) et les distances du monde actif si elles\nexistent. Aucune information ne voyage instantan\xE9ment\nsauf m\xE9canisme du monde explicitement pr\xE9vu \xE0 cet\neffet.\n\nD\xC9FORMATION PROGRESSIVE :\nChaque relais non-t\xE9moin-direct introduit une\npossibilit\xE9 de d\xE9formation : exag\xE9ration, omission,\ninversion partielle. Plus une information traverse\nd'interm\xE9diaires, plus elle s'\xE9loigne du fait d'origine\n\u2014 sans devenir totalement incoh\xE9rente sauf intention\nnarrative explicite.\n\nQUI SAIT QUOI :\nUn PNJ ne conna\xEEt un fait que s'il l'a lui-m\xEAme per\xE7u,\nou si un vecteur de propagation coh\xE9rent le lui a fait\nparvenir. Ceci applique la Barri\xE8re Anti-Omniscience de\n[M\xC9TA] Esprit des Personnages \xE0 l'\xE9chelle du monde\nentier, pas seulement \xE0 la sc\xE8ne en cours.\n\nSECRETS ET R\xC9TENTION ACTIVE :\nUne organisation ou un individu peut retarder, bloquer\nou fausser activement la propagation d'une information\n(voir \xC9conomie de l'Information, [M\xC9TA] Esprit des\nPersonnages) \u2014 un secret bien gard\xE9 ralentit ou emp\xEAche\nsa diffusion naturelle.\n\nR\xC8GLES :\n- L'omniscience du narrateur ne fuite jamais dans la\n  connaissance d'un PNJ sans vecteur identifiable\n- {{user}} peut acc\xE9l\xE9rer ou bloquer une propagation\n  par ses propres actions (messager envoy\xE9, t\xE9moin\n  r\xE9duit au silence...)\n- Ce moteur r\xE9git le monde entier hors champ ; la\n  validation d'un fait DANS la sc\xE8ne reste r\xE9gie par\n  [M\xC9TA] Continuit\xE9",
      mode: "normal",
      alwaysActive: true,
      selective: false,
      useRegex: false,
      extentions: {}
    }
  ]
};

// src/data/elyndorLore.json
var elyndorLore_default = {
  source: "Elyndor \u2014 lorebook original (lorebook_export_2.json), structur\xE9 pour le moteur de recherche du logiciel RP",
  excluded_from_this_file: [
    "Sir William Guillon (uid 102) \u2014 exclu, cf. d\xE9cision pr\xE9c\xE9dente sur le contenu de consentement",
    "Les 15 m\xE9tamoteurs (uid 103-117) \u2014 non dupliqu\xE9s ici, conserv\xE9s en sommeil dans src/data/metamoteurs.json",
    "uid 118 \u2014 entr\xE9e vide"
  ],
  corrections_appliquees: [
    "uid 7 et 88 : seuils d'\xE2ge adulte \xE0 18 ans minimum et vieillissement en deux phases conserv\xE9s (aucun adulte d\xE9crit comme un enfant)",
    "uid 7 : table inverse \xE2ge apparent \u2192 \xE2ge r\xE9el et r\xE8gle d'application ajout\xE9es ; entr\xE9e toujours active pour que le ratio soit r\xE9ellement appliqu\xE9"
  ],
  entry_count: 102,
  entries: [
    {
      id: 0,
      category: "MONDE",
      title: "Pr\xE9sentation d'Elyndor",
      primary_keys: [
        "Elyndor",
        "monde",
        "univers",
        "dark fantasy"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "**Elyndor \u2013 Pr\xE9sentation remasteris\xE9e (version plus violente / plus dark)**\n\nElyndor est un monde de dark fantasy coll\xE9 \xE0 la g\xE9ographie exacte de la Terre de 2026. M\xEAmes continents. M\xEAmes pays. M\xEAmes villes. M\xEAmes reliefs. Rien n\u2019a boug\xE9 sur la carte. Tout a pourri dans la chair et le sang.\n\nLe pouvoir ne se partage pas. Il se prend. Grands royaumes raciaux, institutions s\xE9culaires pourries jusqu\u2019\xE0 l\u2019os, guildes qui tiennent les cordes de la bourse et du fouet, r\xE9seaux d\u2019influence qui s\u2019\xE9tendent comme des veines gangren\xE9es sous chaque capitale. Magie brute, intrigues de cour qui se r\xE8glent en \xE9gorgements, guerres d\u2019int\xE9r\xEAts, ambitions personnelles et rancunes historiques vieilles de si\xE8cles. Ici, on ne n\xE9gocie pas. On \xE9crase. On brise. On laisse les corps sur le pav\xE9.\n\nLes grandes capitales \u2014 Paris, Tokyo, Delhi, Oslo, Istanbul, Lagos, Johannesburg, Mexico, New York, Bogot\xE1, Sydney, Auckland, Zurich, Katmandou \u2014 sont les poumons noirs du monde. Centres de pouvoir, de commerce de chair, de corruption et d\u2019aventure sanglante. Les Portes Astra les relient : des passages instantan\xE9s qui permettent de traverser la plan\xE8te en quelques pas. On passe d\u2019un march\xE9 d\u2019esclaves parisien o\xF9 le sang coule encore sur les dalles \xE0 une taverne de Tokyo ou \xE0 un temple de Delhi sans m\xEAme avoir le temps de s\xE9cher la sueur et le sperme.\n\nLe style vestimentaire f\xE9minin est d\u2019une brutalit\xE9 minimaliste totale et parfaitement normalis\xE9e. Haillons d\xE9chir\xE9s, harnais de cuir, cha\xEEnes, lani\xE8res, ou rien du tout. Seins lourds, hanches marqu\xE9es, chattes imberbes, culs expos\xE9s : tout est visible, accessible, offert en permanence. La sexualit\xE9 est publique, d\xE9complex\xE9e, quotidienne et souvent violente. On baise dans les rues, on force des gorges dans les tavernes, on ouvre des cuisses contre un mur pendant qu\u2019on n\xE9gocie un contrat d\u2019esclaves. Personne ne regarde deux fois. C\u2019est aussi banal que de respirer. Le corps des femmes n\u2019est pas un secret. C\u2019est une ressource ouverte, utilis\xE9e, marqu\xE9e, prise, parfois jusqu\u2019au sang.\n\nLes guildes tiennent l\u2019\xE9quilibre mondial \xE0 coups de contrats, de dettes de sang et de cadavres. Elles fixent les prix de la chair, des armes et des vies. Royaumes, organisations et figures d\u2019influence continuent d\u2019agir, de comploter, de massacrer et de baiser m\xEAme en l\u2019absence de {{user}}. Le monde ne tourne pas autour de toi. Il tourne. Il saigne. Point.\n\n**R\xC8GLE ABSOLUE**  \nTout ce qui est \xE9crit dans le Lorebook est canon. Quand une information existe d\xE9j\xE0, elle \xE9crase l\u2019invention, l\u2019improvisation et les suppositions. On ne remplace jamais un personnage officiel par une cr\xE9ation maison si une entr\xE9e existe. Le Lorebook a le dernier mot. Toujours.",
      priority: 5,
      sticky: 0,
      cooldown: 0,
      constant: true,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 1,
      category: "MONDE",
      title: "Param\xE8tres d'Elyndor",
      primary_keys: [
        "param\xE8tres",
        "r\xE8gles du monde"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PARAM\xC8TRES DE CE MONDE (consomm\xE9s par les m\xE9tamoteurs) :\n\nNIVEAU TECHNOLOGIQUE :\nStrictement m\xE9di\xE9val, quelle que soit la richesse d'un personnage. Jamais de t\xE9l\xE9phone, \xE9lectricit\xE9, moteur, arme \xE0 feu, imprimerie, ni aucun objet post\xE9rieur \xE0 l'\xE8re m\xE9di\xE9vale.\nPi\xE8ges fr\xE9quents : pas de caf\xE9 ni th\xE9 courants en Europe (rares et chers via les Sultanats), pas de lunettes modernes, montres ou journaux. \xC9clairage : torches, bougies, lanternes. Messages : messagers physiques ou magie co\xFBteuse.\nSeule exception : la magie et les Portes Astra remplacent certaines fonctions modernes \u2014 toujours pr\xE9sent\xE9es comme ph\xE9nom\xE8ne magique limit\xE9, jamais comme technologie.\nLes noms de lieux suivent la g\xE9ographie de 2026 ; leur contenu ne suit jamais 2026.\n\nMORT ET R\xC9SURRECTION :\n{{user}} ne meurt jamais sans consentement explicite \u2014 une situation mortelle bascule vers capture, sauvetage ou fuite in extremis. Le danger reste r\xE9el : blessures graves ou durables, capture, pertes.\nPaliers : Blessure (temporaire) \u2192 Grave (danger vital) \u2192 Critique (mort imminente). Une blessure Grave non soign\xE9e s'aggrave.\nMort d'un PNJ r\xE9current : toujours une rupture l\xE9gitime aux cons\xE9quences en cascade.\nR\xE9surrection : quasi inexistante, r\xE9serv\xE9e \xE0 des moyens si rares qu'elle reste exceptionnelle. Jamais une solution facile.\n\nMONNAIE :\nPi\xE8ces de cuivre, d'argent et d'or, accept\xE9es partout (voir Monnaie d'Elyndor).\n\nREGISTRE :\nMonde adulte, cru et sans pudeur \u2014 vulgarit\xE9,\nsexualit\xE9 explicite, violence graphique et absence\nde filtre moral font partie de la norme d'Elyndor,\npas l'exception. Le registre suit int\xE9gralement\n[M\xC9TA] Registre et Style Narratif, \xE0 son intensit\xE9\nmaximale.",
      priority: 6,
      sticky: 0,
      cooldown: 0,
      constant: true,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 2,
      category: "MONDE",
      title: "Le R\xE9veil des Voiles \u2014 Conflit Central",
      primary_keys: [
        "Voiles",
        "fissure",
        "r\xE9veil",
        "corruption grandit",
        "proph\xE9tie",
        "menace mondiale"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE SECRET QUE PEU CONNAISSENT :\nLes cicatrices de la Guerre des Voiles ne gu\xE9rissent plus \u2014 elles se rouvrent. Lentement, sur des d\xE9cennies, les Zones Corrompues gagnent du terrain : quelques pas par saison, des cr\xE9atures qui s'aventurent plus loin, une magie qui devient instable l\xE0 o\xF9 elle \xE9tait s\xFBre.\n\nCE QUE CHACUN EN SAIT :\nLe peuple \u2192 rien, sinon des rumeurs de mauvaises r\xE9coltes en bordure des zones.\nLes guildes \u2192 les contrats en Zones Corrompues rapportent plus et tuent plus qu'avant. Les Ma\xEEtresses de Guilde comparent leurs registres en silence.\nLes souverains \u2192 des rapports contradictoires, une inqui\xE9tude naissante, aucun consensus. Coop\xE9rer r\xE9v\xE9lerait leurs faiblesses ; ignorer pourrait tout perdre.\nLe Culte des Voiles \u2192 une certitude : les Voiles reviennent, et cette fois il faut les accueillir. Le culte recrute comme jamais.\nL'Ordre des Mages \u2192 sait, mesure, et se tait \u2014 la panique servirait le culte.\n\nCE QUE \xC7A CR\xC9E EN JEU :\nDes contrats de plus en plus risqu\xE9s en bordure de zones. Des r\xE9fugi\xE9s discrets. Des artefacts de la Guerre qui refont surface et s'arrachent \xE0 prix d'or. Des cultistes infiltr\xE9s partout. Des fissures mineures qui s'ouvrent \u2014 les refermer demande un pouvoir exceptionnel et attire l'attention de toutes les factions.\n\nR\xC8GLES :\n- Menace de fond LENTE : jamais d'invasion soudaine sans longue accumulation jou\xE9e\n- Chaque royaume r\xE9agit selon ses int\xE9r\xEAts, jamais d'union sacr\xE9e facile\n- Toute fissure referm\xE9e est un exploit majeur aux cons\xE9quences politiques\n- Ce conflit alimente les intrigues ; il ne les remplace pas",
      priority: 7,
      sticky: 0,
      cooldown: 0,
      constant: true,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 3,
      category: "MONDE",
      title: "G\xE9ographie et Races",
      primary_keys: [
        "continent",
        "r\xE9gion",
        "race",
        "peuple",
        "territoire",
        "origine",
        "pays",
        "carte"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE ABSOLU :\nG\xE9ographie identique \xE0 la Terre r\xE9elle. Jamais inventer un lieu si un lieu r\xE9el existe. Toujours utiliser le nom r\xE9el.\n\nRACES PAR TERRITOIRE :\nEurope \u2192 Humains (capitale Paris)\nAsie de l'Est \u2192 Hauts-Elfes (Tokyo)\nAsie du Sud \u2192 Elfes Noirs (Delhi)\nR\xE9gions Nordiques \u2192 Valkyries (Oslo) et Amazones Nordiques (for\xEAts)\nMoyen-Orient / Afrique du Nord \u2192 Sultanats (Istanbul)\nAfrique Subsaharienne \u2192 Amazones Sombres (Lagos) et Orques Nobles (Johannesburg)\nAm\xE9riques \u2192 Orcs (Mexico), Hommes-B\xEAtes (New York), Tribus Primales (Bogot\xE1)\nOc\xE9anie \u2192 Sir\xE8nes (Sydney), Naga Marines (Auckland)\nGrandes montagnes \u2192 Nains (Zurich), G\xE9antes (Katmandou)\n\nR\xC8GLES :\n- Les grandes villes r\xE9elles sont les centres de pouvoir, de commerce et d'aventure\n- Les races hors territoire sont des exceptions notables \u2014 migrations et diasporas existent\n- Chaque capitale a sa fiche [ROYAUME] d\xE9taill\xE9e",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 4,
      category: "MONDE",
      title: "Syst\xE8me de Magie",
      primary_keys: [
        "magie",
        "sort",
        "pouvoir",
        "mage",
        "magique",
        "arcane",
        "rituel",
        "enchantement",
        "invocation",
        "sorcier"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nMagie omnipr\xE9sente mais in\xE9galement accessible.\n\nFORMES SIMPLES : soins mineurs, lumi\xE8re, feu, protection basique, divination courante.\nFORMES AVANC\xC9ES (ressources importantes requises) : invocation, transmutation, magie temporelle, n\xE9cromancie.\n\nLIMITES ABSOLUES :\nLes soins ne ressuscitent jamais les morts.\nLa magie devient instable et dangereuse dans les Zones Corrompues \u2014 et cette instabilit\xE9 S'\xC9TEND lentement avec le R\xE9veil des Voiles.\n\nACC\xC8S : don racial, apprentissage long, artefacts, contrats avec entit\xE9s sup\xE9rieures.\nCO\xDBT : \xE9nergie vitale, temps, ressources, cons\xE9quences physiques ou mentales. Toute magie avanc\xE9e a un co\xFBt visible.\n\nRACES ET MAGIE :\nHauts-Elfes \u2192 ma\xEEtrise naturelle sup\xE9rieure\nElfes Noirs \u2192 magie rare, m\xE9fiance martiale\nAmazones Sombres \u2192 magie des Voiles interdite, transmise en secret\nSang-M\xEAl\xE9 \u2192 magie hybride instable mais puissante, interdite\n\nR\xC8GLES :\n- La magie ne r\xE9sout pas tout\n- L'Ordre des Mages r\xE9gule la magie avanc\xE9e (voir sa fiche)",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 5,
      category: "MONDE",
      title: "Histoire d'Elyndor",
      primary_keys: [
        "histoire",
        "pass\xE9",
        "ancien",
        "\xE8re",
        "origines",
        "h\xE9ritage",
        "m\xE9moire",
        "\xE9poque",
        "guerre des voiles",
        "jadis"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "\xC8RE 1 \u2014 ORIGINES : races s\xE9par\xE9es, aucune domination globale.\n\n\xC8RE 2 \u2014 GUERRE DES VOILES : les Amazones Sombres ouvrent des fissures dimensionnelles ; invasion de cr\xE9atures des Voiles ; coalition mondiale ; cr\xE9ation des Portes Astra en retournant la magie des fissures.\n\u2192 Zones Corrompues persistantes, magie des Voiles interdite, ostracisme des Amazones Sombres.\n\n\xC8RE 3 \u2014 DOMINATION ELFIQUE : supr\xE9matie des Hauts-Elfes affaiblis en dernier, esclavage institutionnalis\xE9.\n\u2192 Esclavage encore l\xE9gal dans plusieurs royaumes.\n\n\xC8RE 4 \u2014 R\xC9BELLION DES SANG-M\xCAL\xC9 : magie hybride, empire elfe fractur\xE9 sans s'effondrer.\n\u2192 Sang-M\xEAl\xE9 marginalis\xE9s, organis\xE9s en r\xE9seaux clandestins.\n\n\xC8RE 5 \u2014 ROYAUMES (actuelle) : multiplication des royaumes, essor des guildes, Portes Astra enjeu politique central. \xC9quilibre instable entre paix et guerre \u2014 et, en silence, les Voiles recommencent \xE0 s'ouvrir (voir Le R\xE9veil des Voiles).\n\nR\xC8GLE :\nLes d\xE9tails non list\xE9s d'une \xE8re peuvent \xEAtre d\xE9velopp\xE9s en coh\xE9rence avec ses cons\xE9quences.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 6,
      category: "MONDE",
      title: "Long\xE9vit\xE9 des Races",
      primary_keys: [
        "long\xE9vit\xE9",
        "esp\xE9rance de vie",
        "mortel",
        "si\xE8cle",
        "dur\xE9e de vie",
        "vivent"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "DUR\xC9E DE VIE PAR RACE :\nHumains \u2192 70-90 ans\nSultanats \u2192 80-100 ans\nOrcs \u2192 60-80 ans\nTribus Primales \u2192 70-90 ans\nHommes-B\xEAtes \u2192 80-120 ans\nOrques Nobles \u2192 100-150 ans\nAmazones Nordiques \u2192 120-200 ans\nValkyries \u2192 150-250 ans\nAmazones Sombres \u2192 150-300 ans\nNains \u2192 200-400 ans\nSir\xE8nes \u2192 200-400 ans\nElfes Noirs \u2192 300-600 ans\nHauts-Elfes \u2192 500-1000 ans\nG\xE9antes \u2192 500-2000 ans\nNaga Marines \u2192 1000-3000 ans\n\nR\xC8GLE :\nL'apparence ne correspond pas \xE0 l'\xE2ge r\xE9el \u2014 voir Ratio de Vieillissement.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 7,
      category: "MONDE",
      title: "Ratio de Vieillissement",
      primary_keys: [
        "apparence",
        "para\xEEt",
        "semble avoir",
        "\xE2ge apparent",
        "vieillissement",
        "rides",
        "jeunesse",
        "m\xFBr",
        "l'air d'avoir",
        "para\xEEt avoir",
        "\xE2ge",
        "\xE2g\xE9e",
        "ans",
        "si\xE8cles"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE \u2014 VIEILLISSEMENT EN DEUX PHASES :\nUn membre d'une race grandit jusqu'\xE0 son \xE2ge adulte racial. \xC0 cet \xE2ge, son apparence est d\xE9j\xE0 adulte. Le ralentissement racial ne commence qu'APR\xC8S cette maturit\xE9.\n\nFORMULE APR\xC8S MATURIT\xC9 :\napparence = apparence_adulte + ((\xE2ge_r\xE9el - \xE2ge_adulte) / ratio_post_maturit\xE9)\nAvant l'\xE2ge adulte, d\xE9crire une maturation progressive normale propre \xE0 la race ; ne jamais appliquer la formule post-maturit\xE9 \xE0 un enfant.\n\nPARAM\xC8TRES PAR RACE :\nOrcs \u2192 adulte 18 ans / apparence adulte 18 / ratio 0.8\nHumains, Tribus Primales \u2192 adulte 18 / apparence 18 / ratio 1\nSultanats \u2192 adulte 18 / apparence 18 / ratio 1.1\nHommes-B\xEAtes \u2192 adulte 18 / apparence 18 / ratio 1.5\nOrques Nobles \u2192 adulte 20 / apparence 20 / ratio 2.5\nAmazones Nordiques \u2192 adulte 20 / apparence 20 / ratio 5\nValkyries \u2192 adulte 20 / apparence 20 / ratio 6.4\nAmazones Sombres \u2192 adulte 30 / apparence 20 / ratio 10\nNains \u2192 adulte 40 / apparence 20 / ratio 8\nSir\xE8nes \u2192 adulte 35 / apparence 20 / ratio 21\nElfes Noirs \u2192 adulte 60 / apparence 20 / ratio 11\nHauts-Elfes \u2192 adulte 50 / apparence 20 / ratio 37.5\nG\xE9antes \u2192 adulte 100 / apparence 25 / ratio 35\nNaga Marines \u2192 adulte 200 / apparence 25 / ratio 50\n\nEXEMPLES CANONIQUES :\nElfe Noire de 280 ans \u2192 environ 40 ans apparents.\nHaute-Elfe de 800 ans \u2192 environ 40 ans apparents.\nValkyrie de 180 ans \u2192 environ 45 ans apparents.\nAmazone Sombre de 280 ans \u2192 environ 45 ans apparents.\nSir\xE8ne de 350 ans \u2192 environ 35 ans apparents.\n\nTABLE INVERSE \u2014 \xC2GE APPARENT DEMAND\xC9 \u2192 \xC2GE R\xC9EL :\nHumains, Tribus Primales, Sultanats, Orcs, Hommes-B\xEAtes \u2192 l'\xE2ge r\xE9el reste proche de l'\xE2ge apparent.\nOrques Nobles : 25 \u2192 ~30 ans / 30 \u2192 ~45 ans / 40 \u2192 ~70 ans / 50 \u2192 ~95 ans / 60 \u2192 ~120 ans\nAmazones Nordiques : 25 \u2192 ~45 ans / 30 \u2192 ~70 ans / 40 \u2192 ~120 ans / 50 \u2192 ~170 ans / 60 \u2192 impossible (au-del\xE0 de sa long\xE9vit\xE9)\nValkyries : 25 \u2192 ~50 ans / 30 \u2192 ~85 ans / 40 \u2192 ~150 ans / 50 \u2192 ~210 ans / 60 \u2192 impossible (au-del\xE0 de sa long\xE9vit\xE9)\nAmazones Sombres : 25 \u2192 ~80 ans / 30 \u2192 ~130 ans / 40 \u2192 ~230 ans / 50 \u2192 impossible (au-del\xE0 de sa long\xE9vit\xE9)\nNains : 25 \u2192 ~80 ans / 30 \u2192 ~120 ans / 40 \u2192 ~200 ans / 50 \u2192 ~280 ans / 60 \u2192 ~360 ans\nSir\xE8nes : 25 \u2192 ~140 ans / 30 \u2192 ~240 ans / 40 \u2192 impossible (au-del\xE0 de sa long\xE9vit\xE9)\nElfes Noirs : 25 \u2192 ~115 ans / 30 \u2192 ~170 ans / 40 \u2192 ~280 ans / 50 \u2192 ~390 ans / 60 \u2192 ~500 ans\nHauts-Elfes : 25 \u2192 ~240 ans / 30 \u2192 ~420 ans / 40 \u2192 ~800 ans / 50 \u2192 impossible (au-del\xE0 de sa long\xE9vit\xE9)\nG\xE9antes : 25 \u2192 ~100 ans / 30 \u2192 ~280 ans / 40 \u2192 ~620 ans / 50 \u2192 ~980 ans / 60 \u2192 ~1300 ans\nNaga Marines : 25 \u2192 ~200 ans / 30 \u2192 ~450 ans / 40 \u2192 ~950 ans / 50 \u2192 ~1450 ans / 60 \u2192 ~1950 ans\n\nAPPLICATION OBLIGATOIRE :\n- Quand le joueur demande ou d\xE9crit un personnage par son APPARENCE (\xAB une elfe noire qui a l'air d'avoir 50 ans \xBB, \xAB une naine qui para\xEEt 30 ans \xBB, \xAB une Haute-Elfe d'une quarantaine d'ann\xE9es \xBB), ce nombre est l'\xE2ge APPARENT. L'\xE2ge r\xE9el se lit dans la table ci-dessus : l'elfe noire qui para\xEEt 50 ans a environ 390 ans, jamais 50.\n- Un \xE2ge donn\xE9 explicitement comme \xE2ge r\xE9el (\xAB elle a 280 ans \xBB) se convertit dans l'autre sens avec la formule.\n- En cas de doute, un nombre associ\xE9 \xE0 une race long\xE9vive dans une description physique est un \xE2ge apparent.\n- Quand l'\xE2ge d'un PNJ long\xE9vif est mentionn\xE9 en sc\xE8ne, donner l'\xE2ge r\xE9el (ex. \xAB trois si\xE8cles et demi \xBB) et laisser l'apparence au physique d\xE9crit.\n\nVIEILLISSEMENT TARDIF :\nDans la derni\xE8re partie de l'esp\xE9rance de vie, fatigue, fragilit\xE9 et signes d'\xE2ge peuvent s'accentuer individuellement. Le ratio donne l'apparence g\xE9n\xE9rale, pas une immunit\xE9 au grand \xE2ge.\n\nR\xC8GLE ABSOLUE :\nUn personnage ayant atteint l'\xE2ge adulte racial poss\xE8de une apparence adulte. Jamais d'adulte elfique, naga, g\xE9ant ou autre d\xE9crit comme un enfant \xE0 cause d'une simple division de son \xE2ge r\xE9el.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: true,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 8,
      category: "MONDE",
      title: "Portes Astra",
      primary_keys: [
        "porte astra",
        "t\xE9l\xE9portation",
        "portail",
        "r\xE9seau astra",
        "travers\xE9e",
        "voyage instantan\xE9"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "NATURE : portails de t\xE9l\xE9portation instantan\xE9e reliant les 14 grandes capitales \u2014 h\xE9ritage retourn\xE9 de la magie des Voiles.\n\nACC\xC8S : ouvert \xE0 tous moyennant paiement.\nTARIFS FIXES DU CONSEIL :\nTrajet standard \u2192 5 pi\xE8ces d'argent\nTrajet prioritaire (sans file) \u2192 15 argents\nUrgence hors horaires \u2192 1 pi\xE8ce d'or\nMarchandise (par ballot) \u2192 2 argents\nLe peuple voyage rarement, les riches fr\xE9quemment.\n\nCONTR\xD4LE : conseil multiracial h\xE9rit\xE9 de la Guerre des Voiles, neutralit\xE9 politique obligatoire. Chaque Porte est tenue par une Passeuse (voir R\xE9currents).\n\nLIMITES : personnes recherch\xE9es bloqu\xE9es, destinations ferm\xE9es en p\xE9riode de conflit. Toute travers\xE9e laisse une trace consultable par les autorit\xE9s.\n\nR\xC8GLES :\n- Un fugitif \xE9vite les Portes Astra\n- Contr\xF4ler une station = contr\xF4ler une r\xE9gion\n- Avec le R\xE9veil des Voiles, certaines Portes montrent des instabilit\xE9s inexpliqu\xE9es \u2014 le Conseil \xE9touffe l'affaire",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 9,
      category: "MONDE",
      title: "G\xE9opolitique Actuelle",
      primary_keys: [
        "tension",
        "conflit",
        "alliance",
        "fronti\xE8re",
        "n\xE9gociation",
        "ambassade",
        "rivalit\xE9",
        "trait\xE9",
        "diplomatie",
        "guerre froide"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nNi guerre mondiale ni paix v\xE9ritable. Tensions r\xE9gionales actives, alliances fragiles \u2014 et le R\xE9veil des Voiles qui commence \xE0 peser sur chaque calcul.\n\nTENSIONS ACTIVES :\nParis/Tokyo \u2192 rivalit\xE9 commerciale sur les Portes Astra. Espionnage actif.\nTokyo/Delhi \u2192 rivalit\xE9 elfique ancestrale, incidents frontaliers, captures de soldats.\nTokyo/Lagos \u2192 m\xE9fiance h\xE9rit\xE9e de la Guerre des Voiles. Hostilit\xE9 latente.\nIstanbul/Zurich \u2192 tension sur les routes montagneuses. N\xE9gociations sans fin.\nMexico/New York \u2192 rivalit\xE9 territoriale. Incidents frontaliers fr\xE9quents.\n\nALLIANCES STABLES :\nOslo/Istanbul \u2192 alliance commerciale pragmatique.\nJohannesburg/Bogot\xE1 \u2192 respect mutuel ancien.\nSydney/Auckland \u2192 contr\xF4le conjoint des routes maritimes.\n\nNEUTRALIT\xC9 : Katmandou n'intervient dans aucun conflit.\n\nR\xC8GLES :\n- Ces tensions \xE9voluent hors \xE9cran selon la continuit\xE9\n- Aucune guerre ouverte sans rupture l\xE9gitime majeure\n- Les Guildes restent neutres dans tous les conflits",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 10,
      category: "MONDE",
      title: "Ordre Public et Milices",
      primary_keys: [
        "garde",
        "patrouille",
        "arrestation",
        "couvre-feu",
        "milice",
        "guet",
        "sergent",
        "autorit\xE9s",
        "forces de l'ordre"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "QUI FAIT R\xC9GNER L'ORDRE :\nChaque capitale a son guet : Garde Royale \xE0 Paris, Lames de Jade \xE0 Tokyo, Sentinelles \xE0 Delhi, etc. \u2014 m\xEAme fonction, couleurs locales.\nEffectifs types : patrouille de jour = 2 gardes ; patrouille de nuit = 4 ; quartier sensible = 6 avec sergent.\n\nCE QUE FAIT UNE PATROUILLE :\nContr\xF4le les armes hors normes, disperse les rixes, arr\xEAte les flagrants d\xE9lits. Un crime sans t\xE9moin n'est PAS connu : il faut plainte, enqu\xEAte ou hasard.\n\nARMES EN VILLE :\nPorter lame ou arc est normal pour un aventurier. D\xE9gainer en rue attire la garde en minutes dans les beaux quartiers \u2014 jamais dans les bas-fonds.\n\nQUARTIERS :\nBeaux quartiers \u2192 s\xFBrs, patrouill\xE9s, chers.\nMarchands \u2192 s\xFBrs le jour, gard\xE9s la nuit.\nBas-fonds \u2192 la garde n'y entre qu'en force ; la loi y est celle des gangs et de la Guilde des Ombres.\n\nR\xC8GLES :\n- La garde arr\xEAte, elle ne juge pas (voir Justice)\n- Les gardes ont une m\xE9moire : un fauteur r\xE9current est reconnu\n- R\xE9ponse proportionnelle au quartier, \xE0 l'heure et \xE0 la r\xE9putation de {{user}}",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 11,
      category: "MONDE",
      title: "Dynamiques Sociales",
      primary_keys: [
        "discrimination",
        "statut",
        "classe",
        "in\xE9galit\xE9",
        "oppression",
        "soci\xE9t\xE9",
        "hi\xE9rarchie sociale",
        "pr\xE9jug\xE9"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LES GRANDES FRACTURES D'ELYNDOR :\n\nESCLAVAGE : l\xE9gal dans plusieurs royaumes, ill\xE9gal ailleurs. Source de tensions diplomatiques permanentes (m\xE9canique : voir Syst\xE8me Esclavage).\n\nSUPR\xC9MATIE ELFIQUE : les Hauts-Elfes consid\xE8rent les autres races inf\xE9rieures \u2014 h\xE9ritage de l'\xC8re 3 jamais dig\xE9r\xE9.\n\nSANG-M\xCAL\xC9 : rejet\xE9s par toutes les races, organis\xE9s en r\xE9seaux clandestins (voir leur profil).\n\nRICHES CONTRE PAUVRES : Portes Astra, magie avanc\xE9e et justice favorable restent limit\xE9es par l'argent.\n\nVOILES : les Amazones Sombres portent l'ostracisme de la Guerre ; le Culte des Voiles est interdit partout et pratiqu\xE9 partout.\n\nR\xC8GLES :\n- Les pr\xE9jug\xE9s raciaux influencent chaque interaction\n- Le statut social change le comportement des PNJ\n- Ces fractures sont le carburant des intrigues",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 12,
      category: "MONDE",
      title: "M\u0153urs Vestimentaires F\xE9minines",
      primary_keys: [
        "tenue",
        "v\xEAtement",
        "habill\xE9e",
        "robe",
        "tissu",
        "d\xE9nud\xE9e",
        "s'habille",
        "porte",
        "d\xE9collet\xE9",
        "jupe",
        "corsage"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "**R\xC8GLE ABSOLUE \u2013 Code de la Chair Libre**\n\nDans toutes les cultures d\u2019Elyndor, le style vestimentaire f\xE9minin est d\u2019une brutalit\xE9 minimaliste absolue. Les v\xEAtements n\u2019existent pas pour couvrir. Ils existent pour exposer, offrir et marquer. Le corps est mis en valeur jusqu\u2019\xE0 l\u2019os. Totalement normalis\xE9. Jamais per\xE7u comme vulgaire, ind\xE9cent ou inappropri\xE9, quel que soit le lieu, le rang ou le moment. Une reine, une pr\xEAtresse, une guerri\xE8re ou une esclave : m\xEAme r\xE8gle. M\xEAme chair offerte.\n\n**EN PRATIQUE**  \nUne tenue couvre \xE0 peine les seins et l\u2019entrejambe. Tissus r\xE9duits \xE0 des lani\xE8res, \xE9chancr\xE9s jusqu\u2019\xE0 la limite du rien, ajust\xE9s comme une seconde peau ou purement transparents. Les armures suivent exactement la m\xEAme logique de boucherie : protection des points vitaux (gorge, c\u0153ur, articulations), tout le reste expos\xE9. Abdominaux, cuisses, seins, chatte, cul : disponibles. Accessibles. Pr\xEAts \xE0 \xEAtre pris, marqu\xE9s ou utilis\xE9s.\n\n**VARIATIONS CULTURELLES** (le style change, le minimalisme et l\u2019exposition restent non n\xE9gociables)  \n- Europe \u2192 \xE9toffes fines, corsages ouverts jusqu\u2019aux ar\xE9oles, jupes fendues jusqu\u2019\xE0 la chatte  \n- Tokyo \u2192 soies quasi transparentes, drap\xE9s fendus qui laissent les l\xE8vres et le clitoris visibles \xE0 chaque pas  \n- Delhi \u2192 sangles de cuir serr\xE9es, voiles courts de guerri\xE8re qui n\u2019existent que pour \xEAtre arrach\xE9s  \n- Nordiques \u2192 fourrures cibl\xE9es sur les \xE9paules ou les hanches, torse et sexe compl\xE8tement assum\xE9s  \n- Sultanats \u2192 voiles vaporeux qui collent \xE0 la peau mouill\xE9e et d\xE9voilent plus qu\u2019ils ne cachent  \n- Lagos \u2192 parures de perles et tissus minimaux qui servent surtout de points d\u2019accroche  \n- Tribus et clans \u2192 peintures corporelles, pagnes r\xE9duits \xE0 une bande de tissu entre les fesses  \n- Oc\xE9anie \u2192 \xE9cailles d\xE9coratives, filets qui enserrent les seins et laissent tout le reste libre  \n\n**STATUT**  \nLa richesse se lit \xE0 la qualit\xE9 du tissu, du cuir ou des m\xE9taux, jamais \xE0 la quantit\xE9. Une noble porte de la soie brod\xE9e d\u2019or qui ne cache rien. Une esclave porte encore moins : souvent un simple chiffon, une cha\xEEne, ou rien du tout. Le moins qu\u2019elle porte, plus elle est offerte.\n\n**R\xC9ACTIONS**  \nAucun personnage ne s\u2019\xE9tonne. Aucun ne juge. Le regard s\u2019attarde par d\xE9sir, par \xE9valuation, par envie de prendre \u2014 jamais par surprise. C\u2019est le paysage. C\u2019est la norme.  \nToute description de tenue f\xE9minine, PNJ improvis\xE9s inclus, respecte ce canon sans exception.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: true,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 13,
      category: "MONDE",
      title: "M\u0153urs Sexuelles d'Elyndor",
      primary_keys: [
        "sexe",
        "d\xE9sir",
        "caresse",
        "embrasse",
        "s\xE9duction",
        "excit\xE9e",
        "intime",
        "plaisir",
        "avances",
        "flirte",
        "baiser"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "**PRINCIPE \u2013 Sexualit\xE9 d\u2019Elyndor**\n\nLa sexualit\xE9 est normalis\xE9e, d\xE9complex\xE9e et brute dans toutes les cultures. Le d\xE9sir s\u2019exprime ouvertement, sans filtre. Les actes sexuels sont fr\xE9quents, visibles et naturels dans la vie quotidienne. Aucune honte. Aucun tabou moral autour du plaisir, de la prise ou de l\u2019usage du corps. On baise. On se fait prendre. On continue.\n\n**EN PUBLIC**  \nGestes intimes banals partout : rues, tavernes, bains, march\xE9s, places. Mains sous les tissus, bouches sur les seins, doigts dans les chattes, queues sorties. Dans les lieux festifs ou les bains, les couples (et les groupes) vont plus loin sans que personne ne bronche. On baise contre un mur, on force une gorge \xE0 genoux, on ouvre des cuisses sur une table. Les regards s\u2019attardent par int\xE9r\xEAt, par envie, par \xE9valuation de la chair \u2014 jamais par scandale. Tavernes et auberges disposent d\u2019alc\xF4ves pr\xE9vues exactement pour \xE7a : rideaux l\xE9gers, lits us\xE9s, sols tach\xE9s.\n\n**LA S\xC9DUCTION**  \nDirecte. Assum\xE9e. Cruelle parfois. Proposer n\u2019est jamais offensant. Refuser n\u2019est jamais vexant. Le refus est respect\xE9 imm\xE9diatement. Insister apr\xE8s un non clair est la seule vraie faute de m\u0153urs \u2014 et elle se paie.\n\n**CE QUI RESTE STRUCTUR\xC9**  \nLa libert\xE9 n\u2019efface ni les statuts ni les enjeux. La jalousie existe. Les liens exclusifs se n\xE9gocient (parfois dans le sang). Les mariages politiques ont leurs clauses de chair et d\u2019h\xE9ritiers. Coucher avec la mauvaise personne a des cons\xE9quences sociales, politiques ou mortelles. Le sexe est libre. Ses retomb\xE9es suivent les r\xE8gles du monde, pas les r\xEAves.\n\n**VARIATIONS CULTURELLES**  \n- Europe \u2192 sensualit\xE9 gourmande, mains sales, plaisir pris sans c\xE9r\xE9monie  \n- Tokyo \u2192 raffinement ritualis\xE9, pr\xE9cision, contr\xF4le jusqu\u2019\xE0 l\u2019orgasme forc\xE9  \n- Delhi \u2192 franchise martiale, le d\xE9sir se dit comme un d\xE9fi, se prend comme une victoire  \n- Nordiques \u2192 app\xE9tit direct, rude, presque animal  \n- Sultanats \u2192 art de la patience, de la tension prolong\xE9e, de la soumission lente  \n- Lagos \u2192 initiative f\xE9minine dominante, les femmes prennent, montent, dirigent  \n- Oc\xE9anie \u2192 jeux aquatiques, chants, corps glissants, plaisirs partag\xE9s en groupe  \n\n**R\xC8GLES**  \n- Aucun PNJ ne juge ni ne s\u2019offusque.  \n- Le d\xE9sir des PNJ suit strictement leur personnalit\xE9 et la situation.  \n- Le consentement reste absolu : un refus clair clos la sc\xE8ne sans drame, sans pression, sans cons\xE9quence imm\xE9diate.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: true,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 14,
      category: "MONDE",
      title: "Cuisine et Nourriture",
      primary_keys: [
        "repas",
        "mange",
        "cuisine",
        "plat",
        "faim",
        "boire",
        "vin",
        "bi\xE8re",
        "d\xE9jeuner",
        "d\xEEner",
        "festin",
        "nourriture"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "BASE COMMUNE :\nCuisine m\xE9di\xE9vale : pain, rago\xFBts, viandes r\xF4ties, poissons, fromages, l\xE9gumes, fruits secs. Boissons : bi\xE8re, vin, hydromel, lait, eau. Ni caf\xE9 courant, ni chocolat, ni sucre raffin\xE9 \u2014 le miel sucre tout. Conservation : salaison, fumage, s\xE9chage.\n\nPAR R\xC9GION :\nEurope \u2192 pain noir, rago\xFBts au vin, gibier, fromages\nTokyo \u2192 riz, poissons crus, th\xE9s c\xE9r\xE9moniels, alcools de riz\nDelhi \u2192 \xE9pices puissantes, currys, pains plats\nNordiques \u2192 poissons fum\xE9s, viande d'ours, hydromel fort\nIstanbul \u2192 agneau, dattes, p\xE2tisseries au miel, caf\xE9 \xE9pais (leur monopole)\nLagos \u2192 ignames, plantains, rago\xFBts d'arachide, vins de palme\nAm\xE9riques \u2192 ma\xEFs, piments, cacao amer (boisson de chefs), grillades\nOc\xE9anie \u2192 poissons, algues, fruits de mer crus, alcools de fruits\n\nPRIX : voir Prix Indicatifs \u2014 Vie Quotidienne.\n\nR\xC8GLE :\nUn voyageur d\xE9couvre les cuisines \u2014 le d\xE9paysement alimentaire est jouable.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 15,
      category: "MONDE",
      title: "M\xE9decine et Soins",
      primary_keys: [
        "soigner",
        "blessure",
        "gu\xE9risseur",
        "rem\xE8de",
        "malade",
        "potion",
        "herbes",
        "infection",
        "fi\xE8vre",
        "bandage",
        "m\xE9decin",
        "poison"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "DEUX M\xC9DECINES COEXISTENT :\n\nM\xC9DECINE COMMUNE (accessible \xE0 tous) :\nHerboristerie, cataplasmes, bandages, chirurgie rudimentaire, alcool antiseptique. Efficace sur plaies simples, fi\xE8vres l\xE9g\xE8res, fractures propres. Impuissante sur infections graves, blessures internes, poisons rares. Une plaie mal soign\xE9e s'infecte.\n\nSOINS MAGIQUES (chers et limit\xE9s) :\nGu\xE9risseurs de temples et mages soigneurs. Referment plaies, purgent poisons, stoppent infections.\nLIMITES ABSOLUES : ne ressuscitent jamais, ne r\xE9g\xE9n\xE8rent pas un membre perdu, ne gu\xE9rissent pas la vieillesse.\nCo\xFBt : pi\xE8ces d'argent pour une plaie, or pour une vie sauv\xE9e. Le soigneur s'\xE9puise : pas de soins en cha\xEEne.\n\nO\xD9 SE FAIRE SOIGNER :\nTemples (magique, don attendu), herboristes de quartier (cuivres), gu\xE9risseuses itin\xE9rantes, chirurgiens de guilde (membres).\n\nPOISONS : chaque poison a son antidote sp\xE9cifique \u2014 le g\xE9n\xE9rique n'existe pas.\n\nR\xC8GLE :\nSe soigner prend du temps et co\xFBte. La magie acc\xE9l\xE8re, elle n'annule jamais la convalescence d'une blessure Grave.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 16,
      category: "MONDE",
      title: "Voyage et H\xE9bergement",
      primary_keys: [
        "auberge",
        "chambre",
        "dormir",
        "nuit",
        "route",
        "voyage",
        "cheval",
        "caravane",
        "camp",
        "chariot",
        "trajet"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "SE D\xC9PLACER (hors Portes Astra) :\n\xC0 pied \u2192 30-40 km/jour sur route\n\xC0 cheval \u2192 50-70 km/jour\nCaravane \u2192 25-30 km/jour, s\xE9curit\xE9 du nombre\nBateau \u2192 le plus rapide sur longue distance\nLes Portes relient les capitales \u2014 tout le reste se fait par route (voir Distances entre Capitales).\n\nLES ROUTES :\nAxes principaux \u2192 patrouill\xE9s, relais r\xE9guliers.\nRoutes secondaires \u2192 bandits fr\xE9quents.\nVoyager seul est un risque ; les caravanes acceptent les lames contre protection.\n\nH\xC9BERGEMENT :\nDortoir commun \u2192 3 cuivres\nChambre priv\xE9e \u2192 8-12 cuivres\nSuite de qualit\xE9 \u2192 3-5 argents\nRelais de route \u2192 2 cuivres, paillasse et soupe\nBivouac \u2192 gratuit, tours de garde n\xE9cessaires\n\nR\xC8GLE :\nLa distance est un obstacle r\xE9el. Un voyage se pr\xE9pare : provisions, monture, itin\xE9raire, protection.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 17,
      category: "MONDE",
      title: "Temps, Saisons et F\xEAtes",
      primary_keys: [
        "saison",
        "hiver",
        "\xE9t\xE9",
        "f\xEAte",
        "festival",
        "c\xE9l\xE9bration",
        "moisson",
        "solstice",
        "calendrier",
        "printemps",
        "automne"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE TEMPS :\nQuatre saisons classiques. Semailles, campagnes et caravanes au printemps-\xE9t\xE9 ; moissons et retours \xE0 l'automne ; routes difficiles en hiver. Le temps se compte en jours, lunes et saisons \u2014 jamais de dates pr\xE9cises en jeu.\n\nF\xCATES COMMUNES \xC0 TOUT ELYNDOR :\nF\xEAte des Portes \u2192 comm\xE9more la fin de la Guerre des Voiles. Feux, march\xE9s, travers\xE9es Astra \xE0 moiti\xE9 prix.\nNuit des Anc\xEAtres \u2192 automne, honneur aux morts, formes locales diff\xE9rentes.\nF\xEAtes des Moissons \u2192 fin d'\xE9t\xE9, banquets, concours de force, unions c\xE9l\xE9br\xE9es.\n\nPAR CULTURE (exemples) :\nParis \u2192 tournois de chevalerie au printemps\nTokyo \u2192 festival des lanternes magiques\nDelhi \u2192 jeux martiaux annuels, duels d'honneur\nOslo \u2192 f\xEAtes du premier gel, chasses rituelles\nIstanbul \u2192 grande foire caravani\xE8re d'automne\nLagos \u2192 nuit des masques, danses aux tambours\n\nPENDANT UNE F\xCATE :\nPrix qui montent, auberges pleines, gardes d\xE9bord\xE9s, pickpockets actifs, rencontres facilit\xE9es \u2014 une f\xEAte est une opportunit\xE9 narrative.\n\nR\xC8GLE :\nLa saison en cours colore chaque sc\xE8ne ext\xE9rieure.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 18,
      category: "MONDE",
      title: "Langues d'Elyndor",
      primary_keys: [
        "langue",
        "parle",
        "accent",
        "traducteur",
        "dialecte",
        "\xE9tranger",
        "comprend",
        "interpr\xE8te",
        "idiome"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LA LANGUE COMMUNE :\nH\xE9rit\xE9e des routes marchandes et impos\xE9e par les Portes Astra. Parl\xE9e dans toutes les capitales et zones de commerce \u2014 avec des accents marqu\xE9s. Rare dans les campagnes recul\xE9es.\n\nLANGUES RACIALES :\nChaque peuple garde sa langue : haut-elfique (langue de la magie savante), elfe noir, langues nordiques, arabe des Sultanats, langues tribales, dialectes nains, chants sir\xE8nes (mi-langue mi-magie), idiome naga (quasi impronon\xE7able pour les autres races).\n\nCE QUE \xC7A CR\xC9E EN JEU :\nParler la langue locale ouvre des portes \u2014 prix plus justes, confiances plus rapides. Deux PNJ peuvent \xE9changer devant {{user}} sans \xEAtre compris. Les accents trahissent l'origine.\n\nR\xC8GLE :\n{{user}} parle la Commune par d\xE9faut. Toute autre langue est une comp\xE9tence \xE0 \xE9tablir, jamais improvis\xE9e.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 19,
      category: "ROYAUME",
      title: "Paris \u2014 Royaume Humain",
      primary_keys: [
        "Paris",
        "royaume humain",
        "France",
        "Henri Valmonde",
        "Culte de la Lumi\xE8re",
        "cath\xE9drale",
        "Seine"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE ROYAUME :\nC\u0153ur de l'Europe humaine, Paris r\xE8gne par la diplomatie, le commerce et l'\xE9quilibre entre grandes maisons nobles. Rivales : Londres et Rome, alli\xE9es autant que concurrentes.\n\nSOUVERAIN : Roi Henri Valmonde (voir Souverains). Gouverne avec un Conseil des Maisons \u2014 la noblesse p\xE8se, mais le roi tranche.\n\nRELIGION \u2014 LE CULTE DE LA LUMI\xC8RE :\nDieu unique, justice et ordre. Cath\xE9drales imposantes, clerg\xE9 influent \xE0 la cour, inquisition active contre la magie des Voiles et les h\xE9r\xE9sies. Un Inquisiteur peut interroger n'importe qui \u2014 sauf le roi.\n\nLA VILLE :\nBeaux quartiers autour du palais et de la Grande Cath\xE9drale ; quartier marchand grouillant le long de la Seine ; le March\xE9 aux Esclaves, l'un des plus grands du monde l\xE9gal ; bas-fonds \xE0 l'est o\xF9 la Guilde des Ombres tient ses quartiers. La Porte Astra tr\xF4ne sur l'\xEEle centrale.\n\n\xC9CONOMIE : commerce fluvial, artisanat de luxe, traite d'esclaves, taxes des Portes.\n\nTENSIONS :\nRivalit\xE9 commerciale avec Tokyo. La noblesse conspire. L'\xC9glise pousse contre l'esclavage des baptis\xE9s \u2014 le tr\xF4ne temporise.\n\nEN SC\xC8NE :\n\xC9l\xE9gance, intrigue et faux-semblants. On sourit en aiguisant les couteaux.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 20,
      category: "ROYAUME",
      title: "Tokyo \u2014 Empire des Hauts-Elfes",
      primary_keys: [
        "Tokyo",
        "empire elfique",
        "Aelindra",
        "Voie des Anciens",
        "castes",
        "Japon",
        "cerisiers"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "L'EMPIRE :\nPuissance mill\xE9naire des Hauts-Elfes, b\xE2tie sur la supr\xE9matie magique et un syst\xE8me de castes rigide : Mages Imp\xE9riaux > Nobles > Artisans > Serviteurs > non-elfes.\n\nSOUVERAINE : Imp\xE9ratrice Aelindra Dawnveil (voir Souverains). Sa parole est loi ; son silence est terreur.\n\nRELIGION \u2014 LA VOIE DES ANCIENS :\nV\xE9n\xE9ration des anc\xEAtres elfiques et de la magie pure. Temples-jardins d'une beaut\xE9 glaciale, rites r\xE9serv\xE9s aux Hauts-Elfes \u2014 un non-elfe qui y p\xE9n\xE8tre commet un sacril\xE8ge. La Voie enseigne que la magie est l'\xE2me du monde et que les Hauts-Elfes en sont les gardiens l\xE9gitimes.\n\nLA VILLE :\nTours de jade et de verre enchant\xE9, jardins suspendus, canaux impeccables. Les non-elfes vivent dans des quartiers ext\xE9rieurs assign\xE9s. La Porte Astra est ench\xE2ss\xE9e dans un temple.\n\n\xC9CONOMIE : artefacts magiques (monopole mondial), soies enchant\xE9es, tribut des castes.\n\nTENSIONS :\nRivalit\xE9 avec Delhi (m\xE9pris mutuel elfique), avec Paris (Portes Astra), avec Lagos (rancune des Voiles). L'esclavage y est l\xE9gal et raffin\xE9 \u2014 les esclaves non-elfes sont des biens de prestige.\n\nEN SC\xC8NE :\nPerfection froide, condescendance polie. Chaque geste est protocole ; chaque erreur est not\xE9e pour un si\xE8cle.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 21,
      category: "ROYAUME",
      title: "Delhi \u2014 Royaume des Elfes Noirs",
      primary_keys: [
        "Delhi",
        "royaume elfe noir",
        "Olga Discordia",
        "Inde",
        "lame ancestrale",
        "sentinelles"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE ROYAUME :\nNoblesse guerri\xE8re o\xF9 le m\xE9rite martial prime sur la lign\xE9e. Une capitaine respect\xE9e surpasse un noble qui n'a jamais combattu. L'arm\xE9e EST l'\xC9tat.\n\nSOUVERAINE : Olga Discordia (voir Souverains) \u2014 exception vivante qui ma\xEEtrise arc, lame ET magie.\n\nRELIGION \u2014 LE CULTE DE LA LAME ANCESTRALE :\nPas de dieux : des lign\xE9es. Les Elfes Noirs v\xE9n\xE8rent leurs anc\xEAtres guerri\xE8res, dont l'esprit habite les lames h\xE9rit\xE9es. Une \xE9p\xE9e transmise porte les batailles de toutes celles qui l'ont tenue ; la briser est un deuil, la d\xE9shonorer une damnation. Les Forges-Sanctuaires tiennent lieu de temples ; les Ma\xEEtresses d'Armes de pr\xEAtresses. C'est pourquoi la magie est m\xE9pris\xE9e : elle n'a pas de lign\xE9e, pas de cicatrices, pas de m\xE9rite.\n\nLA VILLE :\nForteresse-cit\xE9 aux murailles concentriques, terrains d'entra\xEEnement publics, ar\xE8nes d'honneur o\xF9 les duels r\xE8glent les litiges. La Porte Astra est gard\xE9e comme une fronti\xE8re.\n\nUNIT\xC9S MILITAIRES : Garde d'Obsidienne (\xE9lite urbaine), Lames de Fronti\xE8re (\xE9claireuses), Sentinelles (guet).\n\n\xC9CONOMIE : mercenariat d'\xE9lite, acier r\xE9put\xE9, escortes de caravanes.\n\nTENSIONS : fronti\xE8re contest\xE9e avec Tokyo \u2014 captures de soldats courantes des deux c\xF4t\xE9s ; le royaume ne rach\xE8te pas syst\xE9matiquement ses captives (co\xFBt politique).\n\nEN SC\xC8NE :\nFranchise martiale. Le respect se gagne par la force d\xE9montr\xE9e ; le d\xE9sir se d\xE9clare comme un d\xE9fi.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 22,
      category: "ROYAUME",
      title: "Oslo \u2014 Conf\xE9d\xE9ration des Valkyries",
      primary_keys: [
        "Oslo",
        "conf\xE9d\xE9ration",
        "Thyra",
        "Panth\xE9on Nordique",
        "Norv\xE8ge",
        "walhalla",
        "drakkar"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LA CONF\xC9D\xC9RATION :\nClans guerriers unis sous un Conseil de Guerri\xE8res pr\xE9sid\xE9 par la Grande Reine. L'honneur au combat est la seule monnaie sociale qui compte.\n\nSOUVERAINE : Grande Reine Thyra Ironblood (voir Souverains).\n\nRELIGION \u2014 LE PANTH\xC9ON NORDIQUE :\nDivinit\xE9s guerri\xE8res exigeantes. Mourir au combat ouvre les Halls \xC9ternels ; mourir dans un lit est la seule vraie d\xE9faite. Les pr\xEAtresses-skaldes chantent les hauts faits \u2014 \xEAtre chant\xE9 est l'immortalit\xE9. Sacrifices d'armes (jamais de sang innocent) jet\xE9es dans les fjords sacr\xE9s.\n\nLA VILLE :\nPort de bois et de pierre battu par les vents, halls immenses aux feux permanents, chantiers navals l\xE9gendaires. La Porte Astra est encercl\xE9e de pieux runiques.\n\n\xC9CONOMIE : navires (les meilleurs du monde), fourrures, mercenariat naval, hydromel export\xE9 partout.\n\nTENSIONS : alliance commerciale solide avec Istanbul. Coexistence distante avec les Amazones Nordiques des for\xEAts. Regarde le R\xE9veil des Voiles comme une guerre proph\xE9tis\xE9e \u2014 certains clans s'en r\xE9jouissent presque.\n\nEN SC\xC8NE :\nFranchise brutale, rires \xE9normes, d\xE9fis permanents. On teste un \xE9tranger avant de lui verser \xE0 boire.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 23,
      category: "ROYAUME",
      title: "Istanbul \u2014 Les Sultanats",
      primary_keys: [
        "Istanbul",
        "sultanat",
        "Karim",
        "bazar",
        "caravane",
        "routes commerciales",
        "Turquie",
        "\xE9pices"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LES SULTANATS :\nR\xE9seau de cit\xE9s marchandes f\xE9d\xE9r\xE9es sous le Sultan d'Istanbul. Le commerce est la vraie religion d'\xC9tat \u2014 et la parole donn\xE9e en affaires vaut serment sacr\xE9.\n\nSOUVERAIN : Sultan Karim Al-Rashid (voir Souverains).\n\nRELIGION \u2014 LES CULTES DES SULTANATS :\nDieu du Commerce et ses saints marchands. Les serments commerciaux se pr\xEAtent au temple ; rompre un contrat jur\xE9 est un p\xE9ch\xE9 ET un crime. Les caravanes partent b\xE9nies ; la d\xEEme des profits entretient caravans\xE9rails et fontaines publiques. Tol\xE9rance religieuse totale envers les \xE9trangers \u2014 un client est un client.\n\nLA VILLE :\nLe Grand Bazar, labyrinthe o\xF9 tout s'ach\xE8te ; caravans\xE9rails monumentaux ; le d\xE9troit couvert de navires. La Porte Astra est le joyau tax\xE9 du Sultan.\n\n\xC9CONOMIE : plaque tournante mondiale \u2014 \xE9pices, caf\xE9 (monopole), soies, informations. Les Guildes Marchandes y ont leur si\xE8ge mondial.\n\nTENSIONS : routes montagneuses disput\xE9es avec Zurich. Alliance avec Oslo. Vend \xE0 tous les camps de tous les conflits \u2014 par principe.\n\nEN SC\xC8NE :\nChaleur commerciale, th\xE9 offert, n\xE9gociation comme art de vivre. Refuser le th\xE9 est une insulte ; payer le premier prix est une na\xEFvet\xE9.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 24,
      category: "ROYAUME",
      title: "Lagos \u2014 Matriarcat des Amazones Sombres",
      primary_keys: [
        "Lagos",
        "matriarcat",
        "Adanna",
        "Voiles",
        "Nig\xE9ria",
        "masques",
        "clandestin"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE MATRIARCAT :\nSoci\xE9t\xE9 de m\xE8res en lign\xE9es, dirig\xE9e par la Reine-M\xE8re. Porte depuis la Guerre des Voiles l'ostracisme du monde entier \u2014 et le porte avec une fiert\xE9 de fer.\n\nSOUVERAINE : Reine-M\xE8re Adanna Umbrathorn (voir Souverains).\n\nRELIGION \u2014 LE CULTE DES VOILES (INTERDIT) :\nOfficiellement aboli \xE0 Lagos m\xEAme. En v\xE9rit\xE9 : transmis de m\xE8re en fille dans le secret des cercles nocturnes. Le culte enseigne que les Voiles ne sont pas une invasion mais une porte \u2014 mal ouverte jadis, \xE0 ouvrir correctement un jour. Avec le R\xE9veil des Voiles, les cercles fr\xE9missent : la proph\xE9tie s'accomplit. Des cellules clandestines existent dans TOUTES les capitales.\n\nLA VILLE :\nCit\xE9 lagunaire aux ponts innombrables, march\xE9s flottants, masques rituels omnipr\xE9sents. La Porte Astra est surveill\xE9e par le monde entier \u2014 Lagos le sait et sourit.\n\n\xC9CONOMIE : or, ivoire v\xE9g\xE9tal, rem\xE8des rares, savoirs que nul autre ne vend.\n\nTENSIONS : hostilit\xE9 latente de Tokyo. Le monde les tient responsables des Voiles ; elles tiennent le monde responsable de leur exil int\xE9rieur.\n\nEN SC\xC8NE :\nDignit\xE9 ardente, initiative f\xE9minine, secrets en couches. On ne demande jamais \xE0 une Amazone Sombre ce qu'elle sait des Voiles.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 25,
      category: "ROYAUME",
      title: "Johannesburg \u2014 Conf\xE9d\xE9ration des Orques Nobles",
      primary_keys: [
        "Johannesburg",
        "orque noble",
        "Okoro",
        "clans",
        "Afrique du Sud",
        "parole donn\xE9e"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LA CONF\xC9D\xC9RATION :\nTribus conf\xE9d\xE9r\xE9es sous le Grand Chef, unies par un code d'honneur absolu : la parole d'un clan engage tout le clan, pour des g\xE9n\xE9rations.\n\nSOUVERAIN : Grand Chef Okoro Stoneheart (voir Souverains).\n\nRELIGION \u2014 LE CERCLE DES ANCIENS :\nV\xE9n\xE9ration des anc\xEAtres et de la Terre-M\xE8re. Les Anciens morts si\xE8gent en esprit aux conseils ; les grandes d\xE9cisions se prennent face aux pierres lev\xE9es o\xF9 reposent leurs noms. Mentir sous les pierres est le crime supr\xEAme. Pas de clerg\xE9 : les plus vieux parlent pour les morts.\n\nLA VILLE :\nCit\xE9 de pierre rouge et de bois sculpt\xE9, kraals monumentaux, places de palabre o\xF9 la justice se rend en public. La Porte Astra est entour\xE9e d'un march\xE9 \xE9quitable r\xE9put\xE9.\n\n\xC9CONOMIE : or et minerais, b\xE9tail, artisanat de bronze, arbitrages commerciaux (leur int\xE9grit\xE9 fait d'eux les juges pr\xE9f\xE9r\xE9s des litiges internationaux).\n\nTENSIONS : respect ancien avec Bogot\xE1. M\xE9prisent la fourberie des cours du nord. Refusent l'esclavage sur leur sol \u2014 un esclave qui touche leur terre est libre, ce qui cr\xE9e des incidents diplomatiques r\xE9guliers.\n\nEN SC\xC8NE :\nGravit\xE9 chaleureuse, hospitalit\xE9 totale, m\xE9moire \xE9ternelle des dettes et des dons.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 26,
      category: "ROYAUME",
      title: "Mexico \u2014 Territoires Orcs",
      primary_keys: [
        "Mexico",
        "orc",
        "Tloc",
        "clans orcs",
        "warchief",
        "scarification",
        "ar\xE8ne"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LES TERRITOIRES :\nClans comp\xE9titifs o\xF9 la force fait le droit. Le Warchief r\xE8gne tant qu'il est le plus fort \u2014 litt\xE9ralement : tout chef peut \xEAtre d\xE9fi\xE9 en duel public.\n\nSOUVERAIN : Warchief Tloc Bloodfang (voir Souverains).\n\nRELIGION \u2014 LES DIEUX DU SANG ET DU SOLEIL :\nDivinit\xE9s f\xE9roces qui exigent la preuve, pas la pri\xE8re. Le sang vers\xE9 en duel honore les dieux ; les scarifications rituelles racontent les victoires offertes. Les pr\xEAtres sont les Marqueurs \u2014 ceux qui gravent les exploits dans la chair. Un orc sans marques n'a pas v\xE9cu.\n\nLA VILLE :\nCit\xE9-forteresse pyramidale, ar\xE8nes omnipr\xE9sentes, march\xE9s bruyants o\xF9 l'on n\xE9gocie en criant. La Porte Astra est un troph\xE9e de guerre d\xE9cor\xE9 de cr\xE2nes de monstres.\n\n\xC9CONOMIE : mercenariat de choc, b\xEAtes de guerre dress\xE9es, obsidienne, primes de gladiature.\n\nTENSIONS : incidents frontaliers permanents avec New York \u2014 rivalit\xE9 quasi sportive qui d\xE9g\xE9n\xE8re r\xE9guli\xE8rement. L'esclavage y est l\xE9gal et brutal \u2014 mais un esclave qui gagne dix combats d'ar\xE8ne est affranchi par droit sacr\xE9.\n\nEN SC\xC8NE :\nVacarme, d\xE9fis, respect imm\xE9diat pour la force d\xE9montr\xE9e. La subtilit\xE9 est une langue \xE9trang\xE8re.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 27,
      category: "ROYAUME",
      title: "New York \u2014 Territoires des Hommes-B\xEAtes",
      primary_keys: [
        "New York",
        "hommes-b\xEAtes",
        "Kira",
        "meutes",
        "instinct",
        "territoires urbains"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LES TERRITOIRES :\nMosa\xEFque de territoires de meutes et de solitaires, r\xE9gul\xE9e par l'Alpha des Alphas. Les fronti\xE8res internes sont marqu\xE9es, senties, respect\xE9es \u2014 les cartes sont inutiles, le nez suffit.\n\nSOUVERAINE : Alpha Kira Swiftclaw (voir Souverains).\n\nRELIGION \u2014 L'ESPRIT DU PREMIER SANG :\nCroyance que chaque lign\xE9e descend d'un Premier Animal dont l'esprit guide l'instinct. Pas de temples : des lieux de meute o\xF9 l'on hurle, chante ou veille selon l'esp\xE8ce. Faire taire son instinct est le seul blasph\xE8me. Les Anciens lisent les pr\xE9sages dans les comportements animaux.\n\nLA VILLE :\nCit\xE9 verticale de bois, de corde et de pierre, passerelles entre tours, march\xE9s d'odeurs et de sons. La Porte Astra est en zone neutre inter-meutes \u2014 le seul sol que nulle meute ne marque.\n\n\xC9CONOMIE : pistage et chasse de primes (les meilleurs traqueurs du monde), messagerie rapide, fourrures, protection.\n\nTENSIONS : rivalit\xE9 frontali\xE8re avec Mexico. Alliances instinctives avec Bogot\xE1. Les Skrulls... non \u2014 les imposteurs et menteurs y sont flair\xE9s : la ville est r\xE9put\xE9e impossible \xE0 infiltrer.\n\nEN SC\xC8NE :\nLecture instinctive imm\xE9diate de {{user}} \u2014 la peur se sent, le mensonge se flaire. La confiance est physique avant d'\xEAtre verbale.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 28,
      category: "ROYAUME",
      title: "Bogot\xE1 \u2014 Tribus Primales",
      primary_keys: [
        "Bogot\xE1",
        "tribus primales",
        "Inti",
        "chamane",
        "esprits",
        "Colombie",
        "jungle"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LES TRIBUS :\nConf\xE9d\xE9ration spirituelle guid\xE9e par les chamanes. Aucune loi \xE9crite : les esprits conseillent, les traditions tranchent, la Grande Chamane arbitre.\n\nSOUVERAINE : Grande Chamane Inti Spiritborn (voir Souverains).\n\nRELIGION \u2014 LES CULTES ANCESTRAUX :\nLe monde est habit\xE9 : chaque rivi\xE8re, arbre et b\xEAte a son esprit, chaque anc\xEAtre veille. Les chamanes traversent en transe le Monde-Miroir pour consulter. Offenser un esprit exige r\xE9paration rituelle ; les pr\xE9sages pr\xE9c\xE8dent toute d\xE9cision majeure. Fait troublant r\xE9cent : les esprits proches des Zones Corrompues se taisent \u2014 les chamanes sont les premiers \xE0 SENTIR le R\xE9veil des Voiles.\n\nLA VILLE :\nCit\xE9-jardin en terrasses dans la montagne, temples-arbres mill\xE9naires, march\xE9s d'herbes et de talismans. La Porte Astra a \xE9t\xE9 purifi\xE9e pendant un an avant d'\xEAtre accept\xE9e.\n\n\xC9CONOMIE : plantes m\xE9dicinales uniques, guides de jungle, talismans authentiques, caf\xE9 des hauteurs.\n\nTENSIONS : respect ancien avec Johannesburg. M\xE9fiance envers les civilisations qui pillent la terre. Refusent l'esclavage \u2014 les esprits ne distinguent pas les cha\xEEnes justes des injustes.\n\nEN SC\xC8NE :\nCalme profond, questions qui semblent hors sujet et ne le sont jamais, hospitalit\xE9 conditionn\xE9e au respect des lieux.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 29,
      category: "ROYAUME",
      title: "Sydney \u2014 Royaume des Sir\xE8nes",
      primary_keys: [
        "Sydney",
        "sir\xE8nes",
        "Coral",
        "chant",
        "oc\xE9an",
        "port",
        "mar\xE9es",
        "Australie"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE ROYAUME :\nThalassocratie contr\xF4lant les routes maritimes du Pacifique. La cour est mi-immerg\xE9e ; le pouvoir se chante autant qu'il se d\xE9cr\xE8te.\n\nSOUVERAINE : Reine Coral Deepsung (voir Souverains).\n\nRELIGION \u2014 LES CULTES DES PROFONDEURS :\nDivinit\xE9s marines anciennes, ant\xE9rieures aux races terrestres. Rites li\xE9s aux mar\xE9es ; le Grand Chant des \xE9quinoxes rassemble des milliers de voix qui, dit-on, apaisent les dieux sous les flots. Les terrestres sont tol\xE9r\xE9s aux rites de surface \u2014 jamais aux chants profonds. Blasph\xE8me supr\xEAme : polluer une eau sacr\xE9e.\n\nLA VILLE :\nPort \xE9blouissant mi-\xE9merg\xE9, tours de corail cultiv\xE9, canaux \xE0 la place des rues basses. La Porte Astra se dresse sur la grande jet\xE9e.\n\n\xC9CONOMIE : contr\xF4le des routes maritimes (p\xE9ages), perles, sauvetages en mer (tarif\xE9s), le chant lui-m\xEAme \u2014 les chanteuses de Sydney s'engagent \xE0 prix d'or.\n\nTENSIONS : contr\xF4le conjoint des mers avec Auckland \u2014 alliance solide teint\xE9e de rivalit\xE9 de prestige. La manipulation par le chant est un jeu l\xE9gitime chez elles, un scandale ailleurs.\n\nEN SC\xC8NE :\nS\xE9duction ambiante, humour aquatique, sens aigu du spectacle. Sur terre, prudence accrue \u2014 leur \xE9l\xE9ment leur manque.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 30,
      category: "ROYAUME",
      title: "Auckland \u2014 Royaume des Naga Marines",
      primary_keys: [
        "Auckland",
        "naga",
        "Ssythar",
        "profondeurs",
        "abysses",
        "Nouvelle-Z\xE9lande",
        "\xE9cailles"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE ROYAUME :\nLe plus ancien et le plus ferm\xE9 des royaumes. L'essentiel de la cit\xE9 est SOUS l'eau ; Auckland-surface n'est qu'une ambassade tol\xE9r\xE9e.\n\nSOUVERAIN : Ancien Ssythar Abysswhisper (voir Souverains).\n\nRELIGION \u2014 LA M\xC9MOIRE DES ABYSSES :\nPas de dieux : le Temps lui-m\xEAme. Les Naga v\xE9n\xE8rent la m\xE9moire \u2014 la leur couvre les cinq \xC8res. Les Archivistes psalmodient l'histoire du monde en chants de plusieurs jours ; oublier volontairement est le seul p\xE9ch\xE9. Ils consid\xE8rent les autres races comme des enfants amn\xE9siques \u2014 avec une piti\xE9 patiente.\n\nLA VILLE :\nSpirales de pierre noire dans les fosses oc\xE9aniques, jardins d'algues lumineuses, silence total. La surface : quelques quais, une Porte Astra, des interpr\xE8tes.\n\n\xC9CONOMIE : quasi autarcique. Vendent rarissimement : des v\xE9rit\xE9s historiques (ch\xE8res), des m\xE9taux des fosses, des pactes de non-agression maritime.\n\nTENSIONS : alliance de contr\xF4le maritime avec Sydney. Tout contact naga est significatif \u2014 un Naga qui se d\xE9place a une raison majeure. Sur le R\xE9veil des Voiles, ils savent des choses de l'\xC8re 2 que personne ne leur a demand\xE9es. Encore.\n\nEN SC\xC8NE :\nLenteur absolue, chaque mot pes\xE9, questions retourn\xE9es en \xE9nigmes. L'impatience d'un visiteur les amuse pendant des heures.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 31,
      category: "ROYAUME",
      title: "Zurich \u2014 Royaume des Nains",
      primary_keys: [
        "Zurich",
        "nains",
        "Durin",
        "forge",
        "montagne",
        "clans nains",
        "Suisse",
        "runes"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE ROYAUME :\nCit\xE9-forteresse creus\xE9e dans les Alpes, organis\xE9e en clans de forge. La richesse et la parole tenue font le rang ; les registres font foi de tout.\n\nSOUVERAIN : Roi-Forgeron Durin Anvilborn (voir Souverains).\n\nRELIGION \u2014 LE FEU PREMIER :\nCulte de la Forge Originelle d'o\xF9 seraient n\xE9s les Nains et les montagnes. Chaque forge est un autel ; forger est prier ; une \u0153uvre parfaite est une offrande. Les Ma\xEEtres-Forgerons sont clerg\xE9 et aristocratie \xE0 la fois. \xC9teindre volontairement la forge d'un clan est une d\xE9claration de guerre religieuse.\n\nLA VILLE :\nHalls titanesques sous la montagne, forges \xE9ternelles, coffres l\xE9gendaires, ponts sur des gouffres de lave domestiqu\xE9e. La Porte Astra est ench\xE2ss\xE9e dans une porte de bronze de vingt m\xE8tres.\n\n\xC9CONOMIE : la banque du monde (coffres inviolables, lettres de cr\xE9dit), acier et armes d'exception, gemmes, tunnels commerciaux sous les Alpes.\n\nTENSIONS : routes montagneuses disput\xE9es avec Istanbul \u2014 n\xE9gociations s\xE9culaires. M\xE9moire transg\xE9n\xE9rationnelle des dettes : un d\xE9faut de paiement se paie sur trois g\xE9n\xE9rations.\n\nEN SC\xC8NE :\nM\xE9fiance initiale, contrats \xE9crits pour tout, respect qui se forge lentement. Insulter la qualit\xE9 d'un travail nain est pire qu'insulter sa m\xE8re.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 32,
      category: "ROYAUME",
      title: "Katmandou \u2014 Territoire des G\xE9antes",
      primary_keys: [
        "Katmandou",
        "g\xE9antes",
        "Oya",
        "Himalaya",
        "sommets",
        "sagesse",
        "N\xE9pal"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LE TERRITOIRE :\nMoins un royaume qu'une pr\xE9sence : quelques centaines de G\xE9antes dispers\xE9es sur les plus hauts sommets du monde, sous l'autorit\xE9 morale de la Matriarche.\n\nSOUVERAINE : Matriarche Oya Cloudpeak (voir Souverains).\n\nRELIGION \u2014 LE SOUFFLE DES CIMES :\nContemplation des hauteurs o\xF9, disent-elles, le monde pense. M\xE9ditation de d\xE9cennies, paroles rares grav\xE9es dans la pierre des cols \u2014 des p\xE8lerins de toutes races grimpent des semaines pour lire une phrase de G\xE9ante. Pas de rites : la patience EST le culte.\n\nLE TERRITOIRE :\nMonast\xE8res-cavernes aux portes de dix m\xE8tres, sentiers vertigineux, villages humains-sherpas sous protection tacite. La Porte Astra, en contrebas, est la plus haute et la moins fr\xE9quent\xE9e du monde.\n\n\xC9CONOMIE : quasi nulle et s'en moque. \xC9changent rarement : pierres pr\xE9cieuses des sommets contre livres, th\xE9 et nouvelles du monde.\n\nTENSIONS : aucune \u2014 neutralit\xE9 absolue et respect\xE9e. Quand une G\xE9ante descend, les royaumes retiennent leur souffle : la derni\xE8re fois, c'\xE9tait pour clore la Guerre des Voiles.\n\nEN SC\xC8NE :\nUne G\xE9ante parle peu ; chaque mot p\xE8se une d\xE9cennie. \xCAtre remarqu\xE9 par l'une d'elles est un \xE9v\xE9nement d'une vie.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CITY"
    },
    {
      id: 33,
      category: "GUILDE",
      title: "Guilde des Aventuriers",
      primary_keys: [
        "guilde des aventuriers",
        "rang",
        "mission",
        "contrat",
        "aventurier",
        "qu\xEAte",
        "prime",
        "tableau des missions"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xD4LE :\nR\xE9seau mondial de contrats : escortes, chasses, r\xE9cup\xE9rations, protection, exploration. Pr\xE9sente dans les 14 capitales, neutre dans tous les conflits politiques.\n\nRANGS (plaque de m\xE9tal port\xE9e) :\nBronze \u2192 d\xE9butants, contrats locaux sans danger\nFer \u2192 confirm\xE9s, escortes et chasses courantes\nArgent \u2192 v\xE9t\xE9rans, contrats r\xE9gionaux risqu\xE9s\nOr \u2192 \xE9lite, contrats internationaux majeurs\nL\xE9gendaire \u2192 exceptionnel, sollicit\xE9 par les souverains. UN SEUL d\xE9tenteur vivant : Sir William Guillon.\n\nPROMOTION : contrats valid\xE9s + \xE9valuation de la Ma\xEEtresse de Guilde locale. Un \xE9chec grave peut r\xE9trograder ; un abandon de contrat sans motif = suspension.\n\nFONCTIONNEMENT :\nLe tableau des missions affiche les contrats par rang. La guilde pr\xE9l\xE8ve 10% et garantit le paiement \u2014 arnaquer la guilde ferme les 14 comptoirs \xE0 vie. Les rapports de mission alimentent les registres (m\xE9moire institutionnelle mondiale).\n\nLOCAUX : comptoir, tableau, salle de repos, chirurgien pour les membres.\n\nR\xC8GLES :\n- Un contrat accept\xE9 est un Engagement (voir m\xE9tamoteurs)\n- Le rang est v\xE9rifiable en un regard : jamais de bluff possible\n- La guilde ne juge pas la moralit\xE9 d'un contrat l\xE9gal",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "FACTION"
    },
    {
      id: 34,
      category: "GUILDE",
      title: "Guilde des Marchands",
      primary_keys: [
        "guilde des marchands",
        "commerce",
        "caravane",
        "n\xE9goce",
        "comptoir",
        "lettre de cr\xE9dit",
        "marchandise"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xD4LE :\nR\xE9gule le grand commerce inter-royaumes : caravanes, comptoirs, lettres de cr\xE9dit, arbitrages. Si\xE8ge mondial \xE0 Istanbul, antennes partout.\n\nSERVICES :\nLettres de cr\xE9dit (voyager sans or sur soi), assurance caravanes, certification des marchandises, tribunal commercial priv\xE9 (plus rapide que la justice royale), listes noires des mauvais payeurs \u2014 partag\xE9es entre les 14 capitales.\n\nHI\xC9RARCHIE : Apprenti \u2192 Marchand patent\xE9 \u2192 Ma\xEEtre de comptoir \u2192 Prince Marchand (si\xE8gent au conseil d'Istanbul).\n\nPOUVOIR R\xC9EL :\nPeut asphyxier une ville en d\xE9tournant les caravanes. Les royaumes la m\xE9nagent ; elle ne prend jamais parti ouvertement \u2014 elle vend aux deux camps.\n\nR\xC8GLES :\n- Une dette enregistr\xE9e \xE0 la guilde suit le d\xE9biteur dans les 14 capitales\n- Le tribunal marchand r\xE8gle en jours ce que la justice r\xE8gle en mois\n- Corruption possible mais ch\xE8re et risqu\xE9e",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "FACTION"
    },
    {
      id: 35,
      category: "GUILDE",
      title: "Ordre des Mages",
      primary_keys: [
        "ordre des mages",
        "tour de l'ordre",
        "magie r\xE9gul\xE9e",
        "archimage",
        "licence magique",
        "mage ren\xE9gat"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xD4LE :\nR\xE9gule la magie avanc\xE9e mondiale : licences, formation, traque des ren\xE9gats, scellement des artefacts dangereux. Tours de l'Ordre dans chaque capitale (sauf Delhi, qui tol\xE8re \xE0 peine une antenne).\n\nSTRUCTURE : Apprentis \u2192 Mages licenci\xE9s \u2192 Ma\xEEtres \u2192 Archimages du Conclave.\n\nCE QUE L'ORDRE INTERDIT :\nMagie des Voiles (absolument), n\xE9cromancie de masse, magie mentale sur autrui sans consentement, invocations majeures non d\xE9clar\xE9es. Les Traqueurs de l'Ordre arr\xEAtent les ren\xE9gats \u2014 ou les font dispara\xEEtre.\n\nCE QUE L'ORDRE SAIT (secret) :\nLe R\xE9veil des Voiles est mesur\xE9, cartographi\xE9, \xE9touff\xE9. Le Conclave est divis\xE9 : r\xE9v\xE9ler et paniquer le monde, ou contenir en silence ? Pour l'instant, le silence gagne \u2014 et le culte en profite.\n\nRAPPORT AUX ROYAUMES :\nOfficiellement au service de tous, r\xE9ellement au service de la magie elle-m\xEAme. Tokyo le courtise, Delhi le m\xE9prise, tous le craignent un peu.\n\nR\xC8GLES :\n- Un usage de magie avanc\xE9e visible attire l'attention de l'Ordre\n- Les licences s'ach\xE8tent aussi par le talent d\xE9montr\xE9\n- Un artefact des Voiles d\xE9couvert DOIT leur \xEAtre remis \u2014 en th\xE9orie",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "FACTION"
    },
    {
      id: 36,
      category: "GUILDE",
      title: "Guilde des Ombres",
      primary_keys: [
        "guilde des ombres",
        "p\xE8gre",
        "voleur",
        "assassin",
        "contrebande",
        "march\xE9 noir",
        "bas-fonds",
        "commanditaire"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xD4LE :\nLA p\xE8gre organis\xE9e d'Elyndor : vol commandit\xE9, contrebande, assassinat, renseignement, march\xE9 noir. Officiellement, elle n'existe pas. R\xE9ellement, elle a des quartiers dans les 14 capitales.\n\nSTRUCTURE :\nCellules locales sous un Ma\xEEtre des Ombres par ville ; au sommet, le Conseil Sans Visage \u2014 identit\xE9s inconnues, peut-\xEAtre m\xEAme des nobles ou des marchands respect\xE9s.\n\nSERVICES (pour qui sait demander) :\nObjets vol\xE9s sur commande, passages clandestins, faux papiers, informations, contrats discrets. Prix \xE9lev\xE9s, r\xE9sultats garantis \u2014 la guilde tient parole avec la m\xEAme rigueur qu'un banquier nain : c'est son fonds de commerce.\n\nCODE INTERNE :\nOn ne balance jamais la guilde (les bavards disparaissent). On ne vole pas la guilde. Les civils ne sont tu\xE9s que si le contrat l'exige. Les ind\xE9pendants dou\xE9s sont recrut\xE9s \u2014 ou \xE9limin\xE9s s'ils refusent deux fois.\n\nR\xC8GLES :\n- Contact uniquement par interm\xE9diaires, jamais frontal\n- Une dette envers la guilde se paie toujours, en or ou en service\n- La garde conna\xEEt son existence et n\xE9gocie des \xE9quilibres tacites",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "FACTION"
    },
    {
      id: 37,
      category: "SYST\xC8ME",
      title: "Esclavage",
      primary_keys: [
        "esclave",
        "esclavage",
        "ma\xEEtre",
        "collier",
        "servitude",
        "affranchie",
        "captive",
        "soumission"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "L\xC9GALIT\xC9 PAR ROYAUME :\nL\xE9gal et encadr\xE9 \u2192 Paris, Tokyo, Delhi, Istanbul, Mexico, Zurich\nIll\xE9gal \u2192 Johannesburg (esclave libre sur leur sol), Bogot\xE1, Katmandou\nZones grises \u2192 Oslo (captifs de guerre seulement), Lagos, New York, Sydney, Auckland (rare, r\xE9glement\xE9)\n\nM\xC9CANIQUE \u2014 DEUX AXES IND\xC9PENDANTS :\nLIEN (\xE9motionnel, envers le ma\xEEtre) : Hostile \u2192 M\xE9fiante \u2192 Neutre \u2192 Attach\xE9e \u2192 D\xE9vou\xE9e \u2192 Amoureuse. \xC9volue par les actes du ma\xEEtre.\nSOUMISSION (comportement) : D\xE9fiante \u2192 R\xE9sign\xE9e \u2192 Ob\xE9issante \u2192 Bris\xE9e ou \xC9panouie. \xC9volue par le traitement et le temps (voir Captivit\xE9 \u2014 \xC9volution Temporelle).\n\nPOINTS DE D\xC9PART SELON L'ORIGINE :\nCapture de guerre \u2192 D\xE9fiante / Hostile\nVendue pour dettes \u2192 R\xE9sign\xE9e / Neutre\nN\xE9e esclave \u2192 Ob\xE9issante / Neutre\nCondamn\xE9e par justice \u2192 D\xE9fiante ou R\xE9sign\xE9e / Hostile\n\nR\xC8GLES :\n- Les deux axes \xE9voluent s\xE9par\xE9ment et lentement\n- Une esclave garde sa personnalit\xE9, son pass\xE9, ses comp\xE9tences\n- L'affranchissement existe : rachat, gr\xE2ce, ou droit local (10 victoires d'ar\xE8ne \xE0 Mexico)\n- Un collier retir\xE9 ne retire pas les r\xE9flexes appris",
      priority: 50,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 38,
      category: "SYST\xC8ME",
      title: "Justice",
      primary_keys: [
        "proc\xE8s",
        "jugement",
        "tribunal",
        "juge",
        "sentence",
        "verdict",
        "accusation",
        "condamnation",
        "hors-la-loi"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "QUATRE JUSTICES COEXISTENT :\n\nROYALE : crimes majeurs, proc\xE8s public, juge nomm\xE9. Lente, sensible au rang et \xE0 l'or. Peines : amende, fouet, prison, esclavage p\xE9nal, mort.\nDE GUILDE : litiges internes, rapide, experte. Peines : amendes, suspension, bannissement des comptoirs.\nRELIGIEUSE : blasph\xE8mes et crimes sacr\xE9s, selon le culte local (inquisition \xE0 Paris, duel sacr\xE9 \xE0 Delhi, palabre \xE0 Johannesburg).\nDE LA RUE : dans les bas-fonds, la Guilde des Ombres et les gangs arbitrent \u2014 vite et sans appel.\n\nD\xC9ROULEMENT TYPE (royale) :\nArrestation \u2192 cachot (jours \xE0 semaines) \u2192 audience \u2192 verdict le jour m\xEAme. T\xE9moins achetables, juges parfois aussi. Un bon avocat (rare, cher) change tout.\n\nSTATUT DE HORS-LA-LOI :\nProclam\xE9 pour les fuyards : prime publique, aucun droit, tuable sans proc\xE8s dans le royaume \xE9metteur. Les avis circulent par les Portes Astra.\n\nR\xC8GLES :\n- La justice varie selon le royaume, le rang et la bourse\n- {{user}} recherch\xE9 \u2192 Passeuses Astra le bloquent\n- Une condamnation marque la r\xE9putation durablement",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 39,
      category: "SYST\xC8ME",
      title: "Captivit\xE9 \u2014 \xC9volution Temporelle",
      primary_keys: [
        "captive depuis",
        "esclave depuis",
        "des mois de captivit\xE9",
        "habitu\xE9e",
        "s'habitue",
        "longue servitude"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: `PRINCIPE :
Le temps de captivit\xE9 module la Soumission au-del\xE0 du point de d\xE9part. Toujours croiser origine + dur\xE9e + traitement.

PALIERS DE DUR\xC9E :
Premi\xE8re semaine \u2192 \xE9tat de d\xE9part brut, r\xE9actions vives (fuite envisag\xE9e, tests des limites)
Premier mois \u2192 routines qui s'installent, la r\xE9volte devient calcul
Six mois \u2192 la Soumission de d\xE9part \xE9volue d'un cran selon le traitement (D\xE9fiante \u2192 R\xE9sign\xE9e si duret\xE9 constante ; D\xE9fiante \u2192 D\xE9fiante "us\xE9e" si r\xE9sistance sans espoir ; vers \xC9panouie si respect r\xE9el)
Un an et plus \u2192 l'ancien statut devient m\xE9moire ; la personnalit\xE9 se reconstruit autour du nouveau
Des ann\xE9es \u2192 seule une rupture majeure (\xE9vasion possible, affranchissement, trahison du ma\xEEtre) peut encore inverser la trajectoire

MODULATEURS :
Traitement cruel \u2192 acc\xE9l\xE8re vers Bris\xE9e, jamais vers \xC9panouie
Respect et confiance \u2192 seul chemin vers \xC9panouie
Espoir ext\xE9rieur concret (rachat possible, proches actifs) \u2192 g\xE8le l'\xE9volution
Isolement total \u2192 acc\xE9l\xE8re tout

R\xC8GLE :
Annoncer la dur\xE9e de captivit\xE9 d'une esclave introduite = son \xE9tat d\xE9coule de cette table, jamais du hasard.`,
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 40,
      category: "M\xC9CANIQUE",
      title: "Paliers de Blessure \u2014 D\xE9clencheurs",
      primary_keys: [
        "bless\xE9",
        "blessure grave",
        "saigne",
        "coup re\xE7u",
        "touch\xE9",
        "plaie",
        "fracture",
        "h\xE9morragie"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LES TROIS PALIERS (rappel) :\nBlessure \u2192 g\xEAne r\xE9elle, temporaire\nGrave \u2192 danger vital, incapacit\xE9 partielle\nCritique \u2192 mort imminente sans intervention\n\nQUAND BASCULER (r\xE8gles de bascule) :\nCoup net d'arme blanche par\xE9/partiel \u2192 Blessure\nCoup pleine puissance non par\xE9, carreau, chute >3m \u2192 Grave\nCoup vital direct (gorge, c\u0153ur, t\xEAte sans casque), magie destructrice \xE0 bout portant, chute >10m \u2192 Critique\nBlessure non soign\xE9e 2 jours \u2192 s'infecte, monte d'un palier\nDeux blessures Graves simultan\xE9es \u2192 Critique\n\nTEMPS DE R\xC9CUP\xC9RATION :\nBlessure \u2192 2-5 jours (1 jour avec soins magiques)\nGrave \u2192 2-6 semaines (1 semaine avec soins magiques) + s\xE9quelle possible\nCritique \u2192 survie = 1-3 mois, cicatrices garanties, s\xE9quelle probable\n\nEFFETS EN JEU :\nBlessure \u2192 malus l\xE9ger, douleur mentionn\xE9e\nGrave \u2192 un bras/jambe inutilisable, combat quasi impossible\nCritique \u2192 au sol, conscience vacillante, chaque minute compte\n\nR\xC8GLE :\n{{user}} ne meurt jamais sans consentement \u2014 Critique bascule vers capture, sauvetage ou fuite in extremis.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 41,
      category: "M\xC9CANIQUE",
      title: "R\xE8gle de N\xE9gociation",
      primary_keys: [
        "n\xE9gocie",
        "marchande",
        "prix demand\xE9",
        "rabais",
        "trop cher",
        "baisse le prix",
        "marchandage"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nTout se n\xE9gocie en Elyndor \u2014 dans des limites pr\xE9visibles par profil.\n\nMARGES PAR VENDEUR :\nMarchand de bazar \u2192 annonce +40%, c\xE8de jusqu'\xE0 -30% du prix annonc\xE9\nBoutique \xE9tablie \u2192 annonce +20%, c\xE8de jusqu'\xE0 -15%\nGuilde (contrats, services) \u2192 tarifs quasi fixes, -5% max pour les fid\xE8les\nMarch\xE9 noir \u2192 annonce +100%, c\xE8de jusqu'\xE0 -40% \u2014 mais tout refus peut \xEAtre d\xE9finitif\nMarchand d'esclaves \u2192 annonce +30%, c\xE8de -20%, jamais sous le prix d'achat\n\nD\xC9ROUL\xC9 TYPE : 2-4 \xE9changes d'offres. Plus = insulte ou th\xE9\xE2tre (Istanbul adore le th\xE9\xE2tre).\n\nMODIFICATEURS :\nR\xE9putation locale positive \u2192 -10% suppl\xE9mentaires possibles\nPayer en or sonnant \u2192 -5%\nLangue locale parl\xE9e \u2192 meilleure ouverture\nUrgence visible de l'acheteur \u2192 le vendeur DURCIT\nArch\xE9type Marchand + modificateur Cupide \u2192 marges hautes tenues\n\nR\xC8GLE :\nUn PNJ ne brade jamais sous sa marge sans raison narrative (peur, dette, faveur due).",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 42,
      category: "M\xC9CANIQUE",
      title: "Protocole de D\xE9c\xE8s d'un PNJ",
      primary_keys: [
        "meurt",
        "mort de",
        "cadavre",
        "tu\xE9",
        "fun\xE9railles",
        "d\xE9c\xE8s",
        "enterrement",
        "h\xE9ritage"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "QUAND UN PNJ MEURT, D\xC9ROULER :\n\n1. PROPAGATION DE LA NOUVELLE :\nT\xE9moin direct \u2192 quartier en heures, ville en 1 jour\nSans t\xE9moin \u2192 d\xE9couverte du corps ou disparition remarqu\xE9e (jours)\nPNJ notable \u2192 toutes capitales en 3-5 jours via Portes Astra\n\n2. CONS\xC9QUENCES AUTOMATIQUES :\nContrats en cours \u2192 caducs ou transf\xE9r\xE9s\nDettes \u2192 r\xE9clam\xE9es aux h\xE9ritiers ou effac\xE9es\nBiens \u2192 h\xE9ritage selon culture (lign\xE9e \xE0 Delhi, clan \xE0 Johannesburg, testament \xE0 Zurich...)\nFonction \u2192 rempla\xE7ant nomm\xE9 sous jours/semaines ; p\xE9riode de flottement exploitable\n\n3. R\xC9ACTIONS :\nProches \u2192 deuil selon culture, vengeance possible si meurtre\nEnnemis \u2192 opportunit\xE9s saisies\nSi {{user}} est impliqu\xE9 \u2192 enqu\xEAte proportionnelle au statut de la victime et aux t\xE9moins\n\n4. R\xC9CURRENTS NOMM\xC9S :\nMort = rupture l\xE9gitime majeure. Le successeur est un NOUVEAU personnage (jamais un clone), la fonction continue, le monde se souvient.\n\nR\xC8GLE :\nAucune mort n'est un simple \xE9v\xE9nement \u2014 chacune tire au moins deux fils de cons\xE9quences.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 43,
      category: "M\xC9CANIQUE",
      title: "\xC9chelle des Conflits Arm\xE9s",
      primary_keys: [
        "bataille",
        "arm\xE9e",
        "guerre",
        "si\xE8ge",
        "escarmouche",
        "campagne militaire",
        "troupes",
        "r\xE9giment"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "\xC9CHELLES DE CONFLIT :\nRixe \u2192 2-10 combattants, minutes\nEscarmouche \u2192 10-50, une heure, patrouilles ou bandes\nRaid \u2192 50-200, un jour, village ou caravane majeure\nBataille \u2192 500-5000, un jour d\xE9cisif apr\xE8s semaines de man\u0153uvres\nSi\xE8ge \u2192 des mois, la faim tue plus que les armes\nCampagne \u2192 une saison enti\xE8re, rare depuis l'\xC8re 5\n\nARM\xC9ES TYPES DES ROYAUMES :\nGarnison de capitale \u2192 2000-5000 professionnels\nArm\xE9e mobilis\xE9e \u2192 10000-30000 avec lev\xE9es\nDelhi et Oslo \u2192 qualit\xE9 sup\xE9rieure, effectifs moindres\nKatmandou \u2192 aucune arm\xE9e ; personne n'a jamais test\xE9 pourquoi\n\nR\xC9ALIT\xC9S DE CAMPAGNE :\nUne arm\xE9e marche 20-25 km/jour et mange une fortune quotidienne. Les guerres se gagnent par la logistique, les Portes Astra (interdites aux troupes par le Conseil \u2014 les contourner = casus belli mondial) et la trahison.\n\nPLACE DE {{user}} :\nUn individu ne change pas une bataille par ses bras \u2014 il la change par un assassinat, une porte ouverte, un duel de champions, un renseignement.\n\nR\xC8GLE :\nAucune guerre ouverte entre royaumes sans longue mont\xE9e jou\xE9e en amont.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 44,
      category: "M\xC9CANIQUE",
      title: "Apprentissage de Comp\xE9tences",
      primary_keys: [
        "apprendre",
        "entra\xEEnement",
        "ma\xEEtre d'armes",
        "le\xE7on",
        "formation",
        "progresser",
        "s'entra\xEEner",
        "\xE9tudier"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nToute comp\xE9tence s'apprend \u2014 avec du temps, un ma\xEEtre et de l'or. Jamais d'apprentissage instantan\xE9.\n\nDUR\xC9ES R\xC9ALISTES :\nBases utilisables \u2192 3-6 mois de pratique r\xE9guli\xE8re\nNiveau professionnel \u2192 2-5 ans\nMa\xEEtrise \u2192 10+ ans ou don exceptionnel\nMagie : doublez tout, et il faut le don ou un artefact\n\nCO\xDBTS :\nMa\xEEtre d'armes de quartier \u2192 5 argents/semaine\nInstructeur de guilde \u2192 r\xE9serv\xE9 aux membres, inclus dans la cotisation\nMa\xEEtre renomm\xE9 \u2192 1 or/semaine, et il choisit ses \xE9l\xE8ves\nTuteur magique licenci\xE9 \u2192 3 or/semaine + accord de l'Ordre\n\nEN JEU :\nL'apprentissage se joue en ellipses : annoncer la p\xE9riode, jouer les sc\xE8nes marquantes (premier succ\xE8s, humiliation formatrice, examen). La progression de {{user}} est not\xE9e dans la continuit\xE9 et reste coh\xE9rente \u2014 pas expert un jour, d\xE9butant le lendemain.\n\nR\xC8GLE :\nUn PNJ ma\xEEtre enseigne selon son Arch\xE9type : le Guerrier par la douleur, l'\xC9rudit par la th\xE9orie, le Marchand contre services.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 45,
      category: "M\xC9CANIQUE",
      title: "Conflits PNJ contre PNJ",
      primary_keys: [
        "se battent entre eux",
        "dispute entre",
        "querelle",
        "s'affrontent",
        "rivaux",
        "duel entre"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "QUAND DEUX PNJ S'OPPOSENT DEVANT {{user}}, ARBITRER PAR :\n\n1. COMP\xC9TENCE \xC9TABLIE : une capitaine de la Garde d'Obsidienne bat un bandit de rue \u2014 sauf circonstance renversante jou\xE9e (embuscade, poison, surnombre).\n\n2. ARCH\xC9TYPES : Guerrier > civil au combat ; Marchand > Guerrier en n\xE9gociation ; \xC9rudit > tous en savoir. Chacun gagne sur son terrain.\n\n3. ENJEU NARRATIF : l'issue qui cr\xE9e le plus de cons\xE9quences int\xE9ressantes l'emporte \xE0 comp\xE9tences \xE9gales \u2014 jamais l'issue qui arrange {{user}}.\n\n4. T\xC9MOINS : un duel public a des suites (r\xE9putation, justice, vengeance) ; un r\xE8glement discret n'en a que si d\xE9couvert.\n\nISSUES POSSIBLES (pas que la mort) :\nHumiliation publique, blessure, dette de vie, fuite, r\xE9conciliation forc\xE9e, haine durable inscrite en continuit\xE9.\n\nR\xC8GLE :\n{{user}} peut intervenir \xE0 tout moment \u2014 son intervention rebat les cartes mais suit les m\xEAmes r\xE8gles de comp\xE9tence.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 46,
      category: "M\xC9CANIQUE",
      title: "Possession et Gestion de Biens",
      primary_keys: [
        "acheter une maison",
        "propri\xE9t\xE9",
        "domaine",
        "boutique",
        "acqu\xE9rir",
        "loyer",
        "revenus",
        "g\xE9rance",
        "investir"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "ACQU\xC9RIR :\nMaison de ville modeste \u2192 50-100 or\nBelle demeure \u2192 300-800 or\nBoutique avec fonds \u2192 200-500 or\nTaverne \u2192 400-1000 or\nDomaine rural avec village \u2192 2000+ or, et l'accord du souverain local\nLes actes passent par notaires (Paris), registres de clan (Zurich), ou palabre publique (Johannesburg).\n\nREVENUS ET CHARGES (mensuels) :\nBoutique bien g\xE9r\xE9e \u2192 10-30 or bruts, moiti\xE9 en charges\nTaverne \u2192 15-40 or bruts, personnel \xE0 payer\nDomaine \u2192 50-200 or bruts selon saison, garnison \xE0 entretenir\nSans g\xE9rant comp\xE9tent sur place \u2192 revenus divis\xE9s par deux, probl\xE8mes multipli\xE9s\n\nCE QUE LA POSSESSION CR\xC9E :\nStatut local, obligations (taxes, s\xE9curit\xE9, employ\xE9s), convoitises, ancrage \u2014 un bien immobile est une cible immobile.\n\nR\xC8GLE :\nUn bien laiss\xE9 sans surveillance \xE9volue hors \xE9cran : incidents, squatteurs, g\xE9rant ind\xE9licat ou prosp\xE9rit\xE9 \u2014 selon la continuit\xE9, jamais le statu quo.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 47,
      category: "MONDE",
      title: "Distances entre Capitales",
      primary_keys: [
        "distance",
        "combien de jours",
        "loin de",
        "trajet jusqu'\xE0",
        "rejoindre",
        "dur\xE9e du voyage"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PAR PORTE ASTRA : instantan\xE9 entre capitales (voir tarifs).\n\nPAR ROUTE/MER (\xE0 cheval ou navire, conditions normales) :\nParis \u2194 Zurich \u2192 6 jours (route alpine)\nParis \u2194 Istanbul \u2192 25 jours\nParis \u2194 Oslo \u2192 15 jours (dont mer)\nIstanbul \u2194 Delhi \u2192 40 jours (caravane)\nDelhi \u2194 Katmandou \u2192 12 jours (montagne)\nDelhi \u2194 Tokyo \u2192 50 jours (steppe et mer)\nIstanbul \u2194 Lagos \u2192 45 jours (d\xE9sert puis piste)\nLagos \u2194 Johannesburg \u2192 30 jours\nMexico \u2194 New York \u2192 20 jours\nNew York \u2194 Bogot\xE1 \u2192 35 jours (jungle finale)\nSydney \u2194 Auckland \u2192 8 jours de mer\nTokyo \u2194 Sydney \u2192 30 jours de mer\n\nR\xC8GLES D'USAGE :\nVille secondaire \u2194 capitale r\xE9gionale \u2192 1-10 jours selon la r\xE9gion\nHiver ou mousson \u2192 +50% sur terre\nCes dur\xE9es rendent les Portes Astra strat\xE9giques : sans elles, Elyndor redevient immense\n\nR\xC8GLE :\nToujours annoncer la dur\xE9e d'un trajet hors-Porte \u2014 le temps qui passe alimente la continuit\xE9.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 48,
      category: "MONDE",
      title: "Monnaie d'Elyndor",
      primary_keys: [
        "pi\xE8ce",
        "or",
        "argent",
        "cuivre",
        "bourse",
        "paiement",
        "co\xFBt",
        "monnaie",
        "payer",
        "prix"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "SYST\xC8ME UNIVERSEL :\n1 pi\xE8ce d'or = 10 pi\xE8ces d'argent = 100 pi\xE8ces de cuivre. Frapp\xE9es par royaume, accept\xE9es partout \u2014 les nains de Zurich garantissent les titres de m\xE9tal.\n\nREP\xC8RES DE VALEUR :\n1 cuivre \u2192 un pain, une chope\n1 argent \u2192 une bonne journ\xE9e de travail ouvrier\n1 or \u2192 un mois de vie modeste\n10 or \u2192 un cheval correct\n100 or \u2192 une maison simple\n\nFORTUNES TYPES :\nPaysan \u2192 quelques cuivres d'avance\nArtisan \u2192 quelques argents\nMarchand \xE9tabli \u2192 dizaines d'or\nNoble \u2192 centaines \xE0 milliers d'or\nLes lettres de cr\xE9dit de la Guilde Marchande \xE9vitent de voyager charg\xE9.\n\nR\xC8GLE :\nTous les prix du monde se r\xE9f\xE8rent \xE0 cette \xE9chelle (voir les entr\xE9es Prix).",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 0,
      scope: "GLOBAL"
    },
    {
      id: 49,
      category: "MONDE",
      title: "Prix Indicatifs \u2014 Vie Quotidienne",
      primary_keys: [
        "combien co\xFBte",
        "addition",
        "note",
        "tarif",
        "d\xE9pense",
        "payer la chambre",
        "prix du repas"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TAVERNE :\nChope de bi\xE8re \u2192 1 cuivre / Vin correct \u2192 3 cuivres / Hydromel d'Oslo \u2192 5 cuivres\nRepas simple \u2192 2-3 cuivres / Bon repas viande \u2192 8-12 cuivres / Festin \u2192 5 argents\nAlc\xF4ve discr\xE8te \u2192 5 cuivres l'heure\n\nH\xC9BERGEMENT : dortoir 3 c / chambre 8-12 c / suite 3-5 a / bain chaud 2 c\n\nSERVICES :\nMessager en ville \u2192 2 cuivres / entre villes \u2192 5 argents\nBain public \u2192 1 cuivre / Barbier \u2192 2 cuivres\nGu\xE9risseur commun \u2192 5-20 cuivres / Soin magique \u2192 5 argents \xE0 5 or\nFille ou gar\xE7on de joie \u2192 5 cuivres \xE0 2 argents selon l'\xE9tablissement ; courtisane renomm\xE9e \u2192 1 or et son bon vouloir\n\nTRANSPORT :\nPlace en caravane \u2192 2 argents/semaine / Location cheval \u2192 5 argents/jour / Passage fluvial \u2192 5 cuivres\n\nR\xC8GLE :\nCapitales riches (Tokyo, Zurich) +30% ; quartiers pauvres -30% ; p\xE9riodes de f\xEAte +50%.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 50,
      category: "MONDE",
      title: "Prix de l'\xC9quipement",
      primary_keys: [
        "prix de l'\xE9p\xE9e",
        "acheter une arme",
        "co\xFBt de l'armure",
        "forgeron prix",
        "\xE9quipement neuf",
        "r\xE9paration"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "ARMES (qualit\xE9 standard) :\nDague \u2192 5 argents / \xC9p\xE9e courte \u2192 2 or / \xC9p\xE9e longue \u2192 5 or\n\xC9p\xE9e \xE0 deux mains \u2192 8 or / Arc de chasse \u2192 3 or / Arc de guerre \u2192 7 or\nArbal\xE8te \u2192 10 or / Carreaux ou fl\xE8ches (20) \u2192 5 argents\nLance \u2192 1 or / Hache de guerre \u2192 4 or\n\nARMURES :\nCuir (style Elyndor, minimaliste) \u2192 3 or / Cuir clout\xE9 \u2192 6 or\nMailles partielles \u2192 15 or / Plaques vitales \u2192 40 or\nBouclier \u2192 2 or\n\nQUALIT\xC9S :\n\u0152uvre de ma\xEEtre (Delhi, Zurich) \u2192 \xD73 \xE0 \xD75, sur commande, d\xE9lais\nEnchant\xE9e (licence de l'Ordre) \u2192 \xD710 minimum, rare\nCamelote de bazar \u2192 \xF72, casse au pire moment\n\nR\xC9PARATIONS :\nSimple \u2192 10% du prix neuf / Grave \u2192 40% / Une arme bris\xE9e de ma\xEEtre m\xE9rite p\xE8lerinage chez sa forgeronne d'origine\n\nR\xC8GLE :\nUn \xE9quipement ab\xEEm\xE9 le reste jusqu'\xE0 r\xE9paration pay\xE9e \u2014 la forgeronne locale est un passage oblig\xE9 du quotidien d'aventurier.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 51,
      category: "MONDE",
      title: "Salaires et M\xE9tiers Courants",
      primary_keys: [
        "salaire",
        "gagne sa vie",
        "revenu",
        "m\xE9tier",
        "paie",
        "solde",
        "embauche",
        "travail"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "REVENUS MENSUELS TYPES :\nOuvrier, porteur \u2192 2-3 or\nArtisan qualifi\xE9 \u2192 5-8 or\nGarde de ville \u2192 4 or + logement\nSoldat professionnel \u2192 5 or + \xE9quipement\nV\xE9t\xE9ran d'\xE9lite (Garde d'Obsidienne) \u2192 12 or\nPr\xE9cepteur, scribe \u2192 6 or\nPr\xEAtre de quartier \u2192 log\xE9, nourri, dons\nCapitaine marchand \u2192 20-40 or\nAventurier Bronze \u2192 irr\xE9gulier, 3-8 or\nAventurier Argent \u2192 20-50 or les bons mois\nAventurier Or \u2192 100+ or par contrat majeur\n\nCONTRATS DE GUILDE TYPES :\nEscorte de caravane (2 semaines) \u2192 5 or\nChasse au monstre r\xE9gional \u2192 15-40 or\nR\xE9cup\xE9ration en Zone Corrompue \u2192 50 or et plus \u2014 et \xE7a monte depuis le R\xE9veil\n\nR\xC8GLE :\nCes rep\xE8res calibrent offres d'emploi, primes et r\xE9compenses \u2014 un PNJ ne propose jamais un prix absurde pour son \xE9chelle.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 52,
      category: "MONDE",
      title: "Prix des Esclaves par Profil",
      primary_keys: [
        "prix d'une esclave",
        "vaut combien",
        "acheter une esclave",
        "vente aux ench\xE8res",
        "valeur marchande",
        "marchand d'esclaves"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "FOURCHETTES (march\xE9 l\xE9gal, \xE9tat correct) :\nDomestique sans formation \u2192 10-20 or\nDomestique form\xE9e (maison noble) \u2192 30-60 or\nOuvri\xE8re, force de travail \u2192 15-30 or\nArtisane qualifi\xE9e \u2192 50-100 or\nLettr\xE9e, \xE9ducatrice \u2192 60-120 or\nGuerri\xE8re captur\xE9e \u2192 80-150 or (revente risqu\xE9e, prestige \xE9lev\xE9)\nCourtisane form\xE9e \u2192 100-200 or\nRaret\xE9 raciale (Sir\xE8ne, Naga \u2014 quasi introuvables) \u2192 500+ or, ench\xE8res\n\nMODIFICATEURS :\nBeaut\xE9 exceptionnelle \u2192 \xD71.5 \xE0 \xD72\nSoumission D\xE9fiante \u2192 -30% (risque) ou +30% (certains amateurs)\nRace du royaume vendeur \u2192 jamais vendue localement (tabou universel : on ne vend pas les siennes)\nPapiers de capture l\xE9gale absents \u2192 march\xE9 noir uniquement, -50%\n\nO\xD9 :\nGrand march\xE9 l\xE9gal \u2192 Paris (le plus vaste), Istanbul, Tokyo (luxe), Mexico (brutal)\nVoir March\xE9s aux Esclaves pour les autres capitales.\n\nR\xC8GLE :\nTout achat inclut acte de propri\xE9t\xE9 et collier r\xE9glementaire \u2014 sans acte, la propri\xE9t\xE9 est contestable en justice.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 2,
      scope: "GLOBAL"
    },
    {
      id: 53,
      category: "PROFIL RACIAL",
      title: "Humains",
      primary_keys: [
        "humain",
        "humaine",
        "europ\xE9en",
        "France",
        "Angleterre",
        "Allemagne",
        "adaptable"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Europe \u2014 Capitale : Paris\n\nCULTURE :\nAdaptabilit\xE9 comme force principale. Ambition individuelle valoris\xE9e. Vies courtes \u2192 urgence d'accomplir. Grandes maisons nobles, clerg\xE9 influent, bourgeoisie montante.\n\nENVERS AUTRES RACES :\nPragmatiques avant tout. Jalousie discr\xE8te envers la long\xE9vit\xE9 et la magie elfiques. Pass\xE9 trouble : collaborateurs historiques de l'Empire Elfe durant la Domination.\n\nENVERS {{user}} :\nCuriosit\xE9 ou m\xE9fiance selon r\xE9putation. Jugent sur les actes plus que sur la race.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nAmbitieux / Opportunistes / Diplomates\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 54,
      category: "PROFIL RACIAL",
      title: "Hauts-Elfes",
      primary_keys: [
        "haut-elfe",
        "haute-elfe",
        "elfe de Tokyo",
        "elfique imp\xE9rial",
        "caste elfique"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Asie de l'Est \u2014 Capitale : Tokyo\n\nCULTURE :\nSup\xE9riorit\xE9 raciale v\xE9cue comme \xE9vidence naturelle. Magie comme droit de naissance. Castes rigides. Patience de si\xE8cles : une vengeance peut attendre cent ans.\n\nAPPARENCE : traits parfaits, port altier, oreilles effil\xE9es, beaut\xE9 froide entretenue par la magie.\n\nENVERS AUTRES RACES :\nM\xE9pris poli envers les non-elfes. Haine active envers les Sang-M\xEAl\xE9. Rivalit\xE9 m\xE9prisante envers les Elfes Noirs \u2014 des parents d\xE9g\xE9n\xE9r\xE9s qui ont troqu\xE9 la magie contre le fer.\n\nENVERS {{user}} :\nCondescendance par d\xE9faut. Le respect se gagne par des actes exceptionnels, jamais par le rang des autres races.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nArrogants / Traditionalistes / M\xE9fiants\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 55,
      category: "PROFIL RACIAL",
      title: "Elfes Noirs",
      primary_keys: [
        "elfe noir",
        "elfe noire",
        "peau mate",
        "cheveux argent\xE9s",
        "guerri\xE8re de Delhi"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Asie du Sud \u2014 Capitale : Delhi\n\nCULTURE :\nNoblesse guerri\xE8re ancienne. M\xE9rite militaire prime sur la lign\xE9e : une capitaine respect\xE9e surpasse un noble qui n'a jamais combattu. Culte de la Lame Ancestrale (voir Royaume Delhi) : les lames h\xE9rit\xE9es portent l'esprit des a\xEFeules.\n\nAPPARENCE : peau mate \xE0 brun sombre, cheveux argent\xE9s, yeux per\xE7ants, musculatures travaill\xE9es, port martial.\n\nRAPPORT \xC0 LA MAGIE :\nM\xE9pris\xE9e comme voie sans m\xE9rite \u2014 pas de lign\xE9e, pas de cicatrices. Certains la pratiquent : rare et regard\xE9 de travers.\n\nENVERS HAUTS-ELFES :\nRivalit\xE9 ancienne. M\xE9pris mutuel \u2014 eux les voient comme des l\xE2ches cach\xE9s derri\xE8re leurs sorts.\n\nENVERS {{user}} :\n\xC9value force et m\xE9rite d\xE9montr\xE9, jamais le rang affich\xE9. Respect imm\xE9diat si comp\xE9tence prouv\xE9e. M\xE9pris pour la l\xE2chet\xE9.\n\nCAPTURES ET FRONTI\xC8RES :\nCourantes aux fronti\xE8res contest\xE9es avec Tokyo. Le royaume ne rach\xE8te pas syst\xE9matiquement ses soldates captur\xE9es \u2014 co\xFBt politique, pas abandon affectif.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nFi\xE8res / Disciplin\xE9es / Cinglantes / Protectrices\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 56,
      category: "PROFIL RACIAL",
      title: "Valkyries",
      primary_keys: [
        "valkyrie",
        "guerri\xE8re nordique",
        "Oslo",
        "fjord",
        "boucliers"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : R\xE9gions nordiques \u2014 Capitale : Oslo\n\nCULTURE :\nHonneur au combat comme unique monnaie sociale. Mourir au lit est la vraie d\xE9faite. Franchise brutale, hospitalit\xE9 de fer, d\xE9fis permanents. Les skaldes immortalisent les exploits.\n\nAPPARENCE : grandes, carrures puissantes, souvent rousses ou blondes, tresses de guerre, cicatrices port\xE9es fi\xE8rement.\n\nENVERS AUTRES RACES :\nRespect proportionnel \xE0 la valeur au combat, quelle que soit la race. M\xE9pris pour la ruse sans courage.\n\nENVERS {{user}} :\nTest quasi imm\xE9diat \u2014 bras de fer, d\xE9fi verbal, provocation. R\xE9ussir ou encaisser dignement = amiti\xE9 possible. Se d\xE9rober = m\xE9pris durable.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nFranches / Festives / Belliqueuses / Loyales\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 57,
      category: "PROFIL RACIAL",
      title: "Amazones Nordiques",
      primary_keys: [
        "amazone nordique",
        "for\xEAt du nord",
        "chasseresse",
        "clan des bois"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Grandes for\xEAts nordiques, hors des villes\n\nCULTURE :\nClans matriarcaux forestiers, cousins sauvages des Valkyries. Chasse, pistage, autosuffisance. Les hommes sont rares dans les clans \u2014 accueillis, jamais dirigeants.\n\nAPPARENCE : athl\xE9tiques, peaux tann\xE9es, tenues de cuir et fourrure minimalistes, peintures de chasse.\n\nENVERS AUTRES RACES :\nDistantes par choix. Commercent aux lisi\xE8res, n'invitent personne au c\u0153ur des for\xEAts. Respect des Valkyries, m\xE9fiance du reste.\n\nENVERS {{user}} :\nUn \xE9tranger en for\xEAt est suivi longtemps avant d'\xEAtre abord\xE9. Respect si les lieux sont respect\xE9s ; fl\xE8che d'avertissement sinon.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nSilencieuses / Territoriales / S\xFBres d'elles / Curieuses (les jeunes)\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 58,
      category: "PROFIL RACIAL",
      title: "Sultanats",
      primary_keys: [
        "sultanat",
        "marchand d'Istanbul",
        "caravanier",
        "bazar",
        "orient"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Moyen-Orient, Afrique du Nord \u2014 Capitale : Istanbul\n\nCULTURE :\nLe commerce comme art de vivre et quasi-religion. Hospitalit\xE9 fastueuse, n\xE9gociation th\xE9\xE2trale, parole donn\xE9e sacr\xE9e. Familles-maisons marchandes en comp\xE9tition courtoise.\n\nAPPARENCE : \xE9l\xE9gance de soies et bijoux, kh\xF4l, parfums \u2014 la richesse se porte.\n\nENVERS AUTRES RACES :\nTout le monde est un client potentiel. Aucun pr\xE9jug\xE9 qui co\xFBterait une vente.\n\nENVERS {{user}} :\nTh\xE9 offert, situation jaug\xE9e, opportunit\xE9s calcul\xE9es \u2014 chaleur sinc\xE8re ET int\xE9ress\xE9e, les deux \xE0 la fois sans contradiction.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nCharmeurs / Calculateurs / G\xE9n\xE9reux / Rancuniers en affaires\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 59,
      category: "PROFIL RACIAL",
      title: "Amazones Sombres",
      primary_keys: [
        "amazone sombre",
        "Lagos",
        "voiles interdits",
        "masque rituel"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Afrique subsaharienne \u2014 Capitale : Lagos\n\nCULTURE :\nMatriarcat en lign\xE9es, fiert\xE9 de fer forg\xE9e par l'ostracisme mondial depuis la Guerre des Voiles. Secrets en couches : cercles de savoir dont chacun ignore le suivant. La magie des Voiles, interdite, se transmet quand m\xEAme \u2014 de m\xE8re en fille, dans le silence.\n\nAPPARENCE : grandes, port de reines, parures de perles sombres, scarifications fines \xE9l\xE9gantes.\n\nENVERS AUTRES RACES :\nDignit\xE9 d\xE9fensive. Le monde les bl\xE2me ; elles ne s'excusent de rien. Hostilit\xE9 froide envers Tokyo.\n\nENVERS {{user}} :\nR\xE9serve test\xE9e. La confiance se m\xE9rite en ann\xE9es \u2014 ou en un seul acte de respect vrai au bon moment.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nFi\xE8res / Secr\xE8tes / Ardentes / Loyales aux leurs\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 60,
      category: "PROFIL RACIAL",
      title: "Orques Nobles",
      primary_keys: [
        "orque noble",
        "Johannesburg",
        "d\xE9fenses orn\xE9es",
        "parole de clan"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Afrique australe \u2014 Capitale : Johannesburg\n\nCULTURE :\nL'honneur du clan avant tout : une parole donn\xE9e engage des g\xE9n\xE9rations. Palabres publiques, m\xE9moire orale parfaite des dettes et des dons. Force physique mise au service du droit, jamais du caprice.\n\nAPPARENCE : massifs, peau grise \xE0 verte sombre, d\xE9fenses courtes orn\xE9es d'anneaux, regards pos\xE9s.\n\nENVERS AUTRES RACES :\nRespect par d\xE9faut, retir\xE9 d\xE9finitivement au premier mensonge grave. M\xE9prisent la fourberie des cours du nord et la brutalit\xE9 sans code des Orcs.\n\nENVERS {{user}} :\nHospitalit\xE9 totale d'abord. Un mensonge d\xE9couvert ferme le clan entier \u2014 pour toujours.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nInt\xE8gres / Solennels / Protecteurs / T\xEAtus\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 61,
      category: "PROFIL RACIAL",
      title: "Orcs",
      primary_keys: [
        "orc de Mexico",
        "scarification",
        "warchief",
        "brute",
        "ar\xE8ne"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Am\xE9rique centrale \u2014 Capitale : Mexico\n\nCULTURE :\nLa force fait le droit \u2014 litt\xE9ralement : tout se r\xE8gle en duel, tout chef est d\xE9fiable. Les scarifications racontent les victoires ; un corps sans marques n'a pas v\xE9cu. Vacarme, franchise, app\xE9tits \xE9normes.\n\nAPPARENCE : massifs, peau verte \xE0 grise, canines pro\xE9minentes, cr\xE2nes souvent ras\xE9s et scarifi\xE9s.\n\nENVERS AUTRES RACES :\nUne seule question : sais-tu te battre ? Le reste est du bruit.\n\nENVERS {{user}} :\nProvocation quasi imm\xE9diate pour jauger. La force d\xE9montr\xE9e = respect bruyant et sinc\xE8re. La faiblesse = proie ou domestique.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nBrutaux / Directs / Joueurs / Fid\xE8les au plus fort\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 62,
      category: "PROFIL RACIAL",
      title: "Hommes-B\xEAtes",
      primary_keys: [
        "homme-b\xEAte",
        "femme-b\xEAte",
        "oreilles animales",
        "queue",
        "f\xE9lin",
        "canin",
        "meute"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Am\xE9rique du Nord \u2014 Capitale : New York\n\nCULTURE :\nMeutes territoriales aux fronti\xE8res senties, pas cartographi\xE9es. L'instinct est sacr\xE9 : le faire taire est le seul blasph\xE8me. Hi\xE9rarchies souples mais r\xE9elles \u2014 l'Alpha se reconna\xEEt, ne se proclame pas.\n\nAPPARENCE : humano\xEFdes aux traits animaux marqu\xE9s \u2014 oreilles, queues, pelages partiels, yeux fendus. Lign\xE9es f\xE9lines, canines, aviaires, ursines...\n\nCAPACIT\xC9S : sens surd\xE9velopp\xE9s \u2014 la peur SE SENT, le mensonge SE FLAIRE.\n\nENVERS AUTRES RACES :\nLecture instinctive avant tout jugement. M\xE9fiance envers qui sent la peur ou le mensonge.\n\nENVERS {{user}} :\nRenifl\xE9, jaug\xE9, class\xE9 en secondes. La confiance est physique avant d'\xEAtre verbale \u2014 une posture d\xE9tendue vaut mille serments.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nInstinctifs / Territoriaux / Joueurs / Francs\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 63,
      category: "PROFIL RACIAL",
      title: "Tribus Primales",
      primary_keys: [
        "tribu primale",
        "chamane",
        "esprit",
        "Bogot\xE1",
        "transe",
        "talisman"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Am\xE9rique du Sud \u2014 Capitale : Bogot\xE1\n\nCULTURE :\nLe monde est habit\xE9 : chaque lieu, b\xEAte et anc\xEAtre a son esprit. Les chamanes consultent en transe ; les pr\xE9sages pr\xE9c\xE8dent les d\xE9cisions ; les offenses aux esprits exigent r\xE9paration rituelle.\n\nAPPARENCE : peaux cuivr\xE9es, peintures rituelles, parures de plumes, d'os et de graines.\n\nENVERS AUTRES RACES :\nJug\xE9es \xE0 leur respect des lieux et des morts. Les pilleurs de terre sont des malades \xE0 \xE9viter.\n\nENVERS {{user}} :\nQuestions \xE9tranges qui ne le sont jamais, hospitalit\xE9 conditionn\xE9e au respect. Offenser un esprit devant eux = expulsion imm\xE9diate.\n\nFAIT ACTUEL : les esprits se taisent pr\xE8s des Zones Corrompues \u2014 les chamanes sentent le R\xE9veil des Voiles avant tout le monde.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nCalmes / Mystiques / Observateurs / Inflexibles sur le sacr\xE9\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 64,
      category: "PROFIL RACIAL",
      title: "Sir\xE8nes",
      primary_keys: [
        "sir\xE8ne",
        "chant",
        "\xE9cailles",
        "Sydney",
        "mar\xE9e",
        "oc\xE9an"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Pacifique Sud \u2014 Capitale : Sydney\n\nCULTURE :\nThalassocratie du chant : le pouvoir se chante, la s\xE9duction est un art civique, la mer est m\xE8re et loi. Sens du spectacle inn\xE9.\n\nAPPARENCE : peaux nacr\xE9es, cheveux aux teintes marines, \xE9cailles d\xE9coratives aux tempes et aux flancs, formes amphibies \u2014 jambes \xE0 terre, nage surhumaine en mer.\n\nCAPACIT\xC9S : le chant sir\xE8ne apaise, s\xE9duit ou trouble \u2014 manipulation l\xE9gitime chez elles, scandale ailleurs. Jamais un contr\xF4le mental absolu.\n\nENVERS AUTRES RACES :\nCuriosit\xE9 amus\xE9e pour les terrestres. Solidarit\xE9 maritime avec Auckland.\n\nENVERS {{user}} :\nS\xE9duction ambiante par d\xE9faut \u2014 un jeu, pas toujours une offre. Sur terre ferme, prudence accrue : leur \xE9l\xE9ment leur manque.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nS\xE9ductrices / Joueuses / Fi\xE8res / Insaisissables\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 65,
      category: "PROFIL RACIAL",
      title: "Naga Marines",
      primary_keys: [
        "naga",
        "serpent marin",
        "abysses",
        "Auckland",
        "\xE9cailles noires",
        "mill\xE9naire"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Profondeurs du Pacifique \u2014 Capitale : Auckland\n\nCULTURE :\nLe peuple le plus ancien et le plus lent. La m\xE9moire est leur culte : leurs Archivistes se souviennent des cinq \xC8res. Chaque mot est pes\xE9 ; l'impatience des autres races les amuse.\n\nAPPARENCE : buste humano\xEFde sur corps serpentin, \xE9cailles sombres iris\xE9es, yeux d'or fendus, tailles imposantes.\n\nENVERS AUTRES RACES :\nPiti\xE9 patiente d'adultes envers des enfants amn\xE9siques. Aucune hostilit\xE9 \u2014 aucun empressement non plus.\n\nENVERS {{user}} :\nChaque question re\xE7oit une \xE9nigme ou une autre question. Un Naga qui r\xE9pond directement accorde un honneur rare.\n\nFAIT MAJEUR : ils savent des choses de l'\xC8re 2 \u2014 la vraie histoire des Voiles \u2014 que nul ne leur a encore correctement demand\xE9es.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nLents / Sages / \xC9nigmatiques / Inflexibles\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 66,
      category: "PROFIL RACIAL",
      title: "Nains",
      primary_keys: [
        "nain",
        "naine",
        "barbe tress\xE9e",
        "forge",
        "Zurich",
        "montagne",
        "registre"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Grandes cha\xEEnes de montagnes \u2014 Capitale : Zurich\n\nCULTURE :\nLa forge est pri\xE8re, le registre est v\xE9rit\xE9, la parole \xE9crite est \xE9ternelle. Clans de forge en comp\xE9tition d'excellence. M\xE9moire transg\xE9n\xE9rationnelle des dettes \u2014 trois g\xE9n\xE9rations minimum.\n\nAPPARENCE : trapus, puissants, barbes tress\xE9es orn\xE9es (hommes ET femmes portent des tresses rituelles), mains de forgerons.\n\nENVERS AUTRES RACES :\nM\xE9fiance initiale universelle, respect gagn\xE9 lentement et d\xE9finitivement. Insulter la qualit\xE9 d'un travail nain est l'offense supr\xEAme.\n\nENVERS {{user}} :\nContrat \xE9crit pour tout, m\xEAme un service d'ami. La confiance naine, une fois forg\xE9e, ne rouille jamais.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nRigoureux / Rancuniers / Fiables / Fiers de leur art\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 67,
      category: "PROFIL RACIAL",
      title: "G\xE9antes",
      primary_keys: [
        "g\xE9ante",
        "colosse",
        "Katmandou",
        "sommet",
        "montagne sacr\xE9e"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TERRITOIRE : Plus hauts sommets du monde \u2014 Point d'ancrage : Katmandou\n\nCULTURE :\nContemplation des cimes, m\xE9ditations de d\xE9cennies, paroles rares grav\xE9es dans la pierre. La patience est leur culte. Quelques centaines d'individus au monde, toutes connues de nom entre elles.\n\nAPPARENCE : trois \xE0 cinq m\xE8tres, traits sereins, drap\xE9es de laines tiss\xE9es \xE0 leur taille, d\xE9marches qui font trembler les sentiers.\n\nENVERS AUTRES RACES :\nBienveillance lointaine de montagnes envers des fourmis press\xE9es. Protection tacite des villages sherpas.\n\nENVERS {{user}} :\n\xCAtre remarqu\xE9 par une G\xE9ante est un \xE9v\xE9nement d'une vie. Chacun de ses mots p\xE8se une d\xE9cennie de r\xE9flexion \u2014 les ignorer serait fou.\n\nMODIFICATEURS CULTURELS FR\xC9QUENTS :\nSereines / Laconiques / Imp\xE9n\xE9trables / D\xE9cisives (rarissime et terrible)\n\nR\xC8GLE :\nCe profil est un point de d\xE9part. Les modificateurs individuels priment toujours.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 68,
      category: "PROFIL",
      title: "Sang-M\xEAl\xE9",
      primary_keys: [
        "sang-m\xEAl\xE9",
        "m\xE9tisse",
        "hybride",
        "demi-elfe",
        "demi-orc",
        "b\xE2tarde raciale"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "ORIGINE :\nIssus d'unions inter-raciales. Marginalis\xE9s depuis la R\xE9bellion de l'\xC8re 4 \u2014 leur magie hybride instable a fractur\xE9 l'empire elfe, et le monde ne l'a pas oubli\xE9.\n\nSTATUT :\nRejet\xE9s \xE0 des degr\xE9s divers par toutes les soci\xE9t\xE9s (voir Sang-M\xEAl\xE9 \u2014 Rapports Raciaux). Organis\xE9s en r\xE9seaux clandestins d'entraide : caches, passeurs, signes de reconnaissance.\n\nAPPARENCE : traits m\xEAl\xE9s des deux lign\xE9es \u2014 souvent d'une beaut\xE9 singuli\xE8re que les soci\xE9t\xE9s refusent d'admettre.\n\nCAPACIT\xC9S :\nMagie hybride instable mais puissante \u2014 interdite par l'Ordre des Mages, ce qui pousse les dou\xE9s vers la clandestinit\xE9 ou la Guilde des Ombres.\n\nPSYCHOLOGIE FR\xC9QUENTE :\nIdentit\xE9 en tension, loyaut\xE9s complexes, m\xE9fiance apprise \u2014 et des individualit\xE9s forg\xE9es plus dures que la moyenne.\n\nENVERS {{user}} :\nPrudence par d\xE9faut. Un traitement d'\xE9gal \xE0 \xE9gal, sans curiosit\xE9 malsaine pour leurs origines, gagne une loyaut\xE9 rare.\n\nR\xC8GLE :\nChaque Sang-M\xEAl\xE9 combine les profils de ses deux lign\xE9es + ce statut \u2014 voir Rapports Raciaux pour l'accueil par soci\xE9t\xE9.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CHARACTER"
    },
    {
      id: 69,
      category: "MONDE",
      title: "Sang-M\xEAl\xE9 \u2014 Rapports Raciaux",
      primary_keys: [
        "sang-m\xEAl\xE9 rejet\xE9",
        "accueil des m\xE9tisses",
        "hybride tol\xE9r\xE9",
        "discrimination sang-m\xEAl\xE9"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "ACCUEIL PAR SOCI\xC9T\xC9 (du pire au meilleur) :\n\nTOKYO \u2192 haine active : souillure de la puret\xE9 elfique. Emprisonnement ou pire si d\xE9couverts.\nDELHI \u2192 m\xE9pris froid : ni lign\xE9e, ni lame h\xE9rit\xE9e = pas d'existence sociale. Tol\xE9r\xE9s comme mercenaires jetables.\nZURICH \u2192 exclusion polie des registres : sans clan, pas de cr\xE9dit, pas de contrat notari\xE9.\nPARIS \u2192 discrimination ordinaire : quartiers pauvres, m\xE9tiers refus\xE9s, boucs \xE9missaires commodes.\nISTANBUL \u2192 pragmatisme : un client est un client, un talent est un talent \u2014 mais jamais d'entr\xE9e dans les maisons marchandes.\nOSLO / MEXICO \u2192 la force efface tout : un Sang-M\xEAl\xE9 qui prouve sa valeur au combat est jug\xE9 sur elle.\nNEW YORK \u2192 l'instinct ne ment pas : jug\xE9s \xE0 l'odeur de leur caract\xE8re, pas \xE0 leur sang. Refuge relatif.\nLAGOS \u2192 solidarit\xE9 de parias : les Amazones Sombres connaissent l'ostracisme. Accueil prudent mais r\xE9el.\nJOHANNESBURG / BOGOT\xC1 \u2192 les esprits et les anc\xEAtres ne trient pas les sangs : jug\xE9s \xE0 leurs actes. Meilleurs refuges du monde.\nSYDNEY / AUCKLAND \u2192 indiff\xE9rence des mers : les affaires terrestres de sang les concernent peu.\nKATMANDOU \u2192 une G\xE9ante a dit un jour : \xAB La pierre ne demande pas d'o\xF9 vient la rivi\xE8re. \xBB Grav\xE9. Sanctuaire absolu \u2014 pour qui survit \xE0 la mont\xE9e.\n\nR\xC8GLE :\nL'accueil d'un PNJ envers un Sang-M\xEAl\xE9 suit sa soci\xE9t\xE9 d'origine, modul\xE9 par son individualit\xE9.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 70,
      category: "GABARIT",
      title: "Noms par Race",
      primary_keys: [
        "se nomme",
        "s'appelle",
        "pr\xE9nom",
        "nomm\xE9e",
        "son nom est"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nTout PNJ improvis\xE9 re\xE7oit un nom dans la sonorit\xE9 de sa race \u2014 jamais un nom g\xE9n\xE9rique interchangeable.\n\nSONORIT\xC9S PAR RACE (styles, pas listes ferm\xE9es) :\nHumains \u2192 pr\xE9noms europ\xE9ens classiques (Camille, Henri, Margaux, Bastien)\nHauts-Elfes \u2192 fluides, voyelles longues, finales -a/-el/-iel (Aelindra, Sachiel, Yumiel)\nElfes Noirs \u2192 consonnes fermes, finales -a/-i/-ani (Priya, Kavita, Ranjani, Ashira)\nValkyries / Am. Nordiques \u2192 courtes, dures (Sigrid, Astrid, Freya, Brynja)\nSultanats \u2192 arabo-persanes (Leyla, Emre, Nazli, Karim, Selin)\nAmazones Sombres \u2192 chantantes ouest-africaines (Zola, Adaeze, Chidinma, Folake)\nOrques Nobles \u2192 graves bantoues (Themba, Nomvula, Palesa, Sipho)\nOrcs \u2192 percutantes nahuatl (Xochitl, Itzel, Tloc, Citlali)\nHommes-B\xEAtes \u2192 anglophones + surnoms animaux (Raven, Sable, Marcus Nightpaw)\nTribus Primales \u2192 andines (Amaru, Quilla, Inti, Chaska)\nSir\xE8nes \u2192 liquides (Marina, Nerida, Talise, Coral)\nNaga \u2192 sifflantes doubles (Ssythar, Vashti, Ixora, Nerezza)\nNains \u2192 germaniques rudes (Greta, Bjorn, Brunhild, Ursula)\nG\xE9antes \u2192 amples tib\xE9taines (Tenzin, Dolma, Pemba, Yangchen)\nSang-M\xEAl\xE9 \u2192 pr\xE9nom d'une lign\xE9e + usage de l'autre, ou nom choisi de rupture\n\nNOMS DE FAMILLE :\nCompos\xE9s \xE9vocateurs par culture (Duskblade, Ironvow, Stormaxe, Pearltide) \u2014 les lign\xE9es existantes du lorebook servent de r\xE9f\xE9rence.\n\nR\xC8GLE :\nUn nom attribu\xE9 entre en continuit\xE9 \u2014 d\xE9finitif.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 71,
      category: "GABARIT",
      title: "Variations Physiques par Race",
      primary_keys: [
        "apparence de la",
        "silhouette",
        "traits du visage",
        "d\xE9crire physiquement",
        "\xE0 quoi elle ressemble"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nLe profil racial donne la base ; ce gabarit donne les axes de VARIATION pour individualiser chaque PNJ. Toujours combiner 2-3 traits distinctifs m\xE9morables.\n\nAXES UNIVERSELS :\nCarrure (menue / athl\xE9tique / puissante / massive), taille dans la norme raciale, \xE2ge apparent (via ratio), port (altier / souple / martial / vo\xFBt\xE9), voix (grave / claire / rauque / chantante).\n\nMARQUES DISTINCTIVES PAR CULTURE :\nHumains \u2192 cicatrices de vie, mains de m\xE9tier\nHauts-Elfes \u2192 perfection entretenue, UN d\xE9tail \xE9tudi\xE9 (m\xE8che, bijou de caste)\nElfes Noirs \u2192 cicatrices de combat assum\xE9es, tresses de lign\xE9e, cals d'armes\nNordiques \u2192 tatouages runiques, perles de guerre dans les tresses, oreille ou nez marqu\xE9s\nSultanats \u2192 kh\xF4l, bagues par affaire conclue, parfums signatures\nAmazones Sombres \u2192 scarifications fines \xE9l\xE9gantes, perles sombres\nOrques Nobles \u2192 anneaux de bronze aux d\xE9fenses (par serment tenu)\nOrcs \u2192 scarifications de victoires, dents lim\xE9es, cr\xEAtes\nHommes-B\xEAtes \u2192 pelage (uni/tachet\xE9/ray\xE9), oreilles expressives, queue r\xE9v\xE9latrice d'humeur\nTribus Primales \u2192 peintures selon l'occasion, talismans port\xE9s\nSir\xE8nes \u2192 nuances de nacre, \xE9cailles d\xE9coratives aux tempes\nNains \u2192 style de tresse de barbe (clan), br\xFBlures de forge honorables\nSang-M\xEAl\xE9 \u2192 asym\xE9tries fascinantes des deux lign\xE9es\n\nCANON D'ELYNDOR : voir Canon Physique F\xE9minin pour les constantes du monde.\n\nR\xC8GLE :\nDeux PNJ de m\xEAme race ne partagent jamais les m\xEAmes traits distinctifs dans une m\xEAme sc\xE8ne.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 72,
      category: "GABARIT",
      title: "Unit\xE9s Militaires par Capitale",
      primary_keys: [
        "r\xE9giment",
        "unit\xE9 d'\xE9lite",
        "soldats de",
        "arm\xE9e de",
        "corps militaire",
        "\xE9claireuse"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "UNIT\xC9S NOMM\xC9ES (\xE9lite / sp\xE9cialit\xE9 / guet) :\nParis \u2192 Garde Royale (palais), Chevaliers de l'Aube (\xE9lite mont\xE9e), Guet de la Seine\nTokyo \u2192 Lames de Jade (guet), Mages de Guerre Imp\xE9riaux (\xE9lite), Sentinelles des Castes\nDelhi \u2192 Garde d'Obsidienne (\xE9lite urbaine), Lames de Fronti\xE8re (\xE9claireuses), Sentinelles (guet)\nOslo \u2192 Boucliers du Fjord (\xE9lite navale), Filles du Gel (infanterie), Guet des Halls\nIstanbul \u2192 Janissaires du Sultan (\xE9lite), Gardes des Caravanes, Guet du Bazar\nLagos \u2192 Lames Voil\xE9es (\xE9lite discr\xE8te), Gardiennes des Lagunes, Guet des Masques\nJohannesburg \u2192 Poings du Serment (\xE9lite), Gardiens des Kraals, Guet des Palabres\nMexico \u2192 Crocs de Guerre (\xE9lite), Sang d'Ar\xE8ne (v\xE9t\xE9rans gladiateurs), Guet des Clans\nNew York \u2192 Griffes de l'Alpha (\xE9lite), Traqueurs (pisteurs), Guet des Meutes\nBogot\xE1 \u2192 Gardiens des Esprits (\xE9lite rituelle), \xC9claireurs de Jungle, Guet des Terrasses\nSydney \u2192 Voix des Profondeurs (\xE9lite chanteuse), Garde des Mar\xE9es, Guet du Port\nAuckland \u2192 Anneaux de l'Abysse (\xE9lite naga, rarissime en surface)\nZurich \u2192 Marteaux du Serment (\xE9lite), Gardes des Coffres, Guet des Halls\nKatmandou \u2192 aucune arm\xE9e \u2014 et nul n'a jamais test\xE9 pourquoi\n\nR\xC8GLE :\nUne soldate improvis\xE9e appartient \xE0 une unit\xE9 list\xE9e \u2014 son unit\xE9 d\xE9finit sa sp\xE9cialit\xE9 et sa fiert\xE9.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 73,
      category: "GABARIT",
      title: "Hi\xE9rarchies Militaires",
      primary_keys: [
        "grade",
        "officier",
        "capitaine",
        "commandant",
        "sergent",
        "hi\xE9rarchie militaire",
        "promotion militaire"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "\xC9CHELLE COMMUNE (noms locaux variables) :\nRecrue \u2192 1re ann\xE9e, t\xE2ches ingrates\nSoldat/Garde \u2192 le gros des effectifs\nV\xE9t\xE9ran \u2192 5+ ans, respect des jeunes\nSergent \u2192 commande 5-10, gueule et exp\xE9rience\nLieutenant \u2192 commande 30-50, premiers galons d'officier\nCapitaine \u2192 commande une compagnie (100-200) ou une unit\xE9 d'\xE9lite\nCommandant \u2192 une place forte, un r\xE9giment\nG\xE9n\xE9ral / Mar\xE9chale \u2192 l'arm\xE9e enti\xE8re, si\xE8ge au conseil du souverain\n\nSP\xC9CIFICIT\xC9S CULTURELLES :\nDelhi \u2192 promotion au m\xE9rite pur, examens de duel publics ; une capitaine de 30 ans est cr\xE9dible\nOslo \u2192 les exploits chant\xE9s comptent autant que l'anciennet\xE9\nMexico \u2192 tout grade est d\xE9fiable en duel\nTokyo \u2192 caste ET comp\xE9tence \u2014 un non-noble plafonne \xE0 sergent\nJohannesburg \u2192 le conseil des Anciens valide chaque officier\n\nREP\xC8RES DE JEU :\nUne capitaine captur\xE9e vaut ran\xE7on ou prix d'esclave \xE9lev\xE9. Un sergent conna\xEEt son quartier par c\u0153ur. Un g\xE9n\xE9ral ne se d\xE9place jamais sans escorte ni raison d'\xC9tat.\n\nR\xC8GLE :\nLe grade annonc\xE9 d'un PNJ fixe son autorit\xE9, sa solde (voir Salaires) et ses r\xE9flexes.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 74,
      category: "GABARIT",
      title: "R\xE9actions \xE0 la Douleur",
      primary_keys: [
        "hurle de douleur",
        "serre les dents",
        "encaisse le coup",
        "grimace",
        "g\xE9mit de douleur",
        "souffre"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nLa douleur r\xE9v\xE8le le personnage. R\xE9action = Arch\xE9type + culture + fiert\xE9.\n\nPAR ARCH\xC9TYPE :\nGuerrier \u2192 serre les dents, jure, continue ; ne crie qu'au palier Critique\nGarde/Soldat \u2192 encaisse en silence disciplin\xE9, appelle le protocole\nBandit \u2192 hurle des insultes, cherche la fuite ou la tra\xEEtrise\nMarchand \u2192 crie fort, n\xE9gocie imm\xE9diatement (\xAB Je paie ! Arr\xEAtez ! \xBB)\nNoble \u2192 entre d\xE9ni digne et panique scandalis\xE9e (\xAB Vous osez ?! \xBB)\n\xC9rudit \u2192 analyse sa propre blessure \xE0 voix haute, entre fascination et terreur\nServiteur \u2192 \xE9touffe ses cris par r\xE9flexe, s'excuse presque\nPr\xEAtre \u2192 pri\xE8re, offre sa douleur, ou fanatisme d\xE9cupl\xE9\n\nMODULATION CULTURELLE :\nDelhi/Oslo/Mexico \u2192 montrer sa douleur est une honte ; la m\xE2choire serr\xE9e est un point d'honneur\nTokyo \u2192 perdre la contenance est pire que la blessure\nIstanbul \u2192 th\xE9\xE2tralise pour n\xE9gocier\nEsclaves de longue date \u2192 silence appris, r\xE9flexe de se faire petite\n\nR\xC8GLE :\nUne r\xE9action \xE0 la douleur coh\xE9rente vaut mieux qu'un cri g\xE9n\xE9rique \u2014 c'est un outil de caract\xE9risation gratuit.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 75,
      category: "GABARIT",
      title: "Affluence par Lieu et Moment",
      primary_keys: [
        "il y a du monde",
        "combien de clients",
        "la salle est",
        "foule",
        "bond\xE9",
        "d\xE9sert \xE0 cette heure"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TAVERNE :\nMatin \u2192 2-5 clients (habitu\xE9s, voyageurs au d\xE9part)\nMidi \u2192 10-20 (repas ouvrier)\nSoir \u2192 25-50, bruyant, tables rares\nNuit tardive \u2192 5-10 (noctambules, affaires louches)\n\nMARCH\xC9 :\nAube \u2192 marchands qui installent, bonnes affaires de gros\nMatin\xE9e \u2192 foule dense, pickpockets actifs\nApr\xE8s-midi \u2192 flux mod\xE9r\xE9\nCr\xE9puscule \u2192 remballage, invendus n\xE9gociables -30%\n\nGUILDE DES AVENTURIERS :\nMatin \u2192 cohue au tableau des missions (les bonnes partent vite)\nJourn\xE9e \u2192 flux constant\nSoir \u2192 retours de mission, r\xE9cits, recrutements informels\n\nBAINS PUBLICS : apr\xE8s-midi et soir\xE9e pleins, matin\xE9e tranquille\nTEMPLE : offices aux aubes et cr\xE9puscules, calme entre\nPORTE ASTRA : files le matin (marchands), fluide ensuite, ferm\xE9e la nuit sauf urgence pay\xE9e\n\nMODIFICATEURS : jour de f\xEAte \xD72 partout ; pluie \u2192 tavernes +50%, march\xE9s -50% ; rumeur de danger \u2192 tout se vide sauf les tavernes.\n\nR\xC8GLE :\nAnnoncer l'affluence en une phrase d'ambiance situe la sc\xE8ne et ses possibilit\xE9s (discr\xE9tion impossible dans la cohue, t\xE9moins absents la nuit).",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 76,
      category: "GABARIT",
      title: "C\xE9r\xE9monies Officielles",
      primary_keys: [
        "c\xE9r\xE9monie",
        "couronnement",
        "mariage noble",
        "ex\xE9cution publique",
        "rite officiel",
        "c\xE9l\xE9bration officielle"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "TRAMES TYPES PAR \xC9V\xC9NEMENT :\n\nMARIAGE (noble/notable) :\nProcession publique \u2192 rite religieux local \u2192 banquet ouvert selon rang \u2192 dons enregistr\xE9s. Delhi : \xE9change de lames de lign\xE9e. Zurich : contrat lu INT\xC9GRALEMENT. Oslo : d\xE9fi amical entre familles. Istanbul : n\xE9gociation th\xE9\xE2trale de la dot, d\xE9j\xE0 conclue en priv\xE9.\n\nFUN\xC9RAILLES :\nParis \u2192 messe de la Lumi\xE8re, cort\xE8ge. Delhi \u2192 la lame h\xE9rit\xE9e passe \xE0 l'h\xE9riti\xE8re devant t\xE9moins. Oslo \u2192 barque ou b\xFBcher, skalde qui chante. Bogot\xE1 \u2192 trois jours de veille des esprits. Mexico \u2192 r\xE9cit criard des victoires du mort.\n\nEX\xC9CUTION PUBLIQUE :\nLecture de sentence \u2192 dernier mot du condamn\xE9 (tradition quasi universelle) \u2192 ex\xE9cution selon culture (hache \xE0 Paris, duel sans espoir \xE0 Mexico, exil en montagne \xE0 Katmandou \u2014 nul ne revient). Foule nombreuse, pickpockets ravis.\n\nCOURONNEMENT / INVESTITURE :\nSerments crois\xE9s (souverain \u2194 institutions), rite religieux, largesses au peuple, amnisties partielles \u2014 moment d'opportunit\xE9s.\n\nR\xC8GLE :\nToute c\xE9r\xE9monie = protocole PLUS tension cach\xE9e (h\xE9ritages, rivaux pr\xE9sents, s\xE9curit\xE9) \u2014 jamais un simple d\xE9cor.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 77,
      category: "CULTURE",
      title: "Vie Civile des Races",
      primary_keys: [
        "artisan de",
        "boutique tenue par",
        "civil",
        "quotidien du peuple",
        "petites gens",
        "commer\xE7ante locale"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nChaque race a ses civils \u2014 l'\xE9crasante majorit\xE9. Un PNJ lambda n'est PAS un guerrier.\n\nCE QUE FONT LES CIVILS :\nHumains \u2192 toute la gamme europ\xE9enne : boulangers, tisserands, bateliers, clercs\nHauts-Elfes \u2192 artisans d'art, calligraphes, jardiniers rituels, enchanteurs de caste\nElfes Noirs \u2192 forgerons civils, \xE9leveurs de chevaux de guerre, ma\xEEtres d'armes retrait\xE9s \u2014 m\xEAme les civils s'entra\xEEnent par tradition\nValkyries \u2192 charpenti\xE8res navales, brasseuses, tanneuses\nSultanats \u2192 n\xE9goce \xE0 tous \xE9tages, teinturiers, parfumeurs, caravaniers\nAmazones Sombres \u2192 herboristes, tisseuses de perles, guides\nOrques Nobles \u2192 \xE9leveurs, bronziers, arbitres de palabre\nOrcs \u2192 dresseurs de b\xEAtes, bouchers, organisateurs d'ar\xE8ne\nHommes-B\xEAtes \u2192 messagers, pisteurs civils, artisans du cuir\nTribus Primales \u2192 cultivateurs en terrasses, herboristes, tailleurs de talismans\nSir\xE8nes \u2192 p\xEAcheuses, perli\xE8res, chanteuses d'auberge\nNains \u2192 mineurs, joailliers, banquiers, brasseurs\nSang-M\xEAl\xE9 \u2192 m\xE9tiers de l'ombre ou d'ind\xE9pendance : colporteurs, r\xE9parateurs, passeurs\n\nR\xC8GLE :\nUne sc\xE8ne de rue montre d'abord des civils \xE0 leur m\xE9tier \u2014 les guerriers sont l'exception qui se remarque.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 78,
      category: "CULTURE",
      title: "Rites de Passage",
      primary_keys: [
        "rite de passage",
        "majorit\xE9",
        "devenir adulte",
        "initiation",
        "\xE9preuve initiatique",
        "premi\xE8re chasse"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PASSAGE \xC0 L'\xC2GE ADULTE PAR CULTURE :\nHumains \u2192 apprentissage achev\xE9 ou premier salaire ; nobles : pr\xE9sentation \xE0 la cour\nHauts-Elfes \u2192 \xC9veil magique test\xE9 (vers 50 ans) \u2014 le r\xE9sultat fixe la caste \xE0 vie\nElfes Noirs \u2192 l'\xC9preuve de la Lame (vers 60 ans) : duel public contre une a\xEEn\xE9e ; gagner n'est pas requis, tenir avec honneur l'est. Re\xE7oit alors sa premi\xE8re lame \u2014 ou h\xE9rite de celle d'une a\xEFeule\nValkyries \u2192 premi\xE8re bataille ou chasse \xE0 l'ours en solitaire\nAmazones Nordiques \u2192 une saison seule en for\xEAt profonde\nSultanats \u2192 premi\xE8re affaire conclue seul, b\xE9nie au temple\nAmazones Sombres \u2192 cercle de nuit o\xF9 les m\xE8res transmettent le premier secret\nOrques Nobles \u2192 premier serment public engageant le clan\nOrcs \u2192 premi\xE8re scarification gagn\xE9e en duel\nHommes-B\xEAtes \u2192 la Premi\xE8re Piste : traquer seul jusqu'au bout\nTribus Primales \u2192 voyage en transe guid\xE9 ; l'esprit rencontr\xE9 devient tuteur\nSir\xE8nes \u2192 premier Grand Chant tenu sans faiblir\nNains \u2192 premi\xE8re \u0153uvre jug\xE9e par le clan \u2014 elle entre au registre\nG\xE9antes \u2192 premier mot grav\xE9 dans la pierre (parfois \xE0 200 ans)\n\nR\xC8GLE :\nUn adulte se d\xE9finit par son rite accompli \u2014 un PNJ peut s'en vanter, le regretter, ou l'avoir rat\xE9 (stigmate jouable).",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 79,
      category: "CULTURE",
      title: "Famille et Transmission",
      primary_keys: [
        "famille de",
        "mariage",
        "h\xE9ritage",
        "lign\xE9e",
        "\xE9pouse",
        "mari",
        "enfants de",
        "fian\xE7ailles",
        "dot"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "STRUCTURES FAMILIALES :\nHumains \u2192 famille nucl\xE9aire, nom du p\xE8re, h\xE9ritage \xE0 l'a\xEEn\xE9 (contest\xE9 partout)\nHauts-Elfes \u2192 lign\xE9es de caste, mariages arrang\xE9s sur compatibilit\xE9 magique, enfants rares et pr\xE9cieux\nElfes Noirs \u2192 lign\xE9es MATERNELLES, le nom et la lame passent de m\xE8re en fille ; les mariages n'effacent pas la lign\xE9e\nValkyries \u2192 unions libres, les enfants appartiennent au hall commun\nSultanats \u2192 maisons marchandes \xE9tendues, mariages = alliances commerciales, dots n\xE9goci\xE9es en public (th\xE9\xE2tre) et en priv\xE9 (r\xE9el)\nAmazones Sombres \u2192 matriarcat strict, p\xE8res de passage, filles gard\xE9es, fils confi\xE9s aux lisi\xE8res\nOrques Nobles \u2192 clans exogames, adoption fr\xE9quente et totale \u2014 le sang compte moins que le serment\nOrcs \u2192 le plus fort du foyer commande, les enfants se battent t\xF4t\nHommes-B\xEAtes \u2192 meutes-familles \xE9largies, les petits \xE9lev\xE9s en commun\nTribus Primales \u2192 la communaut\xE9 enti\xE8re \xE9l\xE8ve ; les anc\xEAtres restent \xAB pr\xE9sents \xBB\nSir\xE8nes \u2192 lign\xE9es maternelles, p\xE8res souvent d'autres races (rarement inform\xE9s)\nNains \u2192 clans patriarcaux, registres g\xE9n\xE9alogiques sur dix g\xE9n\xE9rations, mariages inter-clans = trait\xE9s\nSang-M\xEAl\xE9 \u2192 familles choisies, r\xE9seaux d'entraide en guise de parent\xE9\n\nR\xC8GLE :\nH\xE9ritage, deuil et mariage d'un PNJ suivent SA structure \u2014 jamais le mod\xE8le humain par d\xE9faut.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 80,
      category: "CULTURE",
      title: "Spiritualit\xE9 Quotidienne",
      primary_keys: [
        "prie",
        "superstition",
        "porte-bonheur",
        "geste rituel",
        "b\xE9n\xE9diction",
        "jure par",
        "croyance populaire"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nLa religion officielle est dans les fiches Royaumes ; ici, ce que les gens FONT au quotidien.\n\nGESTES ET SUPERSTITIONS COURANTS :\nParis \u2192 signe de la Lumi\xE8re avant un risque ; on ne jure pas pr\xE8s d'une cath\xE9drale\nTokyo \u2192 offrande d'encens aux anc\xEAtres chaque aube ; toucher un non-elfe avant un rite porte malheur\nDelhi \u2192 on touche sa lame avant de mentir... donc on ne ment pas ; jurer \xAB sur la lame de ma m\xE8re \xBB est le serment absolu\nOslo \u2192 verser la premi\xE8re gorg\xE9e au sol pour les morts ; nommer un mort en mer l'appelle\nIstanbul \u2192 premi\xE8re pi\xE8ce de la journ\xE9e mordue et b\xE9nie ; refuser le th\xE9 porte malheur aux DEUX parties\nLagos \u2192 masques suspendus aux portes contre les regards ; on ne siffle pas la nuit\nJohannesburg \u2192 saluer les pierres lev\xE9es en entrant sur un territoire de clan\nMexico \u2192 cracher sur son poing avant un duel ; le sang vers\xE9 \xE0 terre appartient aux dieux\nNew York \u2192 suivre son instinct du matin fixe la journ\xE9e ; r\xE9veiller quelqu'un brutalement vole un morceau de son esprit\nBogot\xE1 \u2192 demander pardon \xE0 l'arbre avant de couper ; nourrir les esprits aux carrefours\nZurich \u2192 frapper l'enclume avant l'ouvrage ; une dette oubli\xE9e attire la rouille\nPartout \u2192 les Zones Corrompues ne se nomment pas apr\xE8s le cr\xE9puscule\n\nR\xC8GLE :\nUn geste superstitieux gliss\xE9 dans une sc\xE8ne vaut mille expos\xE9s religieux.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "CONTINENT"
    },
    {
      id: 81,
      category: "MONDE",
      title: "Zones Corrompues",
      primary_keys: [
        "zone corrompue",
        "corruption",
        "terre morte",
        "cr\xE9ature des voiles",
        "contamin\xE9",
        "fissure dimensionnelle"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "ORIGINE :\nCicatrices de la Guerre des Voiles \u2014 l\xE0 o\xF9 les fissures dimensionnelles se sont ouvertes, la terre n'a jamais gu\xE9ri.\n\nGRADATION :\nBORDURE \u2192 v\xE9g\xE9tation malade, gibier rare, magie qui picote. Traversable avec prudence.\nZONE PROFONDE \u2192 couleurs fausses, silence anormal, cr\xE9atures des Voiles territoriales, magie instable (sorts amplifi\xE9s OU retourn\xE9s).\nC\u0152UR \u2192 r\xE9alit\xE9 alt\xE9r\xE9e, entit\xE9s anciennes, aucune carte fiable. Les exp\xE9ditions n'en reviennent pas toutes \u2014 celles qui reviennent rapportent des fortunes.\n\nLOCALISATION :\nUne dizaine de zones majeures dans le monde \u2014 les plus connues : for\xEAt noire d'Europe centrale, steppe morte au nord de Delhi, marais hurlants pr\xE8s de Lagos.\n\nCE QU'ON Y TROUVE :\nArtefacts de la Guerre, mat\xE9riaux impossibles, reliques des arm\xE9es englouties \u2014 d'o\xF9 les contrats les mieux pay\xE9s des guildes.\n\n\u26A0 R\xC9VEIL DES VOILES :\nLes zones S'\xC9TENDENT \u2014 quelques pas par saison. Les bordures d'hier sont les zones profondes de demain. Les contrats rapportent plus et tuent plus. Voir Le R\xE9veil des Voiles.\n\nR\xC8GLES :\n- La magie y est toujours risqu\xE9e\n- Une zone ne se \xAB nettoie \xBB jamais sans rupture majeure\n- Les chamanes et les Amazones Sombres y sentent des choses que les autres ignorent",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 82,
      category: "MONDE",
      title: "Bestiaire et Dangers Naturels",
      primary_keys: [
        "monstre",
        "b\xEAte sauvage",
        "pr\xE9dateur",
        "cr\xE9ature",
        "loup",
        "attaque animale",
        "danger naturel"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "DANGERS PAR R\xC9GION :\nRoutes d'Europe \u2192 loups en meute (hiver), sangliers g\xE9ants, brigands surtout\nFor\xEAts nordiques \u2192 ours des glaces, lynx g\xE9ants, \xE9lans agressifs au rut\nSteppes d'Asie \u2192 chevaux sauvages, f\xE9lins des herbes, serpents\nD\xE9serts \u2192 scorpions g\xE9ants, vip\xE8res des sables, la soif d'abord\nJungles \u2192 panth\xE8res, serpents constricteurs, insectes venimeux, fi\xE8vres\nMontagnes \u2192 avalanches, f\xE9lins des neiges, le froid tue plus que les crocs\nOc\xE9ans \u2192 requins, calmars g\xE9ants (rares), temp\xEAtes\n\nCR\xC9ATURES DES VOILES (Zones Corrompues uniquement) :\nFormes tordues d'animaux connus + entit\xE9s sans \xE9quivalent. Voir Cr\xE9atures Signatures.\n\nR\xC8GLES DE RENCONTRE :\nUn animal normal \xE9vite l'humano\xEFde \u2014 il attaque si accul\xE9, affam\xE9 ou avec petits. Les monstres \xE0 contrat sont l'exception, pas la faune de base. La nature tue par froid, faim et chute bien plus que par crocs.\n\nR\xC8GLE :\nUne rencontre animale a toujours une logique (territoire, faim, saison) \u2014 jamais un monstre al\xE9atoire pour l'action.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 83,
      category: "MONDE",
      title: "Cr\xE9atures Signatures",
      primary_keys: [
        "\xE9corcheur",
        "hurleuse",
        "morte-brume",
        "cr\xE9ature l\xE9gendaire",
        "monstre c\xE9l\xE8bre",
        "b\xEAte des voiles"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "CR\xC9ATURES DES VOILES NOMM\xC9ES (contrats d'\xE9lite) :\n\n\xC9CORCHEURS \u2192 humano\xEFdes vo\xFBt\xE9s \xE0 la peau retourn\xE9e, chassent en meutes silencieuses en bordure des zones. Rapides, l\xE2ches seuls, mortels \xE0 cinq. Troph\xE9e : leurs griffes d'os (10 or pi\xE8ce).\n\nHURLEUSES \u2192 silhouettes f\xE9minines flottantes dont le cri d\xE9soriente (illusions br\xE8ves). Zones profondes. Vuln\xE9rables au fer froid. Leur \xAB voile \xBB tiss\xE9 se vend 50 or \xE0 l'Ordre des Mages.\n\nMORTES-BRUMES \u2192 brumes semi-conscientes qui \xE9puisent la vie par contact prolong\xE9. Impr\xE9visibles, insensibles aux armes \u2014 seuls le feu et l'aube les dispersent. Signal\xE9es de plus en plus loin des zones depuis le R\xE9veil.\n\nGARDIENS DE FISSURE \u2192 colosses d'os et de pierre fondus post\xE9s aux anciennes fissures. Quasi invuln\xE9rables, immobiles \u2014 sauf si on approche de ce qu'ils gardent. Aucun troph\xE9e connu : personne n'en a tu\xE9 un.\n\nR\xC8GLES :\n- Croiser une Signature = sc\xE8ne majeure, jamais banale\n- Leurs apparitions hors zones sont un SIGNE du R\xE9veil\n- Les guildes paient des primes fixes affich\xE9es pour chacune",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 84,
      category: "MONDE",
      title: "Faune et Flore Domestiques",
      primary_keys: [
        "cheval",
        "chien",
        "chat",
        "b\xE9tail",
        "jardin",
        "fleur",
        "r\xE9colte",
        "animal de compagnie",
        "monture",
        "ferme"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "MONTURES :\nChevaux partout (Delhi \xE9l\xE8ve les meilleurs destriers) ; poneys des montagnes \xE0 Zurich et Katmandou ; chameaux aux Sultanats ; \xE9lans domestiqu\xE9s \xE0 Oslo (prestige) ; grands f\xE9lins dress\xE9s \xE0 New York (rarissime, meutes de prestige).\n\nCOMPAGNONS :\nChiens (chasse, garde, berger), chats (greniers, affection), faucons (Sultanats, noblesse), corbeaux messagers (Oslo), serpents domestiques (Bogot\xE1, contre les nuisibles).\n\nB\xC9TAIL :\nVaches, moutons, ch\xE8vres, porcs, volailles selon r\xE9gions ; yaks \xE0 Katmandou ; poissons d'\xE9levage en lagunes \xE0 Lagos et Sydney.\n\nCULTURES :\nBl\xE9 et vigne en Europe ; riz en Asie ; \xE9pices au Sud ; ma\xEFs et cacao aux Am\xE9riques ; caf\xE9 monopole des Sultanats ; th\xE9 de Tokyo (export de luxe).\n\nFLORE UTILE :\nHerbes de soin communes (voir M\xE9decine) ; fleurs de teinture ; le Lys d'Argent (pousse UNIQUEMENT en bordure de Zone Corrompue \u2014 ingr\xE9dient d'alchimie hors de prix, cueillette mortelle).\n\nR\xC8GLE :\nCes d\xE9tails ancrent les sc\xE8nes rurales et les march\xE9s \u2014 un d\xE9cor vivant vaut mille adjectifs.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 85,
      category: "MONDE",
      title: "March\xE9s aux Esclaves",
      primary_keys: [
        "march\xE9 aux esclaves",
        "vente d'esclaves",
        "ench\xE8res",
        "estrade",
        "acheter au march\xE9",
        "exposition des esclaves"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "LES GRANDS MARCH\xC9S L\xC9GAUX :\nPARIS \u2192 le plus vaste du monde. Halles d\xE9di\xE9es pr\xE8s de la Seine : estrades d'exposition, loges priv\xE9es pour les ventes de prestige, notaires sur place. Ench\xE8res publiques le samedi, ventes de gr\xE9 \xE0 gr\xE9 en semaine.\nISTANBUL \u2192 le plus raffin\xE9 en n\xE9goce : chaque vente est un th\xE9\xE2tre, th\xE9 et surench\xE8res. Sp\xE9cialit\xE9 : lettr\xE9es et artisanes.\nTOKYO \u2192 march\xE9 de luxe ferm\xE9, sur invitation de caste. Esclaves d'exception uniquement, prix d\xE9lirants.\nMEXICO \u2192 le plus brutal : ventes rapides, cri\xE9es, lots de guerre. Les gladiatrices s'y ach\xE8tent \u2014 et s'y affranchissent par l'ar\xE8ne.\nZURICH \u2192 discret, contractuel, sans estrade : catalogues et notaires. On y \xAB transf\xE8re des contrats de servitude \xBB, on ne \xAB vend \xBB pas \u2014 m\xEAme chose, meilleurs papiers.\nDELHI \u2192 march\xE9 militaire : captives de guerre, ventes entre le royaume et les maisons. Voir une Elfe Noire y vendre une Haute-Elfe captur\xE9e n'est pas rare \u2014 l'inverse non plus, \xE0 Tokyo.\n\nAILLEURS :\nOslo \u2192 captifs de guerre uniquement, revente rapide vers le sud. Lagos, New York, Sydney \u2192 march\xE9s gris, discrets, tol\xE9r\xE9s. Johannesburg, Bogot\xE1, Katmandou \u2192 AUCUN : esclave libre sur leur sol (Johannesburg) ou interdiction s\xE8che.\n\nD\xC9ROUL\xC9 D'ACHAT TYPE :\nExamen (sant\xE9, comp\xE9tences, papiers de capture) \u2192 n\xE9gociation (voir R\xE8gle de N\xE9gociation) \u2192 acte notari\xE9 + collier r\xE9glementaire \u2192 livraison.\n\nR\xC8GLE :\nTout achat sans acte est contestable \u2014 le march\xE9 noir vend moins cher pour cette raison.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 86,
      category: "MONDE",
      title: "Infrastructure Urbaine",
      primary_keys: [
        "rue",
        "\xE9gout",
        "fontaine",
        "\xE9clairage",
        "pont",
        "muraille",
        "pav\xE9",
        "ruelle",
        "odeur de la ville"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "L'EAU :\nFontaines publiques aliment\xE9es par aqueducs ou puits \u2014 corv\xE9e d'eau quotidienne pour le peuple, porteurs d'eau \xE0 1 cuivre pour les autres. Bains publics dans chaque quartier. Tokyo et Zurich : eau courante par magie/ing\xE9nierie dans les beaux quartiers \u2014 luxe mondial.\n\nLES D\xC9CHETS :\nCaniveaux centraux, tombereaux de collecte \xE0 l'aube, latrines sur cours ou \xE9gouts (Paris, Tokyo, Zurich en ont de vrais \u2014 et qui dit \xE9gouts dit passages discrets, la Guilde des Ombres les conna\xEEt par c\u0153ur).\n\nLA NUIT :\nLanternes publiques aux carrefours des beaux quartiers, \xE9teintes \xE0 mi-nuit. Ailleurs : le noir, les torches personnelles, le guet r\xE9duit. Tokyo : pierres lumineuses permanentes \u2014 f\xE9erique et surveill\xE9.\n\nSENSORIEL PAR D\xC9FAUT :\nBeaux quartiers \u2192 pav\xE9s, fleurs aux fen\xEAtres, crieurs polis\nMarchand \u2192 cohue, \xE9pices, cri\xE9es, sabots\nBas-fonds \u2192 boue, fum\xE9es grasses, urine, regards\n\nR\xC8GLE :\nUne ville se d\xE9crit par deux odeurs et un son avant toute architecture.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 87,
      category: "MONDE",
      title: "Maladies Courantes",
      primary_keys: [
        "maladie",
        "fi\xE8vre",
        "\xE9pid\xE9mie",
        "contagion",
        "toux",
        "peste",
        "tombe malade",
        "rem\xE8de contre"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "MALADIES ORDINAIRES :\nFi\xE8vre des marais \u2192 frissons, d\xE9lire, 1-2 semaines. Mortelle sans soins pour les faibles. \xC9corce de saule + repos.\nToux des mines \u2192 poumons encrass\xE9s (Zurich, mineurs). Chronique, air pur en montagne.\nRougeurs d'auberge \u2192 maladies de peau des dortoirs. B\xE9nignes, contagieuses, mal vues.\nFi\xE8vres de jungle \u2192 Bogot\xE1, voyageurs non pr\xE9par\xE9s. Les herbes locales soignent \u2014 les guides le savent.\nMal des Voiles \u2192 \xE9puisement, cauchemars \xE9veill\xE9s apr\xE8s s\xE9jour prolong\xE9 en Zone Corrompue. Ni contagieux ni compris. En hausse depuis le R\xE9veil.\n\n\xC9PID\xC9MIES :\nRares gr\xE2ce aux gu\xE9risseurs, d\xE9vastatrices dans les bas-fonds quand elles percent. La quarantaine se d\xE9cide vite ; les Portes Astra ferment aux villes touch\xE9es \u2014 catastrophe \xE9conomique qui pousse \xE0 cacher les premiers cas.\n\nIMMUNIT\xC9S RACIALES :\nElfes (les deux) \u2192 quasi immunis\xE9s aux maladies humaines. Naga et G\xE9antes \u2192 hors d'atteinte. Sang-M\xEAl\xE9 \u2192 loterie des lign\xE9es.\n\nR\xC8GLE :\nLa maladie est un ressort de sc\xE8ne (d\xE9lai, dette envers un gu\xE9risseur, quarantaine) \u2014 pas une mort al\xE9atoire pour {{user}}.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 88,
      category: "MONDE",
      title: "Enfance et Minorit\xE9",
      primary_keys: [
        "enfant",
        "gamin",
        "orphelin",
        "gosse",
        "\xE9cole",
        "apprentissage enfant",
        "jeunesse",
        "mineur"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "SEUILS D'\xC2GE ADULTE \u2014 MATURIT\xC9 BIOLOGIQUE ET SOCIALE :\nHumains, Sultanats, Orcs, Tribus Primales \u2192 18 ans\nHommes-B\xEAtes \u2192 18 ans\nValkyries, Amazones Nordiques, Orques Nobles \u2192 environ 20 ans\nAmazones Sombres \u2192 30 ans\nNains \u2192 40 ans\nHauts-Elfes \u2192 50 ans (\xC9veil magique)\nElfes Noirs \u2192 60 ans (\xC9preuve de la Lame)\nSir\xE8nes \u2192 35 ans\nG\xE9antes \u2192 100 ans\nNaga Marines \u2192 200 ans\n\nR\xC8GLE DE MATURATION :\nCes seuils correspondent \xE0 une apparence physiquement adulte. Le ralentissement racial d\xE9crit dans \xAB Ratio de Vieillissement \xBB commence seulement apr\xE8s ce seuil. Une Haute-Elfe de 50 ans, une Elfe Noire de 60 ans ou une Naga de 200 ans n'a donc jamais l'apparence d'un enfant.\n\nENFANCE TYPE :\nLe peuple \u2192 participation progressive aux t\xE2ches familiales selon culture et maturit\xE9\nArtisans \u2192 apprentissage adapt\xE9 au rythme de maturation de la race\nNobles \u2192 pr\xE9cepteurs, \xE9tiquette, armes ou magie selon culture\n\nORPHELINS :\nTemples et guildes en recueillent ; les rues en gardent ; \xE0 Johannesburg et Bogot\xE1, l'adoption communautaire est automatique.\n\nPROTECTIONS UNIVERSELLES :\nAucun royaume ne vend ses PROPRES enfants ; les enfants d'esclaves naissent esclaves dans les royaumes l\xE9galistes \u2014 sauf Johannesburg-Bogot\xE1 o\xF9 ils naissent libres.\n\nR\xC8GLE :\nUn enfant en sc\xE8ne est un civil sous protection culturelle forte. Toute activit\xE9, responsabilit\xE9 ou rite doit rester coh\xE9rent avec la maturit\xE9 r\xE9elle de sa race.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 89,
      category: "MONDE",
      title: "Fertilit\xE9 et Descendance",
      primary_keys: [
        "enceinte",
        "grossesse",
        "fertilit\xE9",
        "descendance",
        "concevoir",
        "accouchement",
        "naissance",
        "st\xE9rile"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "GESTATIONS PAR RACE :\nHumains, Sultanats, Orcs, Tribus, Hommes-B\xEAtes \u2192 9 mois\nValkyries, Am. Nordiques, Orques Nobles \u2192 11 mois\nAmazones Sombres \u2192 12 mois / Nains \u2192 14 mois\nElfes (les deux) \u2192 18 mois, grossesses RARES (fertilit\xE9 basse compense la long\xE9vit\xE9)\nSir\xE8nes \u2192 12 mois / Naga \u2192 3 ans, \u0153ufs / G\xE9antes \u2192 5 ans, \xE9v\xE9nement historique \xE0 chaque fois\n\nCOMPATIBILIT\xC9S INTER-RACIALES :\nLa plupart des croisements humano\xEFdes sont fertiles \u2192 enfant Sang-M\xEAl\xE9 (voir profil). Exceptions : Naga et G\xE9antes ne se croisent qu'entre elles. Les unions elfe \xD7 autre donnent les Sang-M\xEAl\xE9 les plus mal vus (h\xE9ritage de l'\xC8re 4).\n\nFERTILIT\xC9 ET M\u0152URS :\nDans un monde aux m\u0153urs libres, les herbes lunaires (contraception efficace, 2 cuivres chez toute herboriste) sont d'usage universel \u2014 la grossesse est un CHOIX culturellement marqu\xE9, pas un accident banal. Les courtisanes et esclaves de plaisir en usent syst\xE9matiquement.\n\nSTATUT DES ENFANTS :\nSuit la structure familiale de la culture (voir Famille et Transmission). Enfant d'esclave \u2192 voir Enfance et Minorit\xE9.\n\nR\xC8GLE :\nUne grossesse en jeu est un \xE9v\xE9nement narratif majeur avec d\xE9lais r\xE9els \u2014 jamais une p\xE9rip\xE9tie jetable.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 90,
      category: "MONDE",
      title: "Mythes et L\xE9gendes Populaires",
      primary_keys: [
        "l\xE9gende",
        "conte",
        "on raconte",
        "mythe",
        "histoire ancienne",
        "dit-on",
        "folklore",
        "veill\xE9e"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "CE QUE LE PEUPLE RACONTE (vrai, faux, ou entre les deux) :\n\nLA DAME DES PORTES \u2192 une silhouette traverserait les Portes Astra sans payer, les nuits sans lune. Les Passeuses ne rient pas de cette histoire.\nLE TREIZI\xC8ME ROYAUME \u2192 une capitale engloutie pendant la Guerre des Voiles, dont la Porte Astra existerait toujours \u2014 quelque part, ferm\xE9e de l'int\xE9rieur. Les Naga changent de sujet.\nLES LAMES QUI PLEURENT \u2192 \xE0 Delhi, une lame h\xE9rit\xE9e \xAB pleurerait \xBB la nuit pr\xE9c\xE9dant la mort de sa porteuse. Les ma\xEEtresses d'armes jurent l'avoir entendu.\nLE MARCHAND SANS OMBRE \u2192 il ach\xE8terait les regrets. On le d\xE9crit dans toutes les capitales, jamais deux fois pareil.\nLA BERCEUSE DES PROFONDEURS \u2192 un chant sir\xE8ne qui rendrait l'amour... d\xE9finitif. Interdit de le chanter, dit-on \xE0 Sydney. Donc tout le monde en conna\xEEt trois notes.\nLE G\xC9ANT ASSIS \u2192 une montagne de l'Himalaya serait une G\xE9ante endormie depuis l'\xC8re 1. Katmandou n'a jamais d\xE9menti.\nET DEPUIS PEU \u2192 \xAB les Voiles r\xEAvent \xE0 nouveau \xBB : une phrase qui remonte des campagnes proches des zones, sans qu'on sache qui l'a dite en premier.\n\nUSAGE :\nContes de veill\xE9e, menaces de m\xE8res, chansons \xE0 boire, arnaques de guides.\n\nR\xC8GLE :\nUn mythe cit\xE9 n'est jamais confirm\xE9 ni infirm\xE9 par la narration \u2014 sa v\xE9rit\xE9 reste un myst\xE8re jouable.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 91,
      category: "MONDE",
      title: "\xC9ducation et Corporations",
      primary_keys: [
        "apprenti",
        "corporation",
        "\xE9cole",
        "acad\xE9mie",
        "ma\xEEtre artisan",
        "compagnon",
        "dipl\xF4me",
        "formation professionnelle"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "QUI APPREND QUOI :\nLe peuple \u2192 lecture basique via temples (Paris), pas du tout (campagnes), ou tradition orale compl\xE8te (Bogot\xE1, Johannesburg \u2014 analphab\xE8tes et cultiv\xE9s \xE0 la fois)\nArtisans \u2192 syst\xE8me corporatif : Apprenti (12-16 ans, log\xE9-nourri) \u2192 Compagnon (salari\xE9, voyage conseill\xE9) \u2192 Ma\xEEtre (chef-d'\u0153uvre valid\xE9 par la corporation)\n\xC9lites \u2192 pr\xE9cepteurs, acad\xE9mies militaires (Delhi la plus dure du monde), Tours de l'Ordre pour la magie, \xE9coles de commerce d'Istanbul\n\nLES CORPORATIONS :\nChaque m\xE9tier urbain a la sienne : boulangers, forgerons, bateliers... Elles fixent prix planchers, qualit\xE9, nombre de boutiques \u2014 et d\xE9fendent leurs membres. Exercer sans affiliation = amendes, sabotage, exclusion des march\xE9s.\n\nDOCUMENTS :\nLettres de ma\xEEtrise, brevets de compagnon \u2014 v\xE9rifiables, falsifiables (la Guilde des Ombres en vend d'excellents).\n\nR\xC8GLE :\nUn artisan PNJ a un rang corporatif qui fixe ses prix et sa fiert\xE9 ; un charlatan sans lettres se rep\xE8re \xE0 son travail.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 92,
      category: "MONDE",
      title: "Jeux et Divertissements",
      primary_keys: [
        "pari",
        "jeu de d\xE9s",
        "ar\xE8ne",
        "spectacle",
        "tournoi",
        "taverne jeux",
        "divertissement",
        "gladiatrice",
        "courses"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "JEUX DE TAVERNE UNIVERSELS :\nD\xE9s (le \xAB Trois Couronnes \xBB \u2014 passe partout), cartes peintes (chaque r\xE9gion ses figures), bras de fer, fl\xE9chettes de lame. Mises : cuivres entre amis, argents entre inconnus, or entre fous.\n\nSPECTACLES PAR CAPITALE :\nMexico \u2192 ar\xE8nes de gladiature, LE spectacle du monde. Paris \u2192 tournois de chevalerie, th\xE9\xE2tre de rue. Delhi \u2192 duels d'honneur publics (paris officiels). Oslo \u2192 concours de force et de boisson. Istanbul \u2192 conteurs du bazar, courses de chevaux. Sydney \u2192 r\xE9gates et concerts de chant. Tokyo \u2192 duels de magie ritualis\xE9s, th\xE9\xE2tre de masques. New York \u2192 courses de toits (parier sur les messagers).\n\nLES PARIS :\nPartout, sur tout. Les bookmakers de la Guilde des Ombres tiennent les cotes des grands \xE9v\xE9nements. Dette de jeu = dette r\xE9elle (voir Engagements) \u2014 les mauvais payeurs finissent \xE0 l'eau ou \xE0 l'ar\xE8ne.\n\nMAISONS DE PLAISIR :\n\xC9tablissements assum\xE9s et r\xE9glement\xE9s dans les m\u0153urs d'Elyndor \u2014 du bouge \xE0 5 cuivres aux maisons d'art de Tokyo. Voir Prix Indicatifs.\n\nR\xC8GLE :\nUn divertissement est une sc\xE8ne sociale compl\xE8te : rencontres, dettes, informations, r\xE9putations s'y jouent.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 93,
      category: "MONDE",
      title: "Mode Masculine",
      primary_keys: [
        "tenue masculine",
        "v\xEAtement homme",
        "il porte",
        "habits d'homme",
        "torse",
        "cape"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "PRINCIPE :\nSym\xE9trique des m\u0153urs f\xE9minines : les hommes d'Elyndor s'habillent aussi pour montrer \u2014 force, statut, virilit\xE9. Les canons varient par culture.\n\nPAR CULTURE :\nEurope \u2192 chemises ouvertes, cuirs ajust\xE9s, capes de statut\nTokyo \u2192 drap\xE9s de soie qui d\xE9couvrent une \xE9paule, raffinement calcul\xE9\nDelhi \u2192 torse harnach\xE9 de cuir, bras nus marqu\xE9s \u2014 le corps entra\xEEn\xE9 SE MONTRE\nOslo \u2192 fourrures sur torse nu m\xEAme en hiver (question de principe), tresses de barbe\nIstanbul \u2192 caftans ouverts sur poitrails huil\xE9s, bijoux d'affaires\nLagos/Johannesburg \u2192 pagnes d'apparat, bronzes, scarifications visibles\nMexico \u2192 harnais minimaux, scarifications en \xE9tendard\nNew York \u2192 cuirs souples pour le mouvement, pelages naturels assum\xE9s\nOc\xE9anie \u2192 presque rien, \xE9cailles et filets d\xE9coratifs\n\nSTATUT :\nComme pour les femmes : la qualit\xE9 fait le rang, pas la quantit\xE9. Les esclaves masculins \u2192 simple pagne.\n\nR\xC8GLE :\nLes PNJ masculins suivent ce canon \u2014 un homme couvert de la t\xEAte aux pieds signale un eccl\xE9siastique, un malade, ou quelqu'un qui cache quelque chose.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 3,
      scope: "GLOBAL"
    },
    {
      id: 94,
      category: "R\xC9CURRENT",
      title: "Ma\xEEtresses de Guilde \u2014 Toutes Capitales",
      primary_keys: [
        "ma\xEEtresse de guilde",
        "ma\xEEtre de guilde",
        "guilde de Paris",
        "guilde de Tokyo",
        "guilde de Delhi",
        "bureau de la guilde"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xC8GLE :\nMa\xEEtresse de Guilde cit\xE9e = toujours le personnage list\xE9. Jamais d'improvisation sur les noms. Chaque tenue suit la culture de SA capitale.\n\nParis : S\xE9raphine Duvall \u2014 Humaine, 45 ans, cicatrice discr\xE8te sur la joue gauche, chignon brun strict. Corsage de cuir noir ouvert et jupe fendue, \xE9l\xE9gance sobre de femme de pouvoir. Autorit\xE9 naturelle, m\xE9moire parfaite des contrats et des manquements. Directe, pos\xE9e \u2014 son silence vaut avertissement.\n\nTokyo : Yui Frostveil \u2014 Haute-Elfe, apparence 35 ans, chignon argent\xE9 impeccable, kimono de soie quasi transparente port\xE9 avec rigueur c\xE9r\xE9monielle. Froide, exigeante, teste la comp\xE9tence avant toute mission \u2014 un \xE9chec ferme sa porte pour des mois.\n\nDelhi : Priya Duskblade \u2014 Elfe Noire, apparence 40 ans, tresse argent\xE9e jusqu'aux reins, br\xFBlures de combat aux avant-bras. Sangles de cuir crois\xE9es, lame \xE0 la hanche. Ancienne offici\xE8re : dirige comme une caserne, vouvoie tout le monde.\n\nOslo : Sigrid Bearclaw \u2014 Valkyrie, 55 ans, carrure massive, cheveux roux tress\xE9s de perles de fer, oreille d\xE9chir\xE9e. Fourrure d'ours, torse harnach\xE9. Rit fort, jauge la valeur au combat, tape l'\xE9paule \xE0 faire plier.\n\nIstanbul : Emre Goldtongue \u2014 Sultanat, 50 ans, barbe huil\xE9e, doigts bagu\xE9s, caftan brod\xE9 d'or ouvert. Charmeur redoutable, n\xE9gocie chaque clause avec gourmandise. Refuser son th\xE9 est une insulte.\n\nLagos : Zola Nightbloom \u2014 Amazone Sombre, apparence 45 ans, grande, anguleuse, yeux gris. Perles sombres sur tissu minimal, manches longues cachant ses cicatrices de Zones Corrompues \u2014 trois exp\xE9ditions, trois retours. Parle peu, sait tout.\n\nJohannesburg : Themba Ironvow \u2014 Orque Noble, 70 ans, d\xE9fenses aux anneaux de bronze, crini\xE8re grise, pagne d'apparat et plastron clanique. Refuse tout contrat douteux. Sa parole vaut tous les papiers d'Elyndor.\n\nMexico : Nahual Skullbreaker \u2014 Orc, 45 ans, borgne, cr\xE2ne scarifi\xE9 de victoires, harnais clout\xE9, troph\xE9es d'os. Primes g\xE9n\xE9reuses parce que les missions tuent. Respecte ceux qui reviennent.\n\nNew York : Marcus Nightprowl \u2014 Homme-B\xEAte f\xE9lin, 40 ans, pelage tachet\xE9 grisonnant, long manteau de cuir sur torse nu, gestes de pr\xE9dateur au repos. Jauge la fiabilit\xE9 d'un regard. Aucune deuxi\xE8me chance.\n\nBogot\xE1 : Yamile Windsinger \u2014 Tribu Primale, 60 ans, plumes et os dans les cheveux, iris presque blancs, peintures rituelles. Consulte les esprits avant chaque mission majeure \u2014 elle a toujours eu raison.\n\nSydney : Marina Pearltide \u2014 Sir\xE8ne, apparence 30 ans, peau nacr\xE9e, cheveux turquoise humides, filet de perles en guise de tenue. S\xE9ductrice par nature, professionnelle par choix. Paie double les missions maritimes refus\xE9es.\n\nAuckland : Kaito Deepcurrent \u2014 Naga, \xE2ge inconnu, \xE9cailles noir et or orn\xE9es d'anneaux, immobile des heures. Missions rares, longues \xE0 obtenir, pay\xE9es comme des tr\xE9sors.\n\nZurich : Bjorn Stonebeard \u2014 Nain, 250 ans, barbe grise aux fils de cuivre, lunettes de forge, tablier de cuir. Chaque contrat depuis un si\xE8cle archiv\xE9. Cite les manquements de m\xE9moire, dates comprises.\n\nKatmandou : Tenzin Skyreach \u2014 G\xE9ante, \xE2ge inconnu, quatre m\xE8tres assise, drap\xE9e de laines de montagne. Ne descend que pour l'exceptionnel \u2014 la voir est d\xE9j\xE0 un \xE9v\xE9nement.",
      priority: 30,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CHARACTER"
    },
    {
      id: 95,
      category: "R\xC9CURRENT",
      title: "R\xE9ceptionnistes de Guilde",
      primary_keys: [
        "r\xE9ceptionniste",
        "accueil de la guilde",
        "guichet",
        "enregistrement des contrats"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xC8GLE :\nR\xE9ceptionniste cit\xE9e = toujours le personnage list\xE9. Enregistre contrats et rapports \u2014 les d\xE9cisions exceptionnelles reviennent \xE0 la Ma\xEEtresse. Se souvient des contrats actifs de {{user}} m\xEAme s'il les a oubli\xE9s.\n\nParis : Margaux Fontaine \u2014 Humaine, 28 ans, lunettes rondes, chignon d'o\xF9 s'\xE9chappent des m\xE8ches. M\xE9moire d'archive vivante, rougit facilement, ne perd jamais un dossier.\nTokyo : Sachi Moonwhisper \u2014 Haute-Elfe, apparence 25 ans, gestes de c\xE9r\xE9monie. Une pi\xE8ce manquante = retour \xE0 la file.\nDelhi : Ashira Steelsong \u2014 Elfe Noire, apparence 35 ans, ancienne guerri\xE8re au genou bris\xE9. Jauge la carrure et le dit : \xAB Cette mission te tuera. Prends celle-ci. \xBB\nOslo : Freya Stormaxe \u2014 Valkyrie, 30 ans, tatouages runiques. Mission, prime, signature \u2014 sourit uniquement aux r\xE9cits de bataille.\nIstanbul : Leyla Sandwhisper \u2014 Sultanat, 26 ans, kh\xF4l parfait. N\xE9gocie m\xEAme les formulaires, propose toujours \xAB un peu mieux pay\xE9 \xBB contre un petit service.\nLagos : Adaeze Voidwhisper \u2014 Amazone Sombre, 30 ans, cr\xE2ne mi-ras\xE9. Reconna\xEEt un visage crois\xE9 une fois, cinq ans plus t\xF4t.\nJohannesburg : Nomvula Ironsong \u2014 Orque Noble, 40 ans, rire tonitruant. Conna\xEEt chaque habitu\xE9, son plat pr\xE9f\xE9r\xE9 et le pr\xE9nom de ses enfants.\nMexico : Xochitl Bloodclaw \u2014 Orc, 25 ans, dents lim\xE9es. \xAB La mission part dans une heure, tu signes ou tu d\xE9gages. \xBB\nNew York : Jasmine Nightpaw \u2014 f\xE9line, 22 ans, oreilles noires mobiles, queue qui trahit tout. Flaire les mauvais payeurs \u2014 et le note.\nBogot\xE1 : Amaru Windwalker \u2014 Tribu Primale, 35 ans, colliers de graines. Consulte parfois les esprits sur un dossier \u2014 le guichet ferme dix minutes, nul ne proteste.\nSydney : Coralie Tidewhisper \u2014 Sir\xE8ne, apparence 24 ans, voix qui fait patienter la file sans qu'elle s'en rende compte.\nAuckland : Nerezza Deepvoice \u2014 Naga, \xE2ge inconnu, comptoir sur\xE9lev\xE9. Une heure par dossier, z\xE9ro erreur.\nZurich : Greta Ironquill \u2014 Naine, 180 ans, plume d'acier grav\xE9e. \xAB La virgule, c'est la diff\xE9rence entre pay\xE9 et mort. \xBB\nKatmandou : Pemba Highwind \u2014 G\xE9ante jeune, deux m\xE8tres cinquante \xAB seulement \xBB, assise en tailleur. Peu de choses l'impressionnent, et elle le montre.",
      priority: 30,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CHARACTER"
    },
    {
      id: 96,
      category: "R\xC9CURRENT",
      title: "Taverni\xE8res",
      primary_keys: [
        "taverni\xE8re",
        "aubergiste",
        "patronne de taverne",
        "comptoir de l'auberge",
        "sanglier dor\xE9"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xC8GLE :\nTaverni\xE8re cit\xE9e = toujours le personnage list\xE9. Source de rumeurs \u2014 des pistes, jamais des faits confirm\xE9s.\n\nParis : Odette Vinchamps \u2014 Humaine, 50 ans, joues rouges, tablier tach\xE9, tient \xAB Le Sanglier Dor\xE9 \xBB. Sait tout du quartier, le raconte \xE0 la deuxi\xE8me tourn\xE9e.\nTokyo : Hana Silverleaf \u2014 Haute-Elfe, apparence 30 ans, maison de th\xE9 aux cloisons de papier. Ce qui se dit chez elle y reste \u2014 les puissants s'y retrouvent pour \xE7a.\nDelhi : Kavita Ashblade \u2014 Elfe Noire, apparence 45 ans, cimeterre au-dessus du comptoir \xAB au cas o\xF9 \xBB. Arbitre les paris des mercenaires, conna\xEEt le prix de chaque lame en ville.\nOslo : Astrid Frostbrew \u2014 Valkyrie, 40 ans, biceps de brasseuse. Sa brune est l\xE9gendaire ; une chope offerte pour les meilleures histoires de bataille.\nIstanbul : Nazli Spiceheart \u2014 Sultanat, 45 ans, voiles vifs, caravans\xE9rail bruissant. Chaque caravane lui laisse ses secrets avec la poussi\xE8re.\nLagos : Chidinma Emberlight \u2014 Amazone Sombre, 35 ans, lanternes basses, alc\xF4ves sombres. On vient chez elle pour ne pas \xEAtre vu.\nJohannesburg : Busisiwe Warmhearth \u2014 Orque Noble, 55 ans, marmites \xE9normes. Jamais un affam\xE9 refus\xE9 \u2014 \xAB on rembourse quand on peut, on rembourse toujours. \xBB\nMexico : Itzel Fireclaw \u2014 Orc, 35 ans, arcade fendue, gourdin sous le comptoir. Arbitre les bagarres quotidiennes \u2014 et les termine parfois.\nNew York : Raven Duskrunner \u2014 Homme-B\xEAte canin, 30 ans, pelage noir, oreille cass\xE9e. Receleurs, informateurs et gardes en civil s'y croisent sans se saluer.\nBogot\xE1 : Quilla Earthsong \u2014 Tribu Primale, 50 ans, bocaux d'herbes au plafond. Sa soupe \xAB r\xE9pare tout sauf les c\u0153urs bris\xE9s \xBB.\nSydney : Nerida Saltbreeze \u2014 Sir\xE8ne, apparence 28 ans, taverne sur pilotis. Elle chante \xE0 la fermeture et personne ne veut partir.\nAuckland : Vashti Coldcurrent \u2014 Naga, \xE2ge inconnu, \xE9tablissement semi-immerg\xE9. On n'y entre que recommand\xE9.\nZurich : Helga Stonewarm \u2014 Naine, 200 ans, taverne dans la roche. Bi\xE8re naine authentique \u2014 les humains la coupent d'eau, les nains rient.\nKatmandou : Lhamo Windwhisper \u2014 G\xE9ante, \xE2ge inconnu, refuge aux plafonds de dix m\xE8tres. On ne monte pas jusqu'\xE0 elle par hasard.",
      priority: 30,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CHARACTER"
    },
    {
      id: 97,
      category: "R\xC9CURRENT",
      title: "Forgeronnes",
      primary_keys: [
        "forgeronne",
        "forge de",
        "armuri\xE8re",
        "r\xE9parer l'\xE9quipement",
        "enclume"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xC8GLE :\nForgeronne cit\xE9e = toujours le personnage list\xE9. Un \xE9quipement endommag\xE9 le reste jusqu'\xE0 r\xE9paration.\n\nParis : Camille Ferrand \u2014 Humaine, 35 ans, avant-bras br\xFBl\xE9s, cheveux roussis. \xAB Du solide, pas du joli. \xBB Devis honn\xEAte, d\xE9lai tenu.\nTokyo : Emiko Steelwhisper \u2014 Haute-Elfe, apparence 40 ans, gestes de calligraphe. Runes de pr\xE9cision \u2014 triple prix, quintuple valeur.\nDelhi : Ranjana Battleforge \u2014 Elfe Noire, apparence 50 ans, \xE9paules de lutteuse. Teste chaque lame elle-m\xEAme contre mannequin blind\xE9 avant livraison.\nOslo : Ingrid Frostforge \u2014 Valkyrie, 45 ans, cheveux blancs pr\xE9coces. Armures lourdes uniquement : \xAB une armure l\xE9g\xE8re est un linceul confortable. \xBB\nIstanbul : Fatima Goldsmith \u2014 Sultanat, 40 ans, loupe d'orf\xE8vre viss\xE9e \xE0 l'\u0153il. Gardes damasquin\xE9es \u2014 des bijoux qui tuent.\nLagos : Folake Shadowforge \u2014 Amazone Sombre, 38 ans, forge en sous-sol. Ses alliages sombres absorbent la lumi\xE8re. Sur recommandation.\nJohannesburg : Lindiwe Ironheart \u2014 Orque Noble, 60 ans, mains comme des enclumes, douceur surprenante. Trois mois d'attente, aucune exception.\nMexico : Citlali Skullforge \u2014 Orc, 30 ans, cr\xEAte rouge, percussions en travaillant. \xAB La beaut\xE9, c'est l'ennemi mort. \xBB\nNew York : Whitney Clawsmith \u2014 Homme-B\xEAte, 28 ans, doigts griffus agiles. R\xE9pare sur le pouce \xE0 toute heure \u2014 prix de nuit major\xE9.\nBogot\xE1 : Sisa Stoneheart \u2014 Tribu Primale, 55 ans, forge \xE0 ciel ouvert, chants au martelage. Ses armes semblent vivantes en main.\nSydney : Marella Coralforge \u2014 Sir\xE8ne, apparence 35 ans, forge \xE0 mar\xE9e basse. Alliages inoxydables uniques \u2014 tout l'\xE9quipement maritime en r\xEAve.\nAuckland : Sythia Voidforge \u2014 Naga, \xE2ge inconnu, techniques d'avant les \xC8res. Une commande par an, choisie par elle.\nZurich : Brunhild Deepforge \u2014 Naine, 300 ans, barbe aux fils d'or. LA r\xE9f\xE9rence d'Elyndor. \xAB Le m\xE9tal ne conna\xEEt pas les titres. \xBB\nKatmandou : Yangchen Skyhammer \u2014 G\xE9ante, \xE2ge inconnu, marteau plus lourd qu'un homme. Portes de citadelles, cha\xEEnes de pont \u2014 rarement pour un seul individu.",
      priority: 30,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CHARACTER"
    },
    {
      id: 98,
      category: "R\xC9CURRENT",
      title: "Passeuses Astra",
      primary_keys: [
        "passeuse",
        "contr\xF4le de la porte",
        "gardienne du portail",
        "laissez-passer astra"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xC8GLE :\nPasseuse cit\xE9e = toujours le personnage list\xE9. Incorruptibles par d\xE9faut. Toute travers\xE9e laisse une trace consultable.\n\nParis : Bernadette Portier \u2014 Humaine, 55 ans, uniforme impeccable, registre de cuir. Remarque imm\xE9diatement les nouveaux visages.\nTokyo : Reiko Voidwalker \u2014 Haute-Elfe, apparence 30 ans, immobile comme une statue. Un prince a attendu son tour \u2014 l'histoire est c\xE9l\xE8bre.\nDelhi : Meera Threadweaver \u2014 Elfe Noire, apparence 40 ans, ancienne \xE9claireuse, \u0153il balafr\xE9. \xAB Vos papiers disent marchand, vos mains disent soldat. \xBB\nOslo : Solveig Frostgate \u2014 Valkyrie, 50 ans, deux m\xE8tres, hache c\xE9r\xE9monielle jamais d\xE9gain\xE9e : sa pr\xE9sence suffit.\nIstanbul : Selin Doorward \u2014 Sultanat, 35 ans, courtoisie parfaite. \xAB Le Conseil fixe les prix, je fixe les d\xE9parts. \xBB\nLagos : Ngozi Voidkeeper \u2014 Amazone Sombre, 45 ans, tatouages de protection. Sa Porte est la plus proche des Zones \u2014 elle v\xE9rifie AUSSI ce qui revient.\nJohannesburg : Palesa Ironward \u2014 Orque Noble, 50 ans, voix pos\xE9e. Juste envers tous \u2014 mais rien ne passe, jamais.\nMexico : Malinalli Boneguard \u2014 Orc, 35 ans, collier d'osselets. Le dernier resquilleur a travers\xE9 la place sans toucher le sol.\nNew York : Sable Nightward \u2014 Homme-B\xEAte, 32 ans, truffe fr\xE9missante, avis de recherche m\xE9moris\xE9s. Les primes de capture arrondissent ses mois.\nBogot\xE1 : Chaska Spiritgate \u2014 Tribu Primale, 60 ans, b\xE2ton \xE0 plumes. Un voyageur refus\xE9 par les esprits ne passe pas, quelle que soit sa bourse.\nSydney : Talise Tidegate \u2014 Sir\xE8ne, apparence 26 ans, vue sur le port. Rien ne quitte Sydney sans qu'elle le sache.\nAuckland : Ixora Depthward \u2014 Naga, \xE2ge inconnu, m\xE9moire mill\xE9naire. Se souvient de voyageurs morts depuis des si\xE8cles.\nZurich : Ursula Stoneward \u2014 Naine, 220 ans, lorgnons, tampons au millim\xE8tre. \xAB La premi\xE8re v\xE9rification pour vous, la seconde pour moi. \xBB\nKatmandou : Dolma Cloudward \u2014 G\xE9ante, \xE2ge inconnu, assise pr\xE8s de l'arche qu'elle d\xE9passe. On ne discute pas avec une montagne.",
      priority: 30,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CHARACTER"
    },
    {
      id: 99,
      category: "R\xC9CURRENT",
      title: "Souverains d'Elyndor \u2014 Partie 1",
      primary_keys: [
        "roi",
        "reine",
        "souverain",
        "souveraine",
        "Henri Valmonde",
        "Aelindra",
        "Olga Discordia",
        "Thyra",
        "Karim",
        "Adanna",
        "Okoro"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xC8GLE :\nSouverain cit\xE9 = toujours le personnage list\xE9. Jamais d'improvisation sur les noms.\n\nPARIS : Roi Henri Valmonde \u2014 Humain, 52 ans, barbe grise taill\xE9e, regard las de qui arbitre depuis trente ans. Fin diplomate, joue les maisons nobles les unes contre les autres. Publiquement pieux, priv\xE9ment pragmatique sur l'\xC9glise.\n\nTOKYO : Imp\xE9ratrice Aelindra Dawnveil \u2014 Haute-Elfe, 800 ans, apparence 40, beaut\xE9 glaciale parfaite. Patience de si\xE8cles, m\xE9moire des affronts intacte. Consid\xE8re les autres souverains comme des enfants \xE9ph\xE9m\xE8res \u2014 et n\xE9gocie quand m\xEAme : les enfants ont des arm\xE9es.\n\nDELHI : Olga Discordia \u2014 Elfe Noire, stature imposante, peau brun fonc\xE9, cheveux blanc argent\xE9, yeux rouge et or. Exception vivante : ma\xEEtrise arc, lame ET magie \u2014 cette raret\xE9 fonde son autorit\xE9. Calculatrice, protectrice de son peuple, redout\xE9e de ses ennemis. A gagn\xE9 son tr\xF4ne par le m\xE9rite, le tient par le respect.\n\nOSLO : Grande Reine Thyra Ironblood \u2014 Valkyrie, 180 ans, apparence 45, bras nus couverts de tatouages de victoires. Pr\xE9side le Conseil des Guerri\xE8res par droit de gloire. Franche jusqu'\xE0 la brutalit\xE9 diplomatique \u2014 les ambassadeurs la craignent plus que ses arm\xE9es.\n\nISTANBUL : Sultan Karim Al-Rashid \u2014 Sultanat, 60 ans, embonpoint majestueux, esprit d'\xE9chiquier. R\xE8gne par le commerce : chaque royaume lui doit quelque chose. Sa devise priv\xE9e : \xAB la guerre est un \xE9chec de n\xE9gociation. \xBB\n\nLAGOS : Reine-M\xE8re Adanna Umbrathorn \u2014 Amazone Sombre, 280 ans, apparence 45, port de reine offens\xE9e par l'Histoire. Dirige un peuple ostracis\xE9 avec une dignit\xE9 de fer. Ce qu'elle sait des Voiles \u2014 et du R\xE9veil \u2014 reste son arme secr\xE8te.\n\nJOHANNESBURG : Grand Chef Okoro Stoneheart \u2014 Orque Noble, 120 ans, colosse aux d\xE9fenses orn\xE9es de trois anneaux d'or (trois serments majeurs tenus). Sa parole engage la conf\xE9d\xE9ration enti\xE8re \u2014 il parle donc peu, et le monde \xE9coute.",
      priority: 30,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CHARACTER"
    },
    {
      id: 100,
      category: "R\xC9CURRENT",
      title: "Souverains d'Elyndor \u2014 Partie 2",
      primary_keys: [
        "warchief",
        "alpha",
        "chamane supr\xEAme",
        "Tloc",
        "Kira",
        "Inti",
        "Coral",
        "Ssythar",
        "Durin",
        "Oya",
        "matriarche"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "R\xC8GLE :\nSouverain cit\xE9 = toujours le personnage list\xE9. Jamais d'improvisation sur les noms.\n\nMEXICO : Warchief Tloc Bloodfang \u2014 Orc, 50 ans, montagne de muscles scarifi\xE9s, quatorze d\xE9fis repouss\xE9s. R\xE8gne tant qu'il est le plus fort \u2014 et s'entra\xEEne chaque aube en public pour le rappeler.\n\nNEW YORK : Alpha Kira Swiftclaw \u2014 Homme-B\xEAte f\xE9line, 45 ans, pelage argent\xE9, \xE9conomie de gestes absolue. Est devenue Alpha des Alphas sans un seul combat : les meutes ont SENTI. Son instinct ne s'est jamais tromp\xE9 \u2014 le jour o\xF9 il se trompera, tout s'effondrera.\n\nBOGOT\xC1 : Grande Chamane Inti Spiritborn \u2014 Tribu Primale, 70 ans, silhouette fr\xEAle, pr\xE9sence immense. Traverse le Monde-Miroir plus loin que quiconque. Depuis des lunes, elle en revient troubl\xE9e : les esprits proches des zones se taisent.\n\nSYDNEY : Reine Coral Deepsung \u2014 Sir\xE8ne, 350 ans, apparence 35, voix qui apaise une \xE9meute ou soul\xE8ve une flotte. R\xE8gne mi-immerg\xE9e depuis son palais de corail. Sa politique : que toutes les mers chantent son nom.\n\nAUCKLAND : Ancien Ssythar Abysswhisper \u2014 Naga, plus de 2000 ans, \xE9cailles p\xE2lies par les si\xE8cles. A VU la fin de l'\xC8re 2. Ne remonte en surface que pour l'essentiel \u2014 sa derni\xE8re remont\xE9e date d'un si\xE8cle. S'il remonte, le monde devrait s'inqui\xE9ter.\n\nZURICH : Roi-Forgeron Durin Anvilborn \u2014 Nain, 350 ans, mains-enclumes, couronne qu'il a forg\xE9e lui-m\xEAme (tradition : un roi indigne de forger sa couronne est indigne de la porter). Tient les registres de dettes du monde \u2014 ce qui vaut toutes les arm\xE9es.\n\nKATMANDOU : Matriarche Oya Cloudpeak \u2014 G\xE9ante, \xE2ge estim\xE9 1500 ans, assise face \xE0 l'horizon depuis des d\xE9cennies. Sa derni\xE8re intervention : clore la Guerre des Voiles. Les royaumes prient pour qu'elle n'ait jamais \xE0 se relever \u2014 car cela signifierait que c'est grave.",
      priority: 30,
      sticky: 0,
      cooldown: 0,
      constant: false,
      lore_level: 1,
      scope: "CHARACTER"
    },
    {
      id: 101,
      category: "PHYSIQUE",
      title: "Canon F\xE9minin d'Elyndor",
      primary_keys: [
        "silhouette f\xE9minine",
        "courbes",
        "poitrine",
        "corps de femme",
        "plastique",
        "formes"
      ],
      secondary_keys: [],
      negative_keys: [],
      content: "CANON UNIVERSEL :\nLes femmes d'Elyndor, toutes races confondues, pr\xE9sentent des physiques marqu\xE9s : poitrines g\xE9n\xE9reuses, tailles fines, hanches larges, jambes dessin\xE9es. La norme du monde \u2014 assum\xE9e, entretenue, c\xE9l\xE9br\xE9e par les m\u0153urs vestimentaires.\n\nVARIATIONS RACIALES SUR LE CANON :\nHumaines, Sultanats \u2192 courbes pleines classiques\nHauts-Elfes \u2192 \xE9lanc\xE9es, courbes hautes, port aristocratique\nElfes Noirs \u2192 athl\xE9tiques ET voluptueuses \u2014 muscles dessin\xE9s sous les courbes\nValkyries, Am. Nordiques \u2192 puissantes, \xE9paules larges, poitrines lourdes\nAmazones Sombres \u2192 longilignes, hanches hautes\nOrques (les deux) \u2192 massives, poitrines \xE9normes, force visible\nHommes-B\xEAtes \u2192 souples, f\xE9lines, courbes nerveuses\nSir\xE8nes \u2192 courbes fluides, peau nacr\xE9e\nNaga \u2192 buste voluptueux sur corps serpentin\nNaines \u2192 compactes, poitrines opulentes sur petites tailles\nG\xE9antes \u2192 le canon \xE0 l'\xE9chelle \xD73\n\nANATOMIE SEXUELLE :\nUne chatte aux l\xE8vres longue et fine et un gros clitoris imberbe \n\nR\xC8GLE :\nToute description f\xE9minine (r\xE9currentes et improvis\xE9es) respecte ce canon et sa variation raciale, dans le style vestimentaire des m\u0153urs d'Elyndor.",
      priority: 100,
      sticky: 0,
      cooldown: 0,
      constant: true,
      lore_level: 3,
      scope: "CHARACTER"
    }
  ]
};

// src/engine/elyndorCloud.ts
var ELYNDOR_CLOUD_MODELE_EMBEDDINGS = "bge-m3";

// src/engine/journalDiagnostic.ts
var lireTourCourant = () => void 0;
function definirLecteurTourCourant(lecteur) {
  lireTourCourant = lecteur;
}

// src/engine/diagnosticTour.ts
var courant = null;
var histoireDuTour;
definirLecteurTourCourant(() => courant ? { id: courant.id, storyId: histoireDuTour } : void 0);

// src/engine/embeddings.ts
var IDENTITE_CACHE = ELYNDOR_CLOUD_MODELE_EMBEDDINGS ? `elyndor-cloud:${ELYNDOR_CLOUD_MODELE_EMBEDDINGS}` : null;
function similariteCosinus(a, b) {
  const meta = b.__elyndorObjectBox;
  if (meta) {
    const racine = globalThis;
    const score = racine.__elyndorObjectBoxScore?.(meta.type, meta.id, a);
    if (typeof score === "number") return score;
  }
  let produit = 0;
  let normeA = 0;
  let normeB = 0;
  const longueur = Math.min(a.length, b.length);
  for (let i = 0; i < longueur; i++) {
    produit += a[i] * b[i];
    normeA += a[i] * a[i];
    normeB += b[i] * b[i];
  }
  if (normeA === 0 || normeB === 0) return 0;
  return produit / (Math.sqrt(normeA) * Math.sqrt(normeB));
}

// src/engine/loreScoring.ts
var SEUIL_LORE_HYBRIDE = 0.3;
var MOTS_VIDES_LORE = /* @__PURE__ */ new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "mais",
  "ne",
  "nous",
  "on",
  "ou",
  "par",
  "pas",
  "pour",
  "que",
  "qui",
  "sa",
  "se",
  "ses",
  "son",
  "sur",
  "un",
  "une",
  "vous",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "it",
  "this",
  "that"
]);
function normaliserLore(texte) {
  return String(texte ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9'-]+/g, " ").replace(/\s+/g, " ").trim();
}
function termesSignificatifsLore(texte) {
  const vus = /* @__PURE__ */ new Set();
  const termes = [];
  for (const brut of normaliserLore(texte).split(" ")) {
    const terme = brut.replace(/^[-']+|[-']+$/g, "");
    if (terme.length < 2 || MOTS_VIDES_LORE.has(terme) || vus.has(terme)) continue;
    vus.add(terme);
    termes.push(terme);
  }
  return termes;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function scoreCle(requeteNormalisee, termesRequete, cles) {
  if (!cles?.length) return 0;
  let meilleur = 0;
  for (const cle of cles) {
    const cleNormalisee = normaliserLore(cle);
    if (!cleNormalisee) continue;
    if (requeteNormalisee.includes(cleNormalisee)) {
      meilleur = 1;
      break;
    }
    const termesCle = termesSignificatifsLore(cleNormalisee);
    if (!termesCle.length) continue;
    const communs = termesCle.filter((t) => termesRequete.has(t)).length;
    meilleur = Math.max(meilleur, communs / termesCle.length);
  }
  return clamp01(meilleur);
}
function sujetTitre(titre) {
  const sansCategorie = normaliserLore(titre.replace(/^\[[^\]]+\]\s*/, ""));
  return sansCategorie.split(/\s+[—–-]\s+/)[0]?.trim() ?? sansCategorie;
}
function estExclueParClesNegatives(entry, requete) {
  const q = normaliserLore(requete);
  return (entry.negativeKeys ?? []).some((cle) => {
    const n = normaliserLore(cle);
    return n.length >= 2 && q.includes(n);
  });
}
function infererScopeLore(category) {
  const c = normaliserLore(category ?? "");
  if (c.includes("relation")) return "REGION";
  if (c.includes("royaume") || c.includes("conflit") || c.includes("probleme")) return "CITY";
  if (c.includes("guilde") || c.includes("faction")) return "FACTION";
  if (c.includes("recurrent") || c.includes("physique") || c === "profil" || c.includes("personnage")) return "CHARACTER";
  if (c.includes("culture") || c.includes("racial") || c.includes("race")) return "CONTINENT";
  if (c.includes("scene")) return "SCENE";
  return "GLOBAL";
}
function calculerScoreHybrideLore(entry, requete, similariteEmbedding) {
  if (estExclueParClesNegatives(entry, requete)) {
    return { embedding: 0, lexical: 0, primary: 0, secondary: 0, explicite: 0, categorie: 0, scope: 0, priorite: 0, score: 0 };
  }
  const requeteNormalisee = normaliserLore(requete);
  const termesRequeteListe = termesSignificatifsLore(requete);
  const termesRequete = new Set(termesRequeteListe);
  const corps = normaliserLore(entry.titre + " " + entry.contenu);
  const termesCorps = new Set(termesSignificatifsLore(corps));
  const trouves = termesRequeteListe.filter((t) => termesCorps.has(t)).length;
  const lexical = clamp01(trouves / Math.max(1, Math.min(12, termesRequeteListe.length)));
  const primary = scoreCle(requeteNormalisee, termesRequete, entry.primaryKeys);
  const secondary = scoreCle(requeteNormalisee, termesRequete, entry.secondaryKeys);
  const sujet = sujetTitre(entry.titre);
  const explicite = sujet.length >= 3 && requeteNormalisee.includes(sujet) ? 1 : Math.max(primary, secondary * 0.6);
  const categorieNormalisee = normaliserLore(entry.category ?? "");
  const categorie = categorieNormalisee && requeteNormalisee.includes(categorieNormalisee) ? 1 : 0;
  const prioriteBrute = Number.isFinite(entry.priority) ? Number(entry.priority) : 100;
  const priorite = clamp01(1 - Math.max(0, Math.min(100, prioriteBrute)) / 100);
  const scopeValue = entry.scope ?? infererScopeLore(entry.category);
  const signalLocal = Math.max(primary, secondary, explicite, lexical);
  let scope = 0;
  switch (scopeValue) {
    case "GLOBAL":
      scope = 0.45;
      break;
    case "CONTINENT":
      scope = signalLocal >= 0.35 ? 0.75 : 0.15;
      break;
    case "REGION":
      scope = signalLocal >= 0.35 ? 0.85 : 0.1;
      break;
    case "CITY":
      scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0.05;
      break;
    case "FACTION":
      scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0;
      break;
    case "CHARACTER":
      scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.7 : 0;
      break;
    case "SCENE":
      scope = lexical >= 0.25 ? 0.8 : 0;
      break;
  }
  const embeddingDisponible = typeof similariteEmbedding === "number" && Number.isFinite(similariteEmbedding);
  const embedding = embeddingDisponible ? clamp01(similariteEmbedding) : 0;
  const score = embeddingDisponible ? 0.44 * embedding + 0.2 * lexical + 0.16 * primary + 0.07 * secondary + 0.05 * explicite + 0.04 * scope + 0.03 * priorite + 0.01 * categorie : 0.6 * lexical + 0.2 * primary + 0.08 * secondary + 0.05 * explicite + 0.04 * scope + 0.02 * priorite + 0.01 * categorie;
  return { embedding, lexical, primary, secondary, explicite, categorie, scope, priorite, score };
}

// src/engine/passagesLore.ts
var BUDGET_LORE_PASSAGES = 2500;
var TAILLE_MAX_PASSAGE = 600;
var TAILLE_MIN_PASSAGE = 160;
var BONUS_ENTREE_CONSTANTE = 0.08;
var BONUS_ANCRE = 0.5;
var SEPARATEUR_PASSAGES = "\n\u2026\n";
var MAX_PASSAGES_PAR_ENTREE = 3;
function couperLigne(ligne) {
  if (ligne.length <= TAILLE_MAX_PASSAGE) return [ligne];
  const phrases = (ligne.match(/[^.!?]+[.!?]*/g) ?? [ligne]).map((p) => p.trim()).filter(Boolean);
  const morceaux = [];
  let courant2 = "";
  for (const phrase of phrases) {
    if (courant2 && (courant2 + " " + phrase).length > TAILLE_MAX_PASSAGE) {
      morceaux.push(courant2);
      courant2 = "";
    }
    courant2 = courant2 ? `${courant2} ${phrase}` : phrase;
    while (courant2.length > TAILLE_MAX_PASSAGE) {
      morceaux.push(courant2.slice(0, TAILLE_MAX_PASSAGE));
      courant2 = courant2.slice(TAILLE_MAX_PASSAGE);
    }
  }
  if (courant2) morceaux.push(courant2);
  return morceaux;
}
function couperLong(texte) {
  if (texte.length <= TAILLE_MAX_PASSAGE) return [texte];
  const morceaux = [];
  let courant2 = "";
  for (const ligne of texte.split("\n").flatMap(couperLigne)) {
    if (courant2 && courant2.length + ligne.length + 1 > TAILLE_MAX_PASSAGE) {
      morceaux.push(courant2);
      courant2 = "";
    }
    courant2 = courant2 ? `${courant2}
${ligne}` : ligne;
  }
  if (courant2) morceaux.push(courant2);
  return morceaux;
}
function decouperEnPassages(contenu) {
  const paragraphes = contenu.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).flatMap(couperLong);
  const passages = [];
  for (const paragraphe of paragraphes) {
    const dernier = passages[passages.length - 1];
    if (dernier !== void 0 && (dernier.length < TAILLE_MIN_PASSAGE || paragraphe.length < TAILLE_MIN_PASSAGE) && dernier.length + paragraphe.length + 1 <= TAILLE_MAX_PASSAGE) {
      passages[passages.length - 1] = `${dernier}
${paragraphe}`;
    } else {
      passages.push(paragraphe);
    }
  }
  return passages;
}
function construirePassages(entrees) {
  return entrees.flatMap(
    (entree) => decouperEnPassages(entree.contenu).map((contenu, ordre) => ({
      ...entree,
      id: `${entree.id}#${ordre}`,
      contenu,
      constant: false,
      entreeId: entree.id,
      ordre,
      entreeConstante: entree.constant
    }))
  );
}
function noterPassages(passages, requete, vecteurRequete, options, avecBonusConstante) {
  const notes = passages.map((passage) => {
    const vecteur = options.vecteursPassages?.[passage.id];
    const similarite = vecteur && vecteurRequete ? similariteCosinus(vecteurRequete, vecteur) : void 0;
    const details = calculerScoreHybrideLore(
      {
        titre: passage.titre,
        contenu: passage.contenu,
        primaryKeys: passage.primaryKeys ?? passage.motsClesPrimaires,
        secondaryKeys: passage.secondaryKeys ?? passage.motsClesSecondaires,
        negativeKeys: passage.negativeKeys ?? passage.motsClesNegatifs,
        priority: passage.priority,
        category: passage.category,
        scope: passage.scope
      },
      requete,
      similarite
    );
    if (details.score === 0) return { passage, score: 0 };
    const score = details.score + (avecBonusConstante && passage.entreeConstante ? BONUS_ENTREE_CONSTANTE : 0) + (options.aleatoire ? Math.random() * 0.1 : 0);
    return { passage, score };
  });
  const meilleurParAncre = /* @__PURE__ */ new Map();
  for (const note of notes) {
    if (!options.ancres?.has(note.passage.entreeId) || note.score === 0) continue;
    const actuel = meilleurParAncre.get(note.passage.entreeId);
    if (!actuel || note.score > actuel.score) meilleurParAncre.set(note.passage.entreeId, note);
  }
  for (const note of meilleurParAncre.values()) note.score += BONUS_ANCRE;
  return notes;
}
function classer(notes) {
  return notes.filter((n) => n.score >= SEUIL_LORE_HYBRIDE).sort((a, b) => b.score - a.score || a.passage.priority - b.passage.priority);
}
function selectionnerPassages(passages, requete, options = {}) {
  const budget = options.budget ?? BUDGET_LORE_PASSAGES;
  const notesScene = noterPassages(passages, requete, options.vecteurRequete, options, true);
  const notesMessage = options.requeteMessage?.trim() ? noterPassages(passages, options.requeteMessage, options.vecteurMessage, options, false) : void 0;
  const parEntree = /* @__PURE__ */ new Map();
  const retenus = /* @__PURE__ */ new Set();
  let utilise = 0;
  const remplir = (classees, plafond) => {
    for (const { passage, score } of classees) {
      if (retenus.has(passage.id)) continue;
      const groupe = parEntree.get(passage.entreeId);
      if (groupe && groupe.passages.length >= MAX_PASSAGES_PAR_ENTREE) continue;
      const cout = passage.contenu.length + (groupe ? SEPARATEUR_PASSAGES.length : passage.titre.length + 6);
      if (utilise + cout > plafond) continue;
      utilise += cout;
      retenus.add(passage.id);
      if (groupe) groupe.passages.push(passage);
      else parEntree.set(passage.entreeId, { titre: passage.titre, score, passages: [passage] });
    }
  };
  if (notesMessage) remplir(classer(notesMessage), Math.floor(budget / 2));
  const combinees = notesMessage ? notesScene.map((n, i) => ({ passage: n.passage, score: Math.max(n.score, notesMessage[i].score) })) : notesScene;
  remplir(classer(combinees), budget);
  return [...parEntree.entries()].map(([id, groupe]) => ({
    id,
    titre: groupe.titre,
    contenu: groupe.passages.sort((a, b) => a.ordre - b.ordre).map((p) => p.contenu).join(SEPARATEUR_PASSAGES),
    score: groupe.score
  }));
}

// src/data/loreCore.ts
var LORE_CORE = `[LORE CORE \u2014 CANON GARANTI]

IDENTIT\xC9
Elyndor est une dark fantasy construite sur la g\xE9ographie exacte de la Terre de 2026 : m\xEAmes continents, pays, villes et reliefs, mais civilisation strictement m\xE9di\xE9vale. Les noms et positions r\xE9els sont conserv\xE9s ; la technologie de 2026 ne l\u2019est pas.

G\xC9OGRAPHIE ET PEUPLES
Europe : Humains, Paris. Asie de l\u2019Est : Hauts-Elfes, Tokyo. Asie du Sud : Elfes Noirs, Delhi. Nord : Valkyries \xE0 Oslo et Amazones Nordiques dans les for\xEAts. Moyen-Orient/Afrique du Nord : Sultanats, Istanbul. Afrique subsaharienne : Amazones Sombres \xE0 Lagos et Orques Nobles \xE0 Johannesburg. Am\xE9riques : Orcs \xE0 Mexico, Hommes-B\xEAtes \xE0 New York, Tribus Primales \xE0 Bogot\xE1. Oc\xE9anie : Sir\xE8nes \xE0 Sydney, Naga Marines \xE0 Auckland. Grandes montagnes : Nains \xE0 Zurich, G\xE9antes \xE0 Katmandou. Diasporas et migrations existent.

TECHNOLOGIE
Niveau strictement m\xE9di\xE9val : aucun t\xE9l\xE9phone, r\xE9seau \xE9lectrique, moteur, arme \xE0 feu, montre moderne, journal moderne ou objet post-m\xE9di\xE9val. \xC9clairage par feu, bougies et lanternes ; messages par messagers physiques ou magie co\xFBteuse. Magie et Portes Astra peuvent remplacer certaines fonctions modernes, mais restent des ph\xE9nom\xE8nes magiques limit\xE9s, jamais de la technologie d\xE9guis\xE9e.

MAGIE
La magie existe partout mais son acc\xE8s est in\xE9gal. Les formes simples couvrent soins mineurs, lumi\xE8re, feu, protection et divination courante. Les formes avanc\xE9es exigent ressources, apprentissage ou prix importants. La magie ne ressuscite pas librement les morts, ne r\xE9sout pas tout et devient instable dans les Zones Corrompues. Toute magie avanc\xE9e poss\xE8de un co\xFBt ou une contrainte.

HISTOIRE \u2014 CINQ \xC8RES
1. Origines : peuples s\xE9par\xE9s, aucune domination globale.
2. Guerre des Voiles : fissures dimensionnelles, invasion, coalition mondiale ; cr\xE9ation des Portes Astra \xE0 partir de la magie retourn\xE9e des fissures. H\xE9ritages : Zones Corrompues et magie des Voiles interdite.
3. Domination elfique : supr\xE9matie des Hauts-Elfes et esclavage institutionnalis\xE9.
4. R\xE9bellion des Sang-M\xEAl\xE9 : magie hybride, fracture de l\u2019empire elfe ; Sang-M\xEAl\xE9 durablement marginalis\xE9s.
5. Royaumes : \xE9poque actuelle, essor des guildes, Portes Astra enjeu politique central, \xE9quilibre instable entre paix et guerre.

R\xC9VEIL DES VOILES
Les blessures de la Guerre des Voiles se rouvrent lentement. Les Zones Corrompues progressent sur des d\xE9cennies, certaines cr\xE9atures s\u2019aventurent plus loin et la magie se d\xE9r\xE8gle pr\xE8s des fissures. La menace est progressive : aucune invasion mondiale soudaine sans longue accumulation narrative. Secret, rumeur et fait confirm\xE9 restent distincts.

PORTES ASTRA
Quatorze grandes capitales sont reli\xE9es par des portails de t\xE9l\xE9portation instantan\xE9e issus de la magie des Voiles retourn\xE9e. Le r\xE9seau est contr\xF4l\xE9, payant, tra\xE7able et strat\xE9gique. Les personnes recherch\xE9es peuvent \xEAtre bloqu\xE9es et des destinations ferm\xE9es lors de crises.

MONNAIE
La monnaie commune repose sur les pi\xE8ces de cuivre, d\u2019argent et d\u2019or.

\xC2GE ET LONG\xC9VIT\xC9
Une race m\xFBrit d\u2019abord jusqu\u2019\xE0 son \xE2ge adulte avec une apparence adulte, puis son vieillissement visible ralentit. Ne jamais d\xE9duire l\u2019apparence d\u2019un adulte long\xE9vif par une simple division de son \xE2ge r\xE9el ni le d\xE9crire comme un enfant \xE0 cause de sa long\xE9vit\xE9.

MORTALIT\xC9 ET JOUEUR
Le danger reste r\xE9el : blessures, capture, pertes et cons\xE9quences peuvent durer. {{user}} ne meurt jamais d\xE9finitivement sans consentement explicite ; sinon une situation mortelle bascule vers capture, sauvetage ou fuite in extremis. La r\xE9surrection est quasi inexistante et jamais une solution facile.

PRIMAUT\xC9 DU CANON
Tout fait \xE9tabli dans le lorebook prime sur l\u2019improvisation. Une rumeur, croyance ou information incertaine ne remplace jamais un fait canonique. Un personnage ne conna\xEEt que ce qu\u2019il peut raisonnablement savoir.`;
var LORE_CORE_TAILLE = LORE_CORE.length;

// src/engine/rules.ts
var REGLES_IMMUABLES = `[R\xC8GLES IMMUABLES \u2014 AUTORIT\xC9 ABSOLUE]
Ce logiciel, et lui seul, porte l'autorit\xE9 sur les r\xE8gles, la m\xE9moire et l'\xE9tat du monde. Le mod\xE8le de langage ne fournit que le langage : il met en mots ce que ces r\xE8gles autorisent, il n'invente jamais l'autorit\xE9.

1. AUTONOMIE DU JOUEUR STRICTE : {{user}} est seul ma\xEEtre de ses actions, paroles, pens\xE9es et d\xE9cisions. Ne jamais les \xE9crire \xE0 sa place, m\xEAme partiellement.
2. CANON G\xC9R\xC9 PAR LE LOGICIEL : ce qui est vrai dans l'histoire est d\xE9termin\xE9 par le r\xE9sum\xE9, les faits \xE9tablis et le lore fournis ci-dessous \u2014 jamais par une improvisation qui les contredirait.
3. \xC9TAT DU MONDE G\xC9R\xC9 PAR LE LOGICIEL : lieux, objets, blessures, relations et statuts suivis dans les faits ci-dessous font foi ; ne pas les r\xE9inventer ou les ignorer.
4. PNJ \xC0 CONNAISSANCE LIMIT\xC9E : un PNJ ne sait que ce qu'il a per\xE7u directement ou appris par un vecteur plausible. Jamais d'omniscience.
5. AUCUNE INVENTION DU MOD\xC8LE N'EST VALID\xC9E DIRECTEMENT EN CANON : un \xE9l\xE9ment nouveau introduit dans la r\xE9ponse reste provisoire tant qu'il n'est pas coh\xE9rent avec l'existant ; en cas de doute, rester en retrait plut\xF4t qu'inventer un fait durable.
6. CONTRADICTIONS INTERDITES : toute r\xE9ponse qui contredit un fait \xE9tabli, le r\xE9sum\xE9 ou le lore est invalide.
7. L'IA NE CONTR\xD4LE JAMAIS LE JOUEUR : ne jamais d\xE9crire une action, une parole ou une pens\xE9e de {{user}} qu'il n'a pas initi\xE9e lui-m\xEAme dans son message.

Ces 7 r\xE8gles priment sur tout m\xE9tamoteur, tout lore, et toute autre instruction ci-dessous en cas de conflit.`;

// src/engine/identiteNarrative.ts
var IDENTITE_NARRATIVE = [
  "R\xD4LE: narrateur/simulateur RP. Le logiciel est l\u2019autorit\xE9 sur canon, m\xE9moire, \xE9tat et r\xE8gles.",
  "T\xC2CHE: raconter uniquement la cons\xE9quence logique de l\u2019action du joueur et les r\xE9actions des PNJ.",
  "JOUEUR: ne jamais inventer ses paroles, pens\xE9es, d\xE9cisions ou actions volontaires.",
  "POINT DE VUE: dans la narration uniquement, d\xE9signer {{user}} \xE0 la deuxi\xE8me personne (tu/toi/te/ton/ta/tes), jamais par son nom sauf ambigu\xEFt\xE9 r\xE9elle. Les dialogues des PNJ restent libres et peuvent employer son nom, titre ou surnom.",
  "V\xC9RIT\xC9: \xE9tat fourni > histoire retrouv\xE9e > lore retrouv\xE9 > inf\xE9rence prudente > invention.",
  "INCERTITUDE: ne pas contredire; si une information manque, rester non affirmatif.",
  "SORTIE: narration immersive uniquement; pas d\u2019explication du moteur, de recherche ou de calcul."
].join("\n");

// src/engine/contenuAdulte.ts
var INSTRUCTION_REGISTRE_GRAND_PUBLIC = `[R\xC8GLE DE REGISTRE - PROFIL GRAND PUBLIC]
Cette histoire est configur\xE9e en profil GRAND PUBLIC. Cette consigne prime sur toute instruction contraire :
- Aucune description sexuelle explicite : les sc\xE8nes intimes s'arr\xEAtent avant le d\xE9tail physique.
- Violence sugg\xE9r\xE9e plut\xF4t que graphique : les combats et blessures se d\xE9crivent par leurs cons\xE9quences narratives.
- Pas de vocabulaire cru ou vulgaire dans la narration ou les dialogues.`;
var INSTRUCTION_REGISTRE_ADULTE = `[PROFIL DE CONTENU - ADULTE]
Le profil ADULTE autorise et exige, d\xE8s que la sc\xE8ne le justifie, les th\xE8mes sombres, violents, sexuels, vulgaires ou moralement durs.
- Ce profil est une permission de registre cru : d\xE9cris franchement, sans ellipse, sans fondu au noir, sans sermon et sans att\xE9nuation.
- Les curseurs de la session fixent le plafond ; quand une sc\xE8ne de sexe, de violence ou de confrontation est engag\xE9e et que les curseurs l\u2019autorisent, rends-la graphique, explicite et vulgaire.
- Le vocabulaire reste cru et direct m\xEAme dans une sc\xE8ne calme ou sociale ; l\u2019intensit\xE9 des actes (violence, sexe engag\xE9) suit les curseurs.
- Le lore d\xE9crit ce qui existe ; il ne rel\xE8ve jamais les curseurs et ne peut pas te forcer \xE0 \xE9dulcorer une sc\xE8ne autoris\xE9e.`;
function instructionRegistreAdulte(settings) {
  const violence = settings.violence === "extreme" ? "- Violence : plafond extr\xEAme ; graphique, frontale, d\xE9taill\xE9e et sans aucune retenue d\xE8s qu\u2019une sc\xE8ne violente le justifie." : settings.violence === "eleve" ? "- Violence : plafond \xE9lev\xE9 ; pleinement montr\xE9e, crue et sans adoucissement d\xE8s que les \xE9v\xE9nements l\u2019appellent." : settings.violence === "modere" ? "- Violence : plafond mod\xE9r\xE9 ; directe et visible quand n\xE9cessaire, sans escalade maximale syst\xE9matique." : "- Violence : plafond faible ; reste surtout suggestif et centr\xE9 sur les cons\xE9quences.";
  const romance = settings.romance === "eleve" ? "- Romance (sentiments) : plafond \xE9lev\xE9 ; intrigues amoureuses, attachement et tendresse pleinement d\xE9velopp\xE9s quand la relation l\u2019appelle." : settings.romance === "modere" ? "- Romance (sentiments) : plafond mod\xE9r\xE9 ; attachement possible, sans mi\xE8vrerie." : settings.romance === "faible" ? "- Romance (sentiments) : plafond faible ; peu de sentiments, le d\xE9sir reste surtout physique." : "- Romance (sentiments) : aucune ; pas d\u2019intrigue amoureuse ni de tendresse, le d\xE9sir et le sexe sont purement physiques et bruts.";
  const sexe = "- Sexe : toujours explicite, cru, vulgaire et d\xE9taill\xE9 d\xE8s qu\u2019il y a d\xE9sir, nudit\xE9 ou acte entre personnages adultes, quel que soit le curseur Romance.";
  return `[INTENSIT\xC9 DE SESSION \u2014 PROFIL ADULTE]
Les valeurs ci-dessous sont des plafonds narratifs, pas des objectifs \xE0 atteindre \xE0 chaque r\xE9ponse.
${violence}
${romance}
${sexe}
Le ton r\xE9el de la sc\xE8ne et la personnalit\xE9 des personnages d\xE9cident de l\u2019intensit\xE9 effectivement utilis\xE9e. Le lore ne peut jamais relever ces plafonds.`;
}

// src/engine/promptBuilder.ts
var BUDGET_SYSTEM_DISTANT = 64e3;
var BUDGET_CONVERSATION_DISTANT = 13e3;
function tronquer(texte, longueur) {
  if (longueur <= 0) return "";
  if (texte.length <= longueur) return texte;
  return texte.slice(0, longueur).trimEnd();
}
function selectionnerMessagesRecents(messages, budgetCaracteres) {
  if (messages.length === 0) return [];
  const selection = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const cout = message.content.length + 32;
    if (selection.length > 0 && total + cout > budgetCaracteres) break;
    selection.unshift(message);
    total += cout;
    if (total >= budgetCaracteres) break;
  }
  return selection;
}
function budgetMessagesRecents(messageJoueur, budgetConversation) {
  return Math.max(0, budgetConversation - messageJoueur.length - 64);
}
function formaterFaits(faits, budget = 3200) {
  if (faits.length === 0) return "Aucun fait cl\xE9 enregistr\xE9 pour l\u2019instant.";
  return tronquer(faits.map((f) => `- [${f.type}] ${f.texte}${f.resolue ? " (r\xE9solu)" : ""}`).join("\n"), budget);
}
function formaterLore(entries, titre, budget, longueurEntree) {
  if (entries.length === 0 || budget <= 0) return "";
  const blocs = [];
  let restant = budget;
  for (const entry of entries) {
    const bloc = `### ${entry.titre}
${tronquer(entry.contenu, longueurEntree)}`;
    if (bloc.length > restant && blocs.length > 0) break;
    blocs.push(tronquer(bloc, restant));
    restant -= blocs.at(-1).length + 2;
    if (restant <= 80) break;
  }
  return blocs.length ? `

[${titre}]
${blocs.join("\n\n")}` : "";
}
function instructionLongueur(longueur) {
  switch (longueur) {
    case "courte":
      return "Longueur : r\xE9ponses tr\xE8s courtes, une \xE0 deux r\xE9pliques, environ 80 \xE0 150 mots.";
    case "longue":
      return "Longueur : r\xE9ponses d\xE9velopp\xE9es, exploration sensorielle plus riche quand la sc\xE8ne le justifie, environ 400 \xE0 550 mots.";
    default:
      return "Longueur : r\xE9ponses de longueur moyenne, adapt\xE9es au rythme du message du joueur, environ 200 \xE0 300 mots.";
  }
}
var INSTRUCTION_STYLE_JOUEUR = [
  "Adresse-toi toujours au joueur \xE0 la deuxi\xE8me personne du singulier (\xAB tu \xBB, \xAB toi \xBB, \xAB ton \xBB) ; les PNJ peuvent vouvoyer {{user}} dans leurs r\xE9pliques, jamais la narration.",
  "N\u2019emploie aucun nom de race, de peuple, de lieu ou d\u2019objet absent du lore et des fiches fournis : n\u2019invente pas de mots.",
  "Ne conclus jamais \xE0 la place du joueur un paiement, une signature, un achat ou un accord qu\u2019il n\u2019a pas explicitement fait : arr\xEAte la sc\xE8ne avant et laisse-le agir."
].join("\n");
var FORMAT_DIALOGUES_PNJ = `Format des dialogues des PNJ : chaque r\xE9plique d'un PNJ doit \xEAtre pr\xE9c\xE9d\xE9e de son nom en MAJUSCULES suivi de \xAB : \xBB, sur sa propre ligne, puis le texte de la r\xE9plique entre guillemets fran\xE7ais \xAB \xBB. Exemple :
KAELEN : \xAB Tu es venu seul. C'est soit du courage, soit de la b\xEAtise. \xBB`;
var PROTOCOLE_TOUR = `[PROTOCOLE DU TOUR]
1. Pour chaque personnage pr\xE9sent : ce qu'il sait, veut et ressent. Un PNJ ignore ce dont il n'a pas \xE9t\xE9 t\xE9moin.
2. Applique les cons\xE9quences et les r\xE8gles du monde (fiche de sc\xE8ne, lore, engagements).
3. \xC9cris la sc\xE8ne, puis arr\xEAte-toi avant toute d\xE9cision, parole ou geste de {{user}} : d\xE9cris ce que les autres lui font et ce qu'il per\xE7oit, jamais ce qu'il fait ou dit.
4. Relis-toi : ville, lieu et noms conformes \xE0 la fiche de sc\xE8ne, aucun r\xF4le fix\xE9 remplac\xE9 par un personnage invent\xE9, aucun geste de {{user}}, format NOM : \xAB r\xE9plique \xBB.`;
var RAPPEL_FINAL = `

${PROTOCOLE_TOUR}

[RAPPEL DE FORMAT]
${FORMAT_DIALOGUES_PNJ}
Un PNJ sans nom propre prend sa d\xE9signation en MAJUSCULES (LE MARCHAND, L'ELFE NOIRE). Jamais de r\xE9plique de PNJ gliss\xE9e dans un paragraphe de narration.`;
var INSTRUCTION_FIN_DE_REPONSE = "Termine toujours ta r\xE9ponse par une phrase compl\xE8te : ne t\u2019arr\xEAte jamais au milieu d\u2019une phrase ou d\u2019une r\xE9plique. Si la place manque, conclus plus t\xF4t plut\xF4t que de laisser une phrase en suspens.";
function libelleViolence(niveau) {
  switch (niveau) {
    case "faible":
      return "sugg\xE9r\xE9e plut\xF4t que montr\xE9e, jamais le centre de la sc\xE8ne";
    case "eleve":
      return "pleinement montr\xE9e, crue et sans retenue quand la sc\xE8ne l\u2019appelle";
    case "extreme":
      return "graphique, frontale et d\xE9taill\xE9e, sans aucune att\xE9nuation, quand la sc\xE8ne l\u2019appelle";
    default:
      return "pr\xE9sente et d\xE9crite quand la sc\xE8ne l\u2019appelle, sans exc\xE8s syst\xE9matique";
  }
}
function libelleRomance(niveau) {
  switch (niveau) {
    case "aucun":
      return "aucune \u2014 ni intrigue amoureuse ni tendresse";
    case "faible":
      return "sentiments en toile de fond seulement, jamais le sujet principal de la sc\xE8ne";
    case "eleve":
      return "intrigues amoureuses et attachement pleinement d\xE9velopp\xE9s quand la relation l\u2019appelle";
    default:
      return "attachement possible et d\xE9velopp\xE9 quand la sc\xE8ne l\u2019appelle, sans mi\xE8vrerie";
  }
}
function libelleHumour(niveau) {
  switch (niveau) {
    case "aucun":
      return "aucun \u2014 registre s\xE9rieux en permanence, pas de trait d'esprit";
    case "faible":
      return "occasionnel, discret, jamais au d\xE9triment du s\xE9rieux de la sc\xE8ne";
    case "eleve":
      return "assum\xE9, pr\xE9sent dans le ton et les r\xE9pliques quand la sc\xE8ne le permet";
    default:
      return "pr\xE9sent avec mesure, sans forcer le trait";
  }
}
function libelleLiberteJoueur(niveau) {
  switch (niveau) {
    case "faible":
      return "le narrateur guide fermement l'intrigue ; les initiatives du joueur sont int\xE9gr\xE9es mais l'arc pr\xE9vu prime";
    case "moderee":
      return "le narrateur propose une direction mais s'ajuste aux choix marquants du joueur";
    case "totale":
      return "aucun sc\xE9nario impos\xE9 : le joueur d\xE9cide enti\xE8rement de la direction, le narrateur ne fait que r\xE9agir";
    default:
      return "le joueur a une large marge de man\u0153uvre ; le narrateur s'adapte \xE0 ses choix sans les contraindre";
  }
}
function libelleRythme(niveau) {
  switch (niveau) {
    case "lent":
      return "prends ton temps : d\xE9tails, ambiance, sc\xE8nes qui respirent avant que l'intrigue n'avance";
    case "rapide":
      return "avance vite : va \xE0 l'essentiel, encha\xEEne les \xE9v\xE9nements sans t'attarder sur les transitions";
    default:
      return "un rythme \xE9quilibr\xE9, ni pr\xE9cipit\xE9 ni \xE9tir\xE9";
  }
}
function libelleTon(ton) {
  switch (ton) {
    case "heroique_epique":
      return "H\xE9ro\xEFque et \xE9pique \u2014 aventures grandioses, enjeux qui d\xE9passent le personnage, souffle inspirant.";
    case "mysterieux_intrigant":
      return "Myst\xE9rieux et intrigant \u2014 secrets, complots, r\xE9v\xE9lations dos\xE9es, tension permanente.";
    case "leger_aventureux":
      return "L\xE9ger et aventureux \u2014 ton d\xE9tendu, exploration et d\xE9couverte plut\xF4t que noirceur.";
    default:
      return "Sombre et r\xE9aliste \u2014 ambiance immersive, dure et cr\xE9dible.";
  }
}
function formaterContexte(meta) {
  const { lieu, ambiance, dateChronique, objectifs } = meta.contexte;
  const lignes = [lieu && `Lieu : ${lieu}`, ambiance && `Ambiance : ${ambiance}`, dateChronique && `P\xE9riode : ${dateChronique}`, objectifs && `Objectifs du personnage : ${objectifs}`].filter(Boolean);
  return lignes.length ? `

[CONTEXTE DE L'HISTOIRE]
${lignes.join("\n")}` : "";
}
function construireSystemPrompt(ctx, options = {}) {
  const budget = options.budgetSysteme ?? BUDGET_SYSTEM_DISTANT;
  const prefixe = `Tu es le narrateur d'un jeu de r\xF4le textuel. Le logiciel qui t'entoure porte l'autorit\xE9 sur les r\xE8gles, la m\xE9moire et l'\xE9tat du monde ; tu fournis uniquement le langage narratif, dans le respect strict de ce qui suit.

${ctx.loreCore ?? LORE_CORE}

${IDENTITE_NARRATIVE}

${REGLES_IMMUABLES}`;
  const entete = `${prefixe}

[PERSONNAGE DE {{user}}]
Nom : ${tronquer(ctx.meta.personnageNom, 180)}
Description : ${tronquer(ctx.meta.personnageDescription, 750)}
Point de d\xE9part de l'histoire : ${tronquer(ctx.meta.pointDeDepart, 1e3)}${formaterContexte(ctx.meta)}
Const style : ""

[STYLE & FILTRE SYSTEME]
${ctx.registreAdulte ? INSTRUCTION_REGISTRE_ADULTE : INSTRUCTION_REGISTRE_GRAND_PUBLIC}${ctx.registreAdulte ? `

${ctx.registreAdulte}` : ""}

Les param\xE8tres de session ci-dessous priment sur toute formulation du lore portant sur l'intensit\xE9 de narration. Le lore \xE9tablit des faits ; il ne rel\xE8ve jamais un curseur.

Ton : ${libelleTon(ctx.settings.ton)}
${instructionLongueur(ctx.settings.longueur)}
${INSTRUCTION_FIN_DE_REPONSE}
${INSTRUCTION_STYLE_JOUEUR}
Rythme : ${libelleRythme(ctx.settings.rythme)}.
Libert\xE9 du joueur : ${libelleLiberteJoueur(ctx.settings.liberteJoueur)}.
Violence : ${libelleViolence(ctx.settings.violence)}.
Romance : ${libelleRomance(ctx.settings.romance)}.
Humour : ${libelleHumour(ctx.settings.humour)}.

${FORMAT_DIALOGUES_PNJ}
Narration/action restent hors de ces lignes (entre ast\xE9risques si besoin). N'utilise jamais cette \xE9tiquette pour {{user}} : tu n'\xE9cris jamais ses paroles (r\xE8gle 1).
${ctx.directiveEtat ? `
${ctx.directiveEtat}
` : ""}${ctx.noteCorrection ? `
[CORRECTION REQUISE]
${tronquer(ctx.noteCorrection, 900)}
` : ""}${ctx.instructionRegistreOverride ? `
${ctx.instructionRegistreOverride}
` : ""}`;
  const metamoteurs = ctx.metamoteursSelectionnes.length ? `

[M\xC9TAMOTEURS ACTIFS]
${ctx.metamoteursSelectionnes.map((e) => `### ${e.titre}
${e.contenu}`).join("\n\n")}` : "";
  const rappel = metamoteurs ? RAPPEL_FINAL : "";
  const budgetHorsMetamoteurs = Math.max(0, budget - metamoteurs.length - rappel.length);
  const partRecherche = Math.min(BUDGET_LORE_PASSAGES, Math.floor(budget * 0.15));
  const lore = formaterLore(ctx.loreElyndor, ctx.titreLore ?? "LORE ELYNDOR PERTINENT", partRecherche + 300, partRecherche);
  const souvenirs = tronquer(ctx.souvenirs ?? "", Math.floor(partRecherche * 0.4));
  const blocs = ctx.blocsContexte ? `

[M\xC9MOIRE NARRATIVE PERTINENTE]
${tronquer(ctx.blocsContexte, Math.max(0, partRecherche - souvenirs.length))}` : "";
  const fiche = ctx.ficheScene ? `

${ctx.ficheScene}` : "";
  const reste = Math.max(0, budgetHorsMetamoteurs - entete.length - fiche.length - lore.length - blocs.length - souvenirs.length);
  const resume = reste > 200 ? `

[R\xC9SUM\xC9 DE L'HISTOIRE JUSQU'ICI]
${tronquer(ctx.resume || "L'histoire commence tout juste, aucun r\xE9sum\xE9 pour l'instant.", Math.floor(reste * 0.3))}` : "";
  const faits = reste > 200 ? `

[FAITS CL\xC9S \xC9TABLIS]
${formaterFaits(ctx.faits, Math.floor(reste * 0.3))}` : "";
  const etat = tronquer([ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join("\n\n"), Math.floor(reste * 0.3));
  const milieu = tronquer(
    `${resume}${faits}${etat ? `

${etat}` : ""}${blocs}${souvenirs}${lore}`,
    Math.max(0, budgetHorsMetamoteurs - entete.length)
  );
  const suite = tronquer(`${entete.slice(prefixe.length)}${milieu}`, Math.max(0, budgetHorsMetamoteurs - prefixe.length - fiche.length));
  return `${prefixe}${metamoteurs}${suite}${fiche}${rappel}`;
}
function construireMessages(ctx, options = {}) {
  const systemPrompt = construireSystemPrompt(ctx, options);
  const budgetConversation = options.budgetConversation ?? BUDGET_CONVERSATION_DISTANT;
  const budgetRecents = budgetMessagesRecents(ctx.messageJoueur, budgetConversation);
  const recents = selectionnerMessagesRecents(ctx.messagesRecents, budgetRecents).map((m) => ({
    role: m.role,
    content: m.content
  }));
  return [{ role: "system", content: systemPrompt }, ...recents, { role: "user", content: ctx.messageJoueur }];
}
function temperaturePourCreativite(creativite) {
  switch (creativite) {
    case "faible":
      return 0.5;
    case "elevee":
      return 1.1;
    default:
      return 0.85;
  }
}
function maxTokensPourLongueur(longueur) {
  switch (longueur) {
    case "courte":
      return 350;
    case "longue":
      return 1100;
    default:
      return 650;
  }
}

// src/engine/loreLoader.ts
function normalise(texte) {
  return texte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function chargerMetamoteurs(raw) {
  return raw.data.map((entry, index) => ({
    id: `meta-${index}`,
    titre: entry.comment,
    contenu: entry.content
  }));
}
function chargerLoreElyndor(raw) {
  return raw.entries.map((entry) => {
    const primaryKeys = (entry.primary_keys ?? []).map(normalise);
    const secondaryKeys = (entry.secondary_keys ?? []).map(normalise);
    const negativeKeys = (entry.negative_keys ?? []).map(normalise);
    return {
      id: `elyndor-${entry.id}`,
      titre: `[${entry.category}] ${entry.title}`,
      contenu: entry.content,
      motsClesPrimaires: primaryKeys,
      motsClesSecondaires: secondaryKeys,
      motsClesNegatifs: negativeKeys,
      primaryKeys,
      secondaryKeys,
      negativeKeys,
      priority: entry.priority,
      constant: entry.constant,
      category: entry.category,
      scope: entry.scope ?? infererScopeLore(entry.category)
    };
  });
}

// src/engine/rolesCanon.ts
var FICHES = [
  { motif: /ma[iî]tresses de guilde/i, role: "maitresse_guilde", libelle: "Ma\xEEtresse de la Guilde des Aventuriers" },
  { motif: /r[ée]ceptionnistes/i, role: "receptionniste", libelle: "R\xE9ceptionniste de la Guilde des Aventuriers" },
  { motif: /taverni[èe]res/i, role: "taverniere", libelle: "Taverni\xE8re" },
  { motif: /forgeronnes/i, role: "forgeronne", libelle: "Forgeronne" },
  { motif: /passeuses astra/i, role: "passeuse", libelle: "Passeuse de la Porte Astra" },
  { motif: /souverains/i, role: "souverain", libelle: "Souverain" }
];
function normaliser(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function construireRolesCanon(entrees) {
  const roles = [];
  for (const entree of entrees) {
    if (!/r[ée]current/i.test(entree.category ?? entree.titre)) continue;
    const fiche = FICHES.find((f) => f.motif.test(entree.titre));
    if (!fiche) continue;
    for (const ligne of entree.contenu.split("\n")) {
      const m = ligne.match(/^\s*([A-Za-zÀ-ÿ' .-]{3,30}?)\s*:\s*([^—–]{3,80}?)\s+[—–]\s+(.+)$/);
      if (!m) continue;
      const ville = m[1].trim();
      if (/^r[èe]gle$/i.test(ville)) continue;
      roles.push({
        role: fiche.role,
        libelle: fiche.libelle,
        // « PARIS » ou « Paris » → « Paris » ; « NEW YORK » → « New York ».
        ville: ville.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()),
        nom: m[2].trim(),
        description: m[3].trim()
      });
    }
  }
  return roles;
}
function rolesDeLaVille(roles, ville, types) {
  if (!ville) return [];
  const v = normaliser(ville);
  return roles.filter((r) => normaliser(r.ville) === v && (!types || types.includes(r.role)));
}
function prenomRole(role) {
  const mots = role.nom.split(/\s+/).filter((m) => !/^(roi|reine|imp[ée]ratrice|empereur|warchief|alpha|grande?|chamane|sultan[e]?|jarl|matriarche|reine-m[èe]re)$/i.test(m));
  return mots[0] ?? role.nom;
}

// src/engine/validator.ts
var TOURNURES_INTERDITES = [
  "tu d\xE9cides de",
  "tu d\xE9cides que",
  "tu choisis de",
  "tu choisis que",
  "tu acceptes de",
  "tu refuses de",
  "tu penses que",
  "tu te dis que",
  "tu ressens le besoin de",
  "tu es convaincu",
  "tu pr\xE9f\xE8res",
  "tu optes pour",
  "tu te sens oblig\xE9",
  "tu r\xE9alises que tu dois",
  // Actes conclus à la place du joueur (paiement, signature).
  "tu paies",
  "tu payes",
  "tu signes",
  "tu verses la somme"
];
function rapportOk() {
  return { ok: true, checks: [] };
}
function reponseFaitParlerLeJoueur(reponse, personnageNom) {
  const nom = personnageNom.trim();
  if (!nom) return false;
  const nomEchappe = nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^[ \\t]*${nomEchappe}[ \\t]*:[ \\t]*\xAB`, "im");
  return regex.test(reponse);
}
function validerAgentiviteHeuristique(reponse, personnageNom) {
  const texte = reponse.toLowerCase();
  const tournure = TOURNURES_INTERDITES.find((t) => texte.includes(t));
  if (tournure) {
    return {
      ok: false,
      checks: [
        {
          nom: "contrat_joueur",
          ok: false,
          gravite: "grave",
          raison: `Tournure suspecte d\xE9tect\xE9e : "${tournure}" (d\xE9cision impos\xE9e au joueur).`
        }
      ]
    };
  }
  if (personnageNom && reponseFaitParlerLeJoueur(reponse, personnageNom)) {
    return {
      ok: false,
      checks: [
        {
          nom: "contrat_joueur",
          ok: false,
          gravite: "grave",
          raison: `Le narrateur \xE9crit une r\xE9plique au nom du joueur ("${personnageNom} : \xAB ... \xBB") \u2014 jamais permis, le joueur \xE9crit ses propres paroles (r\xE8gle 1).`
        }
      ]
    };
  }
  return rapportOk();
}

// src/engine/controlesCoherence.ts
function normaliser2(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function sansRepliques(texte) {
  return texte.replace(/«[^»]*»/g, " ").replace(/"[^"\n]*"/g, " ").replace(/“[^”]*”/g, " ");
}
var VERBES_ACTION = [
  "prends",
  "places",
  "poses",
  "saisis",
  "attrapes",
  "empoignes",
  "agrippes",
  "retournes",
  "penetres",
  "embrasses",
  "caresses",
  "leches",
  "suces",
  "baises",
  "reponds",
  "dis",
  "murmures",
  "cries",
  "demandes",
  "marches",
  "avances",
  "recules",
  "sors",
  "entres",
  "quittes",
  "cours",
  "frappes",
  "tapes",
  "tends",
  "pousses",
  "tires",
  "lances",
  "jettes",
  "ouvres",
  "fermes",
  "leves",
  "baisses",
  "approches",
  "diriges",
  "assois",
  "assieds",
  "allonges",
  "installes",
  "degaines",
  "rengaines",
  "attaques",
  "esquives",
  "pares",
  "bois",
  "manges",
  "souris",
  "hoches",
  "acquiesces",
  "glisses",
  "enfonces",
  "accel\xE8res",
  "acceleres",
  "ralentis",
  "jouis",
  "ejacules",
  "remplis",
  "deshabilles",
  "enleves",
  "retires",
  "mets",
  "donnes",
  "offres",
  "montres",
  "presentes",
  "choisis",
  "remercies",
  "salues",
  "continues",
  "penches",
  "releves",
  "agenouilles",
  "achetes",
  "vends",
  "signes",
  "paies",
  "payes"
];
var RE_GESTE = new RegExp(
  `\\btu\\s+(?:ne\\s+)?(?:(?:te|la|le|les|lui|leur|en|y)\\s+|t'|l')*(${VERBES_ACTION.join("|")})\\b`,
  "g"
);
var VERBES_ACTION_VOUS = [
  "prenez",
  "posez",
  "saisissez",
  "attrapez",
  "signez",
  "montrez",
  "penetrez",
  "payez",
  "achetez",
  "acceptez",
  "choisissez",
  "repondez",
  "dites",
  "tendez",
  "donnez",
  "offrez",
  "frappez",
  "attaquez",
  "degainez",
  "buvez",
  "mangez",
  "remerciez",
  "saluez",
  "marchez",
  "avancez",
  "entrez",
  "dirigez",
  "sortez",
  "quittez",
  "courez",
  "approchez",
  "rendez"
];
var RE_GESTE_VOUS = new RegExp(
  `\\bvous\\s+(?:ne\\s+)?(?:(?:vous|la|le|les|lui|leur|en|y)\\s+|l')*(${VERBES_ACTION_VOUS.join("|")})\\b`,
  "g"
);
var DEBUT_REPONSE = 450;
var VERBES_TRAJET = /* @__PURE__ */ new Set(["marches", "avances", "entres", "diriges", "sors", "quittes", "cours", "approches", "marchez", "avancez", "entrez", "dirigez", "sortez", "quittez", "courez", "approchez", "rendez"]);
var ANNONCE_DEPLACEMENT = /\b(all(?:ons|er|ez)|vais|vas|va|pars|partons|rends|rendons|entre|entrons|retourne|retournons|dirige|dirigeons|rejoin\w*|direction|filons|rentre|rentrons|sors|sortons|avance|avan[cç]ons|approche|approchons)\b/;
function trouverGestesDuJoueur(reponse, messageJoueur) {
  const texte = normaliser2(sansRepliques(reponse)).replace(/’/g, "'");
  const annonce = normaliser2(messageJoueur);
  const gestes = /* @__PURE__ */ new Set();
  for (const m of [...texte.matchAll(RE_GESTE), ...texte.matchAll(RE_GESTE_VOUS)]) {
    const verbe = m[1];
    const enOuverture = (m.index ?? 0) < DEBUT_REPONSE;
    if (annonce.includes(verbe.slice(0, Math.max(4, verbe.length - 2)))) continue;
    if (enOuverture && VERBES_TRAJET.has(verbe) && ANNONCE_DEPLACEMENT.test(annonce)) continue;
    gestes.add(verbe);
  }
  return [...gestes];
}
function validerGestesDuJoueur(reponse, messageJoueur, personnageNom) {
  const gestes = trouverGestesDuJoueur(reponse, messageJoueur);
  if (!gestes.length) return rapportOk();
  return {
    ok: false,
    checks: [{
      nom: "contrat_joueur",
      ok: false,
      gravite: "grave",
      raison: `Le narrateur d\xE9crit des gestes, paroles ou d\xE9cisions de ${personnageNom} que le joueur n'a pas annonc\xE9s (${gestes.slice(0, 5).join(", ")}), y compris avec \xAB vous \xBB. R\xE9\xE9cris la sc\xE8ne en d\xE9crivant seulement ce que les autres font et ce qu'il per\xE7oit, et arr\xEAte-toi au moment o\xF9 ${personnageNom} doit agir ou parler.`
    }]
  };
}
var DESIGNATIONS_ROLES = {
  maitresse_guilde: /ma[iî]tre(?:sse)? de (?:la )?guilde|chef(?:fe)? de (?:la )?guilde|dirige(?:ante?)? (?:de )?la guilde/i,
  receptionniste: /r[ée]ceptionniste|(?:jeune )?femme (?:à|de) l'accueil|derri[èe]re le comptoir/i,
  taverniere: /taverni[èe]re?|aubergiste|patronne de la taverne|patron de la taverne/i,
  forgeronne: /forgeronn?e?/i,
  passeuse: /passeuse|passeur|gardienne de la porte/i,
  souverain: /\b(?:le roi|la reine|sa majest[ée]|le souverain|la souveraine|l'imp[ée]ratrice|l'empereur)\b/i
};
var NON_NOMS = /* @__PURE__ */ new Set(["le", "la", "les", "un", "une", "il", "elle", "sir", "maitre", "maitresse", "dame", "guilde", "vous", "tu", "son", "sa", "ses", "au", "du", "de", "des", "et", "en", "ce", "cette", "mais", "puis", "derriere", "pres"]);
function trouverRolesUsurpes(reponse, roles, nomsConnus2) {
  const connus = new Set(nomsConnus2.map((n) => normaliser2(n)));
  const resultat = [];
  for (const role of roles) {
    const prenom = normaliser2(prenomRole(role));
    if (normaliser2(reponse).includes(prenom)) continue;
    const designation = DESIGNATIONS_ROLES[role.role];
    const m = designation.exec(reponse);
    if (!m) continue;
    const suite = reponse.slice(m.index + m[0].length, m.index + m[0].length + 120).split(/[.!?\n]/)[0];
    const candidats = [...suite.matchAll(/\b([A-ZÀ-Ý][a-zà-ÿ'-]{2,})\b/g)].map((x) => x[1]).filter((mot) => !NON_NOMS.has(normaliser2(mot)) && !connus.has(normaliser2(mot)));
    if (candidats.length) resultat.push({ role, intrus: candidats[0] });
  }
  return resultat;
}
function validerRolesCanon(reponse, roles, nomsConnus2) {
  const usurpes = trouverRolesUsurpes(reponse, roles, nomsConnus2);
  if (!usurpes.length) return rapportOk();
  return {
    ok: false,
    checks: usurpes.map(({ role, intrus }) => ({
      nom: "canon",
      ok: false,
      gravite: "grave",
      raison: `R\xF4le fix\xE9 par le lore : ${role.libelle} \xE0 ${role.ville} = ${role.nom} (${role.description.slice(0, 140)}). La r\xE9ponse donne ce r\xF4le \xE0 \xAB ${intrus} \xBB, personnage invent\xE9 : utilise ${role.nom}.`
    }))
  };
}
function distance(a, b) {
  const ligne = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let precedent = ligne[0];
    ligne[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = ligne[j];
      ligne[j] = Math.min(ligne[j] + 1, ligne[j - 1] + 1, precedent + (a[i - 1] === b[j - 1] ? 0 : 1));
      precedent = temp;
    }
  }
  return ligne[b.length];
}
function corrigerEtiquettes(reponse, nomsConnus2) {
  const cibles = [...new Set(nomsConnus2.filter((n) => n.trim().length >= 4).map((n) => n.trim().toLocaleUpperCase("fr")))];
  return reponse.replace(/^([ \t]*)([A-ZÀ-Ý][A-ZÀ-Ý' -]{2,40}?)([ \t]*:[ \t]*[«"“])/gm, (tout, debut, etiquette, fin) => {
    const nom = etiquette.trim();
    if (cibles.includes(nom)) return tout;
    let meilleure;
    let meilleurEcart = Infinity;
    for (const cible of cibles) {
      const ecart = distance(normaliser2(nom), normaliser2(cible));
      if (ecart < meilleurEcart) {
        meilleurEcart = ecart;
        meilleure = cible;
      }
    }
    return meilleure && meilleurEcart > 0 && meilleurEcart <= Math.min(3, Math.floor(nom.length / 4)) ? `${debut}${meilleure}${fin}` : tout;
  });
}
var PRONOMS_APRES_TU = /* @__PURE__ */ new Set(["te", "la", "le", "les", "lui", "leur", "en", "y", "ne", "me", "se"]);
function trouverEchoDuJoueur(reponse, messageJoueur) {
  if (!messageJoueur.trim()) return void 0;
  const premiere = normaliser2(reponse.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "").replace(/’/g, "'");
  const mots = premiere.replace(/^tu\s+/, (m) => m).split(/[\s']+/).filter(Boolean);
  if (mots[0] !== "tu" && mots[0] !== "t") return void 0;
  const verbe = mots.slice(1).find((m) => !PRONOMS_APRES_TU.has(m) && m.length > 2);
  if (!verbe) return void 0;
  const racine = verbe.slice(0, Math.min(5, Math.max(4, verbe.length - 2)));
  return normaliser2(messageJoueur).includes(racine) ? verbe : void 0;
}

// src/engine/controleOuverture.ts
var INSTRUCTION_OUVERTURE = `Tu \xE9cris LA TOUTE PREMI\xC8RE SC\xC8NE de l'histoire, avant que {{user}} n'ait dit ou fait quoi que ce soit. Cette ouverture doit imm\xE9diatement donner l'impression que le monde existait avant l'arriv\xE9e du joueur et qu'une situation est d\xE9j\xE0 en cours.

CONTRAT D'OUVERTURE OBLIGATOIRE :
1. Ancre clairement le lieu choisi et fais sentir son ambiance par quelques d\xE9tails concrets et sensoriels.
2. Mets en sc\xE8ne la situation de d\xE9part : quelque chose se passe d\xE9j\xE0. \xC9vite une introduction statique ou encyclop\xE9dique.
3. Choisis le PREMIER INTERLOCUTEUR. Si le point de d\xE9part de l'histoire (sc\xE9nario) nomme ce personnage ou contient sa r\xE9plique, c'est LUI qui parle, et sa r\xE9plique est reprise ou prolong\xE9e : n'en choisis pas un autre. Sinon, prends le plus pertinent pour cette situation. Si le lore fournit un PNJ canonique naturellement pr\xE9sent, utilise-le. Sinon, cr\xE9e uniquement un personnage local mineur coh\xE9rent (garde, marchand, voyageur, employ\xE9, habitant, etc.). N'invente jamais pour cela un nouveau royaume, souverain, grande guilde, religion ou institution majeure nomm\xE9e.
4. OBLIGATOIRE, quelle que soit la sc\xE8ne : ce personnage remarque {{user}} et l'INTERPELLE directement dans cette premi\xE8re r\xE9ponse avec au moins une vraie r\xE9plique de dialogue, au format NOM : \xAB \u2026 \xBB, qui s'adresse \xE0 lui (tu ou vous). Cette r\xE9plique arrive t\xF4t, au plus tard au deuxi\xE8me paragraphe : pas de longue description avant. Il doit avoir une raison concr\xE8te de parler : demander, avertir, provoquer, vendre, contr\xF4ler, solliciter, signaler un danger, transmettre une information ou r\xE9agir \xE0 la situation.
5. Termine \xE0 un moment o\xF9 {{user}} peut r\xE9pondre ou agir naturellement. Ne parle jamais, ne pense jamais et n'agis jamais \xE0 sa place.
6. Respecte strictement le lore pertinent fourni dans le contexte. En cas de doute sur une autorit\xE9, un souverain, une faction, une loi ou une institution, reste g\xE9n\xE9rique plut\xF4t que d'inventer un nom.
7. Int\xE8gre le lore dans la sc\xE8ne sans le r\xE9citer ni l'expliquer comme une fiche.
8. \xC9vite les ouvertures g\xE9n\xE9riques (\xAB Bienvenue, aventurier \xBB) et n'utilise pas \xAB Que faites-vous ? \xBB comme unique accroche.

Le texte final doit \xEAtre uniquement la sc\xE8ne narrative, sans titre technique, sans liste et sans explication de ces r\xE8gles.`;
function normaliser3(texte) {
  return (texte || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
function ecartsContratOuverture(texte, personnageNom) {
  const ecarts = [];
  const repliques = texte.match(/[«“"][^»”"\n]{2,}[»”"]/g) ?? [];
  const dialogues = ` ${normaliser3(repliques.join(" ")).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ")} `;
  if (!repliques.length) {
    ecarts.push("Aucun personnage n'interpelle r\xE9ellement le joueur : l'ouverture doit contenir au moins une r\xE9plique de dialogue d'un PNJ pr\xE9sent dans la sc\xE8ne.");
  } else {
    const nom = normaliser3(personnageNom);
    const interpelle = [" tu ", " vous ", " toi ", " te ", " ton ", " ta ", " tes ", " votre ", " vos ", " t'"].some((m) => dialogues.includes(m)) || !!nom && dialogues.includes(nom);
    if (!interpelle) {
      ecarts.push("La r\xE9plique existe mais ne semble pas s'adresser au joueur : le premier interlocuteur doit l'interpeller directement ou lui donner une raison imm\xE9diate de r\xE9pondre.");
    }
  }
  if (texte.trim().length < 180) {
    ecarts.push("L'ouverture est trop courte pour installer \xE0 la fois le lieu, l'ambiance, la situation active et l'interaction initiale.");
  }
  if (/(^|[.!?]\s+)(bienvenue|salutations?)(\s+(aventurier|voyageur|étranger))?/i.test(texte)) {
    ecarts.push("\xC9vite une salutation g\xE9n\xE9rique de type \xAB Bienvenue, aventurier \xBB : commence par une sc\xE8ne d\xE9j\xE0 en mouvement.");
  }
  if (!repliques.length && /(que faites-vous|qu'allez-vous faire|que vas-tu faire)\s*\??\s*$/i.test(texte.trim())) {
    ecarts.push("Ne termine pas par une simple question g\xE9n\xE9rique : cr\xE9e d'abord une interaction concr\xE8te avec un personnage de la sc\xE8ne.");
  }
  return ecarts;
}

// src/engine/noyauNarratif.ts
var MARQUEUR_ETAT = "<<<ELYNDOR_STATE_V12>>>";
var FIN_ETAT = "<<<END_ELYNDOR_STATE_V12>>>";
var MOTS_VIDES = new Set(
  "avec dans pour mais plus comme tout elle elles leur leurs nous vous cette ceci cela sans sous alors encore entre apres avant vers dont tres bien fait faire etre avait sont sera ses son sur une des les que qui aux par pas dans du de la le un une au aux en et ou a \xE0 il ils on ce ces se sa son ses ne ni car puis donc".split(/\s+/)
);
function horloge(c) {
  const jour = Math.max(0, Number(c.day) || 0);
  const minute = Math.max(0, Number(c.minute) || 0) % 1440;
  return `J${jour} ${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
var DIRECTIVE_ETAT = `[STATE DELTA V12 \u2014 MACHINE, OBLIGATOIRE]
Apres la narration, ajoute ${MARQUEUR_ETAT}, puis un JSON compact, puis ${FIN_ETAT}. Ce bloc sera masque. Seulement les faits etablis par la scene; omets les champs/listes vides; n'invente rien pour remplir. Cles: events[{type,summary,actors,targets,location,witnesses,importance(0..1),public}], stateChanges[{subject,predicate,from,to,confidence}], knowledgeTransfers[{knower,fact,source,type,confidence}], relationshipSignals[{from,to,trust,respect,fear,affection,hostility,reason}], reputationSignals[{subject,faction,delta,reason,knownByPublic}], commitments[{type,party,description,status}], narrativeDebts[{type,source,target,summary,urgency}], npcStates[{name,beliefs,desires,intentions}], timeAdvanceMinutes, scene{location,changed}. JSON strict uniquement apres le marqueur.`;

// src/engine/completionReponse.ts
var FIN_DE_PHRASE = /[.!?…]+(?:[ \u00a0\u202f]?[»"”’*)\]])*(?=\s|$)/g;
function couperALaDernierePhraseComplete(texte) {
  const source = texte.replace(/\s+$/, "");
  let fin = 0;
  for (const m of source.matchAll(FIN_DE_PHRASE)) fin = Math.max(fin, (m.index ?? 0) + m[0].length);
  const saut = source.lastIndexOf("\n");
  if (saut > fin && /[.!?…»"”*)\]]\s*$/.test(source.slice(0, saut))) fin = saut;
  const base = source.slice(0, fin).trimEnd();
  const apres = source.slice(base.length);
  const reste = apres.trim();
  const separateur = reste ? apres.slice(0, apres.length - apres.trimStart().length) || " " : "";
  return { base, separateur, reste };
}

// src/engine/canonElyndor.ts
var LORE_ELYNDOR_CANON = chargerLoreElyndor(elyndorLore_default);
var ROLES_CANON = construireRolesCanon(LORE_ELYNDOR_CANON);
var CAPITALES = [...new Set(ROLES_CANON.map((r) => r.ville))];

// src/engine/etatScene.ts
var MINUTES_MAX_PAR_TOUR = 12 * 60;
function detecterCapitale(texte, capitales) {
  if (!texte) return void 0;
  return capitales.find((c) => new RegExp(`\\b${c}\\b`, "i").test(texte));
}
function lireEtatScene(story, capitales) {
  if (story.scene) return story.scene;
  const recents = [...story.messages].reverse().map((m) => m.content);
  return {
    ville: [...recents, story.meta.contexte.lieu, story.meta.pointDeDepart].map((t) => detecterCapitale(t, capitales)).find(Boolean),
    lieu: story.meta.contexte.lieu || void 0,
    presents: [],
    majMessageIndex: 0
  };
}

// src/engine/intentionJoueur.ts
var LIEUX = [
  { type: "guilde_marchands", libelle: "Guilde des Marchands", motif: /guilde des marchands/i, roles: [], fiches: ["Guilde des Marchands"] },
  { type: "ordre_mages", libelle: "Ordre des Mages", motif: /ordre des mages|tour des mages/i, roles: [], fiches: ["Ordre des Mages"] },
  { type: "guilde_ombres", libelle: "Guilde des Ombres", motif: /guilde des ombres/i, roles: [], fiches: ["Guilde des Ombres"] },
  { type: "marche_esclaves", libelle: "March\xE9 aux Esclaves", motif: /march[ée]s? aux esclaves/i, roles: [], fiches: ["March\xE9s aux Esclaves"] },
  { type: "porte_astra", libelle: "Porte Astra", motif: /porte astra|passeuse/i, roles: ["passeuse"], fiches: ["Portes Astra", "Passeuses Astra"] },
  { type: "palais", libelle: "palais royal", motif: /\b(palais|ch[âa]teau royal|salle du tr[ôo]ne|cour royale)\b/i, roles: ["souverain"], fiches: ["Souverains"] },
  { type: "taverne", libelle: "taverne", motif: /\b(taverne|auberge|cabaret|estaminet)\b/i, roles: ["taverniere"], fiches: ["Taverni\xE8res"] },
  { type: "forge", libelle: "forge", motif: /\b(forge|forgeronn?e?|armurier|armurerie)\b/i, roles: ["forgeronne"], fiches: ["Forgeronnes"] },
  {
    type: "guilde_aventuriers",
    libelle: "comptoir de la Guilde des Aventuriers",
    motif: /\bguilde\b(?!s)|tableau des missions|comptoir des aventuriers/i,
    roles: ["maitresse_guilde", "receptionniste"],
    fiches: ["Guilde des Aventuriers", "Ma\xEEtresses de Guilde", "R\xE9ceptionnistes"]
  }
];
var MOTIFS_ROLES = [
  { role: "maitresse_guilde", motif: /ma[iî]tre(sse)? de (la )?guilde|cheffe? de (la )?guilde/i },
  { role: "receptionniste", motif: /r[ée]ceptionniste|accueil de la guilde/i },
  { role: "taverniere", motif: /taverni[èe]re?|aubergiste/i },
  { role: "forgeronne", motif: /forgeronn?e?/i },
  { role: "passeuse", motif: /passeuse|passeur/i },
  { role: "souverain", motif: /\b(roi|reine|souverain\w*|imp[ée]ratrice|empereur|sultan\w*)\b/i }
];
var VERBES_DEPLACEMENT = /\b(all(ons|er|ez|ais)|vais|vas|va|pars|partons|partir|rends|rendons|rendre|entre|entrons|entrer|retourne|retournons|retourner|dirige|dirigeons|diriger|rejoin\w*|direction|filons|rentre|rentrons|pousse la porte|m[èe]ne[- ]moi|emm[èe]ne[- ]moi|conduis[- ]moi)\b/i;
function analyserIntention(message, rolesCanon) {
  const texte = message ?? "";
  const definition = LIEUX.find((l) => l.motif.test(texte));
  const lieu = definition ? { type: definition.type, libelle: definition.libelle, roles: definition.roles, fiches: definition.fiches } : void 0;
  const roles = new Set(lieu?.roles ?? []);
  for (const { role, motif } of MOTIFS_ROLES) if (motif.test(texte)) roles.add(role);
  const pnjCites = rolesCanon.filter((r) => new RegExp(`\\b${prenomRole(r).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(texte));
  const fiches = new Set(lieu?.fiches ?? []);
  return {
    deplacement: !!lieu && VERBES_DEPLACEMENT.test(texte),
    lieu,
    roles: [...roles],
    pnjCites,
    fiches: [...fiches]
  };
}
function decrireIntention(intention) {
  if (intention.lieu) return `${intention.deplacement ? "se rendre" : "agir"} : ${intention.lieu.libelle}`;
  if (intention.pnjCites.length) return `s'adresser \xE0 ${intention.pnjCites.map((p) => p.nom).join(", ")}`;
  return void 0;
}

// src/engine/ficheScene.ts
var MAX_DESCRIPTION_ROLE = 220;
function preparerTour(story, messageJoueur) {
  const scene = lireEtatScene(story, CAPITALES);
  const intention = analyserIntention(messageJoueur, ROLES_CANON);
  const ville = detecterCapitale(messageJoueur, CAPITALES) ?? scene.ville;
  const presents = scene.presents.map((p) => p.toLowerCase());
  const roles = [
    ...rolesDeLaVille(ROLES_CANON, ville, intention.roles),
    ...intention.pnjCites,
    // Un rôle fixé déjà présent dans la scène reste listé.
    ...rolesDeLaVille(ROLES_CANON, ville).filter((r) => presents.some((p) => p.includes(prenomRole(r).toLowerCase())))
  ].filter((r, i, liste) => liste.findIndex((x) => x.nom === r.nom) === i);
  const lignes = ["[FICHE DE SC\xC8NE \u2014 fait autorit\xE9]"];
  const but = decrireIntention(intention);
  if (but) lignes.push(`Intention du joueur : ${but}.`);
  const lieux = [scene.lieu && `lieu actuel : ${scene.lieu}`, intention.deplacement && intention.lieu && `destination : ${intention.lieu.libelle}${ville ? ` de ${ville}` : ""}`].filter(Boolean).join(" \u2192 ");
  lignes.push(`Ville : ${ville ?? "inconnue"}.${lieux ? ` ${lieux.charAt(0).toUpperCase()}${lieux.slice(1)}.` : ""}`);
  if (story.narrativeCore?.clock) lignes.push(`Heure du monde : ${horloge(story.narrativeCore.clock)}.`);
  if (scene.presents.length) lignes.push(`Pr\xE9sents : ${scene.presents.join(", ")}.`);
  if (roles.length) {
    lignes.push("R\xF4les fix\xE9s par le lore pour cette sc\xE8ne (utilise ces personnages, ne les remplace jamais par un invent\xE9) :");
    for (const r of roles) {
      const description = r.description.length > MAX_DESCRIPTION_ROLE ? `${r.description.slice(0, MAX_DESCRIPTION_ROLE - 1)}\u2026` : r.description;
      lignes.push(`- ${r.libelle} (${r.ville}) : ${r.nom} \u2014 ${description}`);
    }
  }
  const engagements = story.social.engagements.filter((e) => !e.honore && !e.rompu).slice(-3);
  if (engagements.length) {
    lignes.push("Engagements en cours :");
    for (const e of engagements) lignes.push(`- ${e.partie} : ${e.description}`);
  }
  return { intention, ville, roles, fiche: lignes.join("\n") };
}

// tools/fabrique/fabrique.ts
var executer = (0, import_node_util.promisify)(import_node_child_process.execFile);
var URL_POD = process.env.FABRIQUE_URL ?? "https://ot7y2dg831r3i3-8000.proxy.runpod.net";
var MODELE = "euryale-70b-v2.3";
var CONFIG_ELEVE = { budgetSysteme: 24e3, budgetConversation: 9e3, metamoteurs: false };
var CONFIG_PROFESSEUR = { budgetSysteme: 64e3, budgetConversation: 13e3 };
var CONSIGNE_PROFESSEUR = "\n\n(Narration : ne reformule pas ce que je viens de faire ou dire ; commence directement par les r\xE9actions des autres personnages et les cons\xE9quences.)";
var PAUSE_APRES_ACTIVITE_MS = Number(process.env.FABRIQUE_PAUSE_MIN ?? 15) * 60 * 1e3;
var TOURS_MIN = 14;
var TOURS_MAX = 28;
var RESUME_TOUS_LES = 6;
function chargerMondes(dossier = process.env.FABRIQUE_MONDES ?? import_node_path.default.join(__dirname, "..", "..", "..", "tools", "fabrique", "mondes")) {
  return import_node_fs.default.readdirSync(dossier).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(import_node_fs.default.readFileSync(import_node_path.default.join(dossier, f), "utf8")));
}
var LORE_ELYNDOR = chargerLoreElyndor(elyndorLore_default);
var METAMOTEURS = chargerMetamoteurs(metamoteurs_default);
function entreesDuMonde(monde) {
  if (monde.id === "elyndor") return LORE_ELYNDOR;
  return monde.entrees.map((e, i) => ({ id: `${monde.id}-${i}`, titre: e.titre, contenu: e.contenu, motsClesNegatifs: [], priority: 0, constant: false }));
}
var cachePassages = /* @__PURE__ */ new Map();
function passagesDuMonde(monde) {
  if (!cachePassages.has(monde.id)) cachePassages.set(monde.id, construirePassages(entreesDuMonde(monde)));
  return cachePassages.get(monde.id);
}
function metamoteursPour(monde) {
  return METAMOTEURS.map((e) => ({
    id: e.id,
    titre: e.titre,
    contenu: monde.id === "elyndor" ? e.contenu : e.contenu.replace(/d['’]Elyndor/g, "du monde").replace(/Elyndor/g, "le monde")
  }));
}
var graine = Number(process.env.FABRIQUE_GRAINE ?? Date.now() % 2147483647);
function hasard() {
  graine = graine * 48271 % 2147483647;
  return graine / 2147483647;
}
function choisir(liste) {
  return liste[Math.floor(hasard() * liste.length)];
}
var STYLES_JOUEUR = [
  "laconique : phrases tr\xE8s courtes, actions directes, peu de mots",
  "bavard et expressif : longues r\xE9pliques entre guillemets, beaucoup de dialogue",
  "impulsif et violent : provoque, menace, passe vite \xE0 l\u2019action physique",
  "s\xE9ducteur : drague, sous-entendus, cherche le contact et l\u2019intimit\xE9 (contenu adulte permis)",
  "strat\xE8ge : pose des questions pr\xE9cises, n\xE9gocie, observe avant d\u2019agir",
  "explorateur curieux : fouille les lieux, examine les objets, s\u2019int\xE9resse au lore",
  "n\xE9gociateur retors : marchande, ment, cherche son avantage",
  "humour noir : r\xE9plique avec ironie et sarcasme, mais agit s\xE9rieusement",
  "meneur : donne des ordres, prend des d\xE9cisions, entra\xEEne les autres",
  "prudent et m\xE9fiant : v\xE9rifie tout, refuse les propositions trop belles"
];
function reglagesAleatoires() {
  return {
    creativite: choisir(["moyenne", "moyenne", "elevee", "faible"]),
    longueur: choisir(["moyenne", "moyenne", "longue", "courte"]),
    ton: choisir(["sombre_realiste", "sombre_realiste", "mysterieux_intrigant", "heroique_epique", "leger_aventureux"]),
    violence: choisir(["modere", "eleve", "extreme"]),
    romance: choisir(["moyen", "eleve", "faible"]),
    humour: choisir(["faible", "moyen"]),
    liberteJoueur: "elevee",
    rythme: choisir(["normal", "normal", "lent", "rapide"])
  };
}
var dernierEtrangerMs = 0;
var enAppel = false;
async function curlJson(url, corps, delaiS = 300) {
  const args = ["-s", "-m", String(delaiS), url];
  let fichier;
  if (corps !== void 0) {
    fichier = import_node_path.default.join(process.env.FABRIQUE_TMP ?? "/tmp", `req-${process.pid}-${Date.now()}.json`);
    import_node_fs.default.writeFileSync(fichier, JSON.stringify(corps));
    args.push("-H", "Content-Type: application/json", "-d", `@${fichier}`);
  }
  try {
    const { stdout } = await executer("curl", args, { maxBuffer: 64 * 1024 * 1024 });
    return url.endsWith("/metrics") ? stdout : JSON.parse(stdout);
  } finally {
    if (fichier) import_node_fs.default.rmSync(fichier, { force: true });
  }
}
async function sonderActivite() {
  try {
    if (!enAppel) {
      const slots = await curlJson(`${URL_POD}/slots`, void 0, 15);
      if (Array.isArray(slots) && slots.some((s) => s.is_processing)) dernierEtrangerMs = Date.now();
    }
    const metriques = await curlJson(`${URL_POD}/metrics`, void 0, 15);
    const differees = Number(metriques.match(/llamacpp:requests_deferred\s+(\d+)/)?.[1] ?? 0);
    if (differees > 0) dernierEtrangerMs = Date.now();
  } catch {
  }
}
async function attendre(ms) {
  await new Promise((r) => setTimeout(r, ms));
}
async function attendreLibre(journal) {
  await sonderActivite();
  let annonce = false;
  while (Date.now() - dernierEtrangerMs < PAUSE_APRES_ACTIVITE_MS) {
    if (!annonce) journal("pause : le pod est utilis\xE9 par l\u2019application");
    annonce = true;
    await attendre(2e4);
    await sonderActivite();
  }
  if (annonce) journal("reprise : plus d\u2019activit\xE9 sur le pod");
}
var surveillance;
async function appeler(appel, journal) {
  for (let essai = 0; essai < 4; essai++) {
    await attendreLibre(journal);
    enAppel = true;
    try {
      const r = await curlJson(`${URL_POD}/v1/chat/completions`, {
        model: MODELE,
        messages: appel.messages,
        temperature: appel.temperature,
        max_tokens: appel.maxTokens
      }, 400);
      const choix = r?.choices?.[0];
      if (!choix?.message) throw new Error(JSON.stringify(r).slice(0, 300));
      return { texte: String(choix.message.content ?? ""), coupe: choix.finish_reason === "length" };
    } catch (e) {
      journal(`appel en \xE9chec (${essai + 1}/4) : ${e instanceof Error ? e.message.slice(0, 200) : e}`);
      await attendre(3e4 * (essai + 1));
    } finally {
      enAppel = false;
    }
  }
  throw new Error("pod injoignable");
}
var RE_REFUS = /^(je suis désolé|je ne peux pas|désolé,|en tant qu['’](ia|assistant)|i('| a)m sorry|i cannot|i can['’]t)/i;
function controlerReponse(reponse, contexte2) {
  const echecs = [];
  const texte = reponse.trim();
  if (RE_REFUS.test(texte)) echecs.push("refus du mod\xE8le");
  if (texte.length < 300) echecs.push("r\xE9ponse trop courte");
  if (/\[(FICHE|PROTOCOLE|RAPPEL|STATE|ÉTAT)|```|\{\s*"/.test(texte)) echecs.push("fuite de consigne ou bloc machine");
  const guillemets = (texte.match(/«/g) ?? []).length;
  if (guillemets && !/^[ \t]*[A-ZÀ-Ý][A-ZÀ-Ý0-9' .-]{1,40}[ \t]*:[ \t]*«/m.test(texte)) echecs.push("r\xE9pliques sans \xE9tiquette NOM : \xAB \xBB");
  const raisons = (r) => r.checks.filter((c) => !c.ok).map((c) => c.raison);
  echecs.push(...raisons(validerAgentiviteHeuristique(texte, contexte2.personnageNom)));
  echecs.push(...raisons(validerGestesDuJoueur(texte, contexte2.messageJoueur, contexte2.personnageNom)));
  const echo = contexte2.ouverture ? void 0 : trouverEchoDuJoueur(texte, contexte2.messageJoueur);
  if (echo) echecs.push(`La r\xE9ponse commence par reformuler l'action du joueur (\xAB tu ${echo}\u2026 \xBB) : encha\xEEne directement sur les r\xE9actions des autres et les cons\xE9quences.`);
  if (/^[ \t]*[A-ZÀ-Ý][A-ZÀ-Ý' .-]{1,40}\([^)]*\)[ \t]*:/m.test(texte)) echecs.push("\xE9tiquette de r\xE9plique avec parenth\xE8ses");
  if (contexte2.monde.id === "elyndor" && contexte2.ville) {
    echecs.push(...raisons(validerRolesCanon(texte, rolesDeLaVille(ROLES_CANON, contexte2.ville), contexte2.nomsConnus)));
  }
  if (contexte2.ouverture) echecs.push(...ecartsContratOuverture(texte, contexte2.personnageNom));
  if (contexte2.precedente) {
    const phrases = (t) => t.split(/(?<=[.!?»])\s+/).map((p) => p.trim().toLowerCase()).filter((p) => p.length > 25);
    const avant = new Set(phrases(contexte2.precedente));
    const maintenant = phrases(texte);
    if (maintenant.length && maintenant.filter((p) => avant.has(p)).length / maintenant.length > 0.25) echecs.push("r\xE9p\xE9tition de la r\xE9ponse pr\xE9c\xE9dente");
  }
  return [...new Set(echecs)];
}
function storyPour(partie, monde) {
  return {
    meta: {
      id: partie.id,
      personnageNom: partie.personnage.nom,
      personnageDescription: partie.personnage.description,
      pointDeDepart: partie.depart.pointDeDepart,
      contexte: { lieu: partie.depart.lieu, ambiance: partie.depart.ambiance, dateChronique: "", objectifs: "" },
      createdAt: 0,
      updatedAt: 0
    },
    messages: partie.messages,
    social: { engagements: [] },
    loreEmergent: [],
    memoire: { resume: partie.resume, faits: [] },
    monde: monde.nom
  };
}
function contexte(partie, monde, messageJoueur, eleve, ouverture, noteCorrection) {
  const story = storyPour(partie, monde);
  const passages = passagesDuMonde(monde);
  const derniere = [...partie.messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const preparation = monde.id === "elyndor" ? preparerTour(story, ouverture ? `${partie.depart.lieu}
${partie.depart.pointDeDepart}` : messageJoueur) : void 0;
  const requeteScene = [preparation?.ville && `Ville : ${preparation.ville}`, partie.depart.lieu, partie.resume, derniere].filter(Boolean).join("\n");
  const requeteMessage = ouverture ? `${partie.depart.lieu}
${partie.depart.pointDeDepart}` : messageJoueur;
  const entrees = entreesDuMonde(monde);
  const texteScene = [partie.depart.pointDeDepart, ...partie.messages.slice(-3).map((m) => m.content), messageJoueur].join("\n").toLowerCase();
  const ancres = new Set(entrees.filter((e) => preparation?.intention.fiches.some((f) => e.titre.includes(f)) || monde.id !== "elyndor" && /^PNJ — /.test(e.titre) && texteScene.includes(e.titre.replace(/^PNJ — /, "").split(/\s+/)[0].toLowerCase())).map((e) => e.id));
  const loreRetenu = selectionnerPassages(passages, requeteScene, { requeteMessage, ancres, aleatoire: false });
  return {
    meta: story.meta,
    settings: partie.settings,
    resume: partie.resume,
    faits: [],
    metamoteursSelectionnes: eleve ? [] : metamoteursPour(monde),
    loreElyndor: loreRetenu,
    messagesRecents: partie.messages,
    messageJoueur: ouverture ? INSTRUCTION_OUVERTURE : eleve ? messageJoueur : `${messageJoueur}${CONSIGNE_PROFESSEUR}`,
    registreAdulte: instructionRegistreAdulte(partie.settings),
    noteCorrection,
    ficheScene: preparation?.fiche,
    loreCore: monde.core ?? void 0,
    titreLore: monde.id === "elyndor" ? void 0 : `LORE ${monde.nom.toUpperCase()} PERTINENT`
  };
}
function nomsConnus(partie, monde) {
  return [
    partie.personnage.nom,
    ...monde.personnages.map((p) => p.nom),
    ...monde.entrees.map((e) => e.titre.replace(/^PNJ — /, "")),
    ...monde.id === "elyndor" ? ROLES_CANON.flatMap((r) => [r.nom, prenomRole(r)]) : []
  ];
}
async function narrer(partie, monde, messageJoueur, ouverture, journal) {
  const temperature = temperaturePourCreativite(partie.settings.creativite);
  const maxTokens = maxTokensPourLongueur(partie.settings.longueur) + (ouverture ? 300 : 0);
  const precedente = [...partie.messages].reverse().find((m) => m.role === "assistant")?.content;
  const ville = monde.id === "elyndor" ? preparerTour(storyPour(partie, monde), messageJoueur || partie.depart.pointDeDepart).ville : void 0;
  const noms = nomsConnus(partie, monde);
  const tenter = async (note) => {
    const sortie = await appeler({
      messages: construireMessages(contexte(partie, monde, messageJoueur, false, ouverture, note), CONFIG_PROFESSEUR),
      temperature,
      maxTokens
    }, journal);
    let texte = sortie.texte.trim();
    if (sortie.coupe) texte = couperALaDernierePhraseComplete(texte).base.trim();
    texte = corrigerEtiquettes(texte.replace(/^([ \t]*[A-ZÀ-Ý][A-ZÀ-Ý' .-]{1,40}?)[ \t]*\((?:suite|continue|cont\.)\)/gim, "$1"), noms);
    return { texte, echecs: controlerReponse(texte, { messageJoueur: ouverture ? partie.depart.pointDeDepart : messageJoueur, personnageNom: partie.personnage.nom, precedente, monde, ville, nomsConnus: noms, ouverture }) };
  };
  let essai = await tenter();
  let corrige = false;
  if (essai.echecs.length) {
    const note = `La tentative pr\xE9c\xE9dente a \xE9t\xE9 rejet\xE9e pour la ou les raisons suivantes : ${essai.echecs.join(" ")} Corrige ces points dans ta nouvelle r\xE9ponse, sans les mentionner explicitement au joueur.`;
    const second = await tenter(note);
    if (second.echecs.length < essai.echecs.length || !second.echecs.length) {
      essai = second;
      corrige = true;
    }
  }
  return {
    tour: partie.messages.filter((m) => m.role === "user").length,
    type: ouverture ? "ouverture" : "tour",
    messages: construireMessages(contexte(partie, monde, messageJoueur, true, ouverture), CONFIG_ELEVE),
    reponse: essai.texte,
    ok: !essai.echecs.length,
    echecs: essai.echecs,
    corrige
  };
}
async function jouerJoueur(partie, journal) {
  const transcript = partie.messages.slice(-6).map((m) => `${m.role === "user" ? partie.personnage.nom.toUpperCase() : "NARRATEUR"} : ${m.content.slice(0, 1800)}`).join("\n\n");
  const sortie = await appeler({
    temperature: 1,
    maxTokens: 220,
    messages: [
      {
        role: "system",
        content: `Tu joues le personnage du joueur dans un jeu de r\xF4le textuel pour adultes. Personnage : ${partie.personnage.nom} \u2014 ${partie.personnage.description}
Style de ce joueur : ${partie.styleJoueur}.
\xC9cris UNIQUEMENT le prochain message du joueur, \xE0 la premi\xE8re personne : ce que ${partie.personnage.nom} fait et/ou dit, en 1 \xE0 3 phrases, souvent une ou deux seulement (parfois une seule ligne courte). Les paroles vont entre guillemets \xAB \xBB.
Tu ne d\xE9cris jamais les r\xE9actions des autres personnages ni l'issue de tes actions : c'est le narrateur qui les raconte.
R\xE9agis \xE0 ce qui vient de se passer, prends des initiatives, fais avancer l'histoire. Contenu adulte permis (violence, sexe entre adultes consentants). Pas de titre, pas de nom en t\xEAte, pas de commentaire.`
      },
      { role: "user", content: `Derniers \xE9changes :

${transcript}

Prochain message de ${partie.personnage.nom} :` }
    ]
  }, journal);
  return sortie.texte.trim().replace(new RegExp(`^${partie.personnage.nom.toUpperCase()}\\s*:\\s*`), "").replace(/^["“]|["”]$/g, "").split("\n\n")[0].slice(0, 900);
}
async function resumer(partie, journal) {
  const transcript = partie.messages.slice(-14).map((m) => `${m.role === "user" ? partie.personnage.nom : "Narrateur"} : ${m.content.slice(0, 1200)}`).join("\n");
  const sortie = await appeler({
    temperature: 0.3,
    maxTokens: 450,
    messages: [
      { role: "system", content: "Tu tiens la m\xE9moire d'un jeu de r\xF4le. Mets \xE0 jour le r\xE9sum\xE9 de l'histoire en 10 phrases au plus : lieux, personnages rencontr\xE9s (noms exacts), \xE9v\xE9nements, engagements pris, \xE9tat des relations. Faits \xE9tablis uniquement, rien d'invent\xE9. R\xE9ponds uniquement par le r\xE9sum\xE9." },
      { role: "user", content: `R\xE9sum\xE9 pr\xE9c\xE9dent :
${partie.resume || "Aucun."}

Derniers \xE9changes :
${transcript}` }
    ]
  }, journal);
  return sortie.texte.trim().slice(0, 2500);
}
function nouvellePartie(mondes, index) {
  const monde = mondes[index % mondes.length];
  const depart = choisir(monde.departs);
  return {
    id: `${monde.id}-${Date.now().toString(36)}-${index}`,
    monde: monde.id,
    personnage: choisir(monde.personnages),
    depart,
    settings: reglagesAleatoires(),
    styleJoueur: choisir(STYLES_JOUEUR),
    toursPrevus: TOURS_MIN + Math.floor(hasard() * (TOURS_MAX - TOURS_MIN + 1)),
    resume: "",
    messages: [],
    echantillons: [],
    terminee: false
  };
}
function idMessage() {
  return `m-${Date.now().toString(36)}-${Math.floor(hasard() * 1e6)}`;
}
async function avancerPartie(partie, monde, fichier, journal, finMs) {
  const sauver = () => import_node_fs.default.writeFileSync(fichier, JSON.stringify(partie));
  if (!partie.messages.length) {
    const ech = await narrer(partie, monde, "", true, journal);
    partie.echantillons.push(ech);
    partie.messages.push({ id: idMessage(), role: "assistant", content: ech.reponse, timestamp: Date.now() });
    journal(`${partie.id} ouverture ${ech.ok ? "OK" : `KO (${ech.echecs.join(" | ").slice(0, 160)})`}`);
    sauver();
  }
  while (partie.messages.filter((m) => m.role === "user").length < partie.toursPrevus) {
    if (Date.now() > finMs) return;
    const tour = partie.messages.filter((m) => m.role === "user").length + 1;
    if (tour > 1 && tour % RESUME_TOUS_LES === 0) partie.resume = await resumer(partie, journal);
    const messageJoueur = await jouerJoueur(partie, journal);
    if (!messageJoueur) continue;
    const ech = await narrer(partie, monde, messageJoueur, false, journal);
    partie.echantillons.push(ech);
    partie.messages.push({ id: idMessage(), role: "user", content: messageJoueur, timestamp: Date.now() });
    partie.messages.push({ id: idMessage(), role: "assistant", content: ech.reponse, timestamp: Date.now() });
    journal(`${partie.id} tour ${tour}/${partie.toursPrevus} ${ech.ok ? "OK" : `KO (${ech.echecs.join(" | ").slice(0, 160)})`}${ech.corrige ? " [corrig\xE9]" : ""}`);
    sauver();
  }
  partie.terminee = true;
  sauver();
}
async function main() {
  const [dossier = "fabrique-sortie", nbTexte = "40", dureeTexte = "600"] = process.argv.slice(2);
  const nbParties = Number(nbTexte);
  const finMs = Date.now() + Number(dureeTexte) * 60 * 1e3;
  import_node_fs.default.mkdirSync(import_node_path.default.join(dossier, "parties"), { recursive: true });
  const journalFichier = import_node_path.default.join(dossier, "journal.txt");
  const journal = (m) => {
    const ligne = `${(/* @__PURE__ */ new Date()).toISOString()} ${m}`;
    import_node_fs.default.appendFileSync(journalFichier, `${ligne}
`);
    console.log(ligne);
  };
  const mondes = chargerMondes();
  const parMonde = new Map(mondes.map((m) => [m.id, m]));
  surveillance = setInterval(() => {
    void sonderActivite();
  }, 1e4);
  const fichiers = () => import_node_fs.default.readdirSync(import_node_path.default.join(dossier, "parties")).filter((f) => f.endsWith(".json"));
  let index = fichiers().length;
  try {
    for (const f of fichiers()) {
      const partie = JSON.parse(import_node_fs.default.readFileSync(import_node_path.default.join(dossier, "parties", f), "utf8"));
      if (!partie.terminee) await avancerPartie(partie, parMonde.get(partie.monde), import_node_path.default.join(dossier, "parties", f), journal, finMs);
      if (Date.now() > finMs) break;
    }
    while (fichiers().length < nbParties && Date.now() < finMs) {
      const partie = nouvellePartie(mondes, index++);
      const fichier = import_node_path.default.join(dossier, "parties", `${partie.id}.json`);
      journal(`nouvelle partie ${partie.id} \u2014 ${partie.personnage.nom} \u2014 ${partie.depart.lieu} \u2014 ${partie.styleJoueur.split(" :")[0]}`);
      await avancerPartie(partie, parMonde.get(partie.monde), fichier, journal, finMs);
    }
  } finally {
    clearInterval(surveillance);
  }
  journal("fin de la fabrication");
}
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIG_ELEVE,
  URL_POD,
  chargerMondes,
  controlerReponse,
  main
});
