/**
 * Un tour du narrateur Prax (test) : Prax remplace le modèle IA dans la
 * conversation, sans aucun appel réseau.
 *
 * 1. Relire l'état Prax de la partie (ou le construire depuis la scène).
 * 2. Comprendre le message du joueur et jouer son action.
 * 3. Faire décider chaque PNJ présent avec le planificateur de Prax ; un PNJ
 *    dont la meilleure option ne vaut pas mieux qu'attendre ne fait rien.
 * 4. Produire le compte rendu structuré et le rendu brut en français.
 * 5. Sauvegarder l'état Prax et reporter les relations et la scène dans la
 *    partie, pour que le reste de l'application reste cohérent.
 */
import type { State } from '../../prax/core/engine';
import type { GroundedAction } from '../../prax/core/perform';
import { deserializeState, serializeState } from '../../prax/core/persist';
import type { DiagnosticTour, Message, RelationPersonnage, StoryState } from '../../types';
import { comprendre, presentsDuJoueur } from './comprehension';
import { ajouterLieu, construireDescription, destinationDuMessage } from './description';
import { AXES, Axe, ValeursRelation, construireMonde, faitsDeMiseANiveau, faitsInitiaux, graineDe, lieuDe, lireRelation } from './monde';
import { effacerSaisie, infoActe } from './bibliotheque';
import { lignesCoulisses, nomCourt, rendreIncompris, rendreOuverture, rendreTour } from './rendu';
import { sujetPrax } from './sujets';
import {
  ChangementRelation,
  CompteRenduTour,
  CoulisseActeur,
  DescriptionScene,
  EtatPraxHistoire,
  EvenementTour,
  GenreAction,
  ID_JOUEUR,
  LIEU_AILLEURS,
} from './types';

/** Profondeur d'anticipation du planificateur (celle des mondes de démonstration de Prax). */
export const PROFONDEUR_PAR_DEFAUT = 2;
const ATTENDRE = '[Actor] (attend)';

const GENRE_PAR_GABARIT: Record<string, GenreAction> = {
  '[Actor] salue [Cible]': 'saluer',
  '[Actor] rend son salut à [Cible]': 'rendreSalut',
  '[Actor] accueille [Cible]': 'accueillir',
  '[Actor] engage la conversation avec [Cible]': 'converser',
  '[Actor] répond aimablement à [Cible]': 'repondreAimable',
  '[Actor] rabroue [Cible]': 'rabrouer',
  '[Actor] interroge [Cible] sur [Sujet]': 'interroger',
  '[Actor] répond à [Cible] au sujet de [Sujet]': 'repondre',
  '[Actor] élude la question de [Cible] sur [Sujet]': 'eluder',
  '[Actor] avoue tout ignorer de [Sujet] devant [Cible]': 'ignorerSujet',
  '[Actor] complimente [Cible]': 'complimenter',
  '[Actor] remercie [Cible]': 'remercier',
  '[Actor] ignore [Cible]': 'ignorer',
  '[Actor] menace [Cible]': 'menacer',
  '[Actor] cède devant [Cible]': 'ceder',
  '[Actor] tient tête à [Cible]': 'tenirTete',
  '[Actor] insulte [Cible]': 'insulter',
  '[Actor] rend l’insulte à [Cible]': 'rendreInsulte',
  '[Actor] attaque [Cible]': 'attaquer',
  '[Actor] riposte contre [Cible]': 'riposter',
  '[Actor] implore [Cible] d’arrêter': 'implorer',
  '[Actor] s’enfuit': 'fuir',
  '[Actor] s’interpose entre [Agresseur] et [Victime]': 's_interposer',
  '[Actor] vole [Cible]': 'voler',
  '[Actor] accuse [Voleur] de vol': 'accuser',
  '[Actor] se méfie de [X]': 'se_mefier',
  '[Actor] propose son aide à [Cible]': 'aider',
  '[Actor] rend service à [Cible]': 'rendreService',
  '[Actor] offre de l’argent à [Cible]': 'payer',
  '[Actor] présente ses excuses à [Cible]': 's_excuser',
  '[Actor] accepte les excuses de [Cible]': 'pardonner',
  '[Actor] assure [Cible] qu’il n’y a rien à pardonner': 'rassurer',
  '[Actor] refuse les excuses de [Cible]': 'refuserExcuses',
  '[Actor] raconte à [Hearer] que [Voleur] a volé [Victime]': 'raconter',
  '[Actor] raconte à [Hearer] que [Agresseur] a attaqué [Victime]': 'raconter',
  '[Actor] raconte à [Hearer] que [Auteur] a menacé [Victime]': 'raconter',
  '[Actor] relance [Cible]': 'relancer',
  '[Actor] presse [Cible] d’en venir au fait': 'presser',
  '[Actor] perd patience avec [Cible]': 'perdrePatience',
  '[Actor] adresse une demande à [Cible]': 'demander',
  '[Actor] propose de satisfaire la demande de [Cible]': 'proposer',
  '[Actor] refuse la demande de [Cible]': 'refuserDemande',
  '[Actor] renvoie [Cible] vers un marchand': 'renvoyer',
  '[Actor] marchande avec [Cible]': 'marchander',
  '[Actor] consent un rabais à [Cible]': 'consentirRabais',
  '[Actor] maintient son prix devant [Cible]': 'maintenirPrix',
  '[Actor] paie [Cible] le prix convenu': 'payerPrix',
  '[Actor] conclut le marché avec [Cible]': 'conclure',
  '[Actor] se rend à [Lieu]': 'se_rendre',
  [ATTENDRE]: 'attendre',
};

