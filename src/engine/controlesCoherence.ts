import { prenomRole, type RoleCanon, type TypeRole } from './rolesCanon';
import { rapportOk, type RapportValidation } from './validator';

/**
 * Contrôles de cohérence après la réponse du narrateur (étape 8 de la
 * logique de réponse). Un échec déclenche la correction automatique
 * existante (validator.ts → determinerStrategie).
 */

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Répliques retirées avant l'analyse : un PNJ peut dire « Tu prends ça ? ».
function sansRepliques(texte: string): string {
  return texte.replace(/«[^»]*»/g, ' ').replace(/"[^"\n]*"/g, ' ').replace(/“[^”]*”/g, ' ');
}

// Gestes du joueur à la deuxième personne (« Tu places tes mains… »).
// Les verbes de perception (sens, vois, entends, remarques…) restent permis :
// le narrateur décrit ce que le joueur perçoit.
const VERBES_ACTION = [
  'prends', 'places', 'poses', 'saisis', 'attrapes', 'empoignes', 'agrippes', 'retournes', 'penetres', 'embrasses',
  'caresses', 'leches', 'suces', 'baises', 'reponds', 'dis', 'murmures', 'cries', 'demandes', 'marches', 'avances',
  'recules', 'sors', 'entres', 'quittes', 'cours', 'frappes', 'tapes', 'tends', 'pousses', 'tires', 'lances', 'jettes',
  'ouvres', 'fermes', 'leves', 'baisses', 'approches', 'diriges', 'assois', 'assieds', 'allonges', 'installes', 'degaines',
  'rengaines', 'attaques', 'esquives', 'pares', 'bois', 'manges', 'souris', 'hoches', 'acquiesces', 'glisses', 'enfonces',
  'accelères', 'acceleres', 'ralentis', 'jouis', 'ejacules', 'remplis', 'deshabilles', 'enleves', 'retires', 'mets',
  'donnes', 'offres', 'montres', 'presentes', 'choisis', 'remercies', 'salues', 'continues', 'penches', 'releves', 'agenouilles', 'achetes', 'vends', 'signes', 'paies', 'payes',
];
// « tu » sujet n'importe où dans la narration (« Une fois arrivés, tu
// pénètres… », « un contrat que tu signes »), répliques retirées.
const RE_GESTE = new RegExp(
  `\\btu\\s+(?:ne\\s+)?(?:(?:te|la|le|les|lui|leur|en|y)\\s+|t'|l')*(${VERBES_ACTION.join('|')})\\b`,
  'g',
);
// Mêmes gestes au pluriel, quand le narrateur fait agir le joueur et ses
// compagnons ensemble (« vous signez », « vous lui montrez »).
const VERBES_ACTION_VOUS = [
  'prenez', 'posez', 'saisissez', 'attrapez', 'signez', 'montrez', 'penetrez', 'payez', 'achetez', 'acceptez', 'choisissez',
  'repondez', 'dites', 'tendez', 'donnez', 'offrez', 'frappez', 'attaquez', 'degainez', 'buvez', 'mangez', 'remerciez', 'saluez',
  'marchez', 'avancez', 'entrez', 'dirigez', 'sortez', 'quittez', 'courez', 'approchez', 'rendez',
];
const RE_GESTE_VOUS = new RegExp(
  `\\bvous\\s+(?:ne\\s+)?(?:(?:vous|la|le|les|lui|leur|en|y)\\s+|l')*(${VERBES_ACTION_VOUS.join('|')})\\b`,
  'g',
);
// Verbes de trajet : permis en début de réponse quand le joueur a annoncé un déplacement.
const DEBUT_REPONSE = 450;
const VERBES_TRAJET = new Set(['marches', 'avances', 'entres', 'diriges', 'sors', 'quittes', 'cours', 'approches', 'marchez', 'avancez', 'entrez', 'dirigez', 'sortez', 'quittez', 'courez', 'approchez', 'rendez']);
const ANNONCE_DEPLACEMENT = /\b(all(?:ons|er|ez)|vais|vas|va|pars|partons|rends|rendons|entre|entrons|retourne|retournons|dirige|dirigeons|rejoin\w*|direction|filons|rentre|rentrons|sors|sortons|avance|avan[cç]ons|approche|approchons)\b/;

