import type {
  AppSettings,
  DeclencheurMonde,
  Message,
  MondeState,
  NiveauActivite,
  ZoneMonde,
} from '../types';
import { appellerModele } from './openrouter';

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

interface SortieMonde {
  sceneActuelle?: { nom: string; description: string };
  nouvellesZones: { nom: string; description: string }[];
  flagsPoses: Record<string, boolean>;
  compteursAjustes: Record<string, number>;
  nouveauxDeclencheurs: { nom: string; conditionFlag?: string; conditionCompteurNom?: string; conditionCompteurSeuil?: number; effet: string }[];
  declencheursResolus: string[];
}

async function extraireEtatMonde(
  appSettings: AppSettings,
  transcript: string,
  monde: MondeState,
): Promise<SortieMonde | null> {
  const declencheursEnAttente = monde.declencheurs
    .filter((d) => d.declenche && !d.resolu)
    .map((d) => `- (id: ${d.id}) ${d.effet}`)
    .join('\n') || 'Aucun.';
  const flagsConnus = Object.keys(monde.flags).length ? Object.keys(monde.flags).join(', ') : 'Aucun.';
  const compteursConnus = Object.keys(monde.compteurs).length ? Object.keys(monde.compteurs).join(', ') : 'Aucun.';

  try {
    const sortie = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      temperature: 0.2,
      maxTokens: 500,
      messages: [
        {
          role: 'system',
          content: `Tu observes un extrait de jeu de rôle pour tenir à jour l'état du monde (lieux, drapeaux, compteurs). Réponds UNIQUEMENT avec un JSON strict :
{"sceneActuelle": {"nom": "lieu où la scène se déroule maintenant", "description": "état bref du lieu en une phrase"} ou null, "nouvellesZones": [{"nom": "...", "description": "..."}], "flagsPoses": {"nom_flag": true}, "compteursAjustes": {"nom_compteur": +1}, "nouveauxDeclencheurs": [{"nom": "...", "conditionFlag": "nom_flag" (optionnel), "conditionCompteurNom": "..." (optionnel), "conditionCompteurSeuil": 3 (optionnel avec conditionCompteurNom), "effet": "conséquence à narrer quand la condition se réalisera"}], "declencheursResolus": ["id"]}

Règles :
- "flagsPoses" : uniquement des états binaires établis explicitement par le texte (ex: "pont_effondre", "alliance_scellee"), snake_case court. N'invente pas de flag qui ne découle pas du texte.
- "compteursAjustes" : des DELTAS (pas la valeur finale) pour des compteurs numériques narrativement significatifs (jours écoulés, tension d'une faction...), snake_case court.
- "nouveauxDeclencheurs" : seulement si le texte plante explicitement une règle du type "si X arrive, alors Y" — une seule condition par déclencheur, parmi les flags ou compteurs connus ou tout juste posés.
- "declencheursResolus" : reprends l'id d'un déclencheur ci-dessous seulement si sa conséquence vient d'être clairement racontée dans le texte.
- Ignore tout ce qui n'est pas explicite. Vide/null si rien à signaler.

Flags déjà connus : ${flagsConnus}
Compteurs déjà connus : ${compteursConnus}
Conséquences déclenchées en attente d'être racontées :
${declencheursEnAttente}`,
        },
        { role: 'user', content: transcript },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      sceneActuelle:
        parsed.sceneActuelle && typeof parsed.sceneActuelle.nom === 'string' && parsed.sceneActuelle.nom.trim()
          ? { nom: parsed.sceneActuelle.nom.trim(), description: String(parsed.sceneActuelle.description ?? '').trim() }
          : undefined,
      nouvellesZones: Array.isArray(parsed.nouvellesZones)
        ? parsed.nouvellesZones
            .filter((z: any) => z && typeof z.nom === 'string' && z.nom.trim())
            .map((z: any) => ({ nom: String(z.nom).trim(), description: String(z.description ?? '').trim() }))
        : [],
      flagsPoses:
        parsed.flagsPoses && typeof parsed.flagsPoses === 'object'
          ? (Object.fromEntries(
              Object.entries(parsed.flagsPoses).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
            ) as Record<string, boolean>)
          : {},
      compteursAjustes:
        parsed.compteursAjustes && typeof parsed.compteursAjustes === 'object'
          ? (Object.fromEntries(
              Object.entries(parsed.compteursAjustes).filter(
                (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
              ),
            ) as Record<string, number>)
          : {},
      nouveauxDeclencheurs: Array.isArray(parsed.nouveauxDeclencheurs)
        ? parsed.nouveauxDeclencheurs.filter((d: any) => d && typeof d.nom === 'string' && typeof d.effet === 'string')
        : [],
      declencheursResolus: Array.isArray(parsed.declencheursResolus)
        ? parsed.declencheursResolus.filter((id: unknown) => typeof id === 'string')
        : [],
    };
  } catch {
    return null;
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
    const extrait = await extraireEtatMonde(appSettings, transcript, mondeActuel);

    if (extrait) {
      zones = [...zones];
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
      if (extrait.sceneActuelle) toucherZone(extrait.sceneActuelle.nom, extrait.sceneActuelle.description);
      extrait.nouvellesZones.forEach((z) => toucherZone(z.nom, z.description));

      flags = { ...flags, ...extrait.flagsPoses };

      compteurs = { ...compteurs };
      Object.entries(extrait.compteursAjustes).forEach(([nom, delta]) => {
        compteurs[nom] = (compteurs[nom] ?? 0) + delta;
      });

      declencheurs = declencheurs.map((d) =>
        extrait.declencheursResolus.includes(d.id) ? { ...d, resolu: true } : d,
      );
      extrait.nouveauxDeclencheurs.forEach((d) => {
        const conditionCompteur =
          d.conditionCompteurNom && typeof d.conditionCompteurSeuil === 'number'
            ? { nom: d.conditionCompteurNom, seuil: d.conditionCompteurSeuil }
            : undefined;
        // Même condition déjà suivie (le modèle repropose parfois une règle
        // déjà posée à un cycle précédent) : pas de doublon, la condition
        // structurée suffit à comparer sans nouvel appel d'embeddings.
        const dejaSuivi = declencheurs.some(
          (existant) =>
            (d.conditionFlag && existant.conditionFlag === d.conditionFlag) ||
            (conditionCompteur &&
              existant.conditionCompteur?.nom === conditionCompteur.nom &&
              existant.conditionCompteur?.seuil === conditionCompteur.seuil),
        );
        if (dejaSuivi) return;
        declencheurs.push({
          id: idDeclencheur(),
          nom: d.nom,
          conditionFlag: d.conditionFlag,
          conditionCompteur,
          effet: d.effet,
          declenche: false,
          resolu: false,
        });
      });
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
