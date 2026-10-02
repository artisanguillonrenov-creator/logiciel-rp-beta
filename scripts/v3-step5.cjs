const fs = require('fs');
const crypto = require('crypto');

const lorePath = 'src/data/elyndorLore.json';
const reportPath = 'docs/v3/STEP5_HIERARCHIE_LORE_V3.md';
const raw = fs.readFileSync(lorePath, 'utf8');
const data = JSON.parse(raw);

if (!Array.isArray(data.entries)) throw new Error('entries absent');
if (data.entry_count !== data.entries.length) throw new Error(`entry_count incohérent: ${data.entry_count} != ${data.entries.length}`);
if (data.entries.length !== 200) throw new Error(`Étape 5 attend 200 entrées après étape 4, reçu ${data.entries.length}`);

const before = new Map(data.entries.map(e => [e.id, {
  content: e.content,
  primary_keys: JSON.stringify(e.primary_keys || []),
  secondary_keys: JSON.stringify(e.secondary_keys || []),
  negative_keys: JSON.stringify(e.negative_keys || []),
  constant: e.constant,
  oldPriority: e.priority,
  category: e.category,
  title: e.title,
}]));

const normalize = (s='') => s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const invariantTitlePatterns = [
  /presentation d'elyndor/,
  /parametres d'elyndor/,
  /reveil des voiles/,
  /geographie et races/,
  /systeme de magie/,
  /histoire d'elyndor/,
  /longevite des races/,
  /monnaie d'elyndor/,
  /portes? astra/,
  /mort.*elyndor/,
  /mortalite/,
  /technologie/,
];

const directCategories = new Set([
  'royaume','pnj','index','guilde','religion','faction','organisation','organisation majeure','personnage','lieu','capitale'
]);

const consequenceKeywords = [
  'justice','reputation','temoin','blessure','contrat','engagement','negociation','dette','propriete',
  'loi','crime','guerre','conflit arme','combat arme','voyage','economie','prix','commerce','logistique',
  'apprentissage','information','rumeur','enquete','sanction','consequence','capture','fuite','soin','frontiere'
];

const socialCategories = [
  'culture','profil racial','profil social','gabarit','race','societe','moeurs','mœurs'
];

const ambienceKeywords = [
  'habillement','vetement','vêtement','cuisine','boisson','jeu populaire','loisir','legende','légende','fete','fête',
  'architecture','gastronomie','coutume secondaire','ambiance','canon feminin','canon féminin','physique'
];

function classify(entry) {
  const title = normalize(entry.title);
  const category = normalize(entry.category);
  const taggedDirect = title.startsWith('[pnj]') || title.startsWith('[royaume]') || title.startsWith('[index]');

  // Niveau 0 uniquement pour des règles globales, jamais pour une fiche PNJ/INDEX/royaume.
  const eligibleInvariant = !taggedDirect && !directCategories.has(category);
  if (eligibleInvariant && invariantTitlePatterns.some(re => re.test(title))) {
    return { level: 0, priority: entry.constant ? 5 : 10, band: 'INVARIANT_ABSOLU' };
  }

  // Niveau 1 : ce qui représente directement un lieu, personnage, faction ou institution impliquée.
  if (taggedDirect || directCategories.has(category)) {
    const p = (category === 'pnj' || title.startsWith('[pnj]') || category === 'royaume' || title.startsWith('[royaume]')) ? 25 : 30;
    return { level: 1, priority: p, band: 'CANON_DE_SCENE' };
  }

  // Niveau 2 : règles qui déterminent les suites concrètes d'une action.
  const haystack = `${title} ${category}`;
  if (consequenceKeywords.some(k => haystack.includes(normalize(k)))) {
    return { level: 2, priority: 45, band: 'CONSEQUENCE' };
  }

  // Niveau 3 : contexte social utile ou enrichissement facultatif.
  if (socialCategories.some(k => category.includes(normalize(k)))) {
    return { level: 3, priority: 65, band: 'ENRICHISSEMENT_SOCIAL' };
  }
  if (ambienceKeywords.some(k => haystack.includes(normalize(k)))) {
    const veryOptional = haystack.includes('canon feminin') || haystack.includes('canon féminin') || category.includes('physique');
    return { level: 3, priority: veryOptional ? 100 : 85, band: veryOptional ? 'ENRICHISSEMENT_OPTIONNEL' : 'ENRICHISSEMENT_AMBIANCE' };
  }

  // Fallback conservateur : contexte secondaire, jamais promu artificiellement.
  return { level: 3, priority: 70, band: 'ENRICHISSEMENT_CONTEXTE' };
}

