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
import SelecteurReferencesElyndor, { type ReferenceElyndor } from './SelecteurReferencesElyndor';

/**
 * Références visuelles optionnelles d'une fiche du lorebook. La fiche elle-même
 * n'est pas modifiée : seuls des liens vers des images enregistrées à part.
 */
export default function ReferencesVisuellesFiche({ ficheId }: { ficheId: string }) {
  const [liens, setLiens] = useState<LienAssetLore[]>([]);
  const [uris, setUris] = useState<Record<string, string | null>>({});
  const [ajout, setAjout] = useState(false);
  const [role, setRole] = useState<RoleAssetLore>('decor');
  const [message, setMessage] = useState('');

  async function recharger() {
    const etat = await lireAssetsLore();
    const actuels = etat.liens[ficheId] ?? [];
    setLiens(actuels);
    const trouves: Record<string, string | null> = {};
    for (const l of actuels) trouves[l.assetId] = await obtenirAssetVisuel(l.assetId).catch(() => null);
    setUris(trouves);
  }

  useEffect(() => { void recharger().catch((e) => setMessage(e instanceof Error ? e.message : String(e))); }, [ficheId]);

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
