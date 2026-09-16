import type { StoryMeta, StoryState } from '../types';

export interface MessageStocke {
  id: string;
  position: number;
  contenu: string;
}

export interface HistoireStockee {
  id: string;
  meta: string;
  etat: string;
  messages: MessageStocke[];
}

export interface StockageHistoires {
  lire(id: string): Promise<HistoireStockee | null>;
  lister(): Promise<StoryMeta[]>;
  // Métadonnées, état et messages doivent être validés dans UNE transaction.
  ecrire(histoire: HistoireStockee, seulementSiAbsente?: boolean): Promise<void>;
  supprimer(id: string): Promise<void>;
}

export function serialiserHistoire(histoire: StoryState): HistoireStockee {
  const { meta, messages, ...etat } = histoire;
  if (!meta?.id || !Array.isArray(messages)) throw new Error('Sauvegarde d’histoire invalide.');
  const ids = new Set<string>();
  return {
    id: meta.id,
    meta: JSON.stringify(meta),
    etat: JSON.stringify(etat),
    messages: messages.map((message, position) => {
      if (!message.id || ids.has(message.id)) throw new Error('Identifiants de messages invalides ou dupliqués.');
      ids.add(message.id);
      return { id: message.id, position, contenu: JSON.stringify(message) };
    }),
  };
}

export function reconstituerHistoire(histoire: HistoireStockee): StoryState {
  return {
    ...JSON.parse(histoire.etat),
    meta: JSON.parse(histoire.meta),
    messages: [...histoire.messages].sort((a, b) => a.position - b.position).map((m) => JSON.parse(m.contenu)),
  };
}

// Les messages inchangés ne sont jamais réécrits. Édition, réaction,
// épinglage, suppression et régénération restent possibles, pas seulement l'ajout.
export function differencesMessages(anciens: MessageStocke[], nouveaux: MessageStocke[]) {
  const restants = new Map(anciens.map((m) => [m.id, m]));
  const ecrire: MessageStocke[] = [];
  for (const message of nouveaux) {
    const precedent = restants.get(message.id);
    if (!precedent || precedent.position !== message.position || precedent.contenu !== message.contenu) {
      ecrire.push(message);
    }
    restants.delete(message.id);
  }
  return { ecrire, supprimer: [...restants.keys()] };
}