export interface OptionsTourPrax {
  profondeur?: number;
  /** Change seulement la formulation (régénération). */
  variante?: number;
  maintenant?: () => number;
}

interface Contexte {
  st: State;
  desc: DescriptionScene;
  lieuJoueur: string;
}

function nomDe(desc: DescriptionScene, id: string): string {
  if (id === ID_JOUEUR) return desc.joueurNom;
  const p = desc.pnj.find((x) => x.id === id);
  return p ? nomCourt(p.nom) : id;
}

function lieuNom(desc: DescriptionScene, id: string): string {
  return desc.lieux.find((l) => l.id === id)?.nom ?? id;
}

function lier(ga: GroundedAction, k: string): string | undefined {
  const v = ga.bindings.get(k);
  return typeof v === 'string' ? v : v === undefined ? undefined : String(v);
}

function temoinsDe(st: State, acteur: string, desc: DescriptionScene): string[] {
  const ici = lieuDe(st, acteur);
  if (ici === undefined || ici === LIEU_AILLEURS) return [];
  return [ID_JOUEUR, ...desc.pnj.map((p) => p.id)].filter((id) => id !== acteur && lieuDe(st, id) === ici);
}

/** L'événement d'une action qui VIENT d'être jouée (l'état est lu après coup pour les actes de la bibliothèque). */
function evenementDe(ga: GroundedAction, desc: DescriptionScene, temoins: string[], st: State): EvenementTour {
  const acte = GENRE_PAR_GABARIT[ga.actionId] ? undefined : infoActe(ga, st);
  const genre = GENRE_PAR_GABARIT[ga.actionId] ?? (acte ? 'acte' : 'attendre');
  const acteur = lier(ga, 'Actor') ?? '';
  const pnj = desc.pnj.find((p) => p.id === acteur);
  const cible = lier(ga, 'Cible') ?? lier(ga, 'Hearer') ?? lier(ga, 'Voleur') ?? lier(ga, 'Agresseur') ?? lier(ga, 'X');
  const sujet = lier(ga, 'Sujet');
  const lieu = lier(ga, 'Lieu');
  const e: EvenementTour = {
    acteur,
    acteurNom: nomDe(desc, acteur),
    roleActeur: pnj?.role,
    genre,
    libelle: rendreLibelle(ga, desc),
    temoins,
  };
  if (acte) e.acte = acte;
  if (cible !== undefined) {
    e.cible = cible;
    e.cibleNom = nomDe(desc, cible);
  }
  if (sujet !== undefined) {
    e.sujet = sujet;
    e.sujetNom = sujetPrax(sujet)?.nom ?? sujet;
  }
  if (lieu !== undefined) {
    e.lieu = lieu;
    e.lieuNom = lieuNom(desc, lieu);
  }
  if (genre === 's_interposer') e.victimeNom = nomDe(desc, lier(ga, 'Victime') ?? '');
  if (genre === 'raconter') {
    const auteur = lier(ga, 'Voleur') ?? lier(ga, 'Agresseur') ?? lier(ga, 'Auteur') ?? '';
    const acte: GenreAction = ga.actionId.includes('volé') ? 'voler' : ga.actionId.includes('attaqué') ? 'attaquer' : 'menacer';
    e.cible = lier(ga, 'Hearer');
    e.cibleNom = e.cible ? nomDe(desc, e.cible) : undefined;
    e.rapporte = { genre: acte, auteurNom: auteur === ID_JOUEUR ? desc.joueurNom : nomDe(desc, auteur), victimeNom: nomDe(desc, lier(ga, 'Victime') ?? '') };
  }
  return e;
}

