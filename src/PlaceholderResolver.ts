import { ContextProvider, ResolverOptions, ResolveDiagnostic, ResolveResult } from './types';
import { mergeHelpers } from './helpers';

interface ExpressionMatch {
  start: number;
  end: number;
  expression: string;
  property?: string;
}

const EXPRESSION_GLOBALS = {
  Date,
  Math,
  Array,
  Object,
  String,
  Number,
  Boolean,
  JSON,
} as const;
const EXPRESSION_GLOBAL_NAMES = Object.keys(EXPRESSION_GLOBALS);
const EXPRESSION_GLOBAL_VALUES = Object.values(EXPRESSION_GLOBALS);

const WORD_REGEX_CACHE = new Map<string, RegExp>();

function referencesWord(text: string, word: string): boolean {
  let regex = WORD_REGEX_CACHE.get(word);
  if (!regex) {
    regex = new RegExp(`\\b${escapeRegex(word)}\\b`);
    WORD_REGEX_CACHE.set(word, regex);
  }
  return regex.test(text);
}

type CompiledExpression = (this: unknown, ...args: unknown[]) => unknown;

const COMPILED_EXPRESSION_CACHE = new Map<string, CompiledExpression>();
const COMPILED_EXPRESSION_CACHE_LIMIT = 1000;

const HAS_PLACEHOLDER_REGEX_CACHE = new Map<string, RegExp>();

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHasPlaceholderRegex(prefix: string, helpersName: string): RegExp {
  const key = `${prefix} ${helpersName}`;
  let regex = HAS_PLACEHOLDER_REGEX_CACHE.get(key);
  if (!regex) {
    const escapedPrefix = escapeRegex(prefix);
    const escapedHelpersName = escapeRegex(helpersName);
    regex = new RegExp(`\\{${escapedPrefix}[.[]|\\{${escapedHelpersName}\\.|\\{\\(`);
    HAS_PLACEHOLDER_REGEX_CACHE.set(key, regex);
  }
  return regex;
}

function defaultFormatArray(values: readonly unknown[], escapeValue: (value: string) => string): string {
  return values.map(value => (value == null ? '' : escapeValue(String(value)))).join(', ');
}

export class PlaceholderResolver {
  private readonly prefix: string;
  private readonly escapeValue: (value: string) => string;
  private readonly formatArray: (values: readonly unknown[], escapeValue: (value: string) => string) => string;
  private readonly helpersName: string;

  private readonly hasPlaceholderRegex: RegExp;

  private readonly usesThis: boolean;
  private readonly paramNames: string[];
  private readonly helperArgs: unknown[];
  private readonly compileKeyPrefix: string;

  constructor(private readonly contextProvider: ContextProvider, options: ResolverOptions = {}) {
    this.prefix = options.prefix ?? 'this';
    this.escapeValue = options.escapeValue ?? ((v) => v);
    this.formatArray = options.formatArray ?? defaultFormatArray;
    this.helpersName = options.helpersName ?? 'h';

    const helpers = mergeHelpers(options.customHelpers);

    this.usesThis = this.prefix === 'this';
    this.paramNames = this.usesThis
      ? [this.helpersName, ...EXPRESSION_GLOBAL_NAMES]
      : [this.prefix, this.helpersName, ...EXPRESSION_GLOBAL_NAMES];
    this.helperArgs = [helpers, ...EXPRESSION_GLOBAL_VALUES];
    this.compileKeyPrefix = `${this.paramNames.join(',')} `;

    this.hasPlaceholderRegex = getHasPlaceholderRegex(this.prefix, this.helpersName);
  }

  async resolve(input: string): Promise<string> {
    const result = await this.resolveWithDetails(input);
    return result.result;
  }

  async resolveWithDetails(input: string): Promise<ResolveResult> {
    const warnings: string[] = [];
    const diagnostics: ResolveDiagnostic[] = [];

    if (!this.hasPlaceholders(input)) {
      return { result: input, warnings, hasUnresolved: false, diagnostics };
    }

    const matches = this.findExpressions(input, diagnostics);
    const result = matches.length === 0
      ? input
      : await this.evaluateMatches(input, matches, warnings, diagnostics);

    return { result, warnings, hasUnresolved: this.hasPlaceholders(result), diagnostics };
  }

  hasPlaceholders(input: string): boolean {
    return this.hasPlaceholderRegex.test(input);
  }

