import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { getStoriesIndex, getStory } from '../storage/storage';
import { obtenirAvatarPnj } from '../storage/pnjAvatarsStore';
import { obtenirAssetVisuel } from '../storage/assetsVisuelsStore';
import { monde, mondeIdDe, obtenirPortrait, racesDuMonde } from '../mondes';
import { donneesMonde } from '../mondes/donnees';
import { lireAssetsLore } from '../concepteur/assetsLoreStore';
import { lireLoreAtelier } from '../concepteur/lorebookStore';
import { appliquerLorePublie } from '../concepteur/lorebookModele';
import { listerPnjVisuels, ID_ASSET_JOUEUR } from '../engine/visualState';
import { obtenirPortraitRace, obtenirPortraitReferenceJoueur } from '../engine/images';
import { preparerImageReference } from '../storage/pnjAvatarsStore';
import type { ReferenceCandidate } from '../engine/moteurVisuel';
import type { StoryState } from '../types';
import { couleurs, polices } from '../theme/theme';

/**
 * Images de référence existantes d'Elyndor, choisies explicitement par
 * identifiant : portraits et avatars du joueur et des PNJ d'une histoire,
 * portraits de races, images rattachées au lorebook. Aucun personnage n'est
 * deviné d'après un prénom : on choisit une image précise.
 */
export interface ReferenceElyndor {
  id: string;
  type: ReferenceCandidate['type'];
  role: ReferenceCandidate['role'];
  libelle: string;
  apercu: ImageSourcePropType;
  /** Charge l'image en data URL au moment de l'envoi. */
  charger(): Promise<string | null>;
}

interface Props {
  selection: ReadonlySet<string>;
  onBasculer(ref: ReferenceElyndor): void;
  /** Histoire présélectionnée (ex. histoire ouverte). */
  histoireInitiale?: string;
  /** Masque les images du lorebook (ex. depuis une fiche du lorebook). */
  sansLore?: boolean;
}

const SEXES = ['Homme', 'Femme', 'Autre'] as const;

async function chargerHistoire(story: StoryState): Promise<ReferenceElyndor[]> {
  const sortie: ReferenceElyndor[] = [];
  const portrait = obtenirPortrait(story.meta.raceOrigineId, story.meta.sexe, mondeIdDe(story.meta));
  if (portrait) {
    sortie.push({
      id: `portrait-creation:${story.meta.id}`, type: 'joueur-portrait', role: 'identite',
      libelle: `${story.meta.personnageNom} — portrait de création`, apercu: portrait,
      charger: () => obtenirPortraitReferenceJoueur(story),
    });
  }
  const avatarJoueur = await obtenirAvatarPnj(story.meta.id, ID_ASSET_JOUEUR).catch(() => null);
  if (avatarJoueur) {
    sortie.push({
      id: `avatar:${story.meta.id}:${ID_ASSET_JOUEUR}`, type: 'joueur-avatar', role: 'identite',
      libelle: `${story.meta.personnageNom} — avatar`, apercu: { uri: avatarJoueur },
      charger: () => preparerImageReference(avatarJoueur),
    });
  }
  for (const pnj of listerPnjVisuels(story)) {
    const avatar = await obtenirAvatarPnj(story.meta.id, pnj.id).catch(() => null);
    if (!avatar) continue;
    sortie.push({
      id: `avatar:${story.meta.id}:${pnj.id}`, type: 'pnj-avatar', role: 'identite',
      libelle: `${pnj.titre} — avatar`, apercu: { uri: avatar },
      charger: () => preparerImageReference(avatar),
    });
  }
  return sortie;
}

export async function chargerReferencesLore(): Promise<ReferenceElyndor[]> {
  const etat = await lireAssetsLore();
  const canon = donneesMonde(monde.actifId()).lore;
  let pool = canon;
  try { pool = appliquerLorePublie(canon, await lireLoreAtelier()); } catch { /* lore de l'Atelier illisible : canon seul */ }
  const titres = new Map(pool.map((f) => [f.id, f.titre]));
  const sortie: ReferenceElyndor[] = [];
  for (const [ficheId, liens] of Object.entries(etat.liens)) {
    for (const lien of liens) {
      const uri = await obtenirAssetVisuel(lien.assetId).catch(() => null);
      if (!uri) continue;
      sortie.push({
        id: `lore:${lien.assetId}`, type: lien.role === 'identite' ? 'manuelle' : lien.role === 'race' ? 'race' : 'lieu',
        role: lien.role === 'identite' ? 'identite' : lien.role === 'race' ? 'race' : 'decor',
        libelle: `${titres.get(ficheId) ?? ficheId} — ${lien.libelle || lien.role}`, apercu: { uri },
        charger: () => preparerImageReference(uri),
      });
    }
  }
  return sortie;
}

