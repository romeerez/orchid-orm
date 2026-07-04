import {
  clearChanges,
  createMigrationChangeFn,
  getCurrentChanges,
  MigrationChangeFn,
  pushChange,
} from './change';
import { assertType } from 'test-utils';

describe('change', () => {
  it('should push, get and clear changes', () => {
    pushChange({ fn: async () => {}, config: {} as never });
    expect(getCurrentChanges().length).toBe(1);
    clearChanges();
    expect(getCurrentChanges().length).toBe(0);
  });

  describe('createMigrationChangeFn', () => {
    it('should capture columnTypes type', () => {
      const change = createMigrationChangeFn({
        columnTypes: 'some type' as const,
      });

      assertType<typeof change, MigrationChangeFn<'some type'>>();
    });
  });
});
