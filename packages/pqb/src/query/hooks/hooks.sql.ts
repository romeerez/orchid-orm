import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { Column } from '../../columns/column';
import { CteTableHook, TableHook } from '../../core/query/hook-select';

export const addTableHook = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  tableHook?: TableHook,
): void => {
  if (ctx.cteName) {
    if (tableHook && (tableHook.after || tableHook.afterCommit)) {
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
        !ctx.cteHooks?.hasSelect &&
        tableHook.select &&
        ctx.topCtx.selectList
      ) {
        ctx.topCtx.selectList.push('NULL');
      }

      if (ctx.cteHooks) {
        if (tableHook.select) ctx.cteHooks.hasSelect = true;
        ctx.cteHooks.tableHooks[ctx.cteName] ??= item;
      } else {
        ctx.cteHooks = {
          hasSelect: !!tableHook.select,
          tableHooks: { [ctx.cteName]: item },
        };
      }
    }
  } else {
    ctx.topCtx.tableHook = tableHook;
  }
};
