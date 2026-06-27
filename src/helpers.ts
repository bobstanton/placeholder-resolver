export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textOrEmpty(value: unknown): string {
  return value == null ? '' : String(value);
}

function normalizeTag(value: unknown): string {
  return textOrEmpty(value).trim().replace(/^#/, '').toLowerCase();
}

function encodeMarkdownLinkUrl(url: string): string {
  return encodeURI(url).replace(/\)/g, '%29').replace(/\(/g, '%28');
}

function lastPathSegment(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.substring(lastSlash + 1);
}

function pathParts(path: unknown): { filename: string; basename: string; extension: string; parent: string } {
  const str = textOrEmpty(path);
  const filename = lastPathSegment(str);
  const lastSlash = str.lastIndexOf('/');
  const lastDot = filename.lastIndexOf('.');
  return {
    filename,
    basename: lastDot === -1 ? filename : filename.substring(0, lastDot),
    extension: lastDot === -1 ? '' : filename.substring(lastDot + 1),
    parent: lastSlash === -1 ? '' : str.substring(0, lastSlash),
  };
}

function sqlSequenceValue(value: unknown, escape: (text: string) => string): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return "'" + escape(String(value)) + "'";
}

const DATE_TOKEN_REGEX = /YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g;

export function formatSqlSequence(array: readonly unknown[], escape: (text: string) => string): string {
  if (array.length === 0) return 'NULL';
  return array.map(value => sqlSequenceValue(value, escape)).join(', ');
}

function toFiniteNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function requireRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export interface Helpers {
  replace: (text: string, search: string, replacement: string) => string;
  regexReplace: (text: string, pattern: string, replacement: string, flags?: string) => string;
  match: (text: string, pattern: string, flags?: string) => string | null;
  test: (text: string, pattern: string, flags?: string) => boolean;
  lower: (text: string) => string;
  upper: (text: string) => string;
  capitalize: (text: string) => string;
  trim: (text: string) => string;
  padStart: (text: string, length: number, char?: string) => string;
  padEnd: (text: string, length: number, char?: string) => string;
  slugify: (text: string) => string;
  split: (text: string, delimiter: string) => string[];
  before: (text: string, delimiter: string) => string;
  after: (text: string, delimiter: string) => string;
  beforeLast: (text: string, delimiter: string) => string;
  afterLast: (text: string, delimiter: string) => string;

  formatDate: (timestamp: number | string | Date, format?: string) => string;
  round: (value: unknown, decimals?: number) => string;
  formatNumber: (num: number, decimals?: number) => string;
  formatBytes: (bytes: number, decimals?: number) => string;
  pluralize: (count: number, singular: string, plural?: string) => string;

  escape: (text: string) => string;
  truncate: (text: string, length?: number, suffix?: string) => string;
  stripHtml: (text: string) => string;
  nl2br: (text: string) => string;

  default: <T>(value: T | null | undefined, defaultValue: T) => T;
  ifEmpty: (value: string | null | undefined, replacement: string) => string;

  join: (array: unknown[], delimiter?: string) => string;
  joinPresent: (array: unknown[], delimiter?: string) => string;
  first: <T>(array: T[]) => T | undefined;
  last: <T>(array: T[]) => T | undefined;
  unique: <T>(array: T[]) => T[];
  sortBy: <T>(array: T[], key: keyof T | string, direction?: 'asc' | 'desc') => T[];
  groupBy: <T>(array: T[], key: keyof T | string) => Record<string, T[]>;
  sum: (array: number[]) => number;
  avg: (array: number[]) => number;
  min: (array: number[]) => number;
  max: (array: number[]) => number;

  keys: (obj: Record<string, unknown>) => string[];
  values: (obj: Record<string, unknown>) => unknown[];
  entries: (obj: Record<string, unknown>) => [string, unknown][];
  pick: <T extends Record<string, unknown>>(obj: T, ...keys: (keyof T)[]) => Partial<T>;
  omit: <T extends Record<string, unknown>>(obj: T, ...keys: (keyof T)[]) => Partial<T>;

  json: (value: unknown, pretty?: boolean) => string;
  parseJson: (text: string) => unknown;

  sqlIn: (array: unknown[], escape?: boolean) => string;
  sqlEscape: (value: string) => string;
  sqlLiteral: (value: unknown) => string;

  unquote: (value: string) => string;
  isBlank: (value: string | null | undefined) => boolean;
  hasTag: (tags: unknown, tag: string) => boolean;
  markdownLink: (label: unknown, url: unknown) => string;

  filename: (path: string) => string;
  pathBasename: (path: string) => string;
  pathExtension: (path: string) => string;
  pathParent: (path: string) => string;
}

