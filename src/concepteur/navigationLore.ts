import { normaliserLore } from '../engine/loreScoring';
import type { FicheEditable } from './lorebookModele';

/** Vue hiérarchique virtuelle : une fiche possède plusieurs chemins, sans duplication. */
const LIEUX: ReadonlyArray<{ ville: string; chemin: string }> = [
  { ville: 'Paris', chemin: 'Monde/Europe/France/Paris' },
  { ville: 'Tokyo', chemin: 'Monde/Asie/Japon/Tokyo' },
  { ville: 'Delhi', chemin: 'Monde/Asie/Inde/Delhi' },
  { ville: 'Oslo', chemin: 'Monde/Europe/Norvège/Oslo' },
  { ville: 'Istanbul', chemin: 'Monde/Europe et Asie/Turquie/Istanbul' },
  { ville: 'Lagos', chemin: 'Monde/Afrique/Nigeria/Lagos' },
  { ville: 'Johannesburg', chemin: 'Monde/Afrique/Afrique du Sud/Johannesburg' },
  { ville: 'Mexico', chemin: 'Monde/Amériques/Mexique/Mexico' },
  { ville: 'New York', chemin: 'Monde/Amériques/États-Unis/New York' },
  { ville: 'Bogotá', chemin: 'Monde/Amériques/Colombie/Bogotá' },
  { ville: 'Sydney', chemin: 'Monde/Océanie/Australie/Sydney' },
  { ville: 'Auckland', chemin: 'Monde/Océanie/Nouvelle-Zélande/Auckland' },
  { ville: 'Zurich', chemin: 'Monde/Europe/Suisse/Zurich' },
  { ville: 'Katmandou', chemin: 'Monde/Asie/Népal/Katmandou' },
];
export function dossiersNavigationLore(fiche: FicheEditable): string[] {
  const chemins = new Set<string>(fiche.dossiers);
  chemins.add('Catégories/' + fiche.category);
  const cat = normaliserLore(fiche.category);
  if (cat.includes('racial') || cat.includes('culture') || cat.includes('race')) {
    chemins.add('Races et civilisations');
  } else if (cat.includes('recurrent') || cat.includes('profil') || cat.includes('personnage')) {
    chemins.add('Personnages');
  } else if (cat.includes('guilde')) {
    chemins.add('Organisations/Guildes');
  } else if (cat.includes('faction')) {
    chemins.add('Organisations/Factions');
  } else if (cat.includes('royaume')) {
    chemins.add('Royaumes et factions');
  } else if (cat.includes('systeme') || cat.includes('mecanique')) {
    chemins.add('Systèmes et règles');
  } else if (cat.includes('monde')) {
    chemins.add('Monde et géographie');
  }
  const cible = normaliserLore(fiche.titre + ' ' + fiche.primaryKeys.join(' '));
  // Examen du titre et des mots-clés, pas du contenu : un texte décrivant les
  // 14 capitales ne doit pas être automatiquement rangé dans 14 villes.
  for (const lieu of LIEUX) {
    const ville = normaliserLore(lieu.ville);
    if ((' ' + cible + ' ').includes(' ' + ville + ' ')) chemins.add(lieu.chemin);
  }
  return [...chemins];
}
