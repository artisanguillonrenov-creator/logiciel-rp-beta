import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import { calculerRattrapageNarratif } from '../src/automation/narrativePostprocess';
import { messagesAppelPeriodiqueGroupe } from '../src/engine/extractionGroupee';
import { paquetMonde } from '../src/mondes';
import type { AppSettings, DiagnosticEtape, Message, StoryState } from '../src/types';

const REGLAGES: AppSettings = {
  openRouterApiKey: 'cle-test',
  model: 'fiction/modele:free',
  moteurInference: 'serveur',
  fournisseurNarration: 'openrouter',
  profilContenu: 'adulte',
};

type Appel = 'groupe-periodique' | 'groupe-tour' | 'memoire' | 'directeur' | 'monde' | 'social' | 'scene' | 'lore';

function typeAppel(systeme: string): Appel {
  if (systeme.includes('=== BLOC "memoire" ===')) return 'groupe-periodique';
  if (systeme.includes('=== BLOC "scene" ===')) return 'groupe-tour';
  if (systeme.includes('module de mémoire')) return 'memoire';
  if (systeme.includes('directeur narratif')) return 'directeur';
  if (systeme.includes("tenir à jour l'état du monde")) return 'monde';
  if (systeme.includes('suivre les engagements')) return 'social';
  if (systeme.includes("Tu tiens l'état de la scène")) return 'scene';
  if (systeme.includes('LORE ÉMERGENT')) return 'lore';
  throw new Error(`Appel inattendu : ${systeme.slice(0, 80)}`);
}

interface Requete { type: Appel; systeme: string; utilisateur: string }

/** Remplace le réseau : chaque appel est reconnu par sa consigne système. */
async function avecModele<T>(repondre: (type: Appel) => string, fn: (requetes: Requete[]) => Promise<T>): Promise<T> {
  const sauvegarde = globalThis.fetch;
  const requetes: Requete[] = [];
  globalThis.fetch = async (_input, init) => {
    const corps = JSON.parse(String(init?.body));
    const systeme = corps.messages.filter((m: { role: string }) => m.role === 'system').map((m: { content: string }) => m.content).join('\n');
    const utilisateur = corps.messages.filter((m: { role: string }) => m.role === 'user').map((m: { content: string }) => m.content).join('\n');
    const type = typeAppel(systeme);
    requetes.push({ type, systeme, utilisateur });
    return Response.json({ choices: [{ message: { content: repondre(type) } }] });
  };
  try { return await fn(requetes); } finally { globalThis.fetch = sauvegarde; }
}

const BLOCS_GROUPES = {
  memoire: { resume: 'Résumé groupé', faits: [] },
  directeur: { arcActuel: 'Arc groupé', tension: 'montante', beatMajeur: true, nouveauxBeats: ['Un secret évoqué'], beatsResolus: [] },
  monde: { appels: [{ outil: 'poser_flag', arguments: { nom: 'porte_ouverte', valeur: true } }] },
  social: { appels: [{ outil: 'ajouter_engagement', arguments: { type: 'promesse', description: 'Revenir demain', partie: 'Garde' } }] },
};
const BLOCS_TOUR = {
  scene: { ville: 'Paris', lieu: 'porte nord', presents: ['Garde'], minutesEcoulees: 10 },
  lore: { candidats: [{ categorie: 'lieu', titre: 'Porte du Nord', contenu: 'Une porte gardée de Paris.' }] },
};

function reponseSeparee(type: Appel): string {
  switch (type) {
    case 'memoire': return '{"resume":"Résumé séparé","faits":[]}';
    case 'directeur': return '{"arcActuel":"Arc séparé","tension":"calme","beatMajeur":false,"nouveauxBeats":[],"beatsResolus":[]}';
    case 'monde': return 'Aucun outil.';
    case 'social': return 'Aucun outil.';
    case 'scene': return '{"ville":"Paris","lieu":"lieu séparé","presents":[],"minutesEcoulees":3}';
    case 'lore': return '{"candidats":[]}';
    default: return 'pas du JSON';
  }
}

function reponseNominale(type: Appel): string {
  if (type === 'groupe-periodique') return JSON.stringify(BLOCS_GROUPES);
  if (type === 'groupe-tour') return JSON.stringify(BLOCS_TOUR);
  return reponseSeparee(type);
}

