import { ColumnType, ColumnTypesBase } from 'pqb';

export const getColumnsByTypesMap = (types: ColumnTypesBase) => {
  const map: Record<string, new () => ColumnType> = {};
  for (const key in types) {
    const type = types[key] as unknown as new () => ColumnType;
    if (type instanceof ColumnType) {
      map[type.dataType] = type;
      if (type.typeAlias) {
        map[type.typeAlias] = type;
      }
    }
  }
  return map;
};
