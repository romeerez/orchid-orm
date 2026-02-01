import { Query } from '../../query';
import { expectSql, testDb } from 'test-utils';
import { userColumnsSql } from '../../../test-utils/pqb.test-utils';
import { Column } from '../../../columns/column';
import { getSqlText, quoteTableWithSchema, Sql } from '../../sql/sql';

export const columnSqlForTest = ({ shape, table }: Query, key: string) => {
  const index = key.indexOf('.');

  if (index !== -1) {
    const table = key.slice(0, index);
    const name = key.slice(index + 1);
    const column =
      (shape[name] as unknown as Column.Pick.Data).data.name || name;
    return [
      `"${table}"."${column}"`,
      column === name ? '' : ` "${name}"`,
      column,
    ];
  } else {
    const column = (shape[key] as unknown as Column.Pick.Data).data.name || key;
    return [
      `"${table}"."${column}"`,
      column === key ? '' : ` "${key}"`,
      column,
    ];
  }
};

export const testWhere = (
  buildSql: (cb: (q: Query) => Query) => Sql,
  startSql: string,
  {
    model,
    columnsOf = model,
    pkey,
    nullable,
    text,
  }: {
    model: Query;
    columnsOf?: Query;
    pkey: string;
    nullable: string;
    text: string;
  },
) => {
  const schemaTable = quoteTableWithSchema(model);

  const [pkeySql, pkeyAs] = columnSqlForTest(columnsOf, pkey);
  const [nullableSql] = columnSqlForTest(columnsOf, nullable);
  const [textSql, textAs] = columnSqlForTest(columnsOf, text);

  describe('where', () => {
    it('should handle null value', () => {
      expectSql(
        buildSql((q) => q.where({ [pkey]: 1, [nullable]: null })),
        `
          ${startSql} ${pkeySql} = $1 AND ${nullableSql} IS NULL
        `,
        [1],
      );
    });

    it('should accept sub query', () => {
      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }, (q) =>
            q.where({ OR: [{ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }] }),
          ),
        ),
        `
          ${startSql} ${pkeySql} = $1 AND ((
            ${pkeySql} = $2 OR ${pkeySql} = $3 AND ${textSql} = $4
          ))
        `,
        [1, 2, 3, 'n'],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }, (q) =>
            q.orWhere({ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }),
          ),
        ),
        `
          ${startSql} ${pkeySql} = $1 AND (
            ${pkeySql} = $2 OR ${pkeySql} = $3 AND ${textSql} = $4
          )
        `,
        [1, 2, 3, 'n'],
      );
    });

    it('should handle condition with operator', () => {
      expectSql(
        buildSql((q) => q.where({ [pkey]: { gt: 20 } })),
        `
          ${startSql} ${pkeySql} > $1
        `,
        [20],
      );
    });

    it('should handle condition with operator and sub query', () => {
      expectSql(
        buildSql((q) => q.where({ [pkey]: { in: columnsOf.select(pkey) } })),
        `
          ${startSql}
          ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
      );
    });

    it('should handle condition with operator and raw', () => {
      expectSql(
        buildSql((q) => q.where({ [pkey]: { in: testDb.sql`(1, 2, 3)` } })),
        `
          ${startSql}
          ${pkeySql} IN (1, 2, 3)
        `,
      );
    });

    it('should accept raw sql', () => {
      expectSql(
        buildSql((q) => q.where({ [pkey]: testDb.sql`1 + 2` })),
        `
          ${startSql} ${pkeySql} = 1 + 2
        `,
      );
    });

    it('should accept raw sql with template', () => {
      expectSql(
        buildSql((q) => q.whereSql`column = ${123}`),
        `
          ${startSql} (column = $1)
        `,
        [123],
      );
    });
  });

  describe('whereNot', () => {
    it('should handle null value', () => {
      expectSql(
        [
          buildSql((q) => q.where({ NOT: { [pkey]: 1, [nullable]: null } })),
          buildSql((q) => q.whereNot({ [pkey]: 1, [nullable]: null })),
        ],
        `
          ${startSql}
          NOT (${pkeySql} = $1 AND ${nullableSql} IS NULL)
        `,
        [1],
      );
    });

    it('should accept sub query', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            NOT: [
              { [pkey]: 1 },
              q.where({ OR: [{ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }] }),
            ],
          }),
        ),
        `
          ${startSql}
          NOT (${pkeySql} = $1 AND ((
            ${pkeySql} = $2 OR ${pkeySql} = $3 AND ${textSql} = $4
          )))
        `,
        [1, 2, 3, 'n'],
      );

      expectSql(
        buildSql((q) =>
          q.whereNot((q) =>
            q
              .where({ [pkey]: 1 })
              .where((q) =>
                q.orWhere({ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }),
              ),
          ),
        ),
        `
          ${startSql}
          NOT (${pkeySql} = $1 AND (
            ${pkeySql} = $2 OR ${pkeySql} = $3 AND ${textSql} = $4
          ))
        `,
        [1, 2, 3, 'n'],
      );
    });

    it('should handle condition with operator', () => {
      expectSql(
        [
          buildSql((q) => q.where({ NOT: { [pkey]: { gt: 20 } } })),
          buildSql((q) => q.whereNot({ [pkey]: { gt: 20 } })),
        ],
        `
          ${startSql}
          NOT ${pkeySql} > $1
        `,
        [20],
      );
    });

    it('should handle condition with operator and sub query', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({ NOT: { [pkey]: { in: columnsOf.select(pkey) } } }),
          ),
          buildSql((q) =>
            q.whereNot({ [pkey]: { in: columnsOf.select(pkey) } }),
          ),
        ],
        `
          ${startSql}
          NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
      );
    });

    it('should handle condition with operator and raw', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({ NOT: { [pkey]: { in: testDb.sql`(1, 2, 3)` } } }),
          ),
          buildSql((q) =>
            q.whereNot({ [pkey]: { in: testDb.sql`(1, 2, 3)` } }),
          ),
        ],
        `
          ${startSql}
          NOT ${pkeySql} IN (1, 2, 3)
        `,
      );
    });

    it('should accept raw sql', () => {
      expectSql(
        [
          buildSql((q) => q.where({ NOT: { [pkey]: testDb.sql`1 + 2` } })),
          buildSql((q) => q.whereNot({ [pkey]: testDb.sql`1 + 2` })),
        ],
        `
          ${startSql} NOT ${pkeySql} = 1 + 2
        `,
      );
    });

    it('should handle sub query builder', () => {
      expectSql(
        buildSql((q) =>
          q.whereNot((q) =>
            q.whereIn(pkey, [1, 2, 3]).whereExists(model, pkey, pkey),
          ),
        ),
        `
          ${startSql}
          NOT (
            ${pkeySql} IN ($1, $2, $3)
            AND EXISTS (SELECT 1 FROM ${schemaTable} WHERE ${pkeySql} = ${pkeySql})
          )
        `,
        [1, 2, 3],
      );
    });

    it('should accept raw sql with template', () => {
      expectSql(
        buildSql((q) => q.whereNotSql`column = ${123}`),
        `
          ${startSql} NOT (column = $1)
        `,
        [123],
      );
    });
  });

  describe('or', () => {
    it('should join conditions with or', () => {
      expectSql(
        buildSql((q) => q.where({ OR: [{ [pkey]: 1 }, { [text]: 'ko' }] })),
        `
          ${startSql}
          (${pkeySql} = $1 OR ${textSql} = $2)
        `,
        [1, 'ko'],
      );

      expectSql(
        buildSql((q) => q.orWhere({ [pkey]: 1 }, { [text]: 'ko' })),
        `
          ${startSql}
          ${pkeySql} = $1 OR ${textSql} = $2
        `,
        [1, 'ko'],
      );
    });

    it('should handle sub queries', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              columnsOf.where({ [pkey]: 2 }).where({ [text]: 'n' }),
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR (${pkeySql} = $2 AND ${textSql} = $3))
        `,
        [1, 2, 'n'],
      );

      expectSql(
        buildSql((q) =>
          q.orWhere({ [pkey]: 1 }, (q) =>
            q.where({ [pkey]: 2 }).where({ [text]: 'n' }),
          ),
        ),
        `
          ${startSql}
          ${pkeySql} = $1 OR (${pkeySql} = $2 AND ${textSql} = $3)
        `,
        [1, 2, 'n'],
      );
    });

    it('should accept raw sql', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [{ [pkey]: testDb.sql`1 + 2` }, { [text]: testDb.sql`2 + 3` }],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = 1 + 2 OR ${textSql} = 2 + 3)
        `,
      );

      expectSql(
        buildSql((q) =>
          q.orWhere(
            { [pkey]: testDb.sql`1 + 2` },
            { [text]: testDb.sql`2 + 3` },
          ),
        ),
        `
          ${startSql}
          ${pkeySql} = 1 + 2 OR ${textSql} = 2 + 3
        `,
      );
    });
  });

  describe('orWhereNot', () => {
    it('should join conditions with or', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [{ NOT: { [pkey]: 1 } }, { NOT: { [text]: 'ko' } }],
          }),
        ),
        `
          ${startSql}
          (NOT ${pkeySql} = $1 OR NOT ${textSql} = $2)
        `,
        [1, 'ko'],
      );

      expectSql(
        buildSql((q) => q.orWhereNot({ [pkey]: 1 }, { [text]: 'ko' })),
        `
          ${startSql}
          NOT ${pkeySql} = $1 OR NOT ${textSql} = $2
        `,
        [1, 'ko'],
      );
    });

    it('should handle sub queries', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { NOT: { [pkey]: 1 } },
              { NOT: columnsOf.where({ [pkey]: 2 }).where({ [text]: 'n' }) },
            ],
          }),
        ),
        `
          ${startSql}
          (NOT ${pkeySql} = $1 OR NOT (${pkeySql} = $2 AND ${textSql} = $3))
        `,
        [1, 2, 'n'],
      );

      expectSql(
        buildSql((q) =>
          q.orWhereNot(
            {
              [pkey]: 1,
            },
            (q) => q.where({ [pkey]: 2 }).where({ [text]: 'n' }),
          ),
        ),
        `
          ${startSql}
          NOT ${pkeySql} = $1 OR NOT (${pkeySql} = $2 AND ${textSql} = $3)
        `,
        [1, 2, 'n'],
      );
    });

    it('should accept raw sql', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { NOT: { [pkey]: testDb.sql`1 + 2` } },
              { NOT: { [text]: testDb.sql`2 + 3` } },
            ],
          }),
        ),
        `
          ${startSql}
          (NOT ${pkeySql} = 1 + 2 OR NOT ${textSql} = 2 + 3)
        `,
      );

      expectSql(
        buildSql((q) =>
          q.orWhereNot(
            { [pkey]: testDb.sql`1 + 2` },
            { [text]: testDb.sql`2 + 3` },
          ),
        ),
        `
          ${startSql}
          NOT ${pkeySql} = 1 + 2 OR NOT ${textSql} = 2 + 3
        `,
      );
    });
  });

  describe('whereIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({ IN: { columns: [pkey], values: [[1, 2, 3]] } }),
          ),
          buildSql((q) => q.whereIn(pkey, [1, 2, 3])),
        ],
        `
          ${startSql}
          ${pkeySql} IN ($1, $2, $3)
        `,
        [1, 2, 3],
      );
    });

    it('should handle multiple expressions', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              IN: [
                { columns: [pkey], values: [[1, 2, 3]] },
                { columns: [text], values: [['a', 'b', 'c']] },
              ],
            }),
          ),
          buildSql((q) =>
            q.whereIn({
              [pkey]: [1, 2, 3],
              [text]: ['a', 'b', 'c'],
            }),
          ),
        ],
        `
          ${startSql}
          ${pkeySql} IN ($1, $2, $3)
            AND ${textSql} IN ($4, $5, $6)
        `,
        [1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              IN: { columns: [pkey], values: testDb.sql`(1, 2, 3)` },
            }),
          ),
          buildSql((q) => q.whereIn(pkey, testDb.sql`(1, 2, 3)`)),
        ],
        `
          ${startSql}
          ${pkeySql} IN (1, 2, 3)
        `,
      );

      expectSql(
        [
          buildSql((q) =>
            q.where({
              IN: [
                { columns: [pkey], values: testDb.sql`(1, 2, 3)` },
                { columns: [text], values: testDb.sql`('a', 'b', 'c')` },
              ],
            }),
          ),
          buildSql((q) =>
            q.whereIn({
              [pkey]: testDb.sql`(1, 2, 3)`,
              [text]: testDb.sql`('a', 'b', 'c')`,
            }),
          ),
        ],
        `
          ${startSql}
          ${pkeySql} IN (1, 2, 3)
            AND ${textSql} IN ('a', 'b', 'c')
        `,
      );
    });

    it('should handle sub query', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              IN: { columns: [pkey], values: columnsOf.select(pkey) },
            }),
          ),
          buildSql((q) => q.whereIn(pkey, columnsOf.select(pkey))),
        ],
        `
          ${startSql}
          ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
      );

      expectSql(
        [
          buildSql((q) =>
            q.where({
              IN: [
                { columns: [pkey], values: columnsOf.select(pkey) },
                { columns: [text], values: columnsOf.select(text) },
              ],
            }),
          ),
          buildSql((q) =>
            q.whereIn({
              [pkey]: columnsOf.select(pkey),
              [text]: columnsOf.select(text),
            }),
          ),
        ],
        `
          ${startSql}
          ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
            AND ${textSql} IN (SELECT ${textSql}${textAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
      );
    });

    describe('tuple', () => {
      it('should handle single value', () => {
        expectSql(
          [
            buildSql((q) =>
              q.where({
                IN: {
                  columns: [pkey],
                  values: [[1], [2]],
                },
              }),
            ),
            buildSql((q) => q.whereIn([pkey], [[1], [2]])),
          ],
          `
            ${startSql}
            ${pkeySql} IN ($1, $2)
          `,
          [1, 2],
        );
      });

      it('should handle values', () => {
        expectSql(
          [
            buildSql((q) =>
              q.where({
                IN: {
                  columns: [pkey, text],
                  values: [
                    [1, 'a'],
                    [2, 'b'],
                  ],
                },
              }),
            ),
            buildSql((q) =>
              q.whereIn(
                [pkey, text],
                [
                  [1, 'a'],
                  [2, 'b'],
                ],
              ),
            ),
          ],
          `
            ${startSql}
            (${pkeySql}, ${textSql}) IN (($1, $2), ($3, $4))
          `,
          [1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          [
            buildSql((q) =>
              q.where({
                IN: {
                  columns: [pkey, text],
                  values: testDb.sql`((1, 'a'), (2, 'b'))`,
                },
              }),
            ),
            buildSql((q) =>
              q.whereIn([pkey, text], testDb.sql`((1, 'a'), (2, 'b'))`),
            ),
          ],
          `
            ${startSql}
            (${pkeySql}, ${textSql}) IN ((1, 'a'), (2, 'b'))
          `,
        );
      });

      it('should handle sub query', () => {
        expectSql(
          [
            buildSql((q) =>
              q.where({
                IN: {
                  columns: [pkey, text],
                  values: columnsOf.select(pkey, text),
                },
              }),
            ),
            buildSql((q) =>
              q.whereIn([pkey, text], columnsOf.select(pkey, text)),
            ),
          ],
          `
            ${startSql}
            (${pkeySql}, ${textSql})
               IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM ${quoteTableWithSchema(
            columnsOf,
          )})
          `,
        );
      });
    });
  });

  describe('orWhereIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              { IN: { columns: [pkey], values: [[1, 2, 3]] } },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR ${pkeySql} IN ($2, $3, $4))
        `,
        [1, 1, 2, 3],
      );

      expectSql(
        buildSql((q) => q.where({ [pkey]: 1 }).orWhereIn(pkey, [1, 2, 3])),
        `
          ${startSql}
          ${pkeySql} = $1 OR ${pkeySql} IN ($2, $3, $4)
        `,
        [1, 1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              {
                IN: [
                  { columns: [pkey], values: [[1, 2, 3]] },
                  { columns: [text], values: [['a', 'b', 'c']] },
                ],
              },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1
            OR ${pkeySql} IN ($2, $3, $4) AND ${textSql} IN ($5, $6, $7))
        `,
        [1, 1, 2, 3, 'a', 'b', 'c'],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereIn({
            [pkey]: [1, 2, 3],
            [text]: ['a', 'b', 'c'],
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1
            OR ${pkeySql} IN ($2, $3, $4) AND ${textSql} IN ($5, $6, $7)
        `,
        [1, 1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              { IN: { columns: [pkey], values: testDb.sql`(1, 2, 3)` } },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR ${pkeySql} IN (1, 2, 3))
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereIn({ [pkey]: testDb.sql`(1, 2, 3)` }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1 OR ${pkeySql} IN (1, 2, 3)
        `,
        [1],
      );

      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                {
                  IN: [
                    { columns: [pkey], values: testDb.sql`(1, 2, 3)` },
                    { columns: [text], values: testDb.sql`('a', 'b', 'c')` },
                  ],
                },
              ],
            }),
          ),
        ],
        `
          ${startSql}
          (${pkeySql} = $1
             OR ${pkeySql} IN (1, 2, 3)
            AND ${textSql} IN ('a', 'b', 'c'))
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereIn({
            [pkey]: testDb.sql`(1, 2, 3)`,
            [text]: testDb.sql`('a', 'b', 'c')`,
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1
             OR ${pkeySql} IN (1, 2, 3)
            AND ${textSql} IN ('a', 'b', 'c')
        `,
        [1],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              { IN: { columns: [pkey], values: columnsOf.select(pkey) } },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1
             OR ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )}))
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereIn({ [pkey]: columnsOf.select(pkey) }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1
             OR ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              {
                IN: [
                  { columns: [pkey], values: columnsOf.select(pkey) },
                  { columns: [text], values: columnsOf.select(text) },
                ],
              },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1
             OR ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
            AND ${textSql} IN (SELECT ${textSql}${textAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )}))
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereIn({
            [pkey]: columnsOf.select(pkey),
            [text]: columnsOf.select(text),
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1
             OR ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
            AND ${textSql} IN (SELECT ${textSql}${textAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
        [1],
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                {
                  IN: {
                    columns: [pkey, text],
                    values: [
                      [1, 'a'],
                      [2, 'b'],
                    ],
                  },
                },
              ],
            }),
          ),
          `
            ${startSql}
            (${pkeySql} = $1
               OR (${pkeySql}, ${textSql}) IN (($2, $3), ($4, $5)))
          `,
          [1, 1, 'a', 2, 'b'],
        );

        expectSql(
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereIn(
              [pkey, text],
              [
                [1, 'a'],
                [2, 'b'],
              ],
            ),
          ),
          `
            ${startSql}
            ${pkeySql} = $1
               OR (${pkeySql}, ${textSql}) IN (($2, $3), ($4, $5))
          `,
          [1, 1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                {
                  IN: {
                    columns: [pkey, text],
                    values: testDb.sql`((1, 'a'), (2, 'b'))`,
                  },
                },
              ],
            }),
          ),
          `
            ${startSql}
            (${pkeySql} = $1
               OR (${pkeySql}, ${textSql}) IN ((1, 'a'), (2, 'b')))
          `,
          [1],
        );

        expectSql(
          buildSql((q) =>
            q
              .where({ [pkey]: 1 })
              .orWhereIn([pkey, text], testDb.sql`((1, 'a'), (2, 'b'))`),
          ),
          `
            ${startSql}
            ${pkeySql} = $1
               OR (${pkeySql}, ${textSql}) IN ((1, 'a'), (2, 'b'))
          `,
          [1],
        );
      });

      it('should handle sub query', () => {
        expectSql(
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                {
                  IN: {
                    columns: [pkey, text],
                    values: columnsOf.select(pkey, text),
                  },
                },
              ],
            }),
          ),
          `
            ${startSql}
            (${pkeySql} = $1
               OR (${pkeySql}, ${textSql})
               IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM ${quoteTableWithSchema(
            columnsOf,
          )}))
          `,
          [1],
        );

        expectSql(
          buildSql((q) =>
            q
              .where({ [pkey]: 1 })
              .orWhereIn([pkey, text], columnsOf.select(pkey, text)),
          ),
          `
            ${startSql}
            ${pkeySql} = $1
               OR (${pkeySql}, ${textSql})
               IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM ${quoteTableWithSchema(
            columnsOf,
          )})
          `,
          [1],
        );
      });
    });
  });

  describe('whereNotIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({ NOT: { IN: { columns: [pkey], values: [[1, 2, 3]] } } }),
          ),
          buildSql((q) => q.whereNotIn(pkey, [1, 2, 3])),
        ],
        `
            ${startSql}
            NOT ${pkeySql} IN ($1, $2, $3)
          `,
        [1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              NOT: {
                IN: [
                  { columns: [pkey], values: [[1, 2, 3]] },
                  { columns: [text], values: [['a', 'b', 'c']] },
                ],
              },
            }),
          ),
          buildSql((q) =>
            q.whereNotIn({
              [pkey]: [1, 2, 3],
              [text]: ['a', 'b', 'c'],
            }),
          ),
        ],
        `
          ${startSql} NOT (
            ${pkeySql} IN ($1, $2, $3)
            AND ${textSql} IN ($4, $5, $6)
          )
        `,
        [1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              NOT: { IN: { columns: [pkey], values: testDb.sql`(1, 2, 3)` } },
            }),
          ),
          buildSql((q) =>
            q.whereNotIn({
              [pkey]: testDb.sql`(1, 2, 3)`,
            }),
          ),
        ],
        `
          ${startSql}
          NOT ${pkeySql} IN (1, 2, 3)
        `,
      );

      expectSql(
        [
          buildSql((q) =>
            q.where({
              NOT: {
                IN: [
                  { columns: [pkey], values: testDb.sql`(1, 2, 3)` },
                  { columns: [text], values: testDb.sql`('a', 'b', 'c')` },
                ],
              },
            }),
          ),
          buildSql((q) =>
            q.whereNotIn({
              [pkey]: testDb.sql`(1, 2, 3)`,
              [text]: testDb.sql`('a', 'b', 'c')`,
            }),
          ),
        ],
        `
          ${startSql}
          NOT (${pkeySql} IN (1, 2, 3) AND ${textSql} IN ('a', 'b', 'c'))
        `,
      );
    });

    it('should handle sub query', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              NOT: { IN: { columns: [pkey], values: columnsOf.select(pkey) } },
            }),
          ),
          buildSql((q) =>
            q.whereNotIn({
              [pkey]: columnsOf.select(pkey),
            }),
          ),
        ],
        `
          ${startSql}
          NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
      );

      expectSql(
        [
          buildSql((q) =>
            q.where({
              NOT: {
                IN: [
                  { columns: [pkey], values: columnsOf.select(pkey) },
                  { columns: [text], values: columnsOf.select(text) },
                ],
              },
            }),
          ),
          buildSql((q) =>
            q.whereNotIn({
              [pkey]: columnsOf.select(pkey),
              [text]: columnsOf.select(text),
            }),
          ),
        ],
        `
          ${startSql}
          NOT (
            ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
            AND ${textSql} IN (SELECT ${textSql}${textAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
          )
        `,
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          [
            buildSql((q) =>
              q.where({
                NOT: {
                  IN: {
                    columns: [pkey, text],
                    values: [
                      [1, 'a'],
                      [2, 'b'],
                    ],
                  },
                },
              }),
            ),
            buildSql((q) =>
              q.whereNotIn(
                [pkey, text],
                [
                  [1, 'a'],
                  [2, 'b'],
                ],
              ),
            ),
          ],
          `
            ${startSql}
            NOT (${pkeySql}, ${textSql}) IN (($1, $2), ($3, $4))
          `,
          [1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          [
            buildSql((q) =>
              q.where({
                NOT: {
                  IN: {
                    columns: [pkey, text],
                    values: testDb.sql`((1, 'a'), (2, 'b'))`,
                  },
                },
              }),
            ),
            buildSql((q) =>
              q.whereNotIn([pkey, text], testDb.sql`((1, 'a'), (2, 'b'))`),
            ),
          ],
          `
            ${startSql}
            NOT (${pkeySql}, ${textSql}) IN ((1, 'a'), (2, 'b'))
          `,
        );
      });

      it('should handle sub query', () => {
        expectSql(
          [
            buildSql((q) =>
              q.where({
                NOT: {
                  IN: {
                    columns: [pkey, text],
                    values: columnsOf.select(pkey, text),
                  },
                },
              }),
            ),
            buildSql((q) =>
              q.whereNotIn([pkey, text], columnsOf.select(pkey, text)),
            ),
          ],
          `
            ${startSql}
            NOT (${pkeySql}, ${textSql})
               IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM ${quoteTableWithSchema(
            columnsOf,
          )})
          `,
        );
      });
    });
  });

  describe('orWhereNotIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              { NOT: { IN: { columns: [pkey], values: [[1, 2, 3]] } } },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR NOT ${pkeySql} IN ($2, $3, $4))
        `,
        [1, 1, 2, 3],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereNotIn({
            [pkey]: [1, 2, 3],
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1 OR NOT ${pkeySql} IN ($2, $3, $4)
        `,
        [1, 1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              {
                NOT: {
                  IN: [
                    { columns: [pkey], values: [[1, 2, 3]] },
                    { columns: [text], values: [['a', 'b', 'c']] },
                  ],
                },
              },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR NOT (
            ${pkeySql} IN ($2, $3, $4)
            AND ${textSql} IN ($5, $6, $7)
          ))
        `,
        [1, 1, 2, 3, 'a', 'b', 'c'],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereNotIn({
            [pkey]: [1, 2, 3],
            [text]: ['a', 'b', 'c'],
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1 OR NOT (
            ${pkeySql} IN ($2, $3, $4)
            AND ${textSql} IN ($5, $6, $7)
          )
        `,
        [1, 1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              {
                NOT: {
                  IN: { columns: [pkey], values: testDb.sql`(1, 2, 3)` },
                },
              },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR NOT ${pkeySql} IN (1, 2, 3))
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereNotIn({
            [pkey]: testDb.sql`(1, 2, 3)`,
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1 OR NOT ${pkeySql} IN (1, 2, 3)
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              {
                NOT: {
                  IN: [
                    { columns: [pkey], values: testDb.sql`(1, 2, 3)` },
                    {
                      columns: [text],
                      values: testDb.sql`('a', 'b', 'c')`,
                    },
                  ],
                },
              },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR NOT (
            ${pkeySql} IN (1, 2, 3)
            AND ${textSql} IN ('a', 'b', 'c')
          ))
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereNotIn({
            [pkey]: testDb.sql`(1, 2, 3)`,
            [text]: testDb.sql`('a', 'b', 'c')`,
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1 OR NOT (
            ${pkeySql} IN (1, 2, 3)
            AND ${textSql} IN ('a', 'b', 'c')
          )
        `,
        [1],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              {
                NOT: {
                  IN: { columns: [pkey], values: columnsOf.select(pkey) },
                },
              },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1
             OR NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )}))
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereNotIn({
            [pkey]: columnsOf.select(pkey),
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1
             OR NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({
            OR: [
              { [pkey]: 1 },
              {
                NOT: {
                  IN: [
                    { columns: [pkey], values: columnsOf.select(pkey) },
                    { columns: [text], values: columnsOf.select(text) },
                  ],
                },
              },
            ],
          }),
        ),
        `
          ${startSql}
          (${pkeySql} = $1 OR NOT (
            ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
            AND ${textSql} IN (SELECT ${textSql}${textAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )}))
          )
        `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ [pkey]: 1 }).orWhereNotIn({
            [pkey]: columnsOf.select(pkey),
            [text]: columnsOf.select(text),
          }),
        ),
        `
          ${startSql}
          ${pkeySql} = $1 OR NOT (
            ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
            AND ${textSql} IN (SELECT ${textSql}${textAs} FROM ${quoteTableWithSchema(
          columnsOf,
        )})
          )
        `,
        [1],
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                {
                  NOT: {
                    IN: {
                      columns: [pkey, text],
                      values: [
                        [1, 'a'],
                        [2, 'b'],
                      ],
                    },
                  },
                },
              ],
            }),
          ),
          `
            ${startSql}
            (${pkeySql} = $1
               OR NOT (${pkeySql}, ${textSql}) IN (($2, $3), ($4, $5)))
          `,
          [1, 1, 'a', 2, 'b'],
        );

        expectSql(
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereNotIn(
              [pkey, text],
              [
                [1, 'a'],
                [2, 'b'],
              ],
            ),
          ),
          `
            ${startSql}
            ${pkeySql} = $1
               OR NOT (${pkeySql}, ${textSql}) IN (($2, $3), ($4, $5))
          `,
          [1, 1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                {
                  NOT: {
                    IN: {
                      columns: [pkey, text],
                      values: testDb.sql`((1, 'a'), (2, 'b'))`,
                    },
                  },
                },
              ],
            }),
          ),
          `
            ${startSql}
            (${pkeySql} = $1
               OR NOT (${pkeySql}, ${textSql}) IN ((1, 'a'), (2, 'b')))
          `,
          [1],
        );

        expectSql(
          buildSql((q) =>
            q
              .where({ [pkey]: 1 })
              .orWhereNotIn([pkey, text], testDb.sql`((1, 'a'), (2, 'b'))`),
          ),
          `
            ${startSql}
            ${pkeySql} = $1
               OR NOT (${pkeySql}, ${textSql}) IN ((1, 'a'), (2, 'b'))
          `,
          [1],
        );
      });

      it('should handle sub query', () => {
        expectSql(
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                {
                  NOT: {
                    IN: {
                      columns: [pkey, text],
                      values: columnsOf.select(pkey, text),
                    },
                  },
                },
              ],
            }),
          ),
          `
              ${startSql}
              (${pkeySql} = $1
                 OR NOT (${pkeySql}, ${textSql})
                   IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM ${quoteTableWithSchema(
            columnsOf,
          )}))
            `,
          [1],
        );

        expectSql(
          buildSql((q) =>
            q
              .where({ [pkey]: 1 })
              .orWhereNotIn([pkey, text], columnsOf.select(pkey, text)),
          ),
          `
            ${startSql}
            ${pkeySql} = $1
               OR NOT (${pkeySql}, ${textSql})
                 IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM ${quoteTableWithSchema(
            columnsOf,
          )})
          `,
          [1],
        );
      });
    });
  });
};

