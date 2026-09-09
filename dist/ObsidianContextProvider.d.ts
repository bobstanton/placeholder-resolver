import { type CachedMetadata } from 'obsidian';
import type { ContextProvider } from './types';
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
export declare class ObsidianContextProvider implements ContextProvider {
    private readonly app;
    private readonly fileSource;
    private file;
    private metadata;
    private cache;
    private loaded;
    constructor(app: ObsidianContextApp, fileSource: FileSource);
    getEagerProperties(): Record<string, unknown>;
    getLazyProperties(): Record<string, () => Promise<string> | string>;
    private getBuiltInProperty;
    private getOutgoingLinks;
    private getFrontmatterTags;
    private getBodyTags;
    private getHeadings;
    private getFolder;
    private ensureLoaded;
}
export declare const obsidianHelpers: {
    link: (path: string, text?: string) => string;
    pathToTitle: (path: string) => string;
    wikilink: (path: string, alias?: string) => string;
    wikilinkHeading: (path: string, heading: string, display?: string) => string;
    wikilinkBlock: (path: string, blockId: string, display?: string) => string;
};
//# sourceMappingURL=ObsidianContextProvider.d.ts.map