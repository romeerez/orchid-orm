import { AdapterOptions } from 'pqb';
import prompts from 'prompts';

export const setAdapterOptions = (
  options: AdapterOptions,
  set: { database?: string; user?: string; password?: string },
): AdapterOptions => {
  if (options.databaseURL) {
    const url = new URL(options.databaseURL);

    if ('database' in set) {
      url.pathname = `/${set.database}`;
    }

    if (set.user !== undefined) {
      url.username = set.user;
    }

    if (set.password !== undefined) {
      url.password = set.password;
    }

    return { ...options, databaseURL: url.toString() };
  } else {
    return {
      ...options,
      ...set,
    };
  }
};

export const setAdminCredentialsToOptions = async (
  options: AdapterOptions,
  create?: boolean,
): Promise<AdapterOptions | undefined> => {
  const confirm = await prompts([
    {
      message: `Would you like to share admin credentials to ${
        create ? 'create' : 'drop'
      } a database`,
      type: 'confirm',
      name: 'confirm',
      initial: true,
    },
  ]);

  if (!confirm.confirm) {
    return;
  }

  const values = await prompts([
    {
      message: 'Enter admin user:',
      type: 'text',
      name: 'user',
      initial: 'postgres',
      min: 1,
    },
    {
      message: 'Enter admin password:',
      type: 'password',
      name: 'password',
    },
  ]);

  return setAdapterOptions(options, {
    ...values,
    password: values.password || undefined,
  });
};
