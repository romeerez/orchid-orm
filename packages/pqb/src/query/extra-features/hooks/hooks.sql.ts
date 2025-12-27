import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { Column } from '../../../columns/column';
import { CteTableHook, HookSelect, TableHook } from '../../basic-features/select/hook-select';
import { QueryData } from '../../query-data';

export type HookPurpose = 'Create' | 'Update' | 'Delete';

export const addTableHook = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  data: QueryData,
  select?: HookSelect,
  hookPurpose?: HookPurpose,
): void => {
  const afterCreate = data.afterCreate;
  const afterUpdate = data.afterUpdate;
  const afterSave = data.afterSave;
  const afterDelete = data.afterDelete;
  const afterCreateCommit = data.afterCreateCommit;
  const afterUpdateCommit = data.afterUpdateCommit;
  const afterSaveCommit = data.afterSaveCommit;
  const afterDeleteCommit = data.afterDeleteCommit;

  const hasAfterHook =
    afterCreate ||
    afterUpdate ||
    afterSave ||
    afterDelete ||
    afterCreateCommit ||
    afterUpdateCommit ||
    afterSaveCommit ||
    afterDeleteCommit;

  if (!select && !hasAfterHook) {
    return;
  }

  const tableHook: TableHook = {
    hookPurpose,
    select,
    afterCreate,
    afterUpdate,
    afterSave,
    afterDelete,
    afterCreateCommit,
    afterUpdateCommit,
    afterSaveCommit,
    afterDeleteCommit,
  };

  if (ctx.cteName) {
    if (tableHook && hasAfterHook) {
      const shape: Column.Shape.Data = {};
      if (tableHook.select) {
        for (const key of tableHook.select.keys()) {
          shape[key] = q.shape[key] as unknown as Column.Pick.Data;
        }
      }

      const item: CteTableHook = {
        table: q.table!,
        shape,
        tableHook: tableHook,
      };

      if (
        tableHook.select &&
        ctx.topCtx.selectList &&
        ctx.topCtx === ctx.topCtx.topCtx &&
        !ctx.topCtx.cteHookTopNullSelectAppended
      ) {
        ctx.topCtx.selectList.push('NULL');
        ctx.topCtx.cteHookTopNullSelectAppended = true;
      }

      if (ctx.topCtx.cteHooks) {
        if (tableHook.select) ctx.topCtx.cteHooks.hasSelect = true;
        ctx.topCtx.cteHooks.tableHooks[ctx.cteName] ??= item;
      } else {
        ctx.topCtx.cteHooks = {
          hasSelect: !!tableHook.select,
          tableHooks: { [ctx.cteName]: item },
        };
      }
    }
  } else {
    ctx.topCtx.tableHook = tableHook;
  }
};
