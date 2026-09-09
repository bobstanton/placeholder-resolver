# Placeholder Resolver

Turn user provided templates like `Hello {this.name} from {this.city}!` into `Hello Michael from Scranton!`

## Features

- Simple placeholders: `{this.property}`
- JavaScript expressions: `{this.items.map(i => h.escape(i)).join(', ')}` or `{(this.tags ?? []).includes('happy') ? 'Hello' : ''}`
- 50+ built-in helper functions for strings, arrays, dates, SQL, etc
- Obsidian-specific context provider with file metadata and frontmatter
- Configurable escaping (SQL, HTML, or custom)

## Basic Usage

```typescript
import { PlaceholderResolver, SimpleContextProvider } from 'placeholder-resolver';

const provider = new SimpleContextProvider({
  name: 'Michael',
  city: 'Scranton',
  tags: ['sales', 'paper']
});

const resolver = new PlaceholderResolver(provider);

await resolver.resolve('Hello {this.name} from {this.city}!');
// "Hello Michael from Scranton!"

await resolver.resolve('Tags: {h.join(this.tags)}');
// "Tags: sales, paper"

await resolver.resolve('{(this.tags ?? []).includes("sales") ? "On team" : ""}');
// "On team"
```

## Context Providers

### SimpleContextProvider

Use `SimpleContextProvider` when all template data is already materialized:

```typescript
const resolver = new PlaceholderResolver(
  new SimpleContextProvider({ name: 'Michael', age: 44 })
);
```

`SimpleContextProvider` reads the context object by reference. Pass a copy if you need to protect the original from a template that assigns to it (e.g. `{(this.x = 1)}`).

### CompositeContextProvider

Use `CompositeContextProvider` to layer multiple providers. Later providers override earlier
properties, and lazy properties (see below) are merged the same way:

```typescript
const resolver = new PlaceholderResolver(new CompositeContextProvider([
  new ObsidianContextProvider(app, file),
  new SimpleContextProvider({ title: 'Override title' }),
]));
```

### ObsidianContextProvider

Provides Obsidian note metadata and frontmatter:

```typescript
import { ObsidianContextProvider, obsidianHelpers } from 'placeholder-resolver';

const provider = new ObsidianContextProvider(app, file);
const resolver = new PlaceholderResolver(provider, {
  customHelpers: obsidianHelpers
});
```

**Built-in properties:**

