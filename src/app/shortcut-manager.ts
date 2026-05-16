import { registerKeymap, type KeymapHandlers } from '../editor/keymap';

export class ShortcutManager {
  private cleanup: (() => void) | null = null;

  constructor(private readonly handlers: KeymapHandlers) {}

  init(): void {
    this.dispose();
    this.cleanup = registerKeymap(this.handlers);
  }

  dispose(): void {
    this.cleanup?.();
    this.cleanup = null;
  }
}
