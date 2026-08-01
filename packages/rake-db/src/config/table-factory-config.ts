import type {
  RakeDbBaseTable,
  RakeDbDefineTable,
  RakeDbTableFactoryConfig,
} from './config';

export interface RakeDbTableFactoryConfigInput<CT> {
  /**
   * Function-style table factory metadata.
   */
  defineTable?: RakeDbDefineTable<CT>;

  /**
   * Class-style base table metadata.
   */
  baseTable?: RakeDbBaseTable<CT>;
}

export const getTableFactoryConfig = <CT>({
  baseTable,
  defineTable,
}: RakeDbTableFactoryConfigInput<CT>):
  | RakeDbTableFactoryConfig<CT>
  | undefined => {
  if (baseTable && defineTable) {
    throw new Error('Configure either baseTable or defineTable, not both');
  }

  if (defineTable) {
    if (!defineTable.types) {
      throw new Error('defineTable is missing types');
    }
    if (!defineTable.exportAs) {
      throw new Error('defineTable is missing exportAs');
    }
    if (typeof defineTable.getFilePath !== 'function') {
      throw new Error('defineTable is missing getFilePath');
    }

    return {
      columnTypes: defineTable.types,
      exportAs: defineTable.exportAs,
      getFilePath: defineTable.getFilePath,
      nowSQL: defineTable.nowSQL,
      snakeCase: defineTable.snakeCase,
      language: defineTable.language,
    };
  }

  if (baseTable) {
    const { types, snakeCase, language } = baseTable.prototype || {};

    return {
      columnTypes: types as CT,
      exportAs: baseTable.exportAs,
      getFilePath: baseTable.getFilePath,
      nowSQL: baseTable.nowSQL,
      snakeCase,
      language,
    };
  }

  return undefined;
};
