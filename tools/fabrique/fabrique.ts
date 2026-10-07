/**
 * Fabrique d'exemples pour entraîner un narrateur léger (Mistral Small 24B).
 *
 * Le professeur (Euryale 70B sur le pod) joue des parties complètes avec le
 * vrai moteur de prompt de l'application : prompt complet, métamoteurs
 * compris. Un joueur simulé (même modèle, autre consigne) répond à chaque
 * tour. Chaque réponse du narrateur passe les contrôles de l'application ;
 * un échec est régénéré une fois avec la note de correction, comme dans
 * generateTurn.ts.
 *
 * Pour chaque réponse, l'échantillon enregistré est le prompt ÉLÈVE : même
 * moteur, sans métamoteurs et avec des budgets réduits (voir CONFIG_ELEVE).
 * L'élève apprend ainsi à se comporter comme si les métamoteurs étaient là,
 * avec un prompt qui tient sur un GPU modeste.
 *
 * La fabrication se met en pause dès que quelqu'un d'autre utilise le pod
 * (le joueur sur l'application), et reprend après PAUSE_APRES_ACTIVITE_MS
 * sans activité.
 *
 * Usage : node .fabrique-dist/tools/fabrique/fabrique.js <dossierSortie> [nbParties] [dureeMaxMinutes]
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import metamoteursRaw from '../../src/data/metamoteurs.json';
import elyndorRaw from '../../src/data/elyndorLore.json';
import type { LoreEntry, Message, StorySettings, StoryState } from '../../src/types';
import { construireMessages, maxTokensPourLongueur, temperaturePourCreativite, type ContexteConstruction } from '../../src/engine/promptBuilder';
import { construirePassages, selectionnerPassages } from '../../src/engine/passagesLore';
import { chargerLoreElyndor, chargerMetamoteurs, type ElyndorEntryChargee } from '../../src/engine/loreLoader';
import { instructionRegistreAdulte } from '../../src/engine/contenuAdulte';
import { corrigerEtiquettes, trouverEchoDuJoueur, validerGestesDuJoueur, validerRolesCanon } from '../../src/engine/controlesCoherence';
import { validerAgentiviteHeuristique } from '../../src/engine/validator';
import { INSTRUCTION_OUVERTURE, ecartsContratOuverture } from '../../src/engine/controleOuverture';
import { couperALaDernierePhraseComplete } from '../../src/engine/completionReponse';
import { preparerTour } from '../../src/engine/ficheScene';
import { ROLES_CANON } from '../../src/engine/canonElyndor';
import { prenomRole, rolesDeLaVille } from '../../src/engine/rolesCanon';

const executer = promisify(execFile);

export const URL_POD = process.env.FABRIQUE_URL ?? 'https://ot7y2dg831r3i3-8000.proxy.runpod.net';
const MODELE = 'euryale-70b-v2.3';

/** Prompt de l'élève : à reproduire à l'identique dans l'application pour le modèle entraîné. */
export const CONFIG_ELEVE = { budgetSysteme: 24000, budgetConversation: 9000, metamoteurs: false };
const CONFIG_PROFESSEUR = { budgetSysteme: 64000, budgetConversation: 13000 };

// Ajoutée au message du joueur pour le professeur seulement : l'élève
// apprend la bonne habitude sans avoir besoin de la consigne.
const CONSIGNE_PROFESSEUR = "\n\n(Narration : ne reformule pas ce que je viens de faire ou dire ; commence directement par les réactions des autres personnages et les conséquences.)";

const PAUSE_APRES_ACTIVITE_MS = Number(process.env.FABRIQUE_PAUSE_MIN ?? 15) * 60 * 1000;
const TOURS_MIN = 14;
const TOURS_MAX = 28;
const RESUME_TOUS_LES = 6;

// ---------------------------------------------------------------- mondes

interface Depart { lieu: string; ambiance: string; pointDeDepart: string }
interface Monde {
  id: string;
  nom: string;
  genre: string;
  core: string | null;
  entrees: { titre: string; contenu: string }[];
  personnages: { nom: string; description: string }[];
  departs: Depart[];
}

export function chargerMondes(dossier = process.env.FABRIQUE_MONDES ?? path.join(__dirname, '..', '..', '..', 'tools', 'fabrique', 'mondes')): Monde[] {
  return fs.readdirSync(dossier).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8')));
}

