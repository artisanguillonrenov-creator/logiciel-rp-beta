import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch jouabilité ChatGPT impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

// 1) Conversation : ChatGPT Plus n'utilise pas de clé API OpenRouter.
//    Ajoute aussi un accès direct aux Réglages pendant une partie.
{
  const path = 'src/screens/ConversationScreen.tsx';
  let s = lire(path);

  s = remplacer(
    s,
    `  const clefManquante = appSettings && appSettings.moteurInference !== 'local' &&\n    !(appSettings.moteurInference === 'infermatic' ? appSettings.infermaticApiKey : appSettings.openRouterApiKey);\n  const profilNonDeclare = appSettings && !appSettings.profilContenu;`,
    `  const moteurActif = appSettings?.moteurInference ?? 'openrouter';\n  const clefManquante = appSettings && moteurActif !== 'local' && moteurActif !== 'chatgpt' &&\n    !(moteurActif === 'infermatic' ? appSettings.infermaticApiKey : appSettings.openRouterApiKey);\n  const profilNonDeclare = appSettings && !appSettings.profilContenu;`,
    'détection clé API',
  );

  s = remplacer(
    s,
    `    const fournisseur = appSettings.moteurInference === 'infermatic' ? 'Infermatic' : 'OpenRouter';\n    const cleApi = appSettings.moteurInference === 'infermatic' ? appSettings.infermaticApiKey : appSettings.openRouterApiKey;\n    if (appSettings.moteurInference !== 'local' && !cleApi) {\n      setErreur(\`Configure ta clé API \${fournisseur} dans Réglages avant de commencer.\`);\n      return;\n    }`,
    `    const moteur = appSettings.moteurInference ?? 'openrouter';\n    if (moteur !== 'local' && moteur !== 'chatgpt') {\n      const fournisseur = moteur === 'infermatic' ? 'Infermatic' : 'OpenRouter';\n      const cleApi = moteur === 'infermatic' ? appSettings.infermaticApiKey : appSettings.openRouterApiKey;\n      if (!cleApi) {\n        setErreur(\`Configure ta clé API \${fournisseur} dans Réglages avant de commencer.\`);\n        return;\n      }\n    }`,
    'validation avant envoi',
  );

  s = remplacer(
    s,
    `          <View style={styles.rangeeEntete}>\n            <Pressable\n              style={styles.boutonEntete}\n              onPress={() => setModalRechercheOuvert(true)}`,
    `          <View style={styles.rangeeEntete}>\n            <Pressable\n              style={styles.boutonEntete}\n              onPress={() => navigation.navigate('Reglages')}\n              hitSlop={4}\n              accessibilityRole="button"\n              accessibilityLabel={t('Paramètres')}\n              accessibilityHint={t('Ouvre les réglages de l’application.')}\n            >\n              <Text style={styles.iconeEntete}>⚙</Text>\n            </Pressable>\n            <Pressable\n              style={styles.boutonEntete}\n              onPress={() => setModalRechercheOuvert(true)}`,
    'bouton réglages conversation',
  );

  ecrire(path, s);
}

// 2) Accueil : rendre toute la page réellement défilable sur tablette/web
//    et laisser une marge basse suffisante pour les barres système Android.
{
  const path = 'src/screens/StartScreenStudio.tsx';
  let s = lire(path);

  s = remplacer(
    s,
    `      <View style={[styles.page, { paddingTop: Math.max(insets.top, espacement.md), paddingBottom: Math.max(insets.bottom, espacement.md) }]}>`,
    `      <ScrollView\n        style={styles.page}\n        contentContainerStyle={[\n          styles.pageContenu,\n          {\n            paddingTop: Math.max(insets.top, espacement.md),\n            paddingBottom: Math.max(insets.bottom, espacement.md) + espacement.xxl,\n          },\n        ]}\n        showsVerticalScrollIndicator={false}\n      >`,
    'page accueil scrollable',
  );

  s = remplacer(
    s,
    `        <Text style={styles.version}>{t('Version')} {VERSION_APP}</Text>\n      </View>\n\n      <SelecteurLangue`,
    `        <Text style={styles.version}>{t('Version')} {VERSION_APP}</Text>\n      </ScrollView>\n\n      <SelecteurLangue`,
    'fermeture scroll accueil',
  );

  s = remplacer(
    s,
    `  page: {\n    flex: 1,\n    paddingHorizontal: espacement.lg,\n  },`,
    `  page: {\n    flex: 1,\n  },\n  pageContenu: {\n    flexGrow: 1,\n    paddingHorizontal: espacement.lg,\n  },`,
    'styles scroll accueil',
  );

  s = remplacer(
    s,
    `  version: {\n    position: 'absolute',\n    left: espacement.sm,\n    bottom: 2,\n    color: couleurs.texteFaible,\n    fontFamily: polices.corps,\n    fontSize: 10,\n  },`,
    `  version: {\n    alignSelf: 'flex-start',\n    marginTop: espacement.xs,\n    color: couleurs.texteFaible,\n    fontFamily: polices.corps,\n    fontSize: 10,\n  },`,
    'version dans le flux',
  );

  ecrire(path, s);
}

// 3) Version visible après les patches ChatGPT précédents.
{
  const path = 'src/version.ts';
  let s = lire(path);
  s = s.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.29.2-chatgpt-playability-beta'");
  ecrire(path, s);
}

console.log('Correctifs jouabilité ChatGPT + navigation tablette appliqués.');