const rows = [];
for (const entry of data.entries) {
  const c = classify(entry);
  rows.push({ id: entry.id, title: entry.title, category: entry.category, oldPriority: entry.priority, ...c });
  entry.lore_level = c.level;
  entry.priority = c.priority;
}

// Garde-fous structurels.
const ids = data.entries.map(e => e.id);
if (new Set(ids).size !== ids.length) throw new Error('UID dupliqué détecté');
const titles = data.entries.map(e => e.title);
if (new Set(titles).size !== titles.length) throw new Error('Titre dupliqué détecté');
for (let uid = 102; uid <= 117; uid++) {
  if (ids.includes(uid)) throw new Error(`UID réservé ${uid} a été utilisé`);
}

for (const entry of data.entries) {
  const b = before.get(entry.id);
  if (!b) throw new Error(`Entrée nouvelle interdite pendant étape 5: ${entry.id}`);
  if (entry.content !== b.content) throw new Error(`Contenu canon modifié par erreur: ${entry.id} ${entry.title}`);
  if (JSON.stringify(entry.primary_keys || []) !== b.primary_keys) throw new Error(`primary_keys modifiées: ${entry.id}`);
  if (JSON.stringify(entry.secondary_keys || []) !== b.secondary_keys) throw new Error(`secondary_keys modifiées: ${entry.id}`);
  if (JSON.stringify(entry.negative_keys || []) !== b.negative_keys) throw new Error(`negative_keys modifiées: ${entry.id}`);
  if (entry.constant !== b.constant) throw new Error(`constant modifié: ${entry.id}`);
  if (![0,1,2,3].includes(entry.lore_level)) throw new Error(`lore_level invalide: ${entry.id}`);
  if (entry.lore_level === 0 && !(entry.priority >= 0 && entry.priority <= 10)) throw new Error(`Priorité hors bande L0: ${entry.id}`);
  if (entry.lore_level === 1 && !(entry.priority >= 20 && entry.priority <= 30)) throw new Error(`Priorité hors bande L1: ${entry.id}`);
  if (entry.lore_level === 2 && !(entry.priority >= 40 && entry.priority <= 50)) throw new Error(`Priorité hors bande L2: ${entry.id}`);
  if (entry.lore_level === 3 && !(entry.priority >= 60 && entry.priority <= 100)) throw new Error(`Priorité hors bande L3: ${entry.id}`);
}

const counts = [0,1,2,3].map(level => ({ level, count: rows.filter(r => r.level === level).length }));
if (counts.some(c => c.count === 0)) throw new Error(`Un niveau est vide: ${JSON.stringify(counts)}`);

if (!Array.isArray(data.corrections_appliquees)) data.corrections_appliquees = [];
const marker = 'V3 étape 5 : hiérarchie de lore explicite (niveaux 0-3) et priorités recalibrées par fonction narrative';
if (!data.corrections_appliquees.includes(marker)) data.corrections_appliquees.push(marker);

