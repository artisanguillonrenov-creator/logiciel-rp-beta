/**
 * Conversation : orateurs, sujets et répliques (Versu §X). Une conversation est
 * une pratique à deux avec un ORATEUR désigné et un SUJET courant ; une
 * réplique est une action ordinaire qui dit une ligne et applique des effets.
 *
 * Reprend `prax-vocab/src/conversation.rs` (Prax, BSD-3-Clause).
 */
import { Condition, matches, not_ } from '../core/query';
import { Action, Outcome, action, del, insert } from '../core/types';

export const talkPath = (x: string, y: string): string => `practice.converse.${x}.${y}`;
export const talkingWith = (x: string, y: string): Condition => matches(talkPath(x, y));

/** Ouvre une conversation : `opener` parle d'abord, sur `topic`. */
export function beginConversation(opener: string, other: string, topic: string): Outcome[] {
  const base = talkPath(opener, other);
  return [
    insert(base),
    insert(`${base}.speaker!${opener}`),
    insert(`${base}.listener!${other}`),
    insert(`${base}.topic!${topic}`),
    insert(`${base}.visited.${topic}`),
    insert(`${opener}.chattedWith.${other}`),
    insert(`${other}.chattedWith.${opener}`),
  ];
}

const CONV_P = 'practice.converse.A.B';

function speakerConds(): Condition[] {
  return [matches(`${CONV_P}.speaker!Actor`), matches(`${CONV_P}.listener!Partner`)];
}

function passTurn(): Outcome[] {
  return [insert(`${CONV_P}.speaker!Partner`), insert(`${CONV_P}.listener!Actor`)];
}

/** Une réplique dite une fois par orateur, sur `topic`, avec ses effets ; passe la parole. */
export function quip(key: string, label: string, topic: string, conds: readonly Condition[], effects: readonly Outcome[]): Action {
  const when = [...speakerConds(), matches(`${CONV_P}.topic!${topic}`), not_(`${CONV_P}.said.${key}.Actor`), ...conds];
  const then = [insert(`${CONV_P}.said.${key}.Actor`), ...effects, ...passTurn()];
  return action(label, when, then);
}

/** Change de sujet (pas déjà dessus, pas déjà couvert) ; passe la parole. */
export function changeSubject(label: string, newTopic: string): Action {
  const when = [...speakerConds(), not_(`${CONV_P}.topic!${newTopic}`), not_(`${CONV_P}.visited.${newTopic}`)];
  const then = [insert(`${CONV_P}.topic!${newTopic}`), insert(`${CONV_P}.visited.${newTopic}`), ...passTurn()];
  return action(label, when, then);
}

/** Termine la conversation. */
export function endConversation(label: string): Action {
  return action(label, speakerConds(), [del(CONV_P)]);
}


// ---- Acquisition narrative native V1 -------------------------------------------------
// Règles acquises à la compilation de Prax : elles résident dans le vocabulaire
// conversationnel natif, pas dans une mémoire parallèle ni dans un moteur IA.
// Ces constructions sont originales. Une phrase d'exemple n'est jamais une réponse
// à retrouver : le contenu sémantique provient exclusivement de la scène Prax.

/** Version stable des connaissances linguistiques installées avec le moteur. */
export const ACQUIS_EXPRESSION_V1 = 'prax-expression-fr-v1';

export type IntentionDeParole =
  | 'accueillir' | 'ecouter' | 'eluder' | 'refuser' | 'ceder'
  | 'resister' | 'rendreInsulte' | 'refuserExcuses' | 'pardonner'
  | 'informer' | 'demander' | 'contreOffre'
  | 'remercier' | 'rassurer' | 'ignorerSujet' | 'presser'
  | 'perdrePatience' | 'renvoyer' | 'proposer'
  | 'maintenirPrix' | 'consentirRabais' | 'conclure';

export type RegistreParole = 'sobre' | 'chaleureux' | 'reserve' | 'tranchant';
export type StatutEnonce = 'direct' | 'hypothese' | 'citation' | 'rapporte' | 'negation' | 'eventualite';

