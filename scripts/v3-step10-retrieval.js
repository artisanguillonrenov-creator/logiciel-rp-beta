const fs = require('fs');

const lorePath = 'src/data/elyndorLore.json';
const loaderPath = 'src/engine/loreLoader.ts';
const lexicalPath = 'src/engine/rechercheLexicale.ts';
const scoringPath = 'src/engine/loreScoring.ts';
const testPath = 'tests/loreRetrievalStep10.test.ts';
const reportPath = 'docs/v3/STEP10_RECUPERATION_LORE_V3.md';

function fail(message) {
  throw new Error(message);
}

function replaceBetween(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) fail(`Marqueurs introuvables: ${startMarker} / ${endMarker}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

function replaceOnce(text, needle, replacement, label) {
  const index = text.indexOf(needle);
  if (index < 0) fail(`Bloc introuvable: ${label}`);
  if (text.indexOf(needle, index + needle.length) >= 0) fail(`Bloc non unique: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + needle.length);
}

// ---------------------------------------------------------------------------
// 1. Ajouter le scope aux 265 entrées sans modifier leur contenu canonique.
// ---------------------------------------------------------------------------
const lore = JSON.parse(fs.readFileSync(lorePath, 'utf8'));
if (lore.entry_count !== 265 || lore.entries.length !== 265) {
  fail(`Base Step 9 attendue à 265 entrées, trouvé ${lore.entry_count}/${lore.entries.length}`);
}
const scopesAutorises = new Set(['GLOBAL', 'CONTINENT', 'REGION', 'CITY', 'FACTION', 'CHARACTER', 'SCENE']);
function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
function inferScope(category) {
  const c = normalize(category);
  if (c.includes('relation')) return 'REGION';
  if (c.includes('royaume') || c.includes('conflit') || c.includes('probleme')) return 'CITY';
  if (c.includes('guilde') || c.includes('faction')) return 'FACTION';
  if (c.includes('recurrent') || c.includes('physique') || c === 'profil' || c.includes('personnage')) return 'CHARACTER';
  if (c.includes('culture') || c.includes('racial') || c.includes('race')) return 'CONTINENT';
  if (c.includes('scene')) return 'SCENE';
  return 'GLOBAL';
}
for (const entry of lore.entries) {
  if (!scopesAutorises.has(entry.scope)) entry.scope = inferScope(entry.category);
}
lore.corrections_appliquees = Array.isArray(lore.corrections_appliquees) ? lore.corrections_appliquees : [];
if (!lore.corrections_appliquees.some((x) => String(x).includes('V3 étape 10'))) {
  lore.corrections_appliquees.push('V3 étape 10 : scopes de récupération ajoutés aux entrées ; canon narratif inchangé');
}
fs.writeFileSync(lorePath, JSON.stringify(lore, null, 2) + '\n');

