import { RakeDbAst } from 'rake-db';
import { getImportPath } from '../utils';
import { columnsShapeToCode } from 'pqb';
import {
  Code,
  singleQuote,
  pathToLog,
  codeToString,
  toCamelCase,
  toPascalCase,
} from 'orchid-core';
import fs from 'fs/promises';
import { UpdateTableFileParams } from './updateTableFile';
import path from 'path';

export const createTable = async ({
  ast,
  logger,
  ...params
}: UpdateTableFileParams & { ast: RakeDbAst.Table }) => {
  const tablePath = params.tablePath(toCamelCase(ast.name));
  const baseTablePath = getImportPath(tablePath, params.baseTablePath);

  const props: Code[] = [];

  if (ast.schema) {
    props.push(`schema = ${singleQuote(ast.schema)};`);
  }

  props.push(`readonly table = ${singleQuote(ast.name)};`);

  if (ast.noPrimaryKey === 'ignore') {
    props.push('noPrimaryKey = true;');
  }

  props.push(
    'columns = this.setColumns((t) => ({',
    columnsShapeToCode(ast.shape, ast, 't'),
    '}));',
  );

  const code: Code[] = [
    `import { ${params.baseTableName} } from '${baseTablePath}';\n`,
    `export class ${toPascalCase(ast.name)}Table extends ${
      params.baseTableName
    } {`,
    props,
    '}\n',
  ];

  await fs.mkdir(path.dirname(tablePath), { recursive: true });
  try {
    await fs.writeFile(tablePath, codeToString(code, '', '  '), { flag: 'wx' });
    logger?.log(`Created ${pathToLog(tablePath)}`);
  } catch (err) {
    if ((err as unknown as { code: string }).code !== 'EEXIST') {
      throw err;
    }
  }
};