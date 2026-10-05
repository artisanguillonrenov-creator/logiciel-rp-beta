import assert from 'node:assert/strict';
import test from 'node:test';
import { extraireAncresCanoniques, prioriserLoreCanon, type ElyndorEntryChargee } from '../src/engine/loreLoader';
import type { LoreEntry } from '../src/types';

function entree(
  id: string,
  titre: string,
  category: string,
  scope: ElyndorEntryChargee['scope'],
  primaryKeys: string[] = [],
): ElyndorEntryChargee {
  return {
    id,
    titre,
    contenu: `Fiche canonique de ${titre}`,
    motsClesNegatifs: [],
    primaryKeys,
    secondaryKeys: [],
    negativeKeys: [],
    priority: 20,
    constant: false,
    category,
    scope,
  };
}

const paris = entree('paris', '[ROYAUME] Paris — Royaume Humain', 'ROYAUME', 'CITY', ['Paris']);
const seraphine = entree(
  'seraphine',
  '[PNJ] [PNJ][PARIS] Séraphine Duvall — Direction guilde',
  'PNJ',
  'CHARACTER',
  ['Séraphine Duvall', 'Séraphine Duvall Paris', 'maîtresse de guilde'],
);
const ordre = entree('mages', '[GUILDE] Ordre des Mages', 'GUILDE', 'FACTION', ['ordre des mages']);

test('un royaume explicitement nommé est forcé même sans résultat de recherche', () => {
  const resultat = prioriserLoreCanon('Je reviens à Paris.', [], [paris]);
  assert.deepEqual(resultat.map((e) => e.id), ['paris']);
  assert.equal(resultat[0].score, undefined);
});

test('Séraphine Duvall force sa fiche PNJ malgré les doubles préfixes du titre', () => {
  const ancres = extraireAncresCanoniques('Je parle à Séraphine Duvall.', [seraphine]);
  assert.deepEqual(ancres.map((e) => e.id), ['seraphine']);
  assert.equal(ancres[0].score, undefined);
});

test('un rôle générique ne déclenche pas faussement une fiche de personnage', () => {
  const ancres = extraireAncresCanoniques('Je demande à parler à la maîtresse de guilde.', [seraphine]);
  assert.deepEqual(ancres, []);
});

test('plus de deux noms explicites sont tous ancrés sans plafond artificiel', () => {
  const ancres = extraireAncresCanoniques(
    'À Paris, Séraphine Duvall demande conseil à l’Ordre des Mages.',
    [paris, seraphine, ordre],
  );
  assert.deepEqual(ancres.map((e) => e.id), ['paris', 'seraphine', 'mages']);
});

test('les index ne remplacent jamais les fiches individuelles', () => {
  const index = entree('index', '[INDEX] [INDEX][PARIS] PNJ récurrents', 'INDEX', 'CHARACTER', ['PNJ Paris']);
  const ancres = extraireAncresCanoniques('Je consulte les PNJ récurrents.', [index]);
  assert.deepEqual(ancres, []);
});

test('religion, porte nommée, artefact et zone nommée sont ancrables même en scope global', () => {
  const culte = entree('culte', '[MONDE] Culte des Voiles', 'MONDE', 'GLOBAL');
  const porte = entree('porte', '[MONDE] Porte Astra de Tokyo — Porte majeure', 'MONDE', 'GLOBAL');
  const artefact = entree('artefact', '[MONDE] Lame des Voiles — Artefact majeur', 'MONDE', 'GLOBAL');
  const zone = entree('zone', '[MONDE] Cratère d’Albi — Zone Corrompue majeure', 'MONDE', 'GLOBAL');
  const ancres = extraireAncresCanoniques(
    'Le Culte des Voiles transporte la Lame des Voiles vers le Cratère d’Albi par la Porte Astra de Tokyo.',
    [culte, porte, artefact, zone],
  );
  assert.deepEqual(new Set(ancres.map((e) => e.id)), new Set(['culte', 'porte', 'artefact', 'zone']));
});

test('une fiche déjà sélectionnée n’est jamais injectée deux fois', () => {
  const selection: LoreEntry[] = [{ id: 'seraphine', titre: seraphine.titre, contenu: seraphine.contenu, score: 0.31 }];
  const resultat = prioriserLoreCanon('Séraphine Duvall me répond.', selection, [seraphine]);
  assert.equal(resultat.filter((e) => e.id === 'seraphine').length, 1);
  assert.equal(resultat[0].score, undefined);
});

test('les ancres passent avant le socle puis le lore contextuel', () => {
  const selection: LoreEntry[] = [
    { id: 'socle', titre: '[MONDE] Présentation', contenu: 'Socle' },
    { id: 'contexte', titre: '[MONDE] Commerce', contenu: 'Commerce', score: 0.91 },
  ];
  const resultat = prioriserLoreCanon('Je rencontre Séraphine Duvall.', selection, [seraphine]);
  assert.deepEqual(resultat.map((e) => e.id), ['seraphine', 'socle', 'contexte']);
});
