import { fetch } from '@tauri-apps/plugin-http';

export interface RemoteFileInfo {
  path: string;
  name: string;
  isDir: boolean;
  mtime: number;
  size: number;
}

export class WebDAVClient {
  private baseUrl: string = '';
  private authHeader: string = '';

  configure(url: string, username: string, password: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
    this.authHeader = 'Basic ' + btoa(username + ':' + password);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await this.request('PROPFIND', '/', { Depth: '0' });
      if (response.ok || response.status === 207) {
        return { ok: true };
      }
      return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async listFiles(remotePath: string): Promise<RemoteFileInfo[]> {
    const response = await this.request('PROPFIND', remotePath, { Depth: '1' });
    if (!response.ok && response.status !== 207) {
      throw new Error(`PROPFIND failed: ${response.status}`);
    }

    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    // WebDAV responses use the DAV: namespace
    const davNs = 'DAV:';
    const responses = doc.getElementsByTagNameNS(davNs, 'response');
    const results: RemoteFileInfo[] = [];

    // Build the full request URL path to compare against hrefs for skipping the directory itself
    let requestUrlPath: string;
    try {
      const basePathname = new URL(this.baseUrl).pathname.replace(/\/+$/, '');
      const normPath = ('/' + remotePath).replace(/\/+/g, '/').replace(/\/+$/, '');
      requestUrlPath = (basePathname + normPath).replace(/\/+/g, '/');
      if (requestUrlPath === '') requestUrlPath = '/';
    } catch {
      requestUrlPath = remotePath;
    }

    for (let i = 0; i < responses.length; i++) {
      const responseEl = responses[i];

      // Extract href
      const hrefEl = responseEl.getElementsByTagNameNS(davNs, 'href')[0];
      if (!hrefEl?.textContent) continue;
      const href = decodeURIComponent(hrefEl.textContent);

      // Skip the directory entry itself by comparing normalized paths
      const hrefClean = href.replace(/\/+$/, '') || '/';
      const reqClean = requestUrlPath.replace(/\/+$/, '') || '/';
      if (hrefClean === reqClean) {
        continue;
      }

      // Find the successful propstat (status 200)
      const propstats = responseEl.getElementsByTagNameNS(davNs, 'propstat');
      let propEl: Element | null = null;
      for (let j = 0; j < propstats.length; j++) {
        const statusEl = propstats[j].getElementsByTagNameNS(davNs, 'status')[0];
        if (statusEl?.textContent?.includes('200')) {
          propEl = propstats[j].getElementsByTagNameNS(davNs, 'prop')[0];
          break;
        }
      }
      if (!propEl) continue;

      // Detect directory via resourcetype/collection
      const resourceType = propEl.getElementsByTagNameNS(davNs, 'resourcetype')[0];
      const isDir =
        resourceType !== undefined &&
        resourceType.getElementsByTagNameNS(davNs, 'collection').length > 0;

      // Get last modified time
      const lastModEl = propEl.getElementsByTagNameNS(davNs, 'getlastmodified')[0];
      const mtime = lastModEl?.textContent
        ? new Date(lastModEl.textContent).getTime()
        : 0;

      // Get content length
      const contentLenEl = propEl.getElementsByTagNameNS(
        davNs,
        'getcontentlength',
      )[0];
      const size = contentLenEl?.textContent
        ? parseInt(contentLenEl.textContent, 10)
        : 0;

      // Derive a relative path from the href
      // Strip the base URL pathname prefix from the href
      let relativePath = href;
      try {
        const basePath = new URL(this.baseUrl).pathname.replace(/\/+$/, '');
        if (relativePath.startsWith(basePath)) {
          relativePath = relativePath.slice(basePath.length);
        }
      } catch {
        // If baseUrl parsing fails, use href as-is
      }
      // Remove trailing slash for directories
      relativePath = relativePath.replace(/\/+$/, '');

      // Extract file name from path
      const name = relativePath.split('/').pop() ?? relativePath;

      // Only include markdown files (or directories)
      if (
        !isDir &&
        !name.endsWith('.md') &&
        !name.endsWith('.markdown')
      ) {
        continue;
      }

      results.push({ path: relativePath, name, isDir, mtime, size });
    }

    return results;
  }

  async getFile(remotePath: string): Promise<string> {
    const response = await this.request('GET', remotePath);
    if (!response.ok) throw new Error(`GET failed: ${response.status}`);
    return response.text();
  }

  async putFile(remotePath: string, content: string): Promise<void> {
    const response = await this.request('PUT', remotePath, {}, content);
    if (!response.ok && response.status !== 201 && response.status !== 204) {
      throw new Error(`PUT failed: ${response.status}`);
    }
  }

  async mkdir(remotePath: string): Promise<void> {
    const response = await this.request('MKCOL', remotePath);
    // 201 created, 405 already exists - both are fine
    if (!response.ok && response.status !== 405) {
      throw new Error(`MKCOL failed: ${response.status}`);
    }
  }

  private async request(
    method: string,
    path: string,
    extraHeaders: Record<string, string> = {},
    body?: string,
  ): Promise<Response> {
    // Normalize path: remove double slashes, ensure leading slash
    const normalizedPath = ('/' + path).replace(/\/+/g, '/');
    const url = this.baseUrl + normalizedPath;
    return fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        ...extraHeaders,
      },
      body: body ?? undefined,
      connectTimeout: 10000,
      danger: {
        acceptInvalidCerts: true,
        acceptInvalidHostnames: true,
      },
    } as any);
  }
}
