import { colors, type Grant } from 'pqb/internal';
import { useGeneratorsTestUtils } from './generators.test-utils';
import * as verifyMigrationModule from '../verify-migration';
import { setGrants } from '../../../orm';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

jest.mock('../verify-migration', () => {
  const actual = jest.requireActual('../verify-migration');

  return {
    ...actual,
    verifyMigration: jest.fn(actual.verifyMigration),
  };
});

const { green, red } = colors;

describe('grants', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  type ArrangeParams = Parameters<typeof arrange>[0];
  type TestDb = Parameters<NonNullable<ArrangeParams['prepareDb']>>[0];

  const grantee = 'app-user';
  const grantor = 'grant_items_grantor';
  const grantSchema = 'grant_items_schema';
  const grantAllSchema = 'grant_all_items_schema';
  const grantBySchema = 'grant_by_schema';
  const grantTable = 'grant_items_table';
  const grantAllTable = 'grant_all_items_table';
  const grantByTable = 'grant_by_table';
  const grantSequence = `${grantTable}_id_seq`;
  const grantAllSequence = `${grantAllTable}_id_seq`;
  const grantType = 'grant_items_type';
  const grantDomain = 'grant_items_domain';
  const grantRoutine = 'grant_items_routine';
  const grantAllRoutine = 'grant_all_items_routine';
  const grantDatabase = 'orchid-orm';
  const grantDiscoveryRole = 'grant_discovery_role';

  const GrantTableBase = table(
    (t) => ({
      id: t.serial().primaryKey(),
      type: t.enum(`${grantSchema}.${grantType}`, ['one', 'two']),
    }),
    undefined,
    { name: grantTable, schema: grantSchema, noPrimaryKey: false },
  );
  class GrantTable extends GrantTableBase {}

  const GrantAllTableBase = table(
    (t) => ({
      id: t.serial().primaryKey(),
    }),
    undefined,
    { name: grantAllTable, schema: grantAllSchema, noPrimaryKey: false },
  );
  class GrantAllTable extends GrantAllTableBase {}

  const GrantByTableBase = table(
    (t) => ({
      id: t.serial().primaryKey(),
    }),
    undefined,
    { name: grantByTable, schema: grantBySchema, noPrimaryKey: false },
  );
  class GrantByTable extends GrantByTableBase {}

  class TableLocalGrantByTable extends GrantByTableBase {
    grants = setGrants([
      {
        to: grantee,
        privileges: ['SELECT'],
      },
    ]);
  }

  class TableLocalGrantableGrantByTable extends GrantByTableBase {
    grants = setGrants([
      {
        to: grantee,
        grantablePrivileges: ['SELECT'],
      },
    ]);
  }

  const grantTables = [GrantTable, GrantAllTable];
  const grantByTableName = `${grantBySchema}.${grantByTable}`;

  const prepareGrantTargets = async (db: TestDb) => {
    await db.createSchema(grantSchema);
    await db.createSchema(grantAllSchema);
    await db.query`CREATE TYPE grant_items_schema.grant_items_type AS ENUM ('one', 'two')`;
    await db.createDomain(`${grantSchema}.${grantDomain}`, (t) => t.integer());

    await db.createTable(`${grantSchema}.${grantTable}`, (t) => ({
      id: t.serial().primaryKey(),
      type: t.enum(`${grantSchema}.${grantType}`),
    }));
    await db.createTable(`${grantAllSchema}.${grantAllTable}`, (t) => ({
      id: t.serial().primaryKey(),
    }));

    await db.query`CREATE FUNCTION grant_items_schema.grant_items_routine() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$`;
    await db.query`CREATE FUNCTION grant_all_items_schema.grant_all_items_routine() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$`;

    await db.createRole(grantDiscoveryRole);
    await db.grant({
      to: grantDiscoveryRole,
      sequences: [`${grantAllSchema}.${grantAllSequence}`],
      privileges: ['SELECT'],
    });
    await db.grant({
      to: grantDiscoveryRole,
      routines: [`${grantAllSchema}.${grantAllRoutine}`],
      privileges: ['EXECUTE'],
    });
  };

  const grantConfig = (to: string): Grant.Privilege[] => [
    {
      to,
      schemas: [grantSchema],
      privileges: ['CREATE'],
      grantablePrivileges: ['USAGE'],
    },
    {
      to,
      tables: [`${grantSchema}.${grantTable}`],
      privileges: ['SELECT'],
      grantablePrivileges: ['INSERT'],
    },
    {
      to,
      sequences: [`${grantSchema}.${grantSequence}`],
      privileges: ['SELECT'],
      grantablePrivileges: ['USAGE'],
    },
    {
      to,
      routines: [`${grantSchema}.${grantRoutine}`],
      grantablePrivileges: ['EXECUTE'],
    },
    {
      to,
      types: [`${grantSchema}.${grantType}`],
      grantablePrivileges: ['USAGE'],
    },
    {
      to,
      domains: [`${grantSchema}.${grantDomain}`],
      grantablePrivileges: ['USAGE'],
    },
    {
      to,
      databases: [grantDatabase],
      privileges: ['CONNECT'],
      grantablePrivileges: ['CREATE'],
    },
    {
      to,
      allTablesIn: [grantAllSchema],
      privileges: ['UPDATE'],
      grantablePrivileges: ['DELETE'],
    },
    {
      to,
      allSequencesIn: [grantAllSchema],
      privileges: ['SELECT'],
      grantablePrivileges: ['UPDATE'],
    },
    {
      to,
      allRoutinesIn: [grantAllSchema],
      grantablePrivileges: ['EXECUTE'],
    },
  ];

  const emptyGrantConfig = (to: string): Grant.Privilege[] =>
    grantConfig(to).map(
      ({ privileges: _, grantablePrivileges: _g, ...grant }) => ({
        ...grant,
      }),
    );

  const publicDefaultGrantConfig = (): Grant.Privilege[] => [
    {
      to: 'PUBLIC',
      types: [`${grantSchema}.${grantType}`],
      privileges: ['USAGE'],
    },
    {
      to: 'PUBLIC',
      domains: [`${grantSchema}.${grantDomain}`],
      privileges: ['USAGE'],
    },
  ];

  const grantMatchingPrivileges = async (db: TestDb, to: string) => {
    await db.grant({
      to,
      schemas: [grantSchema],
      privileges: ['CREATE'],
      grantablePrivileges: ['USAGE'],
    });
    await db.grant({
      to,
      tables: [`${grantSchema}.${grantTable}`],
      privileges: ['SELECT'],
      grantablePrivileges: ['INSERT'],
    });
    await db.grant({
      to,
      sequences: [`${grantSchema}.${grantSequence}`],
      privileges: ['SELECT'],
      grantablePrivileges: ['USAGE'],
    });
    await db.grant({
      to,
      routines: [`${grantSchema}.${grantRoutine}`],
      grantablePrivileges: ['EXECUTE'],
    });
    await db.grant({
      to,
      types: [`${grantSchema}.${grantType}`],
      grantablePrivileges: ['USAGE'],
    });
    await db.grant({
      to,
      domains: [`${grantSchema}.${grantDomain}`],
      grantablePrivileges: ['USAGE'],
    });
    await db.grant({
      to,
      databases: [grantDatabase],
      privileges: ['CONNECT'],
      grantablePrivileges: ['CREATE'],
    });
    await db.grant({
      to,
      tables: [`${grantAllSchema}.${grantAllTable}`],
      privileges: ['UPDATE'],
      grantablePrivileges: ['DELETE'],
    });
    await db.grant({
      to,
      sequences: [`${grantAllSchema}.${grantAllSequence}`],
      privileges: ['SELECT'],
      grantablePrivileges: ['UPDATE'],
    });
    await db.grant({
      to,
      routines: [`${grantAllSchema}.${grantAllRoutine}`],
      grantablePrivileges: ['EXECUTE'],
    });
  };

  const grantReconciledPrivileges = async (db: TestDb, to: string) => {
    await db.grant({
      to,
      schemas: [grantSchema],
      privileges: ['USAGE'],
      grantablePrivileges: ['CREATE'],
    });
    await db.grant({
      to,
      tables: [`${grantSchema}.${grantTable}`],
      privileges: ['INSERT'],
      grantablePrivileges: ['SELECT'],
    });
    await db.grant({
      to,
      sequences: [`${grantSchema}.${grantSequence}`],
      privileges: ['USAGE'],
      grantablePrivileges: ['SELECT'],
    });
    await db.grant({
      to,
      routines: [`${grantSchema}.${grantRoutine}`],
      privileges: ['EXECUTE'],
    });
    await db.grant({
      to,
      types: [`${grantSchema}.${grantType}`],
      privileges: ['USAGE'],
    });
    await db.grant({
      to,
      domains: [`${grantSchema}.${grantDomain}`],
      privileges: ['USAGE'],
    });
    await db.grant({
      to,
      databases: [grantDatabase],
      privileges: ['CREATE'],
      grantablePrivileges: ['CONNECT'],
    });
    await db.grant({
      to,
      tables: [`${grantAllSchema}.${grantAllTable}`],
      privileges: ['DELETE'],
      grantablePrivileges: ['UPDATE'],
    });
    await db.grant({
      to,
      sequences: [`${grantAllSchema}.${grantAllSequence}`],
      privileges: ['UPDATE'],
      grantablePrivileges: ['SELECT'],
    });
    await db.grant({
      to,
      routines: [`${grantAllSchema}.${grantAllRoutine}`],
      privileges: ['EXECUTE'],
    });
  };

  const prepareGrantByTable = async (db: TestDb) => {
    await db.createSchema(grantBySchema);
    await db.createTable(grantByTableName, (t) => ({
      id: t.serial().primaryKey(),
    }));
  };

  const grantTablePrivilegeAsGrantor = async (db: TestDb) => {
    await db.query`ALTER TABLE grant_by_schema.grant_by_table OWNER TO grant_items_grantor`;
    await db.grant({
      to: grantor,
      schemas: [grantBySchema],
      privileges: ['USAGE'],
    });
    await db.query`SET ROLE grant_items_grantor`;

    try {
      await db.grant({
        to: grantee,
        tables: [grantByTableName],
        privileges: ['INSERT'],
      });
    } finally {
      await db.query`RESET ROLE`;
    }
  };

  const grantReport = (
    privileges: string,
    target: string,
    to: string,
    withGrantOption = false,
  ) =>
    `${green('+ grant privileges')} ${privileges} on ${target}${
      withGrantOption ? ' with grant option' : ''
    } to ${to}`;

  const revokeReport = (
    privileges: string,
    target: string,
    to: string,
    withGrantOption = false,
  ) =>
    `${red('- revoke privileges')} ${privileges} on ${target}${
      withGrantOption ? ' with grant option' : ''
    } from ${to}`;

  it('should grant configured table privileges missing in db', async () => {
    await arrange({
      async prepareDb(db) {
        await prepareGrantTargets(db);
      },
      tables: grantTables,
      dbOptions: {
        domains: {
          [`${grantSchema}.${grantDomain}`]: (t) => t.integer(),
        },
        grants: [...grantConfig(grantee), ...publicDefaultGrantConfig()],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    schemas: ['grant_items_schema'],
    grantablePrivileges: ['USAGE'],
  });

  await db.grant({
    to: ['app-user'],
    schemas: ['grant_items_schema'],
    privileges: ['CREATE'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_items_schema.grant_items_table'],
    grantablePrivileges: ['INSERT'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_items_schema.grant_items_table'],
    privileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_items_schema.grant_items_table_id_seq'],
    grantablePrivileges: ['USAGE'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_items_schema.grant_items_table_id_seq'],
    privileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    routines: ['grant_items_schema.grant_items_routine'],
    grantablePrivileges: ['EXECUTE'],
  });

  await db.grant({
    to: ['app-user'],
    types: ['grant_items_schema.grant_items_type'],
    grantablePrivileges: ['USAGE'],
  });

  await db.grant({
    to: ['app-user'],
    domains: ['grant_items_schema.grant_items_domain'],
    grantablePrivileges: ['USAGE'],
  });

  await db.grant({
    to: ['app-user'],
    databases: ['orchid-orm'],
    grantablePrivileges: ['CREATE'],
  });

  await db.grant({
    to: ['app-user'],
    databases: ['orchid-orm'],
    privileges: ['CONNECT'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_all_items_schema.grant_all_items_table'],
    grantablePrivileges: ['DELETE'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_all_items_schema.grant_all_items_table'],
    privileges: ['UPDATE'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_all_items_schema.grant_all_items_table_id_seq'],
    grantablePrivileges: ['UPDATE'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_all_items_schema.grant_all_items_table_id_seq'],
    privileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    routines: ['grant_all_items_schema.grant_all_items_routine'],
    grantablePrivileges: ['EXECUTE'],
  });
});
`);

    assert.report(
      grantReport('USAGE', 'schemas grant_items_schema', grantee, true),
      grantReport('CREATE', 'schemas grant_items_schema', grantee),
      grantReport(
        'INSERT',
        'tables grant_items_schema.grant_items_table',
        grantee,
        true,
      ),
      grantReport(
        'SELECT',
        'tables grant_items_schema.grant_items_table',
        grantee,
      ),
      grantReport(
        'USAGE',
        'sequences grant_items_schema.grant_items_table_id_seq',
        grantee,
        true,
      ),
      grantReport(
        'SELECT',
        'sequences grant_items_schema.grant_items_table_id_seq',
        grantee,
      ),
      grantReport(
        'EXECUTE',
        'routines grant_items_schema.grant_items_routine',
        grantee,
        true,
      ),
      grantReport(
        'USAGE',
        'types grant_items_schema.grant_items_type',
        grantee,
        true,
      ),
      grantReport(
        'USAGE',
        'domains grant_items_schema.grant_items_domain',
        grantee,
        true,
      ),
      grantReport('CREATE', 'databases orchid-orm', grantee, true),
      grantReport('CONNECT', 'databases orchid-orm', grantee),
      grantReport(
        'DELETE',
        'tables grant_all_items_schema.grant_all_items_table',
        grantee,
        true,
      ),
      grantReport(
        'UPDATE',
        'tables grant_all_items_schema.grant_all_items_table',
        grantee,
      ),
      grantReport(
        'UPDATE',
        'sequences grant_all_items_schema.grant_all_items_table_id_seq',
        grantee,
        true,
      ),
      grantReport(
        'SELECT',
        'sequences grant_all_items_schema.grant_all_items_table_id_seq',
        grantee,
      ),
      grantReport(
        'EXECUTE',
        'routines grant_all_items_schema.grant_all_items_routine',
        grantee,
        true,
      ),
    );
  });

  it('should revoke table privileges missing from configured grants', async () => {
    await arrange({
      async prepareDb(db) {
        await prepareGrantTargets(db);
        await grantMatchingPrivileges(db, grantee);
      },
      tables: grantTables,
      dbOptions: {
        domains: {
          [`${grantSchema}.${grantDomain}`]: (t) => t.integer(),
        },
        grants: [...emptyGrantConfig(grantee), ...publicDefaultGrantConfig()],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.revoke({
    to: ['app-user'],
    databases: ['orchid-orm'],
    privileges: ['CONNECT'],
  });

  await db.revoke({
    to: ['app-user'],
    databases: ['orchid-orm'],
    grantablePrivileges: ['CREATE'],
  });

  await db.revoke({
    to: ['app-user'],
    domains: ['grant_items_schema.grant_items_domain'],
    grantablePrivileges: ['USAGE'],
  });

  await db.revoke({
    to: ['app-user'],
    routines: ['grant_all_items_schema.grant_all_items_routine'],
    grantablePrivileges: ['EXECUTE'],
  });

  await db.revoke({
    to: ['app-user'],
    routines: ['grant_items_schema.grant_items_routine'],
    grantablePrivileges: ['EXECUTE'],
  });

  await db.revoke({
    to: ['app-user'],
    schemas: ['grant_items_schema'],
    privileges: ['CREATE'],
  });

  await db.revoke({
    to: ['app-user'],
    schemas: ['grant_items_schema'],
    grantablePrivileges: ['USAGE'],
  });

  await db.revoke({
    to: ['app-user'],
    sequences: ['grant_all_items_schema.grant_all_items_table_id_seq'],
    privileges: ['SELECT'],
  });

  await db.revoke({
    to: ['app-user'],
    sequences: ['grant_all_items_schema.grant_all_items_table_id_seq'],
    grantablePrivileges: ['UPDATE'],
  });

  await db.revoke({
    to: ['app-user'],
    sequences: ['grant_items_schema.grant_items_table_id_seq'],
    privileges: ['SELECT'],
  });

  await db.revoke({
    to: ['app-user'],
    sequences: ['grant_items_schema.grant_items_table_id_seq'],
    grantablePrivileges: ['USAGE'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_all_items_schema.grant_all_items_table'],
    privileges: ['UPDATE'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_all_items_schema.grant_all_items_table'],
    grantablePrivileges: ['DELETE'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_items_schema.grant_items_table'],
    privileges: ['SELECT'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_items_schema.grant_items_table'],
    grantablePrivileges: ['INSERT'],
  });

  await db.revoke({
    to: ['app-user'],
    types: ['grant_items_schema.grant_items_type'],
    grantablePrivileges: ['USAGE'],
  });
});
`);

    assert.report(
      revokeReport('CONNECT', 'databases orchid-orm', grantee),
      revokeReport('CREATE', 'databases orchid-orm', grantee, true),
      revokeReport(
        'USAGE',
        'domains grant_items_schema.grant_items_domain',
        grantee,
        true,
      ),
      revokeReport(
        'EXECUTE',
        'routines grant_all_items_schema.grant_all_items_routine',
        grantee,
        true,
      ),
      revokeReport(
        'EXECUTE',
        'routines grant_items_schema.grant_items_routine',
        grantee,
        true,
      ),
      revokeReport('CREATE', 'schemas grant_items_schema', grantee),
      revokeReport('USAGE', 'schemas grant_items_schema', grantee, true),
      revokeReport(
        'SELECT',
        'sequences grant_all_items_schema.grant_all_items_table_id_seq',
        grantee,
      ),
      revokeReport(
        'UPDATE',
        'sequences grant_all_items_schema.grant_all_items_table_id_seq',
        grantee,
        true,
      ),
      revokeReport(
        'SELECT',
        'sequences grant_items_schema.grant_items_table_id_seq',
        grantee,
      ),
      revokeReport(
        'USAGE',
        'sequences grant_items_schema.grant_items_table_id_seq',
        grantee,
        true,
      ),
      revokeReport(
        'UPDATE',
        'tables grant_all_items_schema.grant_all_items_table',
        grantee,
      ),
      revokeReport(
        'DELETE',
        'tables grant_all_items_schema.grant_all_items_table',
        grantee,
        true,
      ),
      revokeReport(
        'SELECT',
        'tables grant_items_schema.grant_items_table',
        grantee,
      ),
      revokeReport(
        'INSERT',
        'tables grant_items_schema.grant_items_table',
        grantee,
        true,
      ),
      revokeReport(
        'USAGE',
        'types grant_items_schema.grant_items_type',
        grantee,
        true,
      ),
    );
  });

  it('should include default grantedBy in generated table grants and revokes', async () => {
    const verifyMigrationMock =
      verifyMigrationModule.verifyMigration as jest.MockedFunction<
        typeof verifyMigrationModule.verifyMigration
      >;
    verifyMigrationMock.mockResolvedValueOnce(undefined);

    await arrange({
      async prepareDb(db) {
        await prepareGrantByTable(db);
        await db.createRole(grantor);
        await grantTablePrivilegeAsGrantor(db);
      },
      tables: [GrantByTable],
      dbOptions: {
        roles: [{ name: grantor }],
        defaultGrantedBy: grantor,
        grants: [
          {
            to: grantee,
            tables: [grantByTableName],
            privileges: ['SELECT'],
          },
        ],
      },
    });

    await act();

    expect(verifyMigrationMock).toHaveBeenCalled();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    tables: ['grant_by_schema.grant_by_table'],
    privileges: ['SELECT'],
    grantedBy: 'grant_items_grantor',
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_by_schema.grant_by_table'],
    privileges: ['INSERT'],
    grantedBy: 'grant_items_grantor',
  });
});
`);

    assert.report(
      grantReport('SELECT', 'tables grant_by_schema.grant_by_table', grantee),
      revokeReport('INSERT', 'tables grant_by_schema.grant_by_table', grantee),
    );
  });

  it('should generate grants from table-local table metadata', async () => {
    await arrange({
      async prepareDb(db) {
        await prepareGrantByTable(db);
      },
      tables: [TableLocalGrantByTable],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    tables: ['grant_by_schema.grant_by_table'],
    privileges: ['SELECT'],
  });
});
`);

    assert.report(
      grantReport('SELECT', 'tables grant_by_schema.grant_by_table', grantee),
    );
  });

  it('should ignore table-local grants for definition-side generator ignored tables', async () => {
    class IgnoredTableLocalGrantByTable extends TableLocalGrantByTable {
      readonly generatorIgnore = true;
    }

    await arrange({
      async prepareDb(db) {
        await prepareGrantByTable(db);
      },
      tables: [IgnoredTableLocalGrantByTable],
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should merge table-local grants with top-level grant metadata', async () => {
    const verifyMigrationMock =
      verifyMigrationModule.verifyMigration as jest.MockedFunction<
        typeof verifyMigrationModule.verifyMigration
      >;
    verifyMigrationMock.mockResolvedValueOnce(undefined);

    await arrange({
      async prepareDb(db) {
        await prepareGrantByTable(db);
        await db.createRole(grantor);
      },
      tables: [TableLocalGrantableGrantByTable],
      dbOptions: {
        roles: [{ name: grantor }],
        defaultGrantedBy: grantor,
        grants: [
          {
            to: grantee,
            tables: [grantByTableName],
            privileges: ['UPDATE'],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    tables: ['grant_by_schema.grant_by_table'],
    grantablePrivileges: ['SELECT'],
    grantedBy: 'grant_items_grantor',
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_by_schema.grant_by_table'],
    privileges: ['UPDATE'],
    grantedBy: 'grant_items_grantor',
  });
});
`);

    assert.report(
      grantReport(
        'SELECT',
        'tables grant_by_schema.grant_by_table',
        grantee,
        true,
      ),
      grantReport('UPDATE', 'tables grant_by_schema.grant_by_table', grantee),
    );
  });

  it('should omit grantedBy from generated table grants and revokes without configured grantor', async () => {
    await arrange({
      async prepareDb(db) {
        await prepareGrantByTable(db);
        await db.grant({
          to: grantee,
          tables: [grantByTableName],
          privileges: ['INSERT'],
        });
      },
      tables: [GrantByTable],
      dbOptions: {
        grants: [
          {
            to: grantee,
            tables: [grantByTableName],
            privileges: ['SELECT'],
          },
        ],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    tables: ['grant_by_schema.grant_by_table'],
    privileges: ['SELECT'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_by_schema.grant_by_table'],
    privileges: ['INSERT'],
  });
});
`);

    assert.report(
      grantReport('SELECT', 'tables grant_by_schema.grant_by_table', grantee),
      revokeReport('INSERT', 'tables grant_by_schema.grant_by_table', grantee),
    );
  });

  it('should not change table grants when configured grants match db', async () => {
    await arrange({
      async prepareDb(db) {
        await prepareGrantTargets(db);
        await grantMatchingPrivileges(db, grantee);
      },
      tables: grantTables,
      dbOptions: {
        domains: {
          [`${grantSchema}.${grantDomain}`]: (t) => t.integer(),
        },
        grants: [...grantConfig(grantee), ...publicDefaultGrantConfig()],
      },
    });

    await act();

    assert.migration();
    assert.report('No changes were detected');
  });

  it('should reconcile different table grants and grant options', async () => {
    await arrange({
      async prepareDb(db) {
        await prepareGrantTargets(db);
        await grantReconciledPrivileges(db, grantee);
      },
      tables: grantTables,
      dbOptions: {
        domains: {
          [`${grantSchema}.${grantDomain}`]: (t) => t.integer(),
        },
        grants: [...grantConfig(grantee), ...publicDefaultGrantConfig()],
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['app-user'],
    schemas: ['grant_items_schema'],
    grantablePrivileges: ['USAGE'],
  });

  await db.revoke({
    to: ['app-user'],
    schemas: ['grant_items_schema'],
    grantablePrivileges: ['CREATE'],
  });

  await db.grant({
    to: ['app-user'],
    schemas: ['grant_items_schema'],
    privileges: ['CREATE'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_items_schema.grant_items_table'],
    grantablePrivileges: ['INSERT'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_items_schema.grant_items_table'],
    grantablePrivileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_items_schema.grant_items_table'],
    privileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_items_schema.grant_items_table_id_seq'],
    grantablePrivileges: ['USAGE'],
  });

  await db.revoke({
    to: ['app-user'],
    sequences: ['grant_items_schema.grant_items_table_id_seq'],
    grantablePrivileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_items_schema.grant_items_table_id_seq'],
    privileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    routines: ['grant_items_schema.grant_items_routine'],
    grantablePrivileges: ['EXECUTE'],
  });

  await db.grant({
    to: ['app-user'],
    types: ['grant_items_schema.grant_items_type'],
    grantablePrivileges: ['USAGE'],
  });

  await db.grant({
    to: ['app-user'],
    domains: ['grant_items_schema.grant_items_domain'],
    grantablePrivileges: ['USAGE'],
  });

  await db.grant({
    to: ['app-user'],
    databases: ['orchid-orm'],
    grantablePrivileges: ['CREATE'],
  });

  await db.revoke({
    to: ['app-user'],
    databases: ['orchid-orm'],
    grantablePrivileges: ['CONNECT'],
  });

  await db.grant({
    to: ['app-user'],
    databases: ['orchid-orm'],
    privileges: ['CONNECT'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_all_items_schema.grant_all_items_table'],
    grantablePrivileges: ['DELETE'],
  });

  await db.revoke({
    to: ['app-user'],
    tables: ['grant_all_items_schema.grant_all_items_table'],
    grantablePrivileges: ['UPDATE'],
  });

  await db.grant({
    to: ['app-user'],
    tables: ['grant_all_items_schema.grant_all_items_table'],
    privileges: ['UPDATE'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_all_items_schema.grant_all_items_table_id_seq'],
    grantablePrivileges: ['UPDATE'],
  });

  await db.revoke({
    to: ['app-user'],
    sequences: ['grant_all_items_schema.grant_all_items_table_id_seq'],
    grantablePrivileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    sequences: ['grant_all_items_schema.grant_all_items_table_id_seq'],
    privileges: ['SELECT'],
  });

  await db.grant({
    to: ['app-user'],
    routines: ['grant_all_items_schema.grant_all_items_routine'],
    grantablePrivileges: ['EXECUTE'],
  });
});
`);

    assert.report(
      grantReport('USAGE', 'schemas grant_items_schema', grantee, true),
      revokeReport('CREATE', 'schemas grant_items_schema', grantee, true),
      grantReport('CREATE', 'schemas grant_items_schema', grantee),
      grantReport(
        'INSERT',
        'tables grant_items_schema.grant_items_table',
        grantee,
        true,
      ),
      revokeReport(
        'SELECT',
        'tables grant_items_schema.grant_items_table',
        grantee,
        true,
      ),
      grantReport(
        'SELECT',
        'tables grant_items_schema.grant_items_table',
        grantee,
      ),
      grantReport(
        'USAGE',
        'sequences grant_items_schema.grant_items_table_id_seq',
        grantee,
        true,
      ),
      revokeReport(
        'SELECT',
        'sequences grant_items_schema.grant_items_table_id_seq',
        grantee,
        true,
      ),
      grantReport(
        'SELECT',
        'sequences grant_items_schema.grant_items_table_id_seq',
        grantee,
      ),
      grantReport(
        'EXECUTE',
        'routines grant_items_schema.grant_items_routine',
        grantee,
        true,
      ),
      grantReport(
        'USAGE',
        'types grant_items_schema.grant_items_type',
        grantee,
        true,
      ),
      grantReport(
        'USAGE',
        'domains grant_items_schema.grant_items_domain',
        grantee,
        true,
      ),
      grantReport('CREATE', 'databases orchid-orm', grantee, true),
      revokeReport('CONNECT', 'databases orchid-orm', grantee, true),
      grantReport('CONNECT', 'databases orchid-orm', grantee),
      grantReport(
        'DELETE',
        'tables grant_all_items_schema.grant_all_items_table',
        grantee,
        true,
      ),
      revokeReport(
        'UPDATE',
        'tables grant_all_items_schema.grant_all_items_table',
        grantee,
        true,
      ),
      grantReport(
        'UPDATE',
        'tables grant_all_items_schema.grant_all_items_table',
        grantee,
      ),
      grantReport(
        'UPDATE',
        'sequences grant_all_items_schema.grant_all_items_table_id_seq',
        grantee,
        true,
      ),
      revokeReport(
        'SELECT',
        'sequences grant_all_items_schema.grant_all_items_table_id_seq',
        grantee,
        true,
      ),
      grantReport(
        'SELECT',
        'sequences grant_all_items_schema.grant_all_items_table_id_seq',
        grantee,
      ),
      grantReport(
        'EXECUTE',
        'routines grant_all_items_schema.grant_all_items_routine',
        grantee,
        true,
      ),
    );
  });

  it('should ignore configured and actual table grants', async () => {
    const exactSchema = 'grant_exact_schema';
    const regexSchema = 'grant_regex_schema';
    const keepSchema = 'grant_keep_schema';
    const allStringSchema = 'grant_all_string';
    const allRegexSchema = 'grant_all_regex';

    const exactTable = 'grant_exact_table';
    const regexTable = 'grant_regex_table';
    const keepTable = 'grant_keep_table';
    const allStringTable = 'grant_all_string_table';
    const allRegexTable = 'grant_all_regex_table';

    const exactRole = 'grant_exact_role';
    const regexRole = 'grant_regex_role';
    const keepRole = 'grant_keep_role';

    const exactType = 'grant_exact_type';
    const regexType = 'grant_regex_type';
    const keepType = 'grant_keep_type';

    const exactDomain = 'grant_exact_domain';
    const regexDomain = 'grant_regex_domain';
    const keepDomain = 'grant_keep_domain';

    const exactRoutine = 'grant_exact_routine';
    const regexRoutine = 'grant_regex_routine';
    const keepRoutine = 'grant_keep_routine';

    const database = 'orchid-orm';
    const generateDatabase = `orchid-orm-generate-${
      process.env.JEST_WORKER_ID ?? '1'
    }`;

    const ExactTableBase = table(
      (t) => ({
        id: t.serial().primaryKey(),
        type: t.enum(`${exactSchema}.${exactType}`, ['one', 'two']),
      }),
      undefined,
      { name: exactTable, schema: exactSchema, noPrimaryKey: false },
    );
    class ExactTable extends ExactTableBase {}

    const RegexTableBase = table(
      (t) => ({
        id: t.serial().primaryKey(),
        type: t.enum(`${regexSchema}.${regexType}`, ['one', 'two']),
      }),
      undefined,
      { name: regexTable, schema: regexSchema, noPrimaryKey: false },
    );
    class RegexTable extends RegexTableBase {}

    const KeepTableBase = table(
      (t) => ({
        id: t.serial().primaryKey(),
        type: t.enum(`${keepSchema}.${keepType}`, ['one', 'two']),
      }),
      undefined,
      { name: keepTable, schema: keepSchema, noPrimaryKey: false },
    );
    class KeepTable extends KeepTableBase {}

    const AllStringTableBase = table(
      (t) => ({
        id: t.serial().primaryKey(),
      }),
      undefined,
      { name: allStringTable, schema: allStringSchema, noPrimaryKey: false },
    );
    class AllStringTable extends AllStringTableBase {}

    const AllRegexTableBase = table(
      (t) => ({
        id: t.serial().primaryKey(),
      }),
      undefined,
      { name: allRegexTable, schema: allRegexSchema, noPrimaryKey: false },
    );
    class AllRegexTable extends AllRegexTableBase {}

    await arrange({
      async prepareDb(db) {
        for (const role of [exactRole, regexRole, keepRole]) {
          await db.createRole(role);
        }

        for (const schema of [
          exactSchema,
          regexSchema,
          keepSchema,
          allStringSchema,
          allRegexSchema,
        ]) {
          await db.createSchema(schema);
        }

        await db.query`CREATE TYPE grant_exact_schema.grant_exact_type AS ENUM ('one', 'two')`;
        await db.query`CREATE TYPE grant_regex_schema.grant_regex_type AS ENUM ('one', 'two')`;
        await db.query`CREATE TYPE grant_keep_schema.grant_keep_type AS ENUM ('one', 'two')`;

        await db.createDomain(`${exactSchema}.${exactDomain}`, (t) =>
          t.integer(),
        );
        await db.createDomain(`${regexSchema}.${regexDomain}`, (t) =>
          t.integer(),
        );
        await db.createDomain(`${keepSchema}.${keepDomain}`, (t) =>
          t.integer(),
        );

        await db.createTable(`${exactSchema}.${exactTable}`, (t) => ({
          id: t.serial().primaryKey(),
          type: t.enum(`${exactSchema}.${exactType}`),
        }));
        await db.createTable(`${regexSchema}.${regexTable}`, (t) => ({
          id: t.serial().primaryKey(),
          type: t.enum(`${regexSchema}.${regexType}`),
        }));
        await db.createTable(`${keepSchema}.${keepTable}`, (t) => ({
          id: t.serial().primaryKey(),
          type: t.enum(`${keepSchema}.${keepType}`),
        }));
        await db.createTable(`${allStringSchema}.${allStringTable}`, (t) => ({
          id: t.serial().primaryKey(),
        }));
        await db.createTable(`${allRegexSchema}.${allRegexTable}`, (t) => ({
          id: t.serial().primaryKey(),
        }));

        await db.query`CREATE FUNCTION grant_exact_schema.grant_exact_routine() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$`;
        await db.query`CREATE FUNCTION grant_regex_schema.grant_regex_routine() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$`;
        await db.query`CREATE FUNCTION grant_keep_schema.grant_keep_routine() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$`;
        await db.query`CREATE FUNCTION grant_all_string.grant_all_string_routine() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$`;
        await db.query`CREATE FUNCTION grant_all_regex.grant_all_regex_routine() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$`;

        await db.grant({
          to: keepRole,
          schemas: [exactSchema],
          privileges: ['CREATE'],
        });
        await db.grant({
          to: keepRole,
          schemas: [regexSchema],
          privileges: ['CREATE'],
        });
        await db.grant({
          to: keepRole,
          tables: [`${exactSchema}.${exactTable}`],
          privileges: ['INSERT'],
        });
        await db.grant({
          to: keepRole,
          tables: [`${regexSchema}.${regexTable}`],
          privileges: ['INSERT'],
        });
        await db.grant({
          to: exactRole,
          tables: [`${keepSchema}.${keepTable}`],
          privileges: ['INSERT'],
        });
        await db.grant({
          to: regexRole,
          tables: [`${keepSchema}.${keepTable}`],
          privileges: ['INSERT'],
        });
        await db.grant({
          to: keepRole,
          sequences: [`${exactSchema}.${exactTable}_id_seq`],
          privileges: ['SELECT'],
        });
        await db.grant({
          to: keepRole,
          sequences: [`${regexSchema}.${regexTable}_id_seq`],
          privileges: ['SELECT'],
        });
        await db.grant({
          to: keepRole,
          types: [`${exactSchema}.${exactType}`],
          grantablePrivileges: ['USAGE'],
        });
        await db.grant({
          to: keepRole,
          types: [`${regexSchema}.${regexType}`],
          grantablePrivileges: ['USAGE'],
        });
        await db.grant({
          to: keepRole,
          domains: [`${exactSchema}.${exactDomain}`],
          grantablePrivileges: ['USAGE'],
        });
        await db.grant({
          to: keepRole,
          domains: [`${regexSchema}.${regexDomain}`],
          grantablePrivileges: ['USAGE'],
        });
        await db.grant({
          to: keepRole,
          databases: [database],
          grantablePrivileges: ['CONNECT'],
        });
        await db.grant({
          to: keepRole,
          databases: [generateDatabase],
          grantablePrivileges: ['CONNECT'],
        });
        await db.grant({
          to: keepRole,
          tables: [
            `${allStringSchema}.${allStringTable}`,
            `${allRegexSchema}.${allRegexTable}`,
          ],
          privileges: ['INSERT'],
        });
        await db.grant({
          to: keepRole,
          sequences: [
            `${allStringSchema}.${allStringTable}_id_seq`,
            `${allRegexSchema}.${allRegexTable}_id_seq`,
          ],
          privileges: ['SELECT'],
        });

        await db.query`GRANT EXECUTE ON FUNCTION grant_exact_schema.grant_exact_routine() TO grant_keep_role WITH GRANT OPTION`;
        await db.query`GRANT EXECUTE ON FUNCTION grant_regex_schema.grant_regex_routine() TO grant_keep_role WITH GRANT OPTION`;
        await db.query`GRANT EXECUTE ON FUNCTION grant_all_string.grant_all_string_routine() TO grant_keep_role`;
        await db.query`GRANT EXECUTE ON FUNCTION grant_all_regex.grant_all_regex_routine() TO grant_keep_role`;
      },
      tables: [
        ExactTable,
        RegexTable,
        KeepTable,
        AllStringTable,
        AllRegexTable,
      ],
      dbOptions: {
        roles: [{ name: exactRole }, { name: regexRole }, { name: keepRole }],
        domains: {
          [`${exactSchema}.${exactDomain}`]: (t) => t.integer(),
          [`${regexSchema}.${regexDomain}`]: (t) => t.integer(),
          [`${keepSchema}.${keepDomain}`]: (t) => t.integer(),
        },
        grants: [
          {
            to: keepRole,
            schemas: [exactSchema],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            schemas: [regexSchema],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            schemas: [keepSchema],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            tables: [`${exactSchema}.${exactTable}`],
            privileges: ['SELECT'],
          },
          {
            to: keepRole,
            tables: [`${regexSchema}.${regexTable}`],
            privileges: ['SELECT'],
          },
          {
            to: keepRole,
            tables: [`${keepSchema}.${keepTable}`],
            privileges: ['SELECT'],
          },
          {
            to: exactRole,
            tables: [`${keepSchema}.${keepTable}`],
            privileges: ['SELECT'],
          },
          {
            to: regexRole,
            tables: [`${keepSchema}.${keepTable}`],
            privileges: ['SELECT'],
          },
          {
            to: keepRole,
            sequences: [`${exactSchema}.${exactTable}_id_seq`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            sequences: [`${regexSchema}.${regexTable}_id_seq`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            sequences: [`${keepSchema}.${keepTable}_id_seq`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            routines: [`${exactSchema}.${exactRoutine}`],
            privileges: ['EXECUTE'],
          },
          {
            to: keepRole,
            routines: [`${regexSchema}.${regexRoutine}`],
            privileges: ['EXECUTE'],
          },
          {
            to: keepRole,
            routines: [`${keepSchema}.${keepRoutine}`],
            privileges: ['EXECUTE'],
          },
          {
            to: keepRole,
            types: [`${exactSchema}.${exactType}`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            types: [`${regexSchema}.${regexType}`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            types: [`${keepSchema}.${keepType}`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            domains: [`${exactSchema}.${exactDomain}`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            domains: [`${regexSchema}.${regexDomain}`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            domains: [`${keepSchema}.${keepDomain}`],
            privileges: ['USAGE'],
          },
          {
            to: 'PUBLIC',
            types: [`${keepSchema}.${keepType}`],
            domains: [`${keepSchema}.${keepDomain}`],
            privileges: ['USAGE'],
          },
          {
            to: keepRole,
            databases: [database],
            privileges: ['CONNECT'],
          },
          {
            to: keepRole,
            databases: [generateDatabase],
            privileges: ['CONNECT'],
          },
          {
            to: keepRole,
            allTablesIn: [allStringSchema, allRegexSchema],
            privileges: ['INSERT'],
          },
          {
            to: keepRole,
            allSequencesIn: [allStringSchema, allRegexSchema],
            privileges: ['SELECT'],
          },
          {
            to: keepRole,
            allRoutinesIn: [allStringSchema, allRegexSchema],
            privileges: ['EXECUTE'],
          },
        ],
        generatorIgnore: {
          grants: {
            roles: [exactRole, /^grant_regex_role$/],
            schemas: [exactSchema, /^grant_regex_schema$/],
            tables: [`${exactSchema}.${exactTable}`, /^grant_regex_table$/],
            sequences: [
              `${exactSchema}.${exactTable}_id_seq`,
              /^grant_regex_table_id_seq$/,
            ],
            routines: [
              `${exactSchema}.${exactRoutine}`,
              /^grant_regex_routine$/,
            ],
            types: [`${exactSchema}.${exactType}`, /^grant_regex_type$/],
            domains: [`${exactSchema}.${exactDomain}`, /^grant_regex_domain$/],
            databases: [database, /^orchid-orm-generate-\d+$/],
            allTablesIn: [allStringSchema, /^grant_all_regex$/],
            allSequencesIn: [allStringSchema, /^grant_all_regex$/],
            allRoutinesIn: [allStringSchema, /^grant_all_regex$/],
          },
        },
      },
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: ['grant_keep_role'],
    schemas: ['grant_keep_schema'],
    privileges: ['USAGE'],
  });

  await db.grant({
    to: ['grant_keep_role'],
    tables: ['grant_keep_schema.grant_keep_table'],
    privileges: ['SELECT'],
  });

  await db.grant({
    to: ['grant_keep_role'],
    sequences: ['grant_keep_schema.grant_keep_table_id_seq'],
    privileges: ['USAGE'],
  });

  await db.grant({
    to: ['grant_keep_role'],
    routines: ['grant_keep_schema.grant_keep_routine'],
    privileges: ['EXECUTE'],
  });

  await db.grant({
    to: ['grant_keep_role'],
    types: ['grant_keep_schema.grant_keep_type'],
    privileges: ['USAGE'],
  });

  await db.grant({
    to: ['grant_keep_role'],
    domains: ['grant_keep_schema.grant_keep_domain'],
    privileges: ['USAGE'],
  });
});
`);

    assert.report(
      `${green(
        '+ grant privileges',
      )} USAGE on schemas grant_keep_schema to grant_keep_role`,
      `${green(
        '+ grant privileges',
      )} SELECT on tables grant_keep_schema.grant_keep_table to grant_keep_role`,
      `${green(
        '+ grant privileges',
      )} USAGE on sequences grant_keep_schema.grant_keep_table_id_seq to grant_keep_role`,
      `${green(
        '+ grant privileges',
      )} EXECUTE on routines grant_keep_schema.grant_keep_routine to grant_keep_role`,
      `${green(
        '+ grant privileges',
      )} USAGE on types grant_keep_schema.grant_keep_type to grant_keep_role`,
      `${green(
        '+ grant privileges',
      )} USAGE on domains grant_keep_schema.grant_keep_domain to grant_keep_role`,
    );
  });
});
