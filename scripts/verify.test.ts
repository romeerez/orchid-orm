const { deepStrictEqual, strictEqual } = require('node:assert');
const { test } = require('node:test');
const {
  buildCommands,
  formatDebugInfo,
  formatResult,
  getChangedPackages,
  hasAdapterChange,
  getPackageInfos,
} = require('./verify.ts');

const allPackageNames = [
  'create-orchid-orm',
  'orchid-orm',
  'pqb',
  'rake-db',
  'orchid-orm-schema-to-zod',
  'orchid-orm-valibot',
  'orchid-orm-test-factory',
];

test('selects changed packages and their dependents from non-md tracked paths', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    [
      'packages/pqb/src/query.ts',
      'packages/pqb/readme.md',
      'packages/create-orm/readme.md',
      'docs/src/guide/intro.md',
    ],
    packages,
  );

  deepStrictEqual(affected, {
    changed: ['pqb'],
    dependents: [
      'orchid-orm',
      'rake-db',
      'orchid-orm-schema-to-zod',
      'orchid-orm-valibot',
      'orchid-orm-test-factory',
    ],
  });
});

test('selects all packages for test-utils changes', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    ['packages/test-utils/src/test-utils.ts'],
    packages,
  );

  deepStrictEqual(affected, {
    changed: [],
    dependents: allPackageNames,
  });
});

test('selects all packages for root and script changes', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(['scripts/ai-sync.ts'], packages);

  deepStrictEqual(affected, {
    changed: [],
    dependents: allPackageNames,
  });
});

test('ignores verify script changes', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    ['scripts/verify.ts', 'scripts/verify.test.ts'],
    packages,
  );

  deepStrictEqual(affected, {
    changed: [],
    dependents: [],
  });
});

test('ignores package and build config changes', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    [
      'package.json',
      'packages/pqb/package.json',
      'rolldown.config.mjs',
      'packages/orm/rolldown.config.mjs',
      'rolldown.utils.mjs',
      'pnpm-lock.yaml',
      'turbo.json',
    ],
    packages,
  );

  deepStrictEqual(affected, {
    changed: [],
    dependents: [],
  });
});

test('selects all packages for code changes outside relevant package directories', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(['jest.config.mjs'], packages);

  deepStrictEqual(affected, {
    changed: [],
    dependents: allPackageNames,
  });
});

test('ignores files with non-verification extensions outside relevant package directories', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    ['docs/src/guide/intro.md', '.nvmrc', 'README'],
    packages,
  );

  deepStrictEqual(affected, {
    changed: [],
    dependents: [],
  });
});