function Vignette({ item, actif, onPress }: { item: ReferenceElyndor; actif: boolean; onPress(): void }) {
  return <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: actif }}
    style={[st.vignette, actif && st.actif]}>
    <Image source={item.apercu} style={st.image} resizeMode="cover" />
    <Text style={st.legende} numberOfLines={2}>{actif ? '☑ ' : '☐ '}{item.libelle}</Text>
  </Pressable>;
}

export default function SelecteurReferencesElyndor({ selection, onBasculer, histoireInitiale, sansLore }: Props) {
  const [histoires, setHistoires] = useState<Array<{ id: string; titre: string }>>([]);
  const [histoireId, setHistoireId] = useState<string | undefined>(histoireInitiale);
  const [refsHistoire, setRefsHistoire] = useState<ReferenceElyndor[]>([]);
  const [refsLore, setRefsLore] = useState<ReferenceElyndor[]>([]);
  const [race, setRace] = useState<string>('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    let actif = true;
    getStoriesIndex().then((index) => {
      if (!actif) return;
      const liste = index.slice(0, 30).map((h: any) => ({ id: h.id, titre: h.titre ?? h.personnageNom ?? h.id }));
      setHistoires(liste);
      setHistoireId((courant) => courant ?? liste[0]?.id);
    }).catch(() => undefined);
    if (!sansLore) chargerReferencesLore().then((r) => { if (actif) setRefsLore(r); }).catch(() => undefined);
    return () => { actif = false; };
  }, [sansLore]);

  useEffect(() => {
    let actif = true;
    if (!histoireId) { setRefsHistoire([]); return; }
    setChargement(true);
    getStory(histoireId)
      .then(async (story) => { const refs = story ? await chargerHistoire(story) : []; if (actif) setRefsHistoire(refs); })
      .catch(() => { if (actif) setRefsHistoire([]); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [histoireId]);

  const portraitsRace: ReferenceElyndor[] = race
    ? SEXES.flatMap((sexe) => {
        const source = obtenirPortrait(race, sexe);
        const nom = racesDuMonde(monde.actif()).find((r) => r.id === race)?.nom ?? race;
        return source ? [{
          id: `race:${race}-${sexe}`, type: 'race' as const, role: 'race' as const,
          libelle: `Race ${nom} (${sexe})`, apercu: source, charger: () => obtenirPortraitRace(race, sexe),
        }] : [];
      })
    : [];

  return <View style={st.bloc}>
    <Text style={st.label}>Histoire (portraits et avatars)</Text>
    <View style={st.ligne}>{histoires.map((h) => <Pressable key={h.id} onPress={() => setHistoireId(h.id)}
      style={[st.puce, histoireId === h.id && st.actif]}><Text style={st.nom} numberOfLines={1}>{h.titre}</Text></Pressable>)}</View>
    {chargement ? <ActivityIndicator color={couleurs.accent} /> : null}
    {!chargement && histoireId && !refsHistoire.length ? <Text style={st.aide}>Aucun portrait enregistré pour cette histoire.</Text> : null}
    <View style={st.grille}>{refsHistoire.map((r) => <Vignette key={r.id} item={r} actif={selection.has(r.id)} onPress={() => onBasculer(r)} />)}</View>
    <Text style={st.label}>Portraits de races</Text>
    <View style={st.ligne}>{racesDuMonde(monde.actif()).map((r) => <Pressable key={r.id} onPress={() => setRace(race === r.id ? '' : r.id)}
      style={[st.puce, race === r.id && st.actif]}><Text style={st.nom}>{r.nom}</Text></Pressable>)}</View>
    <View style={st.grille}>{portraitsRace.map((r) => <Vignette key={r.id} item={r} actif={selection.has(r.id)} onPress={() => onBasculer(r)} />)}</View>
    {!sansLore ? <>
      <Text style={st.label}>Images du lorebook</Text>
      {!refsLore.length ? <Text style={st.aide}>Aucune image rattachée au lorebook pour l’instant.</Text> : null}
      <View style={st.grille}>{refsLore.map((r) => <Vignette key={r.id} item={r} actif={selection.has(r.id)} onPress={() => onBasculer(r)} />)}</View>
    </> : null}
  </View>;
}

const st = StyleSheet.create({
  bloc: { gap: 6 },
  label: { fontFamily: polices.corpsMedium, fontSize: 14, color: couleurs.doreClair, marginTop: 6 },
  aide: { fontFamily: polices.corps, fontSize: 13, color: couleurs.texteAtténué },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 13 },
  ligne: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puce: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 14, maxWidth: 220 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vignette: { width: 110, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 8, padding: 4, gap: 4 },
  image: { width: '100%', height: 120, borderRadius: 6, backgroundColor: couleurs.fondCarte },
  legende: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 12 },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
});
