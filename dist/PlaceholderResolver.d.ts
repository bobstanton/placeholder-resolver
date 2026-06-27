import { ContextProvider, ResolverOptions, ResolveResult } from './types';
export declare class PlaceholderResolver {
    private readonly contextProvider;
    private readonly prefix;
    private readonly escapeValue;
    private readonly formatArray;
    private readonly helpersName;
    private readonly hasPlaceholderRegex;
    private readonly usesThis;
    private readonly paramNames;
    private readonly helperArgs;
    private readonly compileKeyPrefix;
    constructor(contextProvider: ContextProvider, options?: ResolverOptions);
    resolve(input: string): Promise<string>;
    resolveWithDetails(input: string): Promise<ResolveResult>;
    hasPlaceholders(input: string): boolean;
    private findExpressions;
    private evaluateMatches;
    private loadContext;
    private evaluate;
    private compile;
    private formatValue;
}
//# sourceMappingURL=PlaceholderResolver.d.ts.map