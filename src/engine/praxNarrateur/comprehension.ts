/**
 * Compréhension locale du message du joueur : rapprocher une phrase libre en
 * français d'une action que Prax connaît (saluer, interroger sur un sujet,
 * menacer, se rendre quelque part…), avec sa cible et son sujet.
 *
 * Prax ne comprend pas la langue : ce sont des motifs simples, et quand rien
 * ne correspond, on le dit au lieu de deviner.
 */
import type { State } from '../../prax/core/engine';
import { statutEnonce } from '../../prax/vocab/conversation';
import type { GroundedAction } from '../../prax/core/perform';
import { SaisieActe, comprendreActe, reconnaitreActe, reglementEnAttente } from './bibliotheque';
import { normaliser } from './description';
import { estVendeur } from './monde';
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
  relancer: '[Actor] relance [Cible]',
  demander: '[Actor] adresse une demande à [Cible]',
  marchander: '[Actor] marchande avec [Cible]',
  payerPrix: '[Actor] paie [Cible] le prix convenu',
  se_rendre: '[Actor] se rend à [Lieu]',
  attendre: '[Actor] (attend)',
};

/** Genres d'action qui exigent un interlocuteur présent. */
const AVEC_CIBLE = new Set<GenreAction>(['saluer', 'converser', 'relancer', 'interroger', 'complimenter', 'menacer', 'insulter', 'attaquer', 'voler', 'aider', 'payer', 'payerPrix', 's_excuser', 'remercier', 'demander', 'marchander']);

/** Genres pour lesquels, sans interlocuteur nommé, on se tourne vers un vendeur présent. */
const COMMERCE = new Set<GenreAction>(['demander', 'marchander', 'payer', 'payerPrix']);

// L'ordre compte : la première règle reconnue l'emporte.
const REGLES: Array<{ genre: GenreAction; motif: RegExp }> = [
  { genre: 'attaquer', motif: /\b(attaqu\w*|frapp\w*|cogn\w*|poignard\w*|egorg\w*|degain\w*|gifl\w*|tabass\w*|coup de (poing|pied|poignard|epee|dague)|tranch\w*|transperc\w*|assomm\w*|tu(e|er|erai)\b)/ },
  { genre: 'voler', motif: /\b(vol(e|er|erai)\b|derob\w*|subtilis\w*|chapard\w*|fais les poches|faire les poches|piqu\w* (sa|la|ta) bourse|detrouss\w*)/ },
  { genre: 'menacer', motif: /\b(menac\w*|intimid\w*|sinon je|gare a toi|tu vas le regretter|je vais te (tuer|crever|saigner|faire)|ou je te)/ },
  { genre: 'insulter', motif: /\b(insult\w*|connard|connasse|idiot\w*|imbecile|cretin\w*|abruti\w*|ordure|vermine|pourriture|raclure|minable|va te faire|ferme[- ]la|tais[- ]toi|crach\w*)/ },
  { genre: 'payer', motif: /\b(pai(e|s)|pay(e|er)|soudoi\w*|pot[- ]de[- ]vin|(donne|tend|glisse|offre)\w* .{0,30}(pieces?|or|argent|cuivres?|bourse))/ },
  { genre: 's_excuser', motif: /\b(je (te|vous) (demande|presente) (pardon|mes excuses)|desole\w*|excuse[- ]moi\b(?! ?,? (ou|est-ce|sais))|mes excuses|pardonne[- ]moi)/ },
  { genre: 'aider', motif: /\b(je (peux|pourrais) (t|vous) aider|(t|vous) aider|coup de main|besoin d.aide|je (t|vous) aide)/ },
  { genre: 'marchander', motif: /\b(marchand(e|er|ons)\b|negoci\w*|trop cher|baiss\w* (le|ton|votre|ce) prix|rabais|ristourne|(faire|fais|faites) un (effort|prix)|moins cher)/ },
  { genre: 'demander', motif: /\b(je (cherche|recherche|veux|voudrais|souhaite|souhaiterais|aimerais|desire)|j aimerais|(je pourrais|je peux|puis je|pourrais je) (avoir|obtenir|prendre)|si (tu as|vous avez|tu aurais|vous auriez) (un|une|des|du|de la|de l)\b|est ce que (tu as|vous avez|tu aurais|vous auriez|tu vends|vous vendez)|(tu as|vous avez|t as|tu aurais|vous auriez) .{0,80}\?|il me faut|j ai besoin|achet\w*|achat|a vendre|combien (pour|coute|vaut|tu veux|vous voulez))/ },
  { genre: 'remercier', motif: /\b(merci|je (te|vous) remercie)\b/ },
  { genre: 'complimenter', motif: /\b(compliment\w*|felicit\w*|bravo|magnifique|ravissant\w*|charmant\w*|superbe|tres belle|tres beau|impressionnant\w*)/ },
  { genre: 'saluer', motif: /\b(bonjour|bonsoir|salut|salue\w*|je (te|vous) salue|enchante\w*|bien le bonjour)\b/ },
];

