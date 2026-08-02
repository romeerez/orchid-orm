import fs from 'node:fs/promises';
import { AppCodeGenTables } from './tables.app-code-generator';
import {
  DbExtension,
  getImportPath,
  quoteObjectKey,
  singleQuote,
} from 'pqb/internal';
import { RakeDbAst } from 'rake-db';

type Change = [from: number, to: number] | string;

interface Range {
  pos: number;
  end: number;
}

interface TablesObjectRange extends Range {
  propertiesEnd: number;
  hasProperties: boolean;
  hasTrailingComma: boolean;
}

export const appCodeGenUpdateDbFile = async (
  dbPath: string,
  tables: AppCodeGenTables,
  extensions: DbExtension[],
  domains: RakeDbAst.Domain[],
  currentSchema: string,
): Promise<string | undefined> => {
  const content = await fs.readFile(dbPath, 'utf-8');
  const importInfo = getOrchidOrmImport(content);
  if (!importInfo) {
    throw new Error(`Main file does not contain import of orchid-orm`);
  }
  const { config, tablesList } = getOrchidOrmArgs(
    content,
    importInfo.importName,
  );

  const changes: Change[] = [];

  let replacedConfig: string | undefined;
  if (extensions.length || domains.length) {
    let code = content.slice(config.pos, config.end).trim();

    if (code[0] !== '{') code = `{...${code}}`;

    code = '{\n  ' + code.slice(1, -1).trim();

    if (!code.endsWith(',')) code += ',';

    if (extensions.length) {
      code += `\n  extensions: [${extensions
        .map((ext) =>
          ext.version
            ? `{ ${quoteObjectKey(ext.name, false)}: '${ext.version}' }`
            : singleQuote(ext.name),
        )
        .join(', ')}],`;
    }

    if (domains.length) {
      code += `\n  domains: {\n    ${domains
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map(
          (ast) =>
            `${quoteObjectKey(
              ast.schema ? `${ast.schema}.${ast.name}` : ast.name,
              false,
            )}: (t) => ${ast.baseType.toCode(
              { t: 't', table: ast.name, currentSchema },
              ast.baseType.data.name ?? '',
            )},`,
        )
        .join('\n    ')}\n  },`;
    }

    replacedConfig = code + '\n}';
  }

  const tablesChanges = makeTablesListChanges(
    content,
    importInfo.lastImportEnd,
    tablesList,
    tables,
    dbPath,
  );

  if (tablesChanges) {
    addChange(
      content,
      changes,
      tablesChanges.imports.pos,
      tablesChanges.imports.text,
    );
  }

  if (replacedConfig) {
    replaceContent(content, changes, config.pos, config.end, replacedConfig);
  }

  if (tablesChanges) {
    addChange(
      content,
      changes,
      tablesChanges.tablesList.pos,
      tablesChanges.tablesList.text,
    );
  }

  return applyChanges(content, changes);
};

const makeTablesListChanges = (
  content: string,
  importPos: number,
  object: TablesObjectRange,
  tables: AppCodeGenTables,
  dbPath: string,
) => {
  const spaces = getTablesListSpaces(content, object);

  let imports = '';
  let tablesList = '';
  const prependComma = object.hasProperties && !object.hasTrailingComma;
  const tablesListNewLine = content
    .slice(object.propertiesEnd, object.end)
    .includes('\n');

  const tablesArr = Object.values(tables);
  for (let i = 0; i < tablesArr.length; i++) {
    const { path, className, key } = tablesArr[i];
    const importPath = getImportPath(dbPath, path);

    imports += `\nimport { ${className} } from '${importPath}';`;

    tablesList += `${
      i === 0 && prependComma ? ',' : ''
    }\n${spaces}  ${key}: ${className},`;

    if (i === tablesArr.length - 1 && !tablesListNewLine) {
      tablesList += `\n${spaces}`;
    }
  }

  if (!imports.length) return;

  return {
    imports: { pos: importPos, text: imports },
    tablesList: { pos: object.propertiesEnd, text: tablesList },
  };
};

const getTablesListSpaces = (
  content: string,
  object: TablesObjectRange,
): string => {
  const lines = content.slice(0, object.end).split('\n');
  const last = lines[lines.length - 1];
  return last.match(/^\s+/)?.[0] || '';
};

const getOrchidOrmArgs = (
  content: string,
  importName: string,
): { config: Range; tablesList: TablesObjectRange } => {
  const call = findCall(content, importName);
  if (!call) throw new Error('List of tables is not found in main file');

  const closeParen = findClosingBracket(content, call.openParen);
  if (closeParen === -1)
    throw new Error('List of tables is not found in main file');

  const firstComma = findTopLevelComma(content, call.openParen + 1, closeParen);
  if (firstComma === -1) {
    throw new Error('Invalid number of arguments when initializing orchid orm');
  }

  const secondComma = findTopLevelComma(content, firstComma + 1, closeParen);
  if (secondComma !== -1) {
    throw new Error('Invalid number of arguments when initializing orchid orm');
  }

  const config = makeTrimmedRange(content, call.openParen + 1, firstComma);
  const tablesList = getObjectRange(content, firstComma + 1, closeParen);
  if (!tablesList) {
    throw new Error('Second argument of orchidORM must be an object literal');
  }

  return { config, tablesList };
};