const LORE_ELYNDOR = chargerLoreElyndor(elyndorRaw as any);
const METAMOTEURS = chargerMetamoteurs(metamoteursRaw as any);

function entreesDuMonde(monde: Monde): ElyndorEntryChargee[] {
  if (monde.id === 'elyndor') return LORE_ELYNDOR;
  return monde.entrees.map((e, i) => ({ id: `${monde.id}-${i}`, titre: e.titre, contenu: e.contenu, motsClesNegatifs: [], priority: 0, constant: false }));
}

const cachePassages = new Map<string, ReturnType<typeof construirePassages>>();
function passagesDuMonde(monde: Monde) {
  if (!cachePassages.has(monde.id)) cachePassages.set(monde.id, construirePassages(entreesDuMonde(monde)));
  return cachePassages.get(monde.id)!;
}

/** Métamoteurs du professeur ; « Elyndor » neutralisé hors d'Elyndor. */
function metamoteursPour(monde: Monde): LoreEntry[] {
  return METAMOTEURS.map((e) => ({
    id: e.id,
    titre: e.titre,
    contenu: monde.id === 'elyndor' ? e.contenu : e.contenu.replace(/d['’]Elyndor/g, 'du monde').replace(/Elyndor/g, 'le monde'),
  }));
}

// ---------------------------------------------------------------- hasard

let graine = Number(process.env.FABRIQUE_GRAINE ?? Date.now() % 2147483647);
function hasard(): number {
  graine = (graine * 48271) % 2147483647;
  return graine / 2147483647;
}
function choisir<T>(liste: readonly T[]): T {
  return liste[Math.floor(hasard() * liste.length)];
}

const STYLES_JOUEUR = [
  'laconique : phrases très courtes, actions directes, peu de mots',
  'bavard et expressif : longues répliques entre guillemets, beaucoup de dialogue',
  'impulsif et violent : provoque, menace, passe vite à l’action physique',
  'séducteur : drague, sous-entendus, cherche le contact et l’intimité (contenu adulte permis)',
  'stratège : pose des questions précises, négocie, observe avant d’agir',
  'explorateur curieux : fouille les lieux, examine les objets, s’intéresse au lore',
  'négociateur retors : marchande, ment, cherche son avantage',
  'humour noir : réplique avec ironie et sarcasme, mais agit sérieusement',
  'meneur : donne des ordres, prend des décisions, entraîne les autres',
  'prudent et méfiant : vérifie tout, refuse les propositions trop belles',
];

function reglagesAleatoires(): StorySettings {
  return {
    creativite: choisir(['moyenne', 'moyenne', 'elevee', 'faible'] as const),
    longueur: choisir(['moyenne', 'moyenne', 'longue', 'courte'] as const),
    ton: choisir(['sombre_realiste', 'sombre_realiste', 'mysterieux_intrigant', 'heroique_epique', 'leger_aventureux'] as const),
    violence: choisir(['modere', 'eleve', 'extreme'] as const),
    romance: choisir(['moyen', 'eleve', 'faible'] as any),
    humour: choisir(['faible', 'moyen'] as any),
    liberteJoueur: 'elevee',
    rythme: choisir(['normal', 'normal', 'lent', 'rapide'] as const),
  } as StorySettings;
}

// ---------------------------------------------------------------- pod

interface Appel { messages: { role: string; content: string }[]; temperature: number; maxTokens: number }
interface Sortie { texte: string; coupe: boolean }

let dernierEtrangerMs = 0;
let enAppel = false;

async function curlJson(url: string, corps?: unknown, delaiS = 300): Promise<any> {
  const args = ['-s', '-m', String(delaiS), url];
  let fichier: string | undefined;
  if (corps !== undefined) {
    fichier = path.join(process.env.FABRIQUE_TMP ?? '/tmp', `req-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(fichier, JSON.stringify(corps));
    args.push('-H', 'Content-Type: application/json', '-d', `@${fichier}`);
  }
  try {
    const { stdout } = await executer('curl', args, { maxBuffer: 64 * 1024 * 1024 });
    return url.endsWith('/metrics') ? stdout : JSON.parse(stdout);
  } finally {
    if (fichier) fs.rmSync(fichier, { force: true });
  }
}

/** Activité d'un autre client (l'application) : slot occupé hors de nos appels, ou requête en attente. */
async function sonderActivite(): Promise<void> {
  try {
    if (!enAppel) {
      const slots = await curlJson(`${URL_POD}/slots`, undefined, 15);
      if (Array.isArray(slots) && slots.some((s: any) => s.is_processing)) dernierEtrangerMs = Date.now();
    }
    const metriques: string = await curlJson(`${URL_POD}/metrics`, undefined, 15);
    const differees = Number(metriques.match(/llamacpp:requests_deferred\s+(\d+)/)?.[1] ?? 0);
    if (differees > 0) dernierEtrangerMs = Date.now();
  } catch {
    // Pod injoignable : l'appel suivant échouera et sera retenté.
  }
}

async function attendre(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function attendreLibre(journal: (m: string) => void) {
  await sonderActivite();
  let annonce = false;
  while (Date.now() - dernierEtrangerMs < PAUSE_APRES_ACTIVITE_MS) {
    if (!annonce) journal('pause : le pod est utilisé par l’application');
    annonce = true;
    await attendre(20000);
    await sonderActivite();
  }
  if (annonce) journal('reprise : plus d’activité sur le pod');
}

let surveillance: NodeJS.Timeout | undefined;

async function appeler(appel: Appel, journal: (m: string) => void): Promise<Sortie> {
  for (let essai = 0; essai < 4; essai++) {
    await attendreLibre(journal);
    enAppel = true;
    try {
      const r = await curlJson(`${URL_POD}/v1/chat/completions`, {
        model: MODELE,
        messages: appel.messages,
        temperature: appel.temperature,
        max_tokens: appel.maxTokens,
      }, 400);
      const choix = r?.choices?.[0];
      if (!choix?.message) throw new Error(JSON.stringify(r).slice(0, 300));
      return { texte: String(choix.message.content ?? ''), coupe: choix.finish_reason === 'length' };
    } catch (e) {
      journal(`appel en échec (${essai + 1}/4) : ${e instanceof Error ? e.message.slice(0, 200) : e}`);
      await attendre(30000 * (essai + 1));
    } finally {
      enAppel = false;
    }
  }
  throw new Error('pod injoignable');
}

// ---------------------------------------------------------------- contrôles

const RE_REFUS = /^(je suis désolé|je ne peux pas|désolé,|en tant qu['’](ia|assistant)|i('| a)m sorry|i cannot|i can['’]t)/i;

export function controlerReponse(reponse: string, contexte: {
  messageJoueur: string;
  personnageNom: string;
  precedente?: string;
  monde: Monde;
  ville?: string;
  nomsConnus: string[];
  ouverture?: boolean;
}): string[] {
  const echecs: string[] = [];
  const texte = reponse.trim();
  if (RE_REFUS.test(texte)) echecs.push('refus du modèle');
  if (texte.length < 300) echecs.push('réponse trop courte');
  if (/\[(FICHE|PROTOCOLE|RAPPEL|STATE|ÉTAT)|```|\{\s*"/.test(texte)) echecs.push('fuite de consigne ou bloc machine');
  const guillemets = (texte.match(/«/g) ?? []).length;
  if (guillemets && !/^[ \t]*[A-ZÀ-Ý][A-ZÀ-Ý0-9' .-]{1,40}[ \t]*:[ \t]*«/m.test(texte)) echecs.push('répliques sans étiquette NOM : « »');
  const raisons = (r: { checks: { ok: boolean; raison: string }[] }) => r.checks.filter((c) => !c.ok).map((c) => c.raison);
  echecs.push(...raisons(validerAgentiviteHeuristique(texte, contexte.personnageNom)));
  echecs.push(...raisons(validerGestesDuJoueur(texte, contexte.messageJoueur, contexte.personnageNom)));
  const echo = contexte.ouverture ? undefined : trouverEchoDuJoueur(texte, contexte.messageJoueur);
  if (echo) echecs.push(`La réponse commence par reformuler l'action du joueur (« tu ${echo}… ») : enchaîne directement sur les réactions des autres et les conséquences.`);
  if (/^[ \t]*[A-ZÀ-Ý][A-ZÀ-Ý' .-]{1,40}\([^)]*\)[ \t]*:/m.test(texte)) echecs.push('étiquette de réplique avec parenthèses');
  if (contexte.monde.id === 'elyndor' && contexte.ville) {
    echecs.push(...raisons(validerRolesCanon(texte, rolesDeLaVille(ROLES_CANON, contexte.ville), contexte.nomsConnus)));
  }
  if (contexte.ouverture) echecs.push(...ecartsContratOuverture(texte, contexte.personnageNom));
  if (contexte.precedente) {
    const phrases = (t: string) => t.split(/(?<=[.!?»])\s+/).map((p) => p.trim().toLowerCase()).filter((p) => p.length > 25);
    const avant = new Set(phrases(contexte.precedente));
    const maintenant = phrases(texte);
    if (maintenant.length && maintenant.filter((p) => avant.has(p)).length / maintenant.length > 0.25) echecs.push('répétition de la réponse précédente');
  }
  return [...new Set(echecs)];
}

// ---------------------------------------------------------------- partie

interface Echantillon {
  tour: number;
  type: 'ouverture' | 'tour';
  messages: { role: string; content: string }[];
  reponse: string;
  ok: boolean;
  echecs: string[];
  corrige: boolean;
}

interface Partie {
  id: string;
  monde: string;
  personnage: { nom: string; description: string };
  depart: Depart;
  settings: StorySettings;
  styleJoueur: string;
  toursPrevus: number;
  resume: string;
  messages: Message[];
  echantillons: Echantillon[];
  terminee: boolean;
}

function storyPour(partie: Partie, monde: Monde): StoryState {
  return {
    meta: {
      id: partie.id,
      personnageNom: partie.personnage.nom,
      personnageDescription: partie.personnage.description,
      pointDeDepart: partie.depart.pointDeDepart,
      contexte: { lieu: partie.depart.lieu, ambiance: partie.depart.ambiance, dateChronique: '', objectifs: '' },
      createdAt: 0,
      updatedAt: 0,
    },
    messages: partie.messages,
    social: { engagements: [] },
    loreEmergent: [],
    memoire: { resume: partie.resume, faits: [] },
    monde: monde.nom,
  } as unknown as StoryState;
}

function contexte(partie: Partie, monde: Monde, messageJoueur: string, eleve: boolean, ouverture: boolean, noteCorrection?: string): ContexteConstruction {
  const story = storyPour(partie, monde);
  const passages = passagesDuMonde(monde);
  const derniere = [...partie.messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const preparation = monde.id === 'elyndor' ? preparerTour(story, ouverture ? `${partie.depart.lieu}\n${partie.depart.pointDeDepart}` : messageJoueur) : undefined;
  const requeteScene = [preparation?.ville && `Ville : ${preparation.ville}`, partie.depart.lieu, partie.resume, derniere].filter(Boolean).join('\n');
  const requeteMessage = ouverture ? `${partie.depart.lieu}\n${partie.depart.pointDeDepart}` : messageJoueur;
  // Fiches du lieu visé remontées d'office, comme dans calculerSelectionLore.
  const entrees = entreesDuMonde(monde);
  // PNJ du monde cités dans le départ ou les derniers messages : leur fiche remonte aussi.
  const texteScene = [partie.depart.pointDeDepart, ...partie.messages.slice(-3).map((m) => m.content), messageJoueur].join('\n').toLowerCase();
  const ancres = new Set(entrees.filter((e) => preparation?.intention.fiches.some((f) => e.titre.includes(f))
    || (monde.id !== 'elyndor' && /^PNJ — /.test(e.titre) && texteScene.includes(e.titre.replace(/^PNJ — /, '').split(/\s+/)[0].toLowerCase()))).map((e) => e.id));
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
    loreCore: monde.core ?? undefined,
    titreLore: monde.id === 'elyndor' ? undefined : `LORE ${monde.nom.toUpperCase()} PERTINENT`,
  };
}

function nomsConnus(partie: Partie, monde: Monde): string[] {
  return [
    partie.personnage.nom,
    ...monde.personnages.map((p) => p.nom),
    ...monde.entrees.map((e) => e.titre.replace(/^PNJ — /, '')),
    ...(monde.id === 'elyndor' ? ROLES_CANON.flatMap((r) => [r.nom, prenomRole(r)]) : []),
  ];
}

async function narrer(partie: Partie, monde: Monde, messageJoueur: string, ouverture: boolean, journal: (m: string) => void): Promise<Echantillon> {
  const temperature = temperaturePourCreativite(partie.settings.creativite);
  const maxTokens = maxTokensPourLongueur(partie.settings.longueur) + (ouverture ? 300 : 0);
  const precedente = [...partie.messages].reverse().find((m) => m.role === 'assistant')?.content;
  const ville = monde.id === 'elyndor' ? preparerTour(storyPour(partie, monde), messageJoueur || partie.depart.pointDeDepart).ville : undefined;
  const noms = nomsConnus(partie, monde);

  const tenter = async (note?: string) => {
    const sortie = await appeler({
      messages: construireMessages(contexte(partie, monde, messageJoueur, false, ouverture, note), CONFIG_PROFESSEUR),
      temperature,
      maxTokens,
    }, journal);
    let texte = sortie.texte.trim();
    if (sortie.coupe) texte = couperALaDernierePhraseComplete(texte).base.trim();
    texte = corrigerEtiquettes(texte.replace(/^([ \t]*[A-ZÀ-Ý][A-ZÀ-Ý' .-]{1,40}?)[ \t]*\((?:suite|continue|cont\.)\)/gim, '$1'), noms);
    return { texte, echecs: controlerReponse(texte, { messageJoueur: ouverture ? partie.depart.pointDeDepart : messageJoueur, personnageNom: partie.personnage.nom, precedente, monde, ville, nomsConnus: noms, ouverture }) };
  };

  let essai = await tenter();
  let corrige = false;
  if (essai.echecs.length) {
    const note = `La tentative précédente a été rejetée pour la ou les raisons suivantes : ${essai.echecs.join(' ')} Corrige ces points dans ta nouvelle réponse, sans les mentionner explicitement au joueur.`;
    const second = await tenter(note);
    if (second.echecs.length < essai.echecs.length || !second.echecs.length) {
      essai = second;
      corrige = true;
    }
  }
  // L'échantillon garde le prompt ÉLÈVE (sans note de correction) : l'élève
  // apprend à produire directement la bonne réponse.
  return {
    tour: partie.messages.filter((m) => m.role === 'user').length,
    type: ouverture ? 'ouverture' : 'tour',
    messages: construireMessages(contexte(partie, monde, messageJoueur, true, ouverture), CONFIG_ELEVE),
    reponse: essai.texte,
    ok: !essai.echecs.length,
    echecs: essai.echecs,
    corrige,
  };
}

async function jouerJoueur(partie: Partie, journal: (m: string) => void): Promise<string> {
  const transcript = partie.messages.slice(-6)
    .map((m) => `${m.role === 'user' ? partie.personnage.nom.toUpperCase() : 'NARRATEUR'} : ${m.content.slice(0, 1800)}`)
    .join('\n\n');
  const sortie = await appeler({
    temperature: 1.0,
    maxTokens: 220,
    messages: [
      {
        role: 'system',
        content: `Tu joues le personnage du joueur dans un jeu de rôle textuel pour adultes. Personnage : ${partie.personnage.nom} — ${partie.personnage.description}
Style de ce joueur : ${partie.styleJoueur}.
Écris UNIQUEMENT le prochain message du joueur, à la première personne : ce que ${partie.personnage.nom} fait et/ou dit, en 1 à 3 phrases, souvent une ou deux seulement (parfois une seule ligne courte). Les paroles vont entre guillemets « ».
Tu ne décris jamais les réactions des autres personnages ni l'issue de tes actions : c'est le narrateur qui les raconte.
Réagis à ce qui vient de se passer, prends des initiatives, fais avancer l'histoire. Contenu adulte permis (violence, sexe entre adultes consentants). Pas de titre, pas de nom en tête, pas de commentaire.`,
      },
      { role: 'user', content: `Derniers échanges :\n\n${transcript}\n\nProchain message de ${partie.personnage.nom} :` },
    ],
  }, journal);
  return sortie.texte.trim()
    .replace(new RegExp(`^${partie.personnage.nom.toUpperCase()}\\s*:\\s*`), '')
    .replace(/^["“]|["”]$/g, '')
    .split('\n\n')[0]
    .slice(0, 900);
}

async function resumer(partie: Partie, journal: (m: string) => void): Promise<string> {
  const transcript = partie.messages.slice(-14)
    .map((m) => `${m.role === 'user' ? partie.personnage.nom : 'Narrateur'} : ${m.content.slice(0, 1200)}`)
    .join('\n');
  const sortie = await appeler({
    temperature: 0.3,
    maxTokens: 450,
    messages: [
      { role: 'system', content: "Tu tiens la mémoire d'un jeu de rôle. Mets à jour le résumé de l'histoire en 10 phrases au plus : lieux, personnages rencontrés (noms exacts), événements, engagements pris, état des relations. Faits établis uniquement, rien d'inventé. Réponds uniquement par le résumé." },
      { role: 'user', content: `Résumé précédent :\n${partie.resume || 'Aucun.'}\n\nDerniers échanges :\n${transcript}` },
    ],
  }, journal);
  return sortie.texte.trim().slice(0, 2500);
}

function nouvellePartie(mondes: Monde[], index: number): Partie {
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
    resume: '',
    messages: [],
    echantillons: [],
    terminee: false,
  };
}

function idMessage(): string {
  return `m-${Date.now().toString(36)}-${Math.floor(hasard() * 1e6)}`;
}

async function avancerPartie(partie: Partie, monde: Monde, fichier: string, journal: (m: string) => void, finMs: number) {
  const sauver = () => fs.writeFileSync(fichier, JSON.stringify(partie));
  if (!partie.messages.length) {
    const ech = await narrer(partie, monde, '', true, journal);
    partie.echantillons.push(ech);
    partie.messages.push({ id: idMessage(), role: 'assistant', content: ech.reponse, timestamp: Date.now() });
    journal(`${partie.id} ouverture ${ech.ok ? 'OK' : `KO (${ech.echecs.join(' | ').slice(0, 160)})`}`);
    sauver();
  }
  while (partie.messages.filter((m) => m.role === 'user').length < partie.toursPrevus) {
    if (Date.now() > finMs) return;
    const tour = partie.messages.filter((m) => m.role === 'user').length + 1;
    if (tour > 1 && tour % RESUME_TOUS_LES === 0) partie.resume = await resumer(partie, journal);
    const messageJoueur = await jouerJoueur(partie, journal);
    if (!messageJoueur) continue;
    const ech = await narrer(partie, monde, messageJoueur, false, journal);
    partie.echantillons.push(ech);
    partie.messages.push({ id: idMessage(), role: 'user', content: messageJoueur, timestamp: Date.now() });
    partie.messages.push({ id: idMessage(), role: 'assistant', content: ech.reponse, timestamp: Date.now() });
    journal(`${partie.id} tour ${tour}/${partie.toursPrevus} ${ech.ok ? 'OK' : `KO (${ech.echecs.join(' | ').slice(0, 160)})`}${ech.corrige ? ' [corrigé]' : ''}`);
    sauver();
  }
  partie.terminee = true;
  sauver();
}

export async function main() {
  const [dossier = 'fabrique-sortie', nbTexte = '40', dureeTexte = '600'] = process.argv.slice(2);
  const nbParties = Number(nbTexte);
  const finMs = Date.now() + Number(dureeTexte) * 60 * 1000;
  fs.mkdirSync(path.join(dossier, 'parties'), { recursive: true });
  const journalFichier = path.join(dossier, 'journal.txt');
  const journal = (m: string) => {
    const ligne = `${new Date().toISOString()} ${m}`;
    fs.appendFileSync(journalFichier, `${ligne}\n`);
    console.log(ligne);
  };
  const mondes = chargerMondes();
  const parMonde = new Map(mondes.map((m) => [m.id, m]));
  surveillance = setInterval(() => { void sonderActivite(); }, 10000);

  const fichiers = () => fs.readdirSync(path.join(dossier, 'parties')).filter((f) => f.endsWith('.json'));
  let index = fichiers().length;
  try {
    // Parties inachevées d'abord (reprise après arrêt).
    for (const f of fichiers()) {
      const partie: Partie = JSON.parse(fs.readFileSync(path.join(dossier, 'parties', f), 'utf8'));
      if (!partie.terminee) await avancerPartie(partie, parMonde.get(partie.monde)!, path.join(dossier, 'parties', f), journal, finMs);
      if (Date.now() > finMs) break;
    }
    while (fichiers().length < nbParties && Date.now() < finMs) {
      const partie = nouvellePartie(mondes, index++);
      const fichier = path.join(dossier, 'parties', `${partie.id}.json`);
      journal(`nouvelle partie ${partie.id} — ${partie.personnage.nom} — ${partie.depart.lieu} — ${partie.styleJoueur.split(' :')[0]}`);
      await avancerPartie(partie, parMonde.get(partie.monde)!, fichier, journal, finMs);
    }
  } finally {
    clearInterval(surveillance);
  }
  journal('fin de la fabrication');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
