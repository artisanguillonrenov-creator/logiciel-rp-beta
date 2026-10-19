import { paquetMonde, titreLoreDe } from '../src/mondes';

/** Champs du prompt fournis par le paquet d'Elyndor (construireCtxBase les ajoute en production). */
export const CTX_ELYNDOR = {
  loreCore: paquetMonde('elyndor').core,
  titreLore: titreLoreDe(paquetMonde('elyndor')),
};
