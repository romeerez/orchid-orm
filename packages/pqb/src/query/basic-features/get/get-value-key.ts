// Symbol that is used in the parsers in the query data for a column that doesn't have a name
// this is for the case when using query.get('column') or query.count() - it returns anonymous value
export type getValueKey = typeof getValueKey;
// Symbol that is used in the parsers in the query data for a column that doesn't have a name
// this is for the case when using query.get('column') or query.count() - it returns anonymous value
export const getValueKey = Symbol('get');
