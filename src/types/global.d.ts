declare const __APP_VERSION__: string;

interface ImportMetaHot {
  dispose(callback: () => void): void;
}

interface ImportMeta {
  readonly hot?: ImportMetaHot;
}
