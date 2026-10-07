// Contrat d'ouverture (moteur d'ouverture v11.5 de la V13) : la première
// scène doit déjà être en mouvement et un personnage doit interpeller le
// joueur. Ces contrôles sont locaux ; en cas d'écart, une seconde passe
// réécrit la scène avec la liste des points à corriger.

export const INSTRUCTION_OUVERTURE = `Tu écris LA TOUTE PREMIÈRE SCÈNE de l'histoire, avant que {{user}} n'ait dit ou fait quoi que ce soit. Cette ouverture doit immédiatement donner l'impression que le monde existait avant l'arrivée du joueur et qu'une situation est déjà en cours.

CONTRAT D'OUVERTURE OBLIGATOIRE :
1. Ancre clairement le lieu choisi et fais sentir son ambiance par quelques détails concrets et sensoriels.
2. Mets en scène la situation de départ : quelque chose se passe déjà. Évite une introduction statique ou encyclopédique.
3. Choisis le PREMIER INTERLOCUTEUR le plus pertinent pour cette situation. Si le lore fournit un PNJ canonique naturellement présent, utilise-le. Sinon, crée uniquement un personnage local mineur cohérent (garde, marchand, voyageur, employé, habitant, etc.). N'invente jamais pour cela un nouveau royaume, souverain, grande guilde, religion ou institution majeure nommée.
4. OBLIGATOIRE, quelle que soit la scène : ce personnage remarque {{user}} et l'INTERPELLE directement dans cette première réponse avec au moins une vraie réplique de dialogue, au format NOM : « … », qui s'adresse à lui (tu ou vous). Cette réplique arrive tôt, au plus tard au deuxième paragraphe : pas de longue description avant. Il doit avoir une raison concrète de parler : demander, avertir, provoquer, vendre, contrôler, solliciter, signaler un danger, transmettre une information ou réagir à la situation.
5. Termine à un moment où {{user}} peut répondre ou agir naturellement. Ne parle jamais, ne pense jamais et n'agis jamais à sa place.
6. Respecte strictement le lore pertinent fourni dans le contexte. En cas de doute sur une autorité, un souverain, une faction, une loi ou une institution, reste générique plutôt que d'inventer un nom.
7. Intègre le lore dans la scène sans le réciter ni l'expliquer comme une fiche.
8. Évite les ouvertures génériques (« Bienvenue, aventurier ») et n'utilise pas « Que faites-vous ? » comme unique accroche.

Le texte final doit être uniquement la scène narrative, sans titre technique, sans liste et sans explication de ces règles.`;

function normaliser(texte: string): string {
  return (texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Écarts au contrat d'ouverture détectables sans modèle (dialogue, longueur, accroche). */
export function ecartsContratOuverture(texte: string, personnageNom: string): string[] {
  const ecarts: string[] = [];
  const repliques = texte.match(/[«“"][^»”"\n]{2,}[»”"]/g) ?? [];
  // Ponctuation retirée : la V13 manquait « Toi, là » à cause de la virgule,
  // et relançait alors une seconde passe complète pour rien.
  const dialogues = ` ${normaliser(repliques.join(' ')).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  if (!repliques.length) {
    ecarts.push("Aucun personnage n'interpelle réellement le joueur : l'ouverture doit contenir au moins une réplique de dialogue d'un PNJ présent dans la scène.");
  } else {
    const nom = normaliser(personnageNom);
    const interpelle = [' tu ', ' vous ', ' toi ', ' te ', ' ton ', ' ta ', ' tes ', ' votre ', ' vos ', " t'"].some((m) => dialogues.includes(m))
      || (!!nom && dialogues.includes(nom));
    if (!interpelle) {
      ecarts.push("La réplique existe mais ne semble pas s'adresser au joueur : le premier interlocuteur doit l'interpeller directement ou lui donner une raison immédiate de répondre.");
    }
  }
  if (texte.trim().length < 180) {
    ecarts.push("L'ouverture est trop courte pour installer à la fois le lieu, l'ambiance, la situation active et l'interaction initiale.");
  }
  if (/(^|[.!?]\s+)(bienvenue|salutations?)(\s+(aventurier|voyageur|étranger))?/i.test(texte)) {
    ecarts.push('Évite une salutation générique de type « Bienvenue, aventurier » : commence par une scène déjà en mouvement.');
  }
  if (!repliques.length && /(que faites-vous|qu'allez-vous faire|que vas-tu faire)\s*\??\s*$/i.test(texte.trim())) {
    ecarts.push("Ne termine pas par une simple question générique : crée d'abord une interaction concrète avec un personnage de la scène.");
  }
  return ecarts;
}

/** Écarts qui signifient qu'aucun personnage n'interpelle le joueur. */
export function ouvertureSansInterpellation(texte: string, personnageNom: string): boolean {
  return ecartsContratOuverture(texte, personnageNom).some((e) => /interpell/i.test(e));
}

/**
 * Dernier recours quand la scène réécrite n'a toujours personne qui parle
 * au joueur : le narrateur écrit seulement la suite où un personnage
 * l'interpelle, ajoutée à la fin de la scène.
 */
export function instructionInterpellation(scene: string): string {
  return `La scène d'ouverture ci-dessous ne contient encore aucun personnage qui interpelle {{user}}. Écris UNIQUEMENT la suite immédiate à ajouter à la fin : 2 à 4 phrases où un personnage présent dans ce lieu (un personnage officiel du lore s'il y est naturellement, sinon un personnage local mineur : marchand, garde, habitant, employé…) remarque {{user}} et lui adresse directement la parole, avec au moins une réplique au format NOM : « … » qui le tutoie ou le vouvoie et lui donne une raison de répondre. Ne répète pas la scène. N'écris ni les paroles, ni les gestes, ni les pensées de {{user}}.

[SCÈNE D'OUVERTURE]
${scene}`;
}

/** Requête de lore de l'ouverture : le lieu et les pouvoirs qui s'y exercent d'abord. */
export function requeteLoreOuverture(meta: { contexte?: { lieu?: string; ambiance?: string; objectifs?: string }; pointDeDepart?: string; personnageDescription?: string }): string {
  const contexte = meta.contexte ?? {};
  return [
    "[RECHERCHE D'OUVERTURE — PRIORITÉ CANON]",
    contexte.lieu && `Lieu exact : ${contexte.lieu}`,
    meta.pointDeDepart && `Situation de départ : ${meta.pointDeDepart}`,
    contexte.ambiance && `Ambiance : ${contexte.ambiance}`,
    contexte.objectifs && `Objectifs : ${contexte.objectifs}`,
    meta.personnageDescription && `Personnage joueur : ${meta.personnageDescription}`,
    'Priorités de recherche : territoire et pouvoir local, souverain ou autorité canonique, factions/guildes/religions applicables, règles sociales et lois du lieu, PNJ canonique directement pertinent, dangers ou tensions propres à cette situation.',
  ].filter(Boolean).join('\n');
}
