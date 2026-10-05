import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, ProfilContenu } from '../types';
import { getSettings, saveSettings } from '../storage/storage';
import { verifierMiseAJour } from '../engine/updater';
import { VERSION_APP } from '../version';
import { ELYNDOR_CLOUD_MODELE } from '../engine/elyndorCloud';
import { couleurs, espacement, polices, rayon } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import { useLangue } from '../i18n/LangueProvider';
import { useEtatCloud } from '../cloud/useEtatCloud';

type Props = NativeStackScreenProps<RootStackParamList, 'Reglages'>;

const IMAGE_REGLAGES = require('../../assets/scenes/creation-preferences.png');

export default function CloudOnlySettingsScreen({ navigation }: Props) {
  const { t } = useLangue();
  const cloud = useEtatCloud();

  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const [profilContenu, setProfilContenu] = useState<ProfilContenu | undefined>();
  const [codeDeverrouillage, setCodeDeverrouillage] = useState<string | undefined>();
  const [modalProfilOuvert, setModalProfilOuvert] = useState(false);
  const [codeSaisi, setCodeSaisi] = useState('');
  const [erreurProfil, setErreurProfil] = useState('');
  const [verificationMaj, setVerificationMaj] = useState(false);
  const [messageMaj, setMessageMaj] = useState('');
  const [urlMaj, setUrlMaj] = useState('');

  function chargerReglages() {
    setChargement(true);
    setErreurChargement('');
    getSettings()
      .then((settings) => {
        setProfilContenu(settings.profilContenu);
        setCodeDeverrouillage(settings.codeDeverrouillage);
      })
      .catch(() => {
        setErreurChargement(t('Impossible de lire les réglages. Réessaie après avoir déverrouillé l’appareil ou autorisé le stockage du navigateur.'));
      })
      .finally(() => setChargement(false));
  }

  useEffect(chargerReglages, []);

  async function sauvegarderProfil(profil: ProfilContenu, code: string | undefined) {
    setErreurProfil('');
    try {
      const settingsActuelles: AppSettings = await getSettings();
      await saveSettings({
        ...settingsActuelles,
        profilContenu: profil,
        codeDeverrouillage: code,
      });
      setProfilContenu(profil);
      setCodeDeverrouillage(code);
      setModalProfilOuvert(false);
      setCodeSaisi('');
    } catch {
      setErreurProfil(t('Le profil n’a pas pu être enregistré. Réessaie.'));
    }
  }

  function choisirGrandPublic() {
    void sauvegarderProfil('grand_public', codeDeverrouillage);
  }

  function choisirAdulte() {
    const code = codeSaisi.trim();
    if (!codeDeverrouillage) {
      if (code.length < 4) {
        setErreurProfil(t('Choisis un code d’au moins 4 caractères.'));
        return;
      }
      void sauvegarderProfil('adulte', code);
      return;
    }
    if (code !== codeDeverrouillage) {
      setErreurProfil(t('Code incorrect.'));
      return;
    }
    void sauvegarderProfil('adulte', codeDeverrouillage);
  }

  function ouvrirModalProfil() {
    setCodeSaisi('');
    setErreurProfil('');
    setModalProfilOuvert(true);
  }

  async function verifierMaj() {
    setVerificationMaj(true);
    setMessageMaj('');
    setUrlMaj('');
    try {
      const info = await verifierMiseAJour();
      if (info.disponible) {
        setMessageMaj(`${t('Nouvelle version disponible')} : ${info.derniereVersion}${info.notes ? ` — ${info.notes}` : ''}`);
        setUrlMaj(info.url);
      } else {
        setMessageMaj(t('Tu utilises déjà la dernière version.'));
      }
    } catch (e) {
      setMessageMaj(e instanceof Error ? e.message : t('Vérification impossible pour le moment.'));
    } finally {
      setVerificationMaj(false);
    }
  }

  const profilAffiche = profilContenu === 'adulte'
    ? t('Adulte')
    : profilContenu === 'grand_public'
      ? t('Grand public')
      : t('À déclarer');

  if (chargement) {
    return (
      <View style={[styles.container, styles.centre]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  if (erreurChargement) {
    return (
      <View style={[styles.container, styles.centre]}>
        <Text style={styles.statut}>{erreurChargement}</Text>
        <Bouton titre={t('Réessayer')} onPress={chargerReglages} style={styles.bouton} />
      </View>
    );
  }

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_REGLAGES}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contenu}>
        <View style={styles.entete}>
          <Text style={styles.surtitre}>{t('PARAMÈTRES D’ELYNDOR')}</Text>
          <Text style={styles.titre}>{t('Réglages')}</Text>
          <Text style={styles.sousTitre}>{t('L’expérience reste configurable. La connexion IA, elle, est désormais entièrement gérée par Elyndor Cloud.')}</Text>
        </View>

        <Panneau style={styles.sectionCloud}>
          <Text style={styles.sectionSurtitre}>{t('IA & CONNEXION')}</Text>
          <Text style={styles.sectionTitre}>Elyndor Cloud</Text>
          <Text style={styles.cloudEtat}>● {t('Connexion automatique')}</Text>
          <Text style={styles.sectionDescription}>
            {t('Aucune clé API, aucun modèle local et aucune adresse de serveur à configurer. Le narrateur utilise exclusivement Elyndor Cloud.')}
          </Text>
          <View style={styles.ligneInfo}>
            <Text style={styles.ligneLabel}>{t('Narrateur')}</Text>
            <Text style={styles.ligneValeur}>Elyndor Cloud</Text>
          </View>
          <View style={styles.ligneInfo}>
            <Text style={styles.ligneLabel}>{t('Modèle')}</Text>
            <Text style={styles.ligneValeur} numberOfLines={2}>{ELYNDOR_CLOUD_MODELE}</Text>
          </View>
        </Panneau>

        <View style={styles.grille}>
          <Panneau style={styles.section}>
            <Text style={styles.sectionSurtitre}>{t('EXPÉRIENCE')}</Text>
            <Text style={styles.sectionTitre}>{t('Contenu & extensions')}</Text>
            <Text style={styles.sectionDescription}>{t('Ces réglages modifient ce que l’application autorise sans toucher à tes histoires existantes.')}</Text>

            <Pressable style={styles.ligneSelection} onPress={ouvrirModalProfil}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ligneLabel}>{t('Profil de contenu')}</Text>
                <Text style={styles.ligneValeur}>{profilAffiche}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <Text style={styles.aide}>
              {t('En Grand public, le contenu explicite est filtré et bloqué. Le mode Adulte se réactive avec le code local que tu as choisi.')}
            </Text>

            <Bouton
              titre={t('Gérer les packs de contenu')}
              variante="secondaire"
              onPress={() => navigation.navigate('Plugins')}
              style={styles.bouton}
            />
          </Panneau>

          <Panneau style={styles.section}>
            <Text style={styles.sectionSurtitre}>{t('COMPTE')}</Text>
            <Text style={styles.sectionTitre}>{t('Compte & synchronisation')}</Text>
            <Text style={styles.sectionDescription}>
              {cloud.utilisateur
                ? `${t('Connecté')} · ${cloud.utilisateur.email ?? cloud.utilisateur.nom ?? ''}`
                : t('Connecte-toi pour retrouver tes histoires, personnages et réglages sur tous tes appareils. Sans compte, tout reste sur cet appareil.')}
            </Text>
            <Bouton
              titre={cloud.utilisateur ? t('Gérer mon compte') : t('Se connecter')}
              variante="secondaire"
              icone="sceau"
              onPress={() => navigation.navigate('Compte')}
              style={styles.bouton}
            />
          </Panneau>

          <Panneau style={styles.section}>
            <Text style={styles.sectionSurtitre}>{t('APPLICATION')}</Text>
            <Text style={styles.sectionTitre}>{t('Maintenance')}</Text>
            <View style={styles.ligneInfo}>
              <Text style={styles.ligneLabel}>{t('Version')}</Text>
              <Text style={styles.ligneValeur}>{VERSION_APP}</Text>
            </View>
            <Bouton
              titre={verificationMaj ? t('Vérification…') : t('Vérifier les mises à jour')}
              variante="secondaire"
              onPress={verifierMaj}
              desactive={verificationMaj}
              style={styles.bouton}
            />
            {messageMaj ? <Text style={styles.aide}>{messageMaj}</Text> : null}
            {urlMaj ? (
              <Bouton
                titre={t('Ouvrir la dernière version')}
                variante="arcane"
                onPress={() => Linking.openURL(urlMaj)}
                style={styles.bouton}
              />
            ) : null}

            <View style={styles.separateur} />
            <Text style={styles.ligneLabel}>{t('Outils concepteur')}</Text>
            <Text style={styles.aide}>{t('Débogage narratif, contrôles moteur et réglages avancés pour la phase de test.')}</Text>
            <Bouton
              titre={t('Ouvrir les réglages concepteur')}
              variante="secondaire"
              onPress={() => navigation.navigate('ReglagesConcepteur')}
              style={styles.bouton}
            />
          </Panneau>
        </View>
      </ScrollView>

      <Modal
        visible={modalProfilOuvert}
        transparent
        animationType="fade"
        onRequestClose={() => setModalProfilOuvert(false)}
      >
        <View style={styles.modalFond}>
          <Panneau style={styles.modalCarte}>
            <Text style={styles.sectionSurtitre}>{t('PROFIL DE CONTENU')}</Text>
            <Text style={styles.sectionTitre}>{t('Choisir le profil')}</Text>

            <Bouton
              titre={t('Grand public')}
              variante={profilContenu === 'grand_public' ? 'arcane' : 'secondaire'}
              onPress={choisirGrandPublic}
              style={styles.bouton}
            />

            <View style={styles.separateur} />
            <Text style={styles.aide}>
              {codeDeverrouillage
                ? t('Entre ton code local pour activer le mode Adulte.')
                : t('Choisis un code local d’au moins 4 caractères pour protéger le mode Adulte.')}
            </Text>
            <Champ
              label={t('Code local')}
              value={codeSaisi}
              onChangeText={setCodeSaisi}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {erreurProfil ? <Text style={styles.erreur}>{erreurProfil}</Text> : null}
            <Bouton
              titre={t('Adulte')}
              variante="arcane"
              onPress={choisirAdulte}
              style={styles.bouton}
            />
            <Bouton
              titre={t('Annuler')}
              variante="secondaire"
              onPress={() => setModalProfilOuvert(false)}
              style={styles.bouton}
            />
          </Panneau>
        </View>
      </Modal>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  contenu: { padding: espacement.lg, paddingBottom: 48, gap: espacement.lg, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  centre: { justifyContent: 'center', alignItems: 'center', padding: espacement.lg, backgroundColor: couleurs.fond },
  entete: { gap: 4 },
  surtitre: { color: couleurs.dore, fontFamily: polices.texteSemiGras, fontSize: 11, letterSpacing: 1.8 },
  titre: { color: couleurs.texte, fontFamily: polices.display, fontSize: 32 },
  sousTitre: { color: couleurs.texteSecondaire, fontFamily: polices.texte, fontSize: 16, lineHeight: 23, maxWidth: 760 },
  grille: { gap: espacement.lg },
  section: { padding: espacement.lg, gap: espacement.md },
  sectionCloud: { padding: espacement.lg, gap: espacement.md, borderColor: couleurs.dore },
  sectionSurtitre: { color: couleurs.dore, fontFamily: polices.texteSemiGras, fontSize: 11, letterSpacing: 1.6 },
  sectionTitre: { color: couleurs.texte, fontFamily: polices.display, fontSize: 23 },
  sectionDescription: { color: couleurs.texteSecondaire, fontFamily: polices.texte, fontSize: 15, lineHeight: 22 },
  cloudEtat: { color: couleurs.succes, fontFamily: polices.texteSemiGras, fontSize: 15 },
  ligneInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: espacement.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordureSubtile },
  ligneLabel: { color: couleurs.texteSecondaire, fontFamily: polices.texteSemiGras, fontSize: 14 },
  ligneValeur: { color: couleurs.texte, fontFamily: polices.texte, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  ligneSelection: { flexDirection: 'row', alignItems: 'center', padding: espacement.md, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: rayon.md, backgroundColor: couleurs.surface },
  chevron: { color: couleurs.dore, fontSize: 26, marginLeft: 12 },
  aide: { color: couleurs.texteSecondaire, fontFamily: polices.texte, fontSize: 13, lineHeight: 19 },
  bouton: { marginTop: 4 },
  statut: { color: couleurs.texte, fontFamily: polices.texte, textAlign: 'center', marginBottom: espacement.md },
  separateur: { height: 1, backgroundColor: couleurs.bordureSubtile, marginVertical: espacement.sm },
  erreur: { color: couleurs.danger, fontFamily: polices.texte, fontSize: 13 },
  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: espacement.lg },
  modalCarte: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: espacement.lg, gap: espacement.md, borderRadius: rayon.lg },
});
