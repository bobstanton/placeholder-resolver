import { ContextProvider } from './types';
export declare class SimpleContextProvider implements ContextProvider {
    private readonly context;
    constructor(context: Record<string, unknown>);
    getEagerProperties(): Record<string, unknown>;
}
//# sourceMappingURL=SimpleContextProvider.d.ts.map