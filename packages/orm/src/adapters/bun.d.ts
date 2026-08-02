import { OrmTableThunks, OrchidORM, OrchidORMBundle, OrchidOrmParam } from 'orchid-orm';
import { BunAdapterOptions, createDb as cdb } from 'pqb/bun';
import { DbSharedOptions, EmptyObject } from 'pqb/internal';
export { bunSchemaConfig } from 'pqb/bun';
export interface BunOrchidORMOptions extends BunAdapterOptions, DbSharedOptions {
    views?: OrmTableThunks;
}
export declare const Adapter: import("pqb/internal").DriverAdapter;
export declare const createDb: typeof cdb;
export declare const makeOrchidOrmDb: <T extends OrmTableThunks, V extends OrmTableThunks = EmptyObject>(orm: OrchidORMBundle<T, V>, { log, ...options }: OrchidOrmParam<BunOrchidORMOptions>) => OrchidORM<T, V>;
export declare const orchidORM: <T extends OrmTableThunks, V extends OrmTableThunks = EmptyObject>({ views, ...options }: OrchidOrmParam<BunOrchidORMOptions & {
    views?: V;
}>, tables: T) => OrchidORM<T, V>;
