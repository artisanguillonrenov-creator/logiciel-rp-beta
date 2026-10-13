/**
 * `prax` — le joueur en ligne de commande (outil de développement, hors
 * application) : tours en tourniquet, distribution autonome, menu d'actions
 * numéroté au tour du joueur, sauvegarde / reprise — plus les sous-commandes
 * `check`, `stress`, `flow`, `dump-play`, `explain`, `narrate`.
 *
 * Reprend `prax-cli/src/main.rs` (Prax, BSD-3-Clause).
 *
 *   node .prax-dist/tools/prax/cli.js [monde]            jouer (bar par défaut)
 *   node .prax-dist/tools/prax/cli.js [monde] resume     reprendre prax.save
 *   node .prax-dist/tools/prax/cli.js play fichier.json  jouer une pièce JSON
 *   node .prax-dist/tools/prax/cli.js check [monde]      vérifier un monde
 *   node .prax-dist/tools/prax/cli.js stress [monde]     200 parties aléatoires
 *   node .prax-dist/tools/prax/cli.js flow [f.json]      organigramme Mermaid
 *   node .prax-dist/tools/prax/cli.js dump-play          la pièce en JSON
 *   node .prax-dist/tools/prax/cli.js explain monde acteur texte
 *   node .prax-dist/tools/prax/cli.js narrate monde N    N tours sans joueur
 */
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { State } from '../../src/prax/core/engine';
import { explain } from '../../src/prax/core/inspect';
import { GroundedAction } from '../../src/prax/core/perform';
import { deserializeState, serializeState } from '../../src/prax/core/persist';
import { CURRENT_SCENE_PATH } from '../../src/prax/core/reserved';
import { stressTest } from '../../src/prax/core/stress';
import { advance, npcAct } from '../../src/prax/core/turn';
import { describe, typeCheck } from '../../src/prax/core/typecheck';
import { Character } from '../../src/prax/core/types';
import { compile, currentSceneOf, flowChart } from '../../src/prax/script/compile';
import { decodeScript, encodeScript } from '../../src/prax/script/json';
import { scriptPlayer } from '../../src/prax/script/script';
import * as audience from '../../src/prax/worlds/audience';
import * as bar from '../../src/prax/worlds/bar';
import * as feud from '../../src/prax/worlds/feud';
import * as intrigue from '../../src/prax/worlds/intrigue';
import * as play from '../../src/prax/worlds/play';
import * as vampire from '../../src/prax/worlds/vampire';
import * as village from '../../src/prax/worlds/village';

const SAVE_FILE = 'prax.save';
const LOOKAHEAD_DEPTH = 2;

/** Le monde choisi : titre, monde construit, nom du joueur. */
export function worldNamed(arg: string | undefined): [string, State, string] {
  switch (arg) {
    case 'intrigue':
      return ['Intrigue (Rome)', intrigue.intrigueWorld(), intrigue.PLAYER_NAME];
    case 'play':
      return ['the conspiracy (a play)', play.playWorld(), play.PLAYER_NAME];
    case 'dm':
      return ['the bar, and you direct it', bar.barDirectorWorld(), bar.DIRECTOR_NAME];
    case 'feud':
      return ['the feud (emergent sandbox)', feud.feudWorld(), feud.PLAYER_NAME];
    case 'audience':
      return ['the royal audience', audience.audienceWorld(), audience.PLAYER_NAME];
    case 'village':
      return ['the village', village.villageWorld(), village.PLAYER_NAME];
    case 'vampire':
      return ['the vampire village', vampire.vampireWorld(), vampire.PLAYER_NAME];
    default:
      return ['a night at the bar', bar.barWorld(), bar.PLAYER_NAME];
  }
}

export function renderCheck(name: string, world: State): string {
  const es = typeCheck(world);
  if (es.length === 0) return `well-formed: ${name}\n`;
  return `${name} — ${es.length} problem(s):\n` + es.map((e) => `  - ${describe(e)}\n`).join('');
}

function showAssoc(m: Map<string, number>): string {
  const keys = [...m.keys()].sort();
  return `[${keys.map((k) => `("${k}",${m.get(k)})`).join(',')}]`;
}

export function renderStress(name: string, world: State): string {
  const r = stressTest(200, 50, CURRENT_SCENE_PATH, world);
  let out = `stress-testing ${name} — 200 random runs, cap 50 turns\n`;
  out += `  endings:   ${showAssoc(r.endings)}\n`;
  out += `  coverage:  ${r.coverage.size} distinct actions fired\n`;
  if (r.visited.size > 0) out += `  scenes:    ${showAssoc(r.visited)} (runs visiting each)\n`;
  out += `  dead ends: ${r.deadEnds}\n`;
  out += `  no ending: ${r.noEnding} / ${r.runs} runs\n`;
  return out;
}

/** Les actions PROPOSÉES au joueur : les candidates moins les actions sans effet. */
export function playerActions(st: State, actor: Character): GroundedAction[] {
  const defs = st.practiceDefs();
  return st.candidateActions(actor).filter((ga) => {
    const a = defs.get(ga.practiceId)?.actions.find((x) => x.name === ga.actionId);
    return !(a !== undefined && a.then.length === 0);
  });
}

