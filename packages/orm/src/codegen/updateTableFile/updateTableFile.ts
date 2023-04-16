import { RakeDbAst } from 'rake-db';
import { createTable } from './createTable';
import { changeTable } from './changeTable';
import { renameTable } from './renameTable';
import { QueryLogOptions } from 'pqb';
import { BaseTableParam } from '../appCodeUpdater';

export type UpdateTableFileParams = {
  baseTable: BaseTableParam;
  tablePath: (name: string) => string;
  ast: RakeDbAst;
  logger?: QueryLogOptions['logger'];
};

export const updateTableFile = async (params: UpdateTableFileParams) => {
  const { ast } = params;
  if (ast.type === 'table' && ast.action === 'create') {
    await createTable({ ...params, ast });
  } else if (ast.type === 'changeTable') {
    await changeTable({ ...params, ast });
  } else if (ast.type === 'renameTable') {
    await renameTable({ ...params, ast });
  }
};
