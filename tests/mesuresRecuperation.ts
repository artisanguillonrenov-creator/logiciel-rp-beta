// Mesures de la chaîne de récupération (pas un test : le script n'est pas lancé
// par `npm test`). Après `npx tsc -p tsconfig.test.json` :
//   node .test-dist/tests/mesuresRecuperation.js
// Il reconstitue, avec les fonctions pures du jeu, ce qui part au narrateur
// pour quelques scènes, avec les budgets des moteurs local et distant.
import { donneesMonde } from '../src/mondes/donnees';
import { construirePassages, selectionnerPassages, selectionnerPassagesDetaille } from '../src/engine/passagesLore';
import { resoudreEntitesScene } from '../src/engine/entitesScene';
import { BUDGET_SYSTEM_DISTANT, BUDGET_SYSTEM_LOCAL, construireSystemPromptDetaille } from '../src/engine/promptBuilder';
import { construireBlocsContexte, formaterBlocsContexte, synchroniserMemoireNarrative } from '../src/engine/memoireNarrative';
import { preparerTour } from '../src/engine/ficheScene';
import { creerNouvelleHistoire } from '../src/engine/story';
import { assurerNoyau, construireContexteNoyau } from '../src/engine/noyauNarratif';
import { construireContratNarratifNatif } from '../src/engine/narrativeBehaviorKernel';
import type { StoryState } from '../src/types';

const LORE = donneesMonde('elyndor').lore;
const REGLAGES = { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' } as const;

function histoire(tours: number): StoryState {
  const story = creerNouvelleHistoire({
    personnageNom: 'Sylvana',
    personnageDescription: 'Elfe noire, rôdeuse, peau ébène, cheveux argentés tressés. '.repeat(10),
    pointDeDepart: 'Paris, sous la pluie.',
    contexte: { lieu: 'Paris', ambiance: 'Sombre', dateChronique: '', objectifs: 'Retrouver la caravane' },
    settings: { ...REGLAGES },
  });
  const narrateur = (i: number) => `Sylvana avance dans la rue ${i}. Maître Kael hoche la tête, Bram forge une lame près de la porte ${i}. La pluie tombe sur Paris. `.repeat(5);
  for (let i = 0; i < tours; i++) {
    story.messages.push({ id: `u${i}`, role: 'user', content: `Je parle à Kael du marché ${i}.`, timestamp: 1000 + i * 2 });
    story.messages.push({ id: `a${i}`, role: 'assistant', content: narrateur(i), timestamp: 1001 + i * 2 });
  }
  story.loreEmergent.push({ id: 'kael', categorie: 'pnj', titre: 'Maître Kael', contenu: 'Chef de guilde en robe noire.', statut: 'provisoire', premiereMention: 1, dernierAcces: 1 } as any);
  return story;
}

function percentile(valeurs: number[], p: number): number {
  const t = [...valeurs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.floor(p * t.length))];
}

function chrono<T>(n: number, action: () => T): { dernier: T; mediane: number; p95: number } {
  const durees: number[] = [];
  let dernier!: T;
  for (let i = 0; i < n; i++) {
    const debut = process.hrtime.bigint();
    dernier = action();
    durees.push(Number(process.hrtime.bigint() - debut) / 1e6);
  }
  return { dernier, mediane: percentile(durees, 0.5), p95: percentile(durees, 0.95) };
}

const SCENES = [
  { id: 'T01', message: 'Je me rends à la Guilde des Aventuriers de Paris.' },
  { id: 'T08', message: 'Je discute avec Kael près de la fontaine, de la pluie, des pavés, des étals, des corbeaux, des enseignes, des lanternes, des cordes, des tonneaux et des barques.' },
];

