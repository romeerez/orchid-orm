import { type IsQuery } from '../../query';
import { NestedSqlSessionError } from '../../query/errors';
import { type PickQueryQ } from '../../query/pick-query-types';
import { type QueryResult, type QueryResultRow } from '../adapter';

export interface SqlSessionState {
  // Query-scoped: Postgres role to set for this callback scope (from withOptions)
  role?: string;
  // Query-scoped: Postgres custom settings to set for this callback scope (from withOptions)
  setConfig?: Record<string, string | number | boolean>;
}

export interface SqlSessionContextSetupResult {
  roleSetupSql?: string;
  configSetupSql?: string;
  captureRoleSql?: string;
  captureConfigSql?: string;
  captureConfigValues?: string[];
}

export interface SqlSessionContextQueryFn {
  (sql: string, values?: unknown[]): Promise<QueryResult<QueryResultRow>>;
}

interface CapturedSessionState {
  previousRole?: string;
  previousConfigs?: Record<string, string | null>;
}

const quoteRoleIdentifier = (role: string): string => {
  return `"${role.replace(/"/g, '""')}"`;
};

const hasSqlSessionContextOptions = (options: SqlSessionState): boolean => {
  return options.role !== undefined || options.setConfig !== undefined;
};

const hasActiveSqlSessionContext = (
  state: SqlSessionState | undefined,
): boolean => {
  if (!state) return false;
  return state.role !== undefined || state.setConfig !== undefined;
};

const sqlSessionContextNormalizeSetConfig = (
  setConfig: Record<string, string | number | boolean>,
): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(setConfig).map(([key, value]) => [key, String(value)]),
  );
};

const buildConfigRestoreExpression = (
  key: string,
  value: string | null | undefined,
): string => {
  const escapedKey = key.replace(/'/g, "''");
  if (value === null || value === undefined) {
    value = '';
  }
  return `set_config('${escapedKey}', '${value.replace(/'/g, "''")}', false) as "${key}"`;
};

export const sqlSessionContextSetStorageOptions = (
  query: PickQueryQ,
  state: SqlSessionState | undefined,
  options: SqlSessionState,
  result: SqlSessionState,
): void => {
  if (
    hasSqlSessionContextOptions(options) &&
    hasActiveSqlSessionContext(state)
  ) {
    throw new NestedSqlSessionError(query as unknown as IsQuery);
  }

  if (options.role !== undefined) {
    result.role = options.role;
  }

  if (options.setConfig) {
    result.setConfig = sqlSessionContextNormalizeSetConfig(options.setConfig);
  }
};

export const sqlSessionContextMergeStorageState = (
  state: SqlSessionState | undefined,
  options: SqlSessionState | undefined,
): SqlSessionState | undefined => {
  if (!options) return state;

  return {
    role: options.role ?? state?.role,
    setConfig: options.setConfig ?? state?.setConfig,
  };
};

export const sqlSessionContextGetStateFromAsyncState = (
  state: SqlSessionState | undefined,
): SqlSessionState | undefined => {
  return state?.role || state?.setConfig ? state : undefined;
};

export const sqlSessionContextComputeSetup = (
  desired: SqlSessionState | undefined,
): SqlSessionContextSetupResult | undefined => {
  if (!desired) return undefined;

  const role = desired.role;
  const hasRole = role !== undefined;
  const { setConfig } = desired;
  const configKeys = setConfig && Object.keys(setConfig);
  const hasConfig = configKeys && configKeys.length > 0;

  if (!hasRole && !hasConfig) return undefined;

  const result: SqlSessionContextSetupResult = {};

  if (hasRole) {
    result.roleSetupSql = `SET ROLE ${quoteRoleIdentifier(role)}`;
    result.captureRoleSql = 'SELECT current_user';
  }

  if (hasConfig && setConfig) {
    result.captureConfigValues = configKeys;
    const captureColumns = configKeys
      .map((key, i) => `current_setting($${i + 1}, true) as "${key}"`)
      .join(', ');
    result.captureConfigSql = `SELECT ${captureColumns}`;

    const setColumns = configKeys
      .map((key) => {
        const value = setConfig[key];
        return `set_config('${key.replace(/'/g, "''")}', '${typeof value === 'string' ? value.replace(/'/g, "''") : value}', false) as "${key}"`;
      })
      .join(', ');
    result.configSetupSql = `SELECT ${setColumns}`;
  }

  return result;
};

export const sqlSessionContextBuildConfigRestoreBatchSql = (
  configs: Record<string, string | null | undefined>,
): string | undefined => {
  const keys = Object.keys(configs);
  if (keys.length === 0) return undefined;

  const expressions = keys
    .map((key) => buildConfigRestoreExpression(key, configs[key]))
    .join(', ');
  return `SELECT ${expressions}`;
};

export const sqlSessionContextHasState = (
  state: SqlSessionState | undefined,
): boolean => {
  if (!state) return false;
  return (
    state.role !== undefined ||
    (state.setConfig !== undefined && Object.keys(state.setConfig).length > 0)
  );
};

export const sqlSessionContextExecute = async <T extends QueryResultRow>(
  query: SqlSessionContextQueryFn,
  setup: SqlSessionContextSetupResult | undefined,
  mainQuery: () => Promise<QueryResult<T>>,
  release?: () => Promise<void>,
): Promise<QueryResult<T>> => {
  if (!setup) {
    return mainQuery();
  }

  const captured: CapturedSessionState = {};
  const {
    captureRoleSql,
    roleSetupSql,
    captureConfigSql,
    captureConfigValues,
    configSetupSql,
  } = setup;

  const setupPromises: Promise<unknown>[] = [];

  if (captureRoleSql) {
    setupPromises.push(
      query(captureRoleSql).then((res) => {
        captured.previousRole = (res.rows[0] as unknown[])?.[0] as string;
      }),
    );
    setupPromises.push(query(roleSetupSql!));
  }

  if (captureConfigSql && captureConfigValues && configSetupSql) {
    captured.previousConfigs = {};
    const previousConfigs = captured.previousConfigs;
    setupPromises.push(
      query(captureConfigSql, captureConfigValues).then((res) => {
        const row = res.rows[0] as unknown[];
        captureConfigValues.forEach((key, i) => {
          previousConfigs[key] = row[i] as string | null;
        });
      }),
    );
    setupPromises.push(query(configSetupSql));
  }

  try {
    await Promise.all(setupPromises);
    return await mainQuery();
  } finally {
    try {
      const cleanupPromises: Promise<unknown>[] = [];

      if (roleSetupSql && captured.previousRole !== undefined) {
        cleanupPromises.push(
          query(`SET ROLE ${quoteRoleIdentifier(captured.previousRole)}`),
        );
      }

      if (captured.previousConfigs) {
        const restoreSql = sqlSessionContextBuildConfigRestoreBatchSql(
          captured.previousConfigs,
        );
        if (restoreSql) {
          cleanupPromises.push(query(restoreSql));
        }
      }

      await Promise.all(cleanupPromises);
    } finally {
      if (release) {
        await release();
      }
    }
  }
};
