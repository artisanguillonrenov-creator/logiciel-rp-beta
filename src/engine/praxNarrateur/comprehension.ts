/**
 * Compréhension locale du message du joueur : rapprocher une phrase libre en
 * français d'une action que Prax connaît (saluer, interroger sur un sujet,
 * menacer, se rendre quelque part…), avec sa cible et son sujet.
 *
 * Prax ne comprend pas la langue : ce sont des motifs simples, et quand rien
 * ne correspond, on le dit au lieu de deviner.
 */
import type { State } from '../../prax/core/engine';
import type { GroundedAction } from '../../prax/core/perform';
import { normaliser } from './description';
import { sujetsCites } from './sujets';
import { DescriptionScene, GenreAction, ID_JOUEUR } from './types';

/** Gabarit d'action Prax du joueur pour chaque genre compris. */
export const GABARIT: Partial<Record<GenreAction, string>> = {
  saluer: '[Actor] salue [Cible]',
  converser: '[Actor] engage la conversation avec [Cible]',
  interroger: '[Actor] interroge [Cible] sur [Sujet]',
  complimenter: '[Actor] complimente [Cible]',
  menacer: '[Actor] menace [Cible]',
  insulter: '[Actor] insulte [Cible]',
  rendreInsulte: '[Actor] rend l’insulte à [Cible]',
  attaquer: '[Actor] attaque [Cible]',
  riposter: '[Actor] riposte contre [Cible]',
  voler: '[Actor] vole [Cible]',
  aider: '[Actor] propose son aide à [Cible]',
  payer: '[Actor] offre de l’argent à [Cible]',
  s_excuser: '[Actor] présente ses excuses à [Cible]',
  remercier: '[Actor] remercie [Cible]',
  se_rendre: '[Actor] se rend à [Lieu]',
  attendre: '[Actor] (attend)',
};

/** Genres d'action qui exigent un interlocuteur présent. */
const AVEC_CIBLE = new Set<GenreAction>(['saluer', 'converser', 'interroger', 'complimenter', 'menacer', 'insulter', 'attaquer', 'voler', 'aider', 'payer', 's_excuser', 'remercier']);

// L'ordre compte : la première règle reconnue l'emporte.
const REGLES: Array<{ genre: GenreAction; motif: RegExp }> = [
  { genre: 'attaquer', motif: /\b(attaqu\w*|frapp\w*|cogn\w*|poignard\w*|egorg\w*|degain\w*|gifl\w*|tabass\w*|coup de (poing|pied|poignard|epee|dague)|tranch\w*|transperc\w*|assomm\w*|tu(e|er|erai)\b)/ },
  { genre: 'voler', motif: /\b(vol(e|er|erai)\b|derob\w*|subtilis\w*|chapard\w*|fais les poches|faire les poches|piqu\w* (sa|la|ta) bourse|detrouss\w*)/ },
  { genre: 'menacer', motif: /\b(menac\w*|intimid\w*|sinon je|gare a toi|tu vas le regretter|je vais te (tuer|crever|saigner|faire)|ou je te)/ },
  { genre: 'insulter', motif: /\b(insult\w*|connard|connasse|idiot\w*|imbecile|cretin\w*|abruti\w*|ordure|vermine|pourriture|raclure|minable|va te faire|ferme[- ]la|tais[- ]toi|crach\w*)/ },
  { genre: 'payer', motif: /\b(pai(e|s)|pay(e|er)|soudoi\w*|pot[- ]de[- ]vin|(donne|tend|glisse|offre)\w* .{0,30}(pieces?|or|argent|cuivres?|bourse))/ },
  { genre: 's_excuser', motif: /\b(je (te|vous) (demande|presente) (pardon|mes excuses)|desole\w*|excuse[- ]moi\b(?! ?,? (ou|est-ce|sais))|mes excuses|pardonne[- ]moi)/ },
  { genre: 'aider', motif: /\b(je (peux|pourrais) (t|vous) aider|(t|vous) aider|coup de main|besoin d.aide|je (t|vous) aide)/ },
  { genre: 'remercier', motif: /\b(merci|je (te|vous) remercie)\b/ },
  { genre: 'complimenter', motif: /\b(compliment\w*|felicit\w*|bravo|magnifique|ravissant\w*|charmant\w*|superbe|tres belle|tres beau|impressionnant\w*)/ },
  { genre: 'saluer', motif: /\b(bonjour|bonsoir|salut|salue\w*|je (te|vous) salue|enchante\w*|bien le bonjour)\b/ },
];

const ATTENTE = /^(continue[rz]?|suite|\.\.\.|…|j.attends|j.observe|j.ecoute|je reste|je patiente|je regarde autour)/;
const QUESTION = /\?|\b(demand\w*|interrog\w*|questionn\w*|parl\w* (de|du|des)|que sais|sais[- ]tu|savez[- ]vous|connai\w*|raconte|explique|cherche|renseign\w*|ou (est|sont|trouver)|comment|pourquoi|quand|qui est)/;

export interface Comprehension {
  genre: GenreAction | null;
  action: GroundedAction | null;
  cible?: string;
  sujet?: string;
  lieu?: string;
  /** Pourquoi rien n'a été retenu (pour le message de repli). */
  motif?: string;
}

