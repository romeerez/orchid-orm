import type { RakeDbBaseTable, RakeDbDefineTable, RakeDbTableFactoryConfig } from './config';
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
export declare const getTableFactoryConfig: <CT>({ baseTable, defineTable, }: RakeDbTableFactoryConfigInput<CT>) => RakeDbTableFactoryConfig<CT> | undefined;
