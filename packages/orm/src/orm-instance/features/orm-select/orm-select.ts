import { Db } from 'pqb';
import {
  ColumnsShape,
  QueryCatch,
  QueryThenShallowSimplify,
  SelectAs,
  type SelectAsFnReturnType,
  type SelectResultObj,
  ValExpression,
} from 'pqb/internal';

type OrmSelectArg = Record<string, () => SelectAsFnReturnType>;

export interface OrmSelectMethods {
  /**
   * Use `$select` to select independent query and expression results in a single SQL query.
   * Each value is a callback returning a query or SQL expression. The helper returns a
   * single-result query, so it can be awaited directly or further composed.
   */
  $select<Obj extends OrmSelectArg>(
    selection: Obj,
  ): {
    then: QueryThenShallowSimplify<
      ColumnsShape.Output<SelectResultObj<Db, Obj>['result']>
    >;
    catch: QueryCatch;
  };
}

export const ormSelect = (qb: Db): OrmSelectMethods['$select'] =>
  (async (selection) => {
    const q = qb.select(selection);

    const [{ selectAs }] = q.q.select as [SelectAs];
    const values = Object.entries(selectAs);
    if (values.every(([, val]) => val instanceof ValExpression)) {
      return Object.fromEntries(
        values.map(([key, expr]) => [
          key,
          (expr as ValExpression<unknown>).value,
        ]),
      );
    }

    const valExpressions: Record<string, unknown> = {};
    for (const [key, value] of values) {
      if (value instanceof ValExpression) {
        valExpressions[key] = value.value;
        delete selectAs[key];
      }
    }

    const result = await q.take();

    return Object.assign(result, valExpressions);
  }) as OrmSelectMethods['$select'];
