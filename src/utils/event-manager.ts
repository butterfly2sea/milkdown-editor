type CleanupFn = () => void;

export class EventManager {
  private ac = new AbortController();
  private cleanups = new Set<CleanupFn>();

  on<K extends keyof DocumentEventMap>(
    target: Document,
    event: K,
    handler: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  on<K extends keyof WindowEventMap>(
    target: Window,
    event: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  on(
    target: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(event, handler, {
      ...options,
      signal: this.ac.signal,
    });
  }

  addCleanup(cleanup: CleanupFn): void {
    this.cleanups.add(cleanup);
  }

  cleanup(): void {
    this.ac.abort();
    this.ac = new AbortController();

    const cleanups = [...this.cleanups];
    this.cleanups.clear();
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (err) {
        console.error('[event-manager] cleanup failed:', err);
      }
    }
  }
}
