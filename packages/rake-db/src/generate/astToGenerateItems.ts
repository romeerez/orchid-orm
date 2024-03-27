import { RakeDbAst } from 'rake-db';
import {
  getConstraintName,
  getForeignKeyTable,
  getIndexName,
} from '../migration/migrationUtils';
import {
  ArrayColumn,
  ArrayColumnValue,
  ColumnType,
  EnumColumn,
  TableData,
} from 'pqb';
import { exhaustive, getSchemaAndTableFromName } from '../common';
import { ColumnTypeSchemaArg } from 'orchid-core';

export interface GenerateItem {
  ast: RakeDbAst;
  add: Set<string>;
  drop: Set<string>;
  deps: Set<string>;
}

type TableColumn = [
  keys: string[],
  name: string,
  column: RakeDbAst.ColumnChange,
];

export const astToGenerateItems = (
  asts: RakeDbAst[],
  currentSchema: string,
): GenerateItem[] => {
  return asts.map((ast) => astToGenerateItem(ast, currentSchema));
};

export const astToGenerateItem = (
  ast: RakeDbAst,
  currentSchema: string,
): GenerateItem => {
  const add: string[] = [];
  const drop: string[] = [];
  const deps: string[] = [];

  switch (ast.type) {
    case 'table':
    case 'changeTable':
    case 'view': {
      const schema = ast.schema ?? currentSchema;
      const table = `${schema}.${ast.name}`;

      if (ast.type === 'table' || ast.type === 'view') {
        const keys = ast.action === 'create' ? add : drop;
        keys.push(table);
        deps.push(schema);

        const columns: TableColumn[] = Object.entries(ast.shape).map(
          ([name, column]) => [keys, name, { column }],
        );

        analyzeTableColumns(currentSchema, schema, table, deps, columns);

        if (ast.type === 'table') {
          analyzeTableData(currentSchema, schema, table, keys, deps, ast);
        } else {
          deps.push(
            ...ast.deps.map(({ schemaName, name }) => `${schemaName}.${name}`),
          );
        }
      } else {
        deps.push(table);

        const columns: TableColumn[] = [];

        for (const name in ast.shape) {
          const item = ast.shape[name];
          if (item.type === 'add') {
            columns.push([add, name, { column: item.item }]);
          } else if (item.type === 'drop') {
            columns.push([drop, name, { column: item.item }]);
          } else if (item.type === 'change') {
            columns.push([add, name, item.to]);
            columns.push([drop, name, item.from]);
          }
        }

        analyzeTableColumns(currentSchema, schema, table, deps, columns);
        analyzeTableData(currentSchema, schema, table, add, deps, ast.add);
        analyzeTableData(currentSchema, schema, table, drop, deps, ast.drop);
      }
      break;
    }
    case 'renameTable': {
      const { fromSchema = currentSchema, toSchema = currentSchema } = ast;
      add.push(`${toSchema}.${ast.to}`);
      drop.push(`${fromSchema}.${ast.from}`);
      deps.push(fromSchema, toSchema);
      break;
    }
    case 'schema': {
      (ast.action === 'create' ? add : drop).push(ast.name);
      break;
    }
    case 'renameSchema': {
      drop.push(ast.from);
      add.push(ast.to);
      break;
    }
    case 'extension':
    case 'enum':
    case 'collation': {
      const schema = ast.schema ?? currentSchema;
      (ast.action === 'create' ? add : drop).push(`${schema}.${ast.name}`);
      deps.push(schema);
      break;
    }
    case 'domain': {
      const schema = ast.schema ?? currentSchema;
      (ast.action === 'create' ? add : drop).push(`${schema}.${ast.name}`);
      deps.push(schema, ast.baseType.dataType);
      if (ast.collation) deps.push(ast.collation);
      break;
    }
    case 'constraint': {
      const { tableSchema = currentSchema, tableName } = ast;
      const name = `${tableSchema}.${
        ast.name ?? getConstraintName(tableName, ast)
      }`;
      (ast.action === 'create' ? add : drop).push(name);
      deps.push(tableSchema, `${tableSchema}.${tableName}`);
      break;
    }
    default:
      exhaustive(ast);
  }

  return {
    ast,
    add: new Set(add),
    drop: new Set(drop),
    deps: new Set(deps),
  };
};

const analyzeTableColumns = (
  currentSchema: string,
  schema: string,
  table: string,
  deps: string[],
  columns: TableColumn[],
) => {
  for (const [keys, name, change] of columns) {
    const { column } = change;
    if (column) {
      let c = column;

      while (c.dataType === 'array') {
        c = (
          column as ArrayColumn<
            ColumnTypeSchemaArg,
            ArrayColumnValue,
            unknown,
            unknown,
            unknown
          >
        ).data.item as ColumnType;
      }

      if (c.dataType === 'enum') {
        const { enumName } = c as EnumColumn<ColumnTypeSchemaArg, unknown>;
        const [schema = currentSchema, name] =
          getSchemaAndTableFromName(enumName);
        deps.push(`${schema}.${name}`);
      } else {
        deps.push(c.dataType);
      }
    } else if (change.type) {
      deps.push(change.type);
    }

    const collate = change.column?.data.collate ?? change.collate;
    if (collate) deps.push(collate);

    const primaryKey = change.primaryKey || change.column?.data.isPrimaryKey;
    if (primaryKey) {
      keys.push(`${table}_pkey`);
    }

    const indexes = change.indexes || change.column?.data.indexes;
    if (indexes) {
      for (const index of indexes) {
        keys.push(
          index.name
            ? `${schema}.${index.name}`
            : getIndexName(table, [
                { column: change.column?.data.name ?? name },
              ]),
        );
      }
    }

    const foreignKeys = change.foreignKeys || change.column?.data.foreignKeys;
    if (foreignKeys) {
      for (const fkey of foreignKeys) {
        keys.push(
          fkey.name
            ? `${schema}.${fkey.name}`
            : getConstraintName(table, {
                references: { columns: [change.column?.data.name ?? name] },
              }),
        );

        const [s = currentSchema, t] = getForeignKeyTable(
          'table' in fkey ? fkey.table : fkey.fn,
        );
        deps.push(`${s}.${t}`);
      }
    }
  }
};

const analyzeTableData = (
  currentSchema: string,
  schema: string,
  table: string,
  keys: string[],
  deps: string[],
  data: TableData,
) => {
  if (data.primaryKey) {
    const name = data.primaryKey.options?.name;
    keys.push(name ? `${schema}.${name}` : `${table}_pkey`);
  }

  if (data.indexes) {
    for (const index of data.indexes) {
      const name = index.options?.name;
      keys.push(
        name ? `${schema}.${name}` : getIndexName(table, index.columns),
      );
    }
  }

  if (data.constraints) {
    for (const constraint of data.constraints) {
      keys.push(
        constraint.name
          ? `${schema}.${constraint.name}`
          : getConstraintName(table, constraint),
      );

      if (constraint.references) {
        const [s = currentSchema, t] = getForeignKeyTable(
          constraint.references.fnOrTable,
        );
        deps.push(`${s}.${t}`);
      }
    }
  }
};
