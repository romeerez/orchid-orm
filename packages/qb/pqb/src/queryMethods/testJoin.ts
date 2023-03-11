import { Query } from '../query';
import { db, expectSql } from '../test-utils/test-utils';
import { addQueryOn } from './join';
import { columnSqlForTest } from './testWhere';

export const testJoin = ({
  method,
  joinTo,
  pkey,
  joinTarget,
  columnsOf = joinTarget,
  fkey,
  text,
  selectFrom = `SELECT * FROM "${joinTo.table}"`,
  whereExists,
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
  whereExists?: boolean;
  where?: string;
  or?: string;
  values?: unknown[];
}) => {
  const join = method as unknown as 'join';
  const initialSql = joinTo.toSql().text;

  const table = joinTo.table as string;
  const [pkeySql] = columnSqlForTest(joinTo, pkey);

  const joinTable = joinTarget.table as string;
  const [fkeySql, , fkeyColumn] = columnSqlForTest(columnsOf, fkey);
  const [textSql, , textColumn] = columnSqlForTest(columnsOf, text);

  const asFkeySql =
    columnsOf === joinTarget ? `"as".${fkeySql.split('.')[1]}` : fkeySql;
  const asTextSql =
    columnsOf === joinTarget ? `"as".${textSql.split('.')[1]}` : textSql;

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
    if (whereExists) {
      return `${select} WHERE ${where ? `${where} ` : ''}${
        where && addWhere && or ? 'AND ' : ''
      }${addWhere && or ? `${addWhere} ` : ''}${
        or ? `${or} ` : ''
      }EXISTS ( SELECT 1 FROM ${target} WHERE ${conditions} LIMIT 1 )${
        addWhere && !or ? ` AND ${addWhere}` : ''
      }`;
    } else {
      return `${select} JOIN ${target} ON ${conditions}${
        addWhere ? ` WHERE ${addWhere}` : ''
      }`;
    }
  };

  const sql = (target: string, conditions: string) => {
    return makeSql({ target, conditions });
  };

  it('should accept left column and right column', () => {
    expectSql(
      joinTo[join](joinTarget, fkey, pkey).toSql(),
      sql(`"${joinTable}"`, `${fkeySql} = ${pkeySql}`),
      values,
    );
    expectSql(
      joinTo[join](joinTarget.as('as'), fkey, pkey).toSql(),
      sql(`"${joinTable}" AS "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );
    expect(joinTo.toSql().text).toBe(initialSql);
  });

  it('should accept left column, op and right column', () => {
    expectSql(
      joinTo[join](joinTarget, fkey, '=', pkey).toSql(),
      sql(`"${joinTable}"`, `${fkeySql} = ${pkeySql}`),
      values,
    );
    expectSql(
      joinTo[join](joinTarget.as('as'), fkey, '=', pkey).toSql(),
      sql(`"${joinTable}" AS "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );
    expect(joinTo.toSql().text).toBe(initialSql);
  });

  it('should accept raw and raw', () => {
    expectSql(
      joinTo[join](
        joinTarget,
        db.raw(`${fkeySql}`),
        db.raw(`${pkeySql}`),
      ).toSql(),
      sql(`"${joinTable}"`, `${fkeySql} = ${pkeySql}`),
      values,
    );
    expectSql(
      joinTo[join](
        joinTarget.as('as'),
        db.raw(`${asFkeySql}`),
        db.raw(`${pkeySql}`),
      ).toSql(),
      sql(`"${joinTable}" AS "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );
    expect(joinTo.toSql().text).toBe(initialSql);
  });

  it('should accept raw, op and raw', () => {
    expectSql(
      joinTo[join](
        joinTarget,
        db.raw(`${fkeySql}`),
        '=',
        db.raw(`${pkeySql}`),
      ).toSql(),
      sql(`"${joinTable}"`, `${fkeySql} = ${pkeySql}`),
      values,
    );
    expectSql(
      joinTo[join](
        joinTarget.as('as'),
        db.raw(`${asFkeySql}`),
        '=',
        db.raw(`${pkeySql}`),
      ).toSql(),
      sql(`"${joinTable}" AS "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );
    expect(joinTo.toSql().text).toBe(initialSql);
  });

  it('should accept object of columns', () => {
    expectSql(
      joinTo[join](joinTarget, { [fkey]: pkey }).toSql(),
      sql(`"${joinTable}"`, `${fkeySql} = ${pkeySql}`),
      values,
    );
    expectSql(
      joinTo[join](joinTarget.as('as'), { [fkey]: pkey }).toSql(),
      sql(`"${joinTable}" AS "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );
    expect(joinTo.toSql().text).toBe(initialSql);
  });

  it('should accept object of columns with raw value', () => {
    expectSql(
      joinTo[join](joinTarget, {
        [fkey]: db.raw(`${pkeySql}`),
      }).toSql(),
      sql(`"${joinTable}"`, `${fkeySql} = ${pkeySql}`),
      values,
    );
    expectSql(
      joinTo[join](joinTarget.as('as'), {
        [fkey]: db.raw(`${pkeySql}`),
      }).toSql(),
      sql(`"${joinTable}" AS "as"`, `${asFkeySql} = ${pkeySql}`),
      values,
    );
    expect(joinTo.toSql().text).toBe(initialSql);
  });

  it('should accept raw sql', () => {
    expectSql(
      joinTo[join](
        joinTarget,
        db.raw(`"${fkeySql}" = "${table}".${pkey}`),
      ).toSql(),
      sql(`"${joinTable}"`, `"${fkeySql}" = "${table}".${pkey}`),
      values,
    );
    expectSql(
      joinTo[join](
        joinTarget.as('as'),
        db.raw(`"${fkeySql}" = "${table}".${pkey}`),
      ).toSql(),
      sql(`"${joinTable}" AS "as"`, `"${fkeySql}" = "${table}".${pkey}`),
      values,
    );
    expect(joinTo.toSql().text).toBe(initialSql);
  });

  it('should use conditions from provided query', () => {
    expectSql(
      joinTo[join](joinTarget, (q) =>
        q.on(fkey, pkey).where({ [text]: 'text' }),
      ).toSql(),
      sql(
        `"${joinTable}"`,
        `${fkeySql} = ${pkeySql} AND ${textSql} = $${values.length + 1}`,
      ),
      [...values, 'text'],
    );
  });

  describe('relation', () => {
    const withRelation = joinTo as Query & {
      relations: {
        as: {
          key: 'as';
          query: typeof joinTarget;
          joinQuery(fromQuery: Query, toQuery: Query): Query;
        };
      };
    };

    beforeAll(() => {
      Object.assign(withRelation.baseQuery, {
        relations: {
          as: {
            key: 'as',
            query: joinTarget,
            joinQuery(fromQuery: Query, toQuery: Query) {
              const rel = toQuery.as('as');
              return addQueryOn(rel, fromQuery, rel, fkey, pkey);
            },
          },
        },
      });
    });

    it('should join relation', () => {
      expectSql(
        withRelation[join]('as').toSql(),
        sql(`"${joinTable}" AS "as"`, `${asFkeySql} = ${pkeySql}`),
        values,
      );
    });

    if (columnsOf === joinTarget) {
      it('should join relation with additional conditions', () => {
        expectSql(
          withRelation[join]('as', (q) =>
            q.where({
              [`as.${text}`]: 'text',
            }),
          ).toSql(),
          sql(
            `"${joinTable}" AS "as"`,
            `${asFkeySql} = ${pkeySql} AND ${asTextSql} = $${
              values.length + 1
            }`,
          ),
          [...values, 'text'],
        );
      });
    }
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
          q.toSql(),
          makeSql({
            select: `SELECT "as"."one" AS "id", "as"."two" AS "text" FROM "${table}"`,
            target: `
              (
                SELECT "as"."${fkeyColumn}" AS "one", "as"."${textColumn}" AS "two"
                FROM "${joinTable}" AS "as"
                WHERE "as"."${fkeyColumn}" = $${values.length + (or ? 2 : 1)}
              ) "as"
            `,
            conditions: `"as"."one" = ${pkeySql}`,
            where: `"as"."two" = $${values.length + (or ? 1 : 2)}`,
          }),
          [...values, or ? 'two' : 'one', or ? 'one' : 'two'],
        );
      });
    });
  }
};
