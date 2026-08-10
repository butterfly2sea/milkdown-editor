import { createEditor, getCursorInfo, editorUndo, editorRedo, getHeadings, scrollToPos } from '../editor/setup';
import { SearchBar } from '../editor/search';
import { SourceEditor } from '../editor/source-editor';
import { installExternalLinkHandler } from '../editor/external-links';
import { ZoomController } from '../editor/zoom';
import { SidebarTabs } from '../sidebar/sidebar-tabs';
import { TableOfContents } from '../sidebar/toc';
import { RemoteFileTree } from '../sidebar/remote-tree';
import { TitleBar } from '../titlebar/titlebar';
import { StatusBar } from '../statusbar/statusbar';
import { FileManager, type FileTreeNode } from '../file/fs';
import { FileTree } from '../sidebar/file-tree';
import { exportHTML } from '../file/export-html';

import { i18n } from '../i18n';
import { initPlantUMLServerFromStorage, showSettingsModal, setOnSyncConfigChange, setOnAutoSaveConfigChange } from '../settings/settings-modal';
import { getAutoSaveConfig } from '../settings/auto-save-config';
import { SyncManager } from '../sync/sync-manager';
import { showAboutModal } from '../about/about-modal';
import { MenuEvents, type MenuEvent } from '../types/menu-events';
import { EventManager } from '../utils/event-manager';
import { ShortcutManager } from './shortcut-manager';
import { AppStore } from './store';
import { toast } from '../ui/toast';
import {
  convertImageStorage,
  detectImageStorageState,
  type ImageStorageMode,
  type ImageStorageState,
} from '../editor/image-storage';

const defaultContent = '';

export function renderFatalError(err: unknown): void {
  console.error('[FATAL] App init failed:', err);
  const message = err instanceof Error ? err.stack || err.message : String(err);

  document.body.replaceChildren();
  const container = document.createElement('div');
  container.style.cssText = 'padding:24px;font-family:monospace;color:#c00';

  const heading = document.createElement('h2');
  heading.textContent = i18n.t.appInitFailed;
  const pre = document.createElement('pre');
  pre.textContent = message;
  const button = document.createElement('button');
  button.textContent = i18n.t.reload;
  button.addEventListener('click', () => location.reload());

  container.append(heading, pre, button);
  document.body.appendChild(container);
}

