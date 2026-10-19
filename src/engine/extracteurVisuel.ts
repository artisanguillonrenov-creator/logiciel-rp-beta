import type { AppSettings, StoryState } from '../types';
import { appellerModele, configurationLLM } from './elyndorCloudClient';
import { canonRace, detecterRacePnj, traitsVisuelsRace } from './racePnj';
import { ROLES_CANON } from './canonElyndor';
import { prenomRole } from './rolesCanon';
import { RACES_ELYNDOR } from '../mondes/elyndor/races';
import { filtrerTextePourProfil } from './contenuAdulte';
import {
  analyserExtraction,
  extractionVide,
  ficheDuPersonnage,
  motsClesDeFiche,
  raceDuPersonnage,
  nomCiteDans,
  type ExtractionMotsCles,
} from './contratVisuel';
import {
  detecterPersonnagesParRepli,
  listerPnjVisuels,
  type EtatVisuelHistoire,
  type PersonnageVisibleResolu,
} from './visualState';

/**
 * Extraction visuelle : le narrateur, qui connaît tout le contexte du récit,
 * relève en MOTS-CLÉS FACTUELS ce qui est visible (lieu, instant, personnages,
 * apparences, tenues, actions, décor). Il ne choisit aucun style, aucun rendu,
 * aucun cadrage artistique et n'écrit aucune syntaxe propre à un générateur :
 * l'identité artistique est ajoutée ensuite par le moteur visuel, depuis
 * l'Atelier. Sa sortie est validée puis corrigée par le canon (contratVisuel).
 */

const MESSAGES_CONTEXTE = 10;
const MESSAGES_CONTEXTE_ALLEGE = 4;
const LONGUEUR_MESSAGE_CONTEXTE = 1400;

/** Consigne d'origine, la même pour toutes les images ; modifiable dans l'Atelier. */
export const CONSIGNE_EXTRACTION_PAR_DEFAUT = `Tu relèves, en mots-clés factuels, ce qui est VISIBLE à l'instant illustré. Tu ne choisis aucun style, aucun rendu, aucun réalisateur, aucun cadrage artistique et tu ne cites aucun modèle d'image : l'application ajoute elle-même l'identité artistique.
Règles :
- Mots-clés EN ANGLAIS, en groupes nominaux courts (1 à 6 mots), jamais de phrase, jamais de dialogue, jamais de suite de l'histoire.
- Distingue les personnages VISIBLES dans l'image, les présents mais HORS CADRE, les simplement MENTIONNÉS (souvenir, dialogue, absent) et les FIGURANTS anonymes. Un personnage mentionné ou absent n'est jamais visible.
- L'apparence vient de la fiche du personnage, du lore et de l'état visuel : reprends-la fidèlement, n'invente rien. Un détail absent des fiches est omis.
- L'identité commence par l'âge APPARENT (celui qu'on lui donne en le voyant, jamais l'âge réel d'une race longévive, jamais moins de 20 ans : « 35 years old »), puis race, sexe et rôle.
- Le lieu, l'instant et la lumière décrivent la réalité de la scène, sans ambiance inventée.
- "elementsObligatoires" : ce sans quoi l'image serait fausse (architecture précise, objets clés, foule ou estrades si la scène en parle).
- Sans personnage visible (paysage, décor seul), "personnagesVisibles" reste vide : aucun personnage inventé.
- "changementsVisuels" : uniquement les changements DURABLES établis par le récit (tenue, blessure, arme, coiffure, décor, heure, météo…), "valeur" en mots-clés anglais, avec dans "evenement" la phrase exacte du récit qui l'établit.`;