test('uses package names in grouped pnpm commands', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    [
      'packages/schemaConfigs/zod/src/index.ts',
      'packages/rake-db/src/migration.ts',
    ],
    packages,
  );

  deepStrictEqual(buildCommands(affected), [
    {
      label: 'changed checks',
      type: 'tests',
      packages: [
        { name: 'rake-db', folderName: 'rake-db', role: 'changed' },
        {
          name: 'orchid-orm-schema-to-zod',
          folderName: 'zod',
          role: 'changed',
        },
      ],
      args: [
        'pnpm',
        '--filter',
        'rake-db',
        '--filter',
        'orchid-orm-schema-to-zod',
        'check',
        '-o',
      ],
    },
    {
      label: 'dependent checks',
      type: 'tests',
      packages: [
        { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: [
        'pnpm',
        '--filter',
        'orchid-orm',
        '--filter',
        'orchid-orm-test-factory',
        'check',
      ],
    },
    {
      label: 'types',
      type: 'types',
      packages: [
        { name: 'rake-db', folderName: 'rake-db', role: 'changed' },
        {
          name: 'orchid-orm-schema-to-zod',
          folderName: 'zod',
          role: 'changed',
        },
        { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: [
        'pnpm',
        '--filter',
        'rake-db',
        '--filter',
        'orchid-orm-schema-to-zod',
        '--filter',
        'orchid-orm',
        '--filter',
        'orchid-orm-test-factory',
        'types',
      ],
    },
  ]);
});

test('formats concise debug info for affected packages', async () => {
  const packages = await getPackageInfos();
  const changedFiles = [
    'packages/pqb/src/query.ts',
    'packages/pqb/src/adapters/postgres-js.ts',
    'packages/pqb/package.json',
    'docs/src/guide/intro.md',
  ];
  const affected = getChangedPackages(changedFiles, packages);

  strictEqual(
    formatDebugInfo(changedFiles, packages, affected),
    [
      'Debug:',
      '  Changed files considered:',
      '    packages/pqb/src/query.ts -> changed package pqb',
      '    packages/pqb/src/adapters/postgres-js.ts -> changed package pqb',
      '  Ignored changed files: 2',
      '    packages/pqb/package.json',
      '    docs/src/guide/intro.md',
      '  Adapter matrix: enabled by packages/pqb/src/adapters/postgres-js.ts',
      '  Packages:',
      '    changed: pqb',
      '    dependent: orm, rake-db, zod, valibot, test-factory',
    ].join('\n'),
  );
});

test('formats debug info for global changes', async () => {
  const packages = await getPackageInfos();
  const changedFiles = ['jest.config.mjs'];
  const affected = getChangedPackages(changedFiles, packages);

  strictEqual(
    formatDebugInfo(changedFiles, packages, affected),
    [
      'Debug:',
      '  Changed files considered:',
      '    jest.config.mjs -> global change outside tracked packages',
      '  Adapter matrix: disabled',
      '  Packages:',
      '    global: create-orm, orm, pqb, rake-db, zod, valibot, test-factory',
    ].join('\n'),
  );
});

test('detects adapter folder changes', () => {
  strictEqual(
    hasAdapterChange(['packages/pqb/src/adapters/postgres-js.ts']),
    true,
  );
  strictEqual(hasAdapterChange(['packages/pqb/src/query.ts']), false);
  strictEqual(hasAdapterChange(['scripts/verify.ts']), false);
});

test('uses all adapters for adapter changes', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    ['packages/orm/src/adapters/postgres-js.ts'],
    packages,
  );

  deepStrictEqual(buildCommands(affected, { allAdapters: true }), [
    {
      label: 'changed checks',
      type: 'tests',
      adapter: 'postgres-js',
      packages: [{ name: 'orchid-orm', folderName: 'orm', role: 'changed' }],
      args: ['pnpm', '--filter', 'orchid-orm', 'check', '-o'],
    },
    {
      label: 'changed checks node-postgres',
      type: 'tests',
      adapter: 'node-postgres',
      env: { ADAPTER: 'node-postgres' },
      packages: [{ name: 'orchid-orm', folderName: 'orm', role: 'changed' }],
      args: ['pnpm', '--filter', 'orchid-orm', 'check', '-o'],
    },
    {
      label: 'changed checks bun',
      type: 'tests',
      adapter: 'bun',
      env: { ADAPTER: 'bun' },
      packages: [{ name: 'orchid-orm', folderName: 'orm', role: 'changed' }],
      args: ['pnpm', '--filter', 'orchid-orm', 'bun:check', '-o'],
    },
    {
      label: 'dependent checks',
      type: 'tests',
      adapter: 'postgres-js',
      packages: [
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: ['pnpm', '--filter', 'orchid-orm-test-factory', 'check'],
    },
    {
      label: 'dependent checks node-postgres',
      type: 'tests',
      adapter: 'node-postgres',
      env: { ADAPTER: 'node-postgres' },
      packages: [
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: ['pnpm', '--filter', 'orchid-orm-test-factory', 'check'],
    },
    {
      label: 'dependent checks bun',
      type: 'tests',
      adapter: 'bun',
      env: { ADAPTER: 'bun' },
      packages: [
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: ['pnpm', '--filter', 'orchid-orm-test-factory', 'bun:check'],
    },
    {
      label: 'types',
      type: 'types',
      packages: [
        { name: 'orchid-orm', folderName: 'orm', role: 'changed' },
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: [
        'pnpm',
        '--filter',
        'orchid-orm',
        '--filter',
        'orchid-orm-test-factory',
        'types',
      ],
    },
  ]);
});

test('keeps non-adapter-aware dependents on regular checks for adapter changes', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    ['packages/pqb/src/adapters/postgres-js.ts'],
    packages,
  );
  const commands = buildCommands(affected, { allAdapters: true });

  const regularDependentCommand = commands.find(
    (command) => command.label === 'dependent checks' && !command.adapter,
  );

  deepStrictEqual(regularDependentCommand, {
    label: 'dependent checks',
    type: 'tests',
    packages: [
      {
        name: 'orchid-orm-schema-to-zod',
        folderName: 'zod',
        role: 'dependent',
      },
      {
        name: 'orchid-orm-valibot',
        folderName: 'valibot',
        role: 'dependent',
      },
    ],
    args: [
      'pnpm',
      '--filter',
      'orchid-orm-schema-to-zod',
      '--filter',
      'orchid-orm-valibot',
      'check',
    ],
  });

  strictEqual(
    commands.some(
      (command) =>
        command.args.includes('bun:check') &&
        command.packages.some((pkg) => pkg.name === 'orchid-orm-schema-to-zod'),
    ),
    false,
  );
});

test('uses full checks for global changes', async () => {
  const packages = await getPackageInfos();
  const affected = getChangedPackages(
    ['packages/test-utils/src/test-utils.ts'],
    packages,
  );

  deepStrictEqual(buildCommands(affected), [
    {
      label: 'dependent checks',
      type: 'tests',
      packages: [
        {
          name: 'create-orchid-orm',
          folderName: 'create-orm',
          role: 'dependent',
        },
        { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        { name: 'pqb', folderName: 'pqb', role: 'dependent' },
        { name: 'rake-db', folderName: 'rake-db', role: 'dependent' },
        {
          name: 'orchid-orm-schema-to-zod',
          folderName: 'zod',
          role: 'dependent',
        },
        {
          name: 'orchid-orm-valibot',
          folderName: 'valibot',
          role: 'dependent',
        },
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: [
        'pnpm',
        '--filter',
        'create-orchid-orm',
        '--filter',
        'orchid-orm',
        '--filter',
        'pqb',
        '--filter',
        'rake-db',
        '--filter',
        'orchid-orm-schema-to-zod',
        '--filter',
        'orchid-orm-valibot',
        '--filter',
        'orchid-orm-test-factory',
        'check',
      ],
    },
    {
      label: 'types',
      type: 'types',
      packages: [
        {
          name: 'create-orchid-orm',
          folderName: 'create-orm',
          role: 'dependent',
        },
        { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        { name: 'pqb', folderName: 'pqb', role: 'dependent' },
        { name: 'rake-db', folderName: 'rake-db', role: 'dependent' },
        {
          name: 'orchid-orm-schema-to-zod',
          folderName: 'zod',
          role: 'dependent',
        },
        {
          name: 'orchid-orm-valibot',
          folderName: 'valibot',
          role: 'dependent',
        },
        {
          name: 'orchid-orm-test-factory',
          folderName: 'test-factory',
          role: 'dependent',
        },
      ],
      args: [
        'pnpm',
        '--filter',
        'create-orchid-orm',
        '--filter',
        'orchid-orm',
        '--filter',
        'pqb',
        '--filter',
        'rake-db',
        '--filter',
        'orchid-orm-schema-to-zod',
        '--filter',
        'orchid-orm-valibot',
        '--filter',
        'orchid-orm-test-factory',
        'types',
      ],
    },
  ]);
});

test('prints output only for failed commands and summarizes packages', () => {
  const output = formatResult([
    {
      command: {
        label: 'changed checks',
        type: 'tests',
        packages: [{ name: 'pqb', folderName: 'pqb', role: 'changed' }],
        args: ['pnpm', '--filter', 'pqb', 'check', '-o'],
      },
      exitCode: 0,
      output: 'passing test output',
    },
    {
      command: {
        label: 'types',
        type: 'types',
        packages: [
          { name: 'pqb', folderName: 'pqb', role: 'changed' },
          { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        ],
        args: ['pnpm', '--filter', 'pqb', '--filter', 'orchid-orm', 'types'],
      },
      exitCode: 1,
      output: 'type error output',
    },
  ]);

  strictEqual(
    output,
    ['type error output', '', 'Verified tests: pqb', 'Failed types: pqb'].join(
      '\n',
    ),
  );
});

test('prints a no packages message when there are no commands to report', () => {
  strictEqual(formatResult([]), 'Verified: no packages affected');
});

test('suppresses dependent failure output when changed tests fail', () => {
  const output = formatResult([
    {
      command: {
        label: 'changed checks',
        type: 'tests',
        packages: [{ name: 'pqb', folderName: 'pqb', role: 'changed' }],
        args: ['pnpm', '--filter', 'pqb', 'check', '-o'],
      },
      exitCode: 1,
      output: 'changed test output',
    },
    {
      command: {
        label: 'dependent checks',
        type: 'tests',
        packages: [
          { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        ],
        args: ['pnpm', '--filter', 'orchid-orm', 'check'],
      },
      exitCode: 1,
      output: 'dependent test output',
    },
  ]);

  strictEqual(output, 'changed test output\n\nFailed tests: pqb');
});

test('reports dependent failures when changed package succeeds', () => {
  const output = formatResult([
    {
      command: {
        label: 'changed checks',
        type: 'tests',
        packages: [{ name: 'pqb', folderName: 'pqb', role: 'changed' }],
        args: ['pnpm', '--filter', 'pqb', 'check', '-o'],
      },
      exitCode: 0,
      output: '',
    },
    {
      command: {
        label: 'dependent checks',
        type: 'tests',
        packages: [
          { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        ],
        args: ['pnpm', '--filter', 'orchid-orm', 'check'],
      },
      exitCode: 1,
      output: 'dependent test output',
    },
  ]);

  strictEqual(
    output,
    'dependent test output\n\nVerified tests: pqb\nFailed tests: orm',
  );
});

test('reports multi-adapter test failures by adapter', () => {
  const output = formatResult([
    {
      command: {
        label: 'changed checks',
        type: 'tests',
        adapter: 'postgres-js',
        packages: [{ name: 'pqb', folderName: 'pqb', role: 'changed' }],
        args: ['pnpm', '--filter', 'pqb', 'check', '-o'],
      },
      exitCode: 0,
      output: '',
    },
    {
      command: {
        label: 'changed checks node-postgres',
        type: 'tests',
        adapter: 'node-postgres',
        packages: [{ name: 'pqb', folderName: 'pqb', role: 'changed' }],
        args: ['pnpm', '--filter', 'pqb', 'check', '-o'],
      },
      exitCode: 1,
      output: 'node-postgres failure',
    },
  ]);

  strictEqual(
    output,
    'node-postgres failure\n\nFailed under node-postgres adapter: pqb',
  );
});

test('reports only the shortest package output for grouped failures', () => {
  const output = formatResult([
    {
      command: {
        label: 'dependent checks',
        type: 'tests',
        packages: [
          { name: 'pqb', folderName: 'pqb', role: 'dependent' },
          { name: 'orchid-orm', folderName: 'orm', role: 'dependent' },
        ],
        args: ['pnpm', '--filter', 'pqb', '--filter', 'orchid-orm', 'check'],
      },
      exitCode: 1,
      output: [
        'Scope: 2 of 11 workspace projects',
        'packages/pqb check$ jest',
        'packages/pqb check: long failure line',
        'packages/pqb check: another long failure line',
        'packages/pqb check: Failed',
        'packages/orm check$ jest',
        'packages/orm check: short failure',
        'packages/orm check: Failed',
      ].join('\n'),
    },
  ]);

  strictEqual(
    output,
    [
      'packages/orm check$ jest',
      'packages/orm check: short failure',
      'packages/orm check: Failed',
      '',
      'Failed tests: orm',
    ].join('\n'),
  );
});

test('reports only the shortest failure section within a package output', () => {
  const output = formatResult([
    {
      command: {
        label: 'dependent checks',
        type: 'tests',
        packages: [{ name: 'pqb', folderName: 'pqb', role: 'dependent' }],
        args: ['pnpm', '--filter', 'pqb', 'check'],
      },
      exitCode: 1,
      output: [
        'packages/pqb check$ jest',
        'packages/pqb check: FAIL long.test.ts',
        'packages/pqb check:   first long line',
        'packages/pqb check:   second long line',
        'packages/pqb check: FAIL short.test.ts',
        'packages/pqb check:   short line',
        'packages/pqb check: Test Suites: 2 failed, 2 total',
        'packages/pqb check: Failed',
      ].join('\n'),
    },
  ]);

  strictEqual(
    output,
    [
      'packages/pqb check$ jest',
      'packages/pqb check: FAIL short.test.ts',
      'packages/pqb check:   short line',
      '',
      'Failed tests: pqb',
    ].join('\n'),
  );
});

test('does not verify a package that failed in mixed grouped output', () => {
  const output = formatResult([
    {
      command: {
        label: 'dependent checks',
        type: 'tests',
        packages: [
          {
            name: 'create-orchid-orm',
            folderName: 'create-orm',
            role: 'dependent',
          },
          { name: 'pqb', folderName: 'pqb', role: 'dependent' },
        ],
        args: [
          'pnpm',
          '--filter',
          'create-orchid-orm',
          '--filter',
          'pqb',
          'check',
        ],
      },
      exitCode: 1,
      output: [
        'packages/create-orm check$ jest',
        'packages/pqb check$ jest',
        'packages/create-orm check: Test Suites: 15 passed, 15 total',
        'packages/create-orm check: Done',
        'packages/pqb check: FAIL ./utils.test.ts',
        'packages/pqb check:   short line',
        'packages/pqb check: Failed',
      ].join('\n'),
    },
  ]);

  strictEqual(
    output,
    [
      'packages/pqb check$ jest',
      'packages/pqb check: FAIL ./utils.test.ts',
      'packages/pqb check:   short line',
      '',
      'Verified tests: create-orm',
      'Failed tests: pqb',
    ].join('\n'),
  );
});
