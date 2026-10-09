import type { ProfilContenu, StoryState } from '../types';

/**
 * V2.1 : M01–M15 sont des responsabilités de métier, pas des entrées de
 * lorebook. Ce module décide localement quelles responsabilités doivent
 * peser sur le tour et produit un contrat narratif compact. Il ne dépend
 * d'aucun fournisseur, embedding ou modèle.
 */

export type IdMoteurNarratif =
  | 'M01' | 'M02' | 'M03' | 'M04' | 'M05'
  | 'M06' | 'M07' | 'M08' | 'M09' | 'M10'
  | 'M11' | 'M12' | 'M13' | 'M14' | 'M15';

export interface ContributionNarrative {
  id: IdMoteurNarratif;
  nom: string;
  actif: boolean;
  raison: string;
  directive: string;
}

export interface ContratNarratifNatif {
  texte: string;
  contributions: ContributionNarrative[];
}

export const RESPONSABILITES_NARRATIVES: ReadonlyArray<{ id: IdMoteurNarratif; nom: string }> = [
  { id: 'M01', nom: 'Production de la réponse' },
  { id: 'M02', nom: 'Continuité' },
  { id: 'M03', nom: 'Esprit des personnages' },
  { id: 'M04', nom: 'Dynamiques sociales' },
  { id: 'M05', nom: 'Engagements et institutions' },
  { id: 'M06', nom: 'Lois du monde en scène' },
  { id: 'M07', nom: 'Agentivité du joueur' },
  { id: 'M08', nom: 'Registre et style narratif' },
  { id: 'M09', nom: 'Archétypes universels' },
  { id: 'M10', nom: 'Profils sociaux universels' },
  { id: 'M11', nom: 'Rythme narratif long terme' },
  { id: 'M12', nom: 'Dynamique de groupe' },
  { id: 'M13', nom: 'Consentement / limites / signaux' },
  { id: 'M14', nom: 'Résolution des actions' },
  { id: 'M15', nom: "Circulation de l'information" },
] as const;

