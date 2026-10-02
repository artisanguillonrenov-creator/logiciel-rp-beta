const fs = require('fs');

const lorePath = 'src/data/elyndorLore.json';
const reportPath = 'docs/v3/STEP9_RELATIONS_ROYAUMES_V3.md';
const data = JSON.parse(fs.readFileSync(lorePath, 'utf8'));

if (data.entry_count !== 256 || data.entries.length !== 256) {
  throw new Error(`Base Step 8 attendue à 256 entrées, trouvé ${data.entry_count}/${data.entries.length}`);
}
if (data.entries.some((e) => e.category === 'RELATION_ROYAUME')) {
  throw new Error('Des entrées RELATION_ROYAUME existent déjà : migration refusée.');
}

const originalEntries = JSON.stringify(data.entries);
const existingIds = new Set(data.entries.map((e) => e.id));
for (let id = 102; id <= 117; id++) {
  if (existingIds.has(id)) throw new Error(`UID réservé déjà utilisé : ${id}`);
}

const relations = [
  {
    id: 272,
    pair: 'PARIS_TOKYO',
    title: 'Paris ↔ Tokyo — Rivalité commerciale et Portes Astra',
    keys: ['Paris Tokyo', 'Tokyo Paris', 'rivalité commerciale Paris Tokyo', 'Portes Astra Paris Tokyo', 'diplomatie Paris Tokyo'],
    content: `INTÉRÊT COMMUN : maintenir ouverts les échanges de prestige et les liaisons Astra entre deux grands centres de pouvoir.\n\nCONFLIT : rivalité commerciale et compétition autour de l’influence liée aux Portes Astra.\n\nDÉPENDANCE : échanges inter-capitales et circulation par les Portes ; aucune des deux puissances n’a intérêt à une rupture totale.\n\nPEUR : qu’un incident commercial, un acte d’espionnage ou un sabotage Astra transforme la rivalité en crise ouverte.\n\nRESSOURCE STRATÉGIQUE : Portes Astra, routes commerciales, artisanat de luxe parisien et artefacts magiques de Tokyo.\n\nDETTE : aucune dette bilatérale formelle n’est établie dans le canon actuel.\n\nLIGNE ROUGE : sabotage direct d’une Porte majeure.\n\nÉTAT DIPLOMATIQUE : rivalité commerciale active ; espionnage élevé ; guerre ouverte indésirable.\n\nCONSÉQUENCES NARRATIVES : contrôles, soupçons, contrats concurrents et pressions diplomatiques augmentent avec chaque incident ; toute escalade militaire doit être jouée et préparée.`
  },
  {
    id: 273,
    pair: 'TOKYO_DELHI',
    title: 'Tokyo ↔ Delhi — Frontière elfique contestée',
    keys: ['Tokyo Delhi', 'Delhi Tokyo', 'frontière Tokyo Delhi', 'rivalité elfique', 'diplomatie Tokyo Delhi'],
    content: `INTÉRÊT COMMUN : empêcher les incidents frontaliers de devenir une guerre générale entre deux puissances elfiques.\n\nCONFLIT : mépris mutuel, frontière contestée et captures régulières de soldats des deux côtés.\n\nDÉPENDANCE : aucune dépendance économique bilatérale forte n’est explicitement établie ; la stabilité de la frontière impose néanmoins des contacts et des arbitrages.\n\nPEUR : spirale de représailles après capture, exécution ou incursion majeure.\n\nRESSOURCE STRATÉGIQUE : contrôle des passages frontaliers, forces militaires d’élite et accès sécurisé aux routes régionales.\n\nDETTE : aucune dette bilatérale canonique établie.\n\nLIGNE ROUGE : aucune ligne rouge diplomatique formalisée dans le canon ; une incursion militaire majeure briserait l’équilibre actuel.\n\nÉTAT DIPLOMATIQUE : hostilité contenue, incidents réguliers, pas de guerre ouverte.\n\nCONSÉQUENCES NARRATIVES : prisonniers, patrouilles, escortes et incidents de frontière peuvent créer des missions, représailles ou négociations.`
  },
  {
    id: 274,
    pair: 'TOKYO_LAGOS',
    title: 'Tokyo ↔ Lagos — Rancune des Voiles',
    keys: ['Tokyo Lagos', 'Lagos Tokyo', 'Voiles Tokyo Lagos', 'hostilité Tokyo Lagos', 'diplomatie Tokyo Lagos'],
    content: `INTÉRÊT COMMUN : éviter qu’une crise autour des Voiles ne déstabilise les Portes Astra et les échanges mondiaux.\n\nCONFLIT : Tokyo nourrit une rancune liée aux Voiles ; Lagos subit une surveillance internationale et rejette la culpabilité collective qui lui est imputée.\n\nDÉPENDANCE : aucune dépendance bilatérale majeure n’est établie ; les deux restent reliées au même système Astra mondial.\n\nPEUR : reprise visible d’activités liées aux Voiles, accusation publique ou action préventive mal interprétée.\n\nRESSOURCE STRATÉGIQUE : informations sur les Voiles, surveillance des Portes et savoirs rares de Lagos.\n\nDETTE : aucune dette bilatérale canonique établie.\n\nLIGNE ROUGE : aucune ligne rouge formalisée ; toute action directe autour d’une ouverture des Voiles constitue le cœur évident du risque diplomatique.\n\nÉTAT DIPLOMATIQUE : hostilité latente et méfiance durable.\n\nCONSÉQUENCES NARRATIVES : inspections, filatures, refus de coopération et soupçons peuvent s’intensifier sans devenir automatiquement une guerre.`
  },
  {
    id: 275,
    pair: 'OSLO_ISTANBUL',
    title: 'Oslo ↔ Istanbul — Alliance commerciale',
    keys: ['Oslo Istanbul', 'Istanbul Oslo', 'alliance commerciale Oslo Istanbul', 'commerce Oslo Istanbul', 'diplomatie Oslo Istanbul'],
    content: `INTÉRÊT COMMUN : commerce maritime et caravanier stable, circulation de marchandises et sécurité des routes.\n\nCONFLIT : aucun conflit bilatéral majeur n’est explicitement établi dans le canon actuel.\n\nDÉPENDANCE : Oslo apporte navires, fourrures et capacité maritime ; Istanbul apporte marchés, réseaux de caravanes et redistribution mondiale.\n\nPEUR : rupture des routes ou incident qui rendrait l’alliance commercialement coûteuse.\n\nRESSOURCE STRATÉGIQUE : flotte d’Oslo, Grand Bazar, routes commerciales et réseau de la Guilde des Marchands.\n\nDETTE : aucune dette bilatérale formelle n’est établie.\n\nLIGNE ROUGE : aucune ligne rouge spécifique n’est canonisée.\n\nÉTAT DIPLOMATIQUE : alliance commerciale solide.\n\nCONSÉQUENCES NARRATIVES : une crise commerciale affecte convois, prix, contrats et disponibilité de certaines marchandises dans les deux capitales.`
  },
  {
    id: 276,
    pair: 'ISTANBUL_ZURICH',
    title: 'Istanbul ↔ Zurich — Routes montagneuses disputées',
    keys: ['Istanbul Zurich', 'Zurich Istanbul', 'routes montagneuses', 'commerce Istanbul Zurich', 'diplomatie Istanbul Zurich'],
    content: `INTÉRÊT COMMUN : maintenir les flux commerciaux à travers l’Europe et les axes alpins sans interrompre le crédit ni les caravanes.\n\nCONFLIT : contrôle et conditions d’usage des routes montagneuses disputées depuis longtemps.\n\nDÉPENDANCE : Istanbul dépend des routes et du crédit pour certains flux ; Zurich profite du commerce, des lettres de crédit et du passage par ses infrastructures.\n\nPEUR : blocage durable des routes, défaut de paiement ou guerre commerciale qui pénaliserait les deux économies.\n\nRESSOURCE STRATÉGIQUE : routes alpines, tunnels, crédit nain et grands contrats marchands.\n\nDETTE : aucune dette bilatérale précise n’est établie ; Zurich conserve toutefois une culture de dette transgénérationnelle.\n\nLIGNE ROUGE : aucune ligne rouge bilatérale explicite n’est canonisée.\n\nÉTAT DIPLOMATIQUE : négociation compétitive et dispute commerciale séculaire, sans guerre ouverte.\n\nCONSÉQUENCES NARRATIVES : péages, retards, arbitrages, contrats concurrents ou blocages peuvent affecter directement caravanes et missions.`
  },
  {
    id: 277,
    pair: 'JOHANNESBURG_BOGOTA',
    title: 'Johannesburg ↔ Bogotá — Respect ancien',
    keys: ['Johannesburg Bogotá', 'Bogotá Johannesburg', 'respect ancien', 'alliance Johannesburg Bogotá', 'diplomatie Johannesburg Bogotá'],
    content: `INTÉRÊT COMMUN : préserver une relation fondée sur le respect, l’autonomie des peuples et le refus de l’esclavage sur leurs territoires.\n\nCONFLIT : aucun conflit bilatéral majeur n’est établi dans le canon actuel.\n\nDÉPENDANCE : aucune dépendance économique structurante n’est explicitement canonisée.\n\nPEUR : qu’une pression extérieure, une exploitation abusive ou un incident impliquant des captifs force l’un des deux à choisir entre neutralité et solidarité.\n\nRESSOURCE STRATÉGIQUE : minerais et arbitrage de Johannesburg ; plantes médicinales, guides et savoirs spirituels de Bogotá.\n\nDETTE : aucune dette bilatérale formelle n’est établie.\n\nLIGNE ROUGE : aucune ligne rouge diplomatique explicite n’est canonisée ; l’asservissement sur leurs sols est incompatible avec leurs règles locales.\n\nÉTAT DIPLOMATIQUE : respect ancien et relation favorable.\n\nCONSÉQUENCES NARRATIVES : entraide, arbitrage ou soutien ponctuel sont plausibles, mais ne doivent pas devenir automatiquement une alliance militaire.`
  },
  {
    id: 278,
    pair: 'MEXICO_NEW_YORK',
    title: 'Mexico ↔ New York — Rivalité frontalière',
    keys: ['Mexico New York', 'New York Mexico', 'frontière Mexico New York', 'rivalité frontalière', 'diplomatie Mexico New York'],
    content: `INTÉRÊT COMMUN : empêcher les incidents de frontière de dégénérer en guerre ouverte et préserver les passages utiles aux populations et aux contrats.\n\nCONFLIT : incidents frontaliers permanents et rivalité quasi sportive qui dégénère régulièrement.\n\nDÉPENDANCE : aucune dépendance économique forte n’est explicitement établie ; la proximité géographique impose cependant une gestion constante des frontières.\n\nPEUR : mort d’une figure importante, raid mal attribué ou série de représailles incontrôlées.\n\nRESSOURCE STRATÉGIQUE : zones frontalières, pistes, réseaux de chasseurs et contrats de mercenariat.\n\nDETTE : aucune dette bilatérale canonique établie.\n\nLIGNE ROUGE : aucune ligne rouge formelle n’est documentée ; l’escalade doit rester graduelle avant toute guerre ouverte.\n\nÉTAT DIPLOMATIQUE : rivalité tendue avec incidents récurrents.\n\nCONSÉQUENCES NARRATIVES : contrôles, primes, poursuites, accusations et représailles locales peuvent évoluer selon les événements joués.`
  },
  {
    id: 279,
    pair: 'NEW_YORK_BOGOTA',
    title: 'New York ↔ Bogotá — Alliance instinctive',
    keys: ['New York Bogotá', 'Bogotá New York', 'alliance New York Bogotá', 'Hommes-Bêtes Bogotá', 'diplomatie New York Bogotá'],
    content: `INTÉRÊT COMMUN : coopération entre sociétés proches de la nature, circulation de guides, pisteurs et informations de terrain.\n\nCONFLIT : aucun conflit bilatéral important n’est établi dans le canon actuel.\n\nDÉPENDANCE : aucune dépendance institutionnelle forte n’est canonisée ; la relation est décrite comme instinctivement favorable plutôt que contractuelle.\n\nPEUR : qu’une puissance extérieure exploite ou rompe cette proximité par manipulation, trafic ou atteinte aux territoires naturels.\n\nRESSOURCE STRATÉGIQUE : réseaux de pisteurs de New York, guides de jungle et savoirs naturels de Bogotá.\n\nDETTE : aucune dette bilatérale formelle n’est établie.\n\nLIGNE ROUGE : aucune ligne rouge diplomatique explicite n’est canonisée.\n\nÉTAT DIPLOMATIQUE : alliance instinctive et confiance favorable.\n\nCONSÉQUENCES NARRATIVES : entraide locale, partage d’informations et missions conjointes peuvent émerger, sans transformer automatiquement la relation en traité formel.`
  },
  {
    id: 280,
    pair: 'SYDNEY_AUCKLAND',
    title: 'Sydney ↔ Auckland — Alliance maritime et rivalité de prestige',
    keys: ['Sydney Auckland', 'Auckland Sydney', 'alliance maritime', 'contrôle des mers', 'diplomatie Sydney Auckland'],
    content: `INTÉRÊT COMMUN : contrôle stable des routes maritimes du Pacifique et sécurité des passages océaniques.\n\nCONFLIT : rivalité de prestige entre deux puissances marines alliées.\n\nDÉPENDANCE : contrôle conjoint des mers ; la stabilité maritime repose sur leur coopération.\n\nPEUR : qu’une compétition symbolique ou une décision unilatérale fragilise l’alliance et les routes maritimes.\n\nRESSOURCE STRATÉGIQUE : routes océaniques, ports, savoirs des profondeurs et capacité de contrôle maritime.\n\nDETTE : aucune dette bilatérale formelle n’est établie.\n\nLIGNE ROUGE : aucune ligne rouge spécifique n’est canonisée ; rompre le contrôle conjoint des mers constituerait un changement majeur à jouer explicitement.\n\nÉTAT DIPLOMATIQUE : alliance solide avec rivalité de prestige.\n\nCONSÉQUENCES NARRATIVES : accès maritime, sauvetages, péages, navigation et coopération navale reflètent l’état de cette relation.`
  }
];

