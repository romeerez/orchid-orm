export type QuerySchema = (() => string) | string;
interface HasQuerySchema {
    q: {
        schema?: QuerySchema;
    };
}
export declare const getQuerySchema: (query: HasQuerySchema) => string | undefined;
export declare class QueryWithSchema {
    /**
     * Specifies the schema to be used as a prefix of a table name.
     *
     * Though this method can be used to set the schema right when building the query,
     * it's better to specify schema when calling `db(table, () => columns, { schema: string })`
     *
     * ```ts
     * db.table.withSchema('customSchema').select('id');
     * ```
     *
     * Resulting SQL:
     *
     * ```sql
     * SELECT "user"."id" FROM "customSchema"."user"
     * ```
     *
     * You can set a **default** schema for all tables in a callback by using {@link $withOptions}.
     *
     * @param schema - a name of the database schema to use
     */
    withSchema<T>(this: T, schema: QuerySchema | undefined): T;
}
export {};