/** Phrases où le narrateur fait agir le joueur, sauf gestes que le joueur a lui-même annoncés. */
export function trouverGestesDuJoueur(reponse: string, messageJoueur: string): string[] {
  const texte = normaliser(sansRepliques(reponse)).replace(/’/g, "'");
  const annonce = normaliser(messageJoueur);
  const gestes = new Set<string>();
  for (const m of [...texte.matchAll(RE_GESTE), ...texte.matchAll(RE_GESTE_VOUS)]) {
    const verbe = m[1];
    // Le trajet annoncé (« allons à la guilde ») se raconte en début de
    // réponse ; plus loin (« vous quittez la Guilde »), c'est une décision.
    const enOuverture = (m.index ?? 0) < DEBUT_REPONSE;
    // « je sors ma queue » → « tu sors… » ne fait que reprendre le joueur.
    if (annonce.includes(verbe.slice(0, Math.max(4, verbe.length - 2)))) continue;
    if (enOuverture && VERBES_TRAJET.has(verbe) && ANNONCE_DEPLACEMENT.test(annonce)) continue;
    gestes.add(verbe);
  }
  return [...gestes];
}

export function validerGestesDuJoueur(reponse: string, messageJoueur: string, personnageNom: string): RapportValidation {
  const gestes = trouverGestesDuJoueur(reponse, messageJoueur);
  if (!gestes.length) return rapportOk();
  return {
    ok: false,
    checks: [{
      nom: 'contrat_joueur',
      ok: false,
      gravite: 'grave',
      raison: `Le narrateur décrit des gestes, paroles ou décisions de ${personnageNom} que le joueur n'a pas annoncés (${gestes.slice(0, 5).join(', ')}), y compris avec « vous ». Réécris la scène en décrivant seulement ce que les autres font et ce qu'il perçoit, et arrête-toi au moment où ${personnageNom} doit agir ou parler.`,
    }],
  };
}

const DESIGNATIONS_ROLES: Record<TypeRole, RegExp> = {
  maitresse_guilde: /ma[iî]tre(?:sse)? de (?:la )?guilde|chef(?:fe)? de (?:la )?guilde|dirige(?:ante?)? (?:de )?la guilde/i,
  receptionniste: /r[ée]ceptionniste|(?:jeune )?femme (?:à|de) l'accueil|derri[èe]re le comptoir/i,
  taverniere: /taverni[èe]re?|aubergiste|patronne de la taverne|patron de la taverne/i,
  forgeronne: /forgeronn?e?/i,
  passeuse: /passeuse|passeur|gardienne de la porte/i,
  souverain: /\b(?:le roi|la reine|sa majest[ée]|le souverain|la souveraine|l'imp[ée]ratrice|l'empereur)\b/i,
};

// Mots à majuscule qui ne sont pas des noms de personnes.
const NON_NOMS = new Set(['le', 'la', 'les', 'un', 'une', 'il', 'elle', 'sir', 'maitre', 'maitresse', 'dame', 'guilde', 'vous', 'tu', 'son', 'sa', 'ses', 'au', 'du', 'de', 'des', 'et', 'en', 'ce', 'cette', 'mais', 'puis', 'derriere', 'pres']);

