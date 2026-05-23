import { bundleOrchidORMTables } from 'orchid-orm';
import { makeOrchidOrmDb, orchidORM } from './postgres-js';
import { RecordUnknown } from 'pqb/index';

describe('postgres-js', () => {
  it('should not pass `log` param to the driver in makeOrchidOrmDb', () => {
    const orm = bundleOrchidORMTables({});
    const db = makeOrchidOrmDb(orm, {
      databaseURL: 'postgres://user:@host:123/db?ssl=false',
      log: true,
    });

    const adapter = db.$qb.adapterNotInTransaction as unknown as {
      config: RecordUnknown;
    };
    expect('log' in adapter.config).toBe(false);
  });

  it('should not pass `log` param to the driver', () => {
    const db = orchidORM(
      {
        databaseURL: 'postgres://user:@host:123/db?ssl=false',
        log: true,
      },
      {},
    );

    const adapter = db.$qb.adapterNotInTransaction as unknown as {
      config: RecordUnknown;
    };
    expect('log' in adapter.config).toBe(false);
  });
});
