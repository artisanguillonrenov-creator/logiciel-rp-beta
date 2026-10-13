import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSettings, getStoriesIndex, getStory } from '../storage/storage';
import { executerImage } from '../engine/serviceVisuel';
import { contratLibre, type FormatImage } from '../engine/contratVisuel';
import { preparerScene, type ScenePreparee } from '../engine/illustrationScene';
import type { ReferenceCandidate, TraceIllustration } from '../engine/moteurVisuel';
import { enregistrerAssetVisuel } from '../storage/assetsVisuelsStore';
import { modifierAssetsLore } from '../concepteur/assetsLoreStore';
import { ajouterLienAsset, nouvelIdentifiantAsset, ROLES_ASSET_LORE, LIBELLES_ROLE_ASSET, type RoleAssetLore } from '../concepteur/assetsLore';
import { lireLoreAtelier } from '../concepteur/lorebookStore';
import { appliquerLorePublie } from '../concepteur/lorebookModele';
import { LORE_ELYNDOR_CANON } from '../engine/canonElyndor';
import { normaliserTexte } from '../engine/texteRecherche';
import { couleurs, polices } from '../theme/theme';
import Bouton from './Bouton';
import { ImageAgrandissable } from './VisionneuseImage';
import SelecteurReferencesElyndor, { type ReferenceElyndor } from './SelecteurReferencesElyndor';
import TraceImage from './TraceImage';

type Mode = 'libre' | 'scene';

