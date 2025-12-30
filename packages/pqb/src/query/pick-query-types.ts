import { EmptyObject } from '../utils';
import { RelationsBase } from './relations';
import { Column } from '../columns/column';
import { QueryMetaBase } from './query-meta';
import {
  IsQueries,
  IsQuery,
  Query,
  QueryInternal,
  QueryReturnType,
} from './query';
import { WithDataItems } from './basic-features/cte/cte.sql';
import { QueryData } from './query-data';

export interface PickQueryTable {
  table?: string;
}

export interface PickQueryMeta {
  meta: QueryMetaBase;
}

export interface PickQueryResult {
  result: Column.QueryColumns;
}

export interface PickQueryShape {
  shape: Column.QueryColumns;
}

export interface PickQueryReturnType {
  returnType: QueryReturnType;
}

export interface PickQueryResultReturnType
  extends PickQueryResult,
    PickQueryReturnType {}

export interface PickQueryMetaShape extends PickQueryMeta, PickQueryShape {}

export interface PickQueryMetaResult extends PickQueryMeta, PickQueryResult {}

export interface PickQueryResultUniqueColumns extends PickQueryResult {
  internal: {
    uniqueColumns: unknown;
  };
}

export interface PickQueryResultReturnTypeUniqueColumns
  extends PickQueryResultUniqueColumns,
    PickQueryReturnType {}

export interface PickQueryUniqueProperties {
  internal: {
    uniqueColumnNames: unknown;
    uniqueColumnTuples: unknown;
    uniqueConstraints: unknown;
  };
}

export interface PickQueryMetaResultWindows extends PickQueryMetaResult {
  windows: EmptyObject;
}

export interface PickQueryTableMetaResult
  extends PickQueryTable,
    PickQueryMetaResult {}

export interface PickQueryInputType {
  inputType: unknown;
}

export interface PickQueryTableMetaResultInputType
  extends PickQueryTableMetaResult,
    PickQueryInputType {}

export interface PickQueryTableMetaShape
  extends PickQueryTable,
    PickQueryMetaShape {}

export interface PickQueryTableMetaResultShape
  extends PickQueryTableMetaResult,
    PickQueryMetaShape {}

export interface PickQueryMetaReturnType
  extends PickQueryMeta,
    PickQueryReturnType {}

export interface PickQueryMetaResultReturnType
  extends PickQueryMetaResult,
    PickQueryReturnType {}

export interface PickQueryWithData {
  withData: WithDataItems;
}

export interface PickQueryWindows {
  windows: EmptyObject;
}

export interface PickQueryRelations {
  relations: RelationsBase;
}

export interface PickQueryRelationQueries {
  relationQueries: IsQueries;
}

export interface PickQueryMetaRelations
  extends PickQueryMeta,
    PickQueryRelations {}

export interface PickQueryMetaRelationsResult
  extends PickQueryMetaRelations,
    PickQueryResult {}

export interface PickQueryMetaRelationsReturnType
  extends PickQueryMetaRelationsResult,
    PickQueryResultReturnType {}

export interface PickQueryMetaShapeRelationsReturnType
  extends PickQueryMetaRelationsReturnType,
    PickQueryShape {}

export interface PickQueryMetaRelationsResultReturnType
  extends PickQueryMetaRelationsReturnType,
    PickQueryResult {}

export interface PickQueryMetaResultRelations
  extends PickQueryResult,
    PickQueryMeta,
    PickQueryRelations {}

export interface PickQueryMetaResultRelationsWindows
  extends PickQueryMetaResultRelations,
    PickQueryWindows {}

export interface PickQueryColumTypes {
  columnTypes: unknown;
}

export interface PickQueryMetaColumnTypes
  extends PickQueryMeta,
    PickQueryColumTypes {}

export interface PickQueryMetaResultRelationsWindowsColumnTypes
  extends PickQueryMetaResultRelationsWindows,
    PickQueryColumTypes {}

export interface PickQueryWithDataColumnTypes
  extends PickQueryWithData,
    PickQueryColumTypes {}

export interface PickQueryResultColumnTypes
  extends PickQueryResult,
    PickQueryColumTypes {}