/** Libellé Prax avec les noms affichés à la place des identifiants (diagnostic concepteur). */
function rendreLibelle(ga: GroundedAction, desc: DescriptionScene): string {
  const brut = ga.actionId.replace(/\[([A-Za-z]+)\]/g, (_m, v: string) => {
    const val = lier(ga, v);
    if (val === undefined) return v;
    if (v === 'Sujet') return sujetPrax(val)?.nom ?? val;
    if (v === 'Lieu') return lieuNom(desc, val);
    return nomDe(desc, val);
  });
  // Contractions du français : « de le » → « du », « à le » → « au »…
  return brut.replace(/\bde le /g, 'du ').replace(/\bde les /g, 'des ').replace(/\bà le /g, 'au ').replace(/\bà les /g, 'aux ');
}

function relationsJoueurDepuis(story: StoryState, desc: DescriptionScene): Map<string, ValeursRelation> {
  const out = new Map<string, ValeursRelation>();
  for (const p of desc.pnj) {
    const r = story.social.relations.find((x) => x.nom.trim().toLowerCase() === p.nom.trim().toLowerCase() || x.id === p.id);
    if (r) out.set(p.id, { confiance: r.confiance, respect: r.respect, peur: r.peur, affection: r.affection, hostilite: r.hostilite });
  }
  return out;
}

function lireToutesRelations(st: State, desc: DescriptionScene): Map<string, Record<Axe, number>> {
  const out = new Map<string, Record<Axe, number>>();
  for (const p of desc.pnj) {
    const r = {} as Record<Axe, number>;
    for (const a of AXES) r[a] = lireRelation(st, p.id, a);
    out.set(p.id, r);
  }
  return out;
}

/** Monde + faits pour la partie, à partir de l'état Prax sauvegardé s'il existe. */
function preparer(story: StoryState, message: string | null): Contexte & { lieuDestination?: string; ancien?: EtatPraxHistoire } {
  const ancien = story.prax?.version === 1 ? story.prax : undefined;
  let { desc, lieuJoueur } = construireDescription(story, ancien?.description, ancien?.lieuJoueur);
  let lieuDestination: string | undefined;
  const destination = message ? destinationDuMessage(message) : undefined;
  if (destination) {
    const r = ajouterLieu(desc, destination, destination.libelle);
    desc = r.desc;
    lieuDestination = r.lieuId;
  }
  const monde = construireMonde(desc, graineDe(story.meta.id));
  const relations = relationsJoueurDepuis(story, desc);
  let st: State;
  if (ancien) {
    st = deserializeState(ancien.etat, monde);
    const anciensPnj = new Set(ancien.description.pnj.map((p) => p.id));
    const anciensLieux = new Set(ancien.description.lieux.map((l) => l.id));
    const nouveauxPnj = new Set(desc.pnj.map((p) => p.id).filter((id) => !anciensPnj.has(id)));
    const nouveauxLieux = new Set(desc.lieux.map((l) => l.id).filter((id) => !anciensLieux.has(id)));
    for (const o of faitsInitiaux(desc, null, nouveauxPnj, nouveauxLieux, relations)) st.performOutcome(o);
    for (const o of faitsDeMiseANiveau(st, desc)) st.performOutcome(o);
  } else {
    st = monde;
    // Prax reprend une partie jouée par le narrateur IA : les présents ont déjà rencontré le joueur.
    const dejaRencontres = new Set(story.messages.some((m) => m.role === 'user') ? desc.pnj.filter((p) => p.lieu === lieuJoueur).map((p) => p.id) : []);
    for (const o of faitsInitiaux(desc, lieuJoueur, new Set(desc.pnj.map((p) => p.id)), new Set(desc.lieux.map((l) => l.id)), relations, dejaRencontres)) st.performOutcome(o);
  }
  return { st, desc, lieuJoueur, lieuDestination, ancien };
}