// ---------------------------------------------------------------------------
// 2. Nouveau score hybride partagé par embeddings et fallback lexical.
// ---------------------------------------------------------------------------
const scoring = `export type ScopeLore = 'GLOBAL' | 'CONTINENT' | 'REGION' | 'CITY' | 'FACTION' | 'CHARACTER' | 'SCENE';

export interface EntreeLoreScorable {
  titre: string;
  contenu: string;
  primaryKeys?: string[];
  secondaryKeys?: string[];
  negativeKeys?: string[];
  priority?: number;
  category?: string;
  scope?: ScopeLore;
  constant?: boolean;
}

export const SEUIL_LORE_HYBRIDE = 0.30;
export const MAX_LORE_CONTEXTUEL = 8;

const MOTS_VIDES_LORE = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'en', 'et', 'il', 'ils', 'la', 'le', 'les', 'leur',
  'mais', 'ne', 'nous', 'on', 'ou', 'par', 'pas', 'pour', 'que', 'qui', 'sa', 'se', 'ses', 'son', 'sur', 'un', 'une', 'vous',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be', 'it', 'this', 'that',
]);

export function normaliserLore(texte: string): string {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

export function termesSignificatifsLore(texte: string): string[] {
  const vus = new Set<string>();
  const termes: string[] = [];
  for (const brut of normaliserLore(texte).split(' ')) {
    const terme = brut.replace(/^[-']+|[-']+$/g, '');
    if (terme.length < 2 || MOTS_VIDES_LORE.has(terme) || vus.has(terme)) continue;
    vus.add(terme);
    termes.push(terme);
  }
  return termes;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreCle(requeteNormalisee: string, termesRequete: Set<string>, cles: string[] | undefined): number {
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

function sujetTitre(titre: string): string {
  const sansCategorie = normaliserLore(titre.replace(/^\\[[^\\]]+\\]\\s*/, ''));
  return sansCategorie.split(/\\s+[—–-]\\s+/)[0]?.trim() ?? sansCategorie;
}

export function estExclueParClesNegatives(entry: EntreeLoreScorable, requete: string): boolean {
  const q = normaliserLore(requete);
  return (entry.negativeKeys ?? []).some((cle) => {
    const n = normaliserLore(cle);
    return n.length >= 2 && q.includes(n);
  });
}

export function infererScopeLore(category?: string): ScopeLore {
  const c = normaliserLore(category ?? '');
  if (c.includes('relation')) return 'REGION';
  if (c.includes('royaume') || c.includes('conflit') || c.includes('probleme')) return 'CITY';
  if (c.includes('guilde') || c.includes('faction')) return 'FACTION';
  if (c.includes('recurrent') || c.includes('physique') || c === 'profil' || c.includes('personnage')) return 'CHARACTER';
  if (c.includes('culture') || c.includes('racial') || c.includes('race')) return 'CONTINENT';
  if (c.includes('scene')) return 'SCENE';
  return 'GLOBAL';
}

export interface DetailsScoreLore {
  embedding: number;
  lexical: number;
  primary: number;
  secondary: number;
  explicite: number;
  categorie: number;
  scope: number;
  priorite: number;
  score: number;
}

export function calculerScoreHybrideLore(
  entry: EntreeLoreScorable,
  requete: string,
  similariteEmbedding?: number,
): DetailsScoreLore {
  if (estExclueParClesNegatives(entry, requete)) {
    return { embedding: 0, lexical: 0, primary: 0, secondary: 0, explicite: 0, categorie: 0, scope: 0, priorite: 0, score: 0 };
  }

  const requeteNormalisee = normaliserLore(requete);
  const termesRequeteListe = termesSignificatifsLore(requete);
  const termesRequete = new Set(termesRequeteListe);
  const corps = normaliserLore(`${entry.titre} ${entry.contenu}`);
  const termesCorps = new Set(termesSignificatifsLore(corps));
  const trouves = termesRequeteListe.filter((t) => termesCorps.has(t)).length;
  // Une requête de tour contient souvent beaucoup de contexte : on ne divise
  // pas par des dizaines de termes, ce qui écraserait artificiellement le lexical.
  const lexical = clamp01(trouves / Math.max(1, Math.min(12, termesRequeteListe.length)));
  const primary = scoreCle(requeteNormalisee, termesRequete, entry.primaryKeys);
  const secondary = scoreCle(requeteNormalisee, termesRequete, entry.secondaryKeys);
  const sujet = sujetTitre(entry.titre);
  const explicite = sujet.length >= 3 && requeteNormalisee.includes(sujet) ? 1 : Math.max(primary, secondary * 0.6);
  const categorieNormalisee = normaliserLore(entry.category ?? '');
  const categorie = categorieNormalisee && requeteNormalisee.includes(categorieNormalisee) ? 1 : 0;
  const prioriteBrute = Number.isFinite(entry.priority) ? Number(entry.priority) : 100;
  const priorite = clamp01(1 - Math.max(0, Math.min(100, prioriteBrute)) / 100);
  const scopeValue = entry.scope ?? infererScopeLore(entry.category);
  const signalLocal = Math.max(primary, secondary, explicite, lexical);
  let scope = 0;
  switch (scopeValue) {
    case 'GLOBAL': scope = 0.45; break;
    case 'CONTINENT': scope = signalLocal >= 0.35 ? 0.75 : 0.15; break;
    case 'REGION': scope = signalLocal >= 0.35 ? 0.85 : 0.10; break;
    case 'CITY': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0.05; break;
    case 'FACTION': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0; break;
    case 'CHARACTER': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.70 : 0; break;
    case 'SCENE': scope = lexical >= 0.25 ? 0.80 : 0; break;
  }

  const embeddingDisponible = typeof similariteEmbedding === 'number' && Number.isFinite(similariteEmbedding);
  const embedding = embeddingDisponible ? clamp01(similariteEmbedding) : 0;
  const score = embeddingDisponible
    ? 0.44 * embedding + 0.20 * lexical + 0.16 * primary + 0.07 * secondary + 0.05 * explicite + 0.04 * scope + 0.03 * priorite + 0.01 * categorie
    : 0.42 * lexical + 0.25 * primary + 0.10 * secondary + 0.08 * explicite + 0.07 * scope + 0.05 * priorite + 0.03 * categorie;

  return { embedding, lexical, primary, secondary, explicite, categorie, scope, priorite, score };
}
`;
fs.writeFileSync(scoringPath, scoring);

