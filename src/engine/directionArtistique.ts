import type { AppSettings, StoryState } from '../types';
import { appellerModele, configurationLLM } from './elyndorCloudClient';
import { canonRace, detecterRacePnj } from './racePnj';
import { RACES_ELYNDOR } from '../data/races';
import { filtrerTextePourProfil } from './contenuAdulte';
import {
  PROFILS,
  estProfilCadrage,
  formaterPromptImage,
  personnageSceneVide,
  structureDeRepli,
  type PersonnageScene,
  type ProfilCadrage,
  type PromptImageStructure,
} from './visualBible';
import {
  detecterPersonnagesParRepli,
  lireEtatVisuel,
  listerPnjVisuels,
  resoudrePersonnagesVisibles,
  type ChangementVisuel,
  type EtatVisuelHistoire,
  type PersonnageVisibleResolu,
} from './visualState';

// Direction artistique V2 : le modèle narratif (Elyndor Cloud), qui connaît
// tout le contexte du récit, décide de ce qui est visible, du profil de
// cadrage et rédige chaque section du prompt image. Il propose aussi les
// changements visuels survenus depuis la dernière analyse ; ceux-ci ne sont
// appliqués que s'ils citent un passage réel du récit (visualState.ts).

const MESSAGES_CONTEXTE = 10;
const LONGUEUR_MESSAGE_CONTEXTE = 1400;

export interface DirectionArtistique {
  structure: PromptImageStructure;
  visibles: PersonnageVisibleResolu[];
  changements: ChangementVisuel[];
  /** false si la structure vient du repli local (modèle indisponible). */
  parModele: boolean;
}

const INSTRUCTION_DIRECTION = `Tu es le directeur artistique d'Elyndor. Tu prépares l'illustration de l'instant présent de la scène (la fin du dernier message du narrateur) pour un modèle image qui ne connaît rien de l'histoire.

Règles :
- Distingue personnage MENTIONNÉ, personnage PRÉSENT et personnage VISIBLE dans le cadrage. Seuls les visibles vont dans "personnagesVisibles" ; les présents hors cadre vont dans "horsCadre" ; un simple mentionné n'apparaît nulle part.
- Les figurants sans nom sont permis ("Garde n°1").
- L'ÉTAT VISUEL PERSISTANT fait autorité : ne réinvente ni tenue, ni blessure, ni arme, ni décor. Ne change une apparence que si le récit l'établit.
- "changementsVisuels" : uniquement les changements DURABLES survenus dans les messages récents (tenue, armure, armes visibles, accessoires, coiffure, blessures, cicatrices, sang, poussière, boue, propreté, transformations, objets portés ; pour le décor : lieu, type de lieu, architecture, disposition, heure, météo, lumière, sources lumineuses, dégâts, incendies, portes ouvertes/fermées, objets importants, mobilier, traces). Chaque changement cite dans "evenement" la phrase exacte du récit qui l'établit. Sans citation, n'ajoute pas le changement.
- Choisis le profil de cadrage adapté : dialogue, combat, tension, decouverte, groupe, interieur ou paysage.
- Pas de dialogue, pas de pensées, pas de suite de l'histoire. N'invente rien qui ne soit pas établi.
- "promptSdxl" : la MÊME image résumée EN ANGLAIS pour un modèle SDXL, en étiquettes courtes séparées par des virgules, 60 mots maximum, dans cet ordre : type de plan et angle, nombre de personnages, puis pour chacun son apparence physique précise (race, carnation, cheveux, tenue, blessures, arme), l'action, le décor, la lumière, la météo. Aucun nom propre : SDXL ne connaît pas les personnages.

Champs autorisés pour "champ" :
- personnage : tenue, armure, coiffure, proprete, armesVisibles, accessoires, blessures, cicatrices, salissures, transformations, objetsPortes
- decor : lieu, typeLieu, architecture, disposition, heure, meteo, lumiere, sourcesLumineuses, degats, incendies, ouvertures, objetsImportants, mobilier, traces

Réponds UNIQUEMENT avec ce JSON strict :
{"profil":"dialogue|combat|tension|decouverte|groupe|interieur|paysage",
"personnagesVisibles":[{"nom":"","apparence":"","tenue":"","blessures":"","armesAccessoires":"","posture":"","expression":"","action":""}],
"horsCadre":[""],
"action":"ce qui se passe à cet instant précis",
"decor":{"lieu":"","architecture":"","objetsImportants":"","premierPlan":"","arrierePlan":""},
"continuite":{"aConserver":[""],"changements":[""]},
"camera":{"typePlan":"","angle":"","position":"","profondeur":"","composition":""},
"lumiere":{"source":"","direction":"","intensite":"","heure":"","meteo":""},
"ambiance":{"tension":"","emotion":"","rendu":""},
"promptSdxl":"low angle medium shot, 1 man, ...",
"changementsVisuels":[{"cible":"personnage|decor","nom":"","champ":"","operation":"definir|ajouter|retirer","valeur":"","evenement":"citation exacte"}]}`;