export interface SensDeParole {
  /** Action de parole décidée par les pratiques Prax, jamais par ce réalisateur. */
  intention: IntentionDeParole;
  /** Identité stable du locuteur, distincte d'une simple classe de rôle. */
  locuteur: string;
  /** Fait établi, texte fourni par le moteur, jamais inventé dans la réalisation. */
  fait?: string;
  /** Sujet connu, sans présupposer que le locuteur en possède le détail. */
  sujet?: string;
  /** Motif explicitement vérifié par le moteur, optionnel. */
  motif?: string;
  /** Nouvelle offre décidée en amont ; ce savoir-faire ne négocie pas. */
  proposition?: { montant: number; monnaie: string };
  /** Registre étayé par une relation ou un trait du moteur, sinon signature stable. */
  registre?: RegistreParole;
  /** Sources épistémiques : un récit entendu ne devient pas un fait direct. */
  statut?: Extract<StatutEnonce, 'direct' | 'hypothese' | 'citation' | 'rapporte'>;
}

export interface ExpressionPrax {
  texte: string;
  /** Règles de compétence exercées, utiles au diagnostic. */
  acquis: readonly string[];
  version: typeof ACQUIS_EXPRESSION_V1;
}

/** 
 * Évalue seulement la modalité explicite de l'énoncé du joueur ; ce n'est pas
 * un analyseur universel. Les formes ambiguës restent des paroles non exécutées
 * plutôt que des attaques ou transactions automatiques.
 */