function messages(nombre: number): Message[] {
  return Array.from({ length: nombre }, (_, i) => ({
    id: `m${i}`, role: i % 2 ? 'assistant' as const : 'user' as const, content: `Échange ${i} devant la porte de Paris.`, timestamp: i,
  }));
}

function histoire(nombre: number, mondeId?: string): StoryState {
  const story = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Voyageur',
    pointDeDepart: 'Paris',
    contexte: { lieu: 'Paris', ambiance: 'Sombre', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
    mondeId,
  });
  story.meta.id = 'story-groupee';
  story.messages = messages(nombre);
  return story;
}

/** 8 messages : cycle périodique dû, lore (3 messages d'écart) et scène dus. */
function histoireCycleComplet(): StoryState {
  const story = histoire(8);
  story.loreEmergentDernierIndex = 5;
  story.scene = { ville: 'Paris', presents: [], majMessageIndex: 6 };
  return story;
}

function etape(etapes: DiagnosticEtape[], nom: string): DiagnosticEtape {
  const trouvee = etapes.find((e) => e.nom === nom);
  assert.ok(trouvee, `étape ${nom} absente`);
  return trouvee;
}

const ETAPES_PERIODIQUES = ['Mémoire L0-L5', 'Directeur narratif', 'Simulation du monde', 'Social / engagements'];

test('cas nominal : deux appels groupés remplacent six appels séparés et chaque bloc est appliqué', async () => {
  await avecModele(reponseNominale, async (requetes) => {
    const patch = (await calculerRattrapageNarratif(histoireCycleComplet(), REGLAGES))!;
    assert.deepEqual(requetes.map((r) => r.type).sort(), ['groupe-periodique', 'groupe-tour']);
    assert.equal(patch.memoire.resume, 'Résumé groupé');
    assert.equal(patch.memoire.dernierMessageIndexMaj, 8);
    assert.equal(patch.directeur.arcActuel, 'Arc groupé');
    assert.equal(patch.directeur.dernierBeatIndex, 8);
    assert.equal(patch.monde.flags.porte_ouverte, true);
    assert.equal(patch.social.engagements[0]?.description, 'Revenir demain');
    assert.equal(patch.scene?.lieu, 'porte nord');
    assert.equal(patch.minutesEcoulees, 10);
    assert.ok(patch.loreEmergent.some((e) => e.titre === 'Porte du Nord'));
    assert.equal(patch.loreEmergentDernierIndex, 8);

    const etapes = patch.diagnosticPostTraitement!.etapes;
    for (const nom of [...ETAPES_PERIODIQUES, 'Lore émergent', 'État de scène']) {
      assert.equal(etape(etapes, nom).statut, 'ok', nom);
      assert.equal(etape(etapes, nom).mode, 'groupé', nom);
    }
    assert.equal(etape(etapes, 'Extraction groupée — périodique').statut, 'ok');
    assert.equal(etape(etapes, 'Extraction groupée — tour').statut, 'ok');
  });
});

test('un bloc invalide retombe sur son seul appel séparé, les autres blocs restent groupés', async () => {
  const repondre = (type: Appel) => {
    if (type === 'groupe-periodique') return JSON.stringify({ ...BLOCS_GROUPES, directeur: 'invalide', social: { appels: 'non' } });
    if (type === 'groupe-tour') return JSON.stringify({ ...BLOCS_TOUR, lore: { autre: [] } });
    return reponseSeparee(type);
  };
  await avecModele(repondre, async (requetes) => {
    const patch = (await calculerRattrapageNarratif(histoireCycleComplet(), REGLAGES))!;
    assert.deepEqual(requetes.map((r) => r.type).sort(), ['directeur', 'groupe-periodique', 'groupe-tour', 'lore', 'social']);
    assert.equal(patch.memoire.resume, 'Résumé groupé');
    assert.equal(patch.directeur.arcActuel, 'Arc séparé');
    assert.equal(patch.monde.flags.porte_ouverte, true);
    assert.equal(patch.scene?.lieu, 'porte nord');
    assert.equal(patch.loreEmergentDernierIndex, 8);

    const etapes = patch.diagnosticPostTraitement!.etapes;
    assert.equal(etape(etapes, 'Mémoire L0-L5').mode, 'groupé');
    for (const nom of ['Directeur narratif', 'Social / engagements', 'Lore émergent']) {
      assert.equal(etape(etapes, nom).statut, 'repli', nom);
      assert.equal(etape(etapes, nom).mode, 'séparé', nom);
      assert.match(etape(etapes, nom).raison ?? '', /Bloc groupé absent ou invalide/);
    }
  });
});

