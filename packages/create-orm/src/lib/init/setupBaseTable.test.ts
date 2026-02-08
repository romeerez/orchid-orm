import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const baseTablePath = resolve(testInitConfig.dbDirPath, 'base-table.ts');

const writeFile = mockFn(fs, 'writeFile');

const header = `// Set \`snakeCase\` to \`true\` if columns in your database are in snake_case.
  // snakeCase: true,
`;

const columnTypesComment = `// Customize column types for all tables.`;

describe('setupBaseTable', () => {
  beforeEach(jest.resetAllMocks);

  it('should create base table', async () => {
    await initSteps.setupBaseTable(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${header}
  ${columnTypesComment}
  // columnTypes: (t) => ({
  //   ...t,
  // }),
});

export const { sql } = BaseTable;
`);
  });

  it('should create base table with zod schema provider if it is in config', async () => {
    await initSteps.setupBaseTable({ ...testInitConfig, validation: 'zod' });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  ${header}
  schemaConfig: zodSchemaConfig,

  ${columnTypesComment}
  // columnTypes: (t) => ({
  //   ...t,
  // }),
});

export const { sql } = BaseTable;
`);
  });

  it('should create base table with valibot schema provider if it is in config', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      validation: 'valibot',
    });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const BaseTable = createBaseTable({
  ${header}
  schemaConfig: valibotSchemaConfig,

  ${columnTypesComment}
  // columnTypes: (t) => ({
  //   ...t,
  // }),
});

export const { sql } = BaseTable;
`);
  });

  it('should create base table with timestamp as date', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'date',
      validation: 'no',
    });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${header}
  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to Date object.
    timestamp: (precision?: number) => t.timestamp(precision).asDate(),
  }),
});

export const { sql } = BaseTable;
`);
  });

  it('should create base table with timestamp as number', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'number',
      validation: 'no',
    });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${header}
  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to number.
    timestamp: (precision?: number) => t.timestamp(precision).asNumber(),
  }),
});

export const { sql } = BaseTable;
`);
  });
});
