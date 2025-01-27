import { Query } from '../query/query';
import { RelationQueryBase } from '../relations';
import { SelectableOrExpression } from '../common/utils';
import { SelectQueryData } from './data';
import {
  ColumnTypesBase,
  Expression,
  IsQuery,
  MaybeArray,
  RecordUnknown,
  TemplateLiteralArgs,
} from 'orchid-core';

// used in `from` logic to decide if convert query to sql or just write table name
export const checkIfASimpleQuery = (q: Query) => {
  if (
    (q.q.returnType && q.q.returnType !== 'all') ||
    q.q.selectAllColumns ||
    q.q.and?.length ||
    q.q.or?.length ||
    q.q.scopes
  )
    return false;

  const keys = Object.keys(q.q) as (keyof SelectQueryData)[];
  return !keys.some((key) => queryKeysOfNotSimpleQuery.includes(key));
};

const queryKeysOfNotSimpleQuery: (keyof SelectQueryData)[] = [
  'with',
  'as',
  'from',
  'select',
  'distinct',
  'only',
  'join',
  'group',
  'having',
  'window',
  'union',
  'order',
  'limit',
  'offset',
  'for',
];

export interface WithItem {
  // name
  n: string;
  // options
  o?: WithOptions;
  // query
  q?: Query;
  // sql
  s?: Expression;
}

export interface WithOptions {
  columns?: string[];
  recursive?: true;
  materialized?: true;
  notMaterialized?: true;
}

export type SelectItem = string | SelectAs | Expression | undefined;

export interface SelectAs {
  selectAs: SelectAsValue;
}

export interface SelectAsValue {
  [K: string]: string | Query | Expression | undefined;
}

export type OrderTsQueryConfig = true | OrderTsQueryConfigObject;

interface OrderTsQueryConfigObject {
  coverDensity?: boolean;
  weights?: number[];
  normalization?: number;
  dir?: SortDir;
}

export type QuerySourceItem = {
  queryAs: string;
  as?: string;
  textSQL?: MaybeArray<string>;
  langSQL?: string;
  vectorSQL?: string;
  order?: OrderTsQueryConfig;
} & (
  | {
      language?: string;
    }
  | {
      languageColumn: string;
    }
) &
  (
    | {
        text: string | Expression;
      }
    | {
        in: MaybeArray<string> | SearchWeightRecord;
      }
    | {
        vector: string;
      }
  ) &
  (
    | {
        query: string | Expression;
      }
    | {
        plainQuery: string | Expression;
      }
    | {
        phraseQuery: string | Expression;
      }
    | {
        tsQuery: string | Expression;
      }
  );

export type JoinItem = SimpleJoinItem | JoinLateralItem;

export type SimpleJoinItemNonSubQueryArgs =
  | [{ [K: string]: string | Expression } | Expression | true]
  | [leftColumn: string | Expression, rightColumn: string | Expression]
  | [
      leftColumn: string | Expression,
      op: string,
      rightColumn: string | Expression,
    ];

export type JoinItemArgs =
  | {
      // relation query from `relationConfig.joinQuery`
      j: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
      // callback result, if callback is present
      r?: IsQuery;
    }
  | {
      // `with` item name
      w: string;
      // callback result
      r: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // `with` item name
      w: string;
      // join arguments
      a: SimpleJoinItemNonSubQueryArgs;
    }
  | {
      // joining query
      q: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // joining query
      q: IsQuery;
      // callback result
      r: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // joining query
      q: IsQuery;
      // join arguments
      a: SimpleJoinItemNonSubQueryArgs;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // alias
      a: string;
      // array of values, item is a record
      d: RecordUnknown[];
      // column types
      c: ColumnTypesBase;
    };

export interface SimpleJoinItem {
  type: string;
  args: JoinItemArgs;
}

export type JoinLateralItem = [type: string, joined: Query, as: string];

export type WhereItem =
  | {
      [K: string]:
        | unknown
        | { [K: string]: unknown | Query | Expression }
        | Expression;

      NOT?: MaybeArray<WhereItem>;
      AND?: MaybeArray<WhereItem>;
      OR?: MaybeArray<WhereItem>[];
      IN?: MaybeArray<WhereInItem>;
      EXISTS?: MaybeArray<JoinItemArgs>;
      ON?: WhereOnItem | WhereJsonPathEqualsItem;
      SEARCH?: MaybeArray<WhereSearchItem>;
    }
  | ((q: unknown) => RelationQueryBase | Expression)
  | Query
  | Expression;

export interface WhereInItem {
  columns: string[];
  values: unknown[][] | Query | Expression;
}

export type WhereJsonPathEqualsItem = [
  leftColumn: string,
  leftPath: string,
  rightColumn: string,
  rightPath: string,
];

export interface WhereOnItem {
  joinFrom: WhereOnJoinItem;
  from: string;
  joinTo: WhereOnJoinItem;
  to: string;
  useOuterAliases?: true;
  op?: string;
}

export type WhereOnJoinItem = { table?: string; q: { as?: string } } | string;

export type SearchWeight = 'A' | 'B' | 'C' | 'D';

export interface SearchWeightRecord {
  [K: string]: SearchWeight;
}

export interface WhereSearchItem {
  as: string;
  vectorSQL: string;
}

export type SortDir = 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'DESC NULLS LAST';

export type OrderItem = string | { [K: string]: SortDir } | Expression;

export type HavingItem = TemplateLiteralArgs | Expression[];

export interface WindowItem {
  [K: string]: WindowDeclaration | Expression;
}

export interface WindowDeclaration {
  partitionBy?: SelectableOrExpression | SelectableOrExpression[];
  order?: OrderItem;
}

export interface UnionItem {
  a: Query | Expression;
  k: UnionKind;
  // true to not wrap the union member into parens.
  p?: boolean;
}

export interface UnionSet {
  b: Query;
  u: UnionItem[];
}

export type UnionKind =
  | 'UNION'
  | 'UNION ALL'
  | 'INTERSECT'
  | 'INTERSECT ALL'
  | 'EXCEPT'
  | 'EXCEPT ALL';

export type OnConflictTarget =
  | string
  | string[]
  | Expression
  | { constraint: string };

export type OnConflictSet = RecordUnknown | Expression;

export type OnConflictMerge = string | string[] | { except: string | string[] };
