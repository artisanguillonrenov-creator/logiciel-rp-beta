import { useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { couleurs, polices } from '../theme/theme';

// Visionneuse plein écran des images générées (scènes, avatars, aperçus) :
// pincer pour zoomer, glisser pour se déplacer, toucher deux fois pour
// revenir à la taille normale, et « Télécharger » ouvre le menu de partage
// d'Android (Enregistrer dans la galerie, Fichiers, Drive…).

const ZOOM_MAX = 5;

function distance(e: GestureResponderEvent): number {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
}

/** Fichier local partageable : les images en data URL sont d'abord écrites dans le cache. */
async function fichierPartageable(uri: string, nom: string): Promise<string> {
  if (!uri.startsWith('data:')) return uri;
  const virgule = uri.indexOf(',');
  const fichier = new File(Paths.cache, `${nom}.png`);
  if (fichier.exists) fichier.delete();
  fichier.create();
  fichier.write(uri.slice(virgule + 1), { encoding: 'base64' });
  return fichier.uri;
}

export function VisionneuseImage({ uri, titre, onFermer }: { uri: string | null; titre?: string; onFermer: () => void }) {
  const echelle = useRef(new Animated.Value(1)).current;
  const decalage = useRef(new Animated.ValueXY()).current;
  const etat = useRef({ echelle: 1, x: 0, y: 0, distanceDepart: 0, echelleDepart: 1, dernierToucher: 0 }).current;
  const [message, setMessage] = useState('');

  function reinitialiser() {
    Object.assign(etat, { echelle: 1, x: 0, y: 0 });
    Animated.parallel([
      Animated.spring(echelle, { toValue: 1, useNativeDriver: true }),
      Animated.spring(decalage, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
    ]).start();
  }

  const gestes = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const maintenant = Date.now();
      if (e.nativeEvent.touches.length === 1 && maintenant - etat.dernierToucher < 280) reinitialiser();
      etat.dernierToucher = maintenant;
      etat.distanceDepart = 0;
    },
    onPanResponderMove: (e, g) => {
      if (e.nativeEvent.touches.length >= 2) {
        const d = distance(e);
        if (!etat.distanceDepart) { etat.distanceDepart = d; etat.echelleDepart = etat.echelle; return; }
        const nouvelle = Math.min(ZOOM_MAX, Math.max(1, etat.echelleDepart * (d / etat.distanceDepart)));
        echelle.setValue(nouvelle);
        etat.echelle = nouvelle;
      } else if (etat.echelle > 1) {
        decalage.setValue({ x: etat.x + g.dx, y: etat.y + g.dy });
      }
    },
    onPanResponderRelease: (_, g) => {
      if (etat.echelle > 1 && !etat.distanceDepart) { etat.x += g.dx; etat.y += g.dy; }
      if (etat.echelle <= 1) reinitialiser();
      etat.distanceDepart = 0;
    },
  }), []);

  async function telecharger() {
    if (!uri) return;
    try {
      if (!(await Sharing.isAvailableAsync())) { setMessage('Partage indisponible sur cet appareil.'); return; }
      const nom = `elyndor-${(titre || 'image').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)}-${Date.now()}`;
      await Sharing.shareAsync(await fichierPartageable(uri, nom), { mimeType: 'image/png', dialogTitle: 'Enregistrer l’image' });
      setMessage('');
    } catch {
      setMessage('Impossible de préparer l’image.');
    }
  }

  function fermer() {
    reinitialiser();
    setMessage('');
    onFermer();
  }

  return (
    <Modal visible={!!uri} animationType="fade" transparent onRequestClose={fermer}>
      <View style={styles.fond}>
        <View style={styles.zone} {...gestes.panHandlers}>
          {uri ? (
            <Animated.Image
              source={{ uri }}
              resizeMode="contain"
              style={[styles.image, { transform: [{ translateX: decalage.x }, { translateY: decalage.y }, { scale: echelle }] }]}
            />
          ) : null}
        </View>
        {titre ? <Text style={styles.titre}>{titre}</Text> : null}
        <Text style={styles.aide}>Pince pour zoomer · touche deux fois pour revenir</Text>
        {message ? <Text style={styles.aide}>{message}</Text> : null}
        <View style={styles.boutons}>
          <Pressable style={styles.bouton} onPress={() => void telecharger()} accessibilityRole="button">
            <Text style={styles.texteBouton}>Télécharger</Text>
          </Pressable>
          <Pressable style={styles.bouton} onPress={fermer} accessibilityRole="button">
            <Text style={styles.texteBouton}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Image cliquable qui ouvre la visionneuse.
export function ImageAgrandissable({ uri, titre, style, resizeMode = 'contain', accessibilityLabel }: {
  uri: string;
  titre?: string;
  style?: any;
  resizeMode?: 'contain' | 'cover';
  accessibilityLabel?: string;
}) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOuverte(true)} accessibilityRole="imagebutton" accessibilityHint="Ouvre l’image en grand">
        <Image source={{ uri }} style={style} resizeMode={resizeMode} accessibilityLabel={accessibilityLabel} />
      </Pressable>
      <VisionneuseImage uri={ouverte ? uri : null} titre={titre} onFermer={() => setOuverte(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', paddingVertical: 24 },
  zone: { flex: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  titre: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 18, textAlign: 'center', marginTop: 8 },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, textAlign: 'center', marginTop: 4 },
  boutons: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12 },
  bouton: { paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: couleurs.dore, borderRadius: 8 },
  texteBouton: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 15 },
});
