import { IsQuery, QueryOrExpression, QueryReturnType, ReturnsQueryOrExpression } from '../../query';
import { Column } from '../../../columns';
import { Expression } from '../../expressions/expression';
import { EmptyObject, FnUnknownToUnknown, MaybePromise, RecordString } from '../../../utils';
import { RelationsBase } from '../../relations';
import { QueryBatchResult } from '../../basic-features/select/select.utils';
import { QueryExpressions } from '../../expressions/query-expressions';
import { QuerySql } from '../../sql/sql';
import { QueryData } from '../../query-data';
import { ColumnDataSelectSqlProp } from '../select-sql/select-sql';
export interface ColumnDataComputedProp extends ColumnDataSelectSqlProp {
    computed?: Expression;
}
export type ComputedColumnsFromOptions<Shape, Options> = Options extends {
    computed: (...args: any) => infer R;
} ? {
    [K in (keyof Shape | keyof R) & string]: K extends keyof Shape ? Shape[K] : K extends keyof R ? R[K] extends QueryOrExpression<unknown> ? R[K]['result']['value'] : R[K] extends () => {
        result: {
            value: infer Value extends Column.Pick.QueryColumn;
        };
    } ? Value : never : never;
} : Shape;
export interface ComputedOptionsConfig {
    [K: string]: QueryOrExpression<unknown> | ReturnsQueryOrExpression<unknown>;
}
export type ComputedOptionsFactory<ColumnTypes, Shape extends Column.QueryColumns> = (t: ComputedMethods<ColumnTypes, Shape>) => ComputedOptionsConfig;
export interface RuntimeComputedQueryColumn<OutputType> extends Column.Pick.QueryColumn {
    dataType: 'runtimeComputed';
    __type: never;
    __outputType: OutputType;
    __queryType: undefined;
    operators: {
        cannotQueryRuntimeComputed: never;
    };
}
export interface ComputedMethods<ColumnTypes, Shape extends Column.QueryColumns> extends QueryComputedArg<ColumnTypes, Shape> {
    computeAtRuntime<Deps extends keyof Shape, OutputType>(dependsOn: Deps[], fn: (record: {
        [K in keyof Shape & Deps]: Shape[K]['__outputType'];
    }) => OutputType): {
        result: {
            value: RuntimeComputedQueryColumn<OutputType>;
        };
    };
    computeBatchAtRuntime<Deps extends keyof Shape, OutputType>(dependsOn: Deps[], fn: (record: {
        [K in keyof Shape & Deps]: Shape[K]['__outputType'];
    }[]) => MaybePromise<OutputType[]>): {
        result: {
            value: RuntimeComputedQueryColumn<OutputType>;
        };
    };
}
export declare class ComputedColumn {
    kind: 'one' | 'many';
    deps: string[];
    fn: FnUnknownToUnknown;
    constructor(kind: 'one' | 'many', deps: string[], fn: FnUnknownToUnknown);
}
export interface ComputedColumns {
    [K: string]: ComputedColumn;
}
export interface QueryComputedArg<ColumnTypes, Shape extends Column.QueryColumns> extends QueryExpressions, QuerySql<ColumnTypes> {
    shape: Shape;
    columnTypes: ColumnTypes;
    windows: EmptyObject;
    relations: RelationsBase;
    result: EmptyObject;
    __selectable: {
        [K in keyof Shape]: {
            as: string;
            column: Column.Pick.QueryColumn;
        };
    };
}
export declare const applyComputedColumns: (q: IsQuery, fn: ComputedOptionsFactory<never, never>) => void;
export declare const processComputedResult: (query: QueryData, result: unknown) => Promise<void[]> | undefined;
export declare const processComputedBatches: (query: QueryData, batches: QueryBatchResult[], originalReturnType: QueryReturnType, returnType: QueryReturnType, tempColumns: Set<string> | undefined, renames: RecordString | undefined, key: string) => Promise<void> | undefined;
