import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { AppSettings, EntreeLoreEmergent, StoryState } from '../types';
import { getStory } from '../storage/storage';
import { obtenirAvatarPnj, supprimerAvatarPnj } from '../storage/pnjAvatarsStore';
import { obtenirIllustrationScene } from '../storage/sceneImagesStore';
import { calculerCapacites } from './capabilities';
import { abonnerEvenementsVisuels } from './visualEvents';
import {
  enqueueVisualAvatarGeneration,
  enqueueVisualAvatarSync,
  enqueueVisualSceneGeneration,
} from './visualRoutines';
import { ID_AVATAR_JOUEUR_VISUEL } from './visualPlanning';
import { calculerRevisionNarrative } from './storyRevision';

function filtrerPnj(story: StoryState | null): EntreeLoreEmergent[] {
  if (!story) return [];
  const nomJoueur = story.meta.personnageNom.trim().toLowerCase();
  return story.loreEmergent.filter(
    (entree) => entree.categorie === 'pnj' && entree.titre.trim().toLowerCase() !== nomJoueur,
  );
}

export function useVisualAutomation(story: StoryState | null, appSettings: AppSettings | null) {
  const [imageEnCours, setImageEnCours] = useState(false);
  const [imageGeneree, setImageGeneree] = useState<string | null>(null);
  const [erreurImage, setErreurImage] = useState('');
  const [avatarsPnj, setAvatarsPnj] = useState<Record<string, string>>({});
  const [avatarsPnjEnCours, setAvatarsPnjEnCours] = useState<Record<string, boolean>>({});
  const [erreurAvatarPnj, setErreurAvatarPnj] = useState('');
  const [avatarJoueur, setAvatarJoueur] = useState<string | null>(null);
  const [avatarJoueurEnCours, setAvatarJoueurEnCours] = useState(false);
  const [pnjPersistes, setPnjPersistes] = useState<EntreeLoreEmergent[]>([]);

  const capacites = useMemo(
    () => appSettings
      ? calculerCapacites(appSettings, { plateforme: Platform.OS === 'web' ? 'web' : 'native' })
      : null,
    [appSettings],
  );
  const imagesDisponibles = capacites?.images === true;
  const raisonImages = capacites?.raisons.images;
  const revision = story ? calculerRevisionNarrative(story) : '';

  const pnjConnus = useMemo(() => {
    const fusion = new Map<string, EntreeLoreEmergent>();
    for (const pnj of filtrerPnj(story)) fusion.set(pnj.id, pnj);
    for (const pnj of pnjPersistes) fusion.set(pnj.id, pnj);
    return [...fusion.values()];
  }, [story, pnjPersistes]);

  const clePnj = useMemo(() => pnjConnus.map((pnj) => pnj.id).sort().join(','), [pnjConnus]);

  const rechargerLorePersistant = useCallback(async () => {
    if (!story) return;
    try {
      const persistee = await getStory(story.meta.id);
      if (persistee) setPnjPersistes(filtrerPnj(persistee));
    } catch {
      // Le cache visuel est un enrichissement ; une lecture ratée ne bloque
      // ni l'histoire ni l'affichage déjà présent à l'écran.
    }
  }, [story?.meta.id]);

  useEffect(() => {
    setPnjPersistes([]);
    setAvatarsPnj({});
    setAvatarJoueur(null);
    setImageGeneree(null);
    setErreurAvatarPnj('');
    setErreurImage('');
  }, [story?.meta.id]);

  useEffect(() => {
    if (!story) return;
    let annule = false;

    void (async () => {
      await rechargerLorePersistant();
      const joueur = await obtenirAvatarPnj(story.meta.id, ID_AVATAR_JOUEUR_VISUEL).catch(() => null);
      if (!annule && joueur) setAvatarJoueur(joueur);

      for (const pnj of pnjConnus) {
        const uri = await obtenirAvatarPnj(story.meta.id, pnj.id).catch(() => null);
        if (annule) return;
        if (uri) setAvatarsPnj((prev) => ({ ...prev, [pnj.id]: uri }));
      }

      if (imagesDisponibles && !annule) {
        await enqueueVisualAvatarSync(story).catch(() => {});
      }
    })();

    return () => { annule = true; };
  }, [story?.meta.id, clePnj, imagesDisponibles, rechargerLorePersistant]);

  useEffect(() => {
    if (!story || !revision) return;
    let annule = false;
    void obtenirIllustrationScene(story.meta.id, revision)
      .then((uri) => {
        if (!annule) setImageGeneree(uri);
      })
      .catch(() => {
        if (!annule) setImageGeneree(null);
      });
    return () => { annule = true; };
  }, [story?.meta.id, revision]);

  useEffect(() => abonnerEvenementsVisuels((event) => {
    if (!story || event.storyId !== story.meta.id) return;

    if (event.type === 'avatar.ready') {
      if (event.assetId === ID_AVATAR_JOUEUR_VISUEL) {
        setAvatarJoueur(event.uri);
        setAvatarJoueurEnCours(false);
      } else {
        setAvatarsPnj((prev) => ({ ...prev, [event.assetId]: event.uri }));
        setAvatarsPnjEnCours((prev) => ({ ...prev, [event.assetId]: false }));
        void rechargerLorePersistant();
      }
      return;
    }

    if (event.type === 'avatar.error') {
      if (event.assetId === ID_AVATAR_JOUEUR_VISUEL) setAvatarJoueurEnCours(false);
      else setAvatarsPnjEnCours((prev) => ({ ...prev, [event.assetId]: false }));
      setErreurAvatarPnj(event.message);
      return;
    }

    if (event.type === 'scene.ready') {
      if (event.revision !== revision) return;
      setImageGeneree(event.uri);
      setImageEnCours(false);
      return;
    }

    if (event.type === 'scene.error') {
      if (event.revision !== revision) return;
      setErreurImage(event.message);
      setImageEnCours(false);
    }
  }), [story?.meta.id, revision, rechargerLorePersistant]);

  const avatarsPnjPourTexte = useMemo(
    () => pnjConnus
      .filter((pnj) => avatarsPnj[pnj.id])
      .map((pnj) => ({ pnj, avatarUri: avatarsPnj[pnj.id] })),
    [pnjConnus, avatarsPnj],
  );

  const illustrerScene = useCallback(async () => {
    if (!story || !imagesDisponibles || imageEnCours) return;
    setImageEnCours(true);
    setErreurImage('');
    try {
      await enqueueVisualSceneGeneration(story);
    } catch (error) {
      setImageEnCours(false);
      setErreurImage(error instanceof Error ? error.message : 'Illustration impossible à planifier.');
    }
  }, [story, imagesDisponibles, imageEnCours]);

  const genererAvatarPourPnj = useCallback(async (pnj: EntreeLoreEmergent) => {
    if (!story || !imagesDisponibles || avatarsPnjEnCours[pnj.id]) return;
    setAvatarsPnjEnCours((prev) => ({ ...prev, [pnj.id]: true }));
    setErreurAvatarPnj('');
    try {
      await enqueueVisualAvatarGeneration(story, pnj.id, !!avatarsPnj[pnj.id]);
    } catch (error) {
      setAvatarsPnjEnCours((prev) => ({ ...prev, [pnj.id]: false }));
      setErreurAvatarPnj(error instanceof Error ? error.message : 'Portrait impossible à planifier.');
    }
  }, [story, imagesDisponibles, avatarsPnjEnCours, avatarsPnj]);

  const genererAvatarJoueur = useCallback(async () => {
    if (!story || !imagesDisponibles || avatarJoueurEnCours) return;
    setAvatarJoueurEnCours(true);
    setErreurAvatarPnj('');
    try {
      await enqueueVisualAvatarGeneration(story, ID_AVATAR_JOUEUR_VISUEL, !!avatarJoueur);
    } catch (error) {
      setAvatarJoueurEnCours(false);
      setErreurAvatarPnj(error instanceof Error ? error.message : 'Portrait impossible à planifier.');
    }
  }, [story, imagesDisponibles, avatarJoueurEnCours, avatarJoueur]);

  const supprimerAvatarPourPnj = useCallback(async (pnj: EntreeLoreEmergent) => {
    if (!story) return;
    await supprimerAvatarPnj(story.meta.id, pnj.id);
    setAvatarsPnj((prev) => {
      const { [pnj.id]: _retire, ...reste } = prev;
      return reste;
    });
  }, [story?.meta.id]);

  const supprimerAvatarJoueur = useCallback(async () => {
    if (!story) return;
    await supprimerAvatarPnj(story.meta.id, ID_AVATAR_JOUEUR_VISUEL);
    setAvatarJoueur(null);
  }, [story?.meta.id]);

  return {
    imagesDisponibles,
    raisonImages,
    imageEnCours,
    imageGeneree,
    setImageGeneree,
    erreurImage,
    pnjConnus,
    avatarsPnj,
    avatarsPnjPourTexte,
    avatarsPnjEnCours,
    erreurAvatarPnj,
    avatarJoueur,
    avatarJoueurEnCours,
    illustrerScene,
    genererAvatarPourPnj,
    supprimerAvatarPourPnj,
    genererAvatarJoueur,
    supprimerAvatarJoueur,
  };
}
