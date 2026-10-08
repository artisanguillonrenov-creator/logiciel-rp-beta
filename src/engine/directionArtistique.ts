import type { AppSettings, StoryState } from '../types';
import { appellerModele, configurationLLM } from './elyndorCloudClient';
import { canonRace, detecterRacePnj } from './racePnj';
import { ROLES_CANON } from './canonElyndor';
import { prenomRole } from './rolesCanon';
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
const MESSAGES_CONTEXTE_ALLEGE = 4;
const LONGUEUR_MESSAGE_CONTEXTE = 1400;

// Avec le contexte complet du narrateur, la direction artistique est une
// pause dans le récit : la consigne le dit avant les règles habituelles.
const PAUSE_NARRATION = `[PAUSE DANS LE RÉCIT — ILLUSTRATION]
Tu n'écris pas la suite de l'histoire. Tu illustres la scène que tu viens d'écrire (ton dernier message), avec tout ce que tu sais : lore, mémoire, fiche de scène, rôles fixés par le lore, fiches des personnages. L'apparence d'un personnage vient de sa fiche ou du lore (race, âge, carnation, cheveux, tenue) : ne l'invente jamais quand elle y figure.`;

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
- L'apparence et la tenue d'un personnage viennent de sa fiche ou du lore (personnages du lore, PNJ connus) tant que le récit n'en établit pas d'autres : reprends-les mot pour mot (matières, couleurs, coupe), n'en invente pas une générique.
- "changementsVisuels" : uniquement les changements DURABLES survenus dans les messages récents (tenue, armure, armes visibles, accessoires, coiffure, blessures, cicatrices, sang, poussière, boue, propreté, transformations, objets portés ; pour le décor : lieu, type de lieu, architecture, disposition, heure, météo, lumière, sources lumineuses, dégâts, incendies, portes ouvertes/fermées, objets importants, mobilier, traces). Chaque changement cite dans "evenement" la phrase exacte du récit qui l'établit. Sans citation, n'ajoute pas le changement.
- Choisis le profil de cadrage adapté : dialogue, combat, tension, decouverte, groupe, interieur ou paysage.
- Pas de dialogue, pas de pensées, pas de suite de l'histoire. N'invente rien qui ne soit pas établi.
- "promptSdxl" : la MÊME image pour le modèle image (Lustify SDXL, encodeur CLIP), EN ANGLAIS et en MOTS CLÉS séparés par des virgules, jamais en phrases, 40 à 70 mots, du plus important au moins important (CLIP lit ~75 jetons et pèse surtout les premiers), dans cet ordre :
  1. cadrage et angle (ex. "low angle medium shot") ;
  2. nombre de personnages visibles (ex. "1 woman, 1 man"), puis chacun décrit de GAUCHE à DROITE dans le cadre, dans le même ordre que "personnagesVisibles" (chaque visage de référence est placé dans sa bande, de gauche à droite) ;
  3. pour chacun : race, sexe, âge apparent adulte en chiffre, OBLIGATOIRE pour chaque personnage, écrit « N years old » (celui qu'il paraît selon sa fiche, jamais moins de 20) suivi des marques visibles de cet âge (« 45 years old, mature, crow's feet » ; « 60 years old, wrinkles, grey hair »), carnation exacte, morphologie, cheveux, yeux, expression ; tenue précise (matières, couleurs, état) ou nudité nommée explicitement avec ce qui est visible ; blessures, sang ; armes et accessoires ;
  4. l'action et l'interaction physique, en mots clés (ex. "slashing with katana", "kissing", "holding hands") ;
  5. le décor : lieu, matériaux, objets ;
  6. la lumière : sources, couleur.
  Pour renforcer un détail essentiel qui se perd, la syntaxe est (mot clé)1.3 — jamais (mot:1.3). Des mots concrets et visuels, jamais de termes vagues (beautiful, epic, amazing), pas d'articles ni de mots de liaison. Aucun nom propre : le modèle ne connaît pas les personnages.

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
"promptSdxl":"low angle medium shot, 1 man, adult human man, 45 years old, scarred face, dented plate armor, ...",
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

/**
 * allege : le contexte complet du narrateur est déjà fourni (personnage,
 * mémoire, lore, fiche de scène) ; seuls restent les PNJ avec le canon de
 * leur race, l'état visuel et les derniers messages.
 */
