export interface ContextProvider {
    getEagerProperties(): Promise<Record<string, unknown>> | Record<string, unknown>;
    getLazyProperties?(): Record<string, () => Promise<unknown> | unknown>;
}
export interface ResolverOptions {
    escapeValue?: (value: string) => string;
    formatArray?: (values: readonly unknown[], escapeValue: (value: string) => string) => string;
    prefix?: string;
    customHelpers?: Record<string, unknown>;
    helpersName?: string;
}
export interface ResolveResult {
    result: string;
    warnings: string[];
    hasUnresolved: boolean;
    diagnostics: ResolveDiagnostic[];
}
export interface ResolveDiagnostic {
    kind: 'evaluation-error' | 'unresolved-placeholder';
    placeholder: string;
    expression?: string;
    message?: string;
}
export declare class PlaceholderError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=types.d.ts.map