const fs = require('fs');

const path = 'src/screens/SettingsScreen.tsx';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`Patch Elyndor Cloud introuvable: ${label}`);
  s = s.replace(from, to);
}

replaceOnce(
  "const IMAGE_REGLAGES = require('../../assets/scenes/creation-preferences.png');",
  "const IMAGE_REGLAGES = require('../../assets/scenes/creation-preferences.png');\n\nconst ELYNDOR_CLOUD_URL = 'https://gzy9xft10gb3me-8000.proxy.runpod.net/v1';\nconst ELYNDOR_CLOUD_MODELE = 'TheDrummer/Behemoth-X-123B-v2.1-GGUF:Q4_K_M';",
  'constantes',
);

replaceOnce(
  "  const [serveurModeles, setServeurModeles] = useState<ModeleDistant[]>([]);",
  "  const [serveurModeles, setServeurModeles] = useState<ModeleDistant[]>([]);\n  const [elyndorCloudActif, setElyndorCloudActif] = useState(false);",
  'etat cloud',
);

replaceOnce(
  "      setServeurApiKey(settings.serveurLocalApiKey ?? '');",
  "      setServeurApiKey(settings.serveurLocalApiKey ?? '');\n      setElyndorCloudActif(\n        settings.moteurInference === 'serveur' &&\n        (settings.serveurLocalUrl ?? '').includes('-8000.proxy.runpod.net')\n      );",
  'chargement cloud',
);

replaceOnce(
  "    : moteurInference === 'serveur'\n      ? t('Serveur local')",
  "    : moteurInference === 'serveur'\n      ? (elyndorCloudActif ? 'Elyndor Cloud' : t('Serveur local'))",
  'resume narrateur',
);

replaceOnce(
  "                  onPress={() => setMoteurInference('openrouter')}",
  "                  onPress={() => { setElyndorCloudActif(false); setMoteurInference('openrouter'); }}",
  'bouton openrouter',
);
replaceOnce(
  "                  onPress={() => { setMoteurInference('infermatic'); setModeles([]); }}",
  "                  onPress={() => { setElyndorCloudActif(false); setMoteurInference('infermatic'); setModeles([]); }}",
  'bouton infermatic',
);
replaceOnce(
  "                    onPress={() => setMoteurInference('local')}",
  "                    onPress={() => { setElyndorCloudActif(false); setMoteurInference('local'); }}",
  'bouton local',
);

replaceOnce(
  `                <Pressable\n                  style={[styles.optionMoteur, moteurInference === 'serveur' && styles.optionMoteurActive]}\n                  onPress={() => setMoteurInference('serveur')}\n                >\n                  <Text style={[styles.texteOptionMoteur, moteurInference === 'serveur' && styles.texteOptionMoteurActif]}>{t('Serveur local')}</Text>\n                </Pressable>`,
  `                <Pressable\n                  style={[styles.optionMoteur, moteurInference === 'serveur' && elyndorCloudActif && styles.optionMoteurActive]}\n                  onPress={() => {\n                    setElyndorCloudActif(true);\n                    setMoteurInference('serveur');\n                    setServeurUrl(ELYNDOR_CLOUD_URL);\n                    setServeurModele(ELYNDOR_CLOUD_MODELE);\n                    setServeurApiKey('');\n                    setServeurEtat(null);\n                  }}\n                >\n                  <Text style={[styles.texteOptionMoteur, moteurInference === 'serveur' && elyndorCloudActif && styles.texteOptionMoteurActif]}>Elyndor Cloud</Text>\n                </Pressable>\n                <Pressable\n                  style={[styles.optionMoteur, moteurInference === 'serveur' && !elyndorCloudActif && styles.optionMoteurActive]}\n                  onPress={() => {\n                    setElyndorCloudActif(false);\n                    setMoteurInference('serveur');\n                    if (serveurUrl.includes('.proxy.runpod.net')) {\n                      setServeurUrl('');\n                      setServeurModele('');\n                      setServeurApiKey('');\n                    }\n                    setServeurEtat(null);\n                  }}\n                >\n                  <Text style={[styles.texteOptionMoteur, moteurInference === 'serveur' && !elyndorCloudActif && styles.texteOptionMoteurActif]}>{t('Serveur local')}</Text>\n                </Pressable>`,
  'boutons cloud/serveur',
);

replaceOnce(
  "              {moteurInference === 'serveur' && (\n                <View style={styles.blocFournisseur}>",
  "              {moteurInference === 'serveur' && elyndorCloudActif && (\n                <View style={styles.blocFournisseur}>\n                  <Text style={styles.aide}>Connexion distante Elyndor prête pour RunPod. Aucun réglage manuel n’est nécessaire.</Text>\n                  <View style={styles.etatTechnique}>\n                    <Text style={styles.ligneLabel}>Elyndor Cloud</Text>\n                    <Text style={styles.ligneValeur}>Behemoth X 123B v2.1 · RunPod</Text>\n                  </View>\n                  <Text style={styles.aide}>Le mode Serveur local reste indépendant et réservé à LM Studio/Ollama sur ton réseau.</Text>\n                </View>\n              )}\n\n              {moteurInference === 'serveur' && !elyndorCloudActif && (\n                <View style={styles.blocFournisseur}>",
  'bloc cloud',
);

fs.writeFileSync(path, s);
console.log('Patch Elyndor Cloud appliqué.');