/** Fait décider les PNJ présents auprès du joueur, un par un. */
function phasePnj(ctx: Contexte, profondeur: number, evenements: EvenementTour[], coulisses: CoulisseActeur[]): void {
  const { st, desc } = ctx;
  const presents = presentsDuJoueur(st, desc);
  // Ceux qui doivent une réaction au joueur parlent d'abord.
  const ordre = [...presents].sort((a, b) => Number(st.dbHas(`attente.${b.id}.${ID_JOUEUR}`)) - Number(st.dbHas(`attente.${a.id}.${ID_JOUEUR}`)));
  // Foule nombreuse : anticipation courte, pour garder un tour rapide sur téléphone.
  const profondeurEffective = presents.length > 4 ? Math.min(profondeur, 1) : profondeur;
  for (const p of ordre) {
    if (lieuDe(st, p.id) !== lieuDe(st, ID_JOUEUR)) continue;
    const perso = st.characters.find((c) => c.name === p.id);
    if (!perso) continue;
    const rows = st.scoreActions(profondeurEffective, perso);
    const attente = rows.find(([ga]) => ga.actionId === ATTENDRE);
    const meilleure = rows[0];
    const agit = meilleure !== undefined && meilleure[0].actionId !== ATTENDRE && (attente === undefined || meilleure[1] > attente[1] + 1e-9);
    coulisses.push({
      acteur: nomDe(desc, p.id),
      options: rows.slice(0, 4).map(([ga, note]) => ({ libelle: rendreLibelle(ga, desc), note })),
      choix: agit ? rendreLibelle(meilleure[0], desc) : 'attend',
    });
    if (!agit) continue;
    const temoins = temoinsDe(st, p.id, desc);
    st.performAction(meilleure[0]);
    evenements.push(evenementDe(meilleure[0], desc, temoins, st));
  }
}

function reporterRelations(story: StoryState, desc: DescriptionScene, apres: Map<string, Record<Axe, number>>, impliques: Set<string>): RelationPersonnage[] {
  const relations = [...story.social.relations];
  const borne = (v: number) => Math.max(-3, Math.min(3, Math.round(v / 10)));
  for (const p of desc.pnj) {
    const r = apres.get(p.id);
    if (!r) continue;
    const i = relations.findIndex((x) => x.nom.trim().toLowerCase() === p.nom.trim().toLowerCase());
    if (i < 0 && !impliques.has(p.id)) continue;
    const base: RelationPersonnage = i >= 0 ? relations[i] : { id: `prax-${p.id}`, nom: p.nom, faction: p.faction, confiance: 0, respect: 0, peur: 0, affection: 0, hostilite: 0 };
    const maj: RelationPersonnage = { ...base, confiance: borne(r.confiance), respect: borne(r.respect), peur: borne(r.peur), affection: borne(r.affection), hostilite: borne(r.hostilite) };
    if (i >= 0) relations[i] = maj;
    else relations.push(maj);
  }
  return relations;
}

function idMessage(maintenant: number): string {
  return `msg-${maintenant}-${Math.random().toString(36).slice(2, 8)}`;
}

function diagnostic(cr: CompteRenduTour, debut: number, fin: number): DiagnosticTour {
  return {
    id: `prax-${debut}`,
    startedAt: debut,
    dureeTotaleMs: fin - debut,
    etapes: [{ nom: 'Narrateur Prax (test, sans IA)', categorie: 'prax', statut: 'ok', dureeMs: fin - debut, details: lignesCoulisses(cr) }],
    appelsIA: [],
    embeddings: [],
  };
}

/** Description à sauvegarder : lieux des PNJ mis à jour depuis l'état du moteur. */
function descriptionAJour(st: State, desc: DescriptionScene): DescriptionScene {
  return { ...desc, pnj: desc.pnj.map((p) => ({ ...p, lieu: lieuDe(st, p.id) ?? p.lieu })) };
}

export interface ResultatTourPrax {
  story: StoryState;
  compteRendu: CompteRenduTour;
}

