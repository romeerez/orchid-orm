import { Column } from './column';
export declare const numberMethodNames: (keyof AdditionalNumberData)[];
export interface AdditionalNumberData {
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    step?: number;
    int?: boolean;
    finite?: boolean;
    safe?: boolean;
}
export interface BaseNumberData extends Column.Data, AdditionalNumberData {
}
export declare const stringMethodNames: (keyof AdditionalStringData)[];
export interface AdditionalStringData {
    min?: number;
    max?: number;
    length?: number;
    email?: boolean;
    url?: boolean;
    emoji?: boolean;
    uuid?: boolean;
    cuid?: boolean;
    cuid2?: boolean;
    ulid?: boolean;
    regex?: RegExp;
    includes?: string;
    startsWith?: string;
    endsWith?: string;
    datetime?: {
        offset?: boolean;
        precision?: number;
    };
    ipv4?: true;
    ipv6?: true;
    nonEmpty?: boolean;
    trim?: boolean;
    toLowerCase?: boolean;
    toUpperCase?: boolean;
}
export interface StringData extends Column.Data, AdditionalStringData {
}
export declare const dateMethodNames: (keyof AdditionalDateData)[];
export interface AdditionalDateData {
    min?: Date;
    max?: Date;
}
export interface DateColumnData extends Column.Data, AdditionalDateData {
}
export declare const arrayMethodNames: (keyof ArrayMethodsData)[];
export interface ArrayMethodsData {
    min?: number;
    max?: number;
    length?: number;
    nonEmpty?: boolean;
}
export interface ArrayMethodsDataForBaseColumn extends Column.Data, ArrayMethodsData {
}