export const testWhereExists = ({
  joinTo,
  pkey,
  joinTarget,
  columnsOf,
  fkey,
  text,
  selectFrom,
}: {
  joinTo: Query;
  pkey: string;
  joinTarget: Query;
  columnsOf?: Query;
  fkey: string;
  text: string;
  selectFrom?: string;
}) => {
  const table = joinTo.table;
  const index = pkey.indexOf('.');
  const pkeyColumn = index === -1 ? pkey : pkey.slice(index + 1);
  const pkeySql =
    (joinTo.shape[pkeyColumn] as unknown as Column.Pick.Data).data.name ||
    pkeyColumn;

  describe('whereExists', () => {
    testWhereExistsCase({
      method: 'whereExists',
      joinTo,
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
    });
  });

  describe('orWhereExists', () => {
    testWhereExistsCase({
      method: 'orWhereExists',
      joinTo: joinTo.where({ [pkey]: 1 }),
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
      where: `"${table}"."${pkeySql}" = $1`,
      or: 'OR',
      values: [1],
    });
  });

  describe('whereNotExists', () => {
    testWhereExistsCase({
      method: 'whereNotExists',
      joinTo,
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
      where: 'NOT',
    });
  });

  describe('orWhereNotExists', () => {
    testWhereExistsCase({
      method: 'orWhereNotExists',
      joinTo: joinTo.where({ [pkey]: 1 }),
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
      where: `"${table}"."${pkeySql}" = $1`,
      or: 'OR NOT',
      values: [1],
    });
  });
};

