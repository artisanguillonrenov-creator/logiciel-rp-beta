import type { AppSettings, Engagement, Message, RelationPersonnage, SocialState, TypeEngagement } from '../types';
import { appellerModeleAvecOutils, type AppelOutil } from './openrouter';
import { outilsPourComposant, validerEtReparerArguments } from './tools';

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

/**
 * Extraction par tool calling (brief Phase 2 : "switch to OpenRouter
 * tool-calling for structured world-state mutations") : le modèle appelle
 * directement les outils du composant "social" (voir tools.ts) au lieu de
 * produire un JSON en prose — chaque appel est validé/réparé
 * individuellement.
 */
async function extraireAppelsSocial(
  appSettings: AppSettings,
  transcript: string,
  social: SocialState,
): Promise<AppelOutil[]> {
  const engagementsOuverts = social.engagements
    .filter((e) => !e.honore && !e.rompu)
    .map((e) => `- (id: ${e.id}, ${e.type}) ${e.description} — envers ${e.partie}`)
    .join('\n') || 'Aucun.';

  try {
    const { appelsOutils } = await appellerModeleAvecOutils({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      moteurInference: appSettings.moteurInference,
      temperature: 0.2,
      maxTokens: 500,
      outils: outilsPourComposant('social'),
      messages: [
        {
          role: 'system',
          content: `Tu observes un extrait de jeu de rôle pour suivre les engagements pris par {{user}} et l'évolution de ses relations avec les personnages non-joueurs. Appelle les outils appropriés pour chaque changement EXPLICITEMENT établi par le texte. N'invente pas de personnage ni d'engagement, n'appelle aucun outil si rien de notable n'est établi.

Engagements en cours :
${engagementsOuverts}`,
        },
        { role: 'user', content: transcript },
      ],
    });
    return appelsOutils;
  } catch {
    return [];
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

  const appelsBruts = await extraireAppelsSocial(appSettings, transcript, socialActuel);
  const outilsSocial = outilsPourComposant('social');

  const engagements: Engagement[] = [...socialActuel.engagements];
  let relations = [...socialActuel.relations];

  for (const appelBrut of appelsBruts) {
    const outil = outilsSocial.find((o) => o.nom === appelBrut.nom);
    if (!outil) continue; // permissions différenciées par composant : un outil hors périmètre est ignoré.
    const args = validerEtReparerArguments(outil, appelBrut.arguments);
    if (!args) continue;

    if (appelBrut.nom === 'ajouter_engagement') {
      const type = args.type as TypeEngagement;
      const description = args.description as string;
      const partie = args.partie as string;
      // Même promesse déjà suivie (le modèle la remarque parfois de nouveau
      // tant qu'elle reste ouverte) : pas de doublon dans les rappels.
      const dejaSuivi = engagements.some(
        (existant) =>
          !existant.honore &&
          !existant.rompu &&
          normalise(existant.partie) === normalise(partie) &&
          normalise(existant.description) === normalise(description),
      );
      if (!dejaSuivi) {
        engagements.push({ id: idEngagement(), type, description, partie, honore: false, rompu: false });
      }
    } else if (appelBrut.nom === 'resoudre_engagement') {
      const index = engagements.findIndex((e) => e.id === args.id);
      if (index >= 0) {
        const honore = args.honore as boolean;
        engagements[index] = { ...engagements[index], honore: honore, rompu: !honore };
      }
    } else if (appelBrut.nom === 'ajuster_relation') {
      const delta: AjustementRelation = {
        nom: args.nom as string,
        faction: typeof args.faction === 'string' ? args.faction : undefined,
        confiance: (args.confiance as number) ?? 0,
        respect: (args.respect as number) ?? 0,
        peur: (args.peur as number) ?? 0,
        affection: (args.affection as number) ?? 0,
        hostilite: (args.hostilite as number) ?? 0,
      };
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
    }
  }

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
