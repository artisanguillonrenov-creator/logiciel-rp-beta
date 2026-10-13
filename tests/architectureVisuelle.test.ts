import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Tests statiques du contrat d'architecture visuelle : aucun écran ni job ne
// contourne le service visuel central, et l'ancien « directeur artistique »
// n'existe plus dans le code exécuté.
const RACINE = join(__dirname, '..', '..');
const SRC = join(RACINE, 'src');

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    // Les fichiers générés (copie texte des sources pour le labo) ne sont pas du code exécuté.
    return /\.(ts|tsx)$/.test(nom) && !/\.generated\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

const SOURCES = fichiers(SRC).map((chemin) => ({ chemin: relative(RACINE, chemin).split(sep).join('/'), texte: readFileSync(chemin, 'utf8') }));

test('V13 — seul le service visuel appelle un générateur d’images', () => {
  const executeurs = /\b(adaptateurSelonReglages|genererImageElyndorCloud|genererImageOpenAI|genererImageSelonReglages)\b/;
  const autorises = new Set([
    'src/engine/serviceVisuel.ts',
    'src/engine/fournisseursImages.ts',
    'src/engine/elyndorCloudImages.ts',
    'src/engine/openAiImages.ts',
  ]);
  const fautifs = SOURCES.filter((f) => !autorises.has(f.chemin) && executeurs.test(f.texte)).map((f) => f.chemin);
  assert.deepEqual(fautifs, []);
  const appelsDirects = SOURCES.filter((f) => !autorises.has(f.chemin) && /\/images\/(generations|edits)|\+\s*'\/images'/.test(f.texte)).map((f) => f.chemin);
  assert.deepEqual(appelsDirects, []);
});

test('V14 — l’aperçu de scène et l’illustration du jeu partagent la même préparation', () => {
  const routine = SOURCES.find((f) => f.chemin === 'src/automation/visualRoutines.ts')!.texte;
  const apercu = SOURCES.find((f) => f.chemin === 'src/components/AtelierApercuImage.tsx')!.texte;
  for (const texte of [routine, apercu]) {
    assert.match(texte, /from '\.\.\/engine\/illustrationScene'/);
    assert.match(texte, /preparerScene\(/);
    assert.match(texte, /executerImage\(/);
  }
  // L'aperçu n'enregistre rien dans l'histoire.
  assert.doesNotMatch(apercu, /updateStoryIf|saveStory|enregistrerIllustrationScene/);
});

test('V27 — plus aucune trace runtime du directeur artistique ni des gabarits de modèle', () => {
  const interdits = /directeur artistique|demanderDirectionArtistique|INSTRUCTION_DIRECTION|GABARIT_PROMPT_|CONSIGNE_PROMPT_SDXL|redigerPromptSdxl|construirePromptSdxl|visualBible|directionArtistique|directionIllustration/i;
  const fautifs = SOURCES.filter((f) => interdits.test(f.texte)).map((f) => f.chemin);
  assert.deepEqual(fautifs, []);
});

test('V23 — aucun nom de modèle d’image dans le moteur visuel générique', () => {
  const generiques = [
    'src/engine/moteurVisuel.ts', 'src/engine/contratVisuel.ts', 'src/engine/extracteurVisuel.ts', 'src/engine/cadrageVisuel.ts',
    'src/engine/serviceVisuel.ts', 'src/engine/sceneVisuelle.ts', 'src/engine/illustrationScene.ts', 'src/engine/images.ts',
    'src/concepteur/reglagesVisuels.ts', 'src/components/AtelierVisuelPanel.tsx', 'src/components/AtelierApercuImage.tsx',
  ];
  for (const chemin of generiques) {
    const texte = SOURCES.find((f) => f.chemin === chemin)!.texte;
    // contratVisuel lit l'ancien champ des scènes V2 (« promptSdxl ») pour la migration, et
    // sa liste de mots de style à écarter cite volontairement ces noms : seules exceptions.
    const sansMigration = chemin === 'src/engine/contratVisuel.ts'
      ? texte.replace(/promptSdxl/g, '').replace(/const MOTS_DE_STYLE = .*\n/, '')
      : texte;
    assert.doesNotMatch(sansMigration, /lustify|sdxl|chroma|\bflux\b|clip encoder/i, chemin);
  }
});
