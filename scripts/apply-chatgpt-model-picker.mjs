import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch sélecteur ChatGPT impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

{
  const path = 'src/screens/SettingsScreen.tsx';
  let s = lire(path);

  s = remplacer(
    s,
    "import { attendreConnexionChatGPT, demarrerConnexionChatGPT, etatConnexionChatGPT } from '../engine/chatgptSubscription';",
    "import { attendreConnexionChatGPT, demarrerConnexionChatGPT, etatConnexionChatGPT, listerModelesChatGPT } from '../engine/chatgptSubscription';",
    'import catalogue ChatGPT',
  );

  s = remplacer(
    s,
    "  const [fournisseurCatalogue, setFournisseurCatalogue] = useState<'openrouter' | 'infermatic'>('openrouter');",
    "  const [fournisseurCatalogue, setFournisseurCatalogue] = useState<'openrouter' | 'infermatic' | 'chatgpt'>('openrouter');",
    'type catalogue',
  );

  s = remplacer(
    s,
    "  function ouvrirSelecteurModeles(fournisseur: 'openrouter' | 'infermatic') {",
    "  function ouvrirSelecteurModeles(fournisseur: 'openrouter' | 'infermatic' | 'chatgpt') {",
    'signature catalogue',
  );

  s = remplacer(
    s,
    "    (fournisseur === 'infermatic' ? listerModelesDistants('infermatic', infermaticApiKey.trim()) : listerModeles())\n      .then((liste) => { if (requeteCatalogueRef.current === requeteId) setModeles(liste); })",
    "    (fournisseur === 'chatgpt'\n      ? listerModelesChatGPT()\n      : fournisseur === 'infermatic'\n        ? listerModelesDistants('infermatic', infermaticApiKey.trim())\n        : listerModeles())\n      .then((liste) => {\n        if (requeteCatalogueRef.current === requeteId) {\n          setModeles(fournisseur === 'chatgpt'\n            ? [{ id: '', nom: 'Automatique — recommandé' }, ...liste]\n            : liste);\n        }\n      })",
    'chargement catalogue ChatGPT',
  );

  const champChatGPT = `                    <Champ\n                      label={t('Modèle ChatGPT/Codex (optionnel)')}\n                      value={chatgptModel}\n                      onChangeText={setChatgptModel}\n                      placeholder={t('Laisser vide = modèle automatique')}\n                      autoCapitalize="none"\n                      autoCorrect={false}\n                      conteneurStyle={styles.champConteneur}\n                    />`;

  s = remplacer(
    s,
    champChatGPT,
    `${champChatGPT}\n                    <Bouton\n                      titre={t('Parcourir les modèles ChatGPT')}\n                      variante="arcane"\n                      onPress={() => ouvrirSelecteurModeles('chatgpt')}\n                      style={styles.boutonAction}\n                    />`,
    'bouton catalogue ChatGPT',
  );

  s = remplacer(
    s,
    "            <Text style={styles.titre}>{fournisseurCatalogue === 'infermatic' ? t('Modèles Infermatic') : t('Modèles OpenRouter')}</Text>",
    "            <Text style={styles.titre}>{fournisseurCatalogue === 'chatgpt' ? t('Modèles ChatGPT') : fournisseurCatalogue === 'infermatic' ? t('Modèles Infermatic') : t('Modèles OpenRouter')}</Text>",
    'titre modal ChatGPT',
  );

  s = remplacer(
    s,
    "                      if (fournisseurCatalogue === 'infermatic') setInfermaticModel(item.id);\n                      else setModel(item.id);",
    "                      if (fournisseurCatalogue === 'chatgpt') setChatgptModel(item.id);\n                      else if (fournisseurCatalogue === 'infermatic') setInfermaticModel(item.id);\n                      else setModel(item.id);",
    'sélection modèle ChatGPT',
  );

  ecrire(path, s);
}

{
  const path = 'src/version.ts';
  let s = lire(path);
  s = s.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.29.1-chatgpt-models-beta'");
  ecrire(path, s);
}

console.log('Sélecteur de modèles ChatGPT appliqué.');
