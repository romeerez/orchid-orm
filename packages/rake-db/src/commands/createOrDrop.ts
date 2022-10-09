import { Adapter, AdapterOptions, MaybeArray, toArray } from 'pqb';
import {
  getDatabaseAndUserFromOptions,
  setAdminCredentialsToOptions,
  setAdapterOptions,
  createSchemaMigrations,
} from './utils';

const execute = async (
  options: AdapterOptions,
  sql: string,
): Promise<'ok' | 'already' | 'forbidden' | { error: unknown }> => {
  const db = new Adapter(options);
  try {
    await db.query(sql);
    return 'ok';
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err.code === '42P04' || err.code === '3D000') {
      return 'already';
    } else if (err.code === '42501') {
      return 'forbidden';
    } else {
      return { error };
    }
  } finally {
    await db.destroy();
  }
};

const createOrDrop = async (
  options: AdapterOptions,
  adminOptions: AdapterOptions,
  args: {
    sql(params: { database: string; user: string }): string;
    successMessage(params: { database: string }): string;
    alreadyMessage(params: { database: string }): string;
    createVersionsTable?: boolean;
  },
) => {
  const params = getDatabaseAndUserFromOptions(options);

  const result = await execute(
    setAdapterOptions(adminOptions, { database: 'postgres' }),
    args.sql(params),
  );
  if (result === 'ok') {
    console.log(args.successMessage(params));
  } else if (result === 'already') {
    console.log(args.alreadyMessage(params));
  } else if (result === 'forbidden') {
    await createOrDrop(
      options,
      await setAdminCredentialsToOptions(options),
      args,
    );
    return;
  } else {
    throw result.error;
  }

  if (!args.createVersionsTable) return;

  const db = new Adapter(options);
  await createSchemaMigrations(db);
  await db.destroy();
};

export const createDb = async (arg: MaybeArray<AdapterOptions>) => {
  for (const options of toArray(arg)) {
    await createOrDrop(options, options, {
      sql({ database, user }) {
        return `CREATE DATABASE "${database}" OWNER "${user}"`;
      },
      successMessage({ database }) {
        return `Database ${database} successfully created`;
      },
      alreadyMessage({ database }) {
        return `Database ${database} already exists`;
      },
      createVersionsTable: true,
    });
  }
};

export const dropDb = async (arg: MaybeArray<AdapterOptions>) => {
  for (const options of toArray(arg)) {
    await createOrDrop(options, options, {
      sql({ database }) {
        return `DROP DATABASE "${database}"`;
      },
      successMessage({ database }) {
        return `Database ${database} was successfully dropped`;
      },
      alreadyMessage({ database }) {
        return `Database ${database} does not exist`;
      },
    });
  }
};