function mesurerScene(story: StoryState, message: string, budgetSysteme: number) {
  const preparation = preparerTour(story, message);
  const requeteMessage = [preparation.ville && `Ville : ${preparation.ville}`, preparation.intention.lieu && `Lieu visé : ${preparation.intention.lieu.libelle}`, ...preparation.intention.fiches, message].filter(Boolean).join('\n');
  const requeteScene = [preparation.ville && `Ville : ${preparation.ville}`, story.messages.at(-1)?.content].filter(Boolean).join('\n');
  const passages = construirePassages(LORE);
  const resolution = resoudreEntitesScene({
    pool: LORE, messageJoueur: message, ville: preparation.ville, lieuActuel: story.scene?.lieu || undefined,
    destination: preparation.intention.lieu?.libelle, fichesIntention: preparation.intention.fiches,
    derniereReponse: story.messages.at(-1)?.content, memoire: [story.memoire.resume], presents: [],
  });
  const ancres = resolution.ancresP0;
  const { entrees: lore, rapport } = selectionnerPassagesDetaille(passages, requeteScene, { requeteMessage, ancres, raisonsAncres: resolution.raisons });
  const evenements = synchroniserMemoireNarrative(story);
  const noyauStory = assurerNoyau(story, evenements);
  const noyau = construireContexteNoyau(noyauStory, message);
  const idsNoyau = new Set(noyau.idsMessages);
  const blocs = construireBlocsContexte(story, message, evenements, { exclureMessageIds: idsNoyau });
  const contrat = construireContratNarratifNatif(noyauStory, message, 'adulte');
  const { texte: prompt, rapport: rapportPrompt } = construireSystemPromptDetaille({
    meta: story.meta, settings: story.settings, resume: '', faits: [], loreElyndor: lore, messagesRecents: [], messageJoueur: message,
    contratNarratif: contrat.texte,
    contexteP0: formaterBlocsContexte(blocs.blocs.filter((b) => b.niveau === 'P0')),
    blocsContexte: [noyau.texte, formaterBlocsContexte(blocs.blocs.filter((b) => b.niveau !== 'P0'), false)].filter(Boolean).join('\n\n'),
    etatMonde: noyau.texteMonde, engagementsEtRelations: noyau.texteSocial, souvenirs: '', ficheScene: preparation.fiche, directiveEtat: noyau.directive,
  }, { budgetSysteme });
  const selectionnes = lore.reduce((n, e) => n + e.titre.length + e.contenu.length + 6, 0);
  const transmis = lore.map((e) => {
    const present = prompt.includes(`### ${e.titre}`);
    const fin = e.contenu.slice(-40);
    return { titre: e.titre, ancre: ancres.has(e.id), titrePresent: present, contenuComplet: present && prompt.includes(fin) };
  });
  const perdus = transmis.filter((t) => !t.contenuComplet);
  return {
    budgetSysteme,
    prompt: prompt.length,
    avantContexteVariable: prompt.indexOf('[PERSONNAGE DE {{user}}]'),
    noyauTexte: noyau.texte.length,
    blocsMemoire: formaterBlocsContexte(blocs.blocs).length,
    noyauEtMemoireDansLePrompt: (() => { const i = prompt.indexOf('[MÉMOIRE NARRATIVE PERTINENTE]'); return i < 0 ? 0 : prompt.slice(i).split('\n\n[')[0].length; })(),
    contrat: contrat.texte.length,
    fiche: preparation.fiche.length,
    loreSelectionne: `${lore.length} fiches, ${selectionnes} car.`,
    loreCoupeOuAbsent: perdus.map((t) => `${t.ancre ? '[ancre] ' : ''}${t.titre}${t.titrePresent ? ' (tronquée)' : ' (absente)'}`),
    blocsSelectionnes: `${blocs.blocs.length} blocs, ${blocs.totalCaracteres} car.`,
    blocsPresents: formaterBlocsContexte(blocs.blocs).split('\n').slice(1).filter((l) => prompt.includes(l.slice(0, 60))).length,
    niveauxLore: lore.map((e) => `${e.niveau} ${e.titre}`),
    manquesLore: rapport.manques,
    manquesPrompt: rapportPrompt.manques,
    avertissements: rapportPrompt.avertissements,
  };
}

const sortie: Record<string, unknown> = { scenes: {}, performances: {} };
for (const tours of [20, 1200]) {
  const story = histoire(tours);
  for (const scene of SCENES) {
    (sortie.scenes as any)[`${scene.id} · ${tours} tours · local`] = mesurerScene(story, scene.message, BUDGET_SYSTEM_LOCAL);
    (sortie.scenes as any)[`${scene.id} · ${tours} tours · distant`] = mesurerScene(story, scene.message, BUDGET_SYSTEM_DISTANT);
  }
  const passages = chrono(10, () => construirePassages(LORE));
  const selection = chrono(30, () => selectionnerPassages(passages.dernier, 'Ville : Paris\nSylvana avance.', { requeteMessage: 'Je me rends à la Guilde des Aventuriers de Paris.' }));
  const memoire = chrono(20, () => synchroniserMemoireNarrative(story));
  const blocs = chrono(20, () => construireBlocsContexte(story, SCENES[1].message, memoire.dernier));
  (sortie.performances as any)[`${tours} tours`] = {
    passagesLore: passages.dernier.length,
    'construirePassages (ms, médiane/p95)': [passages.mediane.toFixed(2), passages.p95.toFixed(2)],
    'selectionnerPassages (ms)': [selection.mediane.toFixed(2), selection.p95.toFixed(2)],
    'synchroniserMemoireNarrative (ms)': [memoire.mediane.toFixed(2), memoire.p95.toFixed(2)],
    'construireBlocsContexte (ms)': [blocs.mediane.toFixed(2), blocs.p95.toFixed(2)],
    evenements: memoire.dernier.length,
  };
}
console.log(JSON.stringify(sortie, null, 2));