for (const r of relations) {
  if (existingIds.has(r.id)) throw new Error(`UID déjà utilisé : ${r.id}`);
  data.entries.push({
    id: r.id,
    category: 'RELATION_ROYAUME',
    title: `[RELATION][${r.pair}] ${r.title}`,
    primary_keys: r.keys,
    secondary_keys: ['relation diplomatique', 'diplomatie', 'royaumes', 'tension internationale'],
    negative_keys: [],
    content: r.content,
    priority: 27,
    sticky: 0,
    cooldown: 0,
    constant: false,
    lore_level: 1
  });
}

data.entry_count = data.entries.length;
data.corrections_appliquees = Array.isArray(data.corrections_appliquees) ? data.corrections_appliquees : [];
data.corrections_appliquees.push('V3 étape 9 : 9 relations bilatérales importantes structurées en blocs diplomatiques compacts, sans inventer de nouvelles alliances ou guerres');

if (data.entry_count !== 265) throw new Error(`265 entrées attendues, trouvé ${data.entry_count}`);
if (JSON.stringify(data.entries.slice(0, 256)) !== originalEntries) throw new Error('Une entrée préexistante a été modifiée.');

const required = ['INTÉRÊT COMMUN :','CONFLIT :','DÉPENDANCE :','PEUR :','RESSOURCE STRATÉGIQUE :','DETTE :','LIGNE ROUGE :','ÉTAT DIPLOMATIQUE :','CONSÉQUENCES NARRATIVES :'];
const added = data.entries.filter((e) => e.category === 'RELATION_ROYAUME');
if (added.length !== 9) throw new Error(`9 relations attendues, trouvé ${added.length}`);
for (const e of added) {
  for (const field of required) if (!e.content.includes(field)) throw new Error(`${e.id}: champ absent ${field}`);
  if (e.lore_level !== 1 || e.priority !== 27 || e.constant !== false) throw new Error(`${e.id}: métadonnées invalides`);
  if (e.content.length > 1500) throw new Error(`${e.id}: entrée trop longue (${e.content.length})`);
}