/** Violence nommée (frapper, tuer, voler…) : dite au conditionnel, c'est une menace, pas un acte. */
const VIOLENCE = /\b(frapp\w*|attaqu\w*|tu(e|er|erai|erais)|cogn\w*|poignard\w*|egorg\w*|tabass\w*|saign\w*|cass\w* la (gueule|figure)|tranch\w*|crev\w*)\b/;
/** Le message s'adresse à l'interlocuteur (tu, te, toi, vous). */
const DEUXIEME_PERSONNE = /\b(tu|te|t|toi|vous|ton|ta|tes|votre|vos)\b/;

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
  /** Texte de la demande, transmis tel quel (Prax n'en analyse pas le détail). */
  precision?: string;
  /** Comment raconter l'action du joueur quand elle diffère de l'action jouée (« merci » sans service rendu). */
  affichage?: GenreAction;
  /** Action de la bibliothèque universelle reconnue (montant, objet annoncés). */
  acte?: SaisieActe;
}

/** Genres du narrateur qu'une expression de la bibliothèque ne détrône que si elle est très précise (3 mots ou plus). */
const FORTS = new Set<GenreAction>(['attaquer', 'voler', 'menacer', 'insulter', 's_excuser', 'aider']);

/** Action du narrateur que désigne `equivalentPrax` dans le catalogue. */
const EQUIVALENTS: Record<string, GenreAction> = {
  saluer: 'saluer', converser: 'converser', complimenter: 'complimenter', remercier: 'remercier', menacer: 'menacer', insulter: 'insulter',
  attaquer: 'attaquer', voler: 'voler', aider: 'aider', payer: 'payer', s_excuser: 's_excuser', attendre: 'attendre', demander: 'demander', marchander: 'marchander',
  interroger: 'interroger',
};

/** Les PNJ dans le même lieu que le joueur, d'après l'état du moteur. */
export function presentsDuJoueur(st: State, desc: DescriptionScene): DescriptionScene['pnj'] {
  const ici = st.dbChildKeys(`at.${ID_JOUEUR}`)[0];
  return desc.pnj.filter((p) => ici !== undefined && st.dbHas(`at.${p.id}!${ici}`));
}