  private findExpressions(input: string, diagnostics: ResolveDiagnostic[]): ExpressionMatch[] {
    const prefixPattern = `{${this.prefix}.`;
    const prefixBracketPattern = `{${this.prefix}[`;
    const helpersPattern = `{${this.helpersName}.`;
    const parenthesizedExpressionPattern = `{(`;
    const matches: ExpressionMatch[] = [];

    let i = 0;
    while (i < input.length) {
      if (input[i] !== '{') {
        i++;
        continue;
      }

      let matchedPattern: string | null = null;
      if (input.startsWith(prefixPattern, i)) {
        matchedPattern = prefixPattern;
      } else if (input.startsWith(prefixBracketPattern, i)) {
        matchedPattern = prefixBracketPattern;
      } else if (input.startsWith(helpersPattern, i)) {
        matchedPattern = helpersPattern;
      } else if (input.startsWith(parenthesizedExpressionPattern, i)) {
        matchedPattern = parenthesizedExpressionPattern;
      }

      if (!matchedPattern) {
        i++;
        continue;
      }

      const start = i;
      i += matchedPattern.length;

      let braceDepth = 1;
      let inString = false;
      let stringChar = '';
      let inTemplate = false;
      let escaped = false;

      while (i < input.length && braceDepth > 0) {
        const char = input[i];

        if (escaped) {
          escaped = false;
          i++;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          i++;
          continue;
        }

        if (char === '`') {
          if (!inString) {
            inTemplate = !inTemplate;
          }
        }

        if ((char === '"' || char === "'") && !inTemplate) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }

        if (!inString && !inTemplate) {
          if (char === '{') braceDepth++;
          if (char === '}') braceDepth--;
        }

        i++;
      }

      if (braceDepth !== 0) {
        diagnostics.push({
          kind: 'unresolved-placeholder',
          placeholder: input.slice(start),
        });
        continue;
      }

      const end = i;
      const expression = input.substring(start + 1, end - 1);

      if (matchedPattern === prefixPattern) {
        const property = input.substring(start + prefixPattern.length, end - 1);
        if (/^\w+$/.test(property)) {
          matches.push({ start, end, expression, property });
          continue;
        }
      }

      matches.push({ start, end, expression });
    }

    return matches;
  }

  private async evaluateMatches(input: string, matches: ExpressionMatch[], warnings: string[], diagnostics: ResolveDiagnostic[]): Promise<string> {
    const context = await this.loadContext(matches);

    const chunks: string[] = [];
    let cursor = 0;

    for (const match of matches) {
      chunks.push(input.slice(cursor, match.start));
      try {
        chunks.push(this.evaluate(context, match));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(message);
        diagnostics.push({
          kind: 'evaluation-error',
          placeholder: input.slice(match.start, match.end),
          expression: match.expression,
          message,
        });
        chunks.push(input.slice(match.start, match.end));
      }
      cursor = match.end;
    }

    chunks.push(input.slice(cursor));
    return chunks.join('');
  }

  private async loadContext(matches: ExpressionMatch[]): Promise<Record<string, unknown>> {
    const context = await this.contextProvider.getEagerProperties();

    const lazy = this.contextProvider.getLazyProperties?.();
    if (lazy) {
      for (const name of Object.keys(lazy)) {
        if (matches.some(match => referencesWord(match.expression, name))) {
          context[name] = await lazy[name]();
        }
      }
    }

    return context;
  }

  private evaluate(context: Record<string, unknown>, match: ExpressionMatch): string {
    if (match.property !== undefined) {
      return this.formatValue(context[match.property]);
    }

    const func = this.compile(match.expression);
    const result = this.usesThis
      ? func.call(context, ...this.helperArgs)
      : func.call(undefined, context, ...this.helperArgs);
    return this.formatValue(result);
  }

  private compile(expression: string): CompiledExpression {
    const key = this.compileKeyPrefix + expression;
    let func = COMPILED_EXPRESSION_CACHE.get(key);
    if (!func) {
      func = new Function(...this.paramNames, `"use strict"; return ${expression};`) as CompiledExpression;
      if (COMPILED_EXPRESSION_CACHE.size >= COMPILED_EXPRESSION_CACHE_LIMIT) {
        COMPILED_EXPRESSION_CACHE.clear();
      }
      COMPILED_EXPRESSION_CACHE.set(key, func);
    }
    return func;
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return this.formatArray(value, this.escapeValue);
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return this.escapeValue(String(value));
  }
}