function endingOf(st: State): string | null {
  const ks = st.dbChildKeys('ending');
  return ks.length > 0 ? ks[0] : null;
}

function banner(title: string): void {
  const line = '='.repeat([...title].length + 4);
  console.log(line);
  console.log(`  ${title}`);
  console.log(line);
}

async function gameLoop(player: string, st0: State, ask: (q: string) => Promise<string | null>): Promise<void> {
  let st = st0;
  for (;;) {
    const e = endingOf(st);
    if (e !== null) {
      console.log('\n==============================');
      console.log(`  THE END — ${e}`);
      console.log('==============================');
      return;
    }
    const savePoint = st.clone();
    const actor = advance(st);
    if (actor.name === player) {
      for (;;) {
        console.log('\n-------------------- scene --------------------');
        const scene = currentSceneOf(st);
        if (scene !== null) console.log(`  (scene: ${scene})`);
        const acts = playerActions(st, actor);
        console.log(`Your move (${actor.name}):`);
        acts.forEach((a, i) => console.log(`  ${i + 1}) ${a.label}`));
        console.log('  m) wait and let others act');
        console.log('  s) save    q) quit');
        const line = await ask('> ');
        if (line === null || line.trim() === 'q') {
          console.log('Bye.');
          return;
        }
        const t = line.trim();
        if (t === 'm') break;
        if (t === 's') {
          fs.writeFileSync(SAVE_FILE, serializeState(savePoint));
          console.log(`(saved to ${SAVE_FILE})`);
          continue;
        }
        const n = Number.parseInt(t.replace(/^Pick /, ''), 10);
        if (Number.isInteger(n) && n >= 1 && n <= acts.length) {
          console.log(`> ${acts[n - 1].label}`);
          st.performAction(acts[n - 1]);
          break;
        }
        console.log('No such option.');
      }
    } else {
      const ga = npcAct(st, LOOKAHEAD_DEPTH, actor);
      if (ga !== null) console.log(`  ${ga.label}`);
    }
    st = st;
  }
}

function makeAsk(): [(q: string) => Promise<string | null>, () => void] {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines: string[] = [];
  const waiters: Array<(s: string | null) => void> = [];
  let closed = false;
  rl.on('line', (l) => {
    const w = waiters.shift();
    if (w) w(l);
    else lines.push(l);
  });
  rl.on('close', () => {
    closed = true;
    for (const w of waiters.splice(0)) w(null);
  });
  const ask = (q: string) => {
    process.stdout.write(q);
    if (lines.length > 0) return Promise.resolve(lines.shift() as string);
    if (closed) return Promise.resolve(null);
    return new Promise<string | null>((res) => waiters.push(res));
  };
  return [ask, () => rl.close()];
}

async function main(args: string[]): Promise<void> {
  const cmd = args[0];
  if (cmd === 'stress') {
    const [name, world] = worldNamed(args[1]);
    process.stdout.write(renderStress(name, world));
    return;
  }
  if (cmd === 'check') {
    const [name, world] = worldNamed(args[1]);
    process.stdout.write(renderCheck(name, world));
    return;
  }
  if (cmd === 'dump-play') {
    console.log(encodeScript(play.playScript()));
    return;
  }
  if (cmd === 'flow') {
    const f = args.find((a) => a.endsWith('.json'));
    process.stdout.write(flowChart(f === undefined ? play.playScript() : decodeScript(fs.readFileSync(f, 'utf8'))));
    return;
  }
  if (cmd === 'explain') {
    const [, world] = worldNamed(args[1]);
    for (const l of explain(world, args[2] ?? '', args[3] ?? '')) console.log(l);
    return;
  }
  if (cmd === 'narrate') {
    const [name, st] = worldNamed(args[1]);
    const n = Number(args[2] ?? '24');
    banner(`prax — ${name} (${n} tours, sans joueur)`);
    for (let k = 0; k < n && endingOf(st) === null; k++) {
      const actor = advance(st);
      const ga = npcAct(st, LOOKAHEAD_DEPTH, actor);
      if (ga !== null) console.log(`  ${ga.label}`);
    }
    const e = endingOf(st);
    if (e !== null) console.log(`  THE END — ${e}`);
    return;
  }
  const [ask, close] = makeAsk();
  try {
    if (cmd === 'play' && args[1]?.endsWith('.json')) {
      const scr = decodeScript(fs.readFileSync(args[1], 'utf8'));
      banner(`prax — ${args[1]}`);
      await gameLoop(scriptPlayer(scr), compile(scr), ask);
      return;
    }
    const [title, world, player] = worldNamed(args[0]);
    banner(`prax — ${title}`);
    let st = world;
    if (args.includes('resume')) {
      console.log(`(resumed from ${SAVE_FILE})`);
      st = deserializeState(fs.readFileSync(SAVE_FILE, 'utf8'), worldNamed(args[0])[1]);
    }
    await gameLoop(player, st, ask);
  } finally {
    close();
  }
}

declare const require: { main: unknown };
declare const module: unknown;
if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