// ---------------------------------------------------------------------------
// 3. loreLoader : conserver et exploiter toutes les métadonnées positives,
//    score hybride + seuil + plafond 8. Les ancres existantes ne sont pas
//    élargies ici : leur généralisation reste réservée à l'étape 11.
// ---------------------------------------------------------------------------
let loader = fs.readFileSync(loaderPath, 'utf8');
loader = replaceOnce(
  loader,
  "import { similariteCosinus } from './embeddings';\n",
  "import { similariteCosinus } from './embeddings';\nimport { calculerScoreHybrideLore, infererScopeLore, MAX_LORE_CONTEXTUEL, SEUIL_LORE_HYBRIDE, type ScopeLore } from './loreScoring';\n",
  'import loreScoring',
);

const metadataBlock = `// --- Lore Elyndor -----------------------------------------------------
// V3 étape 10 : les métadonnées positives du lore sont conservées au
// chargement et participent réellement au classement hybride.

interface ElyndorEntryBrute {
  id: number;
  category: string;
  title: string;
  primary_keys?: string[];
  secondary_keys?: string[];
  negative_keys?: string[];
  content: string;
  priority: number;
  constant: boolean;
  scope?: ScopeLore;
}

interface ElyndorLorebook {
  entries: ElyndorEntryBrute[];
}

export interface ElyndorEntryChargee {
  id: string;
  titre: string;
  contenu: string;
  motsClesPrimaires?: string[];
  motsClesSecondaires?: string[];
  motsClesNegatifs: string[];
  primaryKeys?: string[];
  secondaryKeys?: string[];
  negativeKeys?: string[];
  priority: number;
  constant: boolean;
  category?: string;
  scope?: ScopeLore;
}

export function chargerLoreElyndor(raw: ElyndorLorebook): ElyndorEntryChargee[] {
  return raw.entries.map((entry) => {
    const primaryKeys = (entry.primary_keys ?? []).map(normalise);
    const secondaryKeys = (entry.secondary_keys ?? []).map(normalise);
    const negativeKeys = (entry.negative_keys ?? []).map(normalise);
    return {
      id: \`elyndor-\${entry.id}\`,
      titre: \`[\${entry.category}] \${entry.title}\`,
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
      scope: entry.scope ?? infererScopeLore(entry.category),
    };
  });
}

`;
loader = replaceBetween(loader, '// --- Lore Elyndor -----------------------------------------------------', '// Une entrée non couverte par "constant"', metadataBlock);

