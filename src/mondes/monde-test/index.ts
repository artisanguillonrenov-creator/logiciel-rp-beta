import type { EntreeLoreBrute, PaquetMonde } from '../types';
import lorebook from './lorebook.json';

// Paquet monde minimal, fictif et jetable (chantier multi-mondes, phase 5) :
// il prouve que le mécanisme ne dépend pas d'Elyndor. Aucun module de races ni
// de rôles canon ; départ libre ; consigne de scénario générique du moteur.
// Il sert uniquement aux tests et peut être supprimé (retirer aussi son entrée
// dans src/mondes/index.ts).
export const PAQUET_MONDE_TEST: PaquetMonde = {
  id: 'monde-test',
  carte: {
    nom: 'Monde de test',
    genre: 'Test',
    get image() {
      return require('../../../assets/scenes/creation-histoire.png');
    },
    description: 'Monde fictif minimal servant à vérifier que l’application fonctionne sans Elyndor.',
    tags: ['Test'],
  },
  marque: {
    titre: 'MONDE DE TEST',
  },
  synopsis: [
    'La Plaine de Brumeval s’éveille chaque matin sous la brume.',
    'À Port-Essai, les bateliers chargent le grain et les lanternes du guet s’éteignent.',
    'Ce monde existe seulement pour vérifier le moteur.',
  ],
  core: `[LORE CORE — CANON GARANTI]

IDENTITÉ
Le monde de test est une petite région rurale fictive, la Plaine de Brumeval, avec une seule ville fluviale, Port-Essai.

RÈGLES
Aucune magie, aucune créature surnaturelle. Technologie de bourg rural : bateaux à rames, moulins à eau, lanternes à huile. Les nouvelles voyagent à pied ou par bateau.

PRIMAUTÉ DU CANON
Tout fait établi dans le lorebook prime sur l’improvisation. Un personnage ne connaît que ce qu’il peut raisonnablement savoir.`,
  lorebook: lorebook as unknown as { entries: EntreeLoreBrute[] },
  modules: {
    depart: { mode: 'libre' },
  },
};
