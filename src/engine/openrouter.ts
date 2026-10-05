/**
 * Compatibilité temporaire.
 *
 * Les anciens modules importent encore `./openrouter`, mais ce fichier ne
 * contient plus aucun routage fournisseur. Toute génération passe par le
 * client Elyndor Cloud unique.
 */
export * from './elyndorCloudClient';