export class AppCoordinator {
  async start() {
  // Initialize i18n before anything else
  i18n.init();
  // Restore PlantUML server URL from localStorage
  initPlantUMLServerFromStorage();
  const eventManager = new EventManager();
  // Before any UI exists: the link tooltip and the About dialog both rely on it.
  installExternalLinkHandler(eventManager);

  const root = document.getElementById('editor-root');
  const titlebarEl = document.getElementById('titlebar');
  const statusbarEl = document.getElementById('statusbar');
  const sidebarEl = document.getElementById('sidebar');

  if (!root || !titlebarEl || !statusbarEl || !sidebarEl) {
    throw new Error('Required DOM elements not found');
  }

  let statusBar: StatusBar | null = null;
  let pendingStatusWarning: string | null = null;
  const showStatusWarning = (message: string) => {
    if (statusBar) {
      statusBar.showMessage(message, 'warn');
      toast(message, 'warn');
    } else {
      pendingStatusWarning = message;
    }
  };

  // Platform detection & disable native context menu in Tauri (desktop app)
  if ('__TAURI_INTERNALS__' in window) {
    import('@tauri-apps/plugin-os').then(({ platform }) => {
      const os = platform();
      document.body.classList.add(`platform-${os}`);
    }).catch((err) => {
      console.warn('[tauri] platform detection failed:', err);
      showStatusWarning(i18n.t.tauriFeatureUnavailable);
    });

    // Prevent WebView native context menu (Reload, Inspect, etc.).
    // Custom context menus use stopPropagation + their own preventDefault.
    eventManager.on(document, 'contextmenu', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('.ctx-menu, .plantuml-ctx-menu')) return;

      e.preventDefault();
    });
  }

  // Initialize UI components
  const appStore = new AppStore();
  const titleBar = new TitleBar(titlebarEl);
  statusBar = new StatusBar(statusbarEl);
  if (pendingStatusWarning) {
    statusBar.showMessage(pendingStatusWarning, 'warn');
    toast(pendingStatusWarning, 'warn');
  }
  const fileManager = new FileManager(appStore);

  // Initialize sidebar tabs first, then create FileTree inside the files container
  const sidebarTabs = new SidebarTabs(sidebarEl);
  const fileTree = new FileTree(sidebarTabs.filesEl);
  // Without a folder the tree has nothing to show, so the tab would only offer
  // a blank panel. It comes back the moment a folder is opened.
  sidebarTabs.setTabVisible('files', fileManager.hasFolderOpen);

  const getCurrentFilePath = () => appStore.get('currentFilePath');
  const getCurrentFileName = () => {
    const filePath = getCurrentFilePath();
    if (!filePath) return i18n.t.untitled;
    return filePath.replace(/\\/g, '/').split('/').pop() || i18n.t.untitled;
  };
  const isUnsaved = () => appStore.get('hasUnsavedChanges');
  let imageStorageState: ImageStorageState = 'local';
  let imageStorageConversionInFlight = false;
  const imageStorageConversionBusy = () => {
    if (!imageStorageConversionInFlight) return false;
    toast(i18n.t.imageStorageConverting, 'info');
    return true;
  };
  const activeImageStorageMode = (): ImageStorageMode =>
    imageStorageState === 'mixed' ? 'local' : imageStorageState;
  const updateImageStorageState = (state: ImageStorageState) => {
    imageStorageState = state;
    i18n.setImageStorageMode(state);
  };

  eventManager.addCleanup(appStore.subscribe('currentFilePath', (path) => {
    titleBar.setFileName(getCurrentFileName());
    fileTree.setActiveFile(path);
  }));
  eventManager.addCleanup(appStore.subscribe('hasUnsavedChanges', (hasUnsavedChanges) => {
    titleBar.setUnsaved(hasUnsavedChanges);
  }));
  eventManager.addCleanup(appStore.subscribe('syncStatus', (status) => {
    statusBar?.updateSyncStatus(status);
  }));
  eventManager.addCleanup(appStore.subscribe('syncFileStatuses', (statuses) => {
    fileTree.updateSyncStatuses(statuses);
  }));

  // Initialize editor (use let + reassign to avoid referencing before init)
  let editorReady = false;
  let onContentChange: (() => void) | null = null;
  let editorInstance: Awaited<ReturnType<typeof createEditor>> | null = null;
  const markEditorReady = () => {
    requestAnimationFrame(() => {
      editorReady = true;
      onContentChange?.();
    });
  };
  const editor = await createEditor(root, defaultContent, (markdown) => {
    // Skip change tracking during initial editor creation
    if (!editorReady) return;

    const reallyChanged = fileManager.hasRealChanges(markdown);
    appStore.set('hasUnsavedChanges', reallyChanged);
    statusBar.updateWordCount(markdown);

    if (editorInstance) {
      const { line, col } = getCursorInfo(editorInstance.crepe);
      statusBar.updateCursorPosition(line, col);
    }

    // Schedule auto-save only if content actually changed
    if (reallyChanged) {
      fileManager.scheduleAutoSave(markdown);
    }

    // Notify content change listeners (e.g., TOC update)
    onContentChange?.();
  }, getCurrentFilePath, activeImageStorageMode, () => {
    toast(i18n.t.imageStorageUrlUploadRequired, 'warn');
  });
  editorInstance = editor;
  // Expose for testing/debugging
  (window as any).__editor = editor;
  // Mark editor as ready after initial setup to avoid false "unsaved" state
  markEditorReady();

  // Update cursor position on click/key navigation
  const updateCursorPos = () => {
    // `statusBar.viewMode` only flips *after* onViewModeToggle returns, so ask
    // the source editor itself which mode is on screen right now.
    if (sourceEditor.isVisible) {
      const { state } = sourceEditor.view;
      const line = state.doc.lineAt(state.selection.main.head);
      statusBar.updateCursorPosition(line.number, state.selection.main.head - line.from + 1);
      return;
    }
    if (editorInstance) {
      const { line, col } = getCursorInfo(editorInstance.crepe);
      statusBar.updateCursorPosition(line, col);
    }
  };
  eventManager.on(root, 'click', updateCursorPos);
  eventManager.on(root, 'keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      updateCursorPos();
    }
  });

  // Set base content for change tracking
  fileManager.setBaseContent(defaultContent, editor.getMarkdown());

  // Auto-save callback
  // Reset initial unsaved state
  appStore.set('hasUnsavedChanges', false);

  fileManager.onAutoSave = () => {
    appStore.set('hasUnsavedChanges', false);
  };
  fileManager.setAutoSaveConfig(getAutoSaveConfig());

  // Initial word count
  statusBar.updateWordCount(defaultContent);

  // -- Document ownership across windows --
  // Several windows may run at once, but a document may only be edited in one
  // of them: they all auto-save, so two copies would overwrite each other. The
  // Rust side keeps the registry and focuses whichever window already owns a
  // file. A registry failure must never block editing, so it fails open.

  const inTauri = '__TAURI_INTERNALS__' in window;

  /** @returns false when another window owns the document (and has been raised). */
  const claimDocument = async (path: string): Promise<boolean> => {
    if (!inTauri) return true;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return (await invoke<string>('claim_document', { path })) !== 'busy';
    } catch (err) {
      console.warn('[doc-registry] claim failed:', err);
      return true;
    }
  };

  const releaseDocument = async (path: string): Promise<void> => {
    if (!inTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('release_document', { path });
    } catch (err) {
      console.warn('[doc-registry] release failed:', err);
    }
  };

  /** Open the current document's folder in the OS file manager, with the file
   *  itself selected where the platform supports it. */
  const revealCurrentFile = async (): Promise<void> => {
    const filePath = getCurrentFilePath();
    if (!filePath) {
      toast(i18n.t.revealNoFile, 'warn');
      return;
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reveal_in_file_manager', { path: filePath });
    } catch (err) {
      console.error('[reveal] failed:', err);
      toast(i18n.t.revealFailed, 'error');
    }
  };

  const focusEditor = () => {
    if (sourceEditor.isVisible) sourceEditor.focus();
    else (root.querySelector('.ProseMirror') as HTMLElement | null)?.focus();
  };

  // -- File operations --

  const openFile = async (path?: string) => {
    if (imageStorageConversionBusy()) return;

    const target = path ?? await fileManager.pickOpenPath();
    if (!target) return;

    // Already the document in this window — just put the cursor back in it
    // rather than reloading and re-prompting about unsaved changes.
    if (target === getCurrentFilePath()) {
      focusEditor();
      return;
    }

    if (isUnsaved()) {
      if (!confirm(i18n.t.unsavedWarning)) return;
    }

    if (!(await claimDocument(target))) {
      toast(i18n.t.docOpenInAnotherWindow, 'warn');
      return;
    }

    const previousPath = getCurrentFilePath();
    const content = await fileManager.openFile(target);
    if (content === null) {
      // Claimed above but never loaded — hand it back, or this window would
      // block every later attempt to open a file it is not even showing.
      void releaseDocument(target);
      console.error('[file] open failed:', fileManager.lastError);
      toast(i18n.t.fileOpenFailed, 'error');
      return;
    }
    if (previousPath && previousPath !== target) {
      void releaseDocument(previousPath);
    }

    editorReady = false;  // Suppress onChange during load
    editor.setMarkdown(content);
    // Reformatting done by the round-trip through the editor's AST is not an
    // edit; without this the file opens dirty and auto-save writes it back.
    fileManager.setNormalizedBaseline(editor.getMarkdown());
    // Source mode holds its own copy of the document; without this it would
    // keep showing (and, on save, write back) the previous file.
    if (sourceEditor.isVisible) sourceEditor.value = content;
    updateImageStorageState(detectImageStorageState(editor.crepe) ?? 'local');
    root.scrollTop = 0;
    statusBar.updateWordCount(content);
    updateToc();
    markEditorReady();
  };

  const getContent = () => {
    return sourceEditor.isVisible ? sourceEditor.value : editor.getMarkdown();
  };

  // In source mode the text *is* the document: rewriting a line the user just
  // typed back to how the file used to spell it would undo their edit. The
  // WYSIWYG editor has no such claim on its output, so there it applies.
  fileManager.sourcePreserver = (original, generated) => (
    sourceEditor.isVisible ? generated : editor.preserveSource(original, generated)
  );

  const saveAs = async (): Promise<boolean> => {
    if (imageStorageConversionBusy()) return false;

    // Pick the destination first: writing over a file another window is editing
    // would be exactly the double-edit the registry exists to prevent.
    const target = await fileManager.pickSavePath();
    if (!target) return false;

    const previousPath = getCurrentFilePath();
    if (target !== previousPath && !(await claimDocument(target))) {
      toast(i18n.t.docOpenInAnotherWindow, 'warn');
      return false;
    }

    const success = await fileManager.saveAs(getContent(), target);
    if (success) {
      if (previousPath && previousPath !== target) {
        void releaseDocument(previousPath);
      }
      fileTree.setActiveFile(getCurrentFilePath());
    }
    return success;
  };

  const saveFile = async () => {
    // No path yet → this is really a "Save As"; route it through the version
    // that checks ownership instead of FileManager's built-in fallback.
    if (!getCurrentFilePath()) {
      if (!(await saveAs())) return;
    } else if (!(await fileManager.saveFile(getContent()))) {
      return;
    }

    // Upload to WebDAV after save
    const filePath = getCurrentFilePath();
    if (filePath) {
      // What was written, not what the editor produced — the two differ once
      // untouched blocks are handed back in their original spelling, and the
      // remote copy has to match the local file byte for byte.
      syncManager.uploadFile(filePath, fileManager.savedContent).catch((err) => {
        console.error('[sync] upload after save failed:', err);
        toast(i18n.t.syncUploadFailed, 'error');
      });
    }
  };

  const newFile = () => {
    if (imageStorageConversionBusy()) return;
    if (isUnsaved()) {
      if (!confirm(i18n.t.unsavedWarning)) return;
    }
    // The window is letting go of the document, so another one may take it.
    const previousPath = getCurrentFilePath();
    if (previousPath) void releaseDocument(previousPath);
    fileManager.newFile();
    const newContent = '# Untitled\n\n';
    editorReady = false;  // Suppress onChange during load
    editor.setMarkdown(newContent);
    if (sourceEditor.isVisible) sourceEditor.value = newContent;
    updateImageStorageState('local');
    root.scrollTop = 0;
    fileManager.setBaseContent(newContent, editor.getMarkdown());
    markEditorReady();
  };

  const showFolderTree = (tree: FileTreeNode) => {
    sidebarEl.classList.add('open');
    sidebarTabs.setTabVisible('files', true);
    fileTree.render(tree);
    sidebarTabs.setActiveTab('files');
  };

  const openFolder = async () => {
    const tree = await fileManager.openFolder();
    if (tree) {
      showFolderTree(tree);
    } else if (fileManager.lastError) {
      console.error('[file] open folder failed:', fileManager.lastError);
      toast(i18n.t.folderOpenFailed, 'error');
    }
  };

  const openFolderByPath = async (dirPath: string) => {
    const tree = await fileManager.openFolderByPath(dirPath);
    if (tree) {
      showFolderTree(tree);
    } else if (fileManager.lastError) {
      console.error('[file] open folder failed:', fileManager.lastError);
      toast(i18n.t.folderOpenFailed, 'error');
    }
  };

  // File tree click handler
  fileTree.onFileSelect = (path) => {
    openFile(path);
  };

  // File tree refresh handler
  fileTree.onRefresh = async () => {
    if (fileManager.hasFolderOpen) {
      const tree = await fileManager.refreshFolder();
      if (tree) {
        fileTree.render(tree);
        const filePath = getCurrentFilePath();
        if (filePath) {
          fileTree.setActiveFile(filePath);
        }
      } else if (fileManager.lastError) {
        console.error('[file] refresh tree failed:', fileManager.lastError);
        toast(i18n.t.fileTreeRefreshFailed, 'error');
      }
    }
  };

  // -- WebDAV Sync --
  const syncManager = new SyncManager(appStore);
  syncManager.onRemoteChanged = async (fileName) => {
    return confirm(i18n.t.remoteFileUpdated.replace('{file}', fileName))
      ? 'download' : 'ignore';
  };
  syncManager.onConflict = async (fileName, localContent, remoteContent) => {
    const { showMergeModal } = await import('../sync/merge-modal');
    return showMergeModal(fileName, localContent, remoteContent);
  };
  syncManager.init();
  fileTree.syncEnabled = syncManager.isConfigured;
  sidebarTabs.setTabVisible('remote', syncManager.isConfigured);
  statusBar.onSyncClick = () => syncManager.sync();

  // File tree sync callbacks
  fileTree.onSyncFile = async (path) => {
    if (!syncManager.isConfigured) return;
    const config = (await import('../sync/sync-config')).getSyncConfig();
    if (!config) return;
    // Show remote folder picker for user to choose destination
    const { showRemoteFolderPicker } = await import('../sync/remote-folder-picker');
    const remoteFolder = await showRemoteFolderPicker(syncManager.webdavClient, config.remotePath || '/');
    if (!remoteFolder) return;
    const fileName = path.replace(/\\/g, '/').split('/').pop() || '';
    const remotePath = remoteFolder.replace(/\/+$/, '') + '/' + fileName;
    await syncManager.markForSync(path, remotePath);
  };
  fileTree.onUnsyncFile = (path) => {
    syncManager.unmarkSync(path);
  };

  // Re-init sync when config changes in settings
  setOnSyncConfigChange(() => {
    syncManager.restart();
    fileTree.syncEnabled = syncManager.isConfigured;
    sidebarTabs.setTabVisible('remote', syncManager.isConfigured);
    initRemoteTree();
  });

  setOnAutoSaveConfigChange(() => {
    fileManager.setAutoSaveConfig(getAutoSaveConfig());
  });

  // -- Theme --

  const toggleTheme = () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    localStorage.setItem('theme', html.getAttribute('data-theme')!);
    statusBar.updateThemeIcon();
  };

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  statusBar.updateThemeIcon();

  // -- Search bar --
  const searchBar = new SearchBar(root);
  searchBar.setEditor(editor.crepe);

  // -- Zoom (editor content only) --
  const zoom = new ZoomController(root, (pct) => statusBar?.updateZoom(pct));
  eventManager.on(root, 'wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    if (e.deltaY < 0) zoom.zoomIn();
    else zoom.zoomOut();
  }, { passive: false });

  // -- TOC --
  const toc = new TableOfContents(sidebarTabs.tocEl);
  toc.onHeadingClick = (pos) => {
    scrollToPos(editor.crepe, pos);
  };

  // Update TOC on content changes (debounced)
  let tocTimer: ReturnType<typeof setTimeout> | null = null;
  const updateToc = () => {
    if (tocTimer) clearTimeout(tocTimer);
    tocTimer = setTimeout(() => {
      const headings = getHeadings(editor.crepe);
      toc.update(headings);
    }, 300);
  };
  // Wire up TOC updates on content change
  onContentChange = updateToc;
  // Initial TOC
  updateToc();

  // -- Remote file tree --
  const remoteTree = new RemoteFileTree(sidebarTabs.remoteEl);
  remoteTree.onDownload = async (remotePath, fileName) => {
    // Ask user where to save
    const { save: saveDlg } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const localPath = await saveDlg({
      defaultPath: fileName,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (!localPath) return;
    await syncManager.downloadAndMap(remotePath, localPath);
    // Open the downloaded file
    await openFile(localPath);
  };

  // Initialize remote tree when sync is configured
  const initRemoteTree = async () => {
    if (syncManager.isConfigured) {
      const config = (await import('../sync/sync-config')).getSyncConfig();
      remoteTree.setClient(syncManager.webdavClient, config?.remotePath || '/');
    }
  };
  initRemoteTree();

  // Refresh remote tree when switching to Remote tab
  sidebarTabs.onTabChange = (tab) => {
    if (tab === 'remote' && syncManager.isConfigured) {
      remoteTree.refresh().catch((err) => {
        console.error('[remote] refresh failed:', err);
        toast(i18n.t.remoteRefreshFailed, 'error');
      });
    }
  };

  // -- Sidebar --

  const toggleSidebar = () => {
    sidebarEl.classList.toggle('open');
  };

  // -- Source / WYSIWYG toggle --

  // Source mode lives *inside* #editor-root, as a sibling of `.milkdown`. It
  // used to hang off #workspace, which left #editor-root as an empty sliver
  // beside it — and the find bar, being anchored to #editor-root, got squeezed
  // into the top-left corner and clipped.
  const sourceEditor = new SourceEditor(root, (value) => {
    const reallyChanged = fileManager.hasRealChanges(value);
    appStore.set('hasUnsavedChanges', reallyChanged);
    statusBar.updateWordCount(value);
    if (reallyChanged) {
      fileManager.scheduleAutoSave(value);
    }
  });
  searchBar.setSourceEditor(sourceEditor);

  statusBar.onViewModeToggle = (mode) => {
    if (imageStorageConversionBusy()) return false;
    if (!confirm(i18n.t.viewModeUndoWarning)) return false;

    const editorDiv = root.querySelector('.milkdown') as HTMLElement || root.firstElementChild as HTMLElement;
    if (mode === 'source') {
      // Switch to source mode
      sourceEditor.value = editor.getMarkdown();
      if (editorDiv) editorDiv.style.display = 'none';
      sourceEditor.show();
      sourceEditor.focus();
    } else {
      // Switch back to WYSIWYG
      const md = sourceEditor.value;
      sourceEditor.hide();
      if (editorDiv) editorDiv.style.display = '';
      editor.setMarkdown(md);
      updateImageStorageState(detectImageStorageState(editor.crepe) ?? imageStorageState);
    }
    searchBar.setTarget(mode === 'source' ? 'source' : 'wysiwyg');
    updateCursorPos();
    return true;
  };

  eventManager.addCleanup(() => sourceEditor.destroy());

  // -- Status bar callbacks --

  statusBar.onThemeToggle = toggleTheme;
  statusBar.onExport = async (format) => {
    if (format === 'html') {
      const theme = (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
      const title = getCurrentFileName();
      try {
        await exportHTML(getContent(), theme, title);
      } catch (err) {
        console.error('[export] html failed:', err);
        toast(i18n.t.exportFailed, 'error');
      }
    }
  };

  // -- Per-document image storage --
  const changeImageStorage = async (target: ImageStorageMode) => {
    if (statusBar.viewMode === 'source') {
      toast(i18n.t.imageStorageWysiwygOnly, 'warn');
      updateImageStorageState(imageStorageState);
      return;
    }
    const before = detectImageStorageState(editor.crepe);
    if (target === 'local' && before && before !== 'local' && !getCurrentFilePath()) {
      toast(i18n.t.localizeSaveFirst, 'warn');
      updateImageStorageState(before);
      return;
    }
    if (imageStorageConversionInFlight) {
      toast(i18n.t.imageStorageConverting, 'info');
      updateImageStorageState(imageStorageState);
      return;
    }
    imageStorageConversionInFlight = true;
    try {
      const result = await convertImageStorage(editor.crepe, getCurrentFilePath, target);
      const detected = detectImageStorageState(editor.crepe) ?? target;
      updateImageStorageState(detected);
      if (result.unsupported > 0) {
        toast(i18n.t.imageStorageUrlUploadRequired, 'warn');
        return;
      }
      const message = i18n.t.imageStorageConverted
        .replace('{n}', String(result.converted))
        .replace('{f}', String(result.failed));
      toast(message, result.failed ? 'warn' : 'info');
    } catch (err) {
      console.error('[image] storage conversion failed:', err);
      updateImageStorageState(imageStorageState);
      toast(i18n.t.imageStorageConversionFailed, 'error');
    } finally {
      imageStorageConversionInFlight = false;
    }
  };

  // -- Keyboard shortcuts --

  const shortcutManager = new ShortcutManager({
    save: saveFile,
    saveAs,
    open: () => openFile(),
    newFile,
    toggleSidebar,
    toggleTheme,
    exportMenu: () => {
      const exportBtn = document.querySelector(
        '.statusbar-btn[title*="Export"]',
      ) as HTMLButtonElement;
      exportBtn?.click();
    },
    find: () => searchBar.show(false),
    findReplace: () => searchBar.show(true),
    zoomIn: () => zoom.zoomIn(),
    zoomOut: () => zoom.zoomOut(),
    zoomReset: () => zoom.reset(),
    localizeImages: () => changeImageStorage('local'),
  });
  shortcutManager.init();
  eventManager.addCleanup(() => shortcutManager.dispose());

  // Warn before leaving with unsaved changes
  eventManager.on(window, 'beforeunload', (e) => {
    if (isUnsaved()) {
      e.preventDefault();
    }
  });

  // -- External file change detection & file tree refresh on window focus --
  let focusRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  const refreshOnFocus = async () => {
    if (imageStorageConversionInFlight) return;
    try {
      // Check if current file was modified externally
      const filePath = getCurrentFilePath();
      if (filePath) {
        const changed = await fileManager.checkExternalChange();
        if (changed) {
          const message = isUnsaved()
            ? i18n.t.fileChangedDiscardReload
            : i18n.t.fileChangedReload;
          if (confirm(message)) {
            const content = await fileManager.reloadFile();
            if (content !== null) {
              editorReady = false;  // Suppress onChange during load
              editor.setMarkdown(content);
              fileManager.setNormalizedBaseline(editor.getMarkdown());
              if (sourceEditor.isVisible) sourceEditor.value = content;
              updateImageStorageState(detectImageStorageState(editor.crepe) ?? 'local');
              root.scrollTop = 0;
              statusBar.updateWordCount(content);
              updateToc();
              markEditorReady();
            }
          } else {
            await fileManager.dismissExternalChange();
          }
        }
      }

      // Refresh file tree if a folder is open
      if (fileManager.hasFolderOpen) {
        const tree = await fileManager.refreshFolderTopLevel();
        if (tree) {
          fileTree.render(tree);
          // Re-highlight active file
          const refreshedFilePath = getCurrentFilePath();
          if (refreshedFilePath) {
            fileTree.setActiveFile(refreshedFilePath);
          }
        }
      }
    } catch (err) {
      console.warn('[file] external change check failed:', err);
      statusBar.showMessage(i18n.t.externalChangeCheckFailed, 'warn');
      toast(i18n.t.externalChangeCheckFailed, 'warn');
    }
  };
  eventManager.on(window, 'focus', () => {
    if (focusRefreshTimer) clearTimeout(focusRefreshTimer);
    focusRefreshTimer = setTimeout(() => {
      focusRefreshTimer = null;
      refreshOnFocus().catch((err) => {
        console.warn('[file] external change check failed:', err);
        statusBar.showMessage(i18n.t.externalChangeCheckFailed, 'warn');
        toast(i18n.t.externalChangeCheckFailed, 'warn');
      });
    }, 500);
  });

  eventManager.addCleanup(() => {
    if (tocTimer) {
      clearTimeout(tocTimer);
      tocTimer = null;
    }
    if (focusRefreshTimer) {
      clearTimeout(focusRefreshTimer);
      focusRefreshTimer = null;
    }
    syncManager.stop();
  });

  eventManager.on(window, 'pagehide', () => {
    eventManager.cleanup();
  }, { once: true });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      eventManager.cleanup();
    });
  }

  // -- Tauri menu events --
  if ('__TAURI_INTERNALS__' in window) {
    // Dedupe OS-driven open requests: on macOS cold start the Rust side can both
    // emits "open-file" and stores the path in PendingFile, so the listener
    // and take_pending_file can race and trigger two openFile calls (which
    // would also pop two unsaved-changes confirms).
    let lastOsOpenPath: string | null = null;
    let lastOsOpenAt = 0;
    const openFromOs = (path: string, isDir: boolean) => {
      const now = Date.now();
      if (path === lastOsOpenPath && now - lastOsOpenAt < 2000) return;
      lastOsOpenPath = path;
      lastOsOpenAt = now;
      if (isDir) openFolderByPath(path);
      else openFile(path);
    };

    const listenerSetup = import('@tauri-apps/api/event').then(async ({ listen }) => {
      const menuHandlers: Record<MenuEvent, () => void> = {
        [MenuEvents.NEW]: () => newFile(),
        [MenuEvents.OPEN]: () => openFile(),
        [MenuEvents.OPEN_FOLDER]: () => openFolder(),
        [MenuEvents.SAVE]: () => saveFile(),
        [MenuEvents.SAVE_AS]: () => saveAs(),
        [MenuEvents.EXPORT_HTML]: () => {
          const theme = (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
          exportHTML(getContent(), theme, getCurrentFileName()).catch((err) => {
            console.error('[export] html failed:', err);
            toast(i18n.t.exportFailed, 'error');
          });
        },
        [MenuEvents.UNDO]: () => editorUndo(editor.crepe),
        [MenuEvents.REDO]: () => editorRedo(editor.crepe),
        [MenuEvents.FIND]: () => searchBar.show(false),
        [MenuEvents.FIND_REPLACE]: () => searchBar.show(true),
        [MenuEvents.IMAGE_STORAGE_BASE64]: () => {
          void changeImageStorage('base64');
        },
        [MenuEvents.IMAGE_STORAGE_LOCAL]: () => {
          void changeImageStorage('local');
        },
        [MenuEvents.IMAGE_STORAGE_URL]: () => {
          void changeImageStorage('url');
        },
        [MenuEvents.SYNC_FILE]: () => {
          if (getCurrentFilePath()) {
            syncManager.sync().catch((err) => {
              console.error('[sync] manual sync failed:', err);
              toast(i18n.t.syncFailed, 'error');
            });
          }
        },
        [MenuEvents.MARK_SYNC]: () => {
          const filePath = getCurrentFilePath();
          if (filePath) {
            const isSynced = syncManager.fileStatuses.has(filePath);
            if (isSynced) {
              syncManager.unmarkSync(filePath);
            } else {
              fileTree.onSyncFile?.(filePath);
            }
          }
        },
        [MenuEvents.REVEAL_FILE]: () => {
          void revealCurrentFile();
        },
        [MenuEvents.TOGGLE_SIDEBAR]: () => toggleSidebar(),
        [MenuEvents.TOGGLE_THEME]: () => toggleTheme(),
        [MenuEvents.TOGGLE_FULLSCREEN]: async () => {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          const isFullscreen = await win.isFullscreen();
          await win.setFullscreen(!isFullscreen);
        },
        [MenuEvents.LANG_EN]: () => i18n.setLang('en'),
        [MenuEvents.LANG_ZH]: () => i18n.setLang('zh'),
        [MenuEvents.SETTINGS]: () => showSettingsModal(),
        [MenuEvents.ABOUT]: () => showAboutModal(),
      };

      const unlistenPromises = Object.entries(menuHandlers).map(([event, handler]) =>
        listen(event, () => {
          console.log('[menu] received:', event);
          handler();
        }),
      );

      // Listen for file open from OS file association.
      unlistenPromises.push(listen<string>('open-file', (event) => {
        console.log('[open-file] received:', event.payload);
        openFromOs(event.payload, false);
      }));

      // Listen for folder open from OS integration.
      unlistenPromises.push(listen<string>('open-folder-path', (event) => {
        console.log('[open-folder-path] received:', event.payload);
        openFromOs(event.payload, true);
      }));

      const unlistens = await Promise.all(unlistenPromises);
      return () => {
        for (const unlisten of unlistens) {
          unlisten();
        }
      };
    });

    eventManager.addAsyncCleanup(listenerSetup);

    // Drain any pending file/folder from OS launch (file association / double-click)
    // AFTER listeners are registered, so an OS event that races with startup can't
    // slip past both the live listener and this one-shot poll.
    listenerSetup.then(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const path = await invoke<string | null>('take_pending_file');
      if (!path) return;
      console.log('[pending-path] opening:', path);
      // Use fs plugin to check if path is a directory
      try {
        const { stat } = await import('@tauri-apps/plugin-fs');
        const info = await stat(path);
        openFromOs(path, info.isDirectory);
      } catch {
        // Fallback: try as file
        openFromOs(path, false);
      }
    });

    // Drag-and-drop file support
    eventManager.addAsyncCleanup(import('@tauri-apps/api/webview').then(async ({ getCurrentWebview }) => {
      const dropOverlay = document.createElement('div');
      dropOverlay.id = 'drop-overlay';
      const dropLabel = document.createElement('div');
      dropLabel.className = 'drop-overlay-content';
      dropLabel.textContent = i18n.t.dropToOpen;
      dropOverlay.appendChild(dropLabel);
      document.body.appendChild(dropOverlay);

      const unsubscribeI18n = i18n.onChange(() => {
        dropLabel.textContent = i18n.t.dropToOpen;
      });

      const IMAGE_DROP_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;
      let lastDropTime = 0;
      // `over` events carry no paths, so remember what `enter` saw.
      let dragHasImage = false;
      const unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
        const payload = event.payload as typeof event.payload & {
          paths?: string[];
          position?: { x: number; y: number };
        };
        if (payload.type === 'enter' || payload.type === 'over') {
          if (payload.type === 'enter') {
            dragHasImage = payload.paths?.some((p) => IMAGE_DROP_RE.test(p)) ?? false;
          }
          // Image files are inserted into the editor, not opened — don't show
          // the "drop to open" overlay for them.
          dropOverlay.classList.toggle('visible', !dragHasImage);
        } else if (payload.type === 'drop') {
          dragHasImage = false;
          dropOverlay.classList.remove('visible');
          const now = Date.now();
          if (now - lastDropTime < 500) return;
          lastDropTime = now;
          const paths = payload.paths ?? [];
          if (paths.length === 0) return;

          // Image files → localize into <md>.assets and insert at the drop point.
          const images = paths.filter((p) => IMAGE_DROP_RE.test(p));
          if (images.length > 0) {
            const storageMode = activeImageStorageMode();
            if (storageMode === 'url') {
              toast(i18n.t.imageStorageUrlUploadRequired, 'warn');
              return;
            }
            if (storageMode === 'local' && !getCurrentFilePath()) {
              toast(i18n.t.localizeSaveFirst, 'warn');
              return;
            }
            try {
              const { dropLocalImages } = await import('../editor/image-localize');
              const coords = payload.position
                ? {
                    left: payload.position.x / window.devicePixelRatio,
                    top: payload.position.y / window.devicePixelRatio,
                  }
                : undefined;
              await dropLocalImages(
                editor.crepe,
                getCurrentFilePath,
                images,
                coords,
                storageMode,
              );
            } catch (err) {
              console.error('[drop] image localize failed:', err);
              toast(i18n.t.localizeFailed, 'error');
            }
            return;
          }

          // Directory → open as folder tree
          try {
            const { stat } = await import('@tauri-apps/plugin-fs');
            const info = await stat(paths[0]);
            if (info.isDirectory) {
              openFolderByPath(paths[0]);
              return;
            }
          } catch (err) {
            console.warn('[drop] file check failed:', err);
            toast(i18n.t.dropFileCheckFailed, 'warn');
          }
          const mdFile = paths.find(
            (p: string) => p.endsWith('.md') || p.endsWith('.markdown')
          );
          if (mdFile) {
            openFile(mdFile);
          }
        } else if (payload.type === 'leave') {
          dragHasImage = false;
          dropOverlay.classList.remove('visible');
        }
      });
      return () => {
        unlistenDragDrop();
        unsubscribeI18n();
        dropOverlay.remove();
      };
    }));
  }
}

}