export function statutEnonce(message: string): StatutEnonce {
  const s = message.trim().toLocaleLowerCase('fr').replace(/[’]/gu, "'");
  if (/^(?:si\b|supposons\b|imaginons\b|mettons que\b|dans l.hypoth[eè]se\b|et si\b|[àa] supposer que\b|admettons que\b)/u.test(s)) return 'hypothese';
  if (/^(?:citation\s*:|je cite\s*:|[«“"])/u.test(s) && /[»”"]\s*[.!?]?\s*$/u.test(s)) return 'citation';
  if (/^(?:on m'a dit|j'ai entendu dire|il para[iî]t que|selon |elle a dit|il a dit|on raconte que|j'ai entendu que|quelqu'un dit que|je dis que|je raconte que|je lui dis que|je lis que)\b/u.test(s)) return 'rapporte';
  if (/^(?:ne\s+|n')/u.test(s) || /^je refuse de\b/u.test(s)) return 'negation';
  if (/\b(?:je|nous|on)\s+n['e]?\s*(?:le |la |les |l'|te |vous |y |en )?(?:[a-zéèêàâôùûîï]+\s+)?pas\b/u.test(s)
      || /^(?:je|nous|on)\s+(?:ne|n')\s*(?:veux|peux|vais|souhaite)\s+pas\b/u.test(s)) return 'negation';
  if (/^j'(?:aimerais|envisage|imaginais|espère|esperais)\b/u.test(s)) return 'eventualite';
  if (/^(?:je|nous|on)\s+(?:pourrais|pourrions|pourrait|voudrais|voudrions|devrais|devrions|envisage|envisageons|imagine|imagines|pensais|promets de)\b/u.test(s)) return 'eventualite';
  return 'direct';
}

function empreinteParole(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Constance du personnage sans inventer de traits psychologiques. */
export function registreStable(locuteur: string): RegistreParole {
  const registres: RegistreParole[] = ['sobre', 'chaleureux', 'reserve', 'tranchant'];
  return registres[empreinteParole(locuteur) % registres.length];
}

function optionStable<T>(options: readonly T[], cle: string): T {
  return options[empreinteParole(cle) % options.length];
}

/** Ne jamais introduire de fait absent ; les segments externes sont uniquement cités. */
function segmentDiscursif(value: string | undefined): string | undefined {
  const s = value?.replace(/\s+/gu, ' ').trim();
  return s ? s.replace(/[.!?;,]+\s*$/gu, '') : undefined;
}

function sujetAvecDe(s: string): string {
  if (/^le /iu.test(s)) return 'du ' + s.slice(3);
  if (/^les /iu.test(s)) return 'des ' + s.slice(4);
  if (/^(la |l['’])/iu.test(s)) return 'de ' + s;
  return /^[aeiouyéèêàâîôûh]/iu.test(s) ? 'd’' + s : 'de ' + s;
}

function ponctuer(s: string): string {
  const t = s.replace(/\s+([,;.!?])/gu, '$1').replace(/\s+/gu, ' ').trim();
  if (!t) return '';
  const cap = t.charAt(0).toLocaleUpperCase('fr') + t.slice(1);
  return /[.!?…]$/u.test(cap) ? cap : cap + '.';
}

/**
 * Morphologie française native : petit sous-ensemble fiable, sans dépendance
 * externe. Les formes inconnues sont refusées plutôt que fabriquées au hasard.
 */
export type PersonneFr = 'je' | 'tu' | 'il' | 'nous' | 'vous' | 'ils';
const PERSONNES_FR: readonly PersonneFr[] = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
const IRREGULIERS: Readonly<Record<string, readonly string[]>> = {
  être: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'],
  avoir: ['ai', 'as', 'a', 'avons', 'avez', 'ont'],
  aller: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'],
  faire: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'],
  pouvoir: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'],
  vouloir: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'],
  devoir: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'],
  venir: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'],
  dire: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'],
  savoir: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'],
  voir: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'],
  croire: ['crois', 'crois', 'croit', 'croyons', 'croyez', 'croient'],
  prendre: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'],
  comprendre: ['comprends', 'comprends', 'comprend', 'comprenons', 'comprenez', 'comprennent'],
  mettre: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'],
  écrire: ['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'],
  lire: ['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'],
  boire: ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'],
  partir: ['pars', 'pars', 'part', 'partons', 'partez', 'partent'],
  sortir: ['sors', 'sors', 'sort', 'sortons', 'sortez', 'sortent'],
  dormir: ['dors', 'dors', 'dort', 'dormons', 'dormez', 'dorment'],
  ouvrir: ['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent'],
  offrir: ['offre', 'offres', 'offre', 'offrons', 'offrez', 'offrent'],
  recevoir: ['reçois', 'reçois', 'reçoit', 'recevons', 'recevez', 'reçoivent'],

};
const SECOND_GROUPE = new Set(['finir', 'choisir', 'grandir', 'réussir', 'rougir', 'vieillir']);

/** Conjugaison présente : un inconnu retourne null, pas une forme approximative. */
export function conjuguerPresentPrax(infinitif: string, personne: PersonneFr): string | null {
  const i = PERSONNES_FR.indexOf(personne);
  if (i < 0) return null;
  const verbe = infinitif.trim().toLocaleLowerCase('fr');
  const special = IRREGULIERS[verbe];
  if (special) return special[i];
  if (SECOND_GROUPE.has(verbe)) {
    const base = verbe.slice(0, -2);
    return base + ['is', 'is', 'it', 'issons', 'issez', 'issent'][i];
  }
  if (verbe.endsWith('er') && !/(yer|eler|eter|éger|écer)$/u.test(verbe)) {
    const base = verbe.slice(0, -2);
    if (i === 3 && verbe.endsWith('ger')) return base + 'eons';
    if (i === 3 && verbe.endsWith('cer')) return base.slice(0, -1) + 'çons';
    return base + ['e', 'es', 'e', 'ons', 'ez', 'ent'][i];
  }
  return null;
}

/** Groupe nominal avec genre/nombre attestés : aucun changement du fait représenté. */
export function groupeNominalPrax(
  lemme: string,
  genre: 'masculin' | 'feminin',
  nombre: 'singulier' | 'pluriel',
  article: 'defini' | 'indefini' = 'defini',
  hAspire = false,
): string | null {
  const mot = lemme.trim();
  if (!/^[\p{L}]+(?:[-’'][\p{L}]+)*$/u.test(mot)) return null;
  let forme = mot;
  if (nombre === 'pluriel') {
    const irreguliers: Record<string, string> = { cheval: 'chevaux', travail: 'travaux', oeil: 'yeux', œil: 'yeux', bijou: 'bijoux', chou: 'choux', genou: 'genoux', caillou: 'cailloux', hibou: 'hiboux', joujou: 'joujoux', pou: 'poux', pneu: 'pneus', bleu: 'bleus' };
    const cle = mot.toLocaleLowerCase('fr');
    if (irreguliers[cle]) forme = irreguliers[cle];
    else if (/(eau|au|eu)$/iu.test(mot)) forme += 'x';
    else if (/[sxz]$/iu.test(mot)) forme = mot;
    else if (/al$/iu.test(mot) && !/(bal|carnaval|festival|récital)$/iu.test(mot)) forme = mot.slice(0, -2) + 'aux';
    else forme += 's';
  }
  if (nombre === 'pluriel') return (article === 'defini' ? 'les ' : 'des ') + forme;
  if (article === 'indefini') return (genre === 'masculin' ? 'un ' : 'une ') + forme;
  if (!hAspire && /^[haeiouyéèêàâîïôûùœ]/iu.test(mot)) return 'l’' + forme;
  return (genre === 'masculin' ? 'le ' : 'la ') + forme;
}

/**
 * Accords adjectivaux fiables : paradigmes courants et règles régulières
 * limitées. Les formes insuffisamment connues ne sont PAS improvisées.
 * Le genre et le nombre sont des faits fournis par le monde.
 */
export function accorderAdjectifPrax(
  lemme: string,
  genre: 'masculin' | 'feminin',
  nombre: 'singulier' | 'pluriel',
): string | null {
  const mot = lemme.trim().toLocaleLowerCase('fr');
  if (!/^[\p{L}]+$/u.test(mot)) return null;
  const irreguliers: Record<string, [string, string, string, string]> = {
    beau: ['beau', 'belle', 'beaux', 'belles'],
    nouveau: ['nouveau', 'nouvelle', 'nouveaux', 'nouvelles'],
    vieux: ['vieux', 'vieille', 'vieux', 'vieilles'],
    fou: ['fou', 'folle', 'fous', 'folles'],
    mou: ['mou', 'molle', 'mous', 'molles'],
    doux: ['doux', 'douce', 'doux', 'douces'],
    blanc: ['blanc', 'blanche', 'blancs', 'blanches'],
    frais: ['frais', 'fraîche', 'frais', 'fraîches'],
    long: ['long', 'longue', 'longs', 'longues'],
    gentil: ['gentil', 'gentille', 'gentils', 'gentilles'],
    roux: ['roux', 'rousse', 'roux', 'rousses'],
    meilleur: ['meilleur', 'meilleure', 'meilleurs', 'meilleures'],
    bas: ['bas', 'basse', 'bas', 'basses'],
    fier: ['fier', 'fière', 'fiers', 'fières'],
    cher: ['cher', 'chère', 'chers', 'chères'],
    net: ['net', 'nette', 'nets', 'nettes'],
  };
  const idx = (nombre === 'pluriel' ? 2 : 0) + (genre === 'feminin' ? 1 : 0);
  if (irreguliers[mot]) return irreguliers[mot][idx];
  // Cas où une transformation régulière est sûre.
  let base = mot;
  if (genre === 'feminin') {
    if (mot.endsWith('e')) base = mot;
    else if (/^(?:petit|grand|vert|fort|haut|court|lent|chaud|froid|clair|noir|bleu|poli|joli|ravi|vrai|dur|pur)$/u.test(mot)) base = mot + 'e';
    else if (/(ant|ent|é|i|u)$/u.test(mot)) base = mot + 'e';
    else return null;
  }
  if (nombre === 'singulier') return base;
  if (/[sx]$/u.test(base)) return base;
  if (genre === 'masculin' && /(royal|loyal|égal|normal)$/u.test(base)) return base.slice(0, -2) + 'aux';
  return base + 's';
}

/**
 * Acquisition symbolique native : une intention Prax + ses arguments se
 * réalisent par compositions de constituants. Les variantes ne changent
 * jamais l'action, les prix, le statut épistémique ou l'état du monde.
 * Retourne null lorsque les faits nécessaires manquent.
 */
function exprimerParoleBrute(sens: SensDeParole, variante = 0): ExpressionPrax | null {
  if (!sens.locuteur.trim() || !Number.isSafeInteger(variante)) return null;
  const registre = sens.registre ?? registreStable(sens.locuteur);
  const cle = sens.locuteur + ':' + sens.intention + ':' + variante + ':' + registre;
  const choisir = <T>(options: readonly T[], etape: string): T => optionStable(options, cle + ':' + etape);
  const fait = segmentDiscursif(sens.fait);
  const motif = segmentDiscursif(sens.motif);
  const sujet = segmentDiscursif(sens.sujet);

  let noyau: string;
  const savoirs = ['G3-tour-de-parole', 'G4-voix-stable', 'G6-variation-sans-faits-nouveaux'];
  switch (sens.intention) {
    case 'accueillir':
      noyau = choisir(['Je t’écoute', 'Dis-moi ce que tu cherches', 'Tu peux parler'], 'accueil');
      break;
    case 'ecouter':
      noyau = choisir(['Je t’écoute', 'Tu peux préciser ta demande', 'Je suis là, parle'], 'ecoute');
      break;
    case 'eluder':
      noyau = choisir(['Je préfère ne pas parler', 'Je ne peux rien te dire', 'Je ne souhaite pas discuter'], 'elusion')
        + (sujet ? ' ' + sujetAvecDe(sujet) : ' de cela');
      break;
    case 'refuser':
      noyau = choisir(['Je refuse', 'Je ne peux pas accepter', 'Ce n’est pas possible'], 'refus');
      break;
    case 'ceder':
      noyau = choisir(['D’accord, je cède', 'Je ne m’opposerai pas', 'Soit, je consens'], 'accord');
      break;
    case 'resister':
      noyau = choisir(['Je ne céderai pas', 'Je maintiens ma position', 'Ce n’est pas une menace qui me fera changer d’avis'], 'resistance');
      break;
    case 'rendreInsulte':
      noyau = choisir(['Ne me parle pas ainsi', 'Garde ces mots pour toi', 'Je ne te permets pas de m’insulter'], 'retour');
      break;
    case 'refuserExcuses':
      noyau = choisir(['Je n’accepte pas tes excuses', 'Tes excuses ne suffisent pas', 'Je ne suis pas prêt à pardonner'], 'excuses');
      break;
    case 'pardonner':
      noyau = choisir(['J’accepte tes excuses', 'Nous pouvons en rester là', 'Je te pardonne'], 'pardon');
      break;
    case 'remercier':
      noyau = choisir(['Je te remercie', 'Je t’en suis reconnaissant', 'Merci'], 'remerciement');
      break;
    case 'rassurer':
      noyau = choisir(['Tu n’as rien à craindre de moi', 'Il n’y a rien à pardonner', 'Ne t’inquiète pas'], 'rassurer');
      break;
    case 'ignorerSujet':
      noyau = choisir(['Je n’ai aucune information', 'Je ne sais rien', 'Je ne peux pas te renseigner'], 'ignorance')
        + (sujet ? ' ' + sujetAvecDe(sujet) : ' à ce propos');
      break;
    case 'presser':
      noyau = choisir(['Dis-moi précisément ce que tu veux', 'Vas-tu en venir au fait ?', 'Peux-tu préciser ta demande ?'], 'precision');
      break;
    case 'perdrePatience':
      noyau = choisir(['Je ne peux pas attendre davantage', 'Dis clairement ce que tu souhaites', 'Reviens avec une demande précise'], 'impatience');
      break;
    case 'renvoyer':
      noyau = choisir(['Je ne peux pas répondre à cette demande', 'Adresse-toi plutôt à quelqu’un de compétent', 'Ce n’est pas moi qui peux te renseigner'], 'redirection');
      break;
    case 'proposer':
      noyau = choisir(['Je peux te faire une proposition', 'Parlons des conditions', 'Voici ce que je propose'], 'proposition');
      break;
    case 'maintenirPrix':
      noyau = choisir(['Je maintiens mon prix', 'Le prix ne change pas', 'Je ne réduirai pas mon prix'], 'prix-maintenu');
      break;
    case 'consentirRabais':
      noyau = choisir(['J’accepte de réduire le prix', 'Je consens à une remise', 'Nous pouvons revoir le prix à la baisse'], 'rabais');
      break;
    case 'conclure':
      noyau = choisir(['Marché conclu', 'Notre accord est scellé', 'Nous avons un accord'], 'conclusion');
      break;
    case 'informer':
      if (!fait) return null;
      if (sens.statut === 'rapporte') {
        // Le personnage ne peut pas s'attribuer un témoignage visuel qu'il
        // n'a pas fait. Le rapport reste explicitement un rapport.
        noyau = 'Il se dit que ' + fait;
        savoirs.push('G2-provenance-rapportee');
      } else if (sens.statut === 'citation') {
        noyau = '« ' + fait + ' »';
        savoirs.push('G2-citation-attribuee');
      } else if (sens.statut === 'hypothese') {
        // Ne pas naturaliser une supposition : la forme interrogative
        // marque la modalité sans inventer la vérité du contenu.
        noyau = 'Hypothèse : ' + fait;
        savoirs.push('G2-hypothese');
      } else {
        noyau = fait;
      }
      savoirs.push('G2-fait-attribue');
      break;
    case 'demander':
      if (!sujet) return null;
      noyau = choisir(['Parle-moi', 'Que sais-tu', 'Peux-tu me renseigner'], 'question') + ' ' + sujetAvecDe(sujet);
      break;
    case 'contreOffre': {
      const p = sens.proposition;
      if (!p || !Number.isSafeInteger(p.montant) || p.montant < 0 || !p.monnaie.trim()) return null;
      const montant = String(p.montant) + ' ' + p.monnaie.trim();
      noyau = choisir(['Je ' + conjuguerPresentPrax('proposer', 'je'), 'Mon offre est de', 'Je peux aller jusqu’à'], 'commerce') + ' ' + montant;
      savoirs.push('G2-montant-invariant');
      break;
    }
    default:
      return null;
  }

  // Les marqueurs sont des constituants discursifs, pas des répliques.
  // La version sobre n'injecte pas de marqueur sans nécessité.
  const amorces: Record<RegistreParole, readonly string[]> = {
    sobre: ['', ''],
    chaleureux: ['', 'Écoute, ', 'Eh bien, '],
    reserve: ['', 'À vrai dire, ', 'Pour être clair, '],
    tranchant: ['', 'Non. ', 'Écoute-moi : '],
  };
  // Ne jamais faire précéder une acceptation ou un pardon de « Non ».
  const amorceAutorisee = registre === 'tranchant'
    && (sens.intention === 'ceder' || sens.intention === 'pardonner' || sens.intention === 'accueillir' || sens.intention === 'ecouter')
    ? ['', ''] : amorces[registre];
  // Une information canonique et sa provenance ne reçoivent aucun tic de
  // locuteur susceptible d'en changer la portée ou la typographie.
  const amorce = sens.intention === 'informer' ? '' : choisir(amorceAutorisee, 'amorce');
  const suite = amorce && /[,：:]\s*$/u.test(amorce) && /^[\p{Lu}]/u.test(noyau)
    ? noyau.charAt(0).toLocaleLowerCase('fr') + noyau.slice(1)
    : noyau;
  const conclusion = motif && ['refuser', 'resister', 'eluder'].includes(sens.intention) ? '. ' + ponctuer(motif) : '';
  const texte = ponctuer(amorce + suite) + conclusion;
  return { texte, acquis: savoirs, version: ACQUIS_EXPRESSION_V1 };
}


/**
 * Évite les répliques strictement répétées dans les derniers messages déjà
 * persistés par l'application. Aucune seconde mémoire et aucun état mutable :
 * une même scène et un même historique rendent le même texte.
 */
export function exprimerParole(
  sens: SensDeParole,
  variante = 0,
  derniersTextes: readonly string[] = [],
): ExpressionPrax | null {
  const premier = exprimerParoleBrute(sens, variante);
  if (!premier || derniersTextes.length === 0) return premier;
  const dejaPrononce = (candidat: ExpressionPrax): boolean =>
    derniersTextes.some((ligne) => ligne.includes(candidat.texte));
  if (!dejaPrononce(premier)) return premier;
  for (let ecart = 1; ecart <= 12; ecart++) {
    const autre = exprimerParoleBrute(sens, variante + ecart);
    if (autre && !dejaPrononce(autre)) {
      return { ...autre, acquis: [...autre.acquis, 'G6-anti-repetition-contextuelle'] };
    }
  }
  return premier;
}
