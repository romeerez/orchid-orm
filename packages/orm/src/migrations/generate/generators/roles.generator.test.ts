import { colors } from 'pqb/internal';
import { useGeneratorsTestUtils } from './generators.test-utils';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red, yellow } = colors;

describe('roles', () => {
  const { arrange, act, assert } = useGeneratorsTestUtils();

  const now = new Date();

  const allRoleOptions = {
    super: true,
    inherit: true,
    createRole: true,
    createDb: true,
    canLogin: true,
    replication: true,
    connLimit: 1,
    bypassRls: true,
    validUntil: now,
    config: {
      statement_timeout: '30s',
    },
  };

  it('should create a simple role', async () => {
    await arrange({
      dbOptions: {
        roles: [{ name: 'name' }],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createRole('name');
});
`);

    assert.report(`${green('+ create role')} name`);
  });

  it('should create a role with all params', async () => {
    await arrange({
      dbOptions: {
        roles: [
          {
            name: 'name',
            ...allRoleOptions,
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createRole('name', {
    super: true,
    inherit: true,
    createRole: true,
    createDb: true,
    canLogin: true,
    replication: true,
    connLimit: 1,
    validUntil: '${now.toISOString()}',
    bypassRls: true,
    config: {"statement_timeout":"30s"},
  });
});
`);

    assert.report(`${green('+ create role')} name`);
  });

  it('should drop a simple role', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createRole('name');
      },
      dbOptions: {
        roles: [],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropRole('name');
});
`);

    assert.report(`${red('- drop role')} name`);
  });

  it('should drop a role with all params', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createRole('name', allRoleOptions);
      },
      dbOptions: {
        roles: [],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropRole('name', {
    super: true,
    inherit: true,
    createRole: true,
    createDb: true,
    canLogin: true,
    replication: true,
    connLimit: 1,
    validUntil: '${now.toISOString()}',
    bypassRls: true,
    config: {"statement_timeout":"30s"},
  });
});
`);

    assert.report(`${red('- drop role')} name`);
  });

  it('should not recreate a role when it is not changed', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createRole('name', allRoleOptions);
      },
      dbOptions: {
        roles: [
          {
            name: 'name',
            ...allRoleOptions,
          },
        ],
      },
    });

    await act();

    assert.migration();
  });

  it('should rename a role when selected', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createRole('from');
      },
      dbOptions: {
        roles: [
          {
            name: 'to',
          },
        ],
      },
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameRole('from', 'to');
});
`);

    assert.report(`${yellow('~ rename role')} from ${yellow('=>')} to`);
  });

  it('should recreate a role', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createRole('from');
      },
      dbOptions: {
        roles: [
          {
            name: 'to',
          },
        ],
      },
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createRole('to');

  await db.dropRole('from');
});
`);

    assert.report(`${green('+ create role')} to`, `${red('- drop role')} from`);
  });

  it('should change a role', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createRole('name');
      },
      dbOptions: {
        roles: [
          {
            name: 'name',
            super: true,
            inherit: true,
            createRole: true,
            createDb: true,
            canLogin: true,
            replication: true,
            connLimit: 1,
            validUntil: now,
            bypassRls: true,
            config: {
              statement_timeout: '30s',
            },
          },
        ],
        // optional
        // managedRolesSql: ,
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeRole('name', {
    from: {
      super: false,
      inherit: false,
      createRole: false,
      createDb: false,
      canLogin: false,
      replication: false,
      connLimit: -1,
      validUntil: undefined,
      bypassRls: false,
      config: undefined,
    },
    to: {
      super: true,
      inherit: true,
      createRole: true,
      createDb: true,
      canLogin: true,
      replication: true,
      connLimit: 1,
      validUntil: '${now.toISOString()}',
      bypassRls: true,
      config: {"statement_timeout":"30s"},
    },
  });
});
`);

    assert.report(`${yellow('~ change role')} name`);
  });

  it('should change a role to remove options', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createRole('name', {
          super: true,
          inherit: true,
          createRole: true,
          createDb: true,
          canLogin: true,
          replication: true,
          connLimit: 1,
          validUntil: now,
          bypassRls: true,
          config: {
            statement_timeout: '30s',
          },
        });
      },
      dbOptions: {
        roles: [
          {
            name: 'name',
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeRole('name', {
    from: {
      super: true,
      inherit: true,
      createRole: true,
      createDb: true,
      canLogin: true,
      replication: true,
      connLimit: 1,
      validUntil: '${now.toISOString()}',
      bypassRls: true,
      config: {"statement_timeout":"30s"},
    },
    to: {
      super: false,
      inherit: false,
      createRole: false,
      createDb: false,
      canLogin: false,
      replication: false,
      connLimit: -1,
      validUntil: undefined,
      bypassRls: false,
      config: undefined,
    },
  });
});
`);

    assert.report(`${yellow('~ change role')} name`);
  });
});