const getOrchidOrmImport = (
  content: string,
): { importName: string; lastImportEnd: number } | undefined => {
  let lastImportEnd = 0;
  let importName: string | undefined;
  const importRegex =
    /(^|\n)\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g;

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content))) {
    lastImportEnd = importRegex.lastIndex;
    if (match[3] !== 'orchid-orm') continue;

    const named = match[2].match(/\{([\s\S]*)\}/);
    if (!named) continue;

    for (const part of named[1].split(',')) {
      const item = part.trim();
      const alias = item.match(/^orchidORM\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) {
        importName = alias[1];
        continue;
      }

      if (item === 'orchidORM') {
        importName = 'orchidORM';
      }
    }
  }

  if (!importName) return;

  return { importName, lastImportEnd };
};

const findCall = (
  content: string,
  importName: string,
): { openParen: number } | undefined => {
  let index = 0;
  while (index < content.length) {
    const found = content.indexOf(importName, index);
    if (found === -1) return;

    const before = content[found - 1];
    const after = content[found + importName.length];
    if (
      (!before || !isIdentifierChar(before)) &&
      (!after || !isIdentifierChar(after))
    ) {
      const openParen = skipWhitespace(content, found + importName.length);
      if (content[openParen] === '(') return { openParen };
    }

    index = found + importName.length;
  }

  throw new Error('List of tables is not found in main file');
};

const getObjectRange = (
  content: string,
  from: number,
  to: number,
): TablesObjectRange | undefined => {
  const pos = skipWhitespace(content, from);
  if (content[pos] !== '{') return;

  const end = findClosingBracket(content, pos);
  if (end === -1 || skipWhitespace(content, end + 1) < to) return;

  const lastBodyChar = findLastNonWhitespace(content, pos + 1, end);
  const hasProperties = lastBodyChar !== -1;
  const hasTrailingComma = hasProperties && content[lastBodyChar] === ',';
  const propertiesEnd = hasProperties ? lastBodyChar + 1 : pos + 1;

  return {
    pos,
    end: end + 1,
    propertiesEnd,
    hasProperties,
    hasTrailingComma,
  };
};

const makeTrimmedRange = (content: string, from: number, to: number): Range => {
  return {
    pos: skipWhitespace(content, from),
    end: trimWhitespaceEnd(content, from, to),
  };
};

const findTopLevelComma = (
  content: string,
  from: number,
  to: number,
): number => {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const skipped = skipCodeFragment(content, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }

    const char = content[i];
    if (char === '(' || char === '{' || char === '[') {
      depth++;
    } else if (char === ')' || char === '}' || char === ']') {
      depth--;
    } else if (char === ',' && depth === 0) {
      return i;
    }
  }

  return -1;
};

const findClosingBracket = (content: string, open: number): number => {
  const close = getClosingBracket(content[open]);
  if (!close) return -1;

  let depth = 1;
  for (let i = open + 1; i < content.length; i++) {
    const skipped = skipCodeFragment(content, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }

    const char = content[i];
    if (char === content[open]) {
      depth++;
    } else if (char === close) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
};

const getClosingBracket = (char: string): string | undefined => {
  if (char === '(') return ')';
  if (char === '{') return '}';
  if (char === '[') return ']';
  return;
};

const skipCodeFragment = (content: string, i: number): number => {
  const char = content[i];
  if (char === "'" || char === '"' || char === '`') {
    return skipQuoted(content, i, char);
  }

  if (char === '/' && content[i + 1] === '/') {
    const nextLine = content.indexOf('\n', i + 2);
    return nextLine === -1 ? content.length : nextLine + 1;
  }

  if (char === '/' && content[i + 1] === '*') {
    const end = content.indexOf('*/', i + 2);
    return end === -1 ? content.length : end + 2;
  }

  return i;
};

const skipQuoted = (content: string, i: number, quote: string): number => {
  for (let j = i + 1; j < content.length; j++) {
    if (content[j] === '\\') {
      j++;
      continue;
    }

    if (content[j] === quote) return j + 1;
  }

  return content.length;
};

const skipWhitespace = (content: string, from: number): number => {
  let i = from;
  while (/\s/.test(content[i])) i++;
  return i;
};

const trimWhitespaceEnd = (
  content: string,
  from: number,
  to: number,
): number => {
  let i = to;
  while (i > from && /\s/.test(content[i - 1])) i--;
  return i;
};

const findLastNonWhitespace = (
  content: string,
  from: number,
  to: number,
): number => {
  for (let i = to - 1; i >= from; i--) {
    if (!/\s/.test(content[i])) return i;
  }

  return -1;
};

const isIdentifierChar = (char: string): boolean => {
  return /[A-Za-z0-9_$]/.test(char);
};

const addChange = (
  content: string,
  changes: Change[],
  at: number,
  text: string,
  end = at,
) => {
  if (changes.length === 0) {
    changes.push([0, at], text, [end, content.length]);
  } else {
    const last = changes[changes.length - 1] as [number, number];
    last[1] = at;
    changes.push(text, [end, content.length]);
  }
};

const replaceContent = (
  content: string,
  changes: Change[],
  from: number,
  to: number,
  text: string,
) => {
  addChange(content, changes, from, text, to);
};

const applyChanges = (content: string, changes: Change[]) => {
  return changes.length
    ? changes
        .map((item) =>
          typeof item === 'string' ? item : content.slice(item[0], item[1]),
        )
        .join('')
    : content;
};
