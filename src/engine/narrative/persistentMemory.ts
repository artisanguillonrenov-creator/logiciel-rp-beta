import type {
  EvenementNarratif,
  MemoireNarrativeState,
  RelationPersonnage,
  StoryState,
} from '../../types';
import { normaliserRecherche, rankLexical } from './lexicalRetrieval';

export type TypeContextBlock =
  | 'scene'
  | 'event'
  | 'npc_memory'
  | 'relation'
  | 'engagement'
  | 'canon'
  | 'world';

export interface ContextBlock {
  id: string;
  type: TypeContextBlock;
  priority: number;
  source: string;
  text: string;
}

export interface ContextSelection {
  blocks: ContextBlock[];
  query: string;
  totalChars: number;
}

const MAX_EVENEMENTS = 1200;
const MAX_CONTEXT_CHARS = 1900;
const GENERIQUES = new Set([
  'narrateur',
  'garde',
  'gardes',
  'la captive',
  'le captif',
  'captive',
  'captif',
  'inconnue',
  'inconnu',
  "l'inconnue",
  "l'inconnu",
  'foule',
  'voix',
  'homme',
  'femme',
]);

function compacter(texte: string, maxChars: number): string {
  const nettoye = String(texte ?? '').replace(/\s+/g, ' ').trim();
  if (nettoye.length <= maxChars) return nettoye;
  const coupe = nettoye.slice(0, Math.max(0, maxChars - 1));
  const finPhrase = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf('! '), coupe.lastIndexOf('? '));
  return `${(finPhrase > Math.floor(maxChars * 0.55) ? coupe.slice(0, finPhrase + 1) : coupe).trimEnd()}…`;
}

function nomsPnjConnus(story: StoryState): string[] {
  const noms = new Set<string>();
  for (const relation of story.social.relations) {
    if (relation.nom.trim()) noms.add(relation.nom.trim());
  }
  for (const entree of story.loreEmergent) {
    if (entree.categorie === 'pnj' && entree.titre.trim()) noms.add(entree.titre.trim());
  }
  return [...noms];
}

function detecterParticipants(story: StoryState, texte: string): string[] {
  const participants = new Map<string, string>();
  const ajouter = (nom: string) => {
    const propre = nom.replace(/\s+/g, ' ').trim();
    const cle = normaliserRecherche(propre);
    if (!cle || GENERIQUES.has(cle)) return;
    participants.set(cle, propre);
  };

  ajouter(story.meta.personnageNom);
  const normalise = normaliserRecherche(texte);
  for (const nom of nomsPnjConnus(story)) {
    const cle = normaliserRecherche(nom);
    if (cle && normalise.includes(cle)) ajouter(nom);
  }

  const regexLocuteur = /(?:^|\n)\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9'’ _-]{1,38})\s*:\s*[«"]/gm;
  let match: RegExpExecArray | null;
  while ((match = regexLocuteur.exec(texte))) ajouter(match[1]);
  return [...participants.values()].slice(0, 12);
}

function creerEvenement(story: StoryState, indexUser: number): EvenementNarratif | null {
  const joueur = story.messages[indexUser];
  const narrateur = story.messages[indexUser + 1];
  if (!joueur || joueur.role !== 'user' || !narrateur || narrateur.role !== 'assistant') return null;

  const combine = `${joueur.content}\n${narrateur.content}`;
  return {
    id: `evt:${joueur.id}:${narrateur.id}`,
    messageIndex: indexUser + 1,
    timestamp: narrateur.timestamp || joueur.timestamp || Date.now(),
    lieu: story.meta.contexte.lieu || undefined,
    dateChronique: story.meta.contexte.dateChronique || undefined,
    participants: detecterParticipants(story, combine),
    actionJoueur: compacter(joueur.content, 230),
    resultat: compacter(narrateur.content, 390),
  };
}

