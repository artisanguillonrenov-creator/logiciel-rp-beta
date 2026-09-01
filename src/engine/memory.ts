import type { AppSettings, Fact, FactType, MemoryState, Message, NiveauMemoire } from '../types';
import { appellerModele } from './openrouter';
import { obtenirEmbeddings, similariteCosinus } from './embeddings';

// Cadence de régénération de la mémoire (brief bêta section 3, conservée en
// Phase 2 : le pipeline L0-L5 ci-dessous tourne à la même cadence plutôt que
// de multiplier les appels modèle par tour).
export const NB_MESSAGES_AVANT_MAJ = 8;

// Décroissance L4 (canon) -> L5 (archive) : nombre de messages sans
// reconfirmation au-delà duquel un fait n'est plus injecté systématiquement.
// Jamais supprimé pour autant ([MÉTA] Continuité : "un oubli ne détruit
// jamais un état établi").
const SEUIL_DECROISSANCE_MESSAGES = 40;

// Similarité cosinus au-delà de laquelle un nouveau fait candidat est
// considéré comme le même fait qu'un fait déjà connu (L2 -> L3 : fusion
// plutôt que doublon).
const SEUIL_FUSION = 0.86;

export function doitMettreAJourMemoire(messages: Message[], dernierMessageIndexMaj: number): boolean {
  return messages.length - dernierMessageIndexMaj >= NB_MESSAGES_AVANT_MAJ;
}

// Commande rapide "retiens que X" (Ajouts_A_Integrer.md #5) : le joueur
// force un fait en mémoire canon lui-même, sans attendre le passage par
// l'extraction/consolidation ci-dessous. Accepte "retiens que …" et
// "/retiens …".
const REGEX_COMMANDE_RETENIR = /^(?:\/retiens\s+|retiens\s+que\s+)(.+)$/i;

export function detecterCommandeRetenir(texte: string): string | null {
  const match = texte.match(REGEX_COMMANDE_RETENIR);
  return match ? match[1].trim() : null;
}

export function verrouillerFait(memoire: MemoryState, texte: string, indexMessageActuel: number): MemoryState {
  return {
    ...memoire,
    faits: [
      ...memoire.faits,
      {
        id: idFait(),
        type: 'autre',
        texte,
        resolue: false,
        niveau: 'canon',
        dernierAcces: indexMessageActuel,
      },
    ],
  };
}

