export type VisualAssetKind = 'avatar' | 'scene';

export type VisualAutomationEvent =
  | {
      type: 'avatar.ready';
      storyId: string;
      assetId: string;
      uri: string;
    }
  | {
      type: 'avatar.error';
      storyId: string;
      assetId: string;
      message: string;
    }
  | {
      type: 'scene.ready';
      storyId: string;
      revision: string;
      uri: string;
    }
  | {
      type: 'scene.error';
      storyId: string;
      revision: string;
      message: string;
    };

type Listener = (event: VisualAutomationEvent) => void;

const listeners = new Set<Listener>();

export function publierEvenementVisuel(event: VisualAutomationEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Un observateur UI ne doit jamais casser une routine du Kernel.
    }
  }
}

export function abonnerEvenementsVisuels(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reinitialiserEvenementsVisuelsPourTests(): void {
  listeners.clear();
}