fs.writeFileSync(lorePath, JSON.stringify(data, null, 2) + '\n');

const rows = added.map((e) => `| ${e.id} | ${e.title.replace('[RELATION][','').replace('] ',' — ')} | ${e.content.length} |`).join('\n');
const report = `# ELYNDOR — V3 ÉTAPE 9 — RELATIONS ENTRE ROYAUMES\n\n## A — Modifications effectuées\n\n- Ajout de **9 entrées atomiques RELATION_ROYAUME**, correspondant uniquement aux relations bilatérales déjà importantes dans le canon existant.\n- Chaque bloc contient : intérêt commun, conflit, dépendance, peur, ressource stratégique, dette, ligne rouge, état diplomatique et conséquences narratives.\n- Lorsqu'un élément n'était pas établi dans le canon (notamment certaines dettes ou lignes rouges), la fiche le signale explicitement au lieu d'inventer un fait diplomatique.\n- Chaque relation est **lore_level 1 / priorité 27**, non constante.\n- Aucune nouvelle guerre, alliance, dette historique ou institution diplomatique n'a été créée.\n\n## B — Informations déplacées\n\nAucune. Les nouvelles entrées structurent des relations déjà présentes dans les fiches ROYAUME et CULTURE sans retirer leur formulation d'origine.\n\n## C — Informations supprimées\n\nAucune.\n\n## D — Contradictions découvertes\n\nAucune contradiction critique nouvelle. Certaines relations importantes ne documentaient pas de dette ou de ligne rouge précise ; ces absences restent explicitement marquées comme non établies dans le canon.\n\n## E — Risques\n\n- Ces blocs ajoutent du volume au lore ; l'étape 10 devra sélectionner uniquement la relation pertinente à la scène.\n- Un état diplomatique décrit ici ne doit pas évoluer automatiquement sans événement : les étapes ultérieures sur propagation, conséquences et tensions feront évoluer ces relations.\n- Les champs non établis ne doivent pas être remplis automatiquement par le narrateur comme s'ils étaient déjà canoniques.\n\n## F — Tests réalisés\n\n- Base avant migration : **256 entrées**.\n- Base après migration : **265 entrées**.\n- **9** relations bilatérales exactement.\n- Les **256 objets préexistants sont inchangés**.\n- UID ajoutés : **272 à 280** ; unicité vérifiée ; plage 102–117 toujours réservée.\n- Chaque relation contient les 8 champs imposés par la directive + un champ de conséquences narratives.\n- Taille maximale imposée : **1 500 caractères** par relation.\n- Validation TypeScript et garde-fous structurels exécutés par le workflow avant commit.\n\n### Relations structurées\n\n| UID | Relation | Taille |\n|---:|---|---:|\n${rows}\n\n## G — Décision\n\n**VALIDÉE** si le workflow Step 9, TypeScript et les garde-fous finaux passent avant le commit.\n\n## Frontière avec l'étape 10\n\nAucune modification du moteur de récupération n'est réalisée ici. Les clés, catégories, seuils, scopes et scores hybrides restent réservés à l'étape 10.\n`;
fs.writeFileSync(reportPath, report);

console.log(`Étape 9 préparée : ${added.length} relations ajoutées, ${data.entries.length} entrées totales.`);
for (const e of added) console.log(`${e.id} | ${e.title} | ${e.content.length} caractères`);
