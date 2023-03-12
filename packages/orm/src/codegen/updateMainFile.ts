import { RakeDbAst } from 'rake-db';
import fs from 'fs/promises';
import path from 'path';
import { NodeArray, ObjectLiteralExpression, Statement } from 'typescript';
import { toCamelCase, toPascalCase } from '../utils';
import { AppCodeUpdaterError } from './appCodeUpdater';
import { FileChanges } from './fileChanges';
import { ts } from './tsUtils';
import { getImportPath } from './utils';
import { AdapterOptions, QueryLogOptions } from 'pqb';
import { singleQuote, pathToLog } from 'orchid-core';

type Context = {
  filePath: string;
  tablePath: (name: string) => string;
  statements: NodeArray<Statement>;
  object: ObjectLiteralExpression;
  content: string;
  spaces: string;
};

const libraryName = 'orchid-orm';
const importKey = 'orchidORM';

const newFile = (
  options: AdapterOptions,
) => `import { orchidORM } from 'orchid-orm';

export const db = orchidORM(
  {
    ${optionsToString(options)}
  },
  {
  }
);
`;

const optionsToString = (options: AdapterOptions) => {
  const lines: string[] = [];
  for (const key in options) {
    const value = options[key as keyof AdapterOptions];
    if (typeof value !== 'object' && typeof value !== 'function') {
      lines.push(
        `${key}: ${typeof value === 'string' ? singleQuote(value) : value},`,
      );
    }
  }
  return lines.join('\n    ');
};

export const updateMainFile = async (
  filePath: string,
  tablePath: (name: string) => string,
  ast: RakeDbAst,
  options: AdapterOptions,
  logger: QueryLogOptions['logger'],
) => {
  const result = await fs.readFile(filePath, 'utf-8').then(
    (content) => ({ error: undefined, content }),
    (error) => {
      return { error, content: undefined };
    },
  );

  if (result.error && result.error.code !== 'ENOENT') throw result.error;
  const content = result.content || newFile(options);

  const statements = ts.getStatements(content);

  const importName = ts.import.getStatementsImportedName(
    statements,
    libraryName,
    importKey,
  );
  if (!importName) {
    throw new AppCodeUpdaterError(
      `Main file does not contain import of orchid-orm`,
    );
  }

  const object = getTablesListObject(importName, statements);
  if (!object) {
    throw new Error('List of tables is not found in main file');
  }

  const spaces = ts.spaces.getAtLine(content, object.end);

  const context: Context = {
    filePath,
    tablePath,
    statements,
    object,
    content,
    spaces,
  };

  let write: string | undefined;
  if (ast.type === 'table') {
    if (ast.action === 'create') {
      write = createTable(context, ast);
    } else {
      write = dropTable(context, ast);
    }
  }
  // rename table is not handled because renaming of the class and the file is better to be done by the editor,
  // editor can scan all project files, rename import path and imported class name

  if (write) {
    if (result.error) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }

    await fs.writeFile(filePath, write);
    logger?.log(
      `${result.content ? 'Updated' : 'Created'} ${pathToLog(filePath)}`,
    );
  }
};

const createTable = (
  { filePath, tablePath, statements, object, content, spaces }: Context,
  ast: RakeDbAst.Table,
) => {
  const key = toCamelCase(ast.name);
  const value = `${toPascalCase(ast.name)}Table`;

  const changes = new FileChanges(content);

  const importPath = getImportPath(filePath, tablePath(ast.name));

  const existing = Array.from(
    ts.import.iterateWithSource(statements, importPath),
  );
  if (existing.length) return;

  for (const prop of object.properties) {
    if (key === ts.prop.getName(prop)) {
      return;
    }
  }

  const importPos = ts.import.getEndPos(statements);
  changes.add(
    importPos,
    `${importPos === 0 ? '' : '\n'}import { ${value} } from '${importPath}';`,
  );

  let insert = `\n${spaces}  ${key}: ${value},`;
  if (object.properties.length && !object.properties.hasTrailingComma) {
    insert = `,${insert}`;
  }
  if (!content.slice(object.properties.end, object.end).includes('\n')) {
    insert += `\n${spaces}`;
  }
  changes.add(object.properties.end, insert);

  return changes.apply();
};

const dropTable = (
  { filePath, tablePath, statements, object, content }: Context,
  ast: RakeDbAst.Table,
) => {
  const changes = new FileChanges(content);

  const importPath = getImportPath(filePath, tablePath(ast.name));
  const tableClassName = `${toPascalCase(ast.name)}Table`;
  const importNames: string[] = [];
  for (const node of ts.import.iterateWithSource(statements, importPath)) {
    changes.remove(node.pos, node.end);

    const name = ts.import.getImportName(node, tableClassName);
    if (name && !importNames.includes(name)) {
      importNames.push(name);
    }
  }

  for (const prop of object.properties) {
    const name = ts.prop.getValue(prop);
    if (!name || !importNames.includes(name)) continue;

    let { end } = prop;
    if (content[end] === ',') end++;
    changes.remove(prop.pos, end);
  }

  return changes.apply();
};

const getTablesListObject = (
  importName: string,
  statements: NodeArray<Statement>,
): ObjectLiteralExpression | undefined => {
  for (const node of ts.variable.iterateDeclarations(statements)) {
    const call = node.initializer;
    if (!ts.is.call(call)) continue;

    if (call.expression.getText() !== importName) continue;

    if (call.arguments.length !== 2) {
      throw new Error(
        'Invalid number of arguments when initializing orchid orm',
      );
    }

    const object = call.arguments[1];
    if (!ts.is.objectLiteral(object)) {
      throw new Error('Second argument of orchidORM must be an object literal');
    }

    return object;
  }

  return;
};