function norm(v: unknown): string {
  return String(v ?? '')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contient(texte: string, re: RegExp): boolean {
  return re.test(norm(texte));
}

function nomsPnjConnus(story: StoryState): string[] {
  const noms = new Set<string>();
  for (const n of story.narrativeCore?.bdi ?? []) if (n?.name) noms.add(String(n.name));
  for (const r of story.social?.relations ?? []) if (r?.nom) noms.add(String(r.nom));
  for (const l of story.loreEmergent ?? []) if (l?.categorie === 'pnj' && l?.titre) noms.add(String(l.titre));
  return [...noms];
}

function pnjPertinents(story: StoryState, messageJoueur: string): string[] {
  const texte = norm([
    ...story.messages.slice(-2).map((m) => m.content),
    messageJoueur,
  ].join('\n'));
  const cites = nomsPnjConnus(story).filter((nom) => texte.includes(norm(nom)));
  const dernier = story.narrativeCore?.ledger?.at(-1);
  for (const nom of [
    ...(Array.isArray(dernier?.actors) ? dernier.actors : []),
    ...(Array.isArray(dernier?.targets) ? dernier.targets : []),
    ...(Array.isArray(dernier?.witnesses) ? dernier.witnesses : []),
  ]) {
    const n = String(nom ?? '').trim();
    if (n && norm(n) !== norm(story.meta.personnageNom) && !cites.some((x) => norm(x) === norm(n))) cites.push(n);
  }
  return cites.slice(0, 8);
}

function profilRendu(story: StoryState, profil: ProfilContenu | undefined): string {
  const s = story.settings;
  return [
    `profil=${profil === 'adulte' ? 'Adulte' : 'Grand public'}`,
    `ton=${s.ton}`,
    `violence=${s.violence}`,
    `romance=${s.romance}`,
    `humour=${s.humour}`,
    `longueur=${s.longueur}`,
    `rythme=${s.rythme}`,
    `créativité=${s.creativite}`,
    `liberté joueur=${s.liberteJoueur}`,
  ].join(' · ');
}

function contribution(
  id: IdMoteurNarratif,
  nom: string,
  actif: boolean,
  raison: string,
  directive: string,
): ContributionNarrative {
  return { id, nom, actif, raison, directive };
}

/**
 * Construit le contrat de métier du tour. Les règles stables critiques sont
 * déjà portées par rules.ts ; ici on ajoute les responsabilités pertinentes
 * et les frontières qui seraient faciles à perdre dans une scène donnée.
 */
export function construireContratNarratifNatif(
  story: StoryState,
  messageJoueur: string,
  profil: ProfilContenu | undefined,
): ContratNarratifNatif {
  const core = story.narrativeCore;
  const texte = norm(messageJoueur);
  const pnjs = pnjPertinents(story, messageJoueur);
  const engagements = (core?.debts ?? []).filter((d: any) => d?.status === 'open');
  const reputations = core?.reputation ?? [];
  const fils = core?.storylets ?? [];
  const aOpposition = contient(texte, /\b(attaque|frappe|tire|vise|force|convainc|persuade|vole|crochete|escalade|fuis|fuite|combat|tente|essaie|essaye)\b/);
  const physique = aOpposition || contient(texte, /\b(marche|cours|court|grimpe|porte|ouvre|ferme|saute|bless|arme|distance|route|voyage)\b/);
  const social = engagements.length > 0 || reputations.length > 0 || contient(texte, /\b(promesse|contrat|dette|paie|paiement|guilde|garde|ordre|faction|rang|titre|reputation|recompense)\b/);
  const information = pnjs.length > 0 || contient(texte, /\b(secret|rumeur|lettre|rapport|sait|savoir|apprend|dit|raconte|temoin|message|document|indice)\b/);
  const groupe = pnjs.length >= 2;
  const limiteExplicite = contient(texte, /\b(stop|pause|arrete|arret|hors rp|ooc|moins violent|moins intense|ralentis|change de sujet)\b/);
  const dialogueOuPnj = pnjs.length > 0 || /[«"].+[»"]/.test(messageJoueur);
  const institution = contient(texte, /\b(guilde|garde|armee|ordre|tribunal|clan|faction|institution|loi|rang|noble|marchand|clerc|capitaine)\b/);
  const personnagePeuDefini = pnjs.some((nom) => !(core?.bdi ?? []).some((b: any) => norm(b?.name) === norm(nom)));

  const c: ContributionNarrative[] = [
    contribution('M01', 'Production de la réponse', true, 'coordination de chaque tour', 'Traite l’initiative actuelle, montre seulement les conséquences pertinentes et laisse la prochaine décision significative au joueur.'),
    contribution('M02', 'Continuité', true, 'continuité obligatoire', 'Pars du dernier état fiable. Une absence de rappel n’est pas un changement ; une évolution exige une cause et un rappel ne réapplique pas une conséquence.'),
    contribution('M03', 'Esprit des personnages', dialogueOuPnj, dialogueOuPnj ? `${pnjs.length || 1} PNJ pertinent(s)` : 'aucun PNJ directement mobilisé', 'Fais agir chaque PNJ selon identité, buts, valeurs, capacités, état et savoirs propres ; un désaccord n’efface pas un lien établi.'),
    contribution('M04', 'Dynamiques sociales', social || dialogueOuPnj, social ? 'état social/engagement pertinent' : 'interaction avec PNJ', 'Distingue relation privée, émotion immédiate et réputation collective. Ne change que les dimensions justifiées par une expérience ou information réellement accessible.'),
    contribution('M05', 'Engagements et institutions', social, social ? `${engagements.length} engagement(s) ouvert(s) ou enjeu institutionnel` : 'aucun enjeu contractuel détecté', 'Sépare proposition, acceptation, accomplissement, connaissance de l’accomplissement et reconnaissance. Une institution agit selon mandat, preuves, savoir et moyens réels.'),
    contribution('M06', 'Lois du monde en scène', physique, physique ? 'action ou contrainte matérielle détectée' : 'pas de contrainte physique centrale', 'Respecte positions, temps, équipement, blessures et lois du monde. N’invente ni capacité décisive ni sauvetage impossible.'),
    contribution('M07', 'Agentivité du joueur', true, 'toujours prioritaire', 'Interprète ce que le joueur a décidé ou tenté sans lui ajouter parole, pensée, émotion intime, engagement ou action volontaire suivante. Une intention ne garantit pas sa réussite.'),
    contribution('M08', 'Registre et style narratif', true, profilRendu(story, profil), 'Applique le profil configuré seulement aux dimensions réellement présentes. Un niveau élevé/maximal reste disponible s’il est pertinent ; une scène calme ne doit pas être intensifiée artificiellement.'),
    contribution('M09', 'Archétypes universels', personnagePeuDefini, personnagePeuDefini ? 'au moins un PNJ peu caractérisé' : 'personnages déjà caractérisés ou aucun PNJ', 'Utilise un archétype seulement comme hypothèse pour un champ manquant ; jamais comme personnalité, moralité ou compétence prouvée.'),
    contribution('M10', 'Profils sociaux universels', institution, institution ? 'statut/institution mentionné' : 'pas d’enjeu de statut central', 'Le statut définit droits, accès, dépendances et risques ; il n’invente ni ressources matérielles, ni compétence, ni personnalité.'),
    contribution('M11', 'Rythme narratif long terme', fils.length > 0 || !!story.directeur?.arcActuel, fils.length ? `${fils.length} fil(s)/opportunité(s) suivi(s)` : 'direction de campagne disponible', 'Le calme, la dormance et l’abandon d’un fil sont légitimes. Ne crée pas une attaque, crise ou climax pour combattre artificiellement la stagnation.'),
    contribution('M12', 'Dynamique de groupe', groupe, groupe ? `${pnjs.length} PNJ pertinents` : 'pas de groupe actif identifié', 'Coordonne seulement les membres concernés. Un membre silencieux reste présent sans devoir parler ; un secret entendu par un seul ne devient pas savoir collectif.'),
    contribution('M13', 'Consentement / limites / signaux', true, limiteExplicite ? 'signal réel explicite détecté : priorité immédiate' : 'périmètre et limites toujours applicables', 'Distingue limites réelles et volontés fictives. Un arrêt/réduction réel prime immédiatement ; sinon reste dans le périmètre déjà choisi sans reconfirmation répétitive. La mort définitive du joueur n’est jamais déduite du niveau de violence.'),
    contribution('M14', 'Résolution des actions', aOpposition || physique, aOpposition ? 'tentative contestable détectée' : physique ? 'action matérielle à résoudre' : 'pas de tentative centrale', 'Une action banale possible réussit normalement. Pour une tentative contestée, compare moyens, compétence, préparation, contexte et opposition ; n’ajoute ni échec ni coût pour le spectacle.'),
    contribution('M15', "Circulation de l'information", information, information ? 'personnages ou informations situées concernés' : 'aucune circulation centrale détectée', 'Sépare vérité, observation, rapport, croyance, rumeur et hypothèse. Toute connaissance doit avoir une perception, une source ou une transmission plausible ; aucune déformation n’est obligatoire.'),
  ];

  const actifs = c.filter((x) => x.actif);
  const lignes = [
    '[CONTRAT NARRATIF NATIF V2.1 — RESPONSABILITÉS ACTIVES]',
    'Le noyau applicatif reste la source de vérité. Le modèle met en scène le cadre fourni et propose des effets ; il ne canonise rien lui-même.',
    `Responsabilités mobilisées : ${actifs.map((x) => x.id).join(', ')}.`,
    ...actifs.map((x) => `${x.id} ${x.nom} — ${x.directive}`),
  ];

  return { texte: lignes.join('\n'), contributions: c };
}

export function debugContratNarratif(contrat: ContratNarratifNatif): string[] {
  return contrat.contributions
    .filter((c) => c.actif)
    .map((c) => `${c.id} ${c.nom} — ${c.raison}`);
}
