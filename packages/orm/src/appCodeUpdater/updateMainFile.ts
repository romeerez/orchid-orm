import { RakeDbAst } from 'rake-db';
import fs from 'fs/promises';
import {
  createSourceFile,
  NodeArray,
  ObjectLiteralExpression,
  ScriptTarget,
  Statement,
} from 'typescript';
import { toCamelCase, toPascalCase } from '../utils';
import { AppCodeUpdaterError } from './appCodeUpdater';
import { FileChanges } from './fileChanges';
import { ts } from './tsUtils';

type Context = {
  path: string;
  tablePath: (name: string) => string;
  statements: NodeArray<Statement>;
  object: ObjectLiteralExpression;
  content: string;
  spaces: string;
};

const libraryName = 'orchid-orm';
const importKey = 'orchidORM';

export const updateMainFile = async (
  path: string,
  tablePath: (name: string) => string,
  ast: RakeDbAst,
) => {
  const content = await fs.readFile(path, 'utf-8');

  const { statements } = createSourceFile(
    'file.ts',
    content,
    ScriptTarget.Latest,
    true,
  );

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
    path,
    tablePath,
    statements,
    object,
    content,
    spaces,
  };

  if (ast.type === 'table') {
    if (ast.action === 'create') {
      return fs.writeFile(path, createTable(context, ast));
    } else {
      return fs.writeFile(path, dropTable(context, ast));
    }
  }

  // rename table is not handled because renaming of the class and the file is better to be done by the editor,
  // editor can scan all project files, rename import path and imported class name
};

const createTable = (
  { path, tablePath, statements, object, content, spaces }: Context,
  ast: RakeDbAst.Table,
) => {
  const key = toCamelCase(ast.name);
  const value = toPascalCase(ast.name);

  const changes = new FileChanges(content);

  const importPath = ts.path.getRelative(path, tablePath(ast.name));
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
  { path, tablePath, statements, object, content }: Context,
  ast: RakeDbAst.Table,
) => {
  const changes = new FileChanges(content);

  const importPath = ts.path.getRelative(path, tablePath(ast.name));
  const tableClassName = toPascalCase(ast.name);
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
