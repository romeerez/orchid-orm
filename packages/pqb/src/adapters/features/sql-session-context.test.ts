import { db } from 'test-utils';
import { OrchidOrmInternalError } from '../../query/errors';
import {
  SqlSessionState,
  sqlSessionContextBuildConfigRestoreBatchSql,
  sqlSessionContextComputeSetup,
  sqlSessionContextExecute,
  sqlSessionContextHasState,
} from './sql-session-context';

describe('adapter.utils', () => {
  describe('sqlSessionContextComputeSetup', () => {
    it('should return setup result for role only', () => {
      const desired: SqlSessionState = { role: 'app_user' };
      const result = sqlSessionContextComputeSetup(desired);

      expect(result).toEqual({
        roleSetupSql: 'SET ROLE "app_user"',
        captureRoleSql: 'SELECT current_user',
      });
    });

    it('should escape double quotes in role identifier', () => {
      const desired: SqlSessionState = { role: 'app"user' };
      const result = sqlSessionContextComputeSetup(desired);

      expect(result).toEqual({
        roleSetupSql: 'SET ROLE "app""user"',
        captureRoleSql: 'SELECT current_user',
      });
    });

    it('should return setup result for setConfig only', () => {
      const desired: SqlSessionState = {
        setConfig: { 'app.tenant_id': 'tenant123' },
      };
      const result = sqlSessionContextComputeSetup(desired);

      expect(result).toEqual({
        configSetupSql: `SELECT set_config('app.tenant_id', 'tenant123', false) as "app.tenant_id"`,
        captureConfigSql: 'SELECT current_setting($1, true) as "app.tenant_id"',
        captureConfigValues: ['app.tenant_id'],
      });
    });

    it('should return setup result for both role and setConfig', () => {
      const desired: SqlSessionState = {
        role: 'app_user',
        setConfig: {
          'app.tenant_id': 'tenant123',
          'app.user_id': 'user456',
        },
      };
      const result = sqlSessionContextComputeSetup(desired);

      expect(result).toEqual({
        roleSetupSql: 'SET ROLE "app_user"',
        captureRoleSql: 'SELECT current_user',
        configSetupSql: `SELECT set_config('app.tenant_id', 'tenant123', false) as "app.tenant_id", set_config('app.user_id', 'user456', false) as "app.user_id"`,
        captureConfigSql:
          'SELECT current_setting($1, true) as "app.tenant_id", current_setting($2, true) as "app.user_id"',
        captureConfigValues: ['app.tenant_id', 'app.user_id'],
      });
    });
  });

  describe('sqlSessionContextBuildConfigRestoreBatchSql', () => {
    it('should build single SELECT with set_config for string value', () => {
      const sql = sqlSessionContextBuildConfigRestoreBatchSql({
        'app.tenant_id': 'previous_value',
      });
      expect(sql).toBe(
        `SELECT set_config('app.tenant_id', 'previous_value', false) as "app.tenant_id"`,
      );
    });

    it('should build single SELECT with set_config empty string for null value', () => {
      const sql = sqlSessionContextBuildConfigRestoreBatchSql({
        'app.tenant_id': null,
      });
      expect(sql).toBe(
        `SELECT set_config('app.tenant_id', '', false) as "app.tenant_id"`,
      );
    });

    it('should build batch SELECT including null values as empty string', () => {
      const sql = sqlSessionContextBuildConfigRestoreBatchSql({
        'app.tenant_id': 'tenant123',
        'app.user_id': 'user456',
        'app.org_id': null,
      });
      expect(sql).toBe(
        `SELECT set_config('app.tenant_id', 'tenant123', false) as "app.tenant_id", ` +
          `set_config('app.user_id', 'user456', false) as "app.user_id", ` +
          `set_config('app.org_id', '', false) as "app.org_id"`,
      );
    });

    it('should escape single quotes in keys', () => {
      const sql = sqlSessionContextBuildConfigRestoreBatchSql({
        "app.key'with'quotes": 'value',
      });
      expect(sql).toBe(
        `SELECT set_config('app.key''with''quotes', 'value', false) as "app.key'with'quotes"`,
      );
    });

    it('should escape single quotes in values', () => {
      const sql = sqlSessionContextBuildConfigRestoreBatchSql({
        'app.key': "val'ue",
      });
      expect(sql).toBe(
        `SELECT set_config('app.key', 'val''ue', false) as "app.key"`,
      );
    });

    it('should return undefined for empty config', () => {
      const sql = sqlSessionContextBuildConfigRestoreBatchSql({});
      expect(sql).toBeUndefined();
    });
  });

  describe('sqlSessionContextHasState', () => {
    it('should return true when role is defined', () => {
      expect(sqlSessionContextHasState({ role: 'app_user' })).toBe(true);
    });

    it('should return true when setConfig has entries', () => {
      expect(sqlSessionContextHasState({ setConfig: { key: 'value' } })).toBe(
        true,
      );
    });

    it('should return true when both role and setConfig are defined', () => {
      expect(
        sqlSessionContextHasState({
          role: 'app_user',
          setConfig: { key: 'val' },
        }),
      ).toBe(true);
    });
  });

  describe('sqlSessionContextExecute', () => {
    it('should execute main query directly when no setup', async () => {
      const mainResult = { rows: [{ id: 1 }], rowCount: 1, fields: [] };
      const mainQuery = jest.fn().mockResolvedValue(mainResult);
      const mockQuery = jest.fn();

      const result = await sqlSessionContextExecute(
        mockQuery,
        undefined,
        mainQuery,
      );

      expect(result).toBe(mainResult);
      expect(mainQuery).toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should setup role and restore after main query', async () => {
      const mainResult = { rows: [{ id: 1 }], rowCount: 1, fields: [] };
      const mainQuery = jest.fn().mockResolvedValue(mainResult);
      const mockQuery = jest
        .fn()
        .mockResolvedValue({ rows: [['old_role']], rowCount: 1, fields: [] });

      const setup = {
        roleSetupSql: 'SET ROLE "test_role"',
        captureRoleSql: 'SELECT current_user',
      };

      const result = await sqlSessionContextExecute(
        mockQuery,
        setup,
        mainQuery,
      );

      expect(result).toBe(mainResult);
      expect(mockQuery).toHaveBeenCalledWith('SELECT current_user');
      expect(mockQuery).toHaveBeenCalledWith('SET ROLE "test_role"');
      expect(mockQuery).toHaveBeenCalledWith('SET ROLE "old_role"');
      expect(mainQuery).toHaveBeenCalled();
    });

    it('should setup config and restore after main query', async () => {
      const mainResult = { rows: [{ id: 1 }], rowCount: 1, fields: [] };
      const mainQuery = jest.fn().mockResolvedValue(mainResult);
      const mockQuery = jest
        .fn()
        .mockResolvedValue({ rows: [['old_value']], rowCount: 1, fields: [] });

      const setup = {
        configSetupSql: `SELECT set_config('app.key', 'new_value', false) as "app.key"`,
        captureConfigSql: 'SELECT current_setting($1, true) as "app.key"',
        captureConfigValues: ['app.key'],
      };

      const result = await sqlSessionContextExecute(
        mockQuery,
        setup,
        mainQuery,
      );

      expect(result).toBe(mainResult);
      expect(mockQuery).toHaveBeenCalledWith(setup.captureConfigSql, [
        'app.key',
      ]);
      expect(mockQuery).toHaveBeenCalledWith(setup.configSetupSql);
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT set_config('app.key', 'old_value', false) as "app.key"`,
      );
      expect(mainQuery).toHaveBeenCalled();
    });

    it('should call release function after cleanup', async () => {
      const mainResult = { rows: [{ id: 1 }], rowCount: 1, fields: [] };
      const mainQuery = jest.fn().mockResolvedValue(mainResult);
      const mockQuery = jest
        .fn()
        .mockResolvedValue({ rows: [['old_role']], rowCount: 1, fields: [] });
      const releaseFn = jest.fn().mockResolvedValue(undefined);

      const setup = {
        roleSetupSql: 'SET ROLE "test_role"',
        captureRoleSql: 'SELECT current_user',
      };

      await sqlSessionContextExecute(mockQuery, setup, mainQuery, releaseFn);

      expect(releaseFn).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith('SET ROLE "old_role"');
    });

    it('should restore null config values to empty string', async () => {
      const mainResult = { rows: [{ id: 1 }], rowCount: 1, fields: [] };
      const mainQuery = jest.fn().mockResolvedValue(mainResult);
      const mockQuery = jest
        .fn()
        .mockResolvedValue({ rows: [[null]], rowCount: 1, fields: [] });

      const setup = {
        configSetupSql: `SELECT set_config('app.key', 'new_value', false) as "app.key"`,
        captureConfigSql: 'SELECT current_setting($1, true) as "app.key"',
        captureConfigValues: ['app.key'],
      };

      await sqlSessionContextExecute(mockQuery, setup, mainQuery);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT set_config('app.key', '', false) as "app.key"`,
      );
    });

    it('should run cleanup even if main query fails', async () => {
      const mainQuery = jest.fn().mockRejectedValue(new Error('Query failed'));
      const mockQuery = jest
        .fn()
        .mockResolvedValue({ rows: [['old_role']], rowCount: 1, fields: [] });

      const setup = {
        roleSetupSql: 'SET ROLE "test_role"',
        captureRoleSql: 'SELECT current_user',
      };

      await expect(
        sqlSessionContextExecute(mockQuery, setup, mainQuery),
      ).rejects.toThrow('Query failed');

      expect(mockQuery).toHaveBeenCalledWith('SET ROLE "old_role"');
    });
  });
});

