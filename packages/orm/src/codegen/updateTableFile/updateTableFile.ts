import { RakeDbAst } from 'rake-db';
import { createTable } from './createTable';
import { changeTable } from './changeTable';
import { renameTable } from './renameTable';

export type UpdateTableFileParams = {
  baseTablePath: string;
  baseTableName: string;
  tablePath: (name: string) => string;
  ast: RakeDbAst;
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