/** Format de réponse : fixe, car la réponse est validée par l'application. */
const FORMAT_REPONSE = `Champs autorisés pour "champ" des changements :
- personnage : tenue, armure, coiffure, proprete, armesVisibles, accessoires, blessures, cicatrices, salissures, transformations, objetsPortes
- decor : lieu, typeLieu, architecture, disposition, heure, meteo, lumiere, sourcesLumineuses, degats, incendies, ouvertures, objetsImportants, mobilier, traces

Réponds UNIQUEMENT avec ce JSON strict :
{"typeScene":"dialogue|combat|tension|decouverte|groupe|interieur|paysage",
"lieu":[""],"instant":[""],"eclairage":[""],
"personnagesVisibles":[{"nom":"","identite":[""],"apparence":[""],"tenue":[""],"action":[""],"position":[""]}],
"horsCadre":[""],"mentionnes":[""],"figurants":[""],
"action":[""],"elementsObligatoires":[""],"decor":[""],"interdictionsFactuelles":[""],
"changementsVisuels":[{"cible":"personnage|decor","nom":"","champ":"","operation":"definir|ajouter|retirer","valeur":"","evenement":"citation exacte"}]}`;

const PAUSE_EXTRACTION = `[PAUSE DANS LE RÉCIT — RELEVÉ VISUEL]
Tu n'écris pas la suite de l'histoire. Tu relèves ce qui est visible à la fin de ton dernier message, avec tout ce que tu sais : lore, mémoire, fiche de scène, rôles fixés par le lore, fiches des personnages.`;

const AMORCE = '{"typeScene":"';

export function consigneExtraction(personnalisee?: string | null): string {
  return `${personnalisee?.trim() || CONSIGNE_EXTRACTION_PAR_DEFAUT}\n\n${FORMAT_REPONSE}`;
}