/** Le PNJ présent que le message nomme (prénom, nom ou rôle), s'il y en a un. */
export function cibleNommee(texteNormalise: string, st: State, desc: DescriptionScene): string | undefined {
  const presents = presentsDuJoueur(st, desc);
  for (const p of presents) {
    const mots = normaliser(p.nom).split(/[\s'’-]+/).filter((m) => m.length >= 3 && !/^(maitre|maitresse|roi|reine|grande?|sir|dame|les|une|des)$/.test(m));
    if (mots.some((m) => new RegExp(`\\b${m}\\b`).test(texteNormalise))) return p.id;
  }
  for (const p of presents) {
    const role = normaliser(p.libelleRole ?? p.role).replace(/^(la |le |l.)/, '');
    const motCle = role.split(/\s+/)[0];
    if (motCle && motCle.length >= 4 && texteNormalise.includes(motCle)) return p.id;
  }
  return undefined;
}

/** Le PNJ présent que vise le message : nommé, sinon le dernier interlocuteur, sinon le premier présent. */
export function cibleDuMessage(texteNormalise: string, st: State, desc: DescriptionScene, dernierInterlocuteur?: string): string | undefined {
  const nommee = cibleNommee(texteNormalise, st, desc);
  if (nommee) return nommee;
  const presents = presentsDuJoueur(st, desc);
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

/** Interlocuteur d'une affaire : celui avec qui un prix est en cours, sinon la cible si elle vend, sinon un vendeur présent. */
function cibleCommerce(st: State, desc: DescriptionScene, cible: string | undefined): string | undefined {
  const presents = presentsDuJoueur(st, desc);
  const enCours = presents.find((p) => st.dbHas(`prix.${p.id}.${ID_JOUEUR}`) || st.dbHas(`contre.${p.id}.${ID_JOUEUR}`));
  const vendeur = presents.find((p) => estVendeur(p.role));
  const roleCible = desc.pnj.find((p) => p.id === cible)?.role;
  return enCours?.id ?? (cible && roleCible && estVendeur(roleCible) ? cible : vendeur?.id ?? cible);
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

  // Une citation, une hypothèse ou un témoignage est une parole, pas la
  // réalisation d'une action matérielle. La mention « je le frappe »
  // ne doit jamais provoquer un combat quand elle n'est que citée.
  // Trois exceptions, qui restent des actes adressés au PNJ présent :
  // - la demande polie (« je voudrais une chambre ») est une demande ;
  // - « je te demande si tu as… » est une question ;
  // - la violence promise à l'interlocuteur (« si tu ne rends pas ma bourse, je te frappe »,
  //   « je pourrais te tuer ») est une menace, jamais une attaque.
  const statut = statutEnonce(message);
  const violence = VIOLENCE.test(texte);
  const adresse = DEUXIEME_PERSONNE.test(texte);
  const demandePolie = statut === 'eventualite' && !violence;
  const questionAdressee = statut === 'rapporte' && /^je (te |vous )?demande (si|s il|de|que|combien|ou|quand|comment|pourquoi)\b/.test(texte) && adresse;
  if (statut !== 'direct' && !demandePolie && !questionAdressee) {
    const cible = cibleDuMessage(texte, st, desc, opts.dernierInterlocuteur);
    if ((statut === 'hypothese' || statut === 'eventualite') && violence && adresse && !message.includes('?') && cible) {
      const menace = chercherAction(st, GABARIT.menacer as string, { Cible: cible });
      if (menace) return { genre: 'menacer', action: menace, cible, precision: message.trim() };
    }
    const dejaParle = cible ? st.dbHas(`parle.${ID_JOUEUR}.${cible}`) : false;
    const genre = dejaParle ? 'relancer' : 'converser';
    const action = cible ? chercherAction(st, GABARIT[genre] as string, { Cible: cible }) : null;
    return { genre: action ? genre : null, action, cible, precision: message, motif: action ? undefined : 'Aucun interlocuteur disponible pour cette parole.' };
  }

  if (opts.lieuDestination && opts.lieuDestination !== lieuJoueur) {
    const action = chercherAction(st, GABARIT.se_rendre as string, { Lieu: opts.lieuDestination });
    return action ? { genre: 'se_rendre', action, lieu: opts.lieuDestination } : { genre: null, action: null, motif: 'Ce lieu n’est pas accessible d’ici.' };
  }
  const reconnu = reconnaitreActe(message);
  // « J'attends », « continue »… sauf quand la bibliothèque reconnaît un acte plus précis (« j'observe la salle »).
  if (texte.length === 0 || (ATTENTE.test(texte) && (!reconnu || reconnu.entree.equivalentPrax === 'attendre'))) {
    return { genre: 'attendre', action: chercherAction(st, GABARIT.attendre as string, {}) };
  }

  let cible = cibleDuMessage(texte, st, desc, opts.dernierInterlocuteur);
  const sujets = sujetsCites(message);
  let genre: GenreAction | null = REGLES.find((r) => r.motif.test(texte))?.genre ?? null;
  // Payer ce qui est dû (prestation convenue, amende) passe avant tout le reste.
  if (genre === 'payer') {
    const reglement = reglementEnAttente(st, message, cibleNommee(texte, st, desc));
    if (reglement) return { genre: 'acte', action: reglement, cible: String(reglement.bindings.get('Cible') ?? '') || undefined };
  }

  // La bibliothèque universelle : une expression du catalogue, plus précise que les motifs du narrateur.
  let achatSansPrix = false;
  if (reconnu) {
    const eq = reconnu.entree.equivalentPrax;
    if (eq) {
      if (genre === null && EQUIVALENTS[eq] && (eq !== 'interroger' || sujets.length > 0)) genre = EQUIVALENTS[eq];
    } else {
      const questionSujet = sujets.length > 0 && QUESTION.test(texte) && reconnu.entree.famille !== 'transaction';
      const prioritaire = genre === null || (!questionSujet && (FORTS.has(genre) ? reconnu.mots >= 3 : reconnu.mots >= 2 || genre === 'saluer' || genre === 'complimenter'));
      if (prioritaire) {
        const nommee = cibleNommee(texte, st, desc);
        const parDefaut = reconnu.entree.famille === 'transaction' && !nommee ? cibleCommerce(st, desc, cible) : cible;
        const r = comprendreActe(reconnu, message, st, desc, presentsDuJoueur(st, desc), nommee, parDefaut);
        if (r) return { genre: 'acte', action: r.action, cible: r.cible, motif: r.motif, acte: r.saisie };
        // Un achat ou une location sans prix annoncé reste une demande au vendeur
        // (« je voudrais louer une chambre »), pas une question sur un sujet.
        if (reconnu.entree.famille === 'transaction') {
          genre = 'demander';
          achatSansPrix = true;
        }
      }
    }
  }

  // Une question sur un sujet connu l'emporte sur une politesse ou une demande vague
  // (« je cherche un contrat » interroge sur la Guilde).
  const politesse = genre === null || genre === 'saluer' || genre === 'remercier' || genre === 's_excuser' || genre === 'complimenter' || genre === 'demander';
  if (!achatSansPrix && sujets.length > 0 && politesse && (QUESTION.test(texte) || genre === null || genre === 'demander')) genre = 'interroger';
  // Réplique sans action reconnue : on engage la conversation, ou on relance si c'est déjà fait.
  if (genre === null && /[a-z]/.test(texte)) genre = 'converser';
  if (genre === null) return { genre: null, action: null, motif: 'Prax n’a reconnu aucune action dans ce message.' };

  // Commerce sans interlocuteur nommé : on s'adresse au vendeur présent, s'il y en a un.
  if (COMMERCE.has(genre) && !cibleNommee(texte, st, desc)) cible = cibleCommerce(st, desc, cible);
  if (genre === 'converser' && cible && st.dbHas(`parle.${ID_JOUEUR}.${cible}`)) genre = 'relancer';
  // Payer après une proposition : c'est régler le prix convenu.
  if (genre === 'payer' && cible && st.dbHas(`prix.${cible}.${ID_JOUEUR}`)) genre = 'payerPrix';
  // Marchander sans prix proposé : c'est encore une demande.
  if (genre === 'marchander' && cible && !st.dbHas(`prix.${cible}.${ID_JOUEUR}`)) genre = 'demander';

  // Répondre à une insulte ou une attaque en attente.
  if (genre === 'insulter' && cible && st.dbHas(`attente.${ID_JOUEUR}.${cible}.insulte`)) genre = 'rendreInsulte';
  if (genre === 'attaquer' && cible && st.dbHas(`attente.${ID_JOUEUR}.${cible}.attaque`)) genre = 'riposter';

  if (AVEC_CIBLE.has(genre) || genre === 'rendreInsulte' || genre === 'riposter') {
    if (!cible) return { genre, action: null, motif: 'Il n’y a personne ici à qui t’adresser.' };
    const liaisons: Record<string, string> = { Cible: cible };
    // Parmi les sujets cités, d'abord celui que l'interlocuteur connaît.
    if (genre === 'interroger') liaisons.Sujet = sujets.find((x) => st.dbHas(`sait.${cible}.${x}`)) ?? sujets[0];
    const action = chercherAction(st, GABARIT[genre] as string, liaisons);
    if (!action && (genre === 'remercier' || genre === 'saluer')) {
      // Rien à remercier en attente : c'est une simple réplique.
      const parle = st.dbHas(`parle.${ID_JOUEUR}.${cible}`);
      const conv = chercherAction(st, (parle ? GABARIT.relancer : GABARIT.converser) as string, { Cible: cible });
      return { genre: conv ? (parle ? 'relancer' : 'converser') : null, action: conv, cible, affichage: conv ? genre : undefined };
    }
    if (!action) return { genre, action: null, cible, motif: 'Cette action n’est pas possible pour l’instant.' };
    return { genre, action, cible, sujet: liaisons.Sujet, precision: genre === 'demander' ? message.trim() : undefined };
  }
  return { genre: null, action: null, motif: 'Prax n’a reconnu aucune action dans ce message.' };
}
