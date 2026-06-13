import { bundleOrchidORMTables } from 'orchid-orm';
import { makeOrchidOrmDb, orchidORM } from './bun';
import { RecordUnknown } from 'pqb/index';

describe('bun', () => {
  beforeAll(() => {
    class SQL {
      static PostgresError = Error;
    }

    if (!process.versions.bun) {
      (globalThis as unknown as { Bun: { SQL: typeof SQL } }).Bun = { SQL };
    }
  });

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