function texteSur(valeur: unknown, max = 400): string {
  const t = typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : '';
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function texteProfil(texte: string, settings: AppSettings): string {
  if (settings.profilContenu === 'adulte') return texte;
  return filtrerTextePourProfil(texte, settings.profilContenu) || '[passage masqué par le profil Grand public]';
}

export function texteDerniereScene(story: StoryState): string {
  const dernier = [...story.messages].reverse().find((m) => m.role === 'assistant');
  return dernier?.content ?? story.meta.pointDeDepart;
}

/**
 * Textes qui peuvent établir un changement visuel : narration depuis la
 * dernière analyse, fiche du joueur, fiches des PNJ et point de départ. Les
 * messages du joueur sont des intentions, pas des faits établis.
 */
export function textesNarratifsEtablis(story: StoryState, depuisIndex: number): string[] {
  const debut = Math.max(0, Math.min(depuisIndex, story.messages.length - MESSAGES_CONTEXTE));
  return [
    story.meta.personnageDescription,
    story.meta.pointDeDepart,
    ...listerPnjVisuels(story).map((pnj) => `${pnj.titre} : ${pnj.contenu}`),
    ...story.messages.slice(debut).filter((m) => m.role === 'assistant').map((m) => m.content),
  ].filter((t): t is string => !!t && !!t.trim());
}

function decrireEtatVisuel(etat: EtatVisuelHistoire): string {
  const personnages = etat.personnages.map((p) => {
    const champs = [
      p.tenue && `tenue ${p.tenue}`, p.armure && `armure ${p.armure}`, p.coiffure && `coiffure ${p.coiffure}`,
      p.proprete && `état ${p.proprete}`,
      p.armesVisibles.length && `armes ${p.armesVisibles.join(', ')}`,
      p.accessoires.length && `accessoires ${p.accessoires.join(', ')}`,
      p.blessures.length && `blessures ${p.blessures.join(', ')}`,
      p.cicatrices.length && `cicatrices ${p.cicatrices.join(', ')}`,
      p.salissures.length && `salissures ${p.salissures.join(', ')}`,
      p.transformations.length && `transformations ${p.transformations.join(', ')}`,
      p.objetsPortes.length && `porte ${p.objetsPortes.join(', ')}`,
    ].filter(Boolean);
    return `- ${p.nom} : ${champs.join(' ; ') || 'aucun détail établi'}`;
  });
  const d = etat.decor;
  const decor = d
    ? [
        d.lieu && `lieu ${d.lieu}`, d.typeLieu && `type ${d.typeLieu}`, d.architecture && `architecture ${d.architecture}`,
        d.disposition && `disposition ${d.disposition}`, d.heure && `heure ${d.heure}`, d.meteo && `météo ${d.meteo}`,
        d.lumiere && `lumière ${d.lumiere}`,
        d.sourcesLumineuses.length && `sources lumineuses ${d.sourcesLumineuses.join(', ')}`,
        d.degats.length && `dégâts ${d.degats.join(', ')}`, d.incendies.length && `incendies ${d.incendies.join(', ')}`,
        d.ouvertures.length && `ouvertures ${d.ouvertures.join(', ')}`,
        d.objetsImportants.length && `objets ${d.objetsImportants.join(', ')}`,
        d.mobilier.length && `mobilier ${d.mobilier.join(', ')}`, d.traces.length && `traces ${d.traces.join(', ')}`,
      ].filter(Boolean).join(' ; ')
    : '';
  return [
    `[ÉTAT VISUEL ÉTABLI — PERSONNAGES]\n${personnages.join('\n') || 'Aucun encore.'}`,
    `[ÉTAT VISUEL ÉTABLI — DÉCOR COURANT]\n${decor || 'Aucun encore.'}`,
  ].join('\n\n');
}

/**
 * Contexte propre à l'extraction. allege : le contexte complet du narrateur est
 * déjà fourni (personnage, mémoire, lore, fiche de scène) ; seuls restent les
 * personnages de la scène avec leur canon, l'état visuel et les derniers messages.
 */
export function construireContexteExtraction(story: StoryState, settings: AppSettings, etat: EtatVisuelHistoire, allege = false): string {
  const raceJoueur = RACES_ELYNDOR.find((r) => r.id === story.meta.raceOrigineId);
  const recents = story.messages.slice(allege ? -MESSAGES_CONTEXTE_ALLEGE : -MESSAGES_CONTEXTE).map((m) => {
    const auteur = m.role === 'assistant' ? 'NARRATEUR' : story.meta.personnageNom.toUpperCase();
    return `${auteur} : ${texteSur(texteProfil(m.content, settings), LONGUEUR_MESSAGE_CONTEXTE)}`;
  });
  const scene = `[MESSAGES RÉCENTS — le dernier message du narrateur est la scène à relever]\n${recents.join('\n\n') || texteSur(story.meta.pointDeDepart, 1200)}`;
  // Seuls les personnages de la scène : une fiche ancienne déteignait sinon
  // sur un autre personnage (« Maître Kael… robe noire »).
  const texteScene = [texteDerniereScene(story), ...(story.scene?.presents ?? [])].join('\n');
  const pnjScene = listerPnjVisuels(story)
    .filter((e) => allege ? nomCiteDans(e.titre, texteScene) : true)
    .map((e) => {
      const race = detecterRacePnj(e.titre, e.contenu);
      return `- ${e.titre} : ${texteSur(texteProfil(e.contenu, settings), allege ? 400 : 300)}${race ? `\n  ${canonRace(race)}` : ''}`;
    })
    .join('\n');
  const canon = ROLES_CANON
    .filter((r) => nomCiteDans(prenomRole(r), texteScene))
    .map((r) => `- ${r.nom} (${r.libelle}, ${r.ville}) : ${r.description}`)
    .join('\n');
  const joueur = allege
    ? (raceJoueur ? `[RACE DE ${story.meta.personnageNom}]\n${canonRace({ race: raceJoueur, sexe: 'Autre' })}` : '')
    : `[PERSONNAGE DU JOUEUR — ${story.meta.personnageNom}]\n${texteProfil(story.meta.personnageDescription || 'Aucune fiche.', settings)}`
      + (raceJoueur ? `\n${canonRace({ race: raceJoueur, sexe: 'Autre' })}` : '');
  const cadre = !allege && story.meta.contexte?.lieu ? `[CADRE DE L'HISTOIRE]\nLieu : ${story.meta.contexte.lieu}` : '';
  return [
    joueur,
    canon ? `[PERSONNAGES DU LORE DANS LA SCÈNE — apparence et tenue officielles, font autorité]\n${canon}` : '',
    `[PNJ ${allege ? 'DE LA SCÈNE' : 'CONNUS'}]\n${pnjScene || 'Aucun.'}`,
    cadre,
    decrireEtatVisuel(etat),
    scene,
  ].filter(Boolean).join('\n\n');
}

/** Messages de l'appel : contexte complet du narrateur quand il est fourni. */
export function messagesExtraction(
  story: StoryState,
  settings: AppSettings,
  etat: EtatVisuelHistoire,
  contexteNarrateur?: string,
  consignePersonnalisee?: string | null,
) {
  const consigne = consigneExtraction(consignePersonnalisee);
  if (!contexteNarrateur) {
    return [
      { role: 'system' as const, content: construireContexteExtraction(story, settings, etat) },
      { role: 'user' as const, content: consigne },
    ];
  }
  return [
    { role: 'system' as const, content: contexteNarrateur },
    { role: 'user' as const, content: `${construireContexteExtraction(story, settings, etat, true)}\n\n${PAUSE_EXTRACTION}\n\n${consigne}` },
    // Réponse amorcée par le début du JSON : sans elle, certains modèles
    // refusaient une fois sur deux et l'illustration retombait sur le repli.
    { role: 'assistant' as const, content: AMORCE },
  ];
}

/** Le serveur renvoie l'amorce avec la suite, ou la suite seule selon les moteurs. */
export function completerAmorce(sortie: string, amorcee: boolean): string {
  return amorcee && !sortie.trimStart().startsWith('{') ? `${AMORCE}${sortie}` : sortie;
}

export interface ResultatExtraction {
  extraction: ExtractionMotsCles;
  parModele: boolean;
  /** Sortie brute du narrateur (diagnostic), tronquée. */
  brute?: string;
  rejets: string[];
  erreur?: string;
}

/**
 * Repli local, sans appel réseau : personnages cités dans le dernier passage
 * (et présents dans la scène quand l'état de scène les connaît), canon de
 * leur race et mots-clés de leur fiche. Aucun fait n'est inventé.
 */
export function extractionDeRepli(story: StoryState): ExtractionMotsCles {
  const texteScene = texteDerniereScene(story);
  const presents = story.scene?.presents ?? [];
  const visibles = detecterPersonnagesParRepli(story, texteScene)
    .filter((v) => v.type === 'joueur' || !presents.length || presents.some((p) => nomCiteDans(v.nom, p) || nomCiteDans(p, v.nom)));
  return {
    ...extractionVide(),
    personnagesVisibles: visibles.map((v) => ({
      nom: v.nom,
      identite: [],
      apparence: motsClesDeFiche(ficheDuPersonnage(story, v), 4),
      tenue: [],
      action: [],
      position: [],
    })),
  };
}

/**
 * Un seul appel au narrateur (un second seulement si la réponse est
 * illisible) ; sinon repli local. Jamais d'appel supplémentaire pour
 * « réécrire » un prompt : le prompt final est construit par l'application.
 */
export async function extraireMotsClesScene(
  story: StoryState,
  settings: AppSettings,
  etat: EtatVisuelHistoire,
  options: { contexteNarrateur?: string; consigne?: string | null; signal?: AbortSignal } = {},
): Promise<ResultatExtraction> {
  const amorcee = !!options.contexteNarrateur;
  let derniere = '';
  try {
    for (const temperature of [0.2, 0.5]) {
      derniere = completerAmorce(await appellerModele({
        ...configurationLLM(settings),
        storyId: story.meta.id,
        temperature,
        maxTokens: 1400,
        signal: options.signal,
        diagnosticLabel: 'Relevé visuel (mots-clés)',
        messages: messagesExtraction(story, settings, etat, options.contexteNarrateur, options.consigne),
      }), amorcee);
      const lu = analyserExtraction(derniere);
      if (lu) return { extraction: lu.extraction, parModele: true, brute: derniere.slice(0, 4000), rejets: lu.rejets };
    }
    return { extraction: extractionDeRepli(story), parModele: false, brute: derniere.slice(0, 4000), rejets: [], erreur: 'Réponse du narrateur illisible (JSON invalide) : repli local.' };
  } catch (erreur) {
    if (options.signal?.aborted) throw erreur;
    return {
      extraction: extractionDeRepli(story),
      parModele: false,
      rejets: [],
      erreur: `Narrateur indisponible : ${erreur instanceof Error ? erreur.message : String(erreur)}. Repli local.`,
    };
  }
}

/**
 * Portrait d'un personnage : même consigne universelle, appliquée à sa fiche
 * et à son état visuel. En cas d'échec, les mots-clés de sa fiche servent de repli.
 */
export async function extraireMotsClesPortrait(
  story: StoryState,
  sujet: PersonnageVisibleResolu,
  settings: AppSettings,
  etat: EtatVisuelHistoire,
  options: { consigne?: string | null; signal?: AbortSignal } = {},
): Promise<ResultatExtraction> {
  const fiche = ficheDuPersonnage(story, sujet);
  const race = raceDuPersonnage(story, sujet);
  const persistant = etat.personnages.find((p) => p.nom === sujet.nom);
  const etatTexte = persistant
    ? [persistant.tenue && `tenue : ${persistant.tenue}`, persistant.armure && `armure : ${persistant.armure}`,
      persistant.coiffure && `coiffure : ${persistant.coiffure}`,
      persistant.blessures.length && `blessures : ${persistant.blessures.join(', ')}`,
      persistant.cicatrices.length && `cicatrices : ${persistant.cicatrices.join(', ')}`,
      persistant.accessoires.length && `accessoires : ${persistant.accessoires.join(', ')}`].filter(Boolean).join('\n')
    : '';
  const repli = (): ExtractionMotsCles => ({
    ...extractionVide(),
    personnagesVisibles: [{ nom: sujet.nom, identite: [], apparence: motsClesDeFiche(fiche), tenue: [], action: [], position: [] }],
  });
  try {
    const sortie = await appellerModele({
      ...configurationLLM(settings),
      storyId: story.meta.id,
      temperature: 0.2,
      maxTokens: 700,
      signal: options.signal,
      diagnosticLabel: 'Relevé visuel (portrait)',
      messages: [
        { role: 'system', content: consigneExtraction(options.consigne) },
        {
          role: 'user',
          content: [
            `Portrait d'un seul personnage : ${sujet.nom}. "personnagesVisibles" contient uniquement ce personnage (action et position vides) ; "lieu" reste vide.`,
            `Fiche : ${texteProfil(fiche || sujet.nom, settings)}`,
            race ? `${canonRace(race)}` : '',
            race ? `Traits de race (canon) : ${traitsVisuelsRace(race)}` : '',
            etatTexte ? `État visuel établi :\n${etatTexte}` : '',
          ].filter(Boolean).join('\n\n'),
        },
      ],
    });
    const lu = analyserExtraction(sortie);
    if (lu && lu.extraction.personnagesVisibles.length) {
      return {
        extraction: { ...lu.extraction, personnagesVisibles: [{ ...lu.extraction.personnagesVisibles[0], nom: sujet.nom }] },
        parModele: true,
        brute: sortie.slice(0, 4000),
        rejets: lu.rejets,
      };
    }
    return { extraction: repli(), parModele: false, brute: sortie.slice(0, 4000), rejets: [], erreur: 'Réponse du narrateur illisible : mots-clés de la fiche.' };
  } catch (erreur) {
    if (options.signal?.aborted) throw erreur;
    return { extraction: repli(), parModele: false, rejets: [], erreur: `Narrateur indisponible : ${erreur instanceof Error ? erreur.message : String(erreur)}.` };
  }
}
