import {
  expectSql,
  getDb,
  queryMock,
  resetDb,
  setDbDown,
  toLine,
} from '../test-utils';
import { raw } from 'pqb';

const db = getDb();

describe('changeTable', () => {
  beforeEach(resetDb);

  it('should set comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: 'comment' }, () => ({}));
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'comment'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS NULL`);
  });

  it('should change comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: ['old', 'new'] }, () => ({}));
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'new'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'old'`);
  });

  it('should add columns to table', async () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
        id: t.add(t.serial().primaryKey()),
        dropCascade: t.add(t.text(), { dropMode: 'CASCADE' }),
        nullable: t.add(t.text().nullable()),
        nonNullable: t.add(t.text()),
        withDefault: t.add(t.boolean().default(false)),
        withDefaultRaw: t.add(t.date().default(raw(`now()`))),
        withIndex: t.add(
          t.text().index({
            name: 'indexName',
            unique: true,
            using: 'gin',
            expression: 10,
            collate: 'utf-8',
            operator: 'operator',
            order: 'ASC',
            include: 'id',
            with: 'fillfactor = 70',
            tablespace: 'tablespace',
            where: 'column = 123',
          }),
        ),
        uniqueColumn: t.add(t.text().unique({ dropMode: 'CASCADE' })),
        columnWithComment: t.add(t.text().comment('this is a column comment')),
        varcharWithLength: t.add(t.varchar(20)),
        decimalWithPrecisionAndScale: t.add(t.decimal(10, 5)),
        columnWithCompression: t.add(t.text().compression('compression')),
        columnWithCollate: t.add(t.text().collate('utf-8')),
        columnWithForeignKey: t.add(
          t.integer().foreignKey('table', 'column', {
            name: 'fkeyConstraint',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
        ),
      }));
    };

    await fn();

    expectSql([
      `
        ALTER TABLE "table"
        ADD COLUMN "id" serial PRIMARY KEY,
        ADD COLUMN "dropCascade" text NOT NULL,
        ADD COLUMN "nullable" text,
        ADD COLUMN "nonNullable" text NOT NULL,
        ADD COLUMN "withDefault" boolean NOT NULL DEFAULT false,
        ADD COLUMN "withDefaultRaw" date NOT NULL DEFAULT now(),
        ADD COLUMN "withIndex" text NOT NULL,
        ADD COLUMN "uniqueColumn" text NOT NULL,
        ADD COLUMN "columnWithComment" text NOT NULL,
        ADD COLUMN "varcharWithLength" varchar(20) NOT NULL,
        ADD COLUMN "decimalWithPrecisionAndScale" decimal(10, 5) NOT NULL,
        ADD COLUMN "columnWithCompression" text COMPRESSION compression NOT NULL,
        ADD COLUMN "columnWithCollate" text COLLATE 'utf-8' NOT NULL,
        ADD COLUMN "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE
      `,
      toLine(`
        CREATE UNIQUE INDEX "indexName"
          ON "table"
          USING gin
          ("withIndex"(10) COLLATE 'utf-8' operator ASC)
          INCLUDE ("id")
          WITH (fillfactor = 70)
          TABLESPACE tablespace
          WHERE column = 123
      `),
      toLine(`
        CREATE UNIQUE INDEX "tableUniqueColumnIndex"
          ON "table"
          ("uniqueColumn")
      `),
    ]);

    queryMock.mockClear();
    db.up = false;
    await fn();

    expectSql([
      `
        ALTER TABLE "table"
        DROP COLUMN "id",
        DROP COLUMN "dropCascade" CASCADE,
        DROP COLUMN "nullable",
        DROP COLUMN "nonNullable",
        DROP COLUMN "withDefault",
        DROP COLUMN "withDefaultRaw",
        DROP COLUMN "withIndex",
        DROP COLUMN "uniqueColumn",
        DROP COLUMN "columnWithComment",
        DROP COLUMN "varcharWithLength",
        DROP COLUMN "decimalWithPrecisionAndScale",
        DROP COLUMN "columnWithCompression",
        DROP COLUMN "columnWithCollate",
        DROP COLUMN "columnWithForeignKey"
      `,
      toLine(`DROP INDEX "indexName"`),
      toLine(`DROP INDEX "tableUniqueColumnIndex" CASCADE`),
    ]);
  });
});
