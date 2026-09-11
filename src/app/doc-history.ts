// Browser-style back/forward across documents.
//
// Every document switch goes through the coordinator's `openFile`, so that is
// the one place that records where the app is leaving from. What comes back
// here is a path and a scroll offset: enough to land the reader where they were
// rather than at the top of the file.

export interface DocLocation {
  path: string;
  scrollTop: number;
}

/** Deep enough that nobody reaches the end of it in a session, shallow enough
 *  that a stale path list cannot grow without bound. */
const LIMIT = 50;

export class DocHistory {
  private readonly back: DocLocation[] = [];
  private readonly forward: DocLocation[] = [];

  /** Fired whenever the buttons' enabled state could have changed. */
  onChange?: () => void;

  get canGoBack(): boolean {
    return this.back.length > 0;
  }

  get canGoForward(): boolean {
    return this.forward.length > 0;
  }

  /** Record the place a navigation is leaving. Like a browser, going somewhere
   *  new invalidates whatever was ahead. An unsaved document has no path to
   *  come back to, so `null` is simply dropped. */
  push(from: DocLocation | null): void {
    if (!from) return;
    this.back.push(from);
    if (this.back.length > LIMIT) this.back.shift();
    this.forward.length = 0;
    this.onChange?.();
  }

  peekBack(): DocLocation | null {
    return this.back[this.back.length - 1] ?? null;
  }

  peekForward(): DocLocation | null {
    return this.forward[this.forward.length - 1] ?? null;
  }

  /** Only once the move has actually happened. Opening a document can still be
   *  turned down at the unsaved-changes prompt, and a jump the user cancelled
   *  must not eat an entry — hence peek, move, then commit.
   *
   *  `current` is where the app was *before* the move, so it has to be captured
   *  before it too. */
  commitBack(current: DocLocation | null): void {
    if (!this.back.pop()) return;
    if (current) this.forward.push(current);
    this.onChange?.();
  }

  commitForward(current: DocLocation | null): void {
    if (!this.forward.pop()) return;
    if (current) this.back.push(current);
    this.onChange?.();
  }

  /** The entry could not be opened — the file has been moved or deleted since.
   *  Drop it rather than leaving a button that fails every time it is pressed. */
  dropBack(): void {
    this.back.pop();
    this.onChange?.();
  }

  dropForward(): void {
    this.forward.pop();
    this.onChange?.();
  }
}
