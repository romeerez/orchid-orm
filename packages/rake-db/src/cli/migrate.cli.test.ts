import { migrateCommand, redoCommand, rollbackCommand } from './migrate.cli';
import { testConfig } from '../rake-db.test-utils';
import { migrate } from 'rake-db';
import { TestAdapter } from 'test-utils';
import { redo, rollback } from '../commands/migrate-or-rollback';

jest.mock('../commands/migrate-or-rollback', () => ({
  migrate: jest.fn(),
  rollback: jest.fn(),
  redo: jest.fn(),
}));

const adapters = [new TestAdapter({}), new TestAdapter({})];

describe('migrate commands', () => {
  beforeEach(jest.clearAllMocks);

  describe('migrate', () => {
    it('should handle the force arg', async () => {
      await migrateCommand(adapters, testConfig, ['force']);

      for (const adapter of adapters) {
        expect(migrate).toHaveBeenCalledWith(adapter, testConfig, {
          ctx: {},
          force: true,
        });
      }
    });

    it('should handle the count arg', async () => {
      await migrateCommand(adapters, testConfig, ['123']);

      for (const adapter of adapters) {
        expect(migrate).toHaveBeenCalledWith(adapter, testConfig, {
          ctx: {},
          count: 123,
        });
      }
    });

    it('should call migrate function', async () => {
      await migrateCommand(adapters, testConfig, []);

      for (const adapter of adapters) {
        expect(migrate).toHaveBeenCalledWith(adapter, testConfig, {
          ctx: {},
        });
      }
    });
  });

  describe('rollback', () => {
    it('should call rollback function', async () => {
      await rollbackCommand(adapters, testConfig, []);

      for (const adapter of adapters) {
        expect(rollback).toHaveBeenCalledWith(adapter, testConfig, {
          ctx: {},
        });
      }
    });

    it('should handle the all arg', async () => {
      await rollbackCommand(adapters, testConfig, ['all']);

      for (const adapter of adapters) {
        expect(rollback).toHaveBeenCalledWith(adapter, testConfig, {
          ctx: {},
          count: Infinity,
        });
      }
    });
  });

  describe('redo', () => {
    it('should call redo function', async () => {
      await redoCommand(adapters, testConfig, []);

      for (const adapter of adapters) {
        expect(redo).toHaveBeenCalledWith(adapter, testConfig, {
          ctx: {},
        });
      }
    });
  });
});