/** Joue un tour complet : le message du joueur et la réponse du narrateur Prax. */
export function jouerTourPrax(story: StoryState, messageJoueur: string, opts: OptionsTourPrax = {}): ResultatTourPrax {
  const maintenant = opts.maintenant ?? Date.now;
  const debut = maintenant();
  const profondeur = opts.profondeur ?? PROFONDEUR_PAR_DEFAUT;
  const variante = opts.variante ?? 0;
  const ctx = preparer(story, messageJoueur);
  const { st, ancien } = ctx;
  const desc = ctx.desc;
  const tour = (ancien?.tours ?? 0) + 1;
  const avant = lireToutesRelations(st, desc);

  const compris = comprendre(messageJoueur, st, desc, ctx.lieuJoueur, { lieuDestination: ctx.lieuDestination, dernierInterlocuteur: ancien?.dernierInterlocuteur });
  const evenements: EvenementTour[] = [];
  const coulisses: CoulisseActeur[] = [];
  let texte: string;
  let volRemarque: boolean | undefined;
  let lieuJoueur = ctx.lieuJoueur;

  if (compris.action) {
    const temoins = temoinsDe(st, ID_JOUEUR, desc);
    st.performAction(compris.action);
    // Ce que le joueur avait annoncé (montant, objet) ne sert qu'à son action.
    effacerSaisie(st);
    const evenement = evenementDe(compris.action, desc, temoins, st);
    if (evenement.acte && compris.acte?.objet) evenement.acte.objetAffiche = compris.acte.objet.affiche;
    if (compris.precision) evenement.precision = compris.precision;
    if (compris.affichage) evenement.genre = compris.affichage;
    evenements.push(evenement);
    if (compris.genre === 'voler' && compris.cible) volRemarque = st.dbHas(`${compris.cible}.believes.vole.${ID_JOUEUR}.${compris.cible}.seen`);
    lieuJoueur = lieuDe(st, ID_JOUEUR) ?? lieuJoueur;
    phasePnj({ st, desc, lieuJoueur }, profondeur, evenements, coulisses);
    st.roundBoundary();
    texte = rendreTour({ evenements, presentsApres: presentsDuJoueur(st, desc), volRemarque, variante, tour, message: messageJoueur });
  } else {
    effacerSaisie(st);
    texte = rendreIncompris(compris.motif ?? 'Je n’ai pas compris.', presentsDuJoueur(st, desc));
  }

  const apres = lireToutesRelations(st, desc);
  const changements: ChangementRelation[] = [];
  for (const p of desc.pnj) {
    for (const axe of AXES) {
      const a = avant.get(p.id)?.[axe] ?? 0;
      const b = apres.get(p.id)?.[axe] ?? 0;
      if (a !== b) changements.push({ pnj: nomCourt(p.nom), axe, avant: a, apres: b });
    }
  }
  const presents = presentsDuJoueur(st, desc);
  const compteRendu: CompteRenduTour = {
    version: 1,
    tour,
    ville: desc.ville,
    lieu: lieuNom(desc, lieuJoueur),
    presents: presents.map((p) => p.nom),
    joueur: { message: messageJoueur, compris: compris.action !== null, action: compris.action ? rendreLibelle(compris.action, desc) : undefined, motif: compris.motif },
    evenements,
    relations: changements,
    coulisses,
  };

  const fin = maintenant();
  const idUser = idMessage(debut);
  const idAssistant = idMessage(fin + 1);
  const messageUser: Message = { id: idUser, role: 'user', content: messageJoueur, timestamp: debut };
  const messageAssistant: Message = {
    id: idAssistant,
    role: 'assistant',
    content: texte,
    timestamp: fin,
    dureeGenerationMs: fin - debut,
    praxCompteRendu: compteRendu,
    diagnosticTour: diagnostic(compteRendu, debut, fin),
  };
  const impliques = new Set(evenements.flatMap((e) => [e.acteur, e.cible ?? '']).filter((id) => id && id !== ID_JOUEUR));
  const dernierInterlocuteur = [...evenements].reverse().find((e) => e.acteur !== ID_JOUEUR && e.cible === ID_JOUEUR)?.acteur ?? compris.cible ?? ancien?.dernierInterlocuteur;
  const descSauvee = descriptionAJour(st, desc);
  const prax: EtatPraxHistoire = {
    version: 1,
    description: descSauvee,
    etat: serializeState(st),
    lieuJoueur,
    dernierInterlocuteur,
    apresMessageId: idAssistant,
    precedent: ancien ? { description: ancien.description, etat: ancien.etat, lieuJoueur: ancien.lieuJoueur, dernierInterlocuteur: ancien.dernierInterlocuteur, apresMessageId: ancien.apresMessageId, tours: ancien.tours } : undefined,
    tours: compris.action ? tour : ancien?.tours ?? 0,
  };
  const messages = [...story.messages, messageUser, messageAssistant];
  const storyMaj: StoryState = {
    ...story,
    messages,
    prax,
    social: { ...story.social, relations: reporterRelations(story, desc, apres, impliques) },
    scene: { ville: desc.ville, lieu: lieuNom(desc, lieuJoueur), presents: presents.map((p) => p.nom), majMessageIndex: messages.length },
    meta: { ...story.meta, updatedAt: fin },
  };
  return { story: storyMaj, compteRendu };
}