export function createHelpers(): Helpers {
  return {
    replace: (text, search, replacement) => {
      return textOrEmpty(text).split(search).join(replacement);
    },

    regexReplace: (text, pattern, replacement, flags = 'g') => {
      const str = textOrEmpty(text);
      return str.replace(new RegExp(pattern, flags), replacement);
    },

    match: (text, pattern, flags) => {
      return textOrEmpty(text).match(new RegExp(pattern, flags))?.[0] ?? null;
    },

    test: (text, pattern, flags) => {
      return new RegExp(pattern, flags).test(textOrEmpty(text));
    },

    lower: (text) => textOrEmpty(text).toLowerCase(),
    upper: (text) => textOrEmpty(text).toUpperCase(),

    capitalize: (text) => {
      const str = textOrEmpty(text);
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    trim: (text) => textOrEmpty(text).trim(),

    padStart: (text, length, char = ' ') => {
      if (text == null) return char.repeat(length);
      return String(text).padStart(length, char);
    },

    padEnd: (text, length, char = ' ') => {
      if (text == null) return char.repeat(length);
      return String(text).padEnd(length, char);
    },

    slugify: (text) => {
      return textOrEmpty(text)
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    },

    split: (text, delimiter) => {
      return text == null ? [] : String(text).split(delimiter);
    },

    before: (text, delimiter) => {
      const str = textOrEmpty(text);
      const idx = str.indexOf(delimiter);
      return idx === -1 ? str : str.substring(0, idx).trim();
    },

    after: (text, delimiter) => {
      const str = textOrEmpty(text);
      const idx = str.indexOf(delimiter);
      return idx === -1 ? '' : str.substring(idx + delimiter.length).trim();
    },

    beforeLast: (text, delimiter) => {
      const str = textOrEmpty(text);
      const idx = str.lastIndexOf(delimiter);
      return idx === -1 ? str : str.substring(0, idx).trim();
    },

    afterLast: (text, delimiter) => {
      const str = textOrEmpty(text);
      const idx = str.lastIndexOf(delimiter);
      return idx === -1 ? '' : str.substring(idx + delimiter.length).trim();
    },

    formatDate: (timestamp, format) => {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return '';

      if (!format) {
        return date.toLocaleString();
      }

      const tokens: Record<string, string> = {
        'YYYY': date.getFullYear().toString(),
        'YY': date.getFullYear().toString().slice(-2),
        'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
        'M': (date.getMonth() + 1).toString(),
        'DD': date.getDate().toString().padStart(2, '0'),
        'D': date.getDate().toString(),
        'HH': date.getHours().toString().padStart(2, '0'),
        'H': date.getHours().toString(),
        'mm': date.getMinutes().toString().padStart(2, '0'),
        'm': date.getMinutes().toString(),
        'ss': date.getSeconds().toString().padStart(2, '0'),
        's': date.getSeconds().toString(),
      };

      return format.replace(DATE_TOKEN_REGEX, token => tokens[token]);
    },

    round: (value, decimals = 2) => {
      const str = String(value).trim();
      const match = str.match(/^(-?\d*\.?\d+)(.*)$/);
      if (!match) return str;
      const num = parseFloat(match[1]);
      if (!Number.isFinite(num)) return str;
      return String(parseFloat(num.toFixed(decimals))) + match[2];
    },

    formatNumber: (num, decimals = 0) => {
      return toFiniteNumber(num).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },

    formatBytes: (bytes, decimals = 2) => {
      const value = toFiniteNumber(bytes);
      if (value === 0) return '0 B';

      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(value) / Math.log(k));

      return parseFloat((value / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },

    pluralize: (count, singular, plural) => {
      if (count == null) return singular;
      const p = plural || singular + 's';
      return count === 1 ? singular : p;
    },

    escape: (text) => {
      return escapeHtml(textOrEmpty(text));
    },

    truncate: (text, length = 200, suffix = '...') => {
      const str = textOrEmpty(text);
      if (str.length <= length) return str;
      return str.substring(0, length - suffix.length) + suffix;
    },

    stripHtml: (text) => {
      return textOrEmpty(text).replace(/<[^>]*>/g, '');
    },

    nl2br: (text) => {
      return textOrEmpty(text).replace(/\n/g, '<br>');
    },

    default: (value, defaultValue) => {
      return value ?? defaultValue;
    },

    ifEmpty: (value, replacement) => {
      if (value == null || value === '') return replacement;
      return value;
    },

    join: (array, delimiter = ', ') => {
      return array.join(delimiter);
    },

    joinPresent: (array, delimiter = ', ') => {
      return array.filter(value => value !== null && value !== undefined && value !== '').join(delimiter);
    },

    first: (array) => {
      return array[0];
    },

    last: (array) => {
      return array[array.length - 1];
    },

    unique: (array) => {
      return [...new Set(array)];
    },

    sortBy: (array, key, direction = 'asc') => {
      const sorted = [...array].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[key as string];
        const bVal = (b as Record<string, unknown>)[key as string];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      });
      return direction === 'desc' ? sorted.reverse() : sorted;
    },

    groupBy: (array, key) => {
      return array.reduce((acc, item) => {
        const groupKey = String((item as Record<string, unknown>)[key as string] ?? 'undefined');
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(item);
        return acc;
      }, {} as Record<string, typeof array[number][]>);
    },

    sum: (array) => {
      return array.reduce((acc, value) => acc + toFiniteNumber(value), 0);
    },

    avg: (array) => {
      if (array.length === 0) return 0;
      return array.reduce((acc, value) => acc + toFiniteNumber(value), 0) / array.length;
    },

    min: (array) => {
      if (array.length === 0) return 0;
      return Math.min(...array.map(value => toFiniteNumber(value)));
    },

    max: (array) => {
      if (array.length === 0) return 0;
      return Math.max(...array.map(value => toFiniteNumber(value)));
    },

    keys: (obj) => {
      return Object.keys(requireRecord(obj));
    },

    values: (obj) => {
      return Object.values(requireRecord(obj));
    },

    entries: (obj) => {
      return Object.entries(requireRecord(obj));
    },

    pick: (obj, ...keys) => {
      const source = requireRecord(obj);
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in source) {
          result[key as string] = source[key as string];
        }
      }
      return result as Partial<typeof obj>;
    },

    omit: (obj, ...keys) => {
      const source = requireRecord(obj);
      const keySet = new Set(keys as string[]);
      const result: Partial<typeof obj> = {};
      for (const [key, value] of Object.entries(source)) {
        if (!keySet.has(key)) {
          (result as Record<string, unknown>)[key] = value;
        }
      }
      return result;
    },

    json: (value, pretty = false) => {
      return JSON.stringify(value, null, pretty ? 2 : undefined);
    },

    parseJson: (text) => {
      return JSON.parse(text);
    },

    sqlIn: (array, escape = true) => {
      return formatSqlSequence(array, escape ? escapeSqlString : text => text);
    },

    sqlEscape: (value) => {
      return escapeSqlString(textOrEmpty(value));
    },

    sqlLiteral: (value) => {
      return sqlSequenceValue(value, escapeSqlString);
    },

    unquote: (value) => {
      const trimmed = textOrEmpty(value).trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    },

    isBlank: (value) => {
      return textOrEmpty(value).trim().length === 0;
    },

    hasTag: (tags, tag) => {
      if (!Array.isArray(tags)) return false;
      const expected = normalizeTag(tag);
      return tags.some(value => normalizeTag(value) === expected);
    },

    markdownLink: (label, url) => {
      if (label == null || url == null || url === '') return '';
      const safeLabel = String(label).replace(/[[\]\n]/g, '');
      const safeUrl = encodeMarkdownLinkUrl(String(url));
      return `[${safeLabel}](${safeUrl})`;
    },

    filename: (path) => {
      return pathParts(path).filename;
    },

    pathBasename: (path) => {
      return pathParts(path).basename;
    },

    pathExtension: (path) => {
      return pathParts(path).extension;
    },

    pathParent: (path) => {
      return pathParts(path).parent;
    },
  };
}

let defaultHelpers: Helpers | null = null;

const mergedHelpersCache = new WeakMap<object, Helpers>();

export function mergeHelpers(customHelpers?: Record<string, unknown>): Helpers {
  if (!defaultHelpers) {
    defaultHelpers = Object.freeze(createHelpers());
  }
  if (!customHelpers) return defaultHelpers;

  const cached = mergedHelpersCache.get(customHelpers);
  if (cached) return cached;

  const merged = Object.freeze({ ...defaultHelpers, ...customHelpers }) as Helpers;
  mergedHelpersCache.set(customHelpers, merged);
  return merged;
}
