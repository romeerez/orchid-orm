import { Post, postColumnsSql } from '../test-utils/test-utils';
import { expectSql } from 'test-utils';
import { raw } from '../sql/rawSql';

describe('search', () => {
  it('should support string text and a string query', () => {
    const q = Post.search({
      text: `a fat cat sat on a mat and ate a fat rat`,
      tsQuery: `cat & rat`,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['english', `a fat cat sat on a mat and ate a fat rat`, `cat & rat`],
    );
  });

  it('should support raw SQL text and raw SQL query', () => {
    const q = Post.search({
      text: Post.sql`'a fat cat' || ${'sat on a mat'}`,
      tsQuery: Post.sql`'cat' || '&' || ${'rat'}`,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, 'cat' || '&' || $3) "@q"
        WHERE to_tsvector($1, 'a fat cat' || $2) @@ "@q"
      `,
      ['english', 'sat on a mat', 'rat'],
    );
  });

  it('should accept a plain string query', () => {
    const q = Post.search({
      text: 'text',
      plainQuery: 'plain query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", plainto_tsquery($1, $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['english', 'text', 'plain query'],
    );
  });

  it('should accept a plain raw SQL query', () => {
    const q = Post.search({
      text: 'text',
      plainQuery: Post.sql`'plain query'`,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", plainto_tsquery($1, 'plain query') "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['english', 'text'],
    );
  });

  it('should accept a phrase string query', () => {
    const q = Post.search({
      text: 'some text',
      phraseQuery: 'the cats ate the rats',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", phraseto_tsquery($1, $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['english', 'some text', 'the cats ate the rats'],
    );
  });

  it('should accept a phrase raw SQL query', () => {
    const q = Post.search({
      text: 'some text',
      phraseQuery: Post.sql`'the cats ate the ' || ${'rats'}`,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", phraseto_tsquery($1, 'the cats ate the ' || $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['english', 'some text', 'rats'],
    );
  });

  it('should accept a web-search string query', () => {
    const q = Post.search({
      text: 'some text',
      query: 'the cats ate the rats',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", websearch_to_tsquery($1, $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['english', 'some text', 'the cats ate the rats'],
    );
  });

  it('should accept a web-search raw SQL query', () => {
    const q = Post.search({
      text: 'some text',
      query: Post.sql`'the cats ate the ' || ${'rats'}`,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", websearch_to_tsquery($1, 'the cats ate the ' || $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['english', 'some text', 'rats'],
    );
  });

  it('should support setting the language', () => {
    const q = Post.search({
      language: 'Ukrainian',
      text: 'text',
      tsQuery: 'query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
      `,
      ['Ukrainian', 'text', 'query'],
    );
  });

  it('should use a language from a column', () => {
    const q = Post.search({
      languageColumn: 'title',
      in: ['title', 'body'],
      tsQuery: 'query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery("post"."title", $1) "@q"
        WHERE to_tsvector("post"."title", concat_ws(' ', "post"."title", "post"."body")) @@ "@q"
      `,
      ['query'],
    );
  });

  it('should use a raw SQL language', () => {
    const q = Post.search({
      language: Post.sql`'lang'`,
      in: ['title', 'body'],
      tsQuery: 'query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery('lang', $1) "@q"
        WHERE to_tsvector('lang', concat_ws(' ', "post"."title", "post"."body")) @@ "@q"
      `,
      ['query'],
    );
  });

  it('should search in the column', () => {
    const q = Post.search({
      in: 'body',
      tsQuery: 'query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $2) "@q"
        WHERE to_tsvector($1, "post"."body") @@ "@q"
      `,
      ['english', 'query'],
    );
  });

  it('should search in multiple columns', () => {
    const q = Post.search({
      in: ['title', 'body'],
      tsQuery: 'query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $2) "@q"
        WHERE to_tsvector($1, concat_ws(' ', "post"."title", "post"."body")) @@ "@q"
      `,
      ['english', 'query'],
    );
  });

  it('should search by a generated tsvector column', () => {
    const q = Post.search({
      vector: 'generatedTsVector',
      tsQuery: 'query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $2) "@q"
        WHERE "post"."generated_ts_vector" @@ "@q"
      `,
      ['english', 'query'],
    );
  });

  it('should set a weight to a text', () => {
    const q = Post.search({
      in: {
        title: 'A',
        body: 'B',
      },
      tsQuery: 'query',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql}
        FROM "post", to_tsquery($1, $4) "@q"
        WHERE setweight(to_tsvector($1, "post"."title"), $2) ||
              setweight(to_tsvector($1, "post"."body"), $3) @@ "@q"
      `,
      ['english', 'A', 'B', 'query'],
    );
  });

  it('should add numeric suffix to a second query', () => {
    const q = Post.search({
      text: 'text',
      tsQuery: '1',
    }).search({
      text: 'text',
      tsQuery: '2',
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $3) "@q", to_tsquery($4, $6) "@q2"
        WHERE to_tsvector($1, $2) @@ "@q" AND to_tsvector($4, $5) @@ "@q2"
      `,
      ['english', 'text', '1', 'english', 'text', '2'],
    );
  });

  it('should accept `order: true` to order by ts_rank DESC', async () => {
    const q = Post.search({
      text: 'text',
      tsQuery: 'query',
      order: true,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
        ORDER BY ts_rank(to_tsvector($1, $2), "@q") DESC
      `,
      ['english', 'text', 'query'],
    );
  });

  it('should order by cover density (ts_rank_cd), use weights, normalization, and order direction', async () => {
    const q = Post.search({
      text: 'text',
      tsQuery: 'query',
      order: {
        coverDensity: true,
        weights: [0.1, 0.2, 0.4, 1.0],
        normalization: 32,
        dir: 'ASC',
      },
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $3) "@q"
        WHERE to_tsvector($1, $2) @@ "@q"
        ORDER BY ts_rank_cd($4, to_tsvector($1, $2), "@q", $5) ASC
      `,
      ['english', 'text', 'query', '{0.1,0.2,0.4,1}', 32],
    );
  });

  it('should order using the query alias', async () => {
    const q = Post.search({
      as: 's',
      text: 'text',
      tsQuery: 'query',
    }).order({
      s: {
        coverDensity: true,
        weights: [0.1, 0.2, 0.4, 1.0],
        normalization: 32,
        dir: 'ASC',
      },
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${postColumnsSql} FROM "post", to_tsquery($1, $3) "s"
        WHERE to_tsvector($1, $2) @@ "s"
        ORDER BY ts_rank_cd($4, to_tsvector($1, $2), "s", $5) ASC
      `,
      ['english', 'text', 'query', '{0.1,0.2,0.4,1}', 32],
    );
  });

  it('should select headline for text', () => {
    const q = Post.search({
      as: 's',
      text: 'text',
      tsQuery: 'query',
    }).select({
      headline: (q) => q.headline('s', { options: 'MaxWords=10' }),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ts_headline($1, $2, "s", $3) "headline"
        FROM "post", to_tsquery($1, $4) "s"
        WHERE to_tsvector($1, $2) @@ "s"
      `,
      ['english', 'text', 'MaxWords=10', 'query'],
    );
  });

  it('should accept raw SQL for headline options', () => {
    const q = Post.search({
      as: 's',
      text: 'text',
      tsQuery: 'query',
    }).select({
      headline: (q) => q.headline('s', { options: raw`'MaxWords=' || ${10}` }),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ts_headline($1, $2, "s", 'MaxWords=' || $3) "headline"
        FROM "post", to_tsquery($1, $4) "s"
        WHERE to_tsvector($1, $2) @@ "s"
      `,
      ['english', 'text', 10, 'query'],
    );
  });

  it('should throw when trying to select a headline for a search based on a vector', async () => {
    const q = Post.search({
      as: 's',
      vector: 'generatedTsVector',
      tsQuery: 'query',
    }).select({
      headline: (q) => q.headline('s'),
    });

    await expect(q).rejects.toThrow(
      'Cannot use a search based on a vector column for a search headline',
    );
  });
});
