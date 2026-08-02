export interface PostgresInterval {
    years: number;
    months: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
}
export declare const parseInterval: (str: string) => PostgresInterval;
