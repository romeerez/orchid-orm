import { OrmTableThunks, OrchidORM, OrchidORMBundle, OrchidOrmParam } from 'orchid-orm';
import { NodePostgresAdapterOptions, createDb as cdb } from 'pqb/node-postgres';
import { DbSharedOptions, EmptyObject } from 'pqb/internal';
export { nodePostgresSchemaConfig } from 'pqb/node-postgres';
export declare const Adapter: import("pqb/internal").DriverAdapter;
export declare const createDb: typeof cdb;
export interface NodePostgresOrchidORMOptions extends NodePostgresAdapterOptions, DbSharedOptions {
    views?: OrmTableThunks;
}
export declare const makeOrchidOrmDb: <T extends OrmTableThunks, V extends OrmTableThunks = EmptyObject>(orm: OrchidORMBundle<T, V>, { log, ...options }: OrchidOrmParam<NodePostgresAdapterOptions & DbSharedOptions>) => OrchidORM<T, V>;
export declare const orchidORM: <T extends OrmTableThunks, V extends OrmTableThunks = EmptyObject>({ views, ...options }: OrchidOrmParam<NodePostgresOrchidORMOptions & {
    views?: V;
}>, tables: T) => OrchidORM<T, V>;
