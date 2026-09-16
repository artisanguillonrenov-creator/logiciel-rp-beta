import type { StoryState } from '../types';
import { creerFileSerie } from './serialQueue';
import { reconstituerHistoire, serialiserHistoire, type StockageHistoires } from './storySerialization';

interface AncienStockage {
  getAllKeys(): Promise<readonly string[]>;
  getItem(cle: string): Promise<string | null>;
  removeItem(cle: string): Promise<void>;
}

export class ErreurStockage extends Error {}
const PREFIXE = '@rp_beta/story/';

export function creerDepotHistoires(ancien: AncienStockage, stockage: StockageHistoires, migrer: (data: any) => StoryState) {
  const executer = creerFileSerie();
  let migrationTerminee = false;

  async function initialiser() {
    if (migrationTerminee) return;
    // L'index historique a pu échouer après l'écriture d'une histoire :
    // parcourir les clés récupère aussi les histoires devenues orphelines.
    const cles = (await ancien.getAllKeys()).filter((cle) => cle.startsWith(PREFIXE));
    for (const cle of cles) {
      const raw = await ancien.getItem(cle);
      if (raw === null) continue;
      const histoire = migrer(JSON.parse(raw));
      if (histoire.meta.id !== cle.slice(PREFIXE.length)) throw new Error('Identité de sauvegarde incohérente.');
      await stockage.ecrire(serialiserHistoire(histoire), true);
      // La transaction est confirmée avant tout retrait de la copie ancienne.
      // Un redémarrage après ce point ne doit jamais écraser la nouvelle version.
      await ancien.removeItem(cle);
    }
    await ancien.removeItem('@rp_beta/stories_index');
    migrationTerminee = true;
  }

  function operation<T>(action: () => Promise<T>): Promise<T> {
    return executer(async () => {
      try { await initialiser(); return await action(); }
      catch (cause) {
        throw new ErreurStockage(
          'Impossible d’accéder aux sauvegardes ou de confirmer leur enregistrement. Ne ferme pas cette page si un échange vient d’être créé. Libère de l’espace puis réessaie ; les données déjà enregistrées sont conservées.',
          { cause },
        );
      }
    });
  }

  return {
    lister: () => operation(() => stockage.lister()),
    lire: (id: string) => operation(async () => {
      const sauvegarde = await stockage.lire(id);
      return sauvegarde ? migrer(reconstituerHistoire(sauvegarde)) : null;
    }),
    enregistrer(histoire: StoryState) {
      // Capture avant la première attente : l'UI peut modifier l'objet
      // pendant qu'une sauvegarde précédente attend encore sa transaction.
      histoire.meta.updatedAt = Date.now();
      const capture = serialiserHistoire(histoire);
      return operation(() => stockage.ecrire(capture));
    },
    /**
     * Lecture + garde + écriture dans la même file série du dépôt. Sert aux
     * automatismes : un résultat calculé sur une ancienne révision ne peut
     * jamais écraser un tour ou une édition sauvegardés entre-temps.
     *
     * Contrairement à enregistrer(), cette maintenance ne modifie pas
     * updatedAt : une consolidation mémoire en arrière-plan n'est pas une
     * nouvelle session utilisateur.
     */
    mettreAJourSi(
      id: string,
      predicat: (histoire: StoryState) => boolean,
      transformation: (histoire: StoryState) => StoryState,
    ) {
      return operation(async () => {
        const sauvegarde = await stockage.lire(id);
        if (!sauvegarde) return null;
        const histoire = migrer(reconstituerHistoire(sauvegarde));
        if (!predicat(histoire)) return null;
        const miseAJour = transformation(histoire);
        if (miseAJour.meta.id !== id) throw new Error('Une mise à jour gardée ne peut pas changer l’identité de l’histoire.');
        await stockage.ecrire(serialiserHistoire(miseAJour));
        return miseAJour;
      });
    },
    supprimer: (id: string) => operation(() => stockage.supprimer(id)),
    renommer: (id: string, titre: string) => operation(async () => {
      const sauvegarde = await stockage.lire(id);
      if (!sauvegarde) return;
      const histoire = migrer(reconstituerHistoire(sauvegarde));
      histoire.meta.titre = titre.trim() || undefined;
      await stockage.ecrire(serialiserHistoire(histoire));
    }),
  };
}
