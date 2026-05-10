import {
  getResetSetConfigSql,
  getSetConfigSql,
  mergeSetConfig,
} from './adapter.utils';

describe('adapter utils', () => {
  describe('mergeSetConfig', () => {
    it('merges nested setConfig into parent setConfig', () => {
      expect(
        mergeSetConfig(
          { search_path: 'public', 'app.user_id': 1 },
          { setConfig: { 'app.user_id': 2, 'app.tenant_id': 'tenant-1' } },
        ),
      ).toEqual({
        search_path: 'public',
        'app.user_id': 2,
        'app.tenant_id': 'tenant-1',
      });
    });
  });

  describe('getSetConfigSql', () => {
    it('builds SQL for all provided setConfig', () => {
      expect(
        getSetConfigSql({
          setConfig: { search_path: 'schema', 'app.user_id': 1 },
        }),
      ).toBe('SET LOCAL search_path=schema; SET LOCAL app.user_id=1');
    });
  });

  describe('getResetSetConfigSql', () => {
    it('restores overridden keys and resets keys missing in parent setConfig', () => {
      expect(
        getResetSetConfigSql(
          { search_path: 'public', 'app.user_id': 1 },
          {
            setConfig: {
              search_path: 'schema',
              'app.user_id': 2,
              'app.tenant_id': 3,
            },
          },
        ),
      ).toBe(
        'SET LOCAL search_path=public; SET LOCAL app.user_id=1; RESET app.tenant_id',
      );
    });
  });
});
