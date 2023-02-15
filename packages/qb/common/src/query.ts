// query metadata that is stored only on TS side, not available in runtime
export type QueryMetaBase = {
  as?: string;
  hasSelect?: true;
  hasWhere?: true;
};

export type QueryBaseCommon = {
  meta: QueryMetaBase;
};

export type QueryCommon = QueryBaseCommon;