/** Rôle fixé dont la réponse donne la place à un autre personnage (« le chef de la Guilde, Maître Kael »). */
export function trouverRolesUsurpes(reponse: string, roles: RoleCanon[], nomsConnus: string[]): { role: RoleCanon; intrus: string }[] {
  const connus = new Set(nomsConnus.map((n) => normaliser(n)));
  const resultat: { role: RoleCanon; intrus: string }[] = [];
  for (const role of roles) {
    const prenom = normaliser(prenomRole(role));
    if (normaliser(reponse).includes(prenom)) continue;
    const designation = DESIGNATIONS_ROLES[role.role];
    const m = designation.exec(reponse);
    if (!m) continue;
    // Nom propre juste après la désignation (même phrase, 120 caractères).
    const suite = reponse.slice(m.index + m[0].length, m.index + m[0].length + 120).split(/[.!?\n]/)[0];
    const candidats = [...suite.matchAll(/\b([A-ZÀ-Ý][a-zà-ÿ'-]{2,})\b/g)].map((x) => x[1]).filter((mot) => !NON_NOMS.has(normaliser(mot)) && !connus.has(normaliser(mot)));
    // Ou étiquette de réplique d'un inconnu dans la réponse, la désignation étant présente.
    if (candidats.length) resultat.push({ role, intrus: candidats[0] });
  }
  return resultat;
}

export function validerRolesCanon(reponse: string, roles: RoleCanon[], nomsConnus: string[]): RapportValidation {
  const usurpes = trouverRolesUsurpes(reponse, roles, nomsConnus);
  if (!usurpes.length) return rapportOk();
  return {
    ok: false,
    checks: usurpes.map(({ role, intrus }) => ({
      nom: 'canon' as const,
      ok: false,
      gravite: 'grave' as const,
      raison: `Rôle fixé par le lore : ${role.libelle} à ${role.ville} = ${role.nom} (${role.description.slice(0, 140)}). La réponse donne ce rôle à « ${intrus} », personnage inventé : utilise ${role.nom}.`,
    })),
  };
}

function distance(a: string, b: string): number {
  const ligne = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let precedent = ligne[0];
    ligne[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = ligne[j];
      ligne[j] = Math.min(ligne[j] + 1, ligne[j - 1] + 1, precedent + (a[i - 1] === b[j - 1] ? 0 : 1));
      precedent = temp;
    }
  }
  return ligne[b.length];
}

/**
 * Étiquettes de répliques écorchées (« SÉRAPHINE DUVALLY : », « MARGAUX
 * FONTAUTE : ») ramenées au nom connu le plus proche : sinon l'avatar du
 * personnage ne s'affiche pas. Sans appel au modèle.
 */
export function corrigerEtiquettes(reponse: string, nomsConnus: string[]): string {
  const cibles = [...new Set(nomsConnus.filter((n) => n.trim().length >= 4).map((n) => n.trim().toLocaleUpperCase('fr')))];
  return reponse.replace(/^([ \t]*)([A-ZÀ-Ý][A-ZÀ-Ý' -]{2,40}?)([ \t]*:[ \t]*[«"“])/gm, (tout, debut: string, etiquette: string, fin: string) => {
    const nom = etiquette.trim();
    if (cibles.includes(nom)) return tout;
    let meilleure: string | undefined;
    let meilleurEcart = Infinity;
    for (const cible of cibles) {
      const ecart = distance(normaliser(nom), normaliser(cible));
      if (ecart < meilleurEcart) {
        meilleurEcart = ecart;
        meilleure = cible;
      }
    }
    return meilleure && meilleurEcart > 0 && meilleurEcart <= Math.min(3, Math.floor(nom.length / 4)) ? `${debut}${meilleure}${fin}` : tout;
  });
}

const PRONOMS_APRES_TU = new Set(['te', 'la', 'le', 'les', 'lui', 'leur', 'en', 'y', 'ne', 'me', 'se']);

/**
 * Écho du joueur : la réponse s'ouvre en reformulant ce que le joueur vient
 * d'écrire (« Je prends une gorgée » → « Tu prends une gorgée… »). Tic
 * fréquent des modèles de RP, qui allonge la réponse sans rien apporter.
 * Repéré quand la première phrase commence par « Tu » suivi d'un verbe que le
 * message du joueur contient déjà.
 */
export function trouverEchoDuJoueur(reponse: string, messageJoueur: string): string | undefined {
  if (!messageJoueur.trim()) return undefined;
  const premiere = normaliser(reponse.trim().split(/(?<=[.!?])\s|\n/)[0] ?? '').replace(/’/g, "'");
  const mots = premiere.replace(/^tu\s+/, (m) => m).split(/[\s']+/).filter(Boolean);
  if (mots[0] !== 'tu' && mots[0] !== 't') return undefined;
  const verbe = mots.slice(1).find((m) => !PRONOMS_APRES_TU.has(m) && m.length > 2);
  if (!verbe) return undefined;
  const racine = verbe.slice(0, Math.min(5, Math.max(4, verbe.length - 2)));
  return normaliser(messageJoueur).includes(racine) ? verbe : undefined;
}
