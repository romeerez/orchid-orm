import { IntrospectedStructure, RakeDbAst } from 'rake-db';
import { CodeTable } from '../generate';

interface TableRlsState {
  enable: boolean;
  force: boolean;
}

const defaultRlsState: TableRlsState = {
  enable: false,
  force: false,
};

const normalizeRlsFlag = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  return value === true || value === 'true' || value === 't';
};

export const processTableRls = (
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  tables: CodeTable[],
  currentSchema: string,
) => {
  const projectRlsDefaults = tables[0]?.internal.rls?.tableRlsDefaults;

  for (const table of tables) {
    const tableRls = table.internal.tableRls;
    if (!tableRls) continue;

    const schemaName = table.q.schema ?? currentSchema;
    const dbTable = dbStructure.tables.find(
      (item) => item.schemaName === schemaName && item.name === table.table,
    );
    if (!dbTable) continue;

    const codeRls: TableRlsState = {
      enable: normalizeRlsFlag(
        tableRls.enable ?? projectRlsDefaults?.enable,
        defaultRlsState.enable,
      ),
      force: normalizeRlsFlag(
        tableRls.force ?? projectRlsDefaults?.force,
        defaultRlsState.force,
      ),
    };
    const dbRls: TableRlsState = {
      enable: normalizeRlsFlag(dbTable.rls?.enable, defaultRlsState.enable),
      force: normalizeRlsFlag(dbTable.rls?.force, defaultRlsState.force),
    };

    if (codeRls.enable !== dbRls.enable) {
      ast.push({
        type: 'tableRls',
        action: codeRls.enable ? 'enable' : 'disable',
        schema: schemaName,
        table: table.table,
      });
    }

    if (codeRls.force !== dbRls.force) {
      ast.push({
        type: 'tableRls',
        action: codeRls.force ? 'force' : 'noForce',
        schema: schemaName,
        table: table.table,
      });
    }
  }
};