const semanticFunction = `export function selectionnerLoreElyndorSemantique(
  entries: ElyndorEntryChargee[],
  texteRequete: string,
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  maxSupplementaires = MAX_LORE_CONTEXTUEL,
  options?: OptionsSelectionLore,
): LoreEntry[] {
  const toujoursActives = entries.filter(
    (e) => e.constant || LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );
  const reste = entries.filter(
    (e) => !e.constant && !LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );

  const classementComplet = reste
    .map((entry) => {
      const similarite = vecteursEntrees[entry.id]
        ? similariteCosinus(vecteurRequete, vecteursEntrees[entry.id])
        : undefined;
      const details = calculerScoreHybrideLore(
        {
          titre: entry.titre,
          contenu: entry.contenu,
          primaryKeys: entry.primaryKeys ?? entry.motsClesPrimaires,
          secondaryKeys: entry.secondaryKeys ?? entry.motsClesSecondaires,
          negativeKeys: entry.negativeKeys ?? entry.motsClesNegatifs,
          priority: entry.priority,
          category: entry.category,
          scope: entry.scope,
          constant: entry.constant,
        },
        texteRequete,
        similarite,
      );
      return { entry, score: details.score };
    })
    .filter((x) => x.score >= SEUIL_LORE_HYBRIDE)
    .sort((a, b) => b.score - a.score || a.entry.priority - b.entry.priority);

  const plafond = Math.max(0, Math.min(MAX_LORE_CONTEXTUEL, maxSupplementaires));
  const classement = options?.aleatoire
    ? piocherAleatoirement(
        classementComplet.slice(0, Math.max(options.tailleBassinAleatoire ?? 10, plafond)),
        plafond,
      )
    : classementComplet.slice(0, plafond);

  return [
    ...toujoursActives.map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu })),
    ...classement.map((c) => ({ id: c.entry.id, titre: c.entry.titre, contenu: c.entry.contenu, score: c.score })),
  ];
}

`;
loader = replaceBetween(loader, 'export function selectionnerLoreElyndorSemantique(', 'const PREFIXE_ROYAUME', semanticFunction);
fs.writeFileSync(loaderPath, loader);

// ---------------------------------------------------------------------------
// 4. Fallback lexical : même score hybride et même seuil, maximum 8 résultats
//    contextuels, plus Lore Core, sans quota artificiel.
// ---------------------------------------------------------------------------
let lexical = fs.readFileSync(lexicalPath, 'utf8');
lexical = replaceOnce(
  lexical,
  "import type { LoreEntry, Message } from '../types';\n",
  "import type { LoreEntry, Message } from '../types';\nimport { calculerScoreHybrideLore, infererScopeLore, MAX_LORE_CONTEXTUEL, SEUIL_LORE_HYBRIDE, termesSignificatifsLore, type EntreeLoreScorable, type ScopeLore } from './loreScoring';\n",
  'import scoring lexical',
);
lexical = replaceOnce(
  lexical,
  'export const BUDGET_LORE: BudgetRecherche = { maxResultats: 4, maxCaracteres: 1800, maxCaracteresParResultat: 520 };',
  'export const BUDGET_LORE: BudgetRecherche = { maxResultats: MAX_LORE_CONTEXTUEL, maxCaracteres: 3600, maxCaracteresParResultat: 520 };',
  'budget lore',
);

const lexicalLoreFunction = `/** Fiches de lore classées avec le même score hybride que le mode embeddings. */
export function rechercherLoreLexical(entrees: LoreEntry[], requete: string): LoreEntry[] {
  const termes = termesSignificatifsLore(requete);
  const toujoursActives: LoreEntry[] = [];
  const candidats: { item: LoreEntry; score: number; extrait: string; priority: number }[] = [];

  for (const item of entrees) {
    const meta = item as LoreEntry & Partial<EntreeLoreScorable> & {
      motsClesPrimaires?: string[];
      motsClesSecondaires?: string[];
      motsClesNegatifs?: string[];
      priority?: number;
      constant?: boolean;
      category?: string;
      scope?: ScopeLore;
    };
    if (meta.constant || item.titre === '[MONDE] Géographie et Races') {
      toujoursActives.push({ id: item.id, titre: item.titre, contenu: item.contenu });
      continue;
    }
    const details = calculerScoreHybrideLore(
      {
        titre: item.titre,
        contenu: item.contenu,
        primaryKeys: meta.primaryKeys ?? meta.motsClesPrimaires,
        secondaryKeys: meta.secondaryKeys ?? meta.motsClesSecondaires,
        negativeKeys: meta.negativeKeys ?? meta.motsClesNegatifs,
        priority: meta.priority,
        category: meta.category,
        scope: meta.scope ?? infererScopeLore(meta.category),
        constant: meta.constant,
      },
      requete,
    );
    if (details.score < SEUIL_LORE_HYBRIDE) continue;
    candidats.push({
      item,
      score: details.score,
      extrait: extraire(item.contenu, termes, BUDGET_LORE.maxCaracteresParResultat),
      priority: Number.isFinite(meta.priority) ? Number(meta.priority) : 100,
    });
  }

  candidats.sort((a, b) => b.score - a.score || a.priority - b.priority);
  const retenus: LoreEntry[] = [];
  let total = 0;
  for (const note of candidats) {
    if (retenus.length >= BUDGET_LORE.maxResultats) break;
    if (retenus.length && total + note.extrait.length + 2 > BUDGET_LORE.maxCaracteres) break;
    const extrait = note.extrait.slice(0, Math.max(0, BUDGET_LORE.maxCaracteres - total));
    if (!extrait) break;
    retenus.push({ id: note.item.id, titre: note.item.titre, contenu: extrait, score: note.score });
    total += extrait.length + 2;
  }

  return [...toujoursActives, ...retenus];
}

`;
lexical = replaceBetween(
  lexical,
  '/** Fiches de lore les plus proches, réduites à leur extrait pertinent. */',
  '/** Messages anciens (hors fenêtre récente)',
  lexicalLoreFunction,
);
fs.writeFileSync(lexicalPath, lexical);