export function synchroniserMemoireNarrative(story: StoryState): MemoireNarrativeState {
  const evenements: EvenementNarratif[] = [];
  const debut = Math.max(0, story.messages.length - MAX_EVENEMENTS * 2 - 4);
  for (let i = debut; i < story.messages.length - 1; i++) {
    const evenement = creerEvenement(story, i);
    if (evenement) {
      evenements.push(evenement);
      i += 1;
    }
  }
  return {
    evenements: evenements.slice(-MAX_EVENEMENTS),
    dernierMessageIndex: story.messages.length,
  };
}

function texteEvenement(evt: EvenementNarratif): string {
  return [
    evt.lieu ? `Lieu: ${evt.lieu}` : '',
    evt.dateChronique ? `Période: ${evt.dateChronique}` : '',
    evt.participants.length ? `Présents: ${evt.participants.join(', ')}` : '',
    `Action du joueur: ${evt.actionJoueur}`,
    `Conséquence observée: ${evt.resultat}`,
  ].filter(Boolean).join('\n');
}

function relationTexte(relation: RelationPersonnage): string {
  return `${relation.nom}: confiance ${relation.confiance}, respect ${relation.respect}, peur ${relation.peur}, affection ${relation.affection}, hostilité ${relation.hostilite}${relation.faction ? `, faction ${relation.faction}` : ''}.`;
}

function ajouterBloc(blocs: ContextBlock[], bloc: ContextBlock): void {
  if (!bloc.text.trim()) return;
  if (blocs.some((b) => normaliserRecherche(b.text) === normaliserRecherche(bloc.text))) return;
  blocs.push(bloc);
}

function nomsMentionnes(story: StoryState, query: string): string[] {
  const normalise = normaliserRecherche(query);
  return nomsPnjConnus(story)
    .filter((nom) => {
      const cle = normaliserRecherche(nom);
      return cle.length >= 2 && normalise.includes(cle);
    })
    .slice(0, 3);
}

