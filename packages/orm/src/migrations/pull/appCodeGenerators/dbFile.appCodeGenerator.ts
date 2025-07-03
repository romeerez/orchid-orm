import fs from 'fs/promises';
import {
  CallExpression,
  Expression,
  ImportDeclaration,
  NamedImports,
  NodeArray,
  ObjectLiteralExpression,
  Statement,
  VariableStatement,
} from 'typescript';
import { getImportPath, quoteObjectKey, singleQuote } from 'orchid-core';
import { AppCodeGenTables } from './tables.appCodeGenerator';
import { DbExtension } from 'pqb';
import { RakeDbAst } from 'rake-db';

// importing directly won't work after compiling
import typescript from 'typescript';
const { createSourceFile, ScriptTarget, SyntaxKind } = typescript;

type Change = [from: number, to: number] | string;

export const appCodeGenUpdateDbFile = async (
  dbPath: string,
  tables: AppCodeGenTables,
  extensions: DbExtension[],
  domains: RakeDbAst.Domain[],
  currentSchema: string,
): Promise<string | undefined> => {
  const content = await fs.readFile(dbPath, 'utf-8');
  const statements = getTsStatements(content);
  const importName = getOrchidOrmImportName(statements);
  if (!importName) {
    throw new Error(`Main file does not contain import of orchid-orm`);
  }
  const { config, tablesList } = getOrchidOrmArgs(importName, statements);

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
    statements,
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

const getTsStatements = (content: string): NodeArray<Statement> => {
  return createSourceFile('file.ts', content, ScriptTarget.Latest, true)
    .statements;
};

const getOrchidOrmImportName = (
  statements: NodeArray<Statement>,
): string | undefined => {
  for (const node of statements) {
    if (node.kind !== SyntaxKind.ImportDeclaration) continue;

    const imp = node as ImportDeclaration;
    const source = imp.moduleSpecifier.getText().slice(1, -1);
    if (source !== 'orchid-orm') continue;

    if (!imp.importClause) continue;

    const elements = (imp.importClause.namedBindings as NamedImports)?.elements;

    if (!elements) imp;

    for (const element of elements) {
      if (
        element.propertyName?.escapedText === 'orchidORM' ||
        element.name.escapedText === 'orchidORM'
      ) {
        return element.name.escapedText.toString();
      }
    }
  }

  return;
};

const makeTablesListChanges = (
  content: string,
  statements: NodeArray<Statement>,
  object: ObjectLiteralExpression,
  tables: AppCodeGenTables,
  dbPath: string,
) => {
  const spaces = getTablesListSpaces(content, object);

  let imports = '';
  let tablesList = '';
  const prependComma =
    object.properties.length && !object.properties.hasTrailingComma;
  const tablesListNewLine = content
    .slice(object.properties.end, object.end)
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

  let importPos = 0;
  for (const node of statements) {
    if (node.kind === SyntaxKind.ImportDeclaration) {
      importPos = node.end;
    }
  }

  return {
    imports: { pos: importPos, text: imports },
    tablesList: { pos: object.properties.end, text: tablesList },
  };
};

const getTablesListSpaces = (content: string, object: Expression): string => {
  const lines = content.slice(0, object.end).split('\n');
  const last = lines[lines.length - 1];
  return last.match(/^\s+/)?.[0] || '';
};

const getOrchidOrmArgs = (
  importName: string,
  statements: NodeArray<Statement>,
): { config: Expression; tablesList: ObjectLiteralExpression } => {
  for (const v of statements) {
    if (v.kind !== SyntaxKind.VariableStatement) continue;

    for (const node of (v as VariableStatement).declarationList.declarations) {
      const call = node.initializer as CallExpression;
      if (call?.kind !== SyntaxKind.CallExpression) continue;

      if (call.expression.getText() !== importName) continue;

      if (call.arguments.length !== 2) {
        throw new Error(
          'Invalid number of arguments when initializing orchid orm',
        );
      }

      const object = call.arguments[1] as ObjectLiteralExpression;
      if (object?.kind !== SyntaxKind.ObjectLiteralExpression) {
        throw new Error(
          'Second argument of orchidORM must be an object literal',
        );
      }

      return { config: call.arguments[0], tablesList: object };
    }
  }

  throw new Error('List of tables is not found in main file');
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