/** Enregistre une image générée comme référence d'une fiche du lorebook (lien optionnel, fiche inchangée). */
function AssocierAuLorebook({ image }: { image: string }) {
  const [recherche, setRecherche] = useState('');
  const [fiches, setFiches] = useState<Array<{ id: string; titre: string }>>([]);
  const [role, setRole] = useState<RoleAssetLore>('decor');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let actif = true;
    lireLoreAtelier().then((etat) => appliquerLorePublie(LORE_ELYNDOR_CANON, etat)).catch(() => LORE_ELYNDOR_CANON)
      .then((pool) => { if (actif) setFiches(pool.map((f) => ({ id: f.id, titre: f.titre }))); });
    return () => { actif = false; };
  }, []);
  const filtre = normaliserTexte(recherche);
  const proposees = filtre.length >= 2 ? fiches.filter((f) => normaliserTexte(f.titre).includes(filtre)).slice(0, 8) : [];
  async function associer(fiche: { id: string; titre: string }) {
    try {
      const assetId = nouvelIdentifiantAsset();
      await enregistrerAssetVisuel(assetId, image);
      await modifierAssetsLore((etat) => ajouterLienAsset(etat, fiche.id, { assetId, role, libelle: LIBELLES_ROLE_ASSET[role], ajouteLe: Date.now() }));
      setMessage(`Image rattachée à « ${fiche.titre} » (${LIBELLES_ROLE_ASSET[role]}).`);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  return <View style={st.sousBloc}>
    <Text style={st.label}>Rattacher cette image à une fiche du lorebook</Text>
    <View style={st.row}>{ROLES_ASSET_LORE.map((r) => <Pressable key={r} onPress={() => setRole(r)} style={[st.choix, role === r && st.actif]}>
      <Text style={st.nom}>{LIBELLES_ROLE_ASSET[r]}</Text></Pressable>)}</View>
    <TextInput style={st.champ} value={recherche} onChangeText={setRecherche} placeholder="Chercher une fiche (titre)…" placeholderTextColor={couleurs.texteFaible} />
    {proposees.map((f) => <Pressable key={f.id} style={st.choix} onPress={() => void associer(f)}><Text style={st.nom}>＋ {f.titre}</Text></Pressable>)}
    {message ? <Text style={st.aide}>{message}</Text> : null}
  </View>;
}

export default function AtelierApercuImage() {
  const [mode, setMode] = useState<Mode>('libre');
  const [prompt, setPrompt] = useState('');
  const [negatif, setNegatif] = useState('');
  const [format, setFormat] = useState<FormatImage>('16:9');
  const [total, setTotal] = useState(1);
  const [accord, setAccord] = useState(false);
  const [attente, setAttente] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [trace, setTrace] = useState<TraceIllustration | null>(null);
  // Aperçu libre : références choisies par identifiant.
  const [choisies, setChoisies] = useState<Map<string, ReferenceElyndor>>(new Map());
  // Aperçu de scène.
  const [histoires, setHistoires] = useState<Array<{ id: string; titre: string }>>([]);
  const [histoireId, setHistoireId] = useState<string>('');
  const [scene, setScene] = useState<ScenePreparee | null>(null);
  const [retirees, setRetirees] = useState<Set<string>>(new Set());

  useEffect(() => {
    getStoriesIndex().then((index) => {
      const liste = index.slice(0, 30).map((h: any) => ({ id: h.id, titre: h.titre ?? h.personnageNom ?? h.id }));
      setHistoires(liste);
      setHistoireId((c) => c || liste[0]?.id || '');
    }).catch(() => undefined);
  }, []);

  function basculer(ref: ReferenceElyndor) {
    setChoisies((avant) => {
      const suite = new Map(avant);
      if (suite.has(ref.id)) suite.delete(ref.id); else suite.set(ref.id, ref);
      return suite;
    });
  }

  async function candidatsLibres(): Promise<ReferenceCandidate[]> {
    const sortie: ReferenceCandidate[] = [];
    for (const ref of choisies.values()) {
      sortie.push({ id: ref.id, type: ref.type, role: ref.role, libelle: ref.libelle, uri: await ref.charger().catch(() => null), imposee: true });
    }
    return sortie;
  }

  async function preparerApercuScene(extraction: 'auto' | 'modele') {
    setAttente(true); setMessage(''); setTrace(null); setImages([]);
    try {
      const story = histoireId ? await getStory(histoireId) : null;
      if (!story) throw Error('Choisis une histoire enregistrée.');
      const preparee = await preparerScene(story, await getSettings(), 'nouvelle', { extraction });
      setScene(preparee); setRetirees(new Set());
      const resultat = await executerImage({ contrat: preparee.contrat, candidats: preparee.candidats, negatifCanon: preparee.negatifCanon,
        storyId: undefined, extraction: preparee.extraction, simulation: true, destination: 'aperçu (non enregistré)' });
      setTrace(resultat.trace);
      setMessage(preparee.regeneration ? 'Contrat repris de l’illustration déjà enregistrée pour cette scène (aucun appel IA).'
        : extraction === 'modele' ? 'Relevé fait par le narrateur. L’histoire n’a pas été modifiée.' : 'Relevé local, sans appel au narrateur. L’histoire n’a pas été modifiée.');
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setAttente(false); }
  }

  async function lancer(simulation: boolean) {
    setAttente(true); setMessage(''); if (!simulation) setImages([]);
    try {
      if (!simulation && !accord) throw Error('Confirme chaque série d’essais avant de la lancer.');
      let demande: Parameters<typeof executerImage>[0];
      if (mode === 'libre') {
        if (!prompt.trim()) throw Error('Entre un prompt avant de générer.');
        demande = { contrat: contratLibre(prompt, format, negatif), candidats: await candidatsLibres(), destination: 'aperçu (non enregistré)' };
      } else {
        if (!scene) throw Error('Prépare d’abord la scène.');
        demande = {
          contrat: scene.contrat,
          candidats: scene.candidats.filter((c) => !retirees.has(c.id)),
          retireesManuellement: scene.candidats.filter((c) => retirees.has(c.id)).map((c) => ({ id: c.id, libelle: c.libelle })),
          negatifCanon: scene.negatifCanon,
          extraction: scene.extraction,
          destination: 'aperçu (non enregistré)',
        };
      }
      if (simulation) {
        const resultat = await executerImage({ ...demande, simulation: true });
        setTrace(resultat.trace);
        setMessage('Requête préparée : rien n’a été envoyé au générateur.');
        return;
      }
      for (let i = 0; i < total; i++) {
        const resultat = await executerImage(demande);
        setTrace(resultat.trace);
        if (resultat.image) setImages((v) => [...v, resultat.image!]);
      }
      setMessage('Aperçu prêt. Il reste séparé de tes histoires : rien n’est enregistré automatiquement.');
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setAttente(false); if (!simulation) setAccord(false); }
  }

  const formatEffectif = mode === 'scene' ? '16:9' : format;
  return <View style={st.bloc}>
    <Text style={st.aide}>Les deux aperçus suivent exactement le même chemin que le jeu : identité artistique globale, réglages de l’Atelier et capacités du générateur. Aucune génération n’est lancée sans ta confirmation.</Text>
    <View style={st.row}>{(['libre', 'scene'] as const).map((m) => <Pressable key={m} onPress={() => { setMode(m); setTrace(null); setMessage(''); }}
      style={[st.choix, mode === m && st.actif]}><Text style={st.nom}>{m === 'libre' ? 'Aperçu libre' : 'Aperçu d’une scène Elyndor'}</Text></Pressable>)}</View>

    {mode === 'libre' ? <>
      <Text style={st.label}>Prompt libre (mots-clés)</Text>
      <TextInput style={[st.champ, { minHeight: 110 }]} value={prompt} onChangeText={setPrompt} multiline maxLength={3000}
        textAlignVertical="top" placeholder="Décris le sujet en mots-clés ; le style global est ajouté automatiquement…" placeholderTextColor={couleurs.texteFaible} />
      <Text style={st.label}>Exclusions de cet essai</Text>
      <TextInput style={[st.champ, { minHeight: 56 }]} value={negatif} onChangeText={setNegatif} multiline maxLength={1000}
        textAlignVertical="top" placeholder="Éléments à éviter (s’ajoutent au négatif global)" placeholderTextColor={couleurs.texteFaible} />
      <Text style={st.label}>Format</Text>
      <View style={st.row}>{(['16:9', '3:4'] as const).map((x) => <Pressable key={x} style={[st.choix, format === x && st.actif]} onPress={() => setFormat(x)}>
        <Text style={st.nom}>{x === '16:9' ? '16:9 scène' : '3:4 portrait'}</Text></Pressable>)}</View>
      <Text style={st.label}>Références Elyndor ({choisies.size} choisie{choisies.size > 1 ? 's' : ''})</Text>
      <Text style={st.aide}>Choisis des images précises (portraits, avatars, races, lorebook). Sans sélection, l’essai se fait sans référence, pour comparer.</Text>
      <SelecteurReferencesElyndor selection={new Set(choisies.keys())} onBasculer={basculer} />
      {choisies.size ? <Bouton titre="Tout désélectionner" variante="secondaire" onPress={() => setChoisies(new Map())} /> : null}
    </> : <>
      <Text style={st.label}>Histoire</Text>
      <View style={st.row}>{histoires.map((h) => <Pressable key={h.id} onPress={() => { setHistoireId(h.id); setScene(null); setTrace(null); }}
        style={[st.choix, histoireId === h.id && st.actif]}><Text style={st.nom} numberOfLines={1}>{h.titre}</Text></Pressable>)}</View>
      <Bouton titre="Préparer la dernière scène (sans IA)" variante="secondaire" desactive={attente || !histoireId} onPress={() => void preparerApercuScene('auto')} />
      <Bouton titre="Relever la scène avec le narrateur (1 appel IA)" variante="secondaire" desactive={attente || !histoireId} onPress={() => void preparerApercuScene('modele')} />
      {scene ? <>
        <Text style={st.label}>Références proposées</Text>
        <Text style={st.aide}>Même collecte et même filtrage que les illustrations du jeu. Décoche une image pour l’exclure de cet essai.</Text>
        <View style={st.grille}>{scene.candidats.map((c) => {
          const actif = !retirees.has(c.id);
          return <Pressable key={c.id} style={[st.vignette, actif && st.actif]} onPress={() => setRetirees((avant) => {
            const suite = new Set(avant); if (suite.has(c.id)) suite.delete(c.id); else suite.add(c.id); return suite;
          })}>
            {c.uri ? <Image source={{ uri: c.uri }} style={st.image} resizeMode="cover" /> : <View style={st.image}><Text style={st.aide}>introuvable</Text></View>}
            <Text style={st.legende} numberOfLines={3}>{actif ? '☑ ' : '☐ '}{c.libelle}</Text>
          </Pressable>;
        })}</View>
        {!scene.candidats.length ? <Text style={st.aide}>Aucune référence disponible pour cette scène.</Text> : null}
      </> : null}
    </>}

    <Text style={st.label}>Variantes</Text>
    <View style={st.row}>{[1, 2, 4].map((x) => <Pressable key={x} style={[st.choix, total === x && st.actif]} onPress={() => setTotal(x)}>
      <Text style={st.nom}>{x} image{x > 1 ? 's' : ''}</Text></Pressable>)}</View>
    <Bouton titre="Voir la requête sans générer" variante="secondaire" desactive={attente || (mode === 'scene' && !scene)} onPress={() => void lancer(true)} />
    <Pressable style={[st.choix, accord && st.actif]} onPress={() => setAccord((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: accord }}>
      <Text style={st.nom}>{accord ? '☑' : '☐'} Je confirme ce test ({total} génération{total > 1 ? 's' : ''}).</Text>
      <Text style={st.aide}>Cette confirmation n’est pas une estimation du prix. Vérifie les tarifs du fournisseur.</Text>
    </Pressable>
    <Bouton titre={attente ? 'En cours…' : 'Générer l’aperçu'} desactive={attente || !accord || (mode === 'libre' ? !prompt.trim() : !scene)} onPress={() => void lancer(false)} />
    {attente ? <ActivityIndicator color={couleurs.accent} /> : null}
    {images.map((uri, i) => <View key={i}>
      <ImageAgrandissable uri={uri} titre={`Aperçu ${i + 1}`} style={{ width: '100%', height: formatEffectif === '16:9' ? 230 : 310, marginTop: 8 }} />
      <AssocierAuLorebook image={uri} />
    </View>)}
    {message ? <Text style={st.aide}>{message}</Text> : null}
    {trace ? <TraceImage trace={trace} /> : null}
  </View>;
}

const st = StyleSheet.create({
  bloc: { gap: 8, marginVertical: 12 },
  sousBloc: { gap: 6, marginTop: 6 },
  aide: { fontFamily: polices.corps, fontSize: 13, lineHeight: 19, color: couleurs.texteAtténué },
  label: { fontFamily: polices.corpsMedium, fontSize: 15, color: couleurs.doreClair, marginTop: 8 },
  champ: { padding: 12, borderColor: couleurs.bordureSubtile, borderWidth: 1, borderRadius: 8, color: couleurs.texte, backgroundColor: couleurs.fondChampSaisie },
  row: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  choix: { padding: 10, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 8, gap: 4, maxWidth: 320 },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vignette: { width: 110, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 8, padding: 4, gap: 4 },
  image: { width: '100%', height: 120, borderRadius: 6, backgroundColor: couleurs.fondCarte, alignItems: 'center', justifyContent: 'center' },
  legende: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 12 },
});