export const testWhereExistsCase = ({
  method,
  joinTo,
  pkey,
  joinTarget,
  columnsOf = joinTarget,
  fkey,
  text,
  selectFrom = `SELECT ${
    joinTo.table === 'user' ? userColumnsSql : '*'
  } FROM ${quoteTableWithSchema(joinTo)}`,
  where,
  or,
  values = [],
}: {
  method: string;
  joinTo: Query;
  pkey: string;
  joinTarget: Query;
  columnsOf?: Query;
  fkey: string;
  text: string;
  selectFrom?: string;
  where?: string;
  or?: string;
  values?: unknown[];
}) => {
  const join = method as unknown as 'join';
  const initialSql = getSqlText(joinTo.toSQL());

  const schemaTable = quoteTableWithSchema(joinTo);
  const [pkeySql] = columnSqlForTest(joinTo, pkey);

  const joinSchemaTable = quoteTableWithSchema(joinTarget);
  const [fkeySql, , fkeyColumn] = columnSqlForTest(columnsOf, fkey);
  const [textSql] = columnSqlForTest(columnsOf, text);

  const asFkeySql =
    columnsOf === joinTarget ? `"as".${fkeySql.split('.')[1]}` : fkeySql;

  const makeSql = ({
    select = selectFrom,
    target,
    conditions,
    where: addWhere,
  }: {
    select?: string;
    target: string;
    conditions: string;
    where?: string;
  }) => {
    return `${select} WHERE ${where ? `${where} ` : ''}${
      where && addWhere && or ? 'AND ' : ''
    }${addWhere && or ? `${addWhere} ` : ''}${
      or ? `${or} ` : ''
    }EXISTS ( SELECT 1 FROM ${target} WHERE ${conditions})${
      addWhere && !or ? ` AND ${addWhere}` : ''
    }`;
  };

  const sql = (target: string, conditions: string) => {
    return makeSql({ target, conditions });
  };

  it('should accept left column and right column', () => {
    expectSql(
      joinTo[join](joinTarget, fkey, pkey).toSQL(),
      sql(`${joinSchemaTable}`, `${fkeySql} = ${pkeySql}`),
      values,
    );

    expectSql(
      joinTo[join](joinTarget.as('as'), fkey, pkey).toSQL(),
      sql(`${joinSchemaTable} "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );

    expect(getSqlText(joinTo.toSQL())).toBe(initialSql);
  });

  it('should accept left column, op and right column', () => {
    expectSql(
      joinTo[join](joinTarget, fkey, '=', pkey).toSQL(),
      sql(`${joinSchemaTable}`, `${fkeySql} = ${pkeySql}`),
      values,
    );

    expectSql(
      joinTo[join](joinTarget.as('as'), fkey, '=', pkey).toSQL(),
      sql(`${joinSchemaTable} "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );

    expect(getSqlText(joinTo.toSQL())).toBe(initialSql);
  });

  it('should accept raw and raw', () => {
    expectSql(
      joinTo[join](
        joinTarget,
        testDb.sql({ raw: `${fkeySql}` }),
        testDb.sql({ raw: `${pkeySql}` }),
      ).toSQL(),
      sql(`${joinSchemaTable}`, `${fkeySql} = ${pkeySql}`),
      values,
    );

    expectSql(
      joinTo[join](
        joinTarget.as('as'),
        testDb.sql({ raw: `${asFkeySql}` }),
        testDb.sql({ raw: `${pkeySql}` }),
      ).toSQL(),
      sql(`${joinSchemaTable} "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );

    expect(getSqlText(joinTo.toSQL())).toBe(initialSql);
  });

  it('should accept raw, op and raw', () => {
    expectSql(
      joinTo[join](
        joinTarget,
        testDb.sql({ raw: `${fkeySql}` }),
        '=',
        testDb.sql({ raw: `${pkeySql}` }),
      ).toSQL(),
      sql(`${joinSchemaTable}`, `${fkeySql} = ${pkeySql}`),
      values,
    );

    expectSql(
      joinTo[join](
        joinTarget.as('as'),
        testDb.sql({ raw: `${asFkeySql}` }),
        '=',
        testDb.sql({ raw: `${pkeySql}` }),
      ).toSQL(),
      sql(`${joinSchemaTable} "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );

    expect(getSqlText(joinTo.toSQL())).toBe(initialSql);
  });

  it('should accept object of columns', () => {
    expectSql(
      joinTo[join](joinTarget, { [fkey]: pkey }).toSQL(),
      sql(`${joinSchemaTable}`, `${fkeySql} = ${pkeySql}`),
      values,
    );

    expectSql(
      joinTo[join](joinTarget.as('as'), { [fkey]: pkey }).toSQL(),
      sql(`${joinSchemaTable} "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );

    expect(getSqlText(joinTo.toSQL())).toBe(initialSql);
  });

  it('should accept object of columns with raw value', () => {
    expectSql(
      joinTo[join](joinTarget, {
        [fkey]: testDb.sql({ raw: `${pkeySql}` }),
      }).toSQL(),
      sql(`${joinSchemaTable}`, `${fkeySql} = ${pkeySql}`),
      values,
    );

    expectSql(
      joinTo[join](joinTarget.as('as'), {
        [fkey]: testDb.sql({ raw: `${pkeySql}` }),
      }).toSQL(),
      sql(`${joinSchemaTable} "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );

    expect(getSqlText(joinTo.toSQL())).toBe(initialSql);
  });

  it('should accept raw sql', () => {
    expectSql(
      joinTo[join](
        joinTarget,
        testDb.sql({ raw: `"${fkeySql}" = ${schemaTable}.${pkey}` }),
      ).toSQL(),
      sql(`${joinSchemaTable}`, `"${fkeySql}" = ${schemaTable}.${pkey}`),
      values,
    );

    expectSql(
      joinTo[join](
        joinTarget.as('as'),
        testDb.sql({ raw: `"${fkeySql}" = ${schemaTable}.${pkey}` }),
      ).toSQL(),
      sql(`${joinSchemaTable} "as"`, `"${fkeySql}" = ${schemaTable}.${pkey}`),
      values,
    );

    expect(getSqlText(joinTo.toSQL())).toBe(initialSql);
  });

  it('should use conditions from provided query', () => {
    expectSql(
      joinTo[join](joinTarget, (q) =>
        q.on(fkey, pkey).where({ [text]: 'text' }),
      ).toSQL(),
      sql(
        `${joinSchemaTable}`,
        `${fkeySql} = ${pkeySql} AND ${textSql} = $${values.length + 1}`,
      ),
      [...values, 'text'],
    );
  });

  if (columnsOf === joinTarget) {
    describe('sub query', () => {
      it('should join a sub query', () => {
        const q = joinTo[join](
          joinTarget
            .select({
              one: fkey,
              two: text,
            })
            .where({
              [fkey]: 'one',
            })
            .as('as'),
          'one',
          pkey,
        )
          .where({
            [`as.two`]: 'two',
          })
          .select({
            id: `as.one`,
            text: `as.two`,
          });

        expectSql(
          q.toSQL(),
          makeSql({
            select: `SELECT "as"."one" "id", "as"."two" "text" FROM ${schemaTable}`,
            target: `${joinSchemaTable} "as"`,
            conditions: `"one" = ${pkeySql} AND "as"."${fkeyColumn}" = $${
              values.length + (or ? 2 : 1)
            }`,
            where: `"as"."two" = $${values.length + (or ? 1 : 2)}`,
          }),
          [...values, or ? 'two' : 'one', or ? 'one' : 'two'],
        );
      });
    });
  }
};