function idFait(): string {
  return `fait-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface MiseAJourMemoireOptions {
  appSettings: AppSettings;
  memoireActuelle: MemoryState;
  messages: Message[];
  personnageNom: string;
}

interface FaitCandidat {
  type: FactType;
  texte: string;
  resolue: boolean;
  // Signal du modèle lui-même : ce fait lui semble contredire un fait déjà
  // listé dans le prompt de mise à jour. Le canon existant prime toujours
  // ([MÉTA] Continuité : "contradictions interdites") — un candidat signalé
  // n'écrase jamais un fait canon, il reste en observation (L2) pour la
  // prochaine mise à jour plutôt que d'être avalé silencieusement.
  contreditUnFaitExistant: boolean;
}

/**
 * L2 — extraction épisodique : un seul appel modèle qui produit à la fois
 * le résumé (L1) mis à jour et les faits candidats de la période récente,
 * chaque candidat s'auto-signalant s'il semble contredire la mémoire
 * existante. Reste économique (un appel, pas six) tout en couvrant la
 * détection de contradiction demandée par le brief Phase 2.
 */
async function extraireCandidats({
  appSettings,
  memoireActuelle,
  messages,
  personnageNom,
}: MiseAJourMemoireOptions): Promise<{ resume: string; candidats: FaitCandidat[] } | null> {
  const nouveauxMessages = messages.slice(memoireActuelle.dernierMessageIndexMaj);
  const transcript = nouveauxMessages
    .map((m) => `${m.role === 'user' ? personnageNom : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const faitsActifs = memoireActuelle.faits.filter((f) => f.niveau !== 'archive');
  const faitsActuelsTexte = faitsActifs.length
    ? faitsActifs.map((f) => `- [${f.type}]${f.resolue ? ' (résolu)' : ''} ${f.texte}`).join('\n')
    : 'Aucun.';

  try {
    const sortie = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      temperature: 0.2,
      maxTokens: 600,
      messages: [
        {
          role: 'system',
          content: `Tu es le module de mémoire d'un logiciel de jeu de rôle. Tu ne racontes rien : tu maintiens une mémoire structurée. Réponds UNIQUEMENT avec un objet JSON strict de la forme :
{"resume": "...", "faits": [{"type": "personnage|lieu|promesse|autre", "texte": "...", "resolue": false, "contredit_un_fait_existant": false}]}

Règles :
- "resume" : résumé glissant de l'histoire jusqu'ici (quelques phrases denses), en partant du résumé précédent et en intégrant les nouveaux événements.
- "faits" : les faits clés de la période récente (personnages rencontrés, lieux visités, promesses/engagements faits ou non tenus, changements d'état). N'inclus que les faits nouveaux ou modifiés — pas besoin de relister ceux qui n'ont pas changé.
- "contredit_un_fait_existant" : true UNIQUEMENT si ce fait contredit littéralement un fait de la liste ci-dessous (ex. un personnage donné mort puis vivant sans explication). Dans le doute, false.
- Reste factuel, sans interprétation ni ajout non présent dans le texte.`,
        },
        {
          role: 'user',
          content: `RÉSUMÉ PRÉCÉDENT :\n${memoireActuelle.resume || '(aucun)'}\n\nFAITS CONNUS :\n${faitsActuelsTexte}\n\nNOUVEAUX ÉCHANGES À INTÉGRER :\n${transcript}`,
        },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const candidats: FaitCandidat[] = Array.isArray(parsed.faits)
      ? parsed.faits.map((f: any) => ({
          type: ['personnage', 'lieu', 'promesse', 'autre'].includes(f.type) ? f.type : 'autre',
          texte: String(f.texte ?? ''),
          resolue: Boolean(f.resolue),
          contreditUnFaitExistant: Boolean(f.contredit_un_fait_existant),
        }))
      : [];

    return {
      resume: typeof parsed.resume === 'string' ? parsed.resume : memoireActuelle.resume,
      candidats,
    };
  } catch {
    return null;
  }
}

/**
 * L3 (consolidation/déduplication) + L4 (canonisation sous réserve
 * d'absence de contradiction) + L5 (décroissance). Local, sans appel
 * modèle supplémentaire : la déduplication se fait par similarité
 * d'embeddings entre les faits candidats et les faits déjà connus.
 */
async function consoliderEtCanoniser(
  faitsExistants: Fact[],
  candidats: FaitCandidat[],
  indexMessageActuel: number,
  appSettings: AppSettings,
): Promise<Fact[]> {
  let faits = [...faitsExistants];

  if (candidats.length > 0) {
    // On ne dédup/fusionne que contre la mémoire encore active — un fait
    // archivé qui redevient pertinent revit comme un nouveau fait plutôt
    // que via une fusion silencieuse (limite assumée : pas de résurrection
    // automatique de L5 dans cette version).
    const cibles = faits.filter((f) => f.niveau !== 'archive');
    const textes = [...cibles.map((f) => f.texte), ...candidats.map((c) => c.texte)];
    const { vecteurs } = await obtenirEmbeddings(textes, appSettings);
    const vecteursCibles = vecteurs.slice(0, cibles.length);
    const vecteursCandidats = vecteurs.slice(cibles.length);

    candidats.forEach((candidat, i) => {
      let meilleurIndex = -1;
      let meilleurScore = SEUIL_FUSION;
      vecteursCibles.forEach((v, j) => {
        const score = similariteCosinus(vecteursCandidats[i], v);
        if (score > meilleurScore) {
          meilleurScore = score;
          meilleurIndex = j;
        }
      });

      if (meilleurIndex >= 0) {
        const cible = cibles[meilleurIndex];
        const indexDansFaits = faits.findIndex((f) => f.id === cible.id);
        if (candidat.contreditUnFaitExistant) {
          // Le canon existant prime : on ne touche pas au fait établi, on
          // ignore simplement le candidat contradictoire.
          return;
        }
        faits[indexDansFaits] = {
          ...faits[indexDansFaits],
          texte: candidat.texte,
          resolue: candidat.resolue || faits[indexDansFaits].resolue,
          niveau: 'consolide',
          dernierAcces: indexMessageActuel,
          fusionneDe: [...(faits[indexDansFaits].fusionneDe ?? []), faits[indexDansFaits].id],
        };
      } else {
        faits.push({
          id: idFait(),
          type: candidat.type,
          texte: candidat.texte,
          resolue: candidat.resolue,
          // Un candidat sans antécédent proche mais auto-signalé comme
          // contradictoire reste en observation (L2) plutôt que promu
          // canon directement — voir FaitCandidat.contreditUnFaitExistant.
          niveau: candidat.contreditUnFaitExistant ? 'episodique' : 'canon',
          dernierAcces: indexMessageActuel,
        });
      }
    });
  }

  // L4 -> L5 : décroissance des faits actifs non reconfirmés depuis
  // longtemps.
  return faits.map((f) =>
    f.niveau !== 'archive' && indexMessageActuel - f.dernierAcces > SEUIL_DECROISSANCE_MESSAGES
      ? { ...f, niveau: 'archive' as NiveauMemoire }
      : f,
  );
}

/**
 * Pipeline de mémoire L0-L5 (brief Phase 2) : L0 (contexte immédiat) et L1
 * (résumé) restent gérés comme en bêta ; L2 (extraction), L3
 * (consolidation/déduplication), L4 (canonisation avec détection de
 * contradiction) et L5 (décroissance) s'enchaînent ici à chaque mise à jour.
 */
export async function mettreAJourMemoire(options: MiseAJourMemoireOptions): Promise<MemoryState> {
  const resultat = await extraireCandidats(options);
  if (!resultat) {
    // Échec d'extraction : mémoire inchangée, on retentera à la prochaine
    // occasion (l'index n'avance pas).
    return options.memoireActuelle;
  }

  try {
    const faits = await consoliderEtCanoniser(
      options.memoireActuelle.faits,
      resultat.candidats,
      options.messages.length,
      options.appSettings,
    );
    return { resume: resultat.resume, faits, dernierMessageIndexMaj: options.messages.length };
  } catch {
    // La consolidation par embeddings a échoué (ex. aucun fournisseur
    // disponible) : on garde au moins le résumé et les faits bruts sans
    // fusion/décroissance plutôt que de perdre la mise à jour.
    const faits = [
      ...options.memoireActuelle.faits,
      ...resultat.candidats
        .filter((c) => !c.contreditUnFaitExistant)
        .map((c) => ({
          id: idFait(),
          type: c.type,
          texte: c.texte,
          resolue: c.resolue,
          niveau: 'canon' as NiveauMemoire,
          dernierAcces: options.messages.length,
        })),
    ];
    return { resume: resultat.resume, faits, dernierMessageIndexMaj: options.messages.length };
  }
}
