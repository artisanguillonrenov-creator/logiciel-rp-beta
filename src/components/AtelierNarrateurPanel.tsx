import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { couleurs, espacement, polices } from '../theme/theme';
import { type EtatAtelier, type ConfigurationAtelier, type ProfilAtelier, PROFILS_ATELIER, LIMITES_ATELIER } from '../concepteur/configuration';
import { lireConfigurationAtelier, enregistrerEtatAtelier } from '../concepteur/depotConfiguration';
import { CLES_SAMPLERS, SAMPLERS_LLAMA_CPP, type CleSampler, type PlagesLongueur, type ReglagesNarrateur } from '../concepteur/reglagesNarrateur';
import type { Longueur } from '../types';

type Partie = 'fondamentales' | 'styles' | 'aventures' | 'technique';
const PARTIES: Array<{ id: Partie; nom: string }> = [
  { id: 'fondamentales', nom: 'Règles' },
  { id: 'styles', nom: 'Styles' },
  { id: 'aventures', nom: 'Aventure' },
  { id: 'technique', nom: 'Technique' },
];
const NOMS: Record<ProfilAtelier, string> = { production: 'Production', test: 'Test', benchmark: 'Benchmark' };
const LONGUEURS: Array<{ id: Longueur; nom: string }> = [
  { id: 'courte', nom: 'Court' }, { id: 'moyenne', nom: 'Moyen' }, { id: 'longue', nom: 'Long' },
];
const STYLES = [
  { nom: 'Cinématique', description: 'Scènes fortes et descriptions visuelles.' },
  { nom: 'Immersif', description: 'Monde crédible, dense et sensoriel.' },
  { nom: 'Libre', description: 'Exploration, secrets et initiatives du joueur.' },
  { nom: 'Aventure', description: 'Découverte et rythme plus léger.' },
];
type PlagesSaisie = Record<Longueur, { min: string; max: string }>;
function saisieDepuis(plages: PlagesLongueur): PlagesSaisie {
  return { courte: { min: String(plages.courte.min), max: String(plages.courte.max) },
    moyenne: { min: String(plages.moyenne.min), max: String(plages.moyenne.max) },
    longue: { min: String(plages.longue.min), max: String(plages.longue.max) } };
}
function formatNombre(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Curseur tactile sans dépendance native supplémentaire ; sauvegarde à la fin du geste. */
function Curseur({ nom, valeur, min, max, pas, onChange, bloque }: {
  nom: string; valeur: number; min: number; max: number; pas: number;
  onChange: (valeur: number) => void; bloque: boolean;
}) {
  const [largeur, setLargeur] = useState(1);
  const [brouillon, setBrouillon] = useState<number | null>(null);
  const actuel = brouillon ?? valeur;
  const lirePosition = (ev: GestureResponderEvent) => {
    const ratio = Math.max(0, Math.min(1, ev.nativeEvent.locationX / largeur));
    const result = min + Math.round(((max - min) * ratio) / pas) * pas;
    return Number(Math.max(min, Math.min(max, result)).toFixed(4));
  };
  return <View style={styles.ligne}>
    <View style={styles.ligneEntete}>
      <Text style={styles.nom}>{nom}</Text>
      <Text style={styles.chiffre}>{formatNombre(actuel)}</Text>
    </View>
    <View accessibilityRole="adjustable"
      accessibilityLabel={nom}
      accessibilityValue={{ min, max, now: actuel }}
      onAccessibilityAction={ev => {
        if (bloque) return;
        if (ev.nativeEvent.actionName === 'increment') onChange(Math.min(max, Number((valeur + pas).toFixed(4))));
        if (ev.nativeEvent.actionName === 'decrement') onChange(Math.max(min, Number((valeur - pas).toFixed(4))));
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      style={[styles.zoneCurseur, bloque && styles.desactive]}
      onLayout={e => setLargeur(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !bloque}
      onMoveShouldSetResponder={() => !bloque}
      onResponderGrant={ev => setBrouillon(lirePosition(ev))}
      onResponderMove={ev => setBrouillon(lirePosition(ev))}
      onResponderRelease={ev => { const prochain = lirePosition(ev); setBrouillon(null); if (prochain !== valeur) onChange(prochain); }}
      onResponderTerminate={() => setBrouillon(null)}>
      <View style={styles.piste}>
        <View style={[styles.progression, { width: ((actuel - min) / (max - min)) * largeur }]} />
      </View>
      <View style={[styles.poignee, { left: ((actuel - min) / (max - min)) * largeur }]} />
    </View>
    <View style={styles.bornes}><Text style={styles.aideMini}>{formatNombre(min)}</Text><Text style={styles.aideMini}>{formatNombre(max)}</Text></View>
  </View>;
}

export default function AtelierNarrateurPanel() {
  const [config, setConfig] = useState<ConfigurationAtelier | null>(null);
  const [partie, setPartie] = useState<Partie>('technique');
  const [chargement, setChargement] = useState(true);
  const [operation, setOperation] = useState(false);
  const [info, setInfo] = useState('');
  const [erreur, setErreur] = useState('');
  const [plagesSaisie, setPlagesSaisie] = useState<PlagesSaisie | null>(null);

  useEffect(() => {
    let actif = true;
    lireConfigurationAtelier().then(c => { if (actif) { setConfig(c); setPlagesSaisie(saisieDepuis(c.profils[c.profilActif].narrateur.longueurs)); } })
      .catch(e => { if (actif) setErreur(String(e)); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, []);

  async function sauver(etat: EtatAtelier, motif: string) {
    if (operation) return;
    setOperation(true); setErreur(''); setInfo('');
    try {
      const suivant = await enregistrerEtatAtelier(etat, motif);
      setConfig(suivant);
      setInfo('Enregistré : effectif au prochain tour narratif de ce profil.');
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setOperation(false); }
  }
  const profil: ProfilAtelier = config?.profilActif ?? 'production';
  const valeurs = profil ? config?.profils[profil] : undefined;
  const narrateur = valeurs?.narrateur;

  function changerProfil(prochain: ProfilAtelier) {
    if (!config || operation || config.profilActif === prochain) return;
    setPlagesSaisie(saisieDepuis(config.profils[prochain].narrateur.longueurs));
    void sauver({ profilActif: prochain, profils: config.profils }, 'Profil narrateur ' + prochain);
  }
  function changerNarrateur(prochain: ReglagesNarrateur, motif: string) {
    if (!config || !profil) return;
    void sauver({ profilActif: profil,
      profils: { ...config.profils, [profil]: { ...config.profils[profil], narrateur: prochain } },
    }, motif);
  }
  function enregistrerLongueurs() {
    if (!narrateur || !plagesSaisie) return;
    const nouvelles = {} as PlagesLongueur;
    for (const cle of ['courte', 'moyenne', 'longue'] as Longueur[]) {
      const { min, max } = plagesSaisie[cle];
      if (!/^\d+$/.test(min) || !/^\d+$/.test(max)) { setErreur('Saisis des nombres entiers.'); return; }
      nouvelles[cle] = { min: Number(min), max: Number(max) };
    }
    changerNarrateur({ ...narrateur, longueurs: nouvelles }, 'Fourchettes narrateur');
  }

  if (chargement) return <ActivityIndicator color={couleurs.accent} />;
  if (!config || !narrateur || !valeurs) return <Text style={styles.erreur}>{erreur || 'Configuration indisponible.'}</Text>;

  const groupes = ['Distribution', 'Répétitions', 'DRY', 'Expert'];
  return <View>
    <Text style={styles.titre}>Narrateur IA</Text>
    <Text style={styles.aide}>Réglages propres au pod llama.cpp. Les curseurs sont appliqués à la narration seulement, jamais aux outils. Profil Production utilisé pour les aventures normales de cet appareil.</Text>
    <View style={styles.onglets}>
      {PROFILS_ATELIER.map(p => <Pressable key={p} onPress={() => changerProfil(p)}
        disabled={operation} style={[styles.onglet, p === profil && styles.actif]}>
        <Text style={styles.nom}>{NOMS[p]}</Text>
      </Pressable>)}
    </View>
    <View style={styles.onglets}>
      {PARTIES.map(p => <Pressable key={p.id} onPress={() => setPartie(p.id)}
        style={[styles.onglet, p.id === partie && styles.actif]}>
        <Text style={styles.nom}>{p.nom}</Text>
      </Pressable>)}
    </View>
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    {info ? <Text style={styles.succes}>{info}</Text> : null}
    {partie === 'fondamentales' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Règles fondamentales</Text>
      <Text style={styles.aide}>Le canon, l'identité du narrateur, l'autonomie du joueur et les 15 responsabilités M01–M15 restent protégés par le code. Aucun interrupteur ne peut les désactiver. L'éditeur de versions de ces règles fera l'objet d'un chantier séparé.</Text>
    </View>}
    {partie === 'styles' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Quatre styles existants</Text>
      {STYLES.map(s => <View key={s.nom} style={styles.ligne}><Text style={styles.nom}>{s.nom}</Text><Text style={styles.aide}>{s.description}</Text></View>)}
      <Text style={styles.aide}>Styles déjà choisis par le joueur. Les descriptions sont consultables ; leurs modifications ne sont pas encore proposées afin de ne pas doubler les instructions du prompt.</Text>
    </View>}
    {partie === 'aventures' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Fourchettes de narration (tokens)</Text>
      <Text style={styles.aide}>Deux champs numériques par longueur. Les limites concernent uniquement le texte visible, pas le bloc d'état interne. La clôture naturelle reste prioritaire.</Text>
      {LONGUEURS.map(p => <View key={p.id} style={styles.ligne}>
        <Text style={styles.nom}>{p.nom}</Text>
        <View style={styles.champs}>
          <View style={styles.champ}><Text style={styles.aideMini}>Minimum</Text><TextInput style={styles.saisie} keyboardType="number-pad" selectTextOnFocus
            value={plagesSaisie?.[p.id].min ?? ''} onChangeText={v => setPlagesSaisie(prev => prev && ({ ...prev, [p.id]: { ...prev[p.id], min: v } }))}/></View>
          <View style={styles.champ}><Text style={styles.aideMini}>Maximum</Text><TextInput style={styles.saisie} keyboardType="number-pad" selectTextOnFocus
            value={plagesSaisie?.[p.id].max ?? ''} onChangeText={v => setPlagesSaisie(prev => prev && ({ ...prev, [p.id]: { ...prev[p.id], max: v } }))}/></View>
        </View>
      </View>)}
      <Pressable disabled={operation} onPress={enregistrerLongueurs} style={styles.bouton}><Text style={styles.boutonTexte}>Enregistrer les trois fourchettes</Text></Pressable>
      <Text style={styles.aide}>Violence, romance, humour, rythme et liberté continuent à être choisis par le joueur lors de la création de son aventure.</Text>
    </View>}
    {partie === 'technique' && <View style={styles.section}>
      <Text style={styles.sousTitre}>Échantillonnage — llama.cpp</Text>
      <Pressable disabled={operation} onPress={() => changerNarrateur({ ...narrateur, samplersActifs: !narrateur.samplersActifs }, 'Samplers narrateur')}
        style={[styles.bouton, narrateur.samplersActifs && styles.boutonActif]}>
        <Text style={styles.boutonTexte}>{narrateur.samplersActifs ? 'Samplers personnalisés : ACTIVÉS' : 'Activer les samplers personnalisés'}</Text>
      </Pressable>
      <Text style={styles.aide}>Désactivés : llama.cpp conserve les valeurs de son serveur. Activés : les 19 valeurs ci-dessous sont réellement transmises à chaque génération narrative. Le binaire du pod doit prendre en charge ces paramètres.</Text>
      <Curseur nom="Correction de température du joueur" valeur={valeurs.temperatureDelta}
        min={LIMITES_ATELIER.temperatureDelta.min} max={LIMITES_ATELIER.temperatureDelta.max}
        pas={LIMITES_ATELIER.temperatureDelta.pas} bloque={operation}
        onChange={v => void sauver({ profilActif: profil, profils: { ...config.profils,
          [profil]: { ...valeurs, temperatureDelta: v } } }, 'Température narrateur')} />
      {groupes.map(groupe => <View key={groupe}>
        <Text style={styles.sousTitre}>{groupe}</Text>
        {CLES_SAMPLERS.filter(k => SAMPLERS_LLAMA_CPP[k].groupe === groupe).map((cle: CleSampler) => {
          const spec = SAMPLERS_LLAMA_CPP[cle];
          return <Curseur key={cle} nom={spec.nom} valeur={narrateur.samplers[cle]}
            min={spec.min} max={spec.max} pas={spec.pas}
            bloque={operation || !narrateur.samplersActifs}
            onChange={v => changerNarrateur({ ...narrateur, samplers: { ...narrateur.samplers, [cle]: v } }, 'Sampler ' + cle)} />;
        })}
      </View>)}
      <Text style={styles.aide}>Mirostat peut neutraliser Top-K, Top-P et Typical-P. Paramètres non exposés : Top-A, TFS, Smoothing, Repeat Slope et autres non vérifiés sur ce backend. Une validation sur le pod actif reste nécessaire.</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  titre: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 22, marginBottom: 10 },
  sousTitre: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 19, marginVertical: 14 },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  aideMini: { color: couleurs.texteAtténué, fontSize: 12 },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 15 },
  chiffre: { color: couleurs.doreClair, fontSize: 15, fontWeight: '600' },
  onglets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  onglet: { borderColor: couleurs.bordureSubtile, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  section: { marginTop: 10 },
  ligne: { borderBottomColor: couleurs.bordureSubtile, borderBottomWidth: 1, paddingVertical: 12 },
  ligneEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  zoneCurseur: { height: 40, justifyContent: 'center', marginHorizontal: 8 },
  piste: { height: 6, backgroundColor: couleurs.fondProfond, borderRadius: 6, overflow: 'hidden' },
  progression: { height: '100%', backgroundColor: couleurs.accent },
  poignee: { position: 'absolute', top: 11, marginLeft: -9, height: 18, width: 18, borderRadius: 9, backgroundColor: couleurs.dore },
  desactive: { opacity: 0.4 },
  bornes: { flexDirection: 'row', justifyContent: 'space-between' },
  champs: { flexDirection: 'row', gap: 12, marginTop: 8 },
  champ: { flex: 1 },
  saisie: { color: couleurs.texte, borderColor: couleurs.bordureDoree, borderWidth: 1, borderRadius: 8, backgroundColor: couleurs.fondChampSaisie, fontSize: 18, padding: 10 },
  bouton: { backgroundColor: couleurs.accentSombre, borderRadius: 10, padding: 13, marginVertical: 12, alignItems: 'center' },
  boutonActif: { backgroundColor: couleurs.doreSombre },
  boutonTexte: { color: couleurs.texte, fontWeight: '600', fontSize: 14 },
  erreur: { color: couleurs.danger, marginBottom: 8 },
  succes: { color: couleurs.succes, marginBottom: 8 },
});
