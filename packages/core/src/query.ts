// query metadata that is stored only on TS side, not available in runtime
export type QueryMetaBase = {
  as?: string;
  hasSelect?: true;
  hasWhere?: true;
};

export type QueryInternal = {
  columnsForSelectAll?: string[];
};

export type QueryBaseCommon = {
  meta: QueryMetaBase;
  internal: QueryInternal;
};

export type QueryCommon = QueryBaseCommon;
