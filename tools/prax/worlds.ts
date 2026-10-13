/** Le registre des mondes (outillage hors application). */
import { State } from '../../src/prax/core/engine';
import * as feud from '../../src/prax/worlds/feud';
import * as intrigue from '../../src/prax/worlds/intrigue';
import * as bar from '../../src/prax/worlds/bar';
import * as village from '../../src/prax/worlds/village';
import * as play from '../../src/prax/worlds/play';
import * as audience from '../../src/prax/worlds/audience';
import * as vampire from '../../src/prax/worlds/vampire';
import { compile } from '../../src/prax/script/compile';
import { decodeScript } from '../../src/prax/script/json';
import { CG1_SCRIPT_JSON } from './fixtures';

export const BIG_FEUD_N = 20;

export function buildWorld(name: string): State {
  switch (name) {
    case 'feud':
      return feud.feudWorld();
    case 'bigfeud':
      return feud.bigFeud(BIG_FEUD_N);
    case 'intrigue':
      return intrigue.intrigueWorld();
    case 'bar':
      return bar.barWorld();
    case 'dm':
      return bar.barDirectorWorld();
    case 'village':
      return village.villageWorld();
    case 'play':
      return play.playWorld();
    case 'audience':
      return audience.audienceWorld();
    case 'cg1':
      return compile(decodeScript(CG1_SCRIPT_JSON));
    case 'vampire':
      return vampire.vampireWorld();
    default:
      throw new Error(`monde inconnu : ${name}`);
  }
}

export function idlerOf(name: string): string | null {
  switch (name) {
    case 'feud':
    case 'bigfeud':
      return feud.PLAYER_NAME;
    case 'bar':
      return bar.PLAYER_NAME;
    case 'dm':
      return bar.DIRECTOR_NAME;
    case 'village':
      return village.PLAYER_NAME;
    case 'play':
      return play.PLAYER_NAME;
    case 'audience':
      return audience.PLAYER_NAME;
    case 'cg1':
      return 'p';
    default:
      return null;
  }
}
