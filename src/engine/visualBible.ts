import type { EtatVisuelDecor, EtatVisuelHistoire, EtatVisuelPersonnage, ModeIllustration, ReferenceVisuelle } from './visualState';
import { normaliserVisuel } from './visualState';

// Bible visuelle Elyndor et format du prompt image structuré (V2).
//
// Le modèle narratif reste le directeur artistique : il remplit une
// PromptImageStructure à partir de tout le contexte du récit. Ce module
// fournit ce qui ne doit PAS varier d'une génération à l'autre : la bible de
// style, les profils de cadrage, les contraintes négatives et la mise en
// forme finale, en sections fixes, envoyée au modèle image.

export type ProfilCadrage = 'dialogue' | 'combat' | 'tension' | 'decouverte' | 'groupe' | 'interieur' | 'paysage';

export const PROFILS_CADRAGE: readonly ProfilCadrage[] = [
  'dialogue', 'combat', 'tension', 'decouverte', 'groupe', 'interieur', 'paysage',
];

export interface CameraScene {
  typePlan: string;
  angle: string;
  position: string;
  profondeur: string;
  composition: string;
}

interface DefinitionProfil {
  libelle: string;
  intention: string;
  camera: CameraScene;
  /** Variantes utilisées par la régénération ciblée (sans toucher au canon). */
  plansAlternatifs: string[];
  anglesAlternatifs: string[];
  compositionsAlternatives: string[];
}

