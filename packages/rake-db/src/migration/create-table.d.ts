import { ColumnsShape, TableDataFn, TableDataItem, MaybeArray, QueryResult, RecordUnknown } from 'pqb/internal';
import { ColumnsShapeCallback, Migration, TableOptions } from './migration';
import { TableMethods } from './table-methods';
import { Db } from 'pqb';
export interface TableQuery {
    text: string;
    values?: unknown[];
    then?(result: QueryResult): void;
}
export interface CreateTableResult<Table extends string, Shape extends ColumnsShape> {
    table: Db<Table, Shape>;
}
export declare const createTable: <CT, Table extends string, Shape extends ColumnsShape>(migration: Migration<CT>, tableMethods: TableMethods, up: boolean, tableName: Table, first?: TableOptions | ColumnsShapeCallback<CT, Shape>, second?: ColumnsShapeCallback<CT, Shape> | TableDataFn<RecordUnknown, MaybeArray<TableDataItem>>, third?: TableDataFn<RecordUnknown, MaybeArray<TableDataItem>>) => Promise<CreateTableResult<Table, Shape>>;
