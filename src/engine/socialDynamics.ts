import type { AppSettings, Engagement, Message, RelationPersonnage, SocialState, TypeEngagement } from '../types';
import { appellerModele } from './openrouter';

const TYPES_ENGAGEMENT: TypeEngagement[] = ['promesse', 'dette', 'contrat'];
const BORNE = 3;
// Fraction de chaque ajustement répercutée sur les autres personnages de la
// même faction (garde, guilde...) — une réputation qui se propage sans
// affecter les tiers autant que le personnage directement concerné.
const FACTEUR_PROPAGATION = 0.3;

function idEngagement(): string {
  return `engagement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function idRelation(): string {
  return `relation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalise(texte: string): string {
  return texte.trim().toLowerCase();
}

function borner(valeur: number): number {
  return Math.max(-BORNE, Math.min(BORNE, valeur));
}

interface AjustementRelation {
  nom: string;
  faction?: string;
  confiance: number;
  respect: number;
  peur: number;
  affection: number;
  hostilite: number;
}

interface SortieSocial {
  nouveauxEngagements: { type: TypeEngagement; description: string; partie: string }[];
  engagementsHonores: string[];
  engagementsRompus: string[];
  ajustementsRelations: AjustementRelation[];
}

async function extraireEtatSocial(
  appSettings: AppSettings,
  transcript: string,
  social: SocialState,
): Promise<SortieSocial | null> {
  const engagementsOuverts = social.engagements
    .filter((e) => !e.honore && !e.rompu)
    .map((e) => `- (id: ${e.id}, ${e.type}) ${e.description} — envers ${e.partie}`)
    .join('\n') || 'Aucun.';

  try {
    const sortie = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      temperature: 0.2,
      maxTokens: 500,
      messages: [
        {
          role: 'system',
          content: `Tu observes un extrait de jeu de rôle pour suivre les engagements pris et l'évolution des relations avec les personnages non-joueurs. Réponds UNIQUEMENT avec un JSON strict :
{"nouveauxEngagements": [{"type": "promesse|dette|contrat", "description": "...", "partie": "nom du PNJ ou de la faction concerné"}], "engagementsHonores": ["id"], "engagementsRompus": ["id"], "ajustementsRelations": [{"nom": "...", "faction": "optionnel", "confiance": +1, "respect": 0, "peur": 0, "affection": 0, "hostilite": 0}]}

Règles :
- "nouveauxEngagements" : uniquement des promesses, dettes ou contrats explicitement pris par {{user}} envers quelqu'un dans le texte.
- "engagementsHonores"/"engagementsRompus" : reprends l'id ci-dessous seulement si le texte règle explicitement cet engagement (tenu ou brisé).
- "ajustementsRelations" : des DELTAS (pas la valeur finale, échelle -3 à 3) sur confiance/respect/peur/affection/hostilité, uniquement pour un personnage nommé dont l'attitude envers {{user}} évolue clairement dans le texte. 0 pour un axe qui ne bouge pas. N'invente pas de personnage.

Engagements en cours :
${engagementsOuverts}`,
        },
        { role: 'user', content: transcript },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      nouveauxEngagements: Array.isArray(parsed.nouveauxEngagements)
        ? parsed.nouveauxEngagements
            .filter((e: any) => e && typeof e.description === 'string' && typeof e.partie === 'string')
            .map((e: any) => ({
              type: TYPES_ENGAGEMENT.includes(e.type) ? e.type : 'promesse',
              description: String(e.description).trim(),
              partie: String(e.partie).trim(),
            }))
        : [],
      engagementsHonores: Array.isArray(parsed.engagementsHonores)
        ? parsed.engagementsHonores.filter((id: unknown) => typeof id === 'string')
        : [],
      engagementsRompus: Array.isArray(parsed.engagementsRompus)
        ? parsed.engagementsRompus.filter((id: unknown) => typeof id === 'string')
        : [],
      ajustementsRelations: Array.isArray(parsed.ajustementsRelations)
        ? parsed.ajustementsRelations
            .filter((a: any) => a && typeof a.nom === 'string' && a.nom.trim())
            .map((a: any): AjustementRelation => ({
              nom: String(a.nom).trim(),
              faction: typeof a.faction === 'string' && a.faction.trim() ? a.faction.trim() : undefined,
              confiance: Number(a.confiance) || 0,
              respect: Number(a.respect) || 0,
              peur: Number(a.peur) || 0,
              affection: Number(a.affection) || 0,
              hostilite: Number(a.hostilite) || 0,
            }))
        : [],
    };
  } catch {
    return null;
  }
}

function nouvelleRelation(nom: string, faction: string | undefined): RelationPersonnage {
  return {
    id: idRelation(),
    nom,
    faction,
    confiance: 0,
    respect: 0,
    peur: 0,
    affection: 0,
    hostilite: 0,
  };
}

function appliquerAjustement(relation: RelationPersonnage, delta: AjustementRelation, echelle: number): RelationPersonnage {
  // Échelle entière (-3..3) : un delta propagé (echelle < 1) est arrondi
  // plutôt que de laisser les relations dériver en valeurs fractionnaires.
  return {
    ...relation,
    faction: relation.faction ?? delta.faction,
    confiance: borner(relation.confiance + Math.round(delta.confiance * echelle)),
    respect: borner(relation.respect + Math.round(delta.respect * echelle)),
    peur: borner(relation.peur + Math.round(delta.peur * echelle)),
    affection: borner(relation.affection + Math.round(delta.affection * echelle)),
    hostilite: borner(relation.hostilite + Math.round(delta.hostilite * echelle)),
  };
}

export interface MiseAJourSocialOptions {
  appSettings: AppSettings;
  socialActuel: SocialState;
  messages: Message[];
  depuisIndex: number;
}

/**
 * Engagements + dynamiques sociales (brief Phase 2) : suit les promesses,
 * dettes et contrats pris par {{user}} (auto-reminder tant qu'ils ne sont
 * ni honorés ni rompus, voir formaterEngagementsEtRelations) et fait
 * évoluer les relations avec les PNJ sur cinq axes, avec une propagation
 * limitée aux autres personnages d'une même faction plutôt qu'un effet
 * isolé au seul PNJ concerné.
 */
export async function mettreAJourSocial({
  appSettings,
  socialActuel,
  messages,
  depuisIndex,
}: MiseAJourSocialOptions): Promise<SocialState> {
  const nouveauxMessages = messages.slice(depuisIndex);
  if (nouveauxMessages.length === 0) return socialActuel;

  const transcript = nouveauxMessages
    .map((m) => `${m.role === 'user' ? 'Joueur' : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const extrait = await extraireEtatSocial(appSettings, transcript, socialActuel);
  if (!extrait) return socialActuel;

  const engagements: Engagement[] = socialActuel.engagements.map((e) => ({
    ...e,
    honore: e.honore || extrait.engagementsHonores.includes(e.id),
    rompu: e.rompu || extrait.engagementsRompus.includes(e.id),
  }));
  extrait.nouveauxEngagements.forEach((e) => {
    // Même promesse déjà suivie (le modèle la remarque parfois de nouveau
    // tant qu'elle reste ouverte) : pas de doublon dans les rappels.
    const dejaSuivi = engagements.some(
      (existant) =>
        !existant.honore &&
        !existant.rompu &&
        normalise(existant.partie) === normalise(e.partie) &&
        normalise(existant.description) === normalise(e.description),
    );
    if (dejaSuivi) return;
    engagements.push({ id: idEngagement(), type: e.type, description: e.description, partie: e.partie, honore: false, rompu: false });
  });

  let relations = [...socialActuel.relations];
  extrait.ajustementsRelations.forEach((delta) => {
    const index = relations.findIndex((r) => normalise(r.nom) === normalise(delta.nom));
    const cible = index >= 0 ? relations[index] : nouvelleRelation(delta.nom, delta.faction);
    const cibleAjustee = appliquerAjustement(cible, delta, 1);
    if (index >= 0) {
      relations[index] = cibleAjustee;
    } else {
      relations.push(cibleAjustee);
    }

    const faction = cibleAjustee.faction;
    if (faction) {
      relations = relations.map((r) =>
        r.id !== cibleAjustee.id && r.faction && normalise(r.faction) === normalise(faction)
          ? appliquerAjustement(r, delta, FACTEUR_PROPAGATION)
          : r,
      );
    }
  });

  return { engagements, relations };
}

/** Formate engagements en attente et relations notables pour le prompt — jamais visible du joueur. */
export function formaterEngagementsEtRelations(social: SocialState): string {
  const engagementsOuverts = social.engagements.filter((e) => !e.honore && !e.rompu);
  const relationsNotables = social.relations.filter(
    (r) => Math.abs(r.confiance) >= 2 || Math.abs(r.respect) >= 2 || Math.abs(r.peur) >= 2 || Math.abs(r.affection) >= 2 || Math.abs(r.hostilite) >= 2,
  );

  if (engagementsOuverts.length === 0 && relationsNotables.length === 0) return '';

  const lignes: string[] = [];
  if (engagementsOuverts.length > 0) {
    lignes.push('Engagements en cours (ni honorés ni rompus — à garder en tête) :');
    lignes.push(...engagementsOuverts.map((e) => `- (${e.type}) ${e.description} — envers ${e.partie}`));
  }
  if (relationsNotables.length > 0) {
    lignes.push('Relations notables (échelle -3 à 3, à respecter dans le comportement des personnages) :');
    lignes.push(
      ...relationsNotables.map((r) => {
        const axes = [
          r.confiance !== 0 && `confiance ${r.confiance > 0 ? '+' : ''}${r.confiance}`,
          r.respect !== 0 && `respect ${r.respect > 0 ? '+' : ''}${r.respect}`,
          r.peur !== 0 && `peur ${r.peur > 0 ? '+' : ''}${r.peur}`,
          r.affection !== 0 && `affection ${r.affection > 0 ? '+' : ''}${r.affection}`,
          r.hostilite !== 0 && `hostilité ${r.hostilite > 0 ? '+' : ''}${r.hostilite}`,
        ]
          .filter(Boolean)
          .join(', ');
        return `- ${r.nom} : ${axes}`;
      }),
    );
  }

  return `\n\n[ENGAGEMENTS ET RELATIONS]\n${lignes.join('\n')}`;
}
