import { orchidORMWithAdapter } from 'orchid-orm';
import { createDbWithAdapter } from 'pqb';
import { testAdapter } from 'test-utils';
import { handleConfigLogger } from './config-logger';

const makeLogger = () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('handleConfigLogger', () => {
  describe('$qb in db', () => {
    it('should inherit a logger from ORM query logging', () => {
      const logger = makeLogger();
      const db = orchidORMWithAdapter(
        { adapter: testAdapter, log: true, logger },
        {},
      );

      expect(handleConfigLogger({}, db)).toEqual({
        log: db.$qb.q.log,
        logger,
      });
    });

    it('should not inherit a logger when ORM query logging is disabled', () => {
      const logger = makeLogger();
      const db = orchidORMWithAdapter(
        { adapter: testAdapter, log: false, logger },
        {},
      );

      expect(handleConfigLogger({}, db)).toEqual({
        log: db.$qb.q.log,
        logger: undefined,
      });
    });
  });

  describe('q in db', () => {
    it('should inherit a logger from direct db query logging', () => {
      const logger = makeLogger();
      const db = createDbWithAdapter({
        adapter: testAdapter,
        log: true,
        logger,
      });

      expect(handleConfigLogger({}, db)).toEqual({
        log: db.q.log,
        logger,
      });
    });

    it('should not inherit a logger when direct db query logging is disabled', () => {
      const logger = makeLogger();
      const db = createDbWithAdapter({
        adapter: testAdapter,
        log: false,
        logger,
      });

      expect(handleConfigLogger({}, db)).toEqual({
        log: db.q.log,
        logger: undefined,
      });
    });
  });
});
