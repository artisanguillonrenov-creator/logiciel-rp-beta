import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ecrireGroupesSynonymes, lireGroupesSynonymes, SYNONYMES_PAR_DEFAUT } from '../engine/synonymesLexicaux';
import { chargerSynonymesPersonnalises, enregistrerSynonymesPersonnalises } from '../concepteur/synonymesStore';
import { couleurs, polices } from '../theme/theme';
import Bouton from './Bouton';

/**
 * Synonymes de la recherche du lore : un mot de la question du joueur
 * (« auberge ») retrouve aussi les fiches qui emploient un autre mot
 * (« taverne »). Un synonyme compte un peu moins qu'un mot exact et ne crée
 * jamais d'ancre canonique.
 */
export default function SynonymesRecherche() {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!ouvert) return;
    chargerSynonymesPersonnalises().then((g) => setTexte(ecrireGroupesSynonymes(g))).catch(() => undefined);
  }, [ouvert]);

  async function enregistrer() {
    try {
      const groupes = await enregistrerSynonymesPersonnalises(lireGroupesSynonymes(texte));
      setTexte(ecrireGroupesSynonymes(groupes));
      setMessage(`${groupes.length} groupe(s) enregistré(s) : actifs dès le prochain tour.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  return <View style={st.bloc}>
    <Bouton titre={ouvert ? 'Fermer les synonymes de recherche' : 'Synonymes de recherche'} variante="secondaire" onPress={() => setOuvert((v) => !v)} />
    {ouvert ? <>
      <Text style={st.aide}>Une ligne par groupe, mots séparés par des virgules (ex. : auberge, taverne, gargote). Ils s’ajoutent aux groupes fournis par défaut ci-dessous. Les accents et majuscules sont ignorés.</Text>
      <TextInput style={st.champ} value={texte} onChangeText={setTexte} multiline textAlignVertical="top"
        placeholder="auberge, taverne" placeholderTextColor={couleurs.texteFaible} autoCapitalize="none" />
      <Bouton titre="Enregistrer les synonymes" onPress={() => void enregistrer()} />
      {message ? <Text style={st.aide}>{message}</Text> : null}
      <Text style={st.label}>Groupes fournis par défaut</Text>
      <Text style={st.aide} selectable>{ecrireGroupesSynonymes(SYNONYMES_PAR_DEFAUT)}</Text>
    </> : null}
  </View>;
}

const st = StyleSheet.create({
  bloc: { gap: 6, marginVertical: 8 },
  label: { fontFamily: polices.corpsMedium, fontSize: 14, color: couleurs.doreClair, marginTop: 6 },
  aide: { fontFamily: polices.corps, fontSize: 13, lineHeight: 18, color: couleurs.texteAtténué },
  champ: { minHeight: 120, padding: 12, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 10, color: couleurs.texte, backgroundColor: couleurs.fondChampSaisie },
});
