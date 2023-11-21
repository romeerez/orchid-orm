import { RakeDbAst } from 'rake-db';
import { columnsShapeToCode, ColumnType } from 'pqb';
import {
  Code,
  singleQuote,
  pathToLog,
  codeToString,
  toCamelCase,
  toPascalCase,
  getImportPath,
} from 'orchid-core';
import fs from 'fs/promises';
import { UpdateTableFileParams } from './updateTableFile';
import path from 'path';
import {
  AppCodeUpdaterRelations,
  AppCodeUpdaterGetTable,
} from '../appCodeUpdater';
import { handleForeignKey } from './handleForeignKey';

export const createTable = async ({
  ast,
  logger,
  getTable,
  relations,
  tables,
  delayed,
  ...params
}: UpdateTableFileParams & {
  ast: RakeDbAst.Table;
}) => {
  const key = toCamelCase(ast.name);
  const tablePath = params.tablePath(key);
  const baseTablePath = getImportPath(
    tablePath,
    params.baseTable.getFilePath(),
  );
  const className = `${toPascalCase(ast.name)}Table`;

  tables[ast.name] = {
    key,
    name: className,
    path: tablePath,
  };

  const imports: Record<string, string> = {
    [baseTablePath]: params.baseTable.exportAs,
  };

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

  const importsCode = importsToCode(imports);
  const code: Code[] = [
    `export class ${className} extends ${params.baseTable.exportAs} {`,
    props,
    '}\n',
  ];

  await fs.mkdir(path.dirname(tablePath), { recursive: true });
  try {
    const content = importsCode + '\n\n' + codeToString(code, '', '  ');
    await fs.writeFile(tablePath, content, { flag: 'wx' });

    delayed.push(async () => {
      const imports: Record<string, string> = {};

      const relCode = await getRelations(
        ast,
        getTable,
        tablePath,
        imports,
        relations,
        ast.name,
      );

      if (relCode) {
        const code = codeToString(relCode, '  ', '  ');

        const updated =
          content.slice(0, importsCode.length) +
          `\n${importsToCode(imports)}` +
          content.slice(importsCode.length, -2) +
          '  \n' +
          code +
          '\n' +
          content.slice(-2);

        await fs.writeFile(tablePath, updated);
      }

      logger?.log(`Created ${pathToLog(tablePath)}`);
    });
  } catch (err) {
    if ((err as unknown as { code: string }).code !== 'EEXIST') {
      throw err;
    }
  }
};

function importsToCode(imports: Record<string, string>): string {
  return Object.entries(imports)
    .map(([from, name]) => `import { ${name} } from '${from}';`)
    .join('\n');
}

const getRelations = async (
  ast: RakeDbAst.Table,
  getTable: AppCodeUpdaterGetTable,
  tablePath: string,
  imports: Record<string, string>,
  relations: AppCodeUpdaterRelations,
  tableName: string,
): Promise<Code[] | undefined> => {
  const refs: { table: string; columns: string[]; foreignColumns: string[] }[] =
    [];

  for (const key in ast.shape) {
    const item = ast.shape[key];
    if (!(item instanceof ColumnType) || !item.data.foreignKeys) continue;

    for (const fkey of item.data.foreignKeys) {
      if ('table' in fkey) {
        refs.push({
          table: fkey.table,
          columns: [key],
          foreignColumns: fkey.columns,
        });
      }
    }
  }

  if (ast.constraints) {
    for (const { references: ref } of ast.constraints) {
      if (ref && typeof ref.fnOrTable === 'string') {
        refs.push({
          table: ref.fnOrTable,
          columns: ref.columns,
          foreignColumns: ref.foreignColumns,
        });
      }
    }
  }

  if (!refs.length) return;

  const code: Code[] = [];

  for (const ref of refs) {
    const { columns, foreignColumns } = ref;
    if (columns.length > 1 || foreignColumns.length > 1) continue;

    const info = await getTable(ref.table);
    if (!info) continue;

    const path = getImportPath(tablePath, info.path);
    imports[path] = info.name;

    code.push(
      `${info.key}: this.belongsTo(() => ${info.name}, {`,
      [`primaryKey: '${foreignColumns[0]}',`, `foreignKey: '${columns[0]}',`],
      '}),',
    );

    await handleForeignKey({
      getTable,
      relations,
      tableName,
      columns: ref.columns,
      foreignTableName: ref.table,
      foreignColumns: ref.foreignColumns,
      skipBelongsTo: true,
    });
  }

  return code.length ? ['relations = {', code, '};'] : undefined;
};
