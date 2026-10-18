import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { lireAssetsLore, modifierAssetsLore } from '../concepteur/assetsLoreStore';
import {
  ajouterLienAsset, assetUtilise, modifierRoleAsset, nouvelIdentifiantAsset, retirerLienAsset,
  LIBELLES_ROLE_ASSET, ROLES_ASSET_LORE, type LienAssetLore, type RoleAssetLore,
} from '../concepteur/assetsLore';
import { enregistrerAssetVisuel, obtenirAssetVisuel, supprimerAssetVisuel } from '../storage/assetsVisuelsStore';
import { couleurs, polices } from '../theme/theme';
import Bouton from './Bouton';
import { obtenirAvatarPnj, preparerImageReference } from '../storage/pnjAvatarsStore';
import { executerImage } from '../engine/serviceVisuel';
import { CADRAGE_PORTRAIT } from '../engine/cadrageVisuel';
import type { ContratVisuel } from '../engine/contratVisuel';
import SelecteurReferencesElyndor, { type ReferenceElyndor } from './SelecteurReferencesElyndor';

/**
 * Références visuelles optionnelles d'une fiche du lorebook. La fiche elle-même
 * n'est pas modifiée : seuls des liens vers des images enregistrées à part.
 */
export default function ReferencesVisuellesFiche({ ficheId, titre = '', description = '', avatarSource }: { ficheId: string; titre?: string; description?: string; avatarSource?: { storyId: string; pnjId: string } }) {
  const [liens, setLiens] = useState<LienAssetLore[]>([]);
  const [uris, setUris] = useState<Record<string, string | null>>({});
  const [ajout, setAjout] = useState(false);
  const [role, setRole] = useState<RoleAssetLore>('decor');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function recharger() {
    const etat = await lireAssetsLore();
    const actuels = etat.liens[ficheId] ?? [];
    setLiens(actuels);
    const trouves: Record<string, string | null> = {};
    for (const l of actuels) trouves[l.assetId] = await obtenirAssetVisuel(l.assetId).catch(() => null);
    setUris(trouves);
  }

  useEffect(() => { void recharger().catch((e) => setMessage(e instanceof Error ? e.message : String(e))); }, [ficheId]);

  async function importerPortraitPnj() {
    if (!avatarSource || busy) return;
    setBusy(true); setMessage('');
    try {
      const existants = await lireAssetsLore();
      if ((existants.liens[ficheId] ?? []).some(l => l.role === 'identite')) {
        setMessage('Un portrait existe déjà : aucun remplacement automatique.');
        return;
      }
      const uri = await obtenirAvatarPnj(avatarSource.storyId, avatarSource.pnjId);
      if (!uri) { setMessage('Aucun portrait enregistré dans cette histoire. Tu peux en générer un.'); return; }
      const data = await preparerImageReference(uri);
      const assetId = nouvelIdentifiantAsset();
      await enregistrerAssetVisuel(assetId, data);
      await modifierAssetsLore(v => ajouterLienAsset(v, ficheId, {
        assetId, role: 'identite', libelle: ('Portrait de ' + titre).slice(0, 120), ajouteLe: Date.now(),
      }));
      await recharger();
      setMessage('Portrait du PNJ importé dans le lorebook général.');
    } catch(e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function ajouter(ref: ReferenceElyndor) {
    try {
      const image = await ref.charger();
      if (!image) throw new Error('Image illisible.');
      const assetId = nouvelIdentifiantAsset();
      await enregistrerAssetVisuel(assetId, image);
      await modifierAssetsLore((etat) => ajouterLienAsset(etat, ficheId, { assetId, role, libelle: ref.libelle.slice(0, 120), ajouteLe: Date.now() }));
      setMessage('Image rattachée à la fiche.');
      await recharger();
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  async function generer() {
    if (busy || !titre.trim() || !description.trim()) return;
    setBusy(true); setMessage('');
    try {
      const contrat: ContratVisuel = {
        version: 1, origine: 'portrait', format: '3:4', typeScene: 'dialogue',
        lieu: [], instant: [], eclairage: [], horsCadre: [], mentionnes: [],
        figurants: [], action: [], elementsObligatoires: [], decor: [],
        exclusions: [], cadrage: { ...CADRAGE_PORTRAIT },
        provenance: ['fiche lorebook'], rejets: [],
        personnages: [{
          cle: ficheId, nom: titre, type: 'canon', principal: true,
          identite: [titre], apparence: [], tenue: [], etat: [], action: [],
          position: [], sources: { identite: 'fiche' },
        }],
        texteLibre: 'Portrait de référence du personnage ' + titre + '. ' + description.slice(0, 3000),
      };
      const resultat = await executerImage({ contrat, destination: 'portrait lore ' + ficheId });
      if (!resultat.image) throw new Error('Aucune image générée.');
      setPreview(resultat.image);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function valider() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const assetId = nouvelIdentifiantAsset();
      await enregistrerAssetVisuel(assetId, preview);
      const anciens = liens.filter(l => l.role === 'identite');
      const etat = await modifierAssetsLore(v => {
        let prochain = v;
        for (const ancien of anciens) prochain = retirerLienAsset(prochain, ficheId, ancien.assetId);
        return ajouterLienAsset(prochain, ficheId, {
          assetId, role: 'identite', libelle: ('Portrait de ' + titre).slice(0, 120), ajouteLe: Date.now(),
        });
      });
      for (const ancien of anciens) {
        if (!assetUtilise(etat, ancien.assetId)) await supprimerAssetVisuel(ancien.assetId).catch(() => undefined);
      }
      setPreview(null);
      await recharger();
      setMessage('Portrait enregistré.');
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function retirer(assetId: string) {
    try {
      const apres = await modifierAssetsLore((etat) => retirerLienAsset(etat, ficheId, assetId));
      if (!assetUtilise(apres, assetId)) await supprimerAssetVisuel(assetId).catch(() => undefined);
      await recharger();
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  async function changerRole(assetId: string, nouveau: RoleAssetLore) {
    await modifierAssetsLore((etat) => modifierRoleAsset(etat, ficheId, assetId, nouveau)).catch(() => undefined);
    await recharger();
  }

  return <View style={st.bloc}>
    <Text style={st.label}>Références visuelles (optionnel)</Text>
    {avatarSource ? <Bouton titre="Importer le portrait du PNJ depuis son histoire" onPress={() => void importerPortraitPnj()} desactive={busy} /> : null}
    <Bouton titre={liens.some(l => l.role === 'identite') ? 'Régénérer le portrait depuis la fiche' : 'Générer le portrait depuis la fiche'} onPress={() => void generer()} desactive={busy || !titre.trim() || !description.trim()} />
    {busy ? <Text style={st.aide}>Traitement en cours…</Text> : null}
    {preview ? <View style={st.bloc}>
      <Image source={{ uri: preview }} style={{ width: 210, height: 280 }} />
      <Bouton titre="Valider ce portrait" onPress={() => void valider()} desactive={busy} />
      <Bouton titre="Conserver l’ancien portrait" variante="secondaire" onPress={() => setPreview(null)} desactive={busy} />
    </View> : null}
    <Text style={st.aide}>Images utilisées par les illustrations quand cette fiche concerne le lieu actuel ou un personnage visible. Elles ne sont jamais envoyées au narrateur ni copiées dans la fiche ; l’export JSON du lorebook ne les contient pas.</Text>
    {liens.map((l) => <View key={l.assetId} style={st.ligneAsset}>
      {uris[l.assetId] ? <Image source={{ uri: uris[l.assetId]! }} style={st.image} /> : <View style={st.image}><Text style={st.alerte}>introuvable</Text></View>}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={st.nom}>{l.libelle}</Text>
        {!uris[l.assetId] ? <Text style={st.alerte}>Fichier introuvable (supprimé ou autre appareil) : la fiche reste utilisable, la référence est ignorée.</Text> : null}
        <View style={st.row}>{ROLES_ASSET_LORE.map((r) => <Pressable key={r} onPress={() => void changerRole(l.assetId, r)}
          style={[st.puce, l.role === r && st.actif]}><Text style={st.petit}>{LIBELLES_ROLE_ASSET[r]}</Text></Pressable>)}</View>
        <Bouton titre="Retirer" variante="secondaire" onPress={() => void retirer(l.assetId)} />
      </View>
    </View>)}
    <Bouton titre={ajout ? 'Fermer le choix d’images' : 'Ajouter une image Elyndor existante'} variante="secondaire" onPress={() => setAjout((v) => !v)} />
    {ajout ? <>
      <Text style={st.aide}>Rôle de la prochaine image :</Text>
      <View style={st.row}>{ROLES_ASSET_LORE.map((r) => <Pressable key={r} onPress={() => setRole(r)} style={[st.puce, role === r && st.actif]}>
        <Text style={st.petit}>{LIBELLES_ROLE_ASSET[r]}</Text></Pressable>)}</View>
      <SelecteurReferencesElyndor selection={new Set()} onBasculer={(ref) => void ajouter(ref)} sansLore />
      <Text style={st.aide}>Pour une image nouvelle : génère-la dans l’aperçu de l’Atelier visuel, puis « Rattacher cette image à une fiche ».</Text>
    </> : null}
    {message ? <Text style={st.aide}>{message}</Text> : null}
  </View>;
}

const st = StyleSheet.create({
  bloc: { gap: 6, marginTop: 10 },
  label: { fontFamily: polices.corpsMedium, fontSize: 15, color: couleurs.doreClair },
  aide: { fontFamily: polices.corps, fontSize: 13, lineHeight: 18, color: couleurs.texteAtténué },
  alerte: { fontFamily: polices.corps, fontSize: 12, color: couleurs.danger },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 14 },
  petit: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puce: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 12 },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  ligneAsset: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 8, padding: 8 },
  image: { width: 90, height: 100, borderRadius: 6, backgroundColor: couleurs.fondCarte, alignItems: 'center', justifyContent: 'center' },
});
