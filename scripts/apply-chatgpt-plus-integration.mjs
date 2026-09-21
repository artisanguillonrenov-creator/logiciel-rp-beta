import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch ChatGPT Plus impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

// 1) Types / réglages
{
  const path = 'src/types/index.ts';
  let s = lire(path);
  s = remplacer(
    s,
    "export type FournisseurLLM = 'openrouter' | 'infermatic' | 'local';",
    "export type FournisseurLLM = 'openrouter' | 'infermatic' | 'chatgpt' | 'local';",
    'type fournisseur',
  );
  s = remplacer(
    s,
    "  infermaticModel?: string;\n  // undefined (ou 'openrouter') = comportement historique. Voir MoteurInference.",
    "  infermaticModel?: string;\n  // Modèle Codex/ChatGPT facultatif. Vide = modèle par défaut du compte ChatGPT.\n  chatgptModel?: string;\n  // undefined (ou 'openrouter') = comportement historique. Voir MoteurInference.",
    'AppSettings chatgptModel',
  );
  ecrire(path, s);
}

// 2) Résolution fournisseur
{
  const path = 'src/engine/llmProvider.ts';
  let s = lire(path);
  s = remplacer(
    s,
    "  return value === 'infermatic' || value === 'local' ? value : 'openrouter';",
    "  return value === 'infermatic' || value === 'chatgpt' || value === 'local' ? value : 'openrouter';",
    'normaliser fournisseur',
  );
  s = remplacer(
    s,
    "  if (moteurInference === 'infermatic') {\n    return {\n      apiKey: settings.infermaticApiKey ?? '',\n      model: modeleOverride || settings.infermaticModel || '',\n      moteurInference,\n    };\n  }\n  return { apiKey: settings.openRouterApiKey, model: modeleOverride || settings.model, moteurInference };",
    "  if (moteurInference === 'infermatic') {\n    return {\n      apiKey: settings.infermaticApiKey ?? '',\n      model: modeleOverride || settings.infermaticModel || '',\n      moteurInference,\n    };\n  }\n  if (moteurInference === 'chatgpt') {\n    return { apiKey: '', model: settings.chatgptModel || '', moteurInference };\n  }\n  return { apiKey: settings.openRouterApiKey, model: modeleOverride || settings.model, moteurInference };",
    'configuration ChatGPT',
  );
  s = s.replaceAll("Exclude<FournisseurLLM, 'local'>", "Exclude<FournisseurLLM, 'local' | 'chatgpt'>");
  ecrire(path, s);
}

// 3) Politique de raisonnement : ChatGPT/Codex est géré par sa passerelle,
// il ne doit pas entrer dans le type des fournisseurs HTTP OpenAI-like.
{
  const path = 'src/engine/reasoningPolicy.ts';
  let s = lire(path);
  s = s.replaceAll("Exclude<FournisseurLLM, 'local'>", "Exclude<FournisseurLLM, 'local' | 'chatgpt'>");
  ecrire(path, s);
}

// 4) Routage modèle : intercepter ChatGPT avant OpenRouter/Infermatic.
{
  const path = 'src/engine/openrouter.ts';
  let s = lire(path);
  s = remplacer(
    s,
    "import { appelerChatDistant, appelerChatDistantAvecOutils, ErreurFournisseurLLM, listerModelesDistants, type ModeleDistant } from './llmProvider';",
    "import { appelerChatDistant, appelerChatDistantAvecOutils, ErreurFournisseurLLM, listerModelesDistants, type ModeleDistant } from './llmProvider';\nimport { appelerChatGPTAbonnement } from './chatgptSubscription';\nimport { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';",
    'imports ChatGPT',
  );
  s = remplacer(
    s,
    "  if (moteurInference === 'local') return genererTexteLocal(messages);\n  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';",
    "  if (moteurInference === 'local') return genererTexteLocal(messages);\n  if (moteurInference === 'chatgpt') return appelerChatGPTAbonnement(messages, model, signal);\n  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';",
    'appel ChatGPT texte',
  );
  s = remplacer(
    s,
    "  if (moteurInference === 'local') return appellerModeleLocalAvecOutilsJson(messages, outils);\n  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';",
    "  if (moteurInference === 'local') return appellerModeleLocalAvecOutilsJson(messages, outils);\n  if (moteurInference === 'chatgpt') {\n    const brut = await appelerChatGPTAbonnement(ajouterInstructionsOutilsJson(messages, outils), model, signal);\n    return extraireAppelsOutilsJson(brut);\n  }\n  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';",
    'appel ChatGPT outils',
  );
  ecrire(path, s);
}