// Titres qui ne désignent personne en particulier (« mon maître »).
const TITRES = /^(ma[iî]tre|ma[iî]tresse|chef|dame|sir|seigneur|messire|capitaine|p[èe]re|m[èe]re|fr[èe]re|s[œo]eur)$/i;

/** Personnage nommé dans la scène : titre complet, ou premier mot s'il n'est pas un simple titre. */
function pnjDansLaScene(titre: string, texteSceneMinuscule: string): boolean {
  const t = titre.trim().toLowerCase();
  if (!t) return false;
  if (texteSceneMinuscule.includes(t)) return true;
  const mots = t.split(/\s+/);
  return mots.length > 1 && mots[0].length > 2 && !TITRES.test(mots[0]) && texteSceneMinuscule.includes(mots[0]);
}

export function construireContexteDirection(story: StoryState, settings: AppSettings, allege = false): string {
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
  const recents = story.messages.slice(allege ? -MESSAGES_CONTEXTE_ALLEGE : -MESSAGES_CONTEXTE).map((m) => {
    const auteur = m.role === 'assistant' ? 'NARRATEUR' : story.meta.personnageNom.toUpperCase();
    return `${auteur} : ${texteSur(texteProfil(m.content, settings), LONGUEUR_MESSAGE_CONTEXTE)}`;
  });
  const scene = `[MESSAGES RÉCENTS — le dernier message du narrateur est la scène à illustrer]\n${recents.join('\n\n') || texteSur(story.meta.pointDeDepart, 1200)}`;
  if (allege) {
    const race = raceJoueur ? `[RACE DE ${story.meta.personnageNom}]\n${canonRace({ race: raceJoueur, sexe: 'Autre' })}` : '';
    // Seuls les personnages de la scène à illustrer : une fiche ancienne
    // (« Maître Kael… robe noire ») déteignait sur la maîtresse de guilde.
    const texteScene = [texteDerniereScene(story), ...(story.scene?.presents ?? [])].join('\n').toLowerCase();
    const pnjScene = listerPnjVisuels(story)
      .filter((e) => pnjDansLaScene(e.titre, texteScene))
      .map((e) => {
        const raceE = detecterRacePnj(e.titre, e.contenu);
        return `- ${e.titre} : ${texteSur(texteProfil(e.contenu, settings), 400)}${raceE ? `\n  ${canonRace(raceE)}` : ''}`;
      })
      .join('\n');
    // Personnages fixés par le lore présents dans la scène, description entière.
    const canon = ROLES_CANON
      .filter((r) => new RegExp(`\\b${prenomRole(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(texteScene))
      .map((r) => `- ${r.nom} (${r.libelle}, ${r.ville}) : ${r.description}`)
      .join('\n');
    return [
      race,
      canon ? `[PERSONNAGES DU LORE DANS LA SCÈNE — apparence et tenue officielles, font autorité]\n${canon}` : '',
      `[PNJ DE LA SCÈNE]\n${pnjScene || 'Aucun.'}`,
      decrireEtatVisuel(etat),
      scene,
    ].filter(Boolean).join('\n\n');
  }
  return [
    joueur,
    `[PNJ CONNUS]\n${pnj || 'Aucun.'}`,
    cadre ? `[CADRE DE L'HISTOIRE]\n${cadre}` : '',
    memoire,
    zones.length ? `[ZONES ACTIVES]\n${zones.join('\n')}` : '',
    decrireEtatVisuel(etat),
    scene,
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
    promptSdxl: texteSur(brut.promptSdxl, 1400) || undefined,
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
const CONSIGNE_PROMPT_SDXL = `Tu rédiges des prompts pour un modèle d'image (Lustify SDXL, encodeur CLIP) qui ne connaît rien de l'histoire et ne lit bien que l'anglais.
Réponds UNIQUEMENT par le prompt : une seule ligne, en anglais, en MOTS CLÉS séparés par des virgules, jamais en phrases, 40 à 70 mots, du plus important au moins important (CLIP pèse surtout les premiers mots).
Aucun nom propre. Décris uniquement ce qui se voit, dans l'ordre : cadrage et angle ; nombre de sujets ; pour chacun race, sexe, âge apparent adulte en chiffre, OBLIGATOIRE pour chaque personnage, écrit « N years old » (celui qu'il paraît selon sa fiche, jamais moins de 20) suivi des marques visibles de cet âge (« 45 years old, mature, crow's feet » ; « 60 years old, wrinkles, grey hair »), carnation exacte, morphologie, cheveux, yeux, expression, tenue précise (matières, couleurs, état) ou nudité nommée explicitement, blessures, armes, accessoires ; action et interaction physique ; décor ; lumière.
Pour renforcer un détail essentiel, la syntaxe est (mot clé)1.3 — jamais (mot:1.3). Des mots concrets et visuels, jamais de termes vagues (beautiful, epic, amazing), pas d'articles ni de mots de liaison. N'invente rien qui ne soit pas dans la description fournie.`;

const MOTS_MIN_PROMPT_SDXL = 25;

export function promptSdxlTropCourt(prompt: string | undefined): boolean {
  return !prompt || prompt.split(/\s+/).filter(Boolean).length < MOTS_MIN_PROMPT_SDXL;
}

export function nettoyerPromptSdxl(sortie: string): string | undefined {
  const ligne = (sortie.split('\n').map((l) => l.trim()).find(Boolean) ?? '')
    .replace(/^(?:sdxl\s+)?prompt\s*:\s*/i, '')
    .replace(/["`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return ligne ? ligne.slice(0, 1400) : undefined;
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
    maxTokens: 420,
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

/** Messages de l'appel : contexte complet du narrateur quand il est fourni. */
export function messagesDirection(story: StoryState, settings: AppSettings, contexteNarrateur?: string) {
  if (!contexteNarrateur) {
    return [
      { role: 'system' as const, content: construireContexteDirection(story, settings) },
      { role: 'user' as const, content: INSTRUCTION_DIRECTION },
    ];
  }
  return [
    { role: 'system' as const, content: contexteNarrateur },
    { role: 'user' as const, content: `${construireContexteDirection(story, settings, true)}\n\n${PAUSE_NARRATION}\n\n${INSTRUCTION_DIRECTION}` },
    // Réponse amorcée par le début du JSON : sans elle, Euryale refusait
    // une fois sur deux (« Je ne peux pas créer… ») et l'illustration
    // retombait sur le repli local.
    { role: 'assistant' as const, content: AMORCE_DIRECTION },
  ];
}

const AMORCE_DIRECTION = '{"profil":"';

/** Le serveur renvoie l'amorce avec la suite, ou la suite seule selon les moteurs. */
export function completerAmorce(sortie: string, amorcee: boolean): string {
  return amorcee && !sortie.trimStart().startsWith('{') ? `${AMORCE_DIRECTION}${sortie}` : sortie;
}

export async function demanderDirectionArtistique(
  story: StoryState,
  settings: AppSettings,
  signal?: AbortSignal,
  contexteNarrateur?: string,
): Promise<DirectionArtistique> {
  try {
    const demander = async (temperature: number) => completerAmorce(await appellerModele({
      ...configurationLLM(settings),
      storyId: story.meta.id,
      temperature,
      maxTokens: 1600,
      signal,
      diagnosticLabel: 'Direction artistique',
      messages: messagesDirection(story, settings, contexteNarrateur),
    }), !!contexteNarrateur);
    // Un refus ou un JSON illisible : un second essai, le contexte est en cache.
    const direction = analyserReponseDirection(await demander(0.3), story)
      ?? analyserReponseDirection(await demander(0.6), story);
    if (direction && (direction.structure.personnages.length > 0 || direction.structure.action)) {
      // Le joueur est un personnage établi : sa fiche complète l'apparence
      // quand le modèle ne l'a pas redite.
      const fiche = texteSur(story.meta.personnageDescription, 300);
      direction.structure.personnages = direction.structure.personnages.map((p) =>
        p.nom === story.meta.personnageNom && !p.apparence ? { ...p, apparence: fiche } : p,
      );
      if (promptSdxlTropCourt(direction.structure.promptSdxl)) {
        // Consigne permanente : le prompt image est toujours rédigé par le
        // modèle narratif ; s'il l'a omis ou bâclé (quelques mots au lieu de
        // 40 à 70 mots clés), on le lui redemande à partir de sa propre
        // direction artistique, qui contient tous les détails.
        direction.structure.promptSdxl = await redigerPromptSdxl(
          settings,
          formaterPromptImage(direction.structure).split('[STYLE VISUEL]')[0],
          `${direction.structure.camera.typePlan}, ${direction.structure.camera.angle}`,
          signal,
          story.meta.id,
        ).catch(() => undefined) ?? direction.structure.promptSdxl;
      }
      return direction;
    }
  } catch (erreur) {
    if (signal?.aborted) throw erreur;
    // Modèle indisponible : on illustre quand même avec le repli local.
  }
  return directionDeRepli(story);
}