/** Régénère le dernier tour Prax : mêmes décisions (Prax est déterministe), autre formulation. */
export function regenererTourPrax(story: StoryState, opts: OptionsTourPrax = {}): ResultatTourPrax {
  const messages = story.messages;
  const dernier = messages[messages.length - 1];
  const avantDernier = messages[messages.length - 2];
  if (!dernier || dernier.role !== 'assistant' || !avantDernier || avantDernier.role !== 'user') throw new Error('Aucune réponse à régénérer.');
  const prax = story.prax;
  let etatAvant: EtatPraxHistoire | undefined;
  if (prax && prax.apresMessageId === dernier.id) etatAvant = prax.precedent ? { version: 1, ...prax.precedent } : undefined;
  else if (prax) throw new Error('Cette réponse ne vient pas du dernier tour Prax : impossible de la régénérer.');
  const variante = (dernier.praxCompteRendu ? hacherVariante(dernier.id) : 0) + 1;
  const base: StoryState = { ...story, messages: messages.slice(0, -2), prax: etatAvant };
  return jouerTourPrax(base, avantDernier.content, { ...opts, variante: opts.variante ?? variante });
}

function hacherVariante(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 97;
}

/** Scène d'ouverture jouée par Prax : le lieu, les présents, et leur première réaction. */
export function ouvrirAvecPrax(story: StoryState, opts: OptionsTourPrax = {}): StoryState {
  const maintenant = opts.maintenant ?? Date.now;
  const debut = maintenant();
  const ctx = preparer({ ...story, prax: undefined }, null);
  const evenements: EvenementTour[] = [];
  const coulisses: CoulisseActeur[] = [];
  phasePnj(ctx, opts.profondeur ?? PROFONDEUR_PAR_DEFAUT, evenements, coulisses);
  ctx.st.roundBoundary();
  const presents = presentsDuJoueur(ctx.st, ctx.desc);
  const suite = evenements.length ? rendreTour({ evenements, presentsApres: presents, variante: opts.variante ?? 0, tour: 0 }) : '';
  const texte = rendreOuverture(lieuNom(ctx.desc, ctx.lieuJoueur), ctx.desc.ville, presents, suite);
  const fin = maintenant();
  const compteRendu: CompteRenduTour = {
    version: 1,
    tour: 0,
    ville: ctx.desc.ville,
    lieu: lieuNom(ctx.desc, ctx.lieuJoueur),
    presents: presents.map((p) => p.nom),
    joueur: { message: '', compris: true, action: 'ouverture' },
    evenements,
    relations: [],
    coulisses,
  };
  const id = idMessage(fin);
  const message: Message = { id, role: 'assistant', content: texte, timestamp: fin, dureeGenerationMs: fin - debut, praxCompteRendu: compteRendu, diagnosticTour: diagnostic(compteRendu, debut, fin) };
  const dernierInterlocuteur = evenements.find((e) => e.cible === ID_JOUEUR)?.acteur;
  return {
    ...story,
    messages: [message],
    prax: { version: 1, description: descriptionAJour(ctx.st, ctx.desc), etat: serializeState(ctx.st), lieuJoueur: ctx.lieuJoueur, dernierInterlocuteur, apresMessageId: id, tours: 0 },
    scene: { ville: ctx.desc.ville, lieu: lieuNom(ctx.desc, ctx.lieuJoueur), presents: presents.map((p) => p.nom), majMessageIndex: 1 },
  };
}
