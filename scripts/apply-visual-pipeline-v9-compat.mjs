import fs from 'node:fs';

const path = 'src/automation/visualPlanning.ts';
let source = fs.readFileSync(path, 'utf8');
const ancien = `    parNom.set(nom, { ...entree, id: idVisuelPnjDepuisNom(entree.titre) });`;
const nouveau = `    // Un PNJ déjà connu du lore conserve son identifiant historique : les\n    // avatars existants restent donc retrouvables après mise à jour. Le hash\n    // visuel n'est utilisé que pour un locuteur nommé détecté avant sa fiche.\n    parNom.set(nom, entree);`;
if (!source.includes(ancien)) throw new Error('Correctif V9 compatibilité PNJ : marqueur introuvable.');
source = source.replace(ancien, nouveau);
fs.writeFileSync(path, source);
console.log('V9 : compatibilité des identifiants d’avatars PNJ existants appliquée.');
