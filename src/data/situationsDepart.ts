// Situations de départ proposées à l'étape "Point de départ" — dépendent du
// lieu de départ choisi (src/data/lieuxDepart.ts), grounded dans le lore
// dédié à chaque lieu (src/data/elyndorLore.json) plutôt qu'une liste
// générique unique.
export interface SituationDepart {
  id: string;
  nom: string;
  description: string;
}

export const SITUATIONS_PAR_LIEU: Record<string, SituationDepart[]> = {
  'marches-esclaves': [
    { id: 'enchere-publique', nom: 'Enchère publique', description: 'Vente aux enchères, estrade et notaires sur place.' },
    { id: 'vente-gre-a-gre', nom: 'Vente de gré à gré', description: 'Une négociation privée, loin des criées.' },
    { id: 'inspection-avant-achat', nom: 'Inspection avant achat', description: "Examiné·e comme une marchandise avant la mise en vente." },
    { id: 'tentative-evasion', nom: "Tentative d'évasion", description: 'Une chance de fuir se présente — ou vient d\'échouer.' },
    { id: 'loge-privee', nom: 'Vente en loge privée', description: 'Une vente de prestige, discrète, loin des regards.' },
  ],
  'guilde-marchands': [
    { id: 'negociation-lettre-credit', nom: 'Négociation commerciale', description: 'Une lettre de crédit, une caravane, un arbitrage à trancher.' },
    { id: 'tribunal-commercial', nom: 'Tribunal commercial', description: "Un litige porté devant le tribunal privé de la guilde." },
    { id: 'audience-conseil', nom: "Audience au conseil d'Istanbul", description: 'Convoqué·e devant les Princes Marchands.' },
    { id: 'caravane-interceptee', nom: 'Caravane interceptée', description: 'Une caravane vient d\'être détournée ou attaquée.' },
    { id: 'liste-noire', nom: 'Mise en cause', description: 'Menacé·e d\'être porté·e sur la liste noire des mauvais payeurs.' },
  ],
  'ordre-mages': [
    { id: 'examen-licence', nom: 'Examen de licence', description: "Une évaluation devant des Maîtres de l'Ordre." },
    { id: 'traque-renegat', nom: "Traque d'un renégat", description: 'Un mage hors-la-loi à retrouver — ou à fuir.' },
    { id: 'scellement-artefact', nom: "Scellement d'un artefact", description: 'Un objet dangereux à neutraliser ou à récupérer.' },
    { id: 'audience-conclave', nom: 'Audience devant le Conclave', description: 'Convoqué·e devant les Archimages.' },
    { id: 'decouverte-interdite', nom: 'Découverte interdite', description: 'Une magie proscrite vient d\'être mise au jour.' },
  ],
  'guilde-ombres': [
    { id: 'contrat-discret', nom: 'Contrat discret accepté', description: 'Un travail que la guilde ne discute jamais au grand jour.' },
    { id: 'rendez-vous-maitre-ombres', nom: 'Rendez-vous avec le Maître des Ombres', description: 'Convoqué·e par celui ou celle qui dirige la cellule locale.' },
    { id: 'passage-clandestin', nom: 'Passage clandestin', description: 'Une traversée discrète, hors des routes surveillées.' },
    { id: 'marche-noir', nom: 'Marché noir', description: 'Une transaction que personne ne doit voir.' },
    { id: 'trahison-suspectee', nom: 'Trahison suspectée', description: 'Quelqu\'un dans la cellule ne joue plus le jeu.' },
  ],
  'guilde-aventuriers': [
    { id: 'reception-contrat', nom: 'Réception d\'un contrat', description: 'Une mission tout juste acceptée au tableau des primes.' },
    { id: 'evaluation-rang', nom: 'Évaluation de rang', description: 'Un rang à défendre ou à gagner devant la Maîtresse de Guilde.' },
    { id: 'retour-mission', nom: 'Retour de mission', description: 'De retour d\'un contrat — réussi ou non.' },
    { id: 'contrat-international', nom: 'Contrat international', description: 'Une mission d\'envergure, rang Or ou plus.' },
    { id: 'formation-groupe', nom: "Formation d'un groupe", description: 'Un contrat qui demande de s\'associer à des inconnus.' },
  ],
};
