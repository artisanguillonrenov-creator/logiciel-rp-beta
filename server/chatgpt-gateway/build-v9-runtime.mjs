import fs from 'node:fs';

const sourcePath = new URL('./server.js', import.meta.url);
const outputPath = new URL('./server-v9-runtime.js', import.meta.url);
let source = fs.readFileSync(sourcePath, 'utf8');

function remplacer(ancien, nouveau, etiquette) {
  if (!source.includes(ancien)) throw new Error(`Patch passerelle V9 impossible (${etiquette})`);
  source = source.replace(ancien, nouveau);
}

remplacer(
  "import crypto from 'node:crypto';",
  "import crypto from 'node:crypto';\nimport fsPromises from 'node:fs/promises';\nimport os from 'node:os';\nimport path from 'node:path';",
  'imports image',
);

remplacer(
  "const TURN_TIMEOUT_MS = 180_000;",
  "const TURN_TIMEOUT_MS = 180_000;\nconst IMAGE_TURN_TIMEOUT_MS = 300_000;",
  'timeout image',
);

remplacer(
  "app.use(express.json({ limit: '2mb' }));",
  "app.use(express.json({ limit: '18mb' }));",
  'taille JSON références image',
);

const helpers = String.raw`

function extensionPourMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return null;
}

async function ecrireReferenceImage(dataUrl, dossier, index) {
  if (typeof dataUrl !== 'string') throw new Error('Référence image invalide.');
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error('Les références doivent être des images PNG, JPEG ou WebP embarquées.');
  const extension = extensionPourMime(match[1].toLowerCase());
  if (!extension) throw new Error('Format de référence non pris en charge.');
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('Référence image vide ou trop volumineuse.');
  const fichier = path.join(dossier, \`reference-\${index}.\${extension}\`);
  await fsPromises.writeFile(fichier, buffer);
  return fichier;
}

async function listerImagesRecursif(dossier) {
  const resultats = [];
  async function parcourir(courant) {
    const entrees = await fsPromises.readdir(courant, { withFileTypes: true }).catch(() => []);
    for (const entree of entrees) {
      const complet = path.join(courant, entree.name);
      if (entree.isDirectory()) {
        await parcourir(complet);
      } else if (/\.(png|jpe?g|webp)$/i.test(entree.name) && !/^reference-/i.test(entree.name)) {
        const stat = await fsPromises.stat(complet).catch(() => null);
        if (stat?.size) resultats.push({ path: complet, mtimeMs: stat.mtimeMs, size: stat.size });
      }
    }
  }
  await parcourir(dossier);
  return resultats.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function mimePourFichier(fichier) {
  const ext = path.extname(fichier).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

async function generateImageWithCodex({ prompt, references = [] }) {
  const texte = String(prompt || '').trim();
  if (!texte) throw new Error('Prompt image vide.');
  if (texte.length > 12_000) throw new Error('Prompt image trop long.');
  const refs = Array.isArray(references) ? references.slice(0, 4) : [];
  const dossier = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'elyndor-image-'));
  let threadId = null;
  try {
    const fichiersReference = [];
    for (let i = 0; i < refs.length; i++) {
      fichiersReference.push(await ecrireReferenceImage(refs[i], dossier, i + 1));
    }
    const sortieVoulue = path.join(dossier, 'elyndor-output.png');
    const started = await codex.request('thread/start', { serviceName: 'elyndor_rp_image' }, 30_000);
    threadId = started?.thread?.id;
    if (!threadId) throw new Error('Codex n’a pas renvoyé de threadId pour l’image.');

    let turnId = null;
    let texteAgent = '';
    let finishResolve;
    let finishReject;
    const finished = new Promise((resolve, reject) => {
      finishResolve = resolve;
      finishReject = reject;
    });
    const timeout = setTimeout(() => finishReject(new Error('Timeout de génération d’image ChatGPT.')), IMAGE_TURN_TIMEOUT_MS);
    const off = codex.onNotification((msg) => {
      const params = msg.params || {};
      const notificationThreadId = params.threadId || params.thread?.id;
      if (notificationThreadId && notificationThreadId !== threadId) return;
      if (msg.method === 'item/agentMessage/delta') {
        const delta = params.delta;
        if (typeof delta === 'string') texteAgent += delta;
        else if (typeof delta?.text === 'string') texteAgent += delta.text;
      }
      if (msg.method === 'turn/completed') {
        const id = params.turn?.id || params.turnId;
        if (!turnId || !id || id === turnId) setTimeout(finishResolve, 500);
      }
    });

    try {
      const consigne = [
        '$imagegen',
        'Génère exactement UNE illustration à partir de la description ci-dessous.',
        fichiersReference.length
          ? 'Les images jointes sont des références CANONIQUES de personnages : conserve strictement identité du visage, race, carnation, cheveux, silhouette et signes distinctifs. Adapte seulement pose, expression, vêtements visibles et éclairage à la scène.'
          : '',
        'Ne crée aucun texte, logo, watermark ou interface dans l’image.',
        \`Enregistre le fichier final dans ce chemin exact : \${sortieVoulue}\`,
        'Ne produis pas de variante supplémentaire. Ne modifie et ne lis aucun autre fichier que les références jointes et le fichier de sortie demandé.',
        '',
        '[DESCRIPTION VISUELLE ELYNDOR]',
        texte,
      ].filter(Boolean).join('\n');

      const input = [
        { type: 'text', text: consigne },
        ...fichiersReference.map((fichier) => ({ type: 'localImage', path: fichier })),
      ];
      const turn = await codex.request('turn/start', {
        threadId,
        input,
        cwd: dossier,
        effort: 'low',
        approvalPolicy: 'never',
        sandboxPolicy: {
          type: 'workspaceWrite',
          writableRoots: [dossier],
          networkAccess: true,
        },
      }, 30_000);
      turnId = turn?.turn?.id || null;
      await finished;
    } finally {
      clearTimeout(timeout);
      off();
    }

    const images = await listerImagesRecursif(dossier);
    const choisie = images.find((image) => path.basename(image.path).toLowerCase().startsWith('elyndor-output')) || images[0];
    if (!choisie) {
      throw new Error('ChatGPT a terminé sans fichier image exploitable.' + (texteAgent.trim() ? ' Détail : ' + texteAgent.trim().slice(0, 300) : ''));
    }
    if (choisie.size > 12 * 1024 * 1024) throw new Error('Image générée trop volumineuse pour être renvoyée.');
    const buffer = await fsPromises.readFile(choisie.path);
    return {
      dataUrl: \`data:\${mimePourFichier(choisie.path)};base64,\${buffer.toString('base64')}\`,
      model: 'gpt-image-2',
      provider: 'chatgpt-codex',
    };
  } finally {
    if (threadId) codex.request('thread/delete', { threadId }, 10_000).catch(() => {});
    await fsPromises.rm(dossier, { recursive: true, force: true }).catch(() => {});
  }
}
`;

remplacer("\napp.get('/health'", `${helpers}\napp.get('/health'`, 'helpers génération image');

const route = String.raw`

app.post('/image', requireSession, async (req, res) => {
  try {
    const { prompt, references } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'prompt image requis.' });
      return;
    }
    const result = await generateImageWithCodex({ prompt, references });
    res.json(result);
  } catch (error) {
    console.error('[image]', error);
    res.status(500).json({ error: error.message || 'Génération d’image impossible.' });
  }
});
`;

remplacer("\napp.post('/chat'", `${route}\napp.post('/chat'`, 'route /image');

fs.writeFileSync(outputPath, source);
console.log('Passerelle V9 générée : ChatGPT Image + références visuelles.');
