import { Column } from './column';
import { OperatorsAny } from './operators';
import { ShallowSimplify } from '../utils';
export interface ColumnsShape {
    [K: string]: Column;
}
export declare namespace ColumnsShape {
    export type DefaultSelectKeys<S extends Column.QueryColumnsInit> = {
        [K in keyof S]: S[K]['data']['explicitSelect'] extends true | undefined ? never : K;
    }[keyof S];
    export type DefaultOutput<Set extends Column.QueryColumnsInit> = {
        [K in DefaultSelectKeys<Set>]: Set[K]['__outputType'];
    };
    export type Input<Shape extends Column.QueryColumnsInit, AppReadOnly = {
        [K in keyof Shape]: Shape[K]['data']['appReadOnly'] extends true ? K : never;
    }[keyof Shape], Optional extends keyof Shape = {
        [K in keyof Shape]: Shape[K]['data']['optional'] extends true ? K : never;
    }[keyof Shape]> = {
        [K in Exclude<keyof Shape, AppReadOnly | Optional>]: Shape[K]['__inputType'];
    } & {
        [K in Exclude<Optional, AppReadOnly>]?: Shape[K]['__inputType'];
    };
    export type InputPartial<Shape extends Column.QueryColumnsInit> = {
        [K in keyof Shape]?: Shape[K]['__inputType'];
    };
    export type Output<Shape extends Column.QueryColumns> = {
        [K in keyof Shape]: Shape[K]['__outputType'];
    };
    export type DefaultSelectOutput<Shape extends Column.QueryColumnsInit> = {
        [K in {
            [K in keyof Shape]: Shape[K]['data']['explicitSelect'] extends true | undefined ? never : K;
        }[keyof Shape]]: Shape[K]['__outputType'];
    };
    export interface MapToObjectColumn<Shape extends Column.QueryColumns> {
        dataType: 'object';
        __type: {
            [K in keyof Shape]: Shape[K]['__type'];
        };
        __outputType: ShallowSimplify<ObjectOutput<Shape>>;
        __queryType: {
            [K in keyof Shape]: Shape[K]['__queryType'];
        };
        operators: OperatorsAny;
    }
    export interface MapToNullableObjectColumn<Shape extends Column.QueryColumns> {
        dataType: 'object';
        __type: {
            [K in keyof Shape]: Shape[K]['__type'];
        };
        __outputType: ShallowSimplify<ObjectOutput<Shape>> | undefined;
        __queryType: {
            [K in keyof Shape]: Shape[K]['__queryType'];
        } | null;
        operators: OperatorsAny;
    }
    export interface MapToPluckColumn<Shape extends Column.QueryColumns> {
        dataType: 'array';
        __type: Shape['pluck']['__type'][];
        __outputType: Shape['pluck']['__outputType'][];
        __queryType: Shape['pluck']['__queryType'][];
        operators: OperatorsAny;
    }
    export interface MapToObjectArrayColumn<Shape extends Column.QueryColumns> {
        dataType: 'array';
        __type: {
            [K in keyof Shape]: Shape[K]['__type'];
        }[];
        __outputType: ShallowSimplify<ObjectOutput<Shape>>[];
        __queryType: {
            [K in keyof Shape]: Shape[K]['__queryType'];
        }[];
        operators: OperatorsAny;
    }
    type ObjectOutput<Shape extends Column.QueryColumns> = {
        [K in keyof Shape]: Shape[K]['__outputType'];
    };
    export {};
}