export const PROFILS: Record<ProfilCadrage, DefinitionProfil> = {
  dialogue: {
    libelle: 'Dialogue',
    intention: 'plans rapprochés, regards, tension entre les personnages, composition lisible',
    camera: {
      typePlan: 'plan rapproché poitrine sur deux personnages',
      angle: 'à hauteur des yeux, légèrement de trois-quarts',
      position: 'par-dessus l’épaule d’un des interlocuteurs',
      profondeur: 'faible profondeur de champ, arrière-plan doux mais lisible',
      composition: 'asymétrique, regards qui se croisent, amorce d’épaule en premier plan',
    },
    plansAlternatifs: ['gros plan expressif sur le visage qui parle', 'plan moyen à deux, cadrage serré', 'plan américain'],
    anglesAlternatifs: ['légère contre-plongée sur le personnage dominant', 'profil strict des deux visages', 'plongée légère sur le personnage en position de faiblesse'],
    compositionsAlternatives: ['champ-contrechamp avec amorce floue', 'les deux personnages aux extrémités du cadre, vide tendu entre eux', 'personnage principal décentré, interlocuteur en arrière-plan net'],
  },
  combat: {
    libelle: 'Combat',
    intention: 'caméra dynamique, angle bas ou latéral, mouvement, premier plan fort, lecture claire de l’action',
    camera: {
      typePlan: 'plan moyen dynamique',
      angle: 'contre-plongée basse',
      position: 'au ras du sol, proche de l’action',
      profondeur: 'premier plan fort (arme, débris, main), action nette au centre',
      composition: 'diagonales marquées, mouvement figé à l’instant décisif',
    },
    plansAlternatifs: ['plan large lisible de l’affrontement', 'plan rapproché sur l’impact', 'plan moyen latéral en travelling'],
    anglesAlternatifs: ['angle latéral à hauteur de hanche', 'contre-plongée extrême', 'plongée verticale sur le combat'],
    compositionsAlternatives: ['adversaires sur une diagonale ascendante', 'arme en amorce au premier plan, combattants derrière', 'silhouettes à contre-jour au premier tiers'],
  },
  tension: {
    libelle: 'Tension',
    intention: 'cadrage déséquilibré, profondeur, espace négatif, élément menaçant partiellement visible',
    camera: {
      typePlan: 'plan moyen avec large espace négatif',
      angle: 'légèrement incliné (dutch angle discret)',
      position: 'à distance, comme un observateur caché',
      profondeur: 'grande profondeur, menace partiellement visible dans l’ombre',
      composition: 'personnage excentré, vide oppressant dans le reste du cadre',
    },
    plansAlternatifs: ['gros plan sur un regard aux aguets', 'plan large écrasant le personnage', 'plan rapproché de dos'],
    anglesAlternatifs: ['plongée inquiétante', 'contre-plongée sous un élément menaçant', 'à travers un obstacle (barreaux, branches, porte entrouverte)'],
    compositionsAlternatives: ['menace en amorce floue au premier plan', 'personnage minuscule dans un coin, ombre envahissante', 'lignes de fuite convergeant vers la menace'],
  },
  decouverte: {
    libelle: 'Découverte',
    intention: 'plan large, personnage replacé dans l’environnement, échelle du lieu',
    camera: {
      typePlan: 'plan large',
      angle: 'légère contre-plongée vers le lieu découvert',
      position: 'derrière le personnage, qui découvre le lieu',
      profondeur: 'personnage au premier plan, lieu monumental en profondeur',
      composition: 'règle des tiers, silhouette donnant l’échelle',
    },
    plansAlternatifs: ['très grand plan d’ensemble', 'plan moyen de dos face au lieu', 'plan large en plongée'],
    anglesAlternatifs: ['plongée depuis un surplomb', 'contre-plongée vertigineuse', 'à hauteur des yeux, frontal'],
    compositionsAlternatives: ['silhouette centrée, symétrie monumentale', 'personnage en bas de cadre, lieu dominant', 'amorce de décor en premier plan, lieu en profondeur'],
  },
  groupe: {
    libelle: 'Groupe',
    intention: 'composition permettant d’identifier les personnages principaux, sans personnage dupliqué ni fusionné',
    camera: {
      typePlan: 'plan moyen d’ensemble',
      angle: 'à hauteur des yeux',
      position: 'face au groupe, légèrement décalée',
      profondeur: 'personnages étagés sur plusieurs plans de profondeur',
      composition: 'chaque personnage principal distinct et lisible, espacements clairs',
    },
    plansAlternatifs: ['plan large du groupe dans son environnement', 'plan américain sur le groupe', 'plan moyen serré sur les personnages principaux'],
    anglesAlternatifs: ['légère contre-plongée héroïque', 'légère plongée', 'trois-quarts latéral'],
    compositionsAlternatives: ['groupe en arc de cercle', 'personnages en profondeur sur une ligne de fuite', 'personnage principal au premier plan, groupe derrière'],
  },
  interieur: {
    libelle: 'Intérieur',
    intention: 'profondeur de décor, lumière motivée, environnement cohérent',
    camera: {
      typePlan: 'plan moyen',
      angle: 'à hauteur des yeux',
      position: 'dans un coin de la pièce pour révéler sa profondeur',
      profondeur: 'pièce lisible du premier plan au fond',
      composition: 'lumière motivée par une source visible (fenêtre, feu, lampe)',
    },
    plansAlternatifs: ['plan large de la pièce', 'plan rapproché près de la source lumineuse', 'plan moyen depuis l’embrasure d’une porte'],
    anglesAlternatifs: ['légère plongée depuis une mezzanine', 'contre-plongée sous les poutres', 'frontal symétrique'],
    compositionsAlternatives: ['cadre dans le cadre (porte, fenêtre)', 'mobilier en amorce au premier plan', 'personnage à contre-jour devant la source lumineuse'],
  },
  paysage: {
    libelle: 'Paysage',
    intention: 'plan large cinématographique, forte lecture de l’espace',
    camera: {
      typePlan: 'très grand plan d’ensemble',
      angle: 'à hauteur d’homme',
      position: 'sur une hauteur dominant le paysage',
      profondeur: 'plans successifs jusqu’à l’horizon',
      composition: 'horizon au tiers, élément fort en premier plan',
    },
    plansAlternatifs: ['plan large avec silhouette minuscule', 'plan d’ensemble depuis le sol', 'plan large panoramique'],
    anglesAlternatifs: ['contre-plongée vers le ciel', 'plongée aérienne', 'rasant au sol'],
    compositionsAlternatives: ['horizon bas, ciel dominant', 'ligne de chemin guidant le regard', 'élément de premier plan en amorce latérale'],
  },
};

