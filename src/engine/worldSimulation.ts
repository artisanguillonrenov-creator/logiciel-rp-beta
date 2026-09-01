import type {
  AppSettings,
  DeclencheurMonde,
  Message,
  MondeState,
  NiveauActivite,
  ZoneMonde,
} from '../types';
import { appellerModeleAvecOutils, type AppelOutil } from './openrouter';
import { outilsPourComposant, validerEtReparerArguments } from './tools';

// Mêmes paliers d'écart (en nombre de messages depuis le dernier accès)
// pour les quatre niveaux d'activité d'une zone — au-delà du dernier
// palier, une zone reste "dormante" mais n'est jamais supprimée (même
// principe que l'archivage de la mémoire L4 -> L5, memory.ts).
const SEUIL_ACTIVE = 8;
const SEUIL_PROCHE = 20;
const SEUIL_LOINTAINE = 40;

function niveauPourEcart(ecart: number): NiveauActivite {
  if (ecart < SEUIL_ACTIVE) return 'active';
  if (ecart < SEUIL_PROCHE) return 'proche';
  if (ecart < SEUIL_LOINTAINE) return 'lointaine';
  return 'dormante';
}

function idZone(): string {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function idDeclencheur(): string {
  return `declencheur-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalise(texte: string): string {
  return texte.trim().toLowerCase();
}

/**
 * Extraction par tool calling (brief Phase 2 : "switch to OpenRouter
 * tool-calling for structured world-state mutations") : plutôt que de
 * demander un JSON en prose et de le parser au vol, le modèle appelle
 * directement les outils du composant "monde" (voir tools.ts) — chaque
 * appel est validé/réparé individuellement, un appel invalide ne fait pas
 * échouer les autres.
 */
async function extraireAppelsMonde(
  appSettings: AppSettings,
  transcript: string,
  monde: MondeState,
): Promise<AppelOutil[]> {
  const declencheursEnAttente = monde.declencheurs
    .filter((d) => d.declenche && !d.resolu)
    .map((d) => `- (id: ${d.id}) ${d.effet}`)
    .join('\n') || 'Aucun.';
  const flagsConnus = Object.keys(monde.flags).length ? Object.keys(monde.flags).join(', ') : 'Aucun.';
  const compteursConnus = Object.keys(monde.compteurs).length ? Object.keys(monde.compteurs).join(', ') : 'Aucun.';

  try {
    const { appelsOutils } = await appellerModeleAvecOutils({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      temperature: 0.2,
      maxTokens: 500,
      outils: outilsPourComposant('monde'),
      messages: [
        {
          role: 'system',
          content: `Tu observes un extrait de jeu de rôle pour tenir à jour l'état du monde. Appelle les outils appropriés pour chaque changement d'état EXPLICITEMENT établi par le texte (lieu de la scène, drapeaux, compteurs, règles "si X alors Y" plantées, déclencheurs déjà activés dont la conséquence vient d'être racontée). N'invente rien, n'appelle aucun outil si rien de notable n'est établi.

Flags déjà connus : ${flagsConnus}
Compteurs déjà connus : ${compteursConnus}
Conséquences déclenchées en attente d'être racontées (à résoudre via resoudre_declencheur si le texte les raconte) :
${declencheursEnAttente}`,
        },
        { role: 'user', content: transcript },
      ],
    });
    return appelsOutils;
  } catch {
    return [];
  }
}

/** Évalue localement, de façon déterministe, quels déclencheurs s'activent — aucun appel modèle. */
function evaluerDeclencheurs(declencheurs: DeclencheurMonde[], monde: MondeState): DeclencheurMonde[] {
  return declencheurs.map((d) => {
    if (d.declenche) return d;
    const flagOk = d.conditionFlag ? monde.flags[d.conditionFlag] === true : false;
    const compteurOk = d.conditionCompteur
      ? (monde.compteurs[d.conditionCompteur.nom] ?? 0) >= d.conditionCompteur.seuil
      : false;
    if (flagOk || compteurOk) {
      return { ...d, declenche: true };
    }
    return d;
  });
}

export interface MiseAJourMondeOptions {
  appSettings: AppSettings;
  mondeActuel: MondeState;
  messages: Message[];
  depuisIndex: number;
}

/**
 * World Simulation + State Machine (brief Phase 2) : le monde continue
 * d'exister hors champ (déclin d'activité des zones non visitées, jamais de
 * suppression) et réagit selon des règles déterministes (flags/compteurs),
 * pas selon l'appréciation narrative du modèle à chaque tour. L'extraction
 * de ce qui change (zone actuelle, flags posés, compteurs ajustés,
 * nouvelles règles) tourne à la même cadence que la mémoire ; l'évaluation
 * des déclencheurs, elle, est un calcul local et n'attend pas ce cycle.
 */
export async function mettreAJourMonde({
  appSettings,
  mondeActuel,
  messages,
  depuisIndex,
}: MiseAJourMondeOptions): Promise<MondeState> {
  const nouveauxMessages = messages.slice(depuisIndex);
  const nbMessages = messages.length;

  let zones = mondeActuel.zones;
  let flags = mondeActuel.flags;
  let compteurs = mondeActuel.compteurs;
  let declencheurs = mondeActuel.declencheurs;

  if (nouveauxMessages.length > 0) {
    const transcript = nouveauxMessages
      .map((m) => `${m.role === 'user' ? 'Joueur' : 'Narrateur'} : ${m.content}`)
      .join('\n');
    const appelsBruts = await extraireAppelsMonde(appSettings, transcript, mondeActuel);
    const outilsMonde = outilsPourComposant('monde');

    zones = [...zones];
    declencheurs = [...declencheurs];

    const toucherZone = (nom: string, description: string) => {
      const index = zones.findIndex((z) => normalise(z.nom) === normalise(nom));
      if (index >= 0) {
        zones[index] = {
          ...zones[index],
          description: description || zones[index].description,
          dernierAcces: nbMessages,
          niveau: 'active',
        };
      } else {
        zones.push({ id: idZone(), nom, description, dernierAcces: nbMessages, niveau: 'active' });
      }
    };

    for (const appelBrut of appelsBruts) {
      const outil = outilsMonde.find((o) => o.nom === appelBrut.nom);
      if (!outil) continue; // permissions différenciées par composant : un outil hors périmètre est ignoré.
      const args = validerEtReparerArguments(outil, appelBrut.arguments);
      if (!args) continue;

      if (appelBrut.nom === 'definir_zone') {
        toucherZone(args.nom as string, args.description as string);
      } else if (appelBrut.nom === 'poser_flag') {
        flags = { ...flags, [args.nom as string]: args.valeur as boolean };
      } else if (appelBrut.nom === 'ajuster_compteur') {
        compteurs = { ...compteurs, [args.nom as string]: (compteurs[args.nom as string] ?? 0) + (args.delta as number) };
      } else if (appelBrut.nom === 'resoudre_declencheur') {
        declencheurs = declencheurs.map((d) => (d.id === args.id ? { ...d, resolu: true } : d));
      } else if (appelBrut.nom === 'ajouter_declencheur') {
        const conditionCompteur =
          typeof args.conditionCompteurNom === 'string' && typeof args.conditionCompteurSeuil === 'number'
            ? { nom: args.conditionCompteurNom, seuil: args.conditionCompteurSeuil }
            : undefined;
        const conditionFlag = typeof args.conditionFlag === 'string' ? args.conditionFlag : undefined;
        // Même condition déjà suivie (le modèle repropose parfois une règle
        // déjà posée à un cycle précédent) : pas de doublon, la condition
        // structurée suffit à comparer sans nouvel appel d'embeddings.
        const dejaSuivi = declencheurs.some(
          (existant) =>
            (conditionFlag && existant.conditionFlag === conditionFlag) ||
            (conditionCompteur &&
              existant.conditionCompteur?.nom === conditionCompteur.nom &&
              existant.conditionCompteur?.seuil === conditionCompteur.seuil),
        );
        if (dejaSuivi || (!conditionFlag && !conditionCompteur)) continue;
        declencheurs.push({
          id: idDeclencheur(),
          nom: args.nom as string,
          conditionFlag,
          conditionCompteur,
          effet: args.effet as string,
          declenche: false,
          resolu: false,
        });
      }
    }
  }

  // Déclin d'activité (local, à chaque cycle) et évaluation des
  // déclencheurs (locale, déterministe) — indépendants du succès de
  // l'extraction ci-dessus.
  const zonesActualisees: ZoneMonde[] = zones.map((z) => ({
    ...z,
    niveau: niveauPourEcart(nbMessages - z.dernierAcces),
  }));
  const mondeAvantDeclencheurs: MondeState = { zones: zonesActualisees, flags, compteurs, declencheurs };
  const declencheursEvalues = evaluerDeclencheurs(declencheurs, mondeAvantDeclencheurs);

  return { zones: zonesActualisees, flags, compteurs, declencheurs: declencheursEvalues };
}

/** Formate l'état du monde pertinent pour le prompt — jamais visible du joueur. */
export function formaterMonde(monde: MondeState): string {
  const zonesPertinentes = monde.zones.filter((z) => z.niveau === 'active' || z.niveau === 'proche');
  const flagsActifs = Object.entries(monde.flags).filter(([, v]) => v);
  const consequencesEnAttente = monde.declencheurs.filter((d) => d.declenche && !d.resolu);

  if (zonesPertinentes.length === 0 && flagsActifs.length === 0 && consequencesEnAttente.length === 0) return '';

  const lignes: string[] = [];
  if (zonesPertinentes.length > 0) {
    lignes.push(
      ...zonesPertinentes.map(
        (z) => `- ${z.nom}${z.niveau === 'proche' ? ' (à proximité, hors champ)' : ''} : ${z.description}`,
      ),
    );
  }
  if (flagsActifs.length > 0) {
    lignes.push(`État établi : ${flagsActifs.map(([nom]) => nom).join(', ')}.`);
  }
  if (consequencesEnAttente.length > 0) {
    lignes.push(
      `Conséquences à faire apparaître dans cette réponse ou une prochaine, dès que l'occasion narrative se présente : ${consequencesEnAttente
        .map((d) => d.effet)
        .join(' ; ')}`,
    );
  }

  return `\n\n[ÉTAT DU MONDE]\n${lignes.join('\n')}`;
}
