import { asMock, makeTestWritten } from '../testUtils';
import fs from 'fs/promises';
import path from 'path';
import { updateRelations, UpdateRelationsParams } from './updateRelations';
import { MaybeArray, pathToLog, toArray } from 'orchid-core';
import { AppCodeUpdaterRelation } from '../appCodeUpdater';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const template = ({
  imports,
  relations,
}: {
  imports?: string;
  relations?: string;
} = {}) => `import { BaseTable } from '../baseTable';
${imports ? `${imports.trim()}\n` : ''}
export class TargetTable extends BaseTable {
  readonly table = 'target';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
  }));${relations ? `\n\n  relations = {\n    ${relations.trim()}\n  };` : ''}
}`;

const setContent = (params?: Parameters<typeof template>[0]) => {
  asMock(fs.readFile).mockResolvedValueOnce(template(params));
};

const log = jest.fn();
const logger = { ...console, log };

const basePath = __dirname;
const targetPath = path.join(basePath, 'target.ts');
const testWrittenOnly = makeTestWritten(targetPath);
const testWritten = (params?: Parameters<typeof template>[0]) => {
  testWrittenOnly(template(params));
  expect(log).toBeCalledWith(`Updated ${pathToLog(targetPath)}`);
};

const makeParams = (
  relations: MaybeArray<AppCodeUpdaterRelation>,
): UpdateRelationsParams => ({
  logger,
  relations: {
    target: {
      path: targetPath,
      relations: toArray(relations),
    },
  },
});

describe('updateRelations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add imports and relations', async () => {
    setContent();

    await updateRelations(
      makeParams({
        kind: 'hasMany',
        columns: ['id'],
        className: 'OtherTable',
        path: path.join(basePath, 'otherTable.ts'),
        foreignColumns: ['otherId'],
      }),
    );

    testWritten({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `others: this.hasMany(() => OtherTable, {
      columns: ['id'],
      references: ['otherId'],
    }),`,
    });
  });

  it('should not add import and relations if it already exist', async () => {
    setContent({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `others: this.hasMany(() => OtherTable, {
      columns: ['id'],
      references: ['otherId'],
    }),`,
    });

    await updateRelations(
      makeParams({
        kind: 'hasMany',
        columns: ['id'],
        className: 'OtherTable',
        path: path.join(basePath, 'otherTable.ts'),
        foreignColumns: ['otherId'],
      }),
    );

    testWritten({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `others: this.hasMany(() => OtherTable, {
      columns: ['id'],
      references: ['otherId'],
    }),`,
    });
  });

  it('should insert relation into already defined relations', async () => {
    setContent({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `some: this.belongsTo(() => SomeTable, {
      columns: ['id'],
      references: ['someId'],
    }),`,
    });

    await updateRelations(
      makeParams({
        kind: 'hasMany',
        columns: ['id'],
        className: 'OtherTable',
        path: path.join(basePath, 'otherTable.ts'),
        foreignColumns: ['otherId'],
      }),
    );

    testWritten({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `some: this.belongsTo(() => SomeTable, {
      columns: ['id'],
      references: ['someId'],
    }),
    others: this.hasMany(() => OtherTable, {
      columns: ['id'],
      references: ['otherId'],
    }),`,
    });
  });

  it('should not insert relation if it is already defined', async () => {
    setContent({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `others: this.belongsTo(() => OtherTable, {
      columns: ['id'],
      references: ['someId'],
    }),`,
    });

    await updateRelations(
      makeParams({
        kind: 'hasMany',
        columns: ['id'],
        className: 'OtherTable',
        path: path.join(basePath, 'otherTable.ts'),
        foreignColumns: ['otherId'],
      }),
    );

    testWritten({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `others: this.belongsTo(() => OtherTable, {
      columns: ['id'],
      references: ['someId'],
    }),`,
    });
  });

  it('should add belongsTo relation', async () => {
    setContent();

    await updateRelations(
      makeParams({
        kind: 'belongsTo',
        columns: ['otherId'],
        className: 'OtherTable',
        path: path.join(basePath, 'otherTable.ts'),
        foreignColumns: ['id'],
      }),
    );

    testWritten({
      imports: `import { OtherTable } from './otherTable';`,
      relations: `others: this.belongsTo(() => OtherTable, {
      columns: ['id'],
      references: ['otherId'],
    }),`,
    });
  });
});
