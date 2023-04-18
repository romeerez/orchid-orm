import { RakeDbAst } from 'rake-db';
import { createTable } from './createTable';
import { changeTable } from './changeTable';
import { renameTable } from './renameTable';
import { QueryLogOptions } from 'pqb';
import {
  AppCodeUpdaterTables,
  AppCodeUpdaterRelations,
  BaseTableParam,
  AppCodeUpdaterGetTable,
} from '../appCodeUpdater';
import { handleForeignKey } from './handleForeignKey';

export type UpdateTableFileParams = {
  baseTable: BaseTableParam;
  tablePath: (name: string) => string;
  ast: RakeDbAst;
  logger?: QueryLogOptions['logger'];
  getTable: AppCodeUpdaterGetTable;
  relations: AppCodeUpdaterRelations;
  tables: AppCodeUpdaterTables;
};

export const updateTableFile = async (params: UpdateTableFileParams) => {
  const { ast } = params;
  if (ast.type === 'table' && ast.action === 'create') {
    await createTable({ ...params, ast });
  } else if (ast.type === 'changeTable') {
    await changeTable({ ...params, ast });
  } else if (ast.type === 'renameTable') {
    await renameTable({ ...params, ast });
  } else if (ast.type === 'constraint' && ast.references) {
    const ref = ast.references;
    if (typeof ref.fnOrTable === 'string') {
      await handleForeignKey({
        getTable: params.getTable,
        relations: params.relations,
        tableName: ast.tableName,
        columns: ref.columns,
        foreignTableName: ref.fnOrTable,
        foreignColumns: ref.foreignColumns,
      });
    }
  }
};
