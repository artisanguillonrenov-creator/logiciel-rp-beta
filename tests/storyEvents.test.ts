import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryState } from '../src/types';
import {
  abonnerSauvegardesNarratives,
  abonnerSauvegardesStory,
  publierSauvegardeNarrative,
  publierSauvegardeStory,
  reinitialiserStoryEventsPourTests,
} from '../src/automation/storyEvents';

function story(content = 'Bonjour'): StoryState {
  return {
    meta: { id: 'story-1', personnageNom: 'Ariane' },
    messages: [{ id: 'm1', role: 'user', content }],
  } as StoryState;
}

test.afterEach(() => {
  reinitialiserStoryEventsPourTests();
});

test('les écrans reçoivent chaque sauvegarde tandis que le pipeline narratif reste dédupliqué', () => {
  let ui = 0;
  let narratif = 0;
  const stopUi = abonnerSauvegardesStory(() => { ui += 1; });
  const stopNarratif = abonnerSauvegardesNarratives(() => { narratif += 1; });
  const memeHistoire = story();

  publierSauvegardeStory(memeHistoire);
  publierSauvegardeNarrative(memeHistoire);
  publierSauvegardeStory(memeHistoire);
  publierSauvegardeNarrative(memeHistoire);

  assert.equal(ui, 2);
  assert.equal(narratif, 1);

  stopUi();
  stopNarratif();
  publierSauvegardeStory(story('Suite'));
  publierSauvegardeNarrative(story('Suite'));
  assert.equal(ui, 2);
  assert.equal(narratif, 1);
});