test('un appel groupé inexploitable retombe entièrement sur les appels séparés sans perdre l’état', async () => {
  const repondre = (type: Appel) => (type.startsWith('groupe') ? 'Désolé, je ne peux pas.' : reponseSeparee(type));
  await avecModele(repondre, async (requetes) => {
    const story = histoireCycleComplet();
    const patch = (await calculerRattrapageNarratif(story, REGLAGES))!;
    assert.deepEqual(requetes.map((r) => r.type).sort(),
      ['directeur', 'groupe-periodique', 'groupe-tour', 'lore', 'memoire', 'monde', 'scene', 'social']);
    assert.equal(patch.memoire.resume, 'Résumé séparé');
    assert.equal(patch.memoire.dernierMessageIndexMaj, 8);
    assert.equal(patch.directeur.arcActuel, 'Arc séparé');
    assert.equal(patch.scene?.lieu, 'lieu séparé');
    const etapes = patch.diagnosticPostTraitement!.etapes;
    assert.equal(etape(etapes, 'Extraction groupée — périodique').statut, 'repli');
    for (const nom of [...ETAPES_PERIODIQUES, 'Lore émergent', 'État de scène']) {
      assert.equal(etape(etapes, nom).mode, 'séparé', nom);
      assert.match(etape(etapes, nom).raison ?? '', /Appel groupé échoué/, nom);
    }
  });
});

test('un appel groupé en erreur réseau retombe aussi sur les appels séparés', async () => {
  const sauvegarde = globalThis.fetch;
  const types: Appel[] = [];
  globalThis.fetch = async (_input, init) => {
    const corps = JSON.parse(String(init?.body));
    const type = typeAppel(corps.messages.filter((m: { role: string }) => m.role === 'system').map((m: { content: string }) => m.content).join('\n'));
    types.push(type);
    if (type.startsWith('groupe')) throw new TypeError('réseau coupé');
    return Response.json({ choices: [{ message: { content: reponseSeparee(type) } }] });
  };
  try {
    const patch = (await calculerRattrapageNarratif(histoireCycleComplet(), REGLAGES))!;
    assert.equal(patch.memoire.resume, 'Résumé séparé');
    assert.equal(patch.scene?.lieu, 'lieu séparé');
    assert.ok(types.includes('memoire') && types.includes('scene'));
  } finally { globalThis.fetch = sauvegarde; }
});

test('interrupteur désactivé : uniquement les appels séparés, comme avant', async () => {
  await avecModele(reponseNominale, async (requetes) => {
    const patch = (await calculerRattrapageNarratif(histoireCycleComplet(), { ...REGLAGES, extractionGroupee: false }))!;
    assert.deepEqual(requetes.map((r) => r.type).sort(), ['directeur', 'lore', 'memoire', 'monde', 'scene', 'social']);
    assert.equal(patch.memoire.resume, 'Résumé séparé');
    const etapes = patch.diagnosticPostTraitement!.etapes;
    assert.ok(!etapes.some((e) => e.nom.startsWith('Extraction groupée')));
    for (const nom of [...ETAPES_PERIODIQUES, 'Lore émergent', 'État de scène']) {
      assert.equal(etape(etapes, nom).statut, 'ok', nom);
      assert.equal(etape(etapes, nom).mode, 'séparé', nom);
    }
  });
});

test('hors cadence du lore, l’état de scène garde son appel dédié', async () => {
  const story = histoire(4);
  story.loreEmergentDernierIndex = 2;
  story.scene = { ville: 'Paris', presents: [], majMessageIndex: 2 };
  await avecModele(reponseNominale, async (requetes) => {
    const patch = (await calculerRattrapageNarratif(story, REGLAGES))!;
    assert.deepEqual(requetes.map((r) => r.type), ['scene']);
    assert.equal(etape(patch.diagnosticPostTraitement!.etapes, 'État de scène').mode, 'séparé');
  });
});

