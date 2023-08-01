import { Query } from '../../query';
import { testJoin } from '../join/testJoin';
import { Sql } from 'orchid-core';
import { expectSql, testDb } from 'test-utils';

export const columnSqlForTest = ({ shape, table }: Query, key: string) => {
  const index = key.indexOf('.');

  if (index !== -1) {
    const table = key.slice(0, index);
    const name = key.slice(index + 1);
    const column = shape[name].data.name || name;
    return [
      `"${table}"."${column}"`,
      column === name ? '' : ` AS "${name}"`,
      column,
    ];
  } else {
    const column = shape[key].data.name || key;
    return [
      `"${table}"."${column}"`,
      column === key ? '' : ` AS "${key}"`,
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
  const table = model.table as string;

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
        [
          buildSql((q) =>
            q.where(
              { [pkey]: 1 },
              q.where({ OR: [{ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }] }),
            ),
          ),
          buildSql((q) =>
            q.where(
              { [pkey]: 1 },
              q.or({ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }),
            ),
          ),
        ],
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
              ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
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
        buildSql((q) => q.where`column = ${123}`),
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
            NOT ${pkeySql} = $1 AND NOT ${nullableSql} IS NULL
          `,
        [1],
      );
    });

    it('should accept sub query', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              NOT: [
                { [pkey]: 1 },
                q.where({ OR: [{ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }] }),
              ],
            }),
          ),
          buildSql((q) =>
            q.whereNot(
              { [pkey]: 1 },
              q.or({ [pkey]: 2 }, { [pkey]: 3, [text]: 'n' }),
            ),
          ),
        ],
        `
            ${startSql}
            NOT ${pkeySql} = $1 AND NOT (
              ${pkeySql} = $2 OR ${pkeySql} = $3 AND ${textSql} = $4
            )
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
            NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
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
          NOT ${pkeySql} IN ($1, $2, $3)
          AND NOT EXISTS (SELECT 1 FROM "${table}" WHERE ${pkeySql} = ${pkeySql})
        `,
        [1, 2, 3],
      );
    });

    it('should accept raw sql with template', () => {
      expectSql(
        buildSql((q) => q.whereNot`column = ${123}`),
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
        [
          buildSql((q) => q.where({ OR: [{ [pkey]: 1 }, { [text]: 'ko' }] })),
          buildSql((q) => q.or({ [pkey]: 1 }, { [text]: 'ko' })),
        ],
        `
            ${startSql}
            ${pkeySql} = $1 OR ${textSql} = $2
          `,
        [1, 'ko'],
      );
    });

    it('should handle sub queries', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                columnsOf.where({ [pkey]: 2 }).and({ [text]: 'n' }),
              ],
            }),
          ),
          buildSql((q) =>
            q.or(
              { [pkey]: 1 },
              columnsOf.where({ [pkey]: 2 }).and({ [text]: 'n' }),
            ),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1 OR (${pkeySql} = $2 AND ${textSql} = $3)
          `,
        [1, 2, 'n'],
      );
    });

    it('should accept raw sql', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: testDb.sql`1 + 2` },
                { [text]: testDb.sql`2 + 3` },
              ],
            }),
          ),
          buildSql((q) =>
            q.or({ [pkey]: testDb.sql`1 + 2` }, { [text]: testDb.sql`2 + 3` }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = 1 + 2 OR ${textSql} = 2 + 3
          `,
      );
    });
  });

  describe('orNot', () => {
    it('should join conditions with or', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [{ NOT: { [pkey]: 1 } }, { NOT: { [text]: 'ko' } }],
            }),
          ),
          buildSql((q) => q.orNot({ [pkey]: 1 }, { [text]: 'ko' })),
        ],
        `
            ${startSql}
            NOT ${pkeySql} = $1 OR NOT ${textSql} = $2
          `,
        [1, 'ko'],
      );
    });

    it('should handle sub queries', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [
                { NOT: { [pkey]: 1 } },
                { NOT: columnsOf.where({ [pkey]: 2 }).and({ [text]: 'n' }) },
              ],
            }),
          ),
          buildSql((q) =>
            q.orNot(
              {
                [pkey]: 1,
              },
              columnsOf.where({ [pkey]: 2 }).and({ [text]: 'n' }),
            ),
          ),
        ],
        `
            ${startSql}
            NOT ${pkeySql} = $1 OR NOT (${pkeySql} = $2 AND ${textSql} = $3)
          `,
        [1, 2, 'n'],
      );
    });

    it('should accept raw sql', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [
                { NOT: { [pkey]: testDb.sql`1 + 2` } },
                { NOT: { [text]: testDb.sql`2 + 3` } },
              ],
            }),
          ),
          buildSql((q) =>
            q.orNot(
              { [pkey]: testDb.sql`1 + 2` },
              { [text]: testDb.sql`2 + 3` },
            ),
          ),
        ],
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
            ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
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
            ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
              AND ${textSql} IN (SELECT ${textSql}${textAs} FROM "${columnsOf.table}")
          `,
      );
    });

    describe('tuple', () => {
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
                 IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM "${columnsOf.table}")
            `,
        );
      });
    });
  });

  describe('orWhereIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                { IN: { columns: [pkey], values: [[1, 2, 3]] } },
              ],
            }),
          ),
          buildSql((q) => q.where({ [pkey]: 1 }).orWhereIn(pkey, [1, 2, 3])),
        ],
        `
            ${startSql}
            ${pkeySql} = $1 OR ${pkeySql} IN ($2, $3, $4)
          `,
        [1, 1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        [
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
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereIn({
              [pkey]: [1, 2, 3],
              [text]: ['a', 'b', 'c'],
            }),
          ),
        ],
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
        [
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                { IN: { columns: [pkey], values: testDb.sql`(1, 2, 3)` } },
              ],
            }),
          ),
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereIn({ [pkey]: testDb.sql`(1, 2, 3)` }),
          ),
        ],
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
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereIn({
              [pkey]: testDb.sql`(1, 2, 3)`,
              [text]: testDb.sql`('a', 'b', 'c')`,
            }),
          ),
        ],
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
        [
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                { IN: { columns: [pkey], values: columnsOf.select(pkey) } },
              ],
            }),
          ),
          buildSql((q) =>
            q
              .where({ [pkey]: 1 })
              .orWhereIn({ [pkey]: columnsOf.select(pkey) }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1
               OR ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
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
                    { columns: [pkey], values: columnsOf.select(pkey) },
                    { columns: [text], values: columnsOf.select(text) },
                  ],
                },
              ],
            }),
          ),
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereIn({
              [pkey]: columnsOf.select(pkey),
              [text]: columnsOf.select(text),
            }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1
               OR ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
              AND ${textSql} IN (SELECT ${textSql}${textAs} FROM "${columnsOf.table}")
          `,
        [1],
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          [
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
            buildSql((q) =>
              q.where({ [pkey]: 1 }).orWhereIn(
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
              ${pkeySql} = $1
                 OR (${pkeySql}, ${textSql}) IN (($2, $3), ($4, $5))
            `,
          [1, 1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          [
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
            buildSql((q) =>
              q
                .where({ [pkey]: 1 })
                .orWhereIn([pkey, text], testDb.sql`((1, 'a'), (2, 'b'))`),
            ),
          ],
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
          [
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
            buildSql((q) =>
              q
                .where({ [pkey]: 1 })
                .orWhereIn([pkey, text], columnsOf.select(pkey, text)),
            ),
          ],
          `
              ${startSql}
              ${pkeySql} = $1
                 OR (${pkeySql}, ${textSql})
                 IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM "${columnsOf.table}")
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
            ${startSql}
            NOT ${pkeySql} IN ($1, $2, $3)
              AND NOT ${textSql} IN ($4, $5, $6)
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
            NOT ${pkeySql} IN (1, 2, 3)
              AND NOT ${textSql} IN ('a', 'b', 'c')
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
            NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
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
            NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
              AND NOT ${textSql} IN (SELECT ${textSql}${textAs} FROM "${columnsOf.table}")
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
               IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM "${columnsOf.table}")
          `,
        );
      });
    });
  });

  describe('orWhereNotIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        [
          buildSql((q) =>
            q.where({
              OR: [
                { [pkey]: 1 },
                { NOT: { IN: { columns: [pkey], values: [[1, 2, 3]] } } },
              ],
            }),
          ),
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereNotIn({
              [pkey]: [1, 2, 3],
            }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1 OR NOT ${pkeySql} IN ($2, $3, $4)
          `,
        [1, 1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        [
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
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereNotIn({
              [pkey]: [1, 2, 3],
              [text]: ['a', 'b', 'c'],
            }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1
              OR NOT ${pkeySql} IN ($2, $3, $4) AND NOT ${textSql} IN ($5, $6, $7)
          `,
        [1, 1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        [
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
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereNotIn({
              [pkey]: testDb.sql`(1, 2, 3)`,
            }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1 OR NOT ${pkeySql} IN (1, 2, 3)
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
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereNotIn({
              [pkey]: testDb.sql`(1, 2, 3)`,
              [text]: testDb.sql`('a', 'b', 'c')`,
            }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1
               OR NOT ${pkeySql} IN (1, 2, 3)
              AND NOT ${textSql} IN ('a', 'b', 'c')
          `,
        [1],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        [
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
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereNotIn({
              [pkey]: columnsOf.select(pkey),
            }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1
               OR NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
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
          buildSql((q) =>
            q.where({ [pkey]: 1 }).orWhereNotIn({
              [pkey]: columnsOf.select(pkey),
              [text]: columnsOf.select(text),
            }),
          ),
        ],
        `
            ${startSql}
            ${pkeySql} = $1
               OR NOT ${pkeySql} IN (SELECT ${pkeySql}${pkeyAs} FROM "${columnsOf.table}")
              AND NOT ${textSql} IN (SELECT ${textSql}${textAs} FROM "${columnsOf.table}")
          `,
        [1],
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          [
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
            buildSql((q) =>
              q.where({ [pkey]: 1 }).orWhereNotIn(
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
              ${pkeySql} = $1
                 OR NOT (${pkeySql}, ${textSql}) IN (($2, $3), ($4, $5))
            `,
          [1, 1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          [
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
            buildSql((q) =>
              q
                .where({ [pkey]: 1 })
                .orWhereNotIn([pkey, text], testDb.sql`((1, 'a'), (2, 'b'))`),
            ),
          ],
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
          [
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
            buildSql((q) =>
              q
                .where({ [pkey]: 1 })
                .orWhereNotIn([pkey, text], columnsOf.select(pkey, text)),
            ),
          ],
          `
              ${startSql}
              ${pkeySql} = $1
                 OR NOT (${pkeySql}, ${textSql})
                   IN (SELECT ${pkeySql}${pkeyAs}, ${textSql}${textAs} FROM "${columnsOf.table}")
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
  const pkeySql = joinTo.shape[pkey].data.name || pkey;

  describe('whereExists', () => {
    testJoin({
      method: 'whereExists',
      joinTo,
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
      whereExists: true,
    });
  });

  describe('orWhereExists', () => {
    testJoin({
      method: 'orWhereExists',
      joinTo: joinTo.where({ [pkey]: 1 }),
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
      whereExists: true,
      where: `"${table}"."${pkeySql}" = $1`,
      or: 'OR',
      values: [1],
    });
  });

  describe('whereNotExists', () => {
    testJoin({
      method: 'whereNotExists',
      joinTo,
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
      whereExists: true,
      where: 'NOT',
    });
  });

  describe('orWhereNotExists', () => {
    testJoin({
      method: 'orWhereNotExists',
      joinTo: joinTo.where({ [pkey]: 1 }),
      pkey,
      joinTarget,
      columnsOf,
      fkey,
      text,
      selectFrom,
      whereExists: true,
      where: `"${table}"."${pkeySql}" = $1`,
      or: 'OR NOT',
      values: [1],
    });
  });
};