export interface PickQueryMetaWithDataColumnTypes
  extends PickQueryMeta,
    PickQueryWithData,
    PickQueryColumTypes {}

export interface PickQueryAs {
  __as: string;
}

export interface PickQueryMetaResultAs
  extends PickQueryMetaResult,
    PickQueryAs {}

export interface PickQueryMetaShapeAs extends PickQueryMetaShape, PickQueryAs {}

export interface PickQueryTableMetaShapeAs
  extends PickQueryTableMetaShape,
    PickQueryAs {}

export interface PickQueryMetaResultShapeAs
  extends PickQueryMetaResult,
    PickQueryShape,
    PickQueryAs {}

export interface PickQueryMetaShapeRelationsWithDataAs
  extends PickQueryMetaShapeRelationsWithData,
    PickQueryAs {}

export interface PickQueryMetaResultRelationsWithDataReturnTypeShapeAs
  extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    PickQueryAs {}

export interface PickQueryMetaShapeReturnTypeWithDataAs
  extends PickQueryMetaShape,
    PickQueryMetaReturnType,
    PickQueryWithData,
    PickQueryAs {}

export interface PickQueryMetaResultInputTypeAs
  extends PickQueryMetaResult,
    PickQueryInputType,
    PickQueryAs {}

export interface PickQueryResultAs extends PickQueryResult, PickQueryAs {}

export interface PickQueryShapeAs extends PickQueryShape, PickQueryAs {}

export interface PickQueryMetaTable extends PickQueryMeta, PickQueryTable {}

export interface PickQueryMetaTableShape
  extends PickQueryMetaTable,
    PickQueryShape {}

export interface PickQueryMetaWithData
  extends PickQueryMeta,
    PickQueryWithData {}

export interface PickQueryRelationsWithData
  extends PickQueryWithData,
    PickQueryRelations {}

export interface PickQueryMetaShapeRelationsWithData
  extends PickQueryMeta,
    PickQueryShape,
    PickQueryRelations,
    PickQueryWithData {}

export interface PickQueryMetaResultRelationsWithDataReturnType
  extends PickQueryMeta,
    PickQueryResult,
    PickQueryRelations,
    PickQueryWithData,
    PickQueryReturnType {}

export interface PickQueryMetaTableShapeReturnTypeWithData
  extends PickQueryMetaTableShape,
    PickQueryReturnType,
    PickQueryMetaWithData {}

export interface PickQueryMetaResultRelationsWithDataReturnTypeShape
  extends PickQueryMetaResultRelationsWithDataReturnType,
    PickQueryShape {}

export interface PickQueryMetaResultReturnTypeWithDataWindows
  extends PickQueryMetaResultReturnType,
    PickQueryWithData,
    PickQueryWindows {}

export interface PickQueryMetaResultReturnTypeWithDataWindowsThen
  extends PickQueryMetaResultReturnTypeWithDataWindows {
  then: unknown;
}

export interface PickQueryTableMetaResultReturnTypeWithDataWindowsThen
  extends PickQueryMetaResultReturnTypeWithDataWindowsThen,
    PickQueryTable {}

export interface PickQuerySinglePrimaryKey {
  internal: {
    singlePrimaryKey: unknown;
  };
}

export interface PickQueryShapeSinglePrimaryKey
  extends PickQueryShape,
    PickQuerySinglePrimaryKey {}

export interface PickQueryShapeResultSinglePrimaryKey
  extends PickQueryShapeSinglePrimaryKey,
    PickQueryResult {}

export interface PickQueryShapeResultReturnTypeSinglePrimaryKey
  extends PickQueryShapeResultSinglePrimaryKey,
    PickQueryReturnType {}

export interface PickQueryQ {
  q: QueryData;
}

export interface PickQueryInternal {
  internal: QueryInternal;
}

export interface PickQueryBaseQuery {
  baseQuery: Query;
}

export interface PickQueryQAndInternal
  extends IsQuery,
    PickQueryQ,
    PickQueryInternal {}

export interface PickQueryQAndBaseQuery
  extends PickQueryQ,
    PickQueryBaseQuery {}
