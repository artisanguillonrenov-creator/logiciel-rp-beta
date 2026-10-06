// Sérialisation compacte des vecteurs d'embeddings pour le cache local.
// En JSON, un vecteur bge-m3 (1024 nombres) pèse ~22,7 Ko : les 265 entrées
// du lore Elyndor faisaient ~6 Mo, au-delà du plafond par défaut
// d'AsyncStorage sur Android (6 Mo). L'écriture échouait sans bruit et tout
// le lore était recalculé sur le CPU du pod à chaque tour (2 à 3 minutes).
// En float32 + base64 : ~5,5 Ko par vecteur. Pur TypeScript (pas de
// btoa/Buffer) pour fonctionner à l'identique sous Hermes, sur le Web et
// dans les tests Node.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INDEX_ALPHABET = new Map([...ALPHABET].map((c, i) => [c, i]));

function octetsVersBase64(octets: Uint8Array): string {
  let sortie = '';
  for (let i = 0; i < octets.length; i += 3) {
    const a = octets[i];
    const b = i + 1 < octets.length ? octets[i + 1] : 0;
    const c = i + 2 < octets.length ? octets[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    sortie += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    sortie += i + 1 < octets.length ? ALPHABET[(n >> 6) & 63] : '=';
    sortie += i + 2 < octets.length ? ALPHABET[n & 63] : '=';
  }
  return sortie;
}

function base64VersOctets(texte: string): Uint8Array {
  const propre = texte.replace(/=+$/, '');
  const octets = new Uint8Array(Math.floor((propre.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < propre.length; i += 4) {
    const n = ((INDEX_ALPHABET.get(propre[i]) ?? 0) << 18)
      | ((INDEX_ALPHABET.get(propre[i + 1]) ?? 0) << 12)
      | ((INDEX_ALPHABET.get(propre[i + 2]) ?? 0) << 6)
      | (INDEX_ALPHABET.get(propre[i + 3]) ?? 0);
    if (j < octets.length) octets[j++] = (n >> 16) & 255;
    if (j < octets.length) octets[j++] = (n >> 8) & 255;
    if (j < octets.length) octets[j++] = n & 255;
  }
  return octets;
}

export function encoderVecteur(vecteur: number[]): string {
  // Copie dans un tampon neuf : l'ordre des octets est celui de la plateforme
  // (petit-boutiste partout où l'app tourne), relu par la même plateforme.
  return octetsVersBase64(new Uint8Array(Float32Array.from(vecteur).buffer));
}

export function decoderVecteur(texte: string): number[] {
  const octets = base64VersOctets(texte);
  return Array.from(new Float32Array(octets.buffer, 0, Math.floor(octets.length / 4)));
}