/** Les PNJ dans le même lieu que le joueur, d'après l'état du moteur. */
export function presentsDuJoueur(st: State, desc: DescriptionScene): DescriptionScene['pnj'] {
  const ici = st.dbChildKeys(`at.${ID_JOUEUR}`)[0];
  return desc.pnj.filter((p) => ici !== undefined && st.dbHas(`at.${p.id}!${ici}`));
}

/** Le PNJ présent que vise le message : cité par son nom ou son rôle, sinon le dernier interlocuteur. */
export function cibleDuMessage(texteNormalise: string, st: State, desc: DescriptionScene, dernierInterlocuteur?: string): string | undefined {
  const presents = presentsDuJoueur(st, desc);
  for (const p of presents) {
    const mots = normaliser(p.nom).split(/[\s'’-]+/).filter((m) => m.length >= 3 && !/^(maitre|maitresse|roi|reine|grande?|sir|dame)$/.test(m));
    if (mots.some((m) => new RegExp(`\\b${m}\\b`).test(texteNormalise))) return p.id;
  }
  for (const p of presents) {
    const role = normaliser(p.libelleRole ?? p.role).replace(/^(la |le |l.)/, '');
    const motCle = role.split(/\s+/)[0];
    if (motCle && motCle.length >= 4 && texteNormalise.includes(motCle)) return p.id;
  }
  if (dernierInterlocuteur && presents.some((p) => p.id === dernierInterlocuteur)) return dernierInterlocuteur;
  return presents[0]?.id;
}

function chercherAction(st: State, gabarit: string, liaisons: Record<string, string>): GroundedAction | null {
  for (const ga of st.possibleActions(ID_JOUEUR)) {
    if (ga.actionId !== gabarit) continue;
    if (Object.entries(liaisons).every(([k, v]) => ga.bindings.get(k) === v)) return ga;
  }
  return null;
}

/**
 * Comprend le message dans l'état courant. `lieuDestination` : lieu déjà ajouté
 * à la description quand le message annonce un déplacement.
 */
export function comprendre(
  message: string,
  st: State,
  desc: DescriptionScene,
  lieuJoueur: string,
  opts: { lieuDestination?: string; dernierInterlocuteur?: string } = {},
): Comprehension {
  // Apostrophes et guillemets deviennent des espaces : « t’aider » se lit « t aider ».
  const texte = normaliser(message).replace(/[«»"“”’']/g, ' ').replace(/\s+/g, ' ').trim();

  if (opts.lieuDestination && opts.lieuDestination !== lieuJoueur) {
    const action = chercherAction(st, GABARIT.se_rendre as string, { Lieu: opts.lieuDestination });
    return action ? { genre: 'se_rendre', action, lieu: opts.lieuDestination } : { genre: null, action: null, motif: 'Ce lieu n’est pas accessible d’ici.' };
  }
  if (texte.length === 0 || ATTENTE.test(texte)) {
    return { genre: 'attendre', action: chercherAction(st, GABARIT.attendre as string, {}) };
  }

  const cible = cibleDuMessage(texte, st, desc, opts.dernierInterlocuteur);
  const sujets = sujetsCites(message);
  let genre: GenreAction | null = REGLES.find((r) => r.motif.test(texte))?.genre ?? null;
  // Une question sur un sujet connu l'emporte sur une simple formule de politesse.
  const politesse = genre === null || genre === 'saluer' || genre === 'remercier' || genre === 's_excuser' || genre === 'complimenter';
  if (sujets.length > 0 && politesse && (QUESTION.test(texte) || genre === null)) genre = 'interroger';
  // Réplique sans action reconnue : on engage la conversation.
  if (genre === null && /[a-z]/.test(texte)) genre = 'converser';
  if (genre === null) return { genre: null, action: null, motif: 'Prax n’a reconnu aucune action dans ce message.' };

  // Répondre à une insulte ou une attaque en attente.
  if (genre === 'insulter' && cible && st.dbHas(`attente.${ID_JOUEUR}.${cible}.insulte`)) genre = 'rendreInsulte';
  if (genre === 'attaquer' && cible && st.dbHas(`attente.${ID_JOUEUR}.${cible}.attaque`)) genre = 'riposter';

  if (AVEC_CIBLE.has(genre) || genre === 'rendreInsulte' || genre === 'riposter') {
    if (!cible) return { genre, action: null, motif: 'Il n’y a personne ici à qui t’adresser.' };
    const liaisons: Record<string, string> = { Cible: cible };
    // Parmi les sujets cités, d'abord celui que l'interlocuteur connaît.
    if (genre === 'interroger') liaisons.Sujet = sujets.find((x) => st.dbHas(`sait.${cible}.${x}`)) ?? sujets[0];
    const action = chercherAction(st, GABARIT[genre] as string, liaisons);
    if (!action && genre === 'remercier') {
      // Rien à remercier en attente : c'est une simple réplique.
      const conv = chercherAction(st, GABARIT.converser as string, { Cible: cible });
      return { genre: conv ? 'converser' : null, action: conv, cible };
    }
    if (!action) return { genre, action: null, cible, motif: 'Cette action n’est pas possible pour l’instant.' };
    return { genre, action, cible, sujet: liaisons.Sujet };
  }
  return { genre: null, action: null, motif: 'Prax n’a reconnu aucune action dans ce message.' };
}
