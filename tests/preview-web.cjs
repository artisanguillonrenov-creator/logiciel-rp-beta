// Prévisualisation locale isolée : node tests/preview-web.cjs après expo export.
// La fixture ne contient aucune clé réelle et n'est jamais incluse dans dist/.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const racine = path.resolve(__dirname, '../dist');
const port = Number(process.env.ELYNDOR_PREVIEW_PORT || 8082);
const maintenant = Date.now();
const histoire = {
  version: 9,
  meta: { id: 'qa-migration', personnageNom: 'Voyageur de test', personnageDescription: 'Voyageur adulte', pointDeDepart: 'Paris', contexte: { lieu: 'Porte de Paris', ambiance: 'Crépuscule', dateChronique: '', objectifs: 'Retrouver la caravane' }, createdAt: maintenant, updatedAt: maintenant },
  messages: Array.from({ length: 1000 }, (_, i) => ({ id: `qa-${i}`, role: i % 2 ? 'assistant' : 'user', timestamp: maintenant + i, content: i % 2 ? '*Sylvana observe la porte de la ville. Les lanternes s’allument dans la brume.*\nSYLVANA : « On nous attend. Tu es prêt ? »\n*Le garde reconnaît le voyageur et s’écarte.*' : 'Je rejoins Sylvana et observe les gardes.' })),
  settings: { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' },
  memoire: { resume: '', faits: [], dernierMessageIndexMaj: 1000 },
  loreEmergent: [{ id: 'qa-sylvana', titre: 'Sylvana', categorie: 'pnj', statut: 'permanent', contenu: 'Une éclaireuse adulte accompagne le voyageur.', mentions: 3, dernierMessageIndex: 999 }],
  directeur: { arcActuel: '', tension: 'calme', dernierBeatIndex: 1000, beats: [] },
  monde: { zones: [], flags: {}, compteurs: {}, declencheurs: [] },
  social: { engagements: [], relations: [] },
};
const portrait = fs.readdirSync(path.join(racine, 'assets/assets/portraits')).find((nom) => nom.startsWith('elfes-noirs-femme.'));
const pageFixture = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Test local Elyndor</title>
<h1>Campagne fictive de vérification</h1><p>1 000 messages, aucun appel payant. Cette page ne concerne que ce serveur local de test.</p>
<button id="charger">Préparer la campagne de test</button><p id="etat"></p><a href="/logiciel-rp-beta/">Ouvrir Elyndor</a>
<script>
document.getElementById('charger').onclick = async () => {
  localStorage.setItem('@rp_beta/settings', JSON.stringify({openRouterApiKey:'',model:'test',betaAcceptee:true,profilContenu:'grand_public',genererImagesActive:false,modeConcepteur:false}));
  localStorage.setItem('@rp_beta/story/qa-migration', JSON.stringify(${JSON.stringify(histoire)}));
  const req = indexedDB.open('elyndor-pnj-avatars', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('avatars');
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction('avatars', 'readwrite');
    tx.objectStore('avatars').put('/logiciel-rp-beta/assets/assets/portraits/${portrait}', 'qa-migration_qa-sylvana');
    tx.oncomplete = () => {db.close();document.getElementById('etat').textContent = 'Campagne prête. Ouvre Elyndor.';};
  };
};
</script></html>`;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fixture.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(pageFixture);
    return;
  }
  const relatif = decodeURIComponent(url.pathname).replace(/^\/logiciel-rp-beta\/?/, '');
  const fichier = path.resolve(racine, relatif || 'index.html');
  if (!fichier.startsWith(racine + path.sep) || !fs.existsSync(fichier) || !fs.statSync(fichier).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] || 'application/octet-stream' });
  fs.createReadStream(fichier).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`Prévisualisation locale : http://localhost:${port}/fixture.html`));
