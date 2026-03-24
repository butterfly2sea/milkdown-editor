import { i18n } from '../i18n';

export type SidebarTab = 'files' | 'toc' | 'remote';

export class SidebarTabs {
  private tabBar: HTMLElement;
  private filesBtn: HTMLButtonElement;
  private tocBtn: HTMLButtonElement;
  private remoteBtn: HTMLButtonElement;
  private filesContainer: HTMLElement;
  private tocContainer: HTMLElement;
  private remoteContainer: HTMLElement;
  private activeTab: SidebarTab = 'toc';
  public onTabChange?: (tab: SidebarTab) => void;

  constructor(sidebarEl: HTMLElement) {
    // Tab bar
    this.tabBar = document.createElement('div');
    this.tabBar.style.cssText = `
      display: flex;
      border-bottom: 1px solid var(--border-color, #e8e8e8);
      padding: 0;
      flex-shrink: 0;
    `;

    this.filesBtn = this.createTabBtn(i18n.t.tabFiles, 'files');
    this.tocBtn = this.createTabBtn(i18n.t.tabOutline, 'toc');
    this.remoteBtn = this.createTabBtn(i18n.t.tabRemote, 'remote');

    this.tabBar.appendChild(this.filesBtn);
    this.tabBar.appendChild(this.tocBtn);
    this.tabBar.appendChild(this.remoteBtn);

    // Content containers
    this.filesContainer = document.createElement('div');
    this.filesContainer.style.cssText = 'flex: 1; overflow-y: auto; display: none;';

    this.tocContainer = document.createElement('div');
    this.tocContainer.style.cssText = 'flex: 1; overflow-y: auto; display: block;';

    this.remoteContainer = document.createElement('div');
    this.remoteContainer.style.cssText = 'flex: 1; overflow-y: auto; display: none;';

    // Restructure sidebar: wrap existing content
    sidebarEl.style.display = 'flex';
    sidebarEl.style.flexDirection = 'column';

    // Move existing sidebar children to files container
    while (sidebarEl.firstChild) {
      this.filesContainer.appendChild(sidebarEl.firstChild);
    }

    sidebarEl.appendChild(this.tabBar);
    sidebarEl.appendChild(this.filesContainer);
    sidebarEl.appendChild(this.tocContainer);
    sidebarEl.appendChild(this.remoteContainer);

    this.setActiveTab('toc');

    // Update texts on language change
    i18n.onChange(() => {
      this.filesBtn.textContent = i18n.t.tabFiles;
      this.tocBtn.textContent = i18n.t.tabOutline;
      this.remoteBtn.textContent = i18n.t.tabRemote;
    });
  }

  get filesEl(): HTMLElement {
    return this.filesContainer;
  }

  get tocEl(): HTMLElement {
    return this.tocContainer;
  }

  get remoteEl(): HTMLElement {
    return this.remoteContainer;
  }

  setActiveTab(tab: SidebarTab): void {
    this.activeTab = tab;
    this.filesContainer.style.display = tab === 'files' ? 'block' : 'none';
    this.tocContainer.style.display = tab === 'toc' ? 'block' : 'none';
    this.remoteContainer.style.display = tab === 'remote' ? 'block' : 'none';
    this.updateTabStyles();
    this.onTabChange?.(tab);
  }

  getActiveTab(): SidebarTab {
    return this.activeTab;
  }

  setTabVisible(tab: SidebarTab, visible: boolean): void {
    const btn = tab === 'files' ? this.filesBtn : tab === 'toc' ? this.tocBtn : this.remoteBtn;
    btn.style.display = visible ? '' : 'none';
    // If hiding the active tab, switch to another
    if (!visible && this.activeTab === tab) {
      this.setActiveTab(tab === 'files' ? 'toc' : 'files');
    }
  }

  private updateTabStyles(): void {
    const activeStyle = 'border-bottom: 2px solid var(--accent, #0366d6); color: var(--accent, #0366d6);';
    const inactiveStyle = 'border-bottom: 2px solid transparent; color: var(--text-muted, #999);';

    this.filesBtn.style.borderBottom = this.activeTab === 'files'
      ? '2px solid var(--accent, #0366d6)' : '2px solid transparent';
    this.filesBtn.style.color = this.activeTab === 'files'
      ? 'var(--accent, #0366d6)' : 'var(--text-muted, #999)';

    this.tocBtn.style.borderBottom = this.activeTab === 'toc'
      ? '2px solid var(--accent, #0366d6)' : '2px solid transparent';
    this.tocBtn.style.color = this.activeTab === 'toc'
      ? 'var(--accent, #0366d6)' : 'var(--text-muted, #999)';

    this.remoteBtn.style.borderBottom = this.activeTab === 'remote'
      ? '2px solid var(--accent, #0366d6)' : '2px solid transparent';
    this.remoteBtn.style.color = this.activeTab === 'remote'
      ? 'var(--accent, #0366d6)' : 'var(--text-muted, #999)';
  }

  private createTabBtn(text: string, tab: SidebarTab): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--text-muted, #999);
      cursor: pointer;
    `;
    btn.addEventListener('click', () => this.setActiveTab(tab));
    btn.addEventListener('mouseenter', () => {
      if (this.activeTab !== tab) btn.style.color = 'var(--text-secondary, #666)';
    });
    btn.addEventListener('mouseleave', () => {
      if (this.activeTab !== tab) btn.style.color = 'var(--text-muted, #999)';
    });
    return btn;
  }
}