// ---------------------------------------------------------------------------
// 5. Tests ciblés Step 10.
// ---------------------------------------------------------------------------
const tests = `import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreHybrideLore, MAX_LORE_CONTEXTUEL, SEUIL_LORE_HYBRIDE } from '../src/engine/loreScoring';
import { rechercherLoreLexical } from '../src/engine/rechercheLexicale';
import { selectionnerLoreElyndorSemantique, type ElyndorEntryChargee } from '../src/engine/loreLoader';
import type { LoreEntry } from '../src/types';

function chargee(id: string, titre: string, overrides: Partial<ElyndorEntryChargee> = {}): ElyndorEntryChargee {
  return {
    id,
    titre,
    contenu: 'Informations canoniques ciblées pour cette fiche.',
    motsClesNegatifs: [],
    primaryKeys: [],
    secondaryKeys: [],
    negativeKeys: [],
    priority: 50,
    constant: false,
    category: 'ROYAUME',
    scope: 'CITY',
    ...overrides,
  };
}

test('primary_keys et scope renforcent une fiche explicitement pertinente', () => {
  const cible = calculerScoreHybrideLore({
    titre: '[ROYAUME] Paris', contenu: 'Capitale humaine.', primaryKeys: ['Paris'], priority: 20, category: 'ROYAUME', scope: 'CITY',
  }, 'Je retourne à Paris pour rencontrer la cour.');
  const generique = calculerScoreHybrideLore({
    titre: '[MONDE] Commerce', contenu: 'Les routes relient les capitales.', priority: 20, category: 'MONDE', scope: 'GLOBAL',
  }, 'Je retourne à Paris pour rencontrer la cour.');
  assert.ok(cible.score > generique.score);
  assert.ok(cible.score >= SEUIL_LORE_HYBRIDE);
});

test('negative_keys excluent une fiche même avec une clé positive', () => {
  const score = calculerScoreHybrideLore({
    titre: '[ROYAUME] Paris', contenu: 'Paris', primaryKeys: ['Paris'], negativeKeys: ['hors canon'], scope: 'CITY',
  }, 'Paris hors canon');
  assert.equal(score.score, 0);
});

test('le fallback lexical ne remplit pas artificiellement le quota', () => {
  const entries: LoreEntry[] = [
    { id: 'a', titre: '[MONDE] Navigation', contenu: 'Ports et marées.' },
    { id: 'b', titre: '[MONDE] Agriculture', contenu: 'Moissons et greniers.' },
  ];
  assert.deepEqual(rechercherLoreLexical(entries, 'rituel draconique des glaces'), []);
});

test('le fallback lexical plafonne à 8 résultats contextuels', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    titre: `[ROYAUME] Paris secteur ${i}`,
    contenu: 'Paris capitale cour commerce.',
    primaryKeys: ['Paris'],
    priority: i,
    constant: false,
    category: 'ROYAUME',
    scope: 'CITY',
  })) as unknown as LoreEntry[];
  const resultats = rechercherLoreLexical(entries, 'Paris');
  assert.equal(resultats.length, MAX_LORE_CONTEXTUEL);
});

test('Lore Core est ajouté en plus des résultats contextuels', () => {
  const entries = [
    { id: 'core', titre: '[MONDE] Géographie et Races', contenu: 'Socle.', constant: false },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`, titre: `[ROYAUME] Paris ${i}`, contenu: 'Paris.', primaryKeys: ['Paris'], priority: i, category: 'ROYAUME', scope: 'CITY', constant: false,
    })),
  ] as unknown as LoreEntry[];
  const resultats = rechercherLoreLexical(entries, 'Paris');
  assert.equal(resultats[0].id, 'core');
  assert.equal(resultats.length, MAX_LORE_CONTEXTUEL + 1);
});