data.entry_count = data.entries.length;
fs.writeFileSync(lorePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

const byBand = rows.reduce((acc, r) => { acc[r.band] = (acc[r.band] || 0) + 1; return acc; }, {});
const constantIds = data.entries.filter(e => e.constant).map(e => e.id);

let report = `# ELYNDOR — V3 ÉTAPE 5 — HIÉRARCHIE DU LORE\n\n`;
report += `## A — Modifications effectuées\n\n`;
report += `- Les **${data.entries.length} entrées existantes** ont reçu un champ explicite \`lore_level\` compris entre 0 et 3.\n`;
report += `- Les priorités ont été recalibrées selon la hiérarchie demandée : **0–10 invariants**, **20–30 canon de scène**, **40–50 conséquences**, **60–100 contexte/enrichissement**.\n`;
report += `- Aucun contenu canonique, clé de recherche, UID, titre ou drapeau \`constant\` n’a été modifié.\n`;
report += `- Les entrées \`constant\` existantes restent inchangées ; leur garantie structurelle sera traitée à l’étape 6 avec le Lore Core.\n\n`;
report += `### Répartition\n\n`;
for (const c of counts) report += `- Niveau ${c.level} : **${c.count}** entrées\n`;
report += `\n### Sous-bandes utilisées\n\n`;
for (const [band, count] of Object.entries(byBand).sort()) report += `- ${band} : ${count}\n`;

report += `\n## B — Informations déplacées\n\nAucune information canonique n’a été déplacée entre entrées pendant cette étape. La modification porte uniquement sur la **hiérarchie de sélection future** et la valeur de \`priority\`.\n`;
report += `\n## C — Informations supprimées\n\nAucune.\n`;
report += `\n## D — Contradictions découvertes\n\nAucune contradiction canonique nouvelle n’a été corrigée ici. Le but de l’étape 5 est structurel : distinguer ce qui est fondamental, directement pertinent, conséquentiel ou seulement contextuel.\n`;
report += `\n## E — Risques\n\n`;
report += `- Le moteur actuel n’exploite pas encore \`lore_level\` directement ; ce champ prépare l’étape 10 de récupération hybride.\n`;
report += `- \`priority\` est déjà consommé par le moteur ; ce recalibrage peut donc modifier l’ordre relatif de certaines entrées à score sémantique comparable, ce qui est précisément l’effet recherché.\n`;
report += `- La garantie des invariants n’est pas encore absolue : elle sera sécurisée par le Lore Core à l’étape 6.\n`;

report += `\n## F — Tests réalisés\n\n`;
report += `- 200 entrées avant et après migration ;\n`;
report += `- UID uniques ;\n`;
report += `- titres uniques ;\n`;
report += `- UID 102–117 toujours réservés ;\n`;
report += `- contenu canonique inchangé entrée par entrée ;\n`;
report += `- \`primary_keys\`, \`secondary_keys\`, \`negative_keys\` inchangées ;\n`;
report += `- \`constant\` inchangé ;\n`;
report += `- chaque entrée possède exactement un niveau 0, 1, 2 ou 3 ;\n`;
report += `- chaque priorité respecte la bande de son niveau ;\n`;
report += `- chaque niveau contient au moins une entrée ;\n`;
report += `- validation TypeScript exécutée par le workflow avant commit.\n`;

report += `\n## G — Décision\n\n**VALIDÉE** si les garde-fous ci-dessus et \`npx tsc --noEmit\` passent.\n`;
report += `\n## Détail des entrées\n\n| UID | Niveau | Priorité avant | Priorité V3 | Catégorie | Titre |\n|---:|---:|---:|---:|---|---|\n`;
for (const r of rows.sort((a,b) => a.id - b.id)) {
  const safeTitle = String(r.title).replace(/\|/g, '\\|');
  const safeCat = String(r.category).replace(/\|/g, '\\|');
  report += `| ${r.id} | ${r.level} | ${r.oldPriority} | ${r.priority} | ${safeCat} | ${safeTitle} |\n`;
}

report += `\n### Entrées actuellement constant=true\n\n${constantIds.length ? constantIds.map(id => `- UID ${id}`).join('\n') : '- Aucune'}\n`;

fs.mkdirSync('docs/v3', { recursive: true });
fs.writeFileSync(reportPath, report, 'utf8');

console.log('Étape 5 appliquée. Répartition:', counts);
console.log('Sous-bandes:', byBand);
console.log('constant=true:', constantIds);
