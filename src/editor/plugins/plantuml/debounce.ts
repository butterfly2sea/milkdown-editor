export class DisposableDebounce {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly delay: number) {}

  schedule(task: () => void): void {
    if (this.disposed) return;
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.disposed) task();
    }, this.delay);
  }

  cancel(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
}

export function scheduleDisposableTimeout(task: () => void, delay: number): () => void {
  let disposed = false;
  const timer = setTimeout(() => {
    if (!disposed) task();
  }, delay);

  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}