function texteSur(valeur: unknown, max = 400): string {
  const t = typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : '';
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function listeTextes(valeur: unknown, max = 8): string[] {
  return Array.isArray(valeur) ? valeur.map((x) => texteSur(x, 200)).filter(Boolean).slice(0, max) : [];
}

function objetSur(valeur: unknown): Record<string, unknown> {
  return valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
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
      p.tenue && `tenue ${p.tenue}`,
      p.armure && `armure ${p.armure}`,
      p.coiffure && `coiffure ${p.coiffure}`,
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
  const scenes = etat.scenesIllustrees.map((s, i, toutes) => {
    const rang = i === toutes.length - 1 ? 'Dernière scène illustrée' : 'Avant-dernière scène illustrée';
    const noms = s.personnagesVisibles.map((p) => p.nom).join(', ') || 'aucun personnage';
    return `- ${rang} (${s.profil}) : ${noms} — ${s.structure.decor.lieu || 'lieu non précisé'} ; ${texteSur(s.structure.action, 200)}`;
  });
  return [
    `[ÉTAT VISUEL PERSISTANT — PERSONNAGES]\n${personnages.join('\n') || 'Aucun encore.'}`,
    `[ÉTAT VISUEL PERSISTANT — DÉCOR COURANT]\n${decor || 'Aucun encore.'}`,
    `[SCÈNES DÉJÀ ILLUSTRÉES]\n${scenes.join('\n') || 'Aucune.'}`,
  ].join('\n\n');
}

export function construireContexteDirection(story: StoryState, settings: AppSettings): string {
  const etat = lireEtatVisuel(story);
  const raceJoueur = RACES_ELYNDOR.find((r) => r.id === story.meta.raceOrigineId);
  const joueur = `[PERSONNAGE DU JOUEUR — ${story.meta.personnageNom}]\n${texteProfil(story.meta.personnageDescription || 'Aucune fiche.', settings)}`
    + (raceJoueur ? `\n${canonRace({ race: raceJoueur, sexe: 'Autre' })}` : '');
  const pnj = listerPnjVisuels(story)
    .map((e) => {
      // Canon de la race : « elfe noire » se lit sinon « black woman » dans le prompt anglais.
      const race = detecterRacePnj(e.titre, e.contenu);
      return `- ${e.titre} (${e.statut}) : ${texteSur(texteProfil(e.contenu, settings), 300)}${race ? `\n  ${canonRace(race)}` : ''}`;
    })
    .join('\n');
  const contexte = story.meta.contexte;
  const cadre = [contexte?.lieu && `Lieu : ${contexte.lieu}`, contexte?.ambiance && `Ambiance : ${contexte.ambiance}`]
    .filter(Boolean).join('\n');
  const memoire = story.memoire.resume.trim()
    ? `[MÉMOIRE DU RÉCIT]\n${texteSur(texteProfil(story.memoire.resume, settings), 1200)}`
    : '';
  const zones = story.monde.zones.filter((z) => z.niveau === 'active').map((z) => `- ${z.nom} : ${texteSur(z.description, 200)}`);
  const recents = story.messages.slice(-MESSAGES_CONTEXTE).map((m) => {
    const auteur = m.role === 'assistant' ? 'NARRATEUR' : story.meta.personnageNom.toUpperCase();
    return `${auteur} : ${texteSur(texteProfil(m.content, settings), LONGUEUR_MESSAGE_CONTEXTE)}`;
  });
  return [
    joueur,
    `[PNJ CONNUS]\n${pnj || 'Aucun.'}`,
    cadre ? `[CADRE DE L'HISTOIRE]\n${cadre}` : '',
    memoire,
    zones.length ? `[ZONES ACTIVES]\n${zones.join('\n')}` : '',
    decrireEtatVisuel(etat),
    `[MESSAGES RÉCENTS — le dernier message du narrateur est la scène à illustrer]\n${recents.join('\n\n') || texteSur(story.meta.pointDeDepart, 1200)}`,
  ].filter(Boolean).join('\n\n');
}

function extraireJson(sortie: string): Record<string, unknown> | null {
  const match = sortie.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return objetSur(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

function nomCanonique(story: StoryState, nom: string): string | undefined {
  if (!nom) return undefined;
  return resoudrePersonnagesVisibles(story, [nom])[0]?.nom ?? nom;
}

function profilParDefaut(visibles: readonly unknown[]): ProfilCadrage {
  return visibles.length >= 3 ? 'groupe' : 'dialogue';
}

/** Valide et normalise la réponse du directeur artistique. Pur et testable. */
export function analyserReponseDirection(sortie: string, story: StoryState): DirectionArtistique | null {
  const brut = extraireJson(sortie);
  if (!brut) return null;

  const personnagesBruts = Array.isArray(brut.personnagesVisibles) ? brut.personnagesVisibles.map(objetSur) : [];
  const personnagesNommes = personnagesBruts
    .map((p): PersonnageScene => ({
      ...personnageSceneVide(texteSur(p.nom, 80)),
      apparence: texteSur(p.apparence),
      tenue: texteSur(p.tenue),
      blessures: texteSur(p.blessures),
      armesAccessoires: texteSur(p.armesAccessoires),
      posture: texteSur(p.posture, 200),
      expression: texteSur(p.expression, 200),
      action: texteSur(p.action, 300),
    }))
    .filter((p) => p.nom)
    .slice(0, 6);

  const visibles = resoudrePersonnagesVisibles(story, personnagesNommes.map((p) => p.nom));
  // Le nom canonique (fiche) remplace la graphie du modèle pour que l'état
  // visuel et les références retrouvent le même personnage.
  const personnages = personnagesNommes.map((p) => {
    const resolu = resoudrePersonnagesVisibles(story, [p.nom])[0];
    return resolu ? { ...p, nom: resolu.nom } : p;
  }).filter((p, i, tous) => tous.findIndex((x) => x.nom === p.nom) === i);

  const profil = estProfilCadrage(brut.profil) ? brut.profil : profilParDefaut(personnages);
  const decor = objetSur(brut.decor);
  const continuite = objetSur(brut.continuite);
  const camera = objetSur(brut.camera);
  const lumiere = objetSur(brut.lumiere);
  const ambiance = objetSur(brut.ambiance);
  const defauts = PROFILS[profil].camera;

  const structure: PromptImageStructure = {
    profil,
    personnages,
    horsCadre: listeTextes(brut.horsCadre),
    action: texteSur(brut.action, 500),
    decor: {
      lieu: texteSur(decor.lieu),
      architecture: texteSur(decor.architecture),
      objetsImportants: texteSur(decor.objetsImportants),
      premierPlan: texteSur(decor.premierPlan),
      arrierePlan: texteSur(decor.arrierePlan),
    },
    continuite: { aConserver: listeTextes(continuite.aConserver), changements: listeTextes(continuite.changements) },
    camera: {
      typePlan: texteSur(camera.typePlan, 200) || defauts.typePlan,
      angle: texteSur(camera.angle, 200) || defauts.angle,
      position: texteSur(camera.position, 200) || defauts.position,
      profondeur: texteSur(camera.profondeur, 200) || defauts.profondeur,
      composition: texteSur(camera.composition, 200) || defauts.composition,
    },
    lumiere: {
      source: texteSur(lumiere.source, 200),
      direction: texteSur(lumiere.direction, 200),
      intensite: texteSur(lumiere.intensite, 200),
      heure: texteSur(lumiere.heure, 120),
      meteo: texteSur(lumiere.meteo, 120),
    },
    ambiance: {
      tension: texteSur(ambiance.tension, 200),
      emotion: texteSur(ambiance.emotion, 200),
      rendu: texteSur(ambiance.rendu, 200),
    },
    promptSdxl: texteSur(brut.promptSdxl, 600) || undefined,
  };

  const changements: ChangementVisuel[] = (Array.isArray(brut.changementsVisuels) ? brut.changementsVisuels : [])
    .map(objetSur)
    .map((c) => ({
      cible: (c.cible === 'decor' ? 'decor' : 'personnage') as ChangementVisuel['cible'],
      // Même résolveur que les personnages visibles : « Sylvana » et
      // « Sylvana Nocturne » doivent viser la même entrée d'état visuel.
      nom: nomCanonique(story, texteSur(c.nom, 80)),
      champ: texteSur(c.champ, 40),
      operation: (['definir', 'ajouter', 'retirer'].includes(String(c.operation)) ? c.operation : 'definir') as ChangementVisuel['operation'],
      valeur: texteSur(c.valeur, 160),
      evenement: texteSur(c.evenement, 400),
    }))
    .filter((c) => c.champ)
    .slice(0, 24);

  return { structure, visibles, changements, parModele: true };
}

// Consigne permanente : le modèle image ne voit jamais la conversation. Tout
// ce qu'il reçoit est rédigé par le modèle narratif, en anglais, sous la
// forme d'étiquettes courtes adaptées au CLIP de SDXL (77 jetons).
const CONSIGNE_PROMPT_SDXL = `Tu rédiges des prompts pour un modèle d'image Stable Diffusion XL qui ne connaît rien de l'histoire et ne lit bien que l'anglais.
Réponds UNIQUEMENT par le prompt : une seule ligne, en anglais, étiquettes courtes séparées par des virgules, 60 mots maximum.
Aucun nom propre. Décris uniquement ce qui se voit, dans l'ordre : cadrage, sujet(s) et apparence physique précise (race, carnation, âge apparent, cheveux, yeux, tenue, blessures, armes, accessoires), action ou expression, décor, lumière.
N'invente rien qui ne soit pas dans la description fournie.`;

export function nettoyerPromptSdxl(sortie: string): string | undefined {
  const ligne = (sortie.split('\n').map((l) => l.trim()).find(Boolean) ?? '')
    .replace(/^(?:sdxl\s+)?prompt\s*:\s*/i, '')
    .replace(/["`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return ligne ? ligne.slice(0, 600) : undefined;
}

/** Fait rédiger par le modèle narratif un prompt SDXL anglais à partir d'une description. */
export async function redigerPromptSdxl(
  settings: AppSettings,
  description: string,
  cadrage: string,
  signal?: AbortSignal,
  storyId?: string,
): Promise<string | undefined> {
  const sortie = await appellerModele({
    ...configurationLLM(settings),
    storyId,
    temperature: 0.2,
    maxTokens: 200,
    signal,
    messages: [
      { role: 'system', content: CONSIGNE_PROMPT_SDXL },
      { role: 'user', content: `Cadrage imposé : ${cadrage}\n\nDescription :\n${texteProfil(description, settings)}` },
    ],
  });
  return nettoyerPromptSdxl(sortie);
}

/**
 * Prompt anglais d'un portrait (avatar) : fiche du personnage + son état
 * visuel persistant (tenue, blessures, coiffure…), rédigé par le modèle narratif.
 */
export async function redigerPromptPortraitSdxl(
  story: StoryState,
  nom: string,
  fiche: string,
  settings: AppSettings,
): Promise<string | undefined> {
  const persistant = lireEtatVisuel(story).personnages.find((p) => p.nom === nom);
  const etat = persistant
    ? [
        persistant.tenue && `tenue : ${persistant.tenue}`,
        persistant.armure && `armure : ${persistant.armure}`,
        persistant.coiffure && `coiffure : ${persistant.coiffure}`,
        persistant.blessures.length && `blessures : ${persistant.blessures.join(', ')}`,
        persistant.cicatrices.length && `cicatrices : ${persistant.cicatrices.join(', ')}`,
        persistant.transformations.length && `transformations : ${persistant.transformations.join(', ')}`,
        persistant.accessoires.length && `accessoires : ${persistant.accessoires.join(', ')}`,
      ].filter(Boolean).join('\n')
    : '';
  return redigerPromptSdxl(
    settings,
    [`Fiche : ${fiche}`, etat && `État visuel actuel :\n${etat}`].filter(Boolean).join('\n\n'),
    'portrait en buste, cadrage serré visage et épaules, fond sombre uni',
    undefined,
    story.meta.id,
  );
}

/** Repli local, sans appel réseau : ancienne détection par nom. */
export function directionDeRepli(story: StoryState): DirectionArtistique {
  const texteScene = texteDerniereScene(story);
  const visibles = detecterPersonnagesParRepli(story, texteScene);
  const fiches = new Map(listerPnjVisuels(story).map((p) => [p.id, p.contenu]));
  const personnages = visibles.map((v) => ({
    ...personnageSceneVide(v.nom),
    apparence: texteSur(v.type === 'joueur' ? story.meta.personnageDescription : fiches.get(v.assetId ?? '') ?? '', 300),
  }));
  const etat = lireEtatVisuel(story);
  return {
    structure: structureDeRepli({
      profil: profilParDefaut(personnages),
      personnages,
      texteScene,
      lieu: etat.decor?.lieu || story.meta.contexte?.lieu || '',
    }),
    visibles,
    changements: [],
    parModele: false,
  };
}

export async function demanderDirectionArtistique(
  story: StoryState,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<DirectionArtistique> {
  try {
    const sortie = await appellerModele({
      ...configurationLLM(settings),
      storyId: story.meta.id,
      temperature: 0.3,
      maxTokens: 1600,
      signal,
      messages: [
        { role: 'system', content: construireContexteDirection(story, settings) },
        { role: 'user', content: INSTRUCTION_DIRECTION },
      ],
    });
    const direction = analyserReponseDirection(sortie, story);
    if (direction && (direction.structure.personnages.length > 0 || direction.structure.action)) {
      // Le joueur est un personnage établi : sa fiche complète l'apparence
      // quand le modèle ne l'a pas redite.
      const fiche = texteSur(story.meta.personnageDescription, 300);
      direction.structure.personnages = direction.structure.personnages.map((p) =>
        p.nom === story.meta.personnageNom && !p.apparence ? { ...p, apparence: fiche } : p,
      );
      if (!direction.structure.promptSdxl) {
        // Consigne permanente : le prompt image est toujours rédigé par le
        // modèle narratif ; s'il l'a omis, on le lui redemande à partir de
        // sa propre direction artistique.
        direction.structure.promptSdxl = await redigerPromptSdxl(
          settings,
          formaterPromptImage(direction.structure).split('[STYLE VISUEL]')[0],
          `${direction.structure.camera.typePlan}, ${direction.structure.camera.angle}`,
          signal,
          story.meta.id,
        ).catch(() => undefined);
      }
      return direction;
    }
  } catch (erreur) {
    if (signal?.aborted) throw erreur;
    // Modèle indisponible : on illustre quand même avec le repli local.
  }
  return directionDeRepli(story);
}
