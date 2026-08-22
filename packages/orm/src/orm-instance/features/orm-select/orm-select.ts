import { Db } from 'pqb';
import {
  type QueryTake,
  type SelectAsFnReturnType,
  type SelectResultObj,
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
  ): QueryTake<SelectResultObj<Db, Obj>>;
}

export const ormSelect = (qb: Db): OrmSelectMethods['$select'] =>
  ((selection) => qb.select(selection).take()) as OrmSelectMethods['$select'];