// 5) Écran Réglages : bouton de connexion par code appareil et état Plus.
{
  const path = 'src/screens/SettingsScreen.tsx';
  let s = lire(path);
  s = remplacer(
    s,
    "import { listerModelesDistants } from '../engine/llmProvider';",
    "import { listerModelesDistants } from '../engine/llmProvider';\nimport { attendreConnexionChatGPT, demarrerConnexionChatGPT, etatConnexionChatGPT } from '../engine/chatgptSubscription';",
    'import écran ChatGPT',
  );
  s = remplacer(
    s,
    "  const [infermaticModel, setInfermaticModel] = useState('');\n  const [embeddingsApiKey, setEmbeddingsApiKey] = useState('');",
    "  const [infermaticModel, setInfermaticModel] = useState('');\n  const [chatgptModel, setChatgptModel] = useState('');\n  const [chatgptConnecte, setChatgptConnecte] = useState(false);\n  const [chatgptPlan, setChatgptPlan] = useState('');\n  const [chatgptCode, setChatgptCode] = useState('');\n  const [chatgptVerificationUrl, setChatgptVerificationUrl] = useState('');\n  const [chatgptConnexionEnCours, setChatgptConnexionEnCours] = useState(false);\n  const [chatgptErreur, setChatgptErreur] = useState('');\n  const [embeddingsApiKey, setEmbeddingsApiKey] = useState('');",
    'états ChatGPT',
  );
  s = remplacer(
    s,
    "      setInfermaticModel(settings.infermaticModel ?? '');\n      setEmbeddingsApiKey(settings.embeddingsApiKey ?? '');",
    "      setInfermaticModel(settings.infermaticModel ?? '');\n      setChatgptModel(settings.chatgptModel ?? '');\n      etatConnexionChatGPT().then((etat) => {\n        setChatgptConnecte(etat.connected);\n        setChatgptPlan(etat.planType ?? '');\n      }).catch(() => {});\n      setEmbeddingsApiKey(settings.embeddingsApiKey ?? '');",
    'chargement ChatGPT',
  );
  s = remplacer(
    s,
    "      const cleConfiguree = settings.moteurInference === 'infermatic' ? settings.infermaticApiKey : settings.openRouterApiKey;\n      setAvancesOuverts(settings.moteurInference !== 'local' && !cleConfiguree);",
    "      const cleConfiguree = settings.moteurInference === 'infermatic' ? settings.infermaticApiKey : settings.openRouterApiKey;\n      setAvancesOuverts(settings.moteurInference !== 'local' && settings.moteurInference !== 'chatgpt' && !cleConfiguree);",
    'avancés ChatGPT',
  );

  const marqueurFonction = "  async function enregistrer() {";
  const fonctionsChatGPT = `  async function connecterChatGPT() {\n    setChatgptConnexionEnCours(true);\n    setChatgptErreur('');\n    setChatgptCode('');\n    setChatgptVerificationUrl('');\n    try {\n      const debut = await demarrerConnexionChatGPT();\n      setChatgptCode(debut.userCode ?? '');\n      setChatgptVerificationUrl(debut.verificationUrl ?? '');\n      if (debut.verificationUrl) await Linking.openURL(debut.verificationUrl);\n      const etat = await attendreConnexionChatGPT();\n      setChatgptConnecte(etat.connected);\n      setChatgptPlan(etat.planType ?? '');\n      setChatgptCode('');\n      setChatgptVerificationUrl('');\n      if (etat.connected) setMessageStatut(etat.planType ? \`ChatGPT connecté · forfait \${etat.planType}.\` : 'ChatGPT connecté.');\n    } catch (e) {\n      setChatgptErreur(e instanceof Error ? e.message : 'Connexion ChatGPT impossible.');\n    } finally {\n      setChatgptConnexionEnCours(false);\n    }\n  }\n\n`;
  s = remplacer(s, marqueurFonction, fonctionsChatGPT + marqueurFonction, 'fonction connexion ChatGPT');

  s = remplacer(
    s,
    "        infermaticModel: infermaticModel.trim() || undefined,\n        embeddingsApiKey: embeddingsApiKey.trim() || undefined,",
    "        infermaticModel: infermaticModel.trim() || undefined,\n        chatgptModel: chatgptModel.trim() || undefined,\n        embeddingsApiKey: embeddingsApiKey.trim() || undefined,",
    'sauvegarde modèle ChatGPT',
  );
  s = remplacer(
    s,
    "  const fournisseurActif = moteurInference === 'local'\n    ? t('Sur cet appareil')\n    : moteurInference === 'infermatic'\n      ? 'Infermatic'\n      : 'OpenRouter';",
    "  const fournisseurActif = moteurInference === 'local'\n    ? t('Sur cet appareil')\n    : moteurInference === 'chatgpt'\n      ? 'ChatGPT Plus'\n      : moteurInference === 'infermatic'\n        ? 'Infermatic'\n        : 'OpenRouter';",
    'libellé fournisseur ChatGPT',
  );

  const boutonInfermatic = `                <Pressable\n                  style={[styles.optionMoteur, moteurInference === 'infermatic' && styles.optionMoteurActive]}\n                  onPress={() => { setMoteurInference('infermatic'); setModeles([]); }}\n                >\n                  <Text style={[styles.texteOptionMoteur, moteurInference === 'infermatic' && styles.texteOptionMoteurActif]}>Infermatic</Text>\n                </Pressable>`;
  const boutonChatGPT = `${boutonInfermatic}\n                <Pressable\n                  style={[styles.optionMoteur, moteurInference === 'chatgpt' && styles.optionMoteurActive]}\n                  onPress={() => { setMoteurInference('chatgpt'); setModeles([]); }}\n                >\n                  <Text style={[styles.texteOptionMoteur, moteurInference === 'chatgpt' && styles.texteOptionMoteurActif]}>ChatGPT Plus</Text>\n                </Pressable>`;
  s = remplacer(s, boutonInfermatic, boutonChatGPT, 'bouton ChatGPT');

  const avantInfermatic = "              {moteurInference === 'infermatic' && (";
  const blocChatGPT = `              {moteurInference === 'chatgpt' && (\n                <View style={styles.blocFournisseur}>\n                  <View style={styles.etatTechnique}>\n                    <Text style={styles.ligneLabel}>{t('Compte ChatGPT')}</Text>\n                    <Text style={styles.ligneValeur}>\n                      {chatgptConnecte ? \`Connecté\${chatgptPlan ? \` · \${chatgptPlan}\` : ''}\` : 'Non connecté'}\n                    </Text>\n                  </View>\n                  <Text style={styles.aide}>{t('Utilise ton abonnement ChatGPT/Codex. Aucune clé API OpenAI n’est nécessaire. La consommation suit le quota de ton abonnement.')}</Text>\n                  {!chatgptConnecte && (\n                    <Bouton\n                      titre={chatgptConnexionEnCours ? t('Connexion en cours…') : t('Se connecter avec ChatGPT')}\n                      variante="arcane"\n                      onPress={connecterChatGPT}\n                      disabled={chatgptConnexionEnCours}\n                      style={styles.boutonAction}\n                    />\n                  )}\n                  {!!chatgptCode && (\n                    <View style={styles.etatTechnique}>\n                      <Text style={styles.ligneLabel}>{t('Code à saisir chez OpenAI')}</Text>\n                      <Text style={styles.ligneValeur}>{chatgptCode}</Text>\n                    </View>\n                  )}\n                  {!!chatgptVerificationUrl && (\n                    <Bouton\n                      titre={t('Ouvrir la page de connexion OpenAI')}\n                      variante="secondaire"\n                      onPress={() => Linking.openURL(chatgptVerificationUrl)}\n                      style={styles.boutonAction}\n                    />\n                  )}\n                  {!!chatgptErreur && <Text style={[styles.aide, { color: couleurs.danger }]}>{chatgptErreur}</Text>}\n                  {chatgptConnecte && (\n                    <Champ\n                      label={t('Modèle ChatGPT/Codex (optionnel)')}\n                      value={chatgptModel}\n                      onChangeText={setChatgptModel}\n                      placeholder={t('Laisser vide = modèle automatique')}\n                      autoCapitalize="none"\n                      autoCorrect={false}\n                      conteneurStyle={styles.champConteneur}\n                    />\n                  )}\n                </View>\n              )}\n\n`;
  s = remplacer(s, avantInfermatic, blocChatGPT + avantInfermatic, 'bloc ChatGPT');
  ecrire(path, s);
}

// 6) Version visible
{
  const path = 'src/version.ts';
  let s = lire(path);
  s = s.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.29.0-chatgpt-beta'");
  ecrire(path, s);
}

console.log('Intégration ChatGPT Plus appliquée.');
