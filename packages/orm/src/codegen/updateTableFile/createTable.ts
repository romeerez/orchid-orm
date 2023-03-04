import { RakeDbAst } from 'rake-db';
import { getImportPath } from '../utils';
import { codeToString, columnsShapeToCode } from 'pqb';
import { Code, singleQuote } from 'orchid-core';
import { toPascalCase } from '../../utils';
import fs from 'fs/promises';
import { UpdateTableFileParams } from './updateTableFile';
import path from 'path';

export const createTable = async ({
  ast,
  ...params
}: UpdateTableFileParams & { ast: RakeDbAst.Table }) => {
  const tablePath = params.tablePath(ast.name);
  const baseTablePath = getImportPath(tablePath, params.baseTablePath);

  const props: Code[] = [];

  if (ast.schema) {
    props.push(`schema = ${singleQuote(ast.schema)};`);
  }

  props.push(`table = ${singleQuote(ast.name)};`);

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
  } catch (err) {
    if ((err as unknown as { code: string }).code !== 'EEXIST') {
      throw err;
    }
  }
};
