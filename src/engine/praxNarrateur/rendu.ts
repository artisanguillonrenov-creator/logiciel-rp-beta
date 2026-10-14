/**
 * Rendu brut en français des décisions de Prax.
 *
 * La narration s'adresse au joueur à la deuxième personne (« tu »), comme le
 * narrateur de l'application, et les répliques suivent le format que
 * l'interface met en forme : `Nom : « … »`. Chaque genre d'action a quelques
 * variantes, choisies de façon déterministe (même tour, même texte ; une
 * régénération change seulement la formulation).
 */
import { exemplesBibliotheque, renduActeJoueur, renduActePnj } from './bibliotheque';
import { composerPropositionPrax, exprimerParole, statutEnonce, type IntentionDeParole } from '../../prax/vocab/conversation';
import { sujetPrax } from './sujets';
import type { CompteRenduTour, EvenementTour, PnjDescription } from './types';
import { ID_JOUEUR } from './types';

function hacher(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export function choisir<T>(options: readonly T[], cle: string): T {
  return options[hacher(cle) % options.length];
}

/** Nom d'usage : sans titre (« Maître Osman » → « Osman »). */
export function nomCourt(nom: string): string {
  // Un nom avec article (« le marchand », « la noble captive ») se garde entier.
  if (/^(le|la|les|l’|l'|un|une)[\s’']/i.test(nom)) return nom.replace(/^\S+/, (a) => a.toLowerCase());
  const mots = nom.split(/\s+/).filter((m) => !/^(ma[iî]tre(sse)?|roi|reine|imp[ée]ratrice|empereur|warchief|alpha|grande?|chamane|sultan[e]?|ancien|matriarche|reine-m[èe]re|roi-forgeron|chef|sir|dame)$/i.test(m));
  return mots[0] ?? nom;
}

/** « de Margaux », « d’Odette ». */
export function deNom(nom: string): string {
  if (/^le /i.test(nom)) return `du ${nom.slice(3)}`;
  if (/^les /i.test(nom)) return `des ${nom.slice(4)}`;
  if (/^(la |l’|l'|un |une )/i.test(nom)) return `de ${nom}`;
  return /^[aeiouyhéèêâîôû]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

/** « à Margaux », « au marchand », « aux gardes », « à la captive ». */
export function aNom(nom: string): string {
  if (/^le /i.test(nom)) return `au ${nom.slice(3)}`;
  if (/^les /i.test(nom)) return `aux ${nom.slice(4)}`;
  return `à ${nom}`;
}

/** « A », « A et B », « A, B et C ». */
export function liste(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

function motsUtiles(texte: string): Set<string> {
  return new Set(
    texte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((m) => m.length >= 5),
  );
}

/** La réplique qui partage le plus de mots avec le message du joueur ; à défaut, une au hasard stable. */
function repliquePertinente(repliques: readonly string[], message: string, cle: string): string {
  const mots = motsUtiles(message);
  let meilleure = -1;
  let choix: string | undefined;
  for (const r of repliques) {
    const n = [...motsUtiles(r)].filter((m) => mots.has(m) || [...mots].some((x) => x.length >= 6 && m.startsWith(x.slice(0, 6)))).length;
    if (n > meilleure && n > 0) {
      meilleure = n;
      choix = r;
    }
  }
  return choix ?? choisir(repliques, cle);
}

function majuscule(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** « de la », « du », « des », « de l’ » devant un nom de sujet ou de lieu. */
export function avecDe(nom: string): string {
  if (/^le /i.test(nom)) return `du ${nom.slice(3)}`;
  if (/^les /i.test(nom)) return `des ${nom.slice(4)}`;
  if (/^(la |l’|l')/i.test(nom)) return `de ${nom}`;
  return /^[aeiouyhéè]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

/** « au », « à la », « aux », « à l’ ». */
export function avecA(nom: string): string {
  if (/^le /i.test(nom)) return `au ${nom.slice(3)}`;
  if (/^les /i.test(nom)) return `aux ${nom.slice(4)}`;
  if (/^(la |l’|l')/i.test(nom)) return `à ${nom}`;
  return /^(comptoir|palais|march|quartier|port)/i.test(nom) ? `au ${nom}` : `à ${nom}`;
}

// Les attitudes verbales sont des actions de langage. Sans action Prax
// distincte, une réponse ne prouve ni sourire, ni recul, ni posture du corps.
const ACTIONS_DE_PAROLE_SEULES: ReadonlySet<EvenementTour['genre']> = new Set([
  'accueillir', 'repondreAimable', 'rabrouer', 'repondre',
  'eluder', 'ignorerSujet', 'remercier', 'ceder', 'tenirTete', 'insulter',
  'rendreInsulte', 'menacer', 'implorer', 'accuser', 'pardonner', 'rassurer',
  'refuserExcuses', 'presser', 'perdrePatience', 'proposer', 'refuserDemande',
  'renvoyer', 'consentirRabais', 'maintenirPrix', 'conclure',
]);

const ACCUEIL_PAR_ROLE: Record<string, string[]> = {
  receptionniste: [
    'Bienvenue à la Guilde des Aventuriers. Tu viens pour un contrat, ou pour t’inscrire ?',
    'Bonjour. Le tableau des missions est derrière moi. Tu cherches quelque chose de précis ?',
  ],
  taverniere: ['Entre, entre ! Une chope, un repas, une chambre ?', 'Installe-toi où tu veux. Qu’est-ce que je te sers ?'],
  forgeronne: ['Tu as besoin d’une lame, ou de faire réparer la tienne ?', 'Attention aux braises. Qu’est-ce qui t’amène à la forge ?'],
  passeuse: ['Laissez-passer et paiement d’abord. Où veux-tu aller ?', 'La Porte est ouverte. Destination ?'],
  marchand: ['Tu viens acheter, vendre, ou me faire perdre mon temps ?', 'Approche. Ici, tout se négocie.'],
};

type Gabarit = (e: EvenementTour, cle: string, message: string) => string[];

/** Paragraphe(s) pour un événement : narration puis éventuelle réplique. */
const RENDU_PNJ: Partial<Record<EvenementTour['genre'], Gabarit>> = {
  accueillir: (e, cle) => {
    const lignes = ACCUEIL_PAR_ROLE[e.roleActeur ?? ''] ?? ['Bonjour. Je peux t’aider ?'];
    return [choisir([`${e.acteurNom} lève les yeux vers toi.`, `${e.acteurNom} t’adresse un signe de tête.`], cle), replique(e, choisir(lignes, cle + 'l'))];
  },
  rendreSalut: (e, cle) =>
    versJoueur(e)
      ? [choisir([`${e.acteurNom} te rend ton salut.`, `${e.acteurNom} te salue à son tour.`], cle), replique(e, choisir(['Bonjour.', 'Le bonjour à toi.', 'Salut.'], cle + 'l'))]
      : [`${e.acteurNom} rend son salut ${aNom(e.cibleNom ?? '')}.`],
  repondreAimable: (e, cle) => [
    choisir([`${e.acteurNom} t’écoute avec attention.`, `${e.acteurNom} se tourne vers toi.`], cle),
    replique(e, choisir(['Je t’écoute. Que puis-je faire pour toi ?', 'Oui ? Parle, je t’écoute.', 'Bien sûr. Dis-moi.'], cle + 'l')),
  ],
  rabrouer: (e, cle) => [
    choisir([`${e.acteurNom} te toise sans chaleur.`, `${e.acteurNom} ne cache pas son agacement.`], cle),
    replique(e, choisir(['Passe ton chemin.', 'Je n’ai rien à te dire.', 'Tu me fais perdre mon temps.'], cle + 'l')),
  ],
  repondre: (e, cle, message) => {
    const sujet = e.sujet ? sujetPrax(e.sujet) : undefined;
    const ligne = sujet ? repliquePertinente(sujet.repliques, message, cle + 'l') : 'Je t’ai dit ce que je savais.';
    return [choisir([`${e.acteurNom} réfléchit un instant.`, `${e.acteurNom} baisse un peu la voix.`, `${e.acteurNom} hoche la tête.`], cle), replique(e, ligne)];
  },
  eluder: (e, cle) => [
    choisir([`${e.acteurNom} détourne le regard.`, `${e.acteurNom} hausse les épaules.`], cle),
    replique(e, choisir(['Ce ne sont pas des choses dont on parle avec un inconnu.', 'Je ne te connais pas assez pour ça.', 'Demande à quelqu’un d’autre.'], cle + 'l')),
  ],
  ignorerSujet: (e, cle) => [
    choisir([`${e.acteurNom} secoue la tête.`, `${e.acteurNom} fait la moue.`], cle),
    replique(e, choisir([`${majuscule(e.sujetNom ?? 'ça')} ? Je n’en sais rien.`, `Je ne sais rien ${avecDe(e.sujetNom ?? 'cela')}.`], cle + 'l')),
  ],
  remercier: (e, cle) => [replique(e, choisir(['Merci.', 'C’est gentil, merci.', 'Je te remercie.'], cle))],
  ignorer: (e, cle) => [versJoueur(e) ? choisir([`${e.acteurNom} fait mine de ne pas t’entendre.`, `${e.acteurNom} t’ignore ostensiblement.`], cle) : `${e.acteurNom} ignore ${e.cibleNom}.`],
  ceder: (e, cle) => [
    choisir([`${e.acteurNom} recule d’un pas.`, `${e.acteurNom} lève les mains.`], cle),
    replique(e, choisir(['D’accord, d’accord… Pas de bêtises.', 'Calme-toi. Je ferai ce que tu veux.'], cle + 'l')),
  ],
  tenirTete: (e, cle) => [
    choisir([`${e.acteurNom} ne bouge pas d’un pouce.`, `${e.acteurNom} soutient ton regard.`], cle),
    replique(e, choisir(['Tu crois me faire peur ?', 'Essaie, pour voir.', 'Les menaces ne marchent pas sur moi.'], cle + 'l')),
  ],
  insulter: (e, cle) =>
    versJoueur(e)
      ? [`${e.acteurNom} crache par terre à tes pieds.`, replique(e, choisir(['Dégage, vermine.', 'Tu me dégoûtes.'], cle))]
      : [`${e.acteurNom} insulte ${e.cibleNom}.`],
  rendreInsulte: (e, cle) => [
    choisir([`${e.acteurNom} se raidit.`, `Les yeux ${deNom(e.acteurNom)} se plissent.`], cle),
    replique(e, choisir(['Garde tes insultes pour ton miroir.', 'Répète ça, pour voir.', 'C’est toi qui parles ?'], cle + 'l')),
  ],
  menacer: (e, cle) =>
    versJoueur(e) ? [`${e.acteurNom} pose la main sur son arme.`, replique(e, choisir(['Un pas de plus et tu le regretteras.', 'Tu ferais mieux de partir.'], cle))] : [`${e.acteurNom} menace ${e.cibleNom}.`],
  attaquer: (e) => [versJoueur(e) ? `${e.acteurNom} se jette sur toi !` : `${e.acteurNom} attaque ${e.cibleNom} !`],
  riposter: (e) => [versJoueur(e) ? `${e.acteurNom} riposte et te frappe à son tour !` : `${e.acteurNom} riposte contre ${e.cibleNom} !`],
  implorer: (e, cle) => [replique(e, choisir(['Arrête ! Je t’en supplie !', 'Pitié ! Arrête !'], cle))],
  fuir: (e, cle) => [choisir([`${e.acteurNom} s’enfuit sans demander son reste.`, `${e.acteurNom} prend la fuite.`], cle)],
  s_interposer: (e, cle) => [`${e.acteurNom} s’interpose entre ${e.cibleNom} et ${e.victimeNom ?? 'sa victime'}.`, replique(e, choisir(['Ça suffit !', 'Assez !'], cle))],
  accuser: (e, cle) => [
    versJoueur(e) ? `${e.acteurNom} pointe un doigt accusateur vers toi.` : `${e.acteurNom} accuse ${e.cibleNom}.`,
    replique(e, choisir(['Voleur ! Je t’ai vu faire !', 'Rends ce que tu as pris, voleur !'], cle)),
  ],
  se_mefier: (e, cle) => [versJoueur(e) ? choisir([`${e.acteurNom} te jette un regard méfiant.`, `${e.acteurNom} garde désormais un œil sur toi.`], cle) : `${e.acteurNom} se méfie de ${e.cibleNom}.`],
  rendreService: (e, cle) => [
    versJoueur(e) ? `${e.acteurNom} te rend service à son tour.` : `${e.acteurNom} rend service ${aNom(e.cibleNom ?? '')}.`,
    replique(e, choisir(['Je n’oublie pas ce que tu as fait pour moi.', 'Une faveur en vaut une autre.'], cle)),
  ],
  pardonner: (e, cle) => [replique(e, choisir(['C’est oublié.', 'Bien. N’en parlons plus.'], cle))],
  rassurer: (e, cle) => [replique(e, choisir(['Des excuses ? Tu ne m’as rien fait.', 'Il n’y a rien à pardonner.'], cle))],
  refuserExcuses: (e, cle) => [`${e.acteurNom} croise les bras.`, replique(e, choisir(['Tes excuses, garde-les.', 'Trop tard pour ça.'], cle))],
  presser: (e, cle) => [
    choisir([`${e.acteurNom} croise les bras.`, `${e.acteurNom} hausse un sourcil.`], cle),
    replique(e, choisir(['Viens-en au fait : que veux-tu exactement ?', 'Je t’écoute, mais sois plus clair.', 'Et donc ? Qu’est-ce que tu veux ?'], cle + 'l')),
  ],
  perdrePatience: (e, cle) => [`${majuscule(e.acteurNom)} soupire bruyamment.`, replique(e, choisir(['Tu me fais perdre mon temps.', 'Reviens quand tu sauras ce que tu veux.'], cle + 'l'))],
  proposer: (e, cle) => [
    choisir([`${e.acteurNom} te jauge un instant.`, `${e.acteurNom} se gratte le menton.`, `Un éclat d’intérêt passe dans le regard ${deNom(e.acteurNom)}.`], cle),
    replique(e, choisir(['Ça peut se trouver. Reste à parler du prix.', 'Je dois avoir ce qu’il te faut. Mais ça se paie.', 'Je vois ce que tu cherches. Ça ne sera pas donné.'], cle + 'l')),
  ],
  refuserDemande: (e, cle) => [
    choisir([`${e.acteurNom} secoue la tête.`, `${e.acteurNom} te tourne à moitié le dos.`], cle),
    replique(e, choisir(['Je n’ai rien de tel pour toi.', 'Pas pour toi.', 'Cherche ailleurs.'], cle + 'l')),
  ],
  renvoyer: (e, cle) => [
    choisir([`${e.acteurNom} hausse les épaules.`, `${e.acteurNom} fait un geste vague.`], cle),
    replique(e, choisir(['Ce n’est pas à moi qu’il faut demander ça. Vois plutôt un marchand.', 'Je ne vends rien, moi. Adresse-toi à qui fait commerce ici.'], cle + 'l')),
  ],
  consentirRabais: (e, cle) => [`${majuscule(e.acteurNom)} fait mine de réfléchir.`, replique(e, choisir(['Bon… pour toi, je peux faire un effort.', 'D’accord. Je baisse un peu, mais pas plus.'], cle + 'l'))],
  maintenirPrix: (e, cle) => [
    choisir([`${e.acteurNom} ne cille pas.`, `${e.acteurNom} croise les bras.`], cle),
    replique(e, choisir(['Mon prix est mon prix.', 'C’est à prendre ou à laisser.'], cle + 'l')),
  ],
  conclure: (e, cle) => [
    choisir([`${e.acteurNom} empoche les pièces.`, `${e.acteurNom} compte les pièces avant de les faire disparaître.`], cle),
    replique(e, choisir(['Marché conclu.', 'Affaire faite. Ce fut un plaisir.'], cle + 'l')),
  ],
  raconter: (e, cle) => {
    const r = e.rapporte;
    const fait = r ? `${r.auteurNom} ${{ voler: 'a volé', attaquer: 'a attaqué', menacer: 'a menacé' }[r.genre as 'voler' | 'attaquer' | 'menacer'] ?? 'a agi contre'} ${r.victimeNom}` : 'il s’est passé quelque chose';
    return versJoueur(e)
      ? [`${e.acteurNom} se penche vers toi.`, replique(e, `${majuscule(fait)}. Je te le dis, c’est tout.`)]
      : [choisir([`${e.acteurNom} glisse quelques mots ${aNom(e.cibleNom ?? '')}.`, `${e.acteurNom} prend ${e.cibleNom} à part.`], cle), replique(e, `${majuscule(fait)}. Je l’ai vu.`)];
  },
};

RENDU_PNJ.acte = (e, cle) => {
  const r = renduActePnj(e, cle, choisir);
  return r.replique ? [r.narration, replique(e, r.replique)] : [r.narration];
};

function versJoueur(e: EvenementTour): boolean {
  return e.cible === ID_JOUEUR;
}

function replique(e: EvenementTour, texte: string): string {
  return `${e.acteurNom} : « ${texte} »`;
}

/** Phrase du joueur (deuxième personne). */
function renduJoueur(e: EvenementTour, cle: string, presentsApres: PnjDescription[]): string[] {
  const c = e.cibleNom ?? '';
  switch (e.genre) {
    case 'acte':
      return renduActeJoueur(e);
    case 'saluer':
      return [choisir([`Tu salues ${c}.`, `Tu adresses un salut ${aNom(c)}.`], cle)];
    case 'converser':
    case 'relancer': {
      // Prax a enregistré un acte de PAROLE, jamais l'exécution d'une action
      // citée. Le contenu du joueur est conservé au lieu d'être résumé ou
      // transformé en une action imaginaire.
      if (e.precision) {
        const texte = e.precision.trim();
        // « Je te dis que tu mens » s'adresse à l'interlocuteur : ce sont tes mots, pas des propos rapportés.
        const adresseDirecte = /^je (te |vous )?(dis|affirme|declare|déclare|repete|répète) que\b/i.test(texte) && /\b(tu|te|t’|t'|toi|vous)\b/i.test(texte.replace(/^je (te |vous )?/i, ''));
        const modalite = adresseDirecte ? 'direct' : statutEnonce(texte);
        const intro = modalite === 'hypothese' ? `Tu évoques une hypothèse devant ${c}`
          : modalite === 'rapporte' ? `Tu rapportes des propos ${aNom(c)}`
          : modalite === 'negation' ? `Tu précises ${aNom(c)}`
          : modalite === 'citation' ? `Tu prononces ces mots devant ${c}`
          : modalite === 'rectification' ? `Tu rectifies tes propos auprès ${deNom(c)}`
          : `Tu dis ${aNom(c)}`;
        const dit = modalite === 'citation' && /^[«“"]/.test(texte) ? texte : `« ${texte} »`;
        return [`${intro} : ${dit}`];
      }
      return e.genre === 'converser'
        ? [choisir([`Tu t’adresses ${aNom(c)}.`, `Tu engages la conversation avec ${c}.`], cle)]
        : [choisir([`Tu insistes auprès ${deNom(c)}.`, 'Tu reprends la parole.'], cle)];
    }
    case 'demander': {
      const debut = choisir([`Tu exposes ta demande ${aNom(c)}.`, `Tu fais part de ce que tu cherches ${aNom(c)}.`], cle);
      if (!e.precision?.trim()) return [debut];
      const cite = e.precision.trim();
      return [debut, cite.startsWith('«') ? cite : `« ${cite} »`];
    }
    case 'marchander':
      return [choisir([`Tu tentes de faire baisser le prix.`, `Tu marchandes avec ${c}.`], cle)];
    case 'payerPrix':
      return [`Tu paies ${c} le prix convenu.`];
    case 'interroger':
      return [`Tu interroges ${c} au sujet ${avecDe(e.sujetNom ?? 'cela')}.`];
    case 'complimenter':
      return [`Tu complimentes ${c}.`];
    case 'menacer':
      // Une menace conditionnelle garde les mots exacts du joueur.
      if (e.precision?.trim()) return [`Tu menaces ${c} : « ${e.precision.trim()} »`];
      return [choisir([`Tu menaces ${c}.`, `Tu adresses une menace ${aNom(c)}.`], cle)];
    case 'insulter':
    case 'rendreInsulte':
      return [`Tu insultes ${c}.`];
    case 'attaquer':
    case 'riposter':
      // L'exécution d'une intention offensive ne prouve pas une blessure ;
      // le moteur doit attester séparément l'impact.
      return [choisir([`Tu attaques ${c}.`, `Tu portes un coup en direction de ${c}.`], cle)];
    case 'voler':
      return [`Tu tentes de voler ${c}.`];
    case 'aider':
      return [`Tu proposes ton aide ${aNom(c)}.`];
    case 'payer':
      return [`Tu glisses quelques pièces ${aNom(c)}.`];
    case 's_excuser':
      return [`Tu présentes tes excuses ${aNom(c)}.`];
    case 'remercier':
      return [`Tu remercies ${c}.`];
    case 'se_rendre': {
      const lignes = [`Tu te rends ${avecA(e.lieuNom ?? 'ailleurs')}.`];
      if (presentsApres.length === 0) lignes.push('Il n’y a personne.');
      else lignes.push(phrasePresents(presentsApres));
      return lignes;
    }
    case 'attendre':
      // Attendre n'autorise pas Prax à faire regarder ou marcher le joueur.
      return [choisir(['Tu attends.', 'Un moment s’écoule sans nouvelle action de ta part.'], cle)];
    default:
      return [e.libelle];
  }
}

/** « Margaux Fontaine, la réceptionniste…, est là. » / « A, …, et B, …, sont là. » */
export function phrasePresents(presents: PnjDescription[]): string {
  const pieces = presents.map((p) => (p.libelleRole ? `${p.nom}, ${p.libelleRole},` : p.nom));
  let texte = '';
  pieces.forEach((piece, i) => {
    if (i === 0) texte = piece;
    else if (i === pieces.length - 1) texte += ` et ${piece}`;
    else texte += texte.endsWith(',') ? ` ${piece}` : `, ${piece}`;
  });
  return majuscule(`${texte} ${presents.length > 1 ? 'sont là.' : 'est là.'}`);
}

export interface DonneesRendu {
  /** Événement du joueur, puis ceux des PNJ, dans l'ordre. */
  evenements: EvenementTour[];
  presentsApres: PnjDescription[];
  /** Le vol a-t-il été remarqué par sa victime ? */
  volRemarque?: boolean;
  variante: number;
  tour: number;
  /** Message du joueur, pour choisir la réplique la plus pertinente. */
  message?: string;
  /** Réponses existantes de la même partie ; ce n'est pas une nouvelle mémoire. */
  derniersTextes?: readonly string[];
  /** Accumule uniquement les compétences effectivement employées. */
  acquisNarratifs?: string[];
}

/** Le texte du message du narrateur Prax. */
export function rendreTour(d: DonneesRendu): string {
  const paragraphes: string[] = [];
  d.evenements.forEach((e, i) => {
    const cle = `${d.tour}:${i}:${d.variante}`;
    if (e.acteur === ID_JOUEUR) {
      const lignes = renduJoueur(e, cle, d.presentsApres);
      if (e.genre === 'voler') lignes.push(d.volRemarque ? `${e.cibleNom} s’en aperçoit !` : 'Personne ne semble rien remarquer.');
      paragraphes.push(lignes.join(' '));
      return;
    }
    // Une méfiance interne ne constitue pas une expression visible :
    // on attend une parole, une réaction ou un événement observable de Prax.
    if (e.genre === 'se_mefier') return;
    // Narration subjective : une action entre deux PNJ absents du champ
    // perceptif du joueur ne devient jamais un fait directement raconté.
    // Le moteur social enregistre toujours l'action : on ne modifie pas
    // l'histoire, seulement les informations autorisées à l'affichage.
    if (e.cible !== ID_JOUEUR && !e.temoins.includes(ID_JOUEUR)) return;
    const gabarit = RENDU_PNJ[e.genre];
    const lignes = (gabarit ? gabarit(e, cle, d.message ?? '') : [e.libelle]).map(majuscule);
    // Prax compose lui-même l'expression d'une décision déjà prise : les règles
    // de son vocabulaire natif ne créent ni nouvelles actions ni nouveaux faits.
    const intentionsNatives: Partial<Record<EvenementTour['genre'], IntentionDeParole>> = {
      repondreAimable: 'ecouter',
      rabrouer: 'refuser',
      eluder: 'eluder',
      ceder: 'ceder',
      tenirTete: 'resister',
      rendreInsulte: 'rendreInsulte',
      refuserExcuses: 'refuserExcuses',
      pardonner: 'pardonner',
      remercier: 'remercier',
      rassurer: 'rassurer',
      ignorerSujet: 'ignorerSujet',
      presser: 'presser',
      perdrePatience: 'perdrePatience',
      // renvoyer et proposer gardent les répliques du narrateur, qui disent vers qui
      // se tourner et que la chose se paie : la formule générique perdrait cette information.
      refuserDemande: 'refuser',
      maintenirPrix: 'maintenirPrix',
      consentirRabais: 'consentirRabais',
      conclure: 'conclure',
    };
    const intention = intentionsNatives[e.genre];
    if (intention) {
      const acquis = exprimerParole({
        intention,
        locuteur: e.acteur,
        sujet: e.sujetNom,
        registre: e.registreParole,
      }, d.variante + d.tour + i, [...(d.derniersTextes ?? []), ...paragraphes]);
      if (acquis) {
        d.acquisNarratifs?.push(`${e.acteur}:${acquis.acquis.join(',')}`);
        // Les anciens gestes génériques ne sont pas attestés dans l'état
        // Prax (« recule », « croise les bras »). Une simple parole ne doit
        // pas créer de déplacement ou de fait physique non joué.
        paragraphes.push(`${majuscule(e.acteurNom)} : « ${acquis.texte} »`);
        return;
      }
    }
    if (e.genre === 'raconter' && e.rapporte) {
      const infinitif: Record<string, string> = { voler: 'voler', attaquer: 'attaquer', menacer: 'menacer' };
      const evenement = composerPropositionPrax({
        sujet: e.rapporte.auteurNom,
        personne: 'il',
        verbe: infinitif[e.rapporte.genre] ?? '',
        temps: 'passeCompose',
        complement: e.rapporte.victimeNom,
      });
      if (!evenement) return;
      const fait = evenement.texte;
      const rapporte = exprimerParole({
        intention: 'informer',
        locuteur: e.acteur,
        fait,
        statut: 'rapporte',
        registre: e.registreParole,
      }, d.variante + d.tour + i, [...(d.derniersTextes ?? []), ...paragraphes]);
      if (rapporte) {
        d.acquisNarratifs?.push(`${e.acteur}:G1-passe-compose,G2-provenance-rapportee`);
        paragraphes.push(`${majuscule(e.acteurNom)} : « ${rapporte.texte} »`);
        return;
      }
    }
    if (ACTIONS_DE_PAROLE_SEULES.has(e.genre)) {
      const repliques = lignes.filter((l) => l.includes(' : « '));
      if (repliques.length) {
        paragraphes.push(repliques.join('\n'));
        return;
      }
    }
    // Les actions physiques effectives gardent leur narration.
    paragraphes.push(lignes.join('\n'));
  });
  if (!d.evenements.some((e) => e.acteur !== ID_JOUEUR) && d.presentsApres.length > 0) {
    paragraphes.push(choisir(['Personne ne réagit.', 'Le silence retombe.', 'Rien ne bouge autour de toi.'], `${d.tour}:calme:${d.variante}`));
  }
  return paragraphes.join('\n\n');
}

/** Message quand Prax ne sait pas traiter le message du joueur. */
export function rendreIncompris(motif: string, presents: PnjDescription[]): string {
  const qui = presents.length ? `Présents : ${presents.map((p) => nomCourt(p.nom)).join(', ')}.` : 'Il n’y a personne ici.';
  return [
    `(Narrateur Prax) ${motif}`,
    `Pour l’instant, Prax sait : saluer quelqu’un, lui parler, l’interroger sur un sujet (la Guilde des Aventuriers, les Voiles, les Portes Astra, la garde, une capitale…), le complimenter, l’aider, le payer, s’excuser, le menacer, l’insulter, l’attaquer, le voler, ou te rendre dans un lieu (taverne, forge, guilde, Porte Astra…) ; et, avec la bibliothèque universelle : ${exemplesBibliotheque()} Écris « continue » pour laisser les autres agir.`,
    qui,
  ].join('\n\n');
}

/** Texte de la scène d'ouverture. */
export function rendreOuverture(lieuNom: string, ville: string, presents: PnjDescription[], suite: string, ambiance = ''): string {
  const intro = `Tu te trouves ${avecA(lieuNom)}${lieuNom.includes(ville) ? '' : ` ${deNom(ville)}`}.`;
  const qui = presents.length === 0 ? 'Il n’y a personne autour de toi.' : phrasePresents(presents);
  // L'atmosphère ne vient que d'une description déjà validée par la partie.
  // Inventer une pluie, une odeur ou un geste relèverait du monde, pas du style.
  const detailsVerifies = ambiance.trim();
  return [`${intro} ${qui}`, detailsVerifies, suite].filter((t) => t.trim().length > 0).join('\n\n');
}

/** Résumé des coulisses pour le diagnostic concepteur. */
export function lignesCoulisses(cr: CompteRenduTour): string[] {
  const lignes: string[] = [];
  lignes.push(cr.joueur.compris ? `Action comprise : ${cr.joueur.action}` : `Non compris : ${cr.joueur.motif ?? ''}`);
  for (const c of cr.coulisses) {
    lignes.push(`${c.acteur} → ${c.choix}`);
    for (const o of c.options) lignes.push(`   ${o.note.toFixed(2)}  ${o.libelle}`);
  }
  for (const r of cr.relations) lignes.push(`Relation ${r.pnj} → toi : ${r.axe} ${r.avant} → ${r.apres}`);
  for (const competence of cr.acquisNarratifs ?? []) lignes.push(`Savoir narratif utilisé : ${competence}`);
  return lignes;
}