export const BIBLE_VISUELLE_ELYNDOR: readonly string[] = [
  'cinéma brutal, nerveux, expressif et très composé, inspiré du langage visuel de Quentin Tarantino — sans reproduire aucun film, plan ou personnage existant',
  'cadrages audacieux : contre-plongées, plans larges très lisibles, gros plans expressifs, compositions asymétriques',
  'profondeur de champ et premier plan fort',
  'personnages saisis en mouvement plutôt qu’en pose, tension visuelle',
  'éclairage cinématographique, contrastes marqués, ombres profondes, lumière chaude ou dramatique selon la scène',
  'couleurs riches, texture peinte haut de gamme, dark fantasy réaliste',
  'sensation d’un photogramme extrait d’un film, format cinéma 16:9',
];

export const STYLE_PORTRAIT_ELYNDOR =
  'peinture numérique haut de gamme, dark fantasy réaliste, éclairage cinématographique contrasté, ombres profondes, couleurs riches, portrait en buste, fond sombre uni, sans texte, sans logo, sans watermark, sans signature';

export const CONTRAINTES_NEGATIVES: Readonly<Record<string, readonly string[]>> = {
  'Rendu': ['texte dans l’image', 'logo', 'watermark', 'signature'],
  'Personnages': [
    'personnages dupliqués', 'fusion de deux personnages', 'mauvais visage',
    'changement arbitraire de race', 'changement arbitraire de carnation', 'changement arbitraire de tenue',
  ],
  'Objets': ['accessoires inventés', 'armes inventées', 'objets flottants'],
  'Anatomie': ['membres supplémentaires', 'mains aberrantes', 'anatomie incohérente', 'visages déformés'],
  'Continuité': ['changements de décor non justifiés', 'incohérences avec les références fournies'],
};

export function negatifAplati(): string {
  return Object.values(CONTRAINTES_NEGATIVES).flat().join(', ');
}

// ---------------------------------------------------------------------------
// Structure du prompt image
// ---------------------------------------------------------------------------

export interface PersonnageScene {
  nom: string;
  apparence: string;
  tenue: string;
  blessures: string;
  armesAccessoires: string;
  posture: string;
  expression: string;
  action: string;
}

export interface PromptImageStructure {
  profil: ProfilCadrage;
  personnages: PersonnageScene[];
  /** Personnages présents dans la scène mais hors du cadrage. */
  horsCadre: string[];
  action: string;
  decor: {
    lieu: string;
    architecture: string;
    objetsImportants: string;
    premierPlan: string;
    arrierePlan: string;
  };
  continuite: { aConserver: string[]; changements: string[] };
  camera: CameraScene;
  lumiere: { source: string; direction: string; intensite: string; heure: string; meteo: string };
  ambiance: { tension: string; emotion: string; rendu: string };
}

export const SECTIONS_PROMPT_IMAGE = [
  '[TYPE DE SCÈNE]',
  '[PERSONNAGES VISIBLES]',
  '[ACTION EXACTE]',
  '[DÉCOR]',
  '[CONTINUITÉ VISUELLE]',
  '[CAMÉRA / CADRAGE]',
  '[LUMIÈRE]',
  '[AMBIANCE]',
  '[STYLE VISUEL]',
  '[CONTRAINTES NÉGATIVES]',
] as const;

export function estProfilCadrage(valeur: unknown): valeur is ProfilCadrage {
  return typeof valeur === 'string' && (PROFILS_CADRAGE as readonly string[]).includes(valeur);
}

function joindre(liste: readonly string[]): string {
  return liste.map((x) => x.trim()).filter(Boolean).join(', ');
}

function ligne(libelle: string, valeur: string): string | null {
  const v = valeur.trim();
  return v ? `- ${libelle} : ${v}` : null;
}

/**
 * L'état visuel persistant fait autorité sur l'apparence courante : ce que
 * le modèle propose ne complète que les champs que l'état ne connaît pas.
 */