test('le profil Grand public filtre les messages transmis à l’appel groupé', async () => {
  const story = histoireCycleComplet();
  story.messages[3] = { ...story.messages[3], content: 'Une mare de sang recouvre le sol.' };
  await avecModele(reponseNominale, async (requetes) => {
    await calculerRattrapageNarratif(story, { ...REGLAGES, profilContenu: 'grand_public' });
    const periodique = requetes.find((r) => r.type === 'groupe-periodique')!;
    assert.ok(!periodique.utilisateur.includes('mare de sang'));
    assert.match(periodique.utilisateur, /Contenu antérieur masqué par le profil Grand public/);
    assert.ok(!requetes.find((r) => r.type === 'groupe-tour')!.utilisateur.includes('mare de sang'));
  });
});

test('chapitre : l’appel groupé propose avancer_chapitre et l’avancée suit la même validation que l’appel séparé', async () => {
  const ID = 'gardiens-de-la-galaxie';
  const preparer = (nombre: number, depuis: number) => {
    const story = histoire(nombre, ID);
    story.memoire = { ...story.memoire, dernierMessageIndexMaj: depuis };
    story.loreEmergentDernierIndex = nombre;
    story.scene = { presents: [], majMessageIndex: nombre };
    return story;
  };
  const appels = [
    { outil: 'avancer_chapitre', arguments: { vers: 'II' } },
    { outil: 'avancer_chapitre', arguments: { vers: 'III' } },
  ];
  const repondre = (type: Appel) => (type === 'groupe-periodique'
    ? JSON.stringify({ ...BLOCS_GROUPES, monde: { appels } })
    : reponseSeparee(type));

  // Délai minimal écoulé (12 messages) : avancée immédiate vers II, aucun saut vers III.
  const pret = preparer(12, 4);
  const consigne = messagesAppelPeriodiqueGroupe({
    appSettings: REGLAGES, messages: pret.messages, depuisIndex: 4, personnageNom: 'William',
    memoire: pret.memoire, directeur: pret.directeur, monde: pret.monde, social: pret.social,
    chapitres: paquetMonde(ID).chapitres,
  })[0].content;
  assert.match(consigne, /- avancer_chapitre\(vers: string parmi \(II\)\)/);
  await avecModele(repondre, async (requetes) => {
    const patch = (await calculerRattrapageNarratif(pret, REGLAGES))!;
    assert.deepEqual(requetes.map((r) => r.type), ['groupe-periodique']);
    assert.equal(patch.monde.chapitreId, 'II');
    assert.equal(patch.monde.chapitreDepuisMessage, 12);
    assert.equal(patch.monde.chapitreEnAttente, undefined);
    assert.equal(etape(patch.diagnosticPostTraitement!.etapes, 'Simulation du monde').mode, 'groupé');
  });

  // Trop tôt (9 messages) : l'avancée est mise en attente, exactement comme par l'appel séparé.
  const tropTot = preparer(9, 1);
  const groupe = await avecModele(repondre, async () => (await calculerRattrapageNarratif(tropTot, REGLAGES))!.monde);
  const sauvegarde = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const corps = JSON.parse(String(init?.body));
    const type = typeAppel(corps.messages.filter((m: { role: string }) => m.role === 'system').map((m: { content: string }) => m.content).join('\n'));
    if (type === 'monde') {
      return Response.json({ choices: [{ message: { content: '', tool_calls: appels.map((a, i) => ({
        id: `t${i}`, type: 'function', function: { name: a.outil, arguments: JSON.stringify(a.arguments) },
      })) } }] });
    }
    return Response.json({ choices: [{ message: { content: reponseSeparee(type) } }] });
  };
  let separe;
  try {
    separe = (await calculerRattrapageNarratif(tropTot, { ...REGLAGES, extractionGroupee: false }))!.monde;
  } finally { globalThis.fetch = sauvegarde; }
  assert.equal(groupe.chapitreId, undefined);
  assert.ok(groupe.chapitreEnAttente, 'avancée non mise en attente');
  assert.deepEqual(groupe.chapitreEnAttente, separe.chapitreEnAttente);
  assert.equal(groupe.chapitreId, separe.chapitreId);
});