describe('storage', () => {
  afterAll(db.$close);

  describe('sql session state', () => {
    it('should store role in async state', async () => {
      let capturedState: unknown;

      await db.$withOptions({ role: 'app_user' }, async () => {
        capturedState = db.user.internal.asyncStorage.getStore();
      });

      expect(capturedState).toMatchObject({
        role: 'app_user',
      });
    });

    it('should normalize setConfig values to strings', async () => {
      let capturedState: unknown;

      await db.$withOptions(
        {
          setConfig: {
            'app.tenant_id': 'tenant123',
            'app.count': 42,
            'app.enabled': true,
            'app.disabled': false,
          },
        },
        async () => {
          capturedState = db.user.internal.asyncStorage.getStore();
        },
      );

      expect(capturedState).toMatchObject({
        setConfig: {
          'app.tenant_id': 'tenant123',
          'app.count': '42',
          'app.enabled': 'true',
          'app.disabled': 'false',
        },
      });
    });

    it('should store role and setConfig together', async () => {
      let capturedState: unknown;

      await db.$withOptions(
        {
          role: 'app_user',
          setConfig: {
            'app.tenant_id': 'tenant123',
          },
        },
        async () => {
          capturedState = db.user.internal.asyncStorage.getStore();
        },
      );

      expect(capturedState).toMatchObject({
        role: 'app_user',
        setConfig: {
          'app.tenant_id': 'tenant123',
        },
      });
    });

    it('should reject nested SQL session scope when outer already has role or setConfig', async () => {
      await expect(
        db.$withOptions({ role: 'app_user' }, async () => {
          await db.$withOptions({ role: 'other_role' }, async () => {
            // should not reach here
          });
        }),
      ).rejects.toThrow(OrchidOrmInternalError);

      await expect(
        db.$withOptions(
          { setConfig: { 'app.tenant_id': 'tenant123' } },
          async () => {
            await db.$withOptions(
              { setConfig: { 'app.user_id': 'user456' } },
              async () => {
                // should not reach here
              },
            );
          },
        ),
      ).rejects.toThrow(OrchidOrmInternalError);
    });

    it('should reject nested SQL session scope when inner has role and outer has setConfig', async () => {
      await expect(
        db.$withOptions(
          { setConfig: { 'app.tenant_id': 'tenant123' } },
          async () => {
            await db.$withOptions({ role: 'app_user' }, async () => {
              // should not reach here
            });
          },
        ),
      ).rejects.toThrow(OrchidOrmInternalError);
    });

    it('should allow nested scope with only log change when outer has SQL session', async () => {
      let innerState: unknown;

      await db.$withOptions({ role: 'app_user' }, async () => {
        await db.$withOptions({ log: true }, async () => {
          innerState = db.user.internal.asyncStorage.getStore();
        });
      });

      expect(innerState).toMatchObject({
        role: 'app_user',
      });
    });

    it('should allow nested scope with only schema change when outer has SQL session', async () => {
      let innerState: unknown;

      await db.$withOptions({ role: 'app_user' }, async () => {
        await db.$withOptions({ schema: 'other_schema' }, async () => {
          innerState = db.user.internal.asyncStorage.getStore();
        });
      });

      expect(innerState).toMatchObject({
        role: 'app_user',
        schema: 'other_schema',
      });
    });

    it('should allow combining SQL session with log and schema', async () => {
      let capturedState: unknown;

      await db.$withOptions(
        {
          role: 'app_user',
          setConfig: { 'app.tenant_id': 'tenant123' },
          log: true,
          schema: 'app_schema',
        },
        async () => {
          capturedState = db.user.internal.asyncStorage.getStore();
        },
      );

      expect(capturedState).toMatchObject({
        role: 'app_user',
        setConfig: {
          'app.tenant_id': 'tenant123',
        },
        schema: 'app_schema',
      });
    });

    it('should apply role and setConfig in raw query within withOptions', async () => {
      await db.$withOptions(
        { role: 'app-user', setConfig: { 'app.tenant_id': 'tenant123' } },
        async () => {
          const result = await db.$query<{
            current_role: string;
            tenant_id: string;
          }>`SELECT current_role, current_setting('app.tenant_id', true) as tenant_id`;

          expect(result.rows[0].current_role).toBe('app-user');
          expect(result.rows[0].tenant_id).toBe('tenant123');
        },
      );
    });

    it('should apply role and setConfig in queryArrays within withOptions', async () => {
      await db.$withOptions(
        { role: 'app-user', setConfig: { 'app.tenant_id': 'tenant123' } },
        async () => {
          const result = await db.$queryArrays<[string, string]>`
            SELECT current_role, current_setting('app.tenant_id', true)
          `;

          expect(result.rows[0][0]).toBe('app-user');
          expect(result.rows[0][1]).toBe('tenant123');
        },
      );
    });

    it('should restore previous role and config after withOptions', async () => {
      const beforeResult = await db.$query<{ role: string }>`
        SELECT current_role as role
      `;
      const initialRole = beforeResult.rows[0].role;

      await db.$query`SELECT set_config('app.restore_test', 'before_value', false)`;

      await db.$withOptions(
        { role: 'app-user', setConfig: { 'app.restore_test': 'during_value' } },
        async () => {
          const duringResult = await db.$query<{
            role: string;
            val: string;
          }>`
            SELECT current_role as role, current_setting('app.restore_test', true) as val
          `;
          expect(duringResult.rows[0].role).toBe('app-user');
          expect(duringResult.rows[0].val).toBe('during_value');
        },
      );

      const afterResult = await db.$query<{
        role: string;
        val: string | null;
      }>`
        SELECT current_role as role, current_setting('app.restore_test', true) as val
      `;
      expect(afterResult.rows[0].role).toBe(initialRole);
      expect(afterResult.rows[0].val).toBe('before_value');
    });

    it('should restore config to previous value after withOptions', async () => {
      await db.$query`SELECT set_config('app.null_test', 'original', false)`;
      const beforeResult = await db.$query<{ val: string }>`
        SELECT current_setting('app.null_test', true) as val
      `;
      expect(beforeResult.rows[0].val).toBe('original');

      await db.$withOptions(
        { setConfig: { 'app.null_test': 'temp_value' } },
        async () => {
          const duringResult = await db.$query<{ val: string }>`
            SELECT current_setting('app.null_test', true) as val
          `;
          expect(duringResult.rows[0].val).toBe('temp_value');
        },
      );

      const afterResult = await db.$query<{ val: string }>`
        SELECT current_setting('app.null_test', true) as val
      `;
      expect(afterResult.rows[0].val).toBe('original');
    });

    it('should reset config that did not exist before withOptions', async () => {
      const uniqueKey = 'app.reset_test_' + Date.now();

      const beforeResult = await db.$query<{ val: string | null }>`
        SELECT current_setting(${uniqueKey}, true) as val
      `;
      expect(beforeResult.rows[0].val).toBeNull();

      await db.$withOptions(
        { setConfig: { [uniqueKey]: 'temp_value' } },
        async () => {
          const duringResult = await db.$query<{ val: string }>`
            SELECT current_setting(${uniqueKey}) as val
          `;
          expect(duringResult.rows[0].val).toBe('temp_value');
        },
      );

      const afterResult = await db.$query<{ val: string }>`
        SELECT current_setting(${uniqueKey}, true) as val
      `;
      expect(afterResult.rows[0].val).toBe('');
    });

    it('should apply role and setConfig in ORM $query within withOptions', async () => {
      await db.$withOptions(
        { role: 'app-user', setConfig: { 'app.tenant_id': 'tenant123' } },
        async () => {
          const result = await db.$query<{
            current_role: string;
            tenant_id: string;
          }>`SELECT current_role, current_setting('app.tenant_id', true) as tenant_id`;

          expect(result.rows[0].current_role).toBe('app-user');
          expect(result.rows[0].tenant_id).toBe('tenant123');
        },
      );
    });

    it('should apply role and setConfig in ORM $queryArrays within withOptions', async () => {
      await db.$withOptions(
        { role: 'app-user', setConfig: { 'app.tenant_id': 'tenant123' } },
        async () => {
          const result = await db.$queryArrays<[string, string]>`
            SELECT current_role, current_setting('app.tenant_id', true)
          `;

          expect(result.rows[0][0]).toBe('app-user');
          expect(result.rows[0][1]).toBe('tenant123');
        },
      );
    });
  });
});
