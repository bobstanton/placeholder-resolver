import { ContextProvider } from './types';
export declare class CompositeContextProvider implements ContextProvider {
    private readonly providers;
    constructor(providers: readonly ContextProvider[]);
    getEagerProperties(): Promise<Record<string, unknown>>;
    getLazyProperties(): Record<string, () => Promise<unknown> | unknown>;
}
//# sourceMappingURL=CompositeContextProvider.d.ts.map