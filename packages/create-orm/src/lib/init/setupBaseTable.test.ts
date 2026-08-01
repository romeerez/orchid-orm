import fs from 'node:fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const tableFactoryPath = resolve(testInitConfig.dbDirPath, 'table-factory.ts');

const writeFile = mockFn(fs, 'writeFile');

const header = `// Set \`snakeCase\` to \`true\` if columns in your database are in snake_case.
  // snakeCase: true,
`;

const columnTypesComment = `// Customize column types for all tables.`;

describe('setupBaseTable', () => {
  beforeEach(jest.resetAllMocks);

  it('should create table factory', async () => {
    await initSteps.setupBaseTable(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === tableFactoryPath);
    expect(call?.[1]).toBe(`import { createTableFactory } from 'orchid-orm';

export const { defineTable, sql } = createTableFactory({
  ${header}
  ${columnTypesComment}
  // columnTypes: (t) => ({
  //   ...t,
  // }),
});
`);
  });

  it('should create table factory with zod schema provider if it is in config', async () => {
    await initSteps.setupBaseTable({ ...testInitConfig, validation: 'zod' });

    const call = writeFile.mock.calls.find(([to]) => to === tableFactoryPath);
    expect(call?.[1]).toBe(`import { createTableFactory } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const { defineTable, sql } = createTableFactory({
  ${header}
  schemaConfig: zodSchemaConfig,

  ${columnTypesComment}
  // columnTypes: (t) => ({
  //   ...t,
  // }),
});
`);
  });

  it('should create table factory with valibot schema provider if it is in config', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      validation: 'valibot',
    });

    const call = writeFile.mock.calls.find(([to]) => to === tableFactoryPath);
    expect(call?.[1]).toBe(`import { createTableFactory } from 'orchid-orm';
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const { defineTable, sql } = createTableFactory({
  ${header}
  schemaConfig: valibotSchemaConfig,

  ${columnTypesComment}
  // columnTypes: (t) => ({
  //   ...t,
  // }),
});
`);
  });

  it('should create table factory with timestamp as date', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'date',
      validation: 'no',
    });

    const call = writeFile.mock.calls.find(([to]) => to === tableFactoryPath);
    expect(call?.[1]).toBe(`import { createTableFactory } from 'orchid-orm';

export const { defineTable, sql } = createTableFactory({
  ${header}
  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to Date object.
    timestamp: (precision?: number) => t.timestamp(precision).asDate(),
  }),
});
`);
  });

  it('should create table factory with timestamp as number', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'number',
      validation: 'no',
    });

    const call = writeFile.mock.calls.find(([to]) => to === tableFactoryPath);
    expect(call?.[1]).toBe(`import { createTableFactory } from 'orchid-orm';

export const { defineTable, sql } = createTableFactory({
  ${header}
  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to number.
    timestamp: (precision?: number) => t.timestamp(precision).asNumber(),
  }),
});
`);
  });
});