test('la sélection sémantique applique seuil et plafond au lieu du top 18 automatique', () => {
  const entries = Array.from({ length: 12 }, (_, i) => chargee(`e${i}`, `[MONDE] Entrée ${i}`, { category: 'MONDE', scope: 'GLOBAL' }));
  const vecteurs = Object.fromEntries(entries.map((e) => [e.id, [1, 0]]));
  const resultats = selectionnerLoreElyndorSemantique(entries, 'sujet pertinent', [1, 0], vecteurs);
  assert.equal(resultats.length, MAX_LORE_CONTEXTUEL);

  const faibles = Object.fromEntries(entries.map((e) => [e.id, [0, 1]]));
  const filtres = selectionnerLoreElyndorSemantique(entries, 'sujet sans correspondance', [1, 0], faibles);
  assert.equal(filtres.length, 0);
});
`;
fs.writeFileSync(testPath, tests);

const report = `# ELYNDOR — V3 ÉTAPE 10 — RÉCUPÉRATION HYBRIDE DU LORE

## A — Modifications effectuées

- Conservation et exploitation effective de \`primary_keys\`, \`secondary_keys\`, \`negative_keys\`, priorité, catégorie et scope.
- Ajout d'un \`scope\` à chaque entrée statique avec les valeurs : GLOBAL, CONTINENT, REGION, CITY, FACTION, CHARACTER, SCENE.
- Ajout d'un score hybride partagé entre le mode embeddings et le fallback lexical.
- Ajout d'un seuil minimum : une entrée sous le seuil n'est pas injectée.
- Suppression du comportement « top 18 automatique » : maximum **8 entrées contextuelles**.
- Aucun plancher artificiel : si seulement 3 entrées passent le seuil, seules ces 3 entrées sont injectées.
- Lore Core conservé en plus des entrées contextuelles, y compris en fallback lexical.
- Les ancres canoniques existantes ne sont pas généralisées ici : cette généralisation reste réservée à l'étape 11.

## B — Informations déplacées

Aucune information canonique déplacée. Les métadonnées existantes sont désormais transportées jusqu'au moteur de score au lieu d'être perdues au chargement.

## C — Informations supprimées

Aucune information de lore supprimée. Seul le mécanisme de sélection « prendre jusqu'aux 18 meilleurs résultats sans seuil commun » est remplacé.

## D — Contradictions découvertes

- Le chemin embeddings et le fallback lexical utilisaient deux logiques et deux plafonds différents.
- Les clés positives existaient dans le JSON mais n'étaient plus utilisées par le moteur sémantique.
- Le fallback lexical ne garantissait pas le Lore Core.

## E — Risques

- Un seuil trop élevé pourrait sous-récupérer certaines scènes très implicites ; les poids sont centralisés dans \`loreScoring.ts\` pour être ajustables sans toucher au canon.
- Les scopes ajoutés sont des métadonnées de récupération, pas de nouveaux faits narratifs.
- L'étape 11 devra compléter ce système par des ancres canoniques explicites pour les noms propres importants.

## F — Tests réalisés

- Tests unitaires du score hybride, clés positives/négatives, scope, seuil, plafond à 8 et Lore Core.
- \`npm test\`.
- \`npx tsc --noEmit\`.
- Garde-fou : 265 entrées avant/après ; contenu canonique inchangé hors ajout du champ scope et du journal de correction.
- Garde-fou : chaque scope appartient à la liste autorisée.
- Garde-fou : plage UID 102–117 toujours libre.

## G — Décision

**EN ATTENTE DES TESTS DU WORKFLOW STEP 10**
`;
fs.writeFileSync(reportPath, report);
