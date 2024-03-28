import { AdapterOptions } from 'pqb';
import { promptConfirm, promptText } from '../prompt';

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
  const ok = await promptConfirm({
    message: `Would you like to share admin credentials to ${
      create ? 'create' : 'drop'
    } a database?`,
  });

  if (!ok) {
    return;
  }

  const user = await promptText({
    message: 'Enter admin user:',
    default: 'postgres',
    min: 1,
  });

  const password = await promptText({
    message: 'Enter admin password:',
    password: true,
  });

  return setAdapterOptions(options, {
    user,
    password: password || undefined,
  });
};
