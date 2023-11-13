import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const baseTablePath = resolve(testInitConfig.dbDirPath, 'baseTable.ts');

const writeFile = mockFn(fs, 'writeFile');

const columnTypeComment = `// Customize column types for all tables.`;
const textColumnComment = `// Set min and max validations for all text columns,
    // it is only checked when validating with Zod schemas derived from the table.`;

describe('setupBaseTable', () => {
  beforeEach(jest.resetAllMocks);

  it('should create base table', async () => {
    await initSteps.setupBaseTable(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${columnTypeComment}
  columnTypes: (t) => ({
    ...t,
  }),
});
`);
  });

  it('should create base table with zod schema provider if it is in config', async () => {
    await initSteps.setupBaseTable({ ...testInitConfig, addSchemaToZod: true });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';
import { zodSchemaProvider } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  ${columnTypeComment}
  columnTypes: (t) => ({
    ...t,
    ${textColumnComment}
    text: (min = 0, max = Infinity) => t.text(min, max),
  }),
  schemaProvider: zodSchemaProvider,
});
`);
  });

  it('should create base table with timestamp as date', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'date',
    });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${columnTypeComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to Date object.
    timestamp: <P extends number>(precision?: P) =>
      t.timestamp<P>(precision).asDate(),
  }),
});
`);
  });

  it('should create base table with timestamp as number', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'number',
    });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${columnTypeComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to number.
    timestamp: <P extends number>(precision?: P) =>
      t.timestamp<P>(precision).asNumber(),
  }),
});
`);
  });
});
