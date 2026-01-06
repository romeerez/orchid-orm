// query metadata that is stored only on TS side, not available in runtime
import { Column } from '../columns';
import { EmptyObject, RecordKeyTrue } from '../utils';

export interface QuerySelectable {
  [K: PropertyKey]: { as: string; column: Column.Pick.QueryColumn };
}

export interface QueryMetaBase<Scopes extends RecordKeyTrue = RecordKeyTrue> {
  // single relations (belongsTo, hasOne) returns one when subQuery is true, returns many otherwise
  subQuery: boolean;
  // `update` and `delete` require the query to have `where`.
  // Calling `.all()` is also setting `hasWhere` to true.
  hasWhere?: true;
  // Record<string, true> where keys are columns with defaults for `create` to make them optional.
  defaults: EmptyObject;
  // Union of available full text search aliases to use in `headline` and in `order`.
  tsQuery?: string;
  // Used to determine what scopes are available on the table.
  scopes: Scopes;
  // union of columns to select by default or with *
  defaultSelect: PropertyKey;
}

// affects on typing of `chain`
export interface QueryMetaIsSubQuery {
  meta: {
    subQuery: true;
  };
}
