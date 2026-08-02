import { OrmTableThunks, OrchidORM, OrchidORMBundle, OrchidOrmParam } from 'orchid-orm';
import { PostgresJsAdapterOptions, createDb as cdb } from 'pqb/postgres-js';
import { DbSharedOptions, EmptyObject } from 'pqb/internal';
export interface PostgresJsOrchidORMOptions extends PostgresJsAdapterOptions, DbSharedOptions {
    views?: OrmTableThunks;
}
export declare const Adapter: import("pqb/internal").DriverAdapter;
export declare const createDb: typeof cdb;
export declare const makeOrchidOrmDb: <T extends OrmTableThunks, V extends OrmTableThunks = EmptyObject>(orm: OrchidORMBundle<T, V>, { log, ...options }: OrchidOrmParam<PostgresJsOrchidORMOptions>) => OrchidORM<T, V>;
export declare const orchidORM: <T extends OrmTableThunks, V extends OrmTableThunks = EmptyObject>({ views, ...options }: OrchidOrmParam<PostgresJsOrchidORMOptions & {
    views?: V;
}>, tables: T) => OrchidORM<T, V>;
