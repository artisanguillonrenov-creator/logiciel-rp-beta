import fs from 'node:fs';

await import(new URL('./build-v9-runtime-fixed.mjs', import.meta.url).href + `?v=${Date.now()}`);

const runtimePath = new URL('./server-v9-runtime.js', import.meta.url);
let runtime = fs.readFileSync(runtimePath, 'utf8');
runtime = runtime.replaceAll('\\`', '`').replaceAll('\\${', '${');
fs.writeFileSync(runtimePath, runtime);
console.log('Passerelle V9 finalisée et syntaxe des templates normalisée.');
