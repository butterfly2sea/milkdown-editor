export interface AppState {
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
  syncStatus: SyncStatus;
  syncFileStatuses: Map<string, SyncFileStatus>;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'disabled';
export type SyncFileStatus = 'synced' | 'syncing' | 'error';

type AppStateKey = keyof AppState;

interface AppStateChange<K extends AppStateKey = AppStateKey> {
  key: K;
  value: AppState[K];
  state: Readonly<AppState>;
}

type AppStateListener<K extends AppStateKey> = (
  value: AppState[K],
  state: Readonly<AppState>,
) => void;

export class AppStore extends EventTarget {
  private state: AppState = {
    currentFilePath: null,
    hasUnsavedChanges: false,
    syncStatus: 'disabled',
    syncFileStatuses: new Map(),
  };

  get<K extends AppStateKey>(key: K): AppState[K] {
    return this.state[key];
  }

  getSnapshot(): Readonly<AppState> {
    return this.state;
  }

  set<K extends AppStateKey>(key: K, value: AppState[K]): void {
    if (Object.is(this.state[key], value)) return;

    this.state = {
      ...this.state,
      [key]: value,
    };

    const detail: AppStateChange<K> = {
      key,
      value,
      state: this.state,
    };

    this.dispatchEvent(new CustomEvent<AppStateChange<K>>('change', { detail }));
    this.dispatchEvent(new CustomEvent<AppStateChange<K>>(`change:${String(key)}`, { detail }));
  }

  subscribe<K extends AppStateKey>(
    key: K,
    listener: AppStateListener<K>,
  ): () => void {
    const eventName = `change:${String(key)}`;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AppStateChange<K>>).detail;
      listener(detail.value, detail.state);
    };

    this.addEventListener(eventName, handler);
    return () => this.removeEventListener(eventName, handler);
  }
}