export function consoliderAvecEtatVisuel(
  structure: PromptImageStructure,
  etat: EtatVisuelHistoire,
): PromptImageStructure {
  const parCle = new Map<string, EtatVisuelPersonnage>(etat.personnages.map((p) => [p.cle, p]));
  const personnages = structure.personnages.map((p) => {
    const persistant = parCle.get(normaliserVisuel(p.nom));
    if (!persistant) return p;
    const tenue = joindre([persistant.tenue, persistant.armure]) || p.tenue;
    const blessures = joindre([
      ...persistant.blessures,
      ...persistant.cicatrices.map((c) => `cicatrice : ${c}`),
      ...persistant.salissures,
      persistant.proprete,
    ]) || p.blessures;
    const armesAccessoires = joindre([
      ...persistant.armesVisibles, ...persistant.accessoires, ...persistant.objetsPortes,
    ]) || p.armesAccessoires;
    const apparence = joindre([
      p.apparence,
      persistant.coiffure ? `coiffure : ${persistant.coiffure}` : '',
      ...persistant.transformations,
    ]);
    return { ...p, tenue, blessures, armesAccessoires, apparence };
  });
  const decor = etat.decor ? completerDecor(structure.decor, etat.decor) : structure.decor;
  const lumiere = etat.decor
    ? {
        ...structure.lumiere,
        heure: etat.decor.heure || structure.lumiere.heure,
        meteo: etat.decor.meteo || structure.lumiere.meteo,
        source: joindre(etat.decor.sourcesLumineuses) || etat.decor.lumiere || structure.lumiere.source,
      }
    : structure.lumiere;
  return { ...structure, personnages, decor, lumiere };
}

function completerDecor(decor: PromptImageStructure['decor'], persistant: EtatVisuelDecor): PromptImageStructure['decor'] {
  const etatDuLieu = joindre([
    ...persistant.degats, ...persistant.incendies, ...persistant.ouvertures, ...persistant.traces,
  ]);
  return {
    // Le canon persistant prime ; le modèle ne complète que l'inconnu.
    lieu: joindre([persistant.lieu, persistant.typeLieu]) || decor.lieu,
    architecture: joindre([persistant.architecture || decor.architecture, persistant.disposition]),
    objetsImportants: joindre([decor.objetsImportants, ...persistant.objetsImportants, ...persistant.mobilier, etatDuLieu]),
    premierPlan: decor.premierPlan,
    arrierePlan: decor.arrierePlan,
  };
}

/** Variante de mise en scène pour une régénération : le canon reste identique. */
export function appliquerModeRegeneration(
  structure: PromptImageStructure,
  mode: ModeIllustration,
  variante: number,
): PromptImageStructure {
  const profil = PROFILS[structure.profil] ?? PROFILS.dialogue;
  const choisir = (liste: string[]) => liste[Math.abs(variante) % liste.length];
  const camera = { ...structure.camera };
  if (mode === 'autre-cadrage') camera.typePlan = choisir(profil.plansAlternatifs);
  else if (mode === 'autre-angle') camera.angle = choisir(profil.anglesAlternatifs);
  else if (mode === 'autre-composition') camera.composition = choisir(profil.compositionsAlternatives);
  else if (mode !== 'regenerer') return structure;
  const consigne = 'même moment narratif, mêmes personnages, mêmes apparences, mêmes vêtements, mêmes blessures, même lieu, mêmes objets : seule la mise en scène change';
  const aConserver = structure.continuite.aConserver.includes(consigne)
    ? structure.continuite.aConserver
    : [...structure.continuite.aConserver, consigne];
  return { ...structure, camera, continuite: { ...structure.continuite, aConserver } };
}

/**
 * Mise en forme finale du prompt envoyé au modèle image, en sections fixes.
 * Les références sont nommées pour que le générateur sache quel visage ou
 * quelle scène chaque image représente.
 */
