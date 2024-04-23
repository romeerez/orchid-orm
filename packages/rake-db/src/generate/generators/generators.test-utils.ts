import { Adapter, AdapterOptions } from 'pqb';
import { ColumnsShapeBase, createBaseTable, orchidORM } from 'orchid-orm';
import { testConfig } from '../../rake-db.test-utils';
import { AnyRakeDbConfig } from 'rake-db';
import {
  DbStructure,
  introspectDbSchema,
  IntrospectedStructure,
} from '../dbStructure';
import { asMock } from 'test-utils';
import { promptSelect } from '../../prompt';
import { generate } from '../generate';
import fs from 'fs/promises';

const defaultOptions: AdapterOptions[] = [{ databaseURL: process.env.PG_URL }];
let options = defaultOptions;

const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
  }),
});

const defaultConfig = {
  ...testConfig,
  baseTable: BaseTable as unknown as AnyRakeDbConfig['baseTable'],
};
let config: AnyRakeDbConfig = defaultConfig;

const makeStructure = (
  arg: Partial<
    Omit<IntrospectedStructure, 'tables'> & {
      tables?: (Omit<DbStructure.Table, 'columns'> & {
        columns?: DbStructure.Column[];
      })[];
    }
  >,
): IntrospectedStructure => {
  return {
    schemas: [],
    views: [],
    indexes: [],
    constraints: [],
    triggers: [],
    extensions: [],
    enums: [],
    domains: [],
    collations: [],
    ...arg,
    tables: arg.tables?.map((t) => ({ ...t, columns: t.columns ?? [] })) ?? [],
  };
};

const arrange = (arg: {
  config?: AnyRakeDbConfig;
  options?: AdapterOptions[];
  structure?: IntrospectedStructure;
  structures?: IntrospectedStructure[];
  tables?: (typeof BaseTable)[];
  selects?: number[];
  compareExpressions?: boolean[];
}) => {
  config = {
    db: (() =>
      arg.tables
        ? orchidORM(
            { noPrimaryKey: 'ignore' },
            Object.fromEntries(arg.tables.map((klass) => [klass.name, klass])),
          )
        : {}) as unknown as AnyRakeDbConfig['db'],
    ...(arg.config ?? defaultConfig),
  };
  options = arg.options ?? defaultOptions;

  if (arg.structures) {
    for (const structure of arg.structures) {
      asMock(introspectDbSchema).mockResolvedValueOnce(structure);
    }
  } else {
    asMock(introspectDbSchema).mockResolvedValue(
      arg.structure ?? makeStructure({}),
    );
  }

  if (arg.selects) {
    for (const select of arg.selects) {
      asMock(promptSelect).mockResolvedValueOnce(select);
    }
  }

  const { compareExpressions } = arg;
  if (compareExpressions) {
    jest.spyOn(Adapter.prototype, 'arrays').mockImplementation(() =>
      Promise.resolve({
        rows: [compareExpressions],
        rowCount: 1,
        fields: [],
      }),
    );
  }
};

const act = () => generate(options, config);

const assert = {
  migration: (code?: string) => {
    expect(asMock(fs.writeFile).mock.calls[0]?.[1]).toBe(code);
  },
};

const table = (
  columns?: (t: typeof BaseTable.columnTypes) => ColumnsShapeBase,
  noPrimaryKey = true,
) => {
  return class Table extends BaseTable {
    table = 'table';
    noPrimaryKey = noPrimaryKey;
    columns = columns ? this.setColumns(columns) : {};
  };
};

export const generatorsTestUtils = {
  arrange,
  act,
  assert,
  defaultConfig,
  BaseTable,
  makeStructure,
  table,
};
