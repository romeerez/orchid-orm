import { Query } from '../../query';
import { getSqlText, quoteTableWithSchema } from '../../sql/sql';
import { columnSqlForTest } from '../where/test-where';
import { expectSql, testDb } from 'test-utils';

export const testJoin = ({
  method,
  joinTo,
  pkey,
  joinTarget,
  columnsOf = joinTarget,
  fkey,
  text,
  selectFrom = `SELECT * FROM ${quoteTableWithSchema(joinTo)}`,
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
  or?: string;
  values?: unknown[];
}) => {
  const join = method as unknown as 'join';
  const initialSql = getSqlText(joinTo.toSQL());

  const schemaTable = quoteTableWithSchema(joinTo);
  const [pkeySql] = columnSqlForTest(joinTo, pkey);

  const joinSchemaTable = quoteTableWithSchema(joinTarget);
  const [fkeySql, , fkeyColumn] = columnSqlForTest(columnsOf, fkey);
  const [textSql, , textColumn] = columnSqlForTest(columnsOf, text);

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
    return `${select} JOIN ${target} ON ${conditions}${
      addWhere ? ` WHERE ${addWhere}` : ''
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
            target: `(
                SELECT "as"."${fkeyColumn}" "one", "as"."${textColumn}" "two"
                FROM ${joinSchemaTable} "as"
                WHERE "as"."${fkeyColumn}" = $${values.length + (or ? 2 : 1)}
              ) "as"`,
            conditions: `"as"."one" = ${pkeySql}`,
            where: `"as"."two" = $${values.length + (or ? 1 : 2)}`,
          }),
          [...values, or ? 'two' : 'one', or ? 'one' : 'two'],
        );
      });
    });
  }
};
