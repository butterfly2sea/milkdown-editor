export interface KeymapHandlers {
  save?: () => void;
  saveAs?: () => void;
  open?: () => void;
  newFile?: () => void;
  toggleSidebar?: () => void;
  toggleTheme?: () => void;
  exportMenu?: () => void;
  find?: () => void;
  findReplace?: () => void;
}

export function registerKeymap(handlers: KeymapHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      handlers.save?.();
    } else if (ctrl && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      handlers.saveAs?.();
    } else if (ctrl && !e.shiftKey && e.key === 'o') {
      e.preventDefault();
      handlers.open?.();
    } else if (ctrl && !e.shiftKey && e.key === 'n') {
      e.preventDefault();
      handlers.newFile?.();
    } else if (ctrl && e.key === '\\') {
      e.preventDefault();
      handlers.toggleSidebar?.();
    } else if (ctrl && e.key === '/') {
      e.preventDefault();
      handlers.toggleTheme?.();
    } else if (ctrl && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      handlers.exportMenu?.();
    } else if (ctrl && !e.shiftKey && e.key === 'f') {
      e.preventDefault();
      handlers.find?.();
    } else if (ctrl && e.key === 'h') {
      e.preventDefault();
      handlers.findReplace?.();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
