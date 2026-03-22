import { colors, DefaultPrivileges } from 'pqb';
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

const { green, red } = colors;

describe('default privileges', () => {
  const { arrange, act, assert } = useGeneratorsTestUtils();

  // Options for changeDefaultPrivileges in prepareDb
  const allChangeDefaultPrivilegesOptions = {
    grant: {
      tables: {
        privileges: ['SELECT', 'INSERT'],
        grantablePrivileges: ['UPDATE', 'DELETE'],
      },
      sequences: {
        privileges: ['USAGE', 'SELECT'],
        grantablePrivileges: ['UPDATE'],
      },
      functions: {
        privileges: ['EXECUTE'],
      },
      types: {
        grantablePrivileges: ['USAGE'],
      },
    },
    revoke: {
      tables: {
        privileges: ['TRUNCATE'],
        grantablePrivileges: ['REFERENCES'],
      },
      sequences: {
        privileges: ['USAGE'],
      },
      functions: {
        privileges: ['EXECUTE'],
      },
      types: {
        privileges: ['USAGE'],
      },
    },
  } as const;

  // Options for defaultPrivileges in dbOptions
  const allDefaultPrivilegesOptions: Omit<
    DefaultPrivileges.SchemaConfig,
    'schema'
  > = {
    tables: {
      allow: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      allowGrantable: ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'],
    },
    sequences: {
      allow: ['UPDATE'],
      allowGrantable: ['USAGE', 'SELECT'],
    },
    functions: {
      allow: ['EXECUTE'],
    },
    types: {
      allowGrantable: ['USAGE'],
    },
  };

  it('should grant a simple default privilege', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                tables: {
                  allow: ['SELECT'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['SELECT'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} SELECT on tables to testRole`,
    );
  });

  it('should grant all kind of privileges', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                ...allDefaultPrivilegesOptions,
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
        grantablePrivileges: ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'],
      },
      sequences: {
        privileges: ['UPDATE'],
        grantablePrivileges: ['USAGE', 'SELECT'],
      },
      functions: {
        privileges: ['EXECUTE'],
      },
      types: {
        grantablePrivileges: ['USAGE'],
      },
    },
  });
});
`);

    assert.report(
      `${green(
        '+ grant default privileges',
      )} SELECT, INSERT, UPDATE, DELETE on tables to testRole`,
      `${green(
        '+ grant default privileges',
      )} TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on tables with grant option to testRole`,
      `${green('+ grant default privileges')} UPDATE on sequences to testRole`,
      `${green(
        '+ grant default privileges',
      )} USAGE, SELECT on sequences with grant option to testRole`,
      `${green('+ grant default privileges')} EXECUTE on functions to testRole`,
      `${green(
        '+ grant default privileges',
      )} USAGE on types with grant option to testRole`,
    );
  });

  it('should revoke all default privileges when removed from code', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
        // Grant tables privileges using the options object
        await db.changeDefaultPrivileges({
          grantee: 'testRole',
          schema: 'testSchema',
          grant: allChangeDefaultPrivilegesOptions.grant,
        });
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    revoke: {
      tables: {
        privileges: ['SELECT', 'INSERT'],
        grantablePrivileges: ['UPDATE', 'DELETE'],
      },
      sequences: {
        privileges: ['SELECT', 'USAGE'],
        grantablePrivileges: ['UPDATE'],
      },
      functions: {
        privileges: ['EXECUTE'],
      },
      types: {
        grantablePrivileges: ['USAGE'],
      },
    },
  });
});
`);
    assert.report(
      `${red(
        '- revoke default privileges',
      )} EXECUTE on functions from testRole`,
      `${red(
        '- revoke default privileges',
      )} SELECT, INSERT on tables from testRole`,
      `${red(
        '- revoke default privileges',
      )} UPDATE, DELETE on tables with grant option from testRole`,
      `${red(
        '- revoke default privileges',
      )} SELECT, USAGE on sequences from testRole`,
      `${red(
        '- revoke default privileges',
      )} UPDATE on sequences with grant option from testRole`,
      `${red(
        '- revoke default privileges',
      )} USAGE on types with grant option from testRole`,
    );
  });

  it('should change default privileges partially', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
        await db.changeDefaultPrivileges({
          grantee: 'testRole',
          schema: 'testSchema',
          grant: {
            tables: {
              privileges: ['SELECT'],
            },
          },
        });
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                tables: {
                  allow: ['SELECT', 'INSERT'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['INSERT'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} INSERT on tables to testRole`,
    );
  });

  it('should grant and revoke when changing privileges', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
        await db.changeDefaultPrivileges({
          grantee: 'testRole',
          schema: 'testSchema',
          grant: {
            tables: {
              privileges: ['SELECT', 'INSERT', 'UPDATE'],
            },
          },
        });
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                tables: {
                  allow: ['SELECT', 'DELETE'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['DELETE'],
      },
    },
    revoke: {
      tables: {
        privileges: ['INSERT', 'UPDATE'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} DELETE on tables to testRole`,
      `${red(
        '- revoke default privileges',
      )} INSERT, UPDATE on tables from testRole`,
    );
  });

  it('should not generate migration when privileges match', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
        await db.changeDefaultPrivileges({
          grantee: 'testRole',
          schema: 'testSchema',
          grant: {
            tables: {
              privileges: ['SELECT', 'INSERT'],
              grantablePrivileges: ['UPDATE'],
            },
          },
        });
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                tables: {
                  allow: ['SELECT', 'INSERT'],
                  allowGrantable: ['UPDATE'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration();
  });

  it('should handle multiple roles with different schemas', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema1');
        await db.createSchema('schema2');
        await db.createRole('role1');
        await db.createRole('role2');
      },
      schema: 'schema1',
      dbOptions: {
        roles: [
          {
            name: 'role1',
            defaultPrivileges: [
              {
                schema: 'schema1',
                tables: {
                  allow: ['SELECT'],
                },
              },
              {
                schema: 'schema2',
                sequences: {
                  allow: ['USAGE'],
                },
              },
            ],
          },
          {
            name: 'role2',
            defaultPrivileges: [
              {
                schema: 'schema1',
                functions: {
                  allow: ['EXECUTE'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'role1',
    schema: 'schema1',
    grant: {
      tables: {
        privileges: ['SELECT'],
      },
    },
  });

  await db.changeDefaultPrivileges({
    grantee: 'role1',
    schema: 'schema2',
    grant: {
      sequences: {
        privileges: ['USAGE'],
      },
    },
  });

  await db.changeDefaultPrivileges({
    grantee: 'role2',
    schema: 'schema1',
    grant: {
      functions: {
        privileges: ['EXECUTE'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} SELECT on tables to role1`,
      `${green('+ grant default privileges')} USAGE on sequences to role1`,
      `${green('+ grant default privileges')} EXECUTE on functions to role2`,
    );
  });

  it('should handle sequences privileges', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                sequences: {
                  allow: ['USAGE', 'SELECT'],
                  allowGrantable: ['UPDATE'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      sequences: {
        privileges: ['USAGE', 'SELECT'],
        grantablePrivileges: ['UPDATE'],
      },
    },
  });
});
`);

    assert.report(
      `${green(
        '+ grant default privileges',
      )} USAGE, SELECT on sequences to testRole`,
      `${green(
        '+ grant default privileges',
      )} UPDATE on sequences with grant option to testRole`,
    );
  });

  it('should handle functions privileges', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                functions: {
                  allow: ['EXECUTE'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      functions: {
        privileges: ['EXECUTE'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} EXECUTE on functions to testRole`,
    );
  });

  it('should handle types privileges', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                types: {
                  allow: ['USAGE'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      types: {
        privileges: ['USAGE'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} USAGE on types to testRole`,
    );
  });

  it('should generate migration with ALL privileges', async () => {
    // Database has no privileges, code has ALL - migration should be generated
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
        // No default privileges in database
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                tables: {
                  allow: ['ALL'],
                },
                sequences: {
                  allowGrantable: ['ALL'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    // Migration should use ALL
    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['ALL'],
      },
      sequences: {
        grantablePrivileges: ['ALL'],
      },
    },
  });
});
`);

    assert.report(
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on tables to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on sequences with grant option to testRole`,
    );
  });

  it('should not generate migration when database has all privileges covered by ALL', async () => {
    // When code specifies ALL and database has all individual privileges,
    // no migration should be generated because ALL is satisfied.
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
        // Pre-populate with individual privileges so introspection matches code config
        await db.changeDefaultPrivileges({
          grantee: 'testRole',
          schema: 'testSchema',
          grant: {
            tables: {
              privileges: [
                'SELECT',
                'INSERT',
                'UPDATE',
                'DELETE',
                'TRUNCATE',
                'REFERENCES',
                'TRIGGER',
                'MAINTAIN',
              ],
            },
            sequences: {
              grantablePrivileges: ['USAGE', 'SELECT', 'UPDATE'],
            },
          },
        });
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                tables: {
                  allow: ['ALL'],
                },
                sequences: {
                  allowGrantable: ['ALL'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    // No migration needed - database already has all privileges that ALL would grant
    assert.migration();

    // Report should indicate no changes detected
    assert.report('No changes were detected');
  });

  it('should expand all to all object types with ALL privileges', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                all: true,
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['ALL'],
      },
      sequences: {
        privileges: ['ALL'],
      },
      functions: {
        privileges: ['ALL'],
      },
      types: {
        privileges: ['ALL'],
      },
    },
  });
});
`);

    assert.report(
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on tables to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on sequences to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on functions to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on types to testRole`,
    );
  });

  it('should expand allGrantable to all object types with ALL privileges WITH GRANT OPTION', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                allGrantable: true,
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        grantablePrivileges: ['ALL'],
      },
      sequences: {
        grantablePrivileges: ['ALL'],
      },
      functions: {
        grantablePrivileges: ['ALL'],
      },
      types: {
        grantablePrivileges: ['ALL'],
      },
    },
  });
});
`);

    assert.report(
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on tables with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on sequences with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on functions with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on types with grant option to testRole`,
    );
  });

  it('should ignore all when allGrantable is set', async () => {
    // allGrantable takes precedence over all
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                all: true,
                allGrantable: true,
              },
            ],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        grantablePrivileges: ['ALL'],
      },
      sequences: {
        grantablePrivileges: ['ALL'],
      },
      functions: {
        grantablePrivileges: ['ALL'],
      },
      types: {
        grantablePrivileges: ['ALL'],
      },
    },
  });
});
`);

    assert.report(
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on tables with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on sequences with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on functions with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on types with grant option to testRole`,
    );
  });

  it('should merge object type configs on top of all', async () => {
    // When all is provided with specific object configs, the specific configs override the all base
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                all: true,
                tables: {
                  allow: ['SELECT'],
                },
                sequences: {
                  allow: ['USAGE'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    // tables and sequences should have specific privileges, functions and types should have ALL
    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['SELECT'],
      },
      sequences: {
        privileges: ['USAGE'],
      },
      functions: {
        privileges: ['ALL'],
      },
      types: {
        privileges: ['ALL'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} SELECT on tables to testRole`,
      `${green('+ grant default privileges')} USAGE on sequences to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on functions to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on types to testRole`,
    );
  });

  it('should merge grantable object type configs on top of all', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                all: true,
                tables: {
                  allowGrantable: ['ALL'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    // tables should have grantable ALL, others should have non-grantable ALL
    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        grantablePrivileges: ['ALL'],
      },
      sequences: {
        privileges: ['ALL'],
      },
      functions: {
        privileges: ['ALL'],
      },
      types: {
        privileges: ['ALL'],
      },
    },
  });
});
`);

    assert.report(
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on tables with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on sequences to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on functions to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on types to testRole`,
    );
  });

  it('should merge non-grantable object type configs on top of allGrantable', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('testSchema');
        await db.createRole('testRole');
      },
      schema: 'testSchema',
      dbOptions: {
        roles: [
          {
            name: 'testRole',
            defaultPrivileges: [
              {
                schema: 'testSchema',
                allGrantable: true,
                tables: {
                  allow: ['SELECT'],
                },
              },
            ],
          },
        ],
      },
    });

    await act();

    // tables should have non-grantable SELECT, others should have grantable ALL
    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'testRole',
    schema: 'testSchema',
    grant: {
      tables: {
        privileges: ['SELECT'],
      },
      sequences: {
        grantablePrivileges: ['ALL'],
      },
      functions: {
        grantablePrivileges: ['ALL'],
      },
      types: {
        grantablePrivileges: ['ALL'],
      },
    },
  });
});
`);

    assert.report(
      `${green('+ grant default privileges')} SELECT on tables to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on sequences with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on functions with grant option to testRole`,
      `${green(
        '+ grant default privileges',
      )} ALL PRIVILEGES on types with grant option to testRole`,
    );
  });
});
