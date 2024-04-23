import {
  ColumnType,
  ForeignKeyAction,
  ForeignKeyMatch,
  ForeignKeyOptions,
  QueryWithTable,
} from 'pqb';
import { RakeDbAst } from 'rake-db';
import { DbStructure } from '../dbStructure';
import { getSchemaAndTableFromName } from '../../common';
import { StructureToAstTableData } from '../structureToAst';

const mapMatch: { [K in ForeignKeyMatch]: DbStructure.ForeignKeyMatch } = {
  FULL: 'f',
  PARTIAL: 'p',
  SIMPLE: 's',
};

const mapAction: { [K in ForeignKeyAction]: DbStructure.ForeignKeyAction } = {
  'NO ACTION': 'a',
  RESTRICT: 'r',
  CASCADE: 'c',
  'SET NULL': 'n',
  'SET DEFAULT': 'd',
};

export const processForeignKeys = (
  tableData: StructureToAstTableData,
  codeTable: QueryWithTable,
  shape: RakeDbAst.ChangeTableShape,
  currentSchema: string,
) => {
  const codeFkeys: DbStructure.References[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.foreignKeys) continue;

    const name = column.data.name ?? key;
    if (shape[name] && shape[name].type !== 'rename') continue;

    codeFkeys.push(
      ...column.data.foreignKeys.map((x) =>
        parseForeignKey(
          currentSchema,
          'fn' in x ? x.fn : x.table,
          [name],
          x.columns,
          x,
        ),
      ),
    );
  }

  if (codeTable.internal.constraints) {
    for (const { references } of codeTable.internal.constraints) {
      if (!references) continue;

      codeFkeys.push(
        parseForeignKey(
          currentSchema,
          references.fnOrTable,
          references.columns,
          references.foreignColumns,
          references.foreignKeyOptions,
        ),
      );
    }
  }

  for (const { references: dbFkey } of tableData.constraints) {
    if (!dbFkey) continue;
    // TODO: it should handle full constraint
    // rename this to constraints gen
  }
};

const parseForeignKey = (
  currentSchema: string,
  fnOrTable: (() => { new (): { schema?: string; table: string } }) | string,
  columns: string[],
  foreignColumns: string[],
  options: ForeignKeyOptions,
): DbStructure.References => {
  let schema;
  let table;
  if (typeof fnOrTable === 'function') {
    const q = new (fnOrTable())();
    schema = q.schema;
    table = q.table;
  } else {
    [schema, table] = getSchemaAndTableFromName(fnOrTable);
  }

  return {
    foreignSchema: schema ?? currentSchema,
    foreignTable: table,
    columns,
    foreignColumns,
    match: mapMatch[options.match || 'SIMPLE'],
    onUpdate: mapAction[options.onUpdate || 'NO ACTION'],
    onDelete: mapAction[options.onDelete || 'NO ACTION'],
  };
};