| Property        | Description                           |
|-----------------|---------------------------------------|
| `path`          | Full file path                        |
| `folder`        | Parent folder path with trailing slash|
| `title`         | File basename without extension       |
| `name`          | Full filename with extension          |
| `extension`     | File extension without dot            |
| `created`       | Creation timestamp (ms)               |
| `modified`      | Modification timestamp (ms)           |
| `size`          | File size in bytes                    |
| `today`         | Current date (YYYY-MM-DD)             |
| `now`           | Current ISO timestamp                 |
| `year`          | Current year                          |
| `month`         | Current month (1-12)                  |
| `day`           | Current day of month                  |
| `vault`         | Vault name                            |
| `tags`          | Array of frontmatter tags (without #) |
| `bodyTags`      | Array of tags in the note body (without #) |
| `outgoingLinks` | Array of outgoing link targets        |
| `headings`      | Array of heading texts                |
| `content`       | Full file content (async)             |

Plus all frontmatter properties are available directly.

### Custom ContextProvider

Implement the `ContextProvider` interface:

```typescript
interface ContextProvider {
  getEagerProperties(): Promise<Record<string, unknown>> | Record<string, unknown>;
  getLazyProperties?(): Record<string, () => Promise<unknown> | unknown>;
}
```

`getEagerProperties()` is the main source of truth for most placeholders. 
Use the optional `getLazyProperties()` for values that are expensive to produce and should not be computed unless a template uses them. `ObsidianContextProvider` uses this to expose `{this.content}` to defer reading until it is needed.

A missing property such as `{this.missing}` renders as an empty string. Inside expressions, missing properties resolve to `undefined`, so null checks work as written: use `{this.maybe ?? 'fallback'}`, `{this.obj?.field}`, or `{h.default(this.maybe, 'fallback')}`. 

## Configuration Options

```typescript
const resolver = new PlaceholderResolver(provider, {
  // Custom escape function (default: no escaping)
  escapeValue: (v) => v.replace(/'/g, "''"),

  // Variable prefix (default: "this")
  prefix: 'ctx',  // Use {ctx.property} instead of {this.property}

  // Custom helpers to merge with defaults
  customHelpers: { myHelper: (x) => x.toUpperCase() },

  // Helpers object name (default: "h")
  helpersName: 'helpers',  // Use {helpers.upper(...)} instead of {h.upper(...)}
});
```

## Helper Functions

Access helpers via `h.functionName()` in expressions.

### String Manipulation

| Helper                                       | Description              | Example                              |
|----------------------------------------------|--------------------------|--------------------------------------|
| `h.replace(text, search, replacement)`       | Replace all occurrences  | `h.replace(this.name, ' ', '-')`     |
| `h.regexReplace(text, pattern, repl, flags?)`| Regex replace            | `h.regexReplace(this.text, '\\d+', '#')` |
| `h.match(text, pattern, flags?)`             | Get first regex match    | `h.match(this.text, '\\d+')`         |
| `h.test(text, pattern, flags?)`              | Test if pattern matches  | `h.test(this.email, '@')`            |
| `h.lower(text)`                              | Lowercase                | `h.lower(this.name)`                 |
| `h.upper(text)`                              | Uppercase                | `h.upper(this.code)`                 |
| `h.capitalize(text)`                         | Capitalize first letter  | `h.capitalize(this.word)`            |
| `h.trim(text)`                               | Trim whitespace          | `h.trim(this.input)`                 |
| `h.padStart(text, length, char?)`            | Pad start                | `h.padStart(this.num, 3, '0')`       |
| `h.padEnd(text, length, char?)`              | Pad end                  | `h.padEnd(this.code, 10, '-')`       |
| `h.slugify(text)`                            | URL-safe slug            | `h.slugify(this.title)`              |
| `h.split(text, delimiter)`                   | Split to array           | `h.split(this.csv, ',')`             |

### String Extraction

| Helper                        | Description                    | Example                               |
|-------------------------------|--------------------------------|---------------------------------------|
| `h.before(text, delimiter)`   | Text before first delimiter    | `h.before('a/b/c', '/')` → `'a'`      |
| `h.after(text, delimiter)`    | Text after first delimiter     | `h.after('a/b/c', '/')` → `'b/c'`     |
| `h.beforeLast(text, delimiter)`| Text before last delimiter    | `h.beforeLast('a/b/c', '/')` → `'a/b'`|
| `h.afterLast(text, delimiter)`| Text after last delimiter      | `h.afterLast('a/b/c', '/')` → `'c'`   |
| `h.unquote(text)`             | Remove surrounding quotes      | `h.unquote('"hello"')` → `'hello'`    |
| `h.isBlank(text)`             | Check if empty/whitespace      | `h.isBlank('  ')` → `true`            |
| `h.hasTag(tags, tag)`         | Match tag with or without `#`  | `h.hasTag(this.tags, 'online-ordering')` |
| `h.markdownLink(label, url)`  | Markdown link with encoded URL | `h.markdownLink('Website', this.Website)` |

### Path Helpers

| Helper                | Description                  | Example                                        |
|-----------------------|------------------------------|------------------------------------------------|
| `h.filename(path)`    | Filename with extension      | `h.filename('folder/note.md')` → `'note.md'`   |
| `h.pathBasename(path)`| Filename without extension   | `h.pathBasename('folder/note.md')` → `'note'`  |
| `h.pathExtension(path)`| Extension without dot       | `h.pathExtension('folder/note.md')` → `'md'`   |
| `h.pathParent(path)`  | Parent folder path           | `h.pathParent('a/b/note.md')` → `'a/b'`        |

### Formatting

| Helper                            | Description                 | Example                                     |
|-----------------------------------|-----------------------------|---------------------------------------------|
| `h.formatDate(timestamp, format?)`| Format date                 | `h.formatDate(this.created, 'YYYY-MM-DD')`  |
| `h.round(value, decimals?)`       | Round number (keeps suffix) | `h.round('5.678 km', 1)` → `'5.7 km'`       |
| `h.formatNumber(num, decimals?)`  | Format number with locale   | `h.formatNumber(1234.5, 2)` → `'1,234.50'`  |
| `h.formatBytes(bytes, decimals?)` | Human-readable file size    | `h.formatBytes(1536)` → `'1.5 KB'`          |
| `h.pluralize(count, singular, plural?)`| Pluralize word         | `h.pluralize(5, 'item')` → `'items'`        |

**Date format tokens:** `YYYY`, `YY`, `MM`, `M`, `DD`, `D`, `HH`, `H`, `mm`, `m`, `ss`, `s`

```text
{h.formatDate(this.created, 'YYYYMMDD')}
{h.formatDate(this.modified, 'YYYY-MM-DD HH:mm:ss')}
```

### Safety & Display

| Helper                             | Description            | Example                                     |
|------------------------------------|------------------------|---------------------------------------------|
| `h.escape(text)`                   | HTML escape            | `h.escape('<script>')` → `'&lt;script&gt;'` |
| `h.truncate(text, length?, suffix?)`| Truncate with ellipsis| `h.truncate(this.desc, 50)`                 |
| `h.stripHtml(text)`                | Remove HTML tags       | `h.stripHtml('<b>bold</b>')` → `'bold'`     |
| `h.nl2br(text)`                    | Newlines to `<br>`     | `h.nl2br(this.text)`                        |

### Null Handling

| Helper                          | Description                  | Example                              |
|---------------------------------|------------------------------|--------------------------------------|
| `h.default(value, defaultValue)`| Fallback for null/undefined  | `h.default(this.name, 'Unknown')`    |
| `h.ifEmpty(value, replacement)` | Replace empty strings        | `h.ifEmpty(this.title, 'Untitled')`  |

### Arrays

| Helper                           | Description        | Example                                    |
|----------------------------------|--------------------|--------------------------------------------|
| `h.join(array, delimiter?)`      | Join array         | `h.join(this.tags, ', ')`                  |
| `h.joinPresent(array, delimiter?)`| Join non-empty values | `h.joinPresent([this.Distance, this["Elevation Gain"]], ' - ')` |
| `h.first(array)`                 | First element      | `h.first(this.items)`                      |
| `h.last(array)`                  | Last element       | `h.last(this.items)`                       |
| `h.unique(array)`                | Remove duplicates  | `h.unique(this.tags)`                      |
| `h.sortBy(array, key, direction?)`| Sort by property  | `h.sortBy(this.items, 'name', 'desc')`     |
| `h.groupBy(array, key)`          | Group by property  | `h.groupBy(this.items, 'category')`        |
| `h.sum(array)`                   | Sum numbers        | `h.sum(this.values)`                       |
| `h.avg(array)`                   | Average            | `h.avg(this.scores)`                       |
| `h.min(array)`                   | Minimum            | `h.min(this.values)`                       |
| `h.max(array)`                   | Maximum            | `h.max(this.values)`                       |

### Objects

| Helper                  | Description       | Example                              |
|-------------------------|-------------------|--------------------------------------|
| `h.keys(obj)`           | Object keys       | `h.keys(this.metadata)`              |
| `h.values(obj)`         | Object values     | `h.values(this.metadata)`            |
| `h.entries(obj)`        | Key-value pairs   | `h.entries(this.metadata)`           |
| `h.pick(obj, ...keys)`  | Select properties | `h.pick(this.data, 'name', 'age')`   |
| `h.omit(obj, ...keys)`  | Exclude properties| `h.omit(this.data, 'password')`      |

### JSON

| Helper                 | Description         | Example                       |
|------------------------|---------------------|-------------------------------|
| `h.json(value, pretty?)`| Stringify to JSON  | `h.json(this.data, true)`     |
| `h.parseJson(text)`    | Parse JSON string   | `h.parseJson(this.jsonStr)`   |

### SQL Helpers

| Helper                   | Description             | Example                                  |
|--------------------------|-------------------------|------------------------------------------|
| `h.sqlIn(array, escape?)`| Format for IN clause    | `h.sqlIn(this.tags)` → `'a', 'b', 'c'`   |
| `h.sqlEscape(value)`     | Escape single quotes    | `h.sqlEscape("O'Brien")` → `"O''Brien"`  |
| `h.sqlLiteral(value)`    | Format as SQL literal   | `h.sqlLiteral(null)` → `'NULL'`          |

These helpers are convenience functions for trusted local templates that produce SQL text, such as
VaultQuery blocks. If your integration has a database API with bound parameters, prefer parameters for
new code and use these helpers only where the output format must be a string template.

## Obsidian Helpers

When using `ObsidianContextProvider`, add `obsidianHelpers` for Obsidian-specific functions:

```typescript
const resolver = new PlaceholderResolver(provider, {
  customHelpers: obsidianHelpers,
  helpersName: 'h'
});
```

### HTML Links

| Helper                   | Description           | Example                                            |
|--------------------------|-----------------------|----------------------------------------------------|
| `h.link(path, text?)`    | Internal HTML link    | `h.link(this.path, 'Click here')`                  |
| `h.pathToTitle(path)`    | Path to display title | `h.pathToTitle('folder/My Note.md')` → `'My Note'` |

### Wikilinks

| Helper                                   | Description      | Example                                                  |
|------------------------------------------|------------------|----------------------------------------------------------|
| `h.wikilink(path, alias?)`               | Basic wikilink   | `h.wikilink(this.path)` → `[[folder/note]]`              |
| `h.wikilinkHeading(path, heading, display?)`| Link to heading| `h.wikilinkHeading(this.path, 'Intro')` → `[[note#Intro]]`|
| `h.wikilinkBlock(path, blockId, display?)`| Link to block   | `h.wikilinkBlock(this.path, 'abc', 'See')` → `[[note#^abc\|See]]` |

`h.link()` emits Obsidian-compatible internal-link HTML for consumers that insert HTML directly.
`h.wikilink*()` emits Markdown wikilinks for consumers that pass output through Obsidian's Markdown
renderer.

## SQL Query Example

```typescript
import { PlaceholderResolver, ObsidianContextProvider, obsidianHelpers, formatSqlSequence } from 'placeholder-resolver';

const provider = new ObsidianContextProvider(app, file);
const resolver = new PlaceholderResolver(provider, {
  escapeValue: (v) => v.replace(/'/g, "''"),  // SQL single-quote escaping
  formatArray: formatSqlSequence,             // render arrays as SQL value lists ('a', 'b', 'c')
  customHelpers: obsidianHelpers,
  prefix: 'this',
  helpersName: 'h'
});

const query = `
  SELECT * FROM notes
  WHERE folder = '{this.folder}'
  AND tags IN ({h.sqlIn(this.tags)})
`;

const sql = await resolver.resolve(query);
```

## API Reference

### PlaceholderResolver

```typescript
class PlaceholderResolver {
  constructor(contextProvider: ContextProvider, options?: ResolverOptions);

  // Resolve placeholders, returns result string
  resolve(input: string): Promise<string>;

  // Resolve with unresolved-placeholder status
  resolveWithDetails(input: string): Promise<ResolveResult>;

  // Check if string contains placeholders
  hasPlaceholders(input: string): boolean;
}
```

### ResolverOptions

```typescript
interface ResolverOptions {
  escapeValue?: (value: string) => string;
  // Default: comma-joined values. For SQL (`'a', 'b'`) pass the exported `formatSqlSequence`.
  formatArray?: (values: readonly unknown[], escapeValue: (value: string) => string) => string;
  prefix?: string;              // Default: "this"
  customHelpers?: Record<string, unknown>;
  helpersName?: string;         // Default: "h"
}
```

### ResolveResult

```typescript
interface ResolveResult {
  result: string;
  warnings: string[];
  hasUnresolved: boolean;
  diagnostics: ResolveDiagnostic[];
}

interface ResolveDiagnostic {
  kind: 'evaluation-error' | 'unresolved-placeholder';
  placeholder: string;
  expression?: string;
  message?: string;
}
```
