import { normalizePath, type CachedMetadata } from 'obsidian';
import type { ContextProvider } from './types';
import { escapeHtml } from './helpers';

export interface ObsidianContextFile {
  readonly path: string;
  readonly basename: string;
  readonly name: string;
  readonly extension: string;
  readonly stat: {
    readonly ctime: number;
    readonly mtime: number;
    readonly size: number;
  };
}

export interface ObsidianContextApp {
  readonly vault: {
    getName(): string;
    cachedRead(file: ObsidianContextFile): Promise<string>;
    getAbstractFileByPath(path: string): unknown;
  };
  readonly metadataCache: {
    getFileCache(file: ObsidianContextFile): CachedMetadata | null;
    getFirstLinkpathDest(linkpath: string, sourcePath: string): ObsidianContextFile | null;
  };
}

export type FileSource = string | ObsidianContextFile;

const BUILT_IN_PROPERTIES = new Set([
  'path', 'folder', 'title', 'content', 'created', 'modified', 'size', 'extension', 'name',
  'today', 'now', 'year', 'month', 'day',
  'vault',
  'outgoingLinks', 'tags', 'headings'
]);

function stripMarkdownExtension(path: string): string {
  return path.replace(/\.md$/, '');
}

function wikilink(path: string, anchor = '', display?: string): string {
  const target = `${stripMarkdownExtension(path)}${anchor}`;
  return display ? `[[${target}|${display}]]` : `[[${target}]]`;
}

function isObsidianContextFile(value: unknown): value is ObsidianContextFile {
  if (value === null || typeof value !== 'object') return false;

  const candidate = value as Partial<ObsidianContextFile>;
  return typeof candidate.path === 'string'
    && typeof candidate.basename === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.extension === 'string'
    && candidate.stat !== undefined
    && typeof candidate.stat.ctime === 'number'
    && typeof candidate.stat.mtime === 'number'
    && typeof candidate.stat.size === 'number';
}

export class ObsidianContextProvider implements ContextProvider {
  private file: ObsidianContextFile | null = null;
  private metadata: Record<string, unknown> | null = null;
  private cache: CachedMetadata | null = null;
  private loaded = false;

  constructor(private readonly app: ObsidianContextApp, private readonly fileSource: FileSource) {

  }

  getEagerProperties(): Record<string, unknown> {
    this.ensureLoaded();

    const context: Record<string, unknown> = this.metadata ? { ...this.metadata } : { };
    const now = new Date();
    const values = new Map<string, unknown>();

    for (const name of BUILT_IN_PROPERTIES) {
      if (name !== 'content') {
        Object.defineProperty(context, name, {
          enumerable: true,
          configurable: true,
          get: () => {
            if (!values.has(name)) {
              values.set(name, this.getBuiltInProperty(name, now));
            }
            return values.get(name);
          },
        });
      }
    }

    return context;
  }

  getLazyProperties(): Record<string, () => Promise<string> | string> {
    return {
      content: () => {
        this.ensureLoaded();
        return this.file ? this.app.vault.cachedRead(this.file) : '';
      },
    };
  }

  private getBuiltInProperty(name: string, now: Date): unknown {
    switch (name) {
      case 'today':
        return now.toISOString().slice(0, 10);
      case 'now':
        return now.toISOString();
      case 'year':
        return now.getFullYear();
      case 'month':
        return now.getMonth() + 1;
      case 'day':
        return now.getDate();
      case 'vault':
        return this.app.vault.getName();
    }

    if (!this.file) {
      return undefined;
    }

    switch (name) {
      case 'path':
        return this.file.path;
      case 'folder':
        return this.getFolder();
      case 'title':
        return this.file.basename;
      case 'created':
        return this.file.stat.ctime;
      case 'modified':
        return this.file.stat.mtime;
      case 'size':
        return this.file.stat.size;
      case 'extension':
        return this.file.extension;
      case 'name':
        return this.file.name;
      case 'outgoingLinks':
        return this.getOutgoingLinks();
      case 'tags':
        return this.getTags();
      case 'headings':
        return this.getHeadings();
      default:
        return undefined;
    }
  }

  private getOutgoingLinks(): string[] {
    if (!this.file) {
      return [];
    }
    const sourcePath = this.file.path;
    const paths = new Set<string>();
    const links = [
      ...(this.cache?.links ?? []),
      ...(this.cache?.embeds ?? []),
      ...(this.cache?.frontmatterLinks ?? []),
    ];

    for (const link of links) {
      const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, sourcePath);
      if (resolved?.path) paths.add(resolved.path);
    }

    return Array.from(paths);
  }

  private getTags(): string[] {
    if (!this.cache?.tags) return [];
    return this.cache.tags.map(tag => tag.tag.replace(/^#/, ''));
  }

  private getHeadings(): string[] {
    if (!this.cache?.headings) return [];
    return this.cache.headings.map(h => h.heading);
  }

  private getFolder(): string {
    if (!this.file) return '';
    const lastSlash = this.file.path.lastIndexOf('/');
    return lastSlash > 0 ? this.file.path.substring(0, lastSlash + 1) : '';
  }

  private ensureLoaded(): void {
    if (this.loaded) return;

    if (isObsidianContextFile(this.fileSource)) {
      this.file = this.fileSource;
    } else {
      const abstractFile = this.app.vault.getAbstractFileByPath(normalizePath(this.fileSource));
      if (isObsidianContextFile(abstractFile)) {
        this.file = abstractFile;
      }
    }

    if (this.file) {
      this.cache = this.app.metadataCache.getFileCache(this.file) ?? null;
      this.metadata = this.cache?.frontmatter ?? null;
    }

    this.loaded = true;
  }
}

export const obsidianHelpers = {
  link: (path: string, text?: string): string => {
    const displayText = text || path;
    const escapedPath = escapeHtml(path);
    const escapedText = escapeHtml(displayText);
    return `<a href="${escapedPath}" class="internal-link" data-path="${escapedPath}">${escapedText}</a>`;
  },

  pathToTitle: (path: string): string => {
    if (!path) return '';
    const name = path.split('/').pop() || path;
    return stripMarkdownExtension(name);
  },

  wikilink: (path: string, alias?: string): string => {
    return wikilink(path, '', alias);
  },

  wikilinkHeading: (path: string, heading: string, display?: string): string => {
    return wikilink(path, heading ? `#${heading}` : '', display);
  },

  wikilinkBlock: (path: string, blockId: string, display?: string): string => {
    if (!blockId) return wikilink(path, '', display);
    const cleanBlockId = blockId.startsWith('^') ? blockId.substring(1) : blockId;
    return wikilink(path, `#^${cleanBlockId}`, display);
  },
};
