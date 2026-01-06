import { EmptyObject, RecordUnknown } from '../utils';
import { RelationsBase } from './relations';
import { Column } from '../columns/column';
import { QueryMetaBase, QuerySelectable } from './query-meta';
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

export interface PickQueryThen {
  then: unknown;
}

export interface PickQueryHasSelect {
  __hasSelect: boolean;
}

export interface PickQueryHasSelectResultReturnType
  extends PickQueryHasSelect,
    PickQueryResult,
    PickQueryReturnType {}

export interface PickQueryHasSelectResultShapeAs
  extends PickQueryHasSelect,
    PickQueryResult,
    PickQueryShape,
    PickQueryAs {}

export interface PickQueryMetaHasSelectResultReturnType
  extends PickQueryMeta,
    PickQueryHasSelect,
    PickQueryResult,
    PickQueryReturnType {}

export interface PickQueryHasSelectResult
  extends PickQueryHasSelect,
    PickQueryResult {}

export interface PickQuerySelectable {
  __selectable: QuerySelectable;
}

export interface PickQueryMetaSelectable
  extends PickQueryMeta,
    PickQuerySelectable {}

export interface PickQuerySelectableResult
  extends PickQuerySelectable,
    PickQueryResult {}

export interface PickQueryMetaSelectableResult
  extends PickQueryMeta,
    PickQuerySelectable,
    PickQueryResult {}

export interface PickQuerySelectableRelations
  extends PickQuerySelectable,
    PickQueryRelations {}

export interface PickQuerySelectableRelationsResultReturnType
  extends PickQuerySelectableRelations,
    PickQueryResult,
    PickQueryReturnType {}

export interface PickQuerySelectableResultWindows
  extends PickQueryMetaSelectableResult,
    PickQueryWindows {}

export interface PickQueryMetaSelectableResultRelationsWindows
  extends PickQueryMetaSelectableResult,
    PickQueryRelations,
    PickQueryWindows {}

export interface PickQueryMetaSelectableResultRelationsWindowsColumnTypes
  extends PickQueryMetaSelectableResultRelationsWindows,
    PickQueryColumTypes {}

export interface PickQuerySelectableShapeAs
  extends PickQuerySelectable,
    PickQueryShape,
    PickQueryAs {}

export interface PickQueryTableMetaShapeTableAs
  extends PickQuerySelectableShapeAs,
    PickQueryTable {}

export interface PickQuerySelectableShapeRelationsWithData
  extends PickQuerySelectable,
    PickQueryShape,
    PickQueryRelations,
    PickQueryWithData {}

export interface PickQuerySelectableShapeRelationsWithDataAs
  extends PickQuerySelectableShapeRelationsWithData,
    PickQueryAs {}

export interface PickQuerySelectableShapeRelationsWithDataAsResultReturnType
  extends PickQuerySelectableShapeRelationsWithDataAs,
    PickQueryResult,
    PickQueryReturnType {}

export interface PickQuerySelectableResultReturnType
  extends PickQuerySelectable,
    PickQueryResult,
    PickQueryReturnType {}

export interface PickQuerySelectableResultRelationsWithDataReturnType
  extends PickQuerySelectable,
    PickQueryResult,
    PickQueryRelations,
    PickQueryWithData,
    PickQueryReturnType {}

export interface PickQuerySelectableResultRelationsWithDataReturnTypeShapeAs
  extends PickQuerySelectableResultRelationsWithDataReturnType,
    PickQueryShape,
    PickQueryAs {}

export interface PickQuerySelectableShape
  extends PickQuerySelectable,
    PickQueryShape {}

export interface PickQuerySelectableColumnTypes
  extends PickQuerySelectable,
    PickQueryColumTypes {}

export interface PickQueryMetaSelectableShapeRelationsReturnType
  extends PickQueryMeta,
    PickQuerySelectable,
    PickQueryShape,
    PickQueryRelations,
    PickQueryReturnType {}

export interface PickQueryMetaSelectableReturnType
  extends PickQueryMeta,
    PickQuerySelectable,
    PickQueryReturnType {}

export interface PickQueryMetaSelectableResultInputTypeAs
  extends PickQueryMetaResult,
    PickQuerySelectable,
    PickQueryInputType,
    PickQueryAs {}

export interface PickQuerySelectableResultAs
  extends PickQuerySelectable,
    PickQueryResult,
    PickQueryAs {}

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

export interface PickQueryTableMetaResult
  extends PickQueryTable,
    PickQueryMetaResult {}

export interface PickQueryInputType {
  inputType: RecordUnknown;
}

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

export interface PickQueryColumTypes {
  columnTypes: unknown;
}

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

export interface PickQueryMetaSelectableResultRelationsWithDataReturnTypeShapeAs
  extends PickQueryMetaResultRelationsWithDataReturnTypeShape,
    PickQuerySelectable,
    PickQueryAs {}

export interface PickQueryResultAs extends PickQueryResult, PickQueryAs {}

export interface PickQueryShapeAs extends PickQueryShape, PickQueryAs {}

export interface PickQueryRelationsWithData
  extends PickQueryWithData,
    PickQueryRelations {}

export interface PickQueryMetaResultRelationsWithDataReturnType
  extends PickQueryMeta,
    PickQueryResult,
    PickQueryRelations,
    PickQueryWithData,
    PickQueryReturnType {}

export interface PickQueryMetaResultRelationsWithDataReturnTypeShape
  extends PickQueryMetaResultRelationsWithDataReturnType,
    PickQueryShape {}

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