export function formaterPromptImage(
  structure: PromptImageStructure,
  references: readonly ReferenceVisuelle[] = [],
): string {
  const profil = PROFILS[structure.profil] ?? PROFILS.dialogue;
  const blocs: string[] = [];

  blocs.push(`[TYPE DE SCÈNE]\n${profil.libelle} — ${profil.intention}`);

  const personnages = structure.personnages.length
    ? structure.personnages.map((p) => [
        `- ${p.nom}`,
        ligne('  apparence', p.apparence),
        ligne('  tenue actuelle', p.tenue),
        ligne('  blessures', p.blessures),
        ligne('  armes/accessoires', p.armesAccessoires),
        ligne('  posture', p.posture),
        ligne('  expression', p.expression),
      ].filter(Boolean).join('\n')).join('\n')
    : '- aucun personnage visible (plan de décor)';
  const horsCadre = structure.horsCadre.length
    ? `\nPrésents mais hors cadre (ne pas les représenter) : ${joindre(structure.horsCadre)}`
    : '';
  blocs.push(`[PERSONNAGES VISIBLES]\n${personnages}${horsCadre}`);

  const actions = structure.personnages
    .filter((p) => p.action.trim())
    .map((p) => `- ${p.nom} : ${p.action.trim()}`);
  if (structure.action.trim()) actions.unshift(`- ${structure.action.trim()}`);
  blocs.push(`[ACTION EXACTE]\n${actions.length ? actions.join('\n') : '- instant figé de la scène décrite'}`);

  blocs.push(`[DÉCOR]\n${[
    ligne('lieu', structure.decor.lieu),
    ligne('architecture', structure.decor.architecture),
    ligne('objets importants', structure.decor.objetsImportants),
    ligne('premier plan', structure.decor.premierPlan),
    ligne('arrière-plan', structure.decor.arrierePlan),
  ].filter(Boolean).join('\n') || '- décor établi par les scènes précédentes'}`);

  const continuite = [
    ...structure.continuite.aConserver.map((x) => `- à conserver : ${x}`),
    ...structure.continuite.changements.map((x) => `- changement survenu : ${x}`),
  ];
  const refs = references.map((ref, i) => `- image de référence ${i + 1} : ${ref.libelle}`);
  if (refs.length) {
    continuite.push('- références fournies (les références de personnages priment ; les scènes précédentes ne servent qu’à la continuité du décor, de la lumière et de l’ambiance) :', ...refs);
  }
  blocs.push(`[CONTINUITÉ VISUELLE]\n${continuite.length ? continuite.join('\n') : '- première illustration de cette histoire'}`);

  blocs.push(`[CAMÉRA / CADRAGE]\n${[
    ligne('type de plan', structure.camera.typePlan),
    ligne('angle', structure.camera.angle),
    ligne('position caméra', structure.camera.position),
    ligne('profondeur', structure.camera.profondeur),
    ligne('composition', structure.camera.composition),
    '- format : 16:9 cinéma, horizontal',
  ].filter(Boolean).join('\n')}`);

  blocs.push(`[LUMIÈRE]\n${[
    ligne('source', structure.lumiere.source),
    ligne('direction', structure.lumiere.direction),
    ligne('intensité', structure.lumiere.intensite),
    ligne('heure', structure.lumiere.heure),
    ligne('météo', structure.lumiere.meteo),
  ].filter(Boolean).join('\n') || '- lumière cinématographique motivée par le décor'}`);

  blocs.push(`[AMBIANCE]\n${[
    ligne('tension', structure.ambiance.tension),
    ligne('émotion', structure.ambiance.emotion),
    ligne('rendu', structure.ambiance.rendu || 'cinématographique'),
  ].filter(Boolean).join('\n')}`);

  blocs.push(`[STYLE VISUEL]\n${BIBLE_VISUELLE_ELYNDOR.map((x) => `- ${x}`).join('\n')}`);

  blocs.push(`[CONTRAINTES NÉGATIVES]\n${Object.entries(CONTRAINTES_NEGATIVES)
    .map(([groupe, liste]) => `- ${groupe} : ${liste.join(', ')}`)
    .join('\n')}`);

  return blocs.join('\n\n');
}

export function personnageSceneVide(nom: string): PersonnageScene {
  return { nom, apparence: '', tenue: '', blessures: '', armesAccessoires: '', posture: '', expression: '', action: '' };
}

/** Structure minimale quand le directeur artistique n'a pas pu répondre. */
export function structureDeRepli(params: {
  profil: ProfilCadrage;
  personnages: PersonnageScene[];
  texteScene: string;
  lieu: string;
}): PromptImageStructure {
  return {
    profil: params.profil,
    personnages: params.personnages,
    horsCadre: [],
    action: params.texteScene.replace(/\s+/g, ' ').trim().slice(0, 500),
    decor: { lieu: params.lieu, architecture: '', objetsImportants: '', premierPlan: '', arrierePlan: '' },
    continuite: { aConserver: [], changements: [] },
    camera: { ...PROFILS[params.profil].camera },
    lumiere: { source: '', direction: '', intensite: '', heure: '', meteo: '' },
    ambiance: { tension: '', emotion: '', rendu: 'cinématographique' },
  };
}
