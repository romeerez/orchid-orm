import { getResetSetConfigSql, getSetConfigSql } from './adapter.utils';

describe('adapter utils', () => {
  describe('getSetConfigSql', () => {
    it('returns undefined when nested setConfig is not provided', () => {
      expect(getSetConfigSql()).toBeUndefined();
      expect(getSetConfigSql(undefined, {})).toBeUndefined();
    });

    it('returns undefined when all nested setConfig values match parent', () => {
      expect(
        getSetConfigSql(
          { search_path: 'schema', 'app.user_id': '1' },
          {
            setConfig: { search_path: 'schema', 'app.user_id': '1' },
          },
        ),
      ).toBeUndefined();
    });

    it('builds SQL for all provided setConfig', () => {
      expect(
        getSetConfigSql(undefined, {
          setConfig: { search_path: 'schema', 'app.user_id': '1' },
        }),
      ).toBe(
        "SELECT set_config('search_path', 'schema', true), set_config('app.user_id', '1', true)",
      );
    });

    it('builds SQL only for keys changed from parent', () => {
      expect(
        getSetConfigSql(
          { search_path: 'schema', 'app.user_id': '1' },
          {
            setConfig: {
              search_path: 'schema',
              'app.user_id': '2',
              'app.tenant_id': 'tenant-1',
            },
          },
        ),
      ).toBe(
        "SELECT set_config('app.user_id', '2', true), set_config('app.tenant_id', 'tenant-1', true)",
      );
    });
  });

  describe('getResetSetConfigSql', () => {
    it('returns undefined when nested setConfig is not provided', () => {
      expect(getResetSetConfigSql()).toBeUndefined();
      expect(getResetSetConfigSql(undefined, {})).toBeUndefined();
    });

    it('returns undefined when no keys were overridden', () => {
      expect(
        getResetSetConfigSql(
          { search_path: 'schema', 'app.user_id': '1' },
          {
            setConfig: {
              search_path: 'schema',
              'app.user_id': '1',
            },
          },
        ),
      ).toBeUndefined();
    });

    it('restores overridden keys and clears keys missing in parent setConfig', () => {
      expect(
        getResetSetConfigSql(
          { search_path: 'public', 'app.user_id': '1' },
          {
            setConfig: {
              search_path: 'schema',
              'app.user_id': '2',
              'app.tenant_id': '3',
            },
          },
        ),
      ).toBe(
        "SELECT set_config('search_path', 'public', true), set_config('app.user_id', '1', true), set_config('app.tenant_id', '', true)",
      );
    });
  });
});
