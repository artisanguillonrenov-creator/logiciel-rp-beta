import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fusionnerCatalogueTraduction, getCatalogueTraduction, getSettings, saveSettings } from '../storage/storage';
import { traduireLot } from './traduction';
import type { AppSettings } from '../types';

export interface LangueOption {
  code: string;
  label: string;
}

// Sélection rapide proposée sur l'écran d'accueil — n'importe quelle autre
// langue reste possible via la saisie libre du sélecteur (LangueScreen),
// traduite à la volée par le même mécanisme que celles de cette liste.
export const LANGUES_SUGGEREES: LangueOption[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

interface LangueContextValue {
  // 'fr' = comportement historique, aucune traduction (langue source du
  // moteur et de toute l'interface).
  langue: string;
  definirLangue: (code: string) => void;
  // Traduit un texte source (français) vers la langue active. Retourne le
  // texte français tel quel tant que la traduction n'est pas encore en
  // cache — jamais de blocage ni de spinner pour un simple libellé.
  t: (texte: string) => string;
}

const LangueContext = createContext<LangueContextValue>({
  langue: 'fr',
  definirLangue: () => {},
  t: (texte: string) => texte,
});

// Regroupe les textes demandés en rafale (un écran entier se rend en une
// fois) en un seul lot envoyé au modèle, plutôt qu'un appel par chaîne.
const DELAI_LOT_MS = 300;

export function LangueProvider({ children }: { children: React.ReactNode }) {
  const [langue, setLangue] = useState('fr');
  const [catalogue, setCatalogue] = useState<Record<string, string>>({});
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langueRef = useRef('fr');
  const appSettingsRef = useRef<AppSettings | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      appSettingsRef.current = s;
      const l = s.langueInterface || 'fr';
      langueRef.current = l;
      setLangue(l);
    });
  }, []);

  useEffect(() => {
    langueRef.current = langue;
    pendingRef.current.clear();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (langue === 'fr') {
      setCatalogue({});
      return;
    }
    let actif = true;
    getCatalogueTraduction(langue).then((c) => {
      if (actif) setCatalogue(c);
    });
    return () => {
      actif = false;
    };
  }, [langue]);

  const declencherLot = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      const settings = appSettingsRef.current;
      const langueCourante = langueRef.current;
      const lot = Array.from(pendingRef.current);
      pendingRef.current.clear();
      if (!settings || langueCourante === 'fr' || lot.length === 0) return;
      if (!settings.openRouterApiKey && settings.moteurInference !== 'local') return;
      const libelleLangue = LANGUES_SUGGEREES.find((l) => l.code === langueCourante)?.label ?? langueCourante;
      const traductions = await traduireLot(lot, libelleLangue, settings).catch(() => lot);
      const ajout: Record<string, string> = {};
      lot.forEach((texte, i) => {
        if (traductions[i] && traductions[i] !== texte) ajout[texte] = traductions[i];
      });
      if (Object.keys(ajout).length === 0) return;
      if (langueRef.current !== langueCourante) return; // la langue a changé entre-temps
      setCatalogue((prev) => ({ ...prev, ...ajout }));
      fusionnerCatalogueTraduction(langueCourante, ajout).catch(() => {});
    }, DELAI_LOT_MS);
  }, []);

  const t = useCallback(
    (texte: string): string => {
      if (!texte || langue === 'fr') return texte;
      const traduit = catalogue[texte];
      if (traduit) return traduit;
      if (!pendingRef.current.has(texte)) {
        pendingRef.current.add(texte);
        declencherLot();
      }
      return texte;
    },
    [langue, catalogue, declencherLot],
  );

  const definirLangue = useCallback((code: string) => {
    langueRef.current = code;
    setLangue(code);
    getSettings().then((s) => {
      const maj = { ...s, langueInterface: code };
      appSettingsRef.current = maj;
      saveSettings(maj).catch(() => {});
    });
  }, []);

  return <LangueContext.Provider value={{ langue, definirLangue, t }}>{children}</LangueContext.Provider>;
}

export function useLangue(): LangueContextValue {
  return useContext(LangueContext);
}
