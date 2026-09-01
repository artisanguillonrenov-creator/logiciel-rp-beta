import type { ToolDefinition } from './openrouter';

// Permissions différenciées par composant (brief Phase 2) : chaque pipeline
// (monde, social...) ne reçoit que les outils de son propre domaine — voir
// outilsPourComposant ci-dessous, utilisé par worldSimulation.ts et
// socialDynamics.ts pour composer l'appel avec le seul sous-ensemble
// pertinent.
const OUTILS_MONDE: ToolDefinition[] = [
  {
    composant: 'monde',
    nom: 'definir_zone',
    description: "Établit ou met à jour un lieu où la scène se déroule (actuel ou seulement mentionné).",
    parametres: {
      nom: { type: 'string', description: 'Nom du lieu' },
      description: { type: 'string', description: 'État actuel du lieu, en une phrase' },
    },
    requis: ['nom', 'description'],
  },
  {
    composant: 'monde',
    nom: 'poser_flag',
    description: 'Établit un état binaire durable du monde explicitement établi par le texte (ex: pont_effondre).',
    parametres: {
      nom: { type: 'string', description: 'Identifiant court en snake_case' },
      valeur: { type: 'boolean' },
    },
    requis: ['nom', 'valeur'],
  },
  {
    composant: 'monde',
    nom: 'ajuster_compteur',
    description: 'Ajoute un delta (positif ou négatif) à un compteur numérique narrativement significatif (ex: jours_ecoules).',
    parametres: {
      nom: { type: 'string', description: 'Identifiant court en snake_case' },
      delta: { type: 'number' },
    },
    requis: ['nom', 'delta'],
  },
  {
    composant: 'monde',
    nom: 'ajouter_declencheur',
    description: 'Enregistre une règle explicite "si X alors Y" plantée par le texte, à évaluer plus tard contre les flags/compteurs.',
    parametres: {
      nom: { type: 'string' },
      conditionFlag: { type: 'string', description: 'Optionnel : nom du flag qui doit être vrai' },
      conditionCompteurNom: { type: 'string', description: 'Optionnel : nom du compteur à surveiller' },
      conditionCompteurSeuil: { type: 'number', description: 'Optionnel, avec conditionCompteurNom : seuil déclenchant' },
      effet: { type: 'string', description: 'Conséquence à narrer une fois la condition remplie' },
    },
    requis: ['nom', 'effet'],
  },
  {
    composant: 'monde',
    nom: 'resoudre_declencheur',
    description: "Marque la conséquence d'un déclencheur déjà activé comme effectivement racontée dans le texte.",
    parametres: {
      id: { type: 'string' },
    },
    requis: ['id'],
  },
];

const OUTILS_SOCIAL: ToolDefinition[] = [
  {
    composant: 'social',
    nom: 'ajouter_engagement',
    description: "Enregistre une promesse, dette ou contrat explicitement pris par {{user}} envers quelqu'un.",
    parametres: {
      type: { type: 'string', enum: ['promesse', 'dette', 'contrat'] },
      description: { type: 'string' },
      partie: { type: 'string', description: 'PNJ ou faction concerné' },
    },
    requis: ['type', 'description', 'partie'],
  },
  {
    composant: 'social',
    nom: 'resoudre_engagement',
    description: 'Marque un engagement en cours comme honoré ou rompu, une fois explicitement réglé dans le texte.',
    parametres: {
      id: { type: 'string' },
      honore: { type: 'boolean', description: 'true si tenu, false si rompu' },
    },
    requis: ['id', 'honore'],
  },
  {
    composant: 'social',
    nom: 'ajuster_relation',
    description: "Ajuste par delta l'attitude d'un personnage nommé envers {{user}} (échelle -3 à 3, 0 = aucun changement sur cet axe).",
    parametres: {
      nom: { type: 'string' },
      faction: { type: 'string', description: 'Optionnel : groupe dont la réputation évolue ensemble' },
      confiance: { type: 'number' },
      respect: { type: 'number' },
      peur: { type: 'number' },
      affection: { type: 'number' },
      hostilite: { type: 'number' },
    },
    requis: ['nom'],
  },
];

export type ComposantOutils = 'monde' | 'social';

export function outilsPourComposant(composant: ComposantOutils): ToolDefinition[] {
  return composant === 'monde' ? OUTILS_MONDE : OUTILS_SOCIAL;
}

/**
 * Validation et réparation minimale des arguments d'un appel d'outil (brief
 * Phase 2) : coercition sûre (chaîne numérique -> nombre, "true"/"false" ->
 * booléen) quand c'est possible, sinon l'argument est écarté — un champ
 * requis manquant ou irréparable invalide tout l'appel plutôt que de
 * propager une valeur incorrecte dans l'état de l'histoire.
 */
export function validerEtReparerArguments(
  outil: ToolDefinition,
  args: Record<string, unknown>,
): Record<string, unknown> | null {
  const resultat: Record<string, unknown> = {};

  for (const [cle, schema] of Object.entries(outil.parametres)) {
    let valeur = args[cle];
    if (valeur === undefined || valeur === null || valeur === '') {
      if (outil.requis.includes(cle)) return null;
      continue;
    }

    if (schema.type === 'number' && typeof valeur !== 'number') {
      const coerce = Number(valeur);
      if (Number.isNaN(coerce)) {
        if (outil.requis.includes(cle)) return null;
        continue;
      }
      valeur = coerce;
    } else if (schema.type === 'boolean' && typeof valeur !== 'boolean') {
      if (valeur === 'true') valeur = true;
      else if (valeur === 'false') valeur = false;
      else {
        if (outil.requis.includes(cle)) return null;
        continue;
      }
    } else if (schema.type === 'string' && typeof valeur !== 'string') {
      if (outil.requis.includes(cle)) return null;
      continue;
    }

    if (schema.enum && !schema.enum.includes(valeur as string)) {
      if (outil.requis.includes(cle)) return null;
      continue;
    }

    resultat[cle] = valeur;
  }

  if (outil.requis.some((cle) => !(cle in resultat))) return null;
  return resultat;
}
