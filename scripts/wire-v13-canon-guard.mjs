import fs from 'node:fs';

const path = 'src/engine/generateTurn.ts';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) throw new Error(`Patch introuvable: ${label}`);
  if (s.indexOf(from, i + from.length) >= 0) throw new Error(`Patch ambigu: ${label}`);
  s = s.slice(0, i) + to + s.slice(i + from.length);
}

replaceOnce(
  "import { construireContextBlocks, debugContextBlocks, formaterContextBlocks, synchroniserMemoireNarrative } from './narrative/persistentMemory';\n",
  "import { construireContextBlocks, debugContextBlocks, formaterContextBlocks, synchroniserMemoireNarrative } from './narrative/persistentMemory';\nimport { prioriserLoreCanon, verifierEntitesCanoniques } from './canonGuard';\n",
  'import canon guard',
);

replaceOnce(
  '  reconstruireNarrativeCoreDepuisTranscript,\n} from \'./narrative/narrativeCoreV12\';',
  '  reconstruireNarrativeCoreDepuisTranscript,\n  reconcilierNarrativeCoreV12,\n} from \'./narrative/narrativeCoreV12\';',
  'import reconcile V12',
);

replaceOnce(
  '    const loreElyndor = loreHitsAsEntries(loreHits);',
  '    const loreElyndor = prioriserLoreCanon(texteRequete, loreHitsAsEntries(loreHits));',
  'local lore canonical anchors',
);

const semanticOld = `  const loreElyndor = selectionnerLoreElyndorSemantique(
    poolElyndor,
    texteRequete,
    vecteurRequete,
    vecteursElyndor,
    undefined,
    optionsLoreElyndor,
  );`;
const semanticNew = `  const loreElyndor = prioriserLoreCanon(texteRequete, selectionnerLoreElyndorSemantique(
    poolElyndor,
    texteRequete,
    vecteurRequete,
    vecteursElyndor,
    undefined,
    optionsLoreElyndor,
  ));`;
replaceOnce(semanticOld, semanticNew, 'semantic lore canonical anchors');

replaceOnce(
  `  const storyMaj: StoryState = { ...story, ...maj, ...majLore };
  return { ...storyMaj, memoireNarrative: synchroniserMemoireNarrative(storyMaj) };`,
  `  const storyMaj: StoryState = { ...story, ...maj, ...majLore };
  const avecMemoire: StoryState = { ...storyMaj, memoireNarrative: synchroniserMemoireNarrative(storyMaj) };
  return reconcilierNarrativeCoreV12(avecMemoire);`,
  'reconcile V12 after derived-state refresh',
);

replaceOnce(
  `  const heuristique = validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom);
  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);
  const repetitionLocale = validerRepetitionLocale(reponse, storyCourante);
  const rapportLocal = fusionnerRapports(heuristique, profilContenuCheck, repetitionLocale);`,
  `  const heuristique = validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom);
  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);
  const repetitionLocale = validerRepetitionLocale(reponse, storyCourante);
  const canonLocal = verifierEntitesCanoniques(reponse, storyCourante, messageJoueur);
  const rapportLocal = fusionnerRapports(heuristique, profilContenuCheck, repetitionLocale, canonLocal);`,
  'macro canon validation',
);

replaceOnce(
  `  if (reponseFaitParlerLeJoueur(reponse, storyCourante.meta.personnageNom)) {`,
  `  // Dernier garde-fou déterministe : une réparation/régénération peut
  // réintroduire une macro-entité inventée. On la neutralise localement
  // avant affichage et avant commit dans l'Event Ledger.
  const canonFinal = verifierEntitesCanoniques(reponse, storyCourante, messageJoueur);
  if (!canonFinal.ok) {
    reponse = appliquerPatchLocal(reponse, canonFinal);
    aEteCorrige = true;
  }

  if (reponseFaitParlerLeJoueur(reponse, storyCourante.meta.personnageNom)) {`,
  'final canon patch',
);

fs.writeFileSync(path, s);
console.log('Canon Entity Guard V13 câblé dans generateTurn.ts.');
