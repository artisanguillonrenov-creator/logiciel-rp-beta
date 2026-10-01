import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  abonnerCloud,
  connexionCloud,
  connexionGoogleCloud,
  connexionGoogleDisponible,
  deconnexionCloud,
  inscriptionCloud,
  lireEtatCloud,
  synchroniserMaintenant,
  type EtatCloud,
} from '../cloud/serviceCloud';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';
import { BoussoleOrnement } from '../components/Ornements';
import { useLangue } from '../i18n/LangueProvider';
import { couleurs, espacement, interfaceV2, polices, stylePetitesCapitales } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Compte'>;

const IMAGE_COMPTE = require('../../assets/scenes/accueil.png');

function formaterHeure(date?: number): string {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Écran de compte de la V13 (« Retrouve ton histoire ») : connexion pour
// retrouver histoires, personnages et réglages sur tous ses appareils, ou
// jeu en invité, entièrement local.
export default function CompteScreen({ navigation }: Props) {
  const { t } = useLangue();
  const { width } = useWindowDimensions();
  const [etat, setEtat] = useState<EtatCloud>(lireEtatCloud());
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [formulaireOuvert, setFormulaireOuvert] = useState(!connexionGoogleDisponible);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);

  useEffect(() => abonnerCloud(setEtat), []);

  async function agir(action: () => Promise<void>) {
    setEnCours(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage({ texte: e instanceof Error ? e.message : t('Action impossible pour le moment.'), erreur: true });
    } finally {
      setEnCours(false);
    }
  }

  function formulaireValide(): boolean {
    if (!email.trim().includes('@') || motDePasse.length < 6) {
      setMessage({ texte: t('Entre un e-mail valide et un mot de passe d’au moins 6 caractères.'), erreur: true });
      return false;
    }
    return true;
  }

  const connecte = !!etat.utilisateur;
  const statut = etat.statut === 'synchronisation'
    ? t('Synchronisation…')
    : etat.statut === 'erreur'
      ? etat.erreur ?? t('Synchronisation impossible pour le moment.')
      : etat.statut === 'a_jour'
        ? `${t('À jour')} · ${formaterHeure(etat.derniereSynchro)}`
        : t('En attente');

  return (
    <FondAtmospherique style={{ flex: 1 }} imageFond={IMAGE_COMPTE}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.entete}>
          <BoussoleOrnement largeur={width < 500 ? 120 : 150} style={styles.boussole} />
          <Text style={styles.surtitre}>{t('ENTREZ DANS LE MONDE')}</Text>
          <Text style={styles.logo}>ELYNDOR</Text>
          <Text style={styles.devise}>{t('Vos décisions laissent des traces.')}</Text>
        </View>

        <Panneau variante="or" style={styles.carte}>
          {!etat.pret ? (
            <ActivityIndicator color={couleurs.dore} />
          ) : connecte ? (
            <>
              <Text style={styles.kicker}>{t('COMPTE ELYNDOR')}</Text>
              <Text style={styles.titre}>{etat.utilisateur?.nom || etat.utilisateur?.email}</Text>
              {etat.utilisateur?.nom && etat.utilisateur.email ? <Text style={styles.sousTitre}>{etat.utilisateur.email}</Text> : null}
              <Text style={styles.sousTitre}>
                {t('Tes histoires, personnages et réglages se synchronisent entre tes appareils. Les clés API restent sur chaque appareil.')}
              </Text>
              <View style={styles.statut}>
                <Text style={styles.labelStatut}>{t('SYNCHRONISATION')}</Text>
                <Text style={[styles.valeurStatut, etat.statut === 'erreur' && { color: couleurs.danger }]}>{statut}</Text>
              </View>
              <Bouton
                titre={etat.statut === 'synchronisation' ? t('Synchronisation…') : t('Synchroniser maintenant')}
                icone="sceau"
                onPress={() => agir(synchroniserMaintenant)}
                desactive={enCours || etat.statut === 'synchronisation'}
                style={styles.bouton}
              />
              <Bouton titre={t('Se déconnecter')} variante="secondaire" onPress={() => agir(deconnexionCloud)} desactive={enCours} style={styles.bouton} />
            </>
          ) : (
            <>
              <Text style={styles.kicker}>{t('AVANT DE COMMENCER')}</Text>
              <Text style={styles.titre}>{t('Retrouve ton histoire')}</Text>
              <Text style={styles.sousTitre}>
                {t('Connecte-toi pour synchroniser tes histoires, personnages et réglages entre tes navigateurs et tes appareils, ou continue simplement en invité.')}
              </Text>
              {connexionGoogleDisponible && (
                <>
                  <Bouton titre={t('Continuer avec Google')} onPress={() => agir(async () => connexionGoogleCloud())} desactive={enCours} style={styles.bouton} />
                  <Separateur />
                  {!formulaireOuvert && (
                    <Bouton titre={t('Se connecter par e-mail')} icone="courrier" variante="secondaire" onPress={() => setFormulaireOuvert(true)} style={styles.bouton} />
                  )}
                </>
              )}
              {formulaireOuvert && (
                <View style={styles.formulaire}>
                  <Champ
                    label={t('Adresse e-mail')}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="nom@exemple.fr"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                  <Champ
                    label={t('Mot de passe')}
                    value={motDePasse}
                    onChangeText={setMotDePasse}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                    conteneurStyle={{ marginTop: espacement.sm }}
                    onSubmitEditing={() => formulaireValide() && agir(() => connexionCloud(email, motDePasse))}
                  />
                  <View style={styles.rangee}>
                    <Bouton
                      titre={t('Connexion')}
                      variante="arcane"
                      onPress={() => formulaireValide() && agir(() => connexionCloud(email, motDePasse))}
                      desactive={enCours}
                      style={styles.boutonRangee}
                    />
                    <Bouton
                      titre={t('Créer un compte')}
                      variante="secondaire"
                      onPress={() => formulaireValide() && agir(async () => {
                        const pret = await inscriptionCloud(email, motDePasse);
                        if (!pret) setMessage({ texte: t('Compte créé. Vérifie ton e-mail pour confirmer ton adresse, puis connecte-toi.'), erreur: false });
                      })}
                      desactive={enCours}
                      style={styles.boutonRangee}
                    />
                  </View>
                </View>
              )}
              <Bouton
                titre={t('Continuer en invité')}
                icone="invite"
                variante="secondaire"
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Demarrage'))}
                style={styles.bouton}
              />
            </>
          )}
          {enCours ? <ActivityIndicator color={couleurs.dore} style={{ marginTop: espacement.sm }} /> : null}
          {message ? <Text style={[styles.message, message.erreur && { color: couleurs.danger }]}>{message.texte}</Text> : null}
          <Text style={styles.note}>{t('Les clés API et les sessions des fournisseurs IA restent locales et ne sont jamais copiées dans le cloud Elyndor.')}</Text>
        </Panneau>
      </ScrollView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacement.lg,
    gap: espacement.lg,
  },
  entete: { alignItems: 'center' },
  boussole: { marginBottom: espacement.sm },
  surtitre: { ...stylePetitesCapitales, fontFamily: polices.displaySemiGras, color: couleurs.dore, fontSize: 11, letterSpacing: 3.5 },
  logo: { fontFamily: polices.display, color: '#F1D189', fontSize: 52, letterSpacing: 7, marginTop: espacement.xs },
  devise: { fontFamily: polices.corps, color: couleurs.texte, fontSize: 19, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  carte: {
    width: '100%',
    maxWidth: interfaceV2.largeurPanneauMax + 140,
    padding: espacement.xl,
  },
  kicker: { ...stylePetitesCapitales, fontFamily: polices.displaySemiGras, color: couleurs.dore, fontSize: 11, letterSpacing: 3, textAlign: 'center' },
  titre: { fontFamily: polices.titre, color: couleurs.texte, fontSize: 34, textAlign: 'center', marginTop: espacement.sm },
  sousTitre: { fontFamily: polices.corps, color: couleurs.texteAtténué, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: espacement.sm, marginBottom: espacement.md },
  bouton: { marginTop: espacement.sm, minHeight: 56 },
  formulaire: { marginTop: espacement.sm },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.sm, marginTop: espacement.sm },
  boutonRangee: { flexGrow: 1, flexBasis: 160 },
  statut: { borderLeftWidth: 2, borderLeftColor: couleurs.dore, paddingLeft: espacement.sm, marginBottom: espacement.sm },
  labelStatut: { ...stylePetitesCapitales, color: couleurs.texteAtténué, fontSize: 10 },
  valeurStatut: { fontFamily: polices.corpsMedium, color: couleurs.texte, fontSize: 16, marginTop: 2 },
  message: { fontFamily: polices.corps, color: couleurs.texteAtténué, fontSize: 15, textAlign: 'center', marginTop: espacement.md },
  note: { fontFamily: polices.corps, color: couleurs.texteFaible, fontSize: 13, textAlign: 'center', marginTop: espacement.lg },
});
