import { columnsShapeToCode, pushTableDataCode, TableData } from 'pqb';
import { AnyRakeDbConfig, RakeDbAst } from 'rake-db';
import {
  Code,
  codeToString,
  getImportPath,
  RecordString,
  singleQuote,
  toCamelCase,
  toPascalCase,
} from 'orchid-core';
import path from 'node:path';

interface TableInfo {
  key: string;
  dbTableName: string;
  name: string;
  className: string;
  path: string;
}

interface TableInfos {
  [dbTableName: string]: TableInfo;
}

export interface AppCodeGenTable extends TableInfo {
  content: string;
}

export interface AppCodeGenTables {
  [K: string]: AppCodeGenTable;
}

interface FKeys {
  [K: string]: { table: TableInfo; references: TableData.References }[];
}

export const getTableInfosAndFKeys = (
  asts: RakeDbAst[],
  config: AnyRakeDbConfig,
): { tableInfos: TableInfos; fkeys: FKeys } => {
  const generateTableTo =
    config.generateTableTo ?? ((name: string) => `./tables/${name}.table.ts`);

  const tableInfos: TableInfos = {};
  const fkeys: FKeys = {};
  for (const ast of asts) {
    if (ast.type === 'table') {
      const tableKey = toCamelCase(ast.name);
      const dbTableName = ast.schema ? `${ast.schema}.${ast.name}` : ast.name;
      let tablePath = path.resolve(config.basePath, generateTableTo(tableKey));
      if (!tablePath.endsWith('.ts')) tablePath += '.ts';

      const name = toPascalCase(ast.name);

      const info: TableInfo = {
        dbTableName,
        key: tableKey,
        path: tablePath,
        name,
        className: `${name}Table`,
      };

      tableInfos[dbTableName] = info;

      if (ast.constraints) {
        for (const { references } of ast.constraints) {
          if (!references) continue;

          (fkeys[references.fnOrTable as string] ??= []).push({
            table: info,
            references,
          });
        }
      }
    }
  }

  return { tableInfos, fkeys };
};

export const appCodeGenTable = (
  tableInfos: TableInfos,
  fkeys: FKeys,
  ast: RakeDbAst.Table,
  baseTablePath: string,
  baseTableExportedAs: string,
): AppCodeGenTable => {
  const tableInfo =
    tableInfos[ast.schema ? `${ast.schema}.${ast.name}` : ast.name];

  const imports: RecordString = {
    'orchid-orm': 'Selectable, Insertable, Updatable',
    [getImportPath(tableInfo.path, baseTablePath)]: baseTableExportedAs,
  };

  const props: Code[] = [];

  if (ast.schema) {
    props.push(`schema = ${singleQuote(ast.schema)};`);
  }

  props.push(`readonly table = ${singleQuote(ast.name)};`);

  if (ast.comment) {
    props.push(`comment = ${singleQuote(ast.comment)};`);
  }

  if (ast.noPrimaryKey === 'ignore') {
    props.push('noPrimaryKey = true;');
  }

  const hasTableData = Boolean(
    ast.primaryKey || ast.indexes?.length || ast.constraints?.length,
  );

  const shapeCode = columnsShapeToCode(ast.shape, 't');

  props.push(
    `columns = this.setColumns(${hasTableData ? '\n    ' : ''}(t) => ({`,
    hasTableData ? [shapeCode] : shapeCode,
    hasTableData ? '  }),' : '}));',
  );

  if (hasTableData) {
    props.push(pushTableDataCode([], ast), ');');
  }

  const relations: Code[] = [];

  const fullTableName = ast.schema ? `${ast.schema}.${ast.name}` : ast.name;
  const belongsTo = fkeys[fullTableName];
  if (belongsTo) {
    for (const { table, references } of belongsTo) {
      imports[getImportPath(tableInfo.path, table.path)] = table.className;

      relations.push(
        `${table.key}: this.belongsTo(() => ${table.className}, {`,
        [
          `columns: [${references.foreignColumns
            .map(singleQuote)
            .join(', ')}],`,
          `references: [${references.columns.map(singleQuote).join(', ')}],`,
        ],
        '}),',
      );
    }
  }

  if (ast.constraints) {
    for (const { references } of ast.constraints) {
      if (!references) continue;

      const table = tableInfos[references.fnOrTable as string];
      imports[getImportPath(tableInfo.path, table.path)] = table.className;

      relations.push(
        `${table.key}: this.hasMany(() => ${table.className}, {`,
        [
          `columns: [${references.columns.map(singleQuote).join(', ')}],`,
          `references: [${references.foreignColumns
            .map(singleQuote)
            .join(', ')}],`,
        ],
        '}),',
      );
    }
  }

  if (relations.length) {
    props.push('', 'relations = {', relations, '};');
  }

  const importsCode = importsToCode(imports);

  const { name, className } = tableInfo;
  const code: Code[] = [
    `export type ${name} = Selectable<${className}>;
export type ${name}New = Insertable<${className}>;
export type ${name}Update = Updatable<${className}>;

export class ${className} extends ${baseTableExportedAs} {`,
    props,
    '}\n',
  ];

  return {
    ...tableInfo,
    content: importsCode + '\n\n' + codeToString(code, '', '  '),
  };
};

function importsToCode(imports: Record<string, string>): string {
  return Object.entries(imports)
    .map(([from, name]) => `import { ${name} } from '${from}';`)
    .join('\n');
}