export function construireContextBlocks(story: StoryState, messageJoueur: string): ContextSelection {
  const memoire = story.memoireNarrative ?? synchroniserMemoireNarrative(story);
  const recents = story.messages.slice(-3).map((m) => m.content).join('\n');
  const query = [messageJoueur, story.meta.contexte.lieu, story.meta.contexte.objectifs, recents]
    .filter(Boolean)
    .join('\n');
  const blocs: ContextBlock[] = [];

  const dernierEvt = memoire.evenements.at(-1);
  ajouterBloc(blocs, {
    id: 'scene-actuelle',
    type: 'scene',
    priority: 100,
    source: 'scene',
    text: [
      story.meta.contexte.lieu ? `Lieu actuel: ${story.meta.contexte.lieu}.` : '',
      story.meta.contexte.dateChronique ? `Période: ${story.meta.contexte.dateChronique}.` : '',
      dernierEvt ? `Dernier événement établi: ${compacter(dernierEvt.resultat, 300)}` : '',
    ].filter(Boolean).join(' '),
  });

  const hitsEvenements = rankLexical({
    query,
    items: memoire.evenements.slice(0, -1),
    titleOf: (evt) => `${evt.lieu ?? ''} ${evt.participants.join(' ')}`,
    textOf: texteEvenement,
    idOf: (evt) => evt.id,
    timestampOf: (evt) => evt.timestamp,
    budget: { maxResults: 4, maxChars: 1150, maxCharsPerResult: 330 },
  });
  for (const hit of hitsEvenements) {
    ajouterBloc(blocs, {
      id: hit.item.id,
      type: 'event',
      priority: Math.min(94, 72 + Math.round(hit.score)),
      source: `ledger:${hit.item.messageIndex}`,
      text: hit.excerpt,
    });
  }

  const mentions = nomsMentionnes(story, query);
  for (const nom of mentions) {
    const cle = normaliserRecherche(nom);
    const vecus = memoire.evenements
      .filter((evt) => evt.participants.some((p) => normaliserRecherche(p) === cle))
      .slice(-2);
    if (vecus.length) {
      ajouterBloc(blocs, {
        id: `npc:${cle}`,
        type: 'npc_memory',
        priority: 96,
        source: `pnj:${nom}`,
        text: `Mémoire accessible à ${nom} (événements auxquels ce PNJ a été présent):\n${vecus
          .map((evt) => `- ${compacter(evt.resultat, 240)}`)
          .join('\n')}`,
      });
    }
  }

  const queryNormalisee = normaliserRecherche(query);
  for (const relation of story.social.relations) {
    const cle = normaliserRecherche(relation.nom);
    if (!cle || !queryNormalisee.includes(cle)) continue;
    ajouterBloc(blocs, {
      id: `relation:${relation.id}`,
      type: 'relation',
      priority: 91,
      source: 'social',
      text: relationTexte(relation),
    });
  }

  const engagementsActifs = story.social.engagements.filter((e) => !e.honore && !e.rompu);
  const hitsEngagements = rankLexical({
    query,
    items: engagementsActifs,
    titleOf: (e) => e.partie,
    textOf: (e) => `${e.type} ${e.description} ${e.partie}`,
    idOf: (e) => e.id,
    budget: { maxResults: 2, maxChars: 450, maxCharsPerResult: 220 },
  });
  for (const hit of hitsEngagements) {
    ajouterBloc(blocs, {
      id: `engagement:${hit.item.id}`,
      type: 'engagement',
      priority: 93,
      source: 'engagements',
      text: `${hit.item.type} envers ${hit.item.partie}: ${hit.item.description}`,
    });
  }

  const faits = story.memoire.faits.filter((f) => f.niveau === 'canon' || f.niveau === 'consolide');
  const hitsFaits = rankLexical({
    query,
    items: faits,
    titleOf: (f) => f.type,
    textOf: (f) => f.texte,
    idOf: (f) => f.id,
    budget: { maxResults: 3, maxChars: 520, maxCharsPerResult: 220 },
  });
  for (const hit of hitsFaits) {
    ajouterBloc(blocs, {
      id: `canon:${hit.item.id}`,
      type: 'canon',
      priority: hit.item.niveau === 'canon' ? 97 : 88,
      source: `memoire:${hit.item.niveau}`,
      text: hit.item.texte,
    });
  }

  const lieu = normaliserRecherche(story.meta.contexte.lieu || '');
  const zone = story.monde.zones.find((z) => lieu && normaliserRecherche(z.nom).includes(lieu));
  if (zone) {
    ajouterBloc(blocs, {
      id: `world:${zone.id}`,
      type: 'world',
      priority: 86,
      source: 'monde',
      text: `${zone.nom} — ${zone.description}`,
    });
  }

  blocs.sort((a, b) => b.priority - a.priority);
  const selection: ContextBlock[] = [];
  let totalChars = 0;
  for (const bloc of blocs) {
    const cout = bloc.text.length + 38;
    if (selection.length && totalChars + cout > MAX_CONTEXT_CHARS) continue;
    if (!selection.length && cout > MAX_CONTEXT_CHARS) {
      selection.push({ ...bloc, text: compacter(bloc.text, MAX_CONTEXT_CHARS - 40) });
      totalChars = MAX_CONTEXT_CHARS;
      break;
    }
    selection.push(bloc);
    totalChars += cout;
  }

  return { blocks: selection, query, totalChars };
}

export function formaterContextBlocks(blocs: ContextBlock[]): string {
  if (!blocs.length) return '';
  return [
    'Utilise uniquement ces blocs comme rappels factuels. Un PNJ ne doit pas connaître un événement auquel il n’a pas eu accès.',
    ...blocs.map((b) => `- [${b.type} | ${b.source} | P${b.priority}] ${b.text}`),
  ].join('\n');
}

export function debugContextBlocks(blocs: ContextBlock[]): string[] {
  return blocs.map((b) => `[P${b.priority} ${b.type}] ${b.source} — ${compacter(b.text, 210)}`);
}
