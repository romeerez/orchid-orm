import { Migration } from './migration';
import { DbStructure, RakeDbAst } from 'rake-db';
import { emptyObject, RecordOptionalString } from 'pqb';

type Option =
  | 'super'
  | 'inherit'
  | 'createRole'
  | 'createDb'
  | 'canLogin'
  | 'replication'
  | 'bypassRls'
  | 'connLimit'
  | 'validUntil';

const serializers: { [K in Option]: (value: unknown) => string } = {
  super: (b) => `${b ? '' : 'NO'}SUPERUSER`,
  inherit: (b) => `${b ? '' : 'NO'}INHERIT`,
  createRole: (b) => `${b ? '' : 'NO'}CREATEROLE`,
  createDb: (b) => `${b ? '' : 'NO'}CREATEDB`,
  canLogin: (b) => `${b ? '' : 'NO'}LOGIN`,
  replication: (b) => `${b ? '' : 'NO'}REPLICATION`,
  bypassRls: (b) => `${b ? '' : 'NO'}BYPASSRLS`,
  connLimit: (value) => `CONNECTION LIMIT ${value === undefined ? -1 : value}`,
  validUntil: (value) =>
    `VALID UNTIL '${value === undefined ? 'infinity' : value}'`,
};

export const createOrDropRole = async (
  migration: Migration,
  up: boolean,
  name: string,
  params?: Partial<DbStructure.Role>,
): Promise<void> => {
  const ast = makeAst(up, name, params);
  const sql = astToQuery(ast);

  await migration.adapter.arrays(sql);
};

const makeAst = (
  up: boolean,
  name: string,
  params?: Partial<DbStructure.Role>,
): RakeDbAst.Role => {
  return {
    type: 'role',
    action: up ? 'create' : 'drop',
    name,
    super: false,
    inherit: false,
    createRole: false,
    createDb: false,
    canLogin: false,
    replication: false,
    connLimit: -1,
    bypassRls: false,
    ...params,
  };
};

const astToQuery = (ast: RakeDbAst.Role): string => {
  const w: string[] = [];

  if (ast.action !== 'drop') {
    for (const key in ast) {
      if (key in serializers && (key !== 'connLimit' || ast[key] !== -1)) {
        let value = ast[key as keyof DbStructure.Role];
        if (value instanceof Date) value = value.toISOString();
        w.push(serializers[key as Option](value));
      }
    }
  }

  let sql = `${ast.action.toUpperCase()} ROLE "${ast.name}"${
    w.length ? ` WITH ${w.join(' ')}` : ''
  }`;

  if (ast.action !== 'drop' && ast.config) {
    for (const [key, value] of Object.entries(ast.config)) {
      sql += `;\nALTER ROLE "${ast.name}" SET ${key} = '${value}'`;
    }
  }

  return sql;
};

export const changeRole = async (
  migration: Migration,
  up: boolean,
  name: string,
  from: Partial<DbStructure.Role>,
  to: Partial<DbStructure.Role>,
) => {
  if (!up) {
    if (to.name) {
      from = { ...from, name };
      name = to.name;
    }

    const f = from;
    from = to;
    to = { ...f };

    for (const key in from) {
      if (!(key in to)) {
        to[key as keyof DbStructure.Role] = undefined;
      }
    }

    if (from.config) {
      const config = (to.config ??= {});
      for (const key in from.config) {
        if (!(key in config)) {
          config[key] = undefined;
        }
      }
    }
  }

  const ast = makeChangeAst(name, from, to);
  const sql = changeAstToQuery(ast);

  if (sql) await migration.adapter.arrays(sql);
};

const makeChangeAst = (
  name: string,
  from: Partial<DbStructure.Role>,
  to: Partial<DbStructure.Role>,
): RakeDbAst.ChangeRole => {
  return {
    type: 'changeRole',
    name,
    from,
    to,
  };
};

const changeAstToQuery = ({ name, from, to }: RakeDbAst.ChangeRole): string => {
  const queries: string[] = [];

  if (to.name && to.name !== name) {
    queries.push(`ALTER ROLE "${name}" RENAME TO "${to.name}"`);
    name = to.name;
  }

  const w: string[] = [];
  for (const key in to) {
    let value = to[key as keyof DbStructure.Role];
    if (key !== 'config') {
      if (value instanceof Date) value = value.toISOString();
      let other = from[key as keyof DbStructure.Role];
      if (other instanceof Date) other = other.toISOString();

      if (value !== other && key in serializers) {
        w.push(serializers[key as Option](value));
      }
    }
  }

  if (w.length) {
    queries.push(`ALTER ROLE "${name}" WITH ${w.join(' ')}`);
  }

  const config = to.config;
  if (config) {
    const fromConfig: RecordOptionalString = from.config ?? emptyObject;
    for (const key in config) {
      const value = config[key];
      const other = fromConfig[key];
      if (value !== other) {
        queries.push(
          `ALTER ROLE "${name}" ${
            value ? `SET ${key} = '${value}'` : `RESET ${key}`
          }`,
        );
      }
    }
  }

  return queries.join(';\n');
};
