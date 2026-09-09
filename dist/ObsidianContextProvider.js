import { normalizePath, parseFrontMatterTags } from 'obsidian';
import { escapeHtml } from './helpers';
const BUILT_IN_PROPERTIES = new Set([
    'path', 'folder', 'title', 'content', 'created', 'modified', 'size', 'extension', 'name',
    'today', 'now', 'year', 'month', 'day',
    'vault',
    'outgoingLinks', 'tags', 'bodyTags', 'headings'
]);
function stripMarkdownExtension(path) {
    return path.replace(/\.md$/, '');
}
function wikilink(path, anchor = '', display) {
    const target = `${stripMarkdownExtension(path)}${anchor}`;
    return display ? `[[${target}|${display}]]` : `[[${target}]]`;
}
function isObsidianContextFile(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const candidate = value;
    return typeof candidate.path === 'string'
        && typeof candidate.basename === 'string'
        && typeof candidate.name === 'string'
        && typeof candidate.extension === 'string'
        && candidate.stat !== undefined
        && typeof candidate.stat.ctime === 'number'
        && typeof candidate.stat.mtime === 'number'
        && typeof candidate.stat.size === 'number';
}
export class ObsidianContextProvider {
    constructor(app, fileSource) {
        this.app = app;
        this.fileSource = fileSource;
        this.file = null;
        this.metadata = null;
        this.cache = null;
        this.loaded = false;
    }
    getEagerProperties() {
        this.ensureLoaded();
        const context = this.metadata ? { ...this.metadata } : {};
        const now = new Date();
        const values = new Map();
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
    getLazyProperties() {
        return {
            content: () => {
                this.ensureLoaded();
                return this.file ? this.app.vault.cachedRead(this.file) : '';
            },
        };
    }
    getBuiltInProperty(name, now) {
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
            case 'tags':
                return this.getFrontmatterTags();
            case 'bodyTags':
                return this.getBodyTags();
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
            case 'headings':
                return this.getHeadings();
            default:
                return undefined;
        }
    }
    getOutgoingLinks() {
        if (!this.file) {
            return [];
        }
        const sourcePath = this.file.path;
        const paths = new Set();
        const links = [
            ...(this.cache?.links ?? []),
            ...(this.cache?.embeds ?? []),
            ...(this.cache?.frontmatterLinks ?? []),
        ];
        for (const link of links) {
            const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, sourcePath);
            if (resolved?.path)
                paths.add(resolved.path);
        }
        return Array.from(paths);
    }
    getFrontmatterTags() {
        return (parseFrontMatterTags(this.metadata) ?? []).map(tag => tag.replace(/^#/, ''));
    }
    getBodyTags() {
        if (!this.cache?.tags)
            return [];
        return this.cache.tags.map(tag => tag.tag.replace(/^#/, ''));
    }
    getHeadings() {
        if (!this.cache?.headings)
            return [];
        return this.cache.headings.map(h => h.heading);
    }
    getFolder() {
        if (!this.file)
            return '';
        const lastSlash = this.file.path.lastIndexOf('/');
        return lastSlash > 0 ? this.file.path.substring(0, lastSlash + 1) : '';
    }
    ensureLoaded() {
        if (this.loaded)
            return;
        if (isObsidianContextFile(this.fileSource)) {
            this.file = this.fileSource;
        }
        else {
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
    link: (path, text) => {
        const displayText = text || path;
        const escapedPath = escapeHtml(path);
        const escapedText = escapeHtml(displayText);
        return `<a href="${escapedPath}" class="internal-link" data-path="${escapedPath}">${escapedText}</a>`;
    },
    pathToTitle: (path) => {
        if (!path)
            return '';
        const name = path.split('/').pop() || path;
        return stripMarkdownExtension(name);
    },
    wikilink: (path, alias) => {
        return wikilink(path, '', alias);
    },
    wikilinkHeading: (path, heading, display) => {
        return wikilink(path, heading ? `#${heading}` : '', display);
    },
    wikilinkBlock: (path, blockId, display) => {
        if (!blockId)
            return wikilink(path, '', display);
        const cleanBlockId = blockId.startsWith('^') ? blockId.substring(1) : blockId;
        return wikilink(path, `#^${cleanBlockId}`, display);
    },
};
//# sourceMappingURL=ObsidianContextProvider.js.map