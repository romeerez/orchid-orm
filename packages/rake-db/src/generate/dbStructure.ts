import { Adapter } from 'pqb';
import { RakeDbAst } from '../ast';

export namespace DbStructure {
  export interface Table {
    schemaName: string;
    name: string;
    comment?: string;
    columns: Column[];
  }

  export interface View {
    schemaName: string;
    name: string;
    deps: RakeDbAst.View['deps'];
    isRecursive: boolean;
    with?: string[]; // ['check_option=LOCAL', 'security_barrier=true']
    columns: Column[];
    sql: string;
  }

  export interface Procedure {
    schemaName: string;
    name: string;
    returnSet: boolean;
    returnType: string;
    kind: string;
    isTrigger: boolean;
    types: string[];
    argTypes: string[];
    argModes: ('i' | 'o')[];
    argNames?: string[];
  }

  export interface Column {
    schemaName: string;
    tableName: string;
    name: string;
    typeSchema: string;
    type: string;
    isArray: boolean;
    maxChars?: number;
    numericPrecision?: number;
    numericScale?: number;
    dateTimePrecision?: number;
    default?: string;
    isNullable: boolean;
    collation?: string;
    compression?: 'p' | 'l'; // p for pglz, l for lz4
    comment?: string;
    identity?: {
      always: boolean;
      start?: number;
      increment?: number;
      min?: number;
      max?: number;
      cache?: number;
      cycle?: boolean;
    };
  }

  export interface Index {
    schemaName: string;
    tableName: string;
    name: string;
    using: string;
    isUnique: boolean;
    columns: (({ column: string } | { expression: string }) & {
      collate?: string;
      opclass?: string;
      order?: string;
    })[];
    include?: string[];
    nullsNotDistinct?: boolean;
    with?: string;
    tablespace?: string;
    where?: string;
  }

  // a = no action, r = restrict, c = cascade, n = set null, d = set default
  type ForeignKeyAction = 'a' | 'r' | 'c' | 'n' | 'd';

  export interface Constraint {
    schemaName: string;
    tableName: string;
    name: string;
    primaryKey?: string[];
    references?: References;
    check?: Check;
  }

  export interface References {
    foreignSchema: string;
    foreignTable: string;
    columns: string[];
    foreignColumns: string[];
    match: 'f' | 'p' | 's'; // FULL | PARTIAL | SIMPLE
    onUpdate: ForeignKeyAction;
    onDelete: ForeignKeyAction;
  }

  export interface Check {
    columns?: string[];
    expression: string;
  }

  export interface Trigger {
    schemaName: string;
    tableName: string;
    triggerSchema: string;
    name: string;
    events: string[];
    activation: string;
    condition?: string;
    definition: string;
  }

  export interface Extension {
    schemaName: string;
    name: string;
    version?: string;
  }

  export interface Enum {
    schemaName: string;
    name: string;
    values: [string, ...string[]];
  }

  export interface Domain {
    schemaName: string;
    name: string;
    type: string;
    typeSchema: string;
    isArray: boolean;
    notNull: boolean;
    maxChars?: number;
    numericPrecision?: number;
    numericScale?: number;
    dateTimePrecision?: number;
    collation?: string;
    default?: string;
    check?: string;
  }

  export interface Collation {
    schema: string;
    name: string;
    provider: string;
    deterministic: boolean;
    lcCollate?: string;
    lcCType?: string;
    locale?: string;
    version?: string;
  }
}

const filterSchema = (table: string) =>
  `${table} !~ '^pg_' AND ${table} != 'information_schema'`;

const jsonAgg = (sql: string, as: string) =>
  `(SELECT coalesce(json_agg(t.*), '[]') FROM (${sql}) t) AS "${as}"`;

const columnsSql = ({
  schema,
  table,
  join = '',
  where,
}: {
  schema: string;
  table: string;
  join?: string;
  where: string;
}) => `SELECT
  ${schema}.nspname AS "schemaName",
  ${table}.relname AS "tableName",
  a.attname AS "name",
  COALESCE(et.typname, t.typname) AS "type",
  tn.nspname AS "typeSchema",
  et.typname IS NOT NULL AS "isArray",
  information_schema._pg_char_max_length(
    information_schema._pg_truetypid(a, t),
    information_schema._pg_truetypmod(a, t)
  ) AS "maxChars",
  information_schema._pg_numeric_precision(
    information_schema._pg_truetypid(a, t),
    information_schema._pg_truetypmod(a, t)
  ) AS "numericPrecision",
  information_schema._pg_numeric_scale(
    information_schema._pg_truetypid(a, t),
    information_schema._pg_truetypmod(a, t)
  ) AS "numericScale",
  information_schema._pg_datetime_precision(
    information_schema._pg_truetypid(a, t),
    information_schema._pg_truetypmod(a, t)
  ) AS "datetimePrecision",
  CAST(
    CASE WHEN a.attgenerated = ''
      THEN pg_get_expr(ad.adbin, ad.adrelid)
    END AS information_schema.character_data
  ) AS "default",
  NOT (a.attnotnull OR (t.typtype = 'd' AND t.typnotnull)) AS "isNullable",
  co.collname AS "collation",
  NULLIF(a.attcompression, '') AS compression,
  pgd.description AS "comment",
  (
    CASE WHEN a.attidentity IN ('a', 'd') THEN (
      json_build_object(
        'always',
        a.attidentity = 'a',
        'start',
        seq.seqstart,
        'increment',
        seq.seqincrement,
        'min',
        nullif(seq.seqmin, 1),
        'max',
        nullif(seq.seqmax, (
          CASE COALESCE(et.typname, t.typname)
            WHEN 'int2' THEN 32767
            WHEN 'int4' THEN 2147483647
            WHEN 'int8' THEN 9223372036854775807
            ELSE NULL
            END
          )),
        'cache',
        seq.seqcache,
        'cycle',
        seq.seqcycle
      )
    ) END
  ) "identity"
FROM pg_attribute a
${join}
LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
JOIN pg_type t ON a.atttypid = t.oid
LEFT JOIN pg_type et ON t.typelem = et.oid
JOIN pg_namespace tn ON tn.oid = t.typnamespace
LEFT JOIN (pg_collation co JOIN pg_namespace nco ON (co.collnamespace = nco.oid))
  ON a.attcollation = co.oid AND (nco.nspname, co.collname) <> ('pg_catalog', 'default')
LEFT JOIN pg_catalog.pg_description pgd
  ON pgd.objoid = a.attrelid
 AND pgd.objsubid = a.attnum
LEFT JOIN (pg_depend dep JOIN pg_sequence seq ON (dep.classid = 'pg_class'::regclass AND dep.objid = seq.seqrelid AND dep.deptype = 'i'))
  ON (dep.refclassid = 'pg_class'::regclass AND dep.refobjid = ${table}.oid AND dep.refobjsubid = a.attnum)
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND ${where}
ORDER BY a.attnum`;

const schemasSql = `SELECT coalesce(json_agg(nspname ORDER BY nspname), '[]')
FROM pg_catalog.pg_namespace n
WHERE ${filterSchema('nspname')}`;

const tablesSql = `SELECT
  nspname AS "schemaName",
  relname AS "name",
  obj_description(c.oid) AS comment,
  (SELECT coalesce(json_agg(t), '[]') FROM (${columnsSql({
    schema: 'n',
    table: 'c',
    where: 'a.attrelid = c.oid',
  })}) t) AS "columns"
FROM pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = relnamespace
WHERE relkind = 'r'
  AND ${filterSchema('nspname')}
ORDER BY relname`;

const viewsSql = `SELECT
  nc.nspname AS "schemaName",
  c.relname AS "name",
  (
    SELECT COALESCE(json_agg(t.*), '[]')
    FROM (
      SELECT
        ns.nspname AS "schemaName",
        obj.relname AS "name"
      FROM pg_class obj
      JOIN pg_depend dep ON dep.refobjid = obj.oid
      JOIN pg_rewrite rew ON rew.oid = dep.objid
      JOIN pg_namespace ns ON ns.oid = obj.relnamespace
      WHERE rew.ev_class = c.oid AND obj.oid <> c.oid
    ) t
  ) "deps",
  right(substring(r.ev_action from ':hasRecursive \w'), 1)::bool AS "isRecursive",
  array_to_json(c.reloptions) AS "with",
  (SELECT coalesce(json_agg(t), '[]') FROM (${columnsSql({
    schema: 'nc',
    table: 'c',
    where: 'a.attrelid = c.oid',
  })}) t) AS "columns",
  pg_get_viewdef(c.oid) AS "sql"
FROM pg_namespace nc
JOIN pg_class c
  ON nc.oid = c.relnamespace
 AND c.relkind = 'v'
 AND c.relpersistence != 't'
JOIN pg_rewrite r ON r.ev_class = c.oid
WHERE ${filterSchema('nc.nspname')}
ORDER BY c.relname`;

const indexesSql = `SELECT
  n.nspname "schemaName",
  t.relname "tableName",
  ic.relname "name",
  am.amname AS "using",
  i.indisunique "isUnique",
  (
    SELECT json_agg(
      (
        CASE WHEN t.e = 0
        THEN jsonb_build_object('expression', pg_get_indexdef(i.indexrelid, t.i::int4, false))
        ELSE jsonb_build_object('column', (
          (
            SELECT attname
            FROM pg_catalog.pg_attribute
            WHERE attrelid = i.indrelid
              AND attnum = t.e
          )
        ))
        END
      ) || (
        CASE WHEN i.indcollation[t.i - 1] = 0
        THEN '{}'::jsonb
        ELSE (
          SELECT (
            CASE WHEN collname = 'default'
            THEN '{}'::jsonb
            ELSE jsonb_build_object('collate', collname)
            END
          )
          FROM pg_catalog.pg_collation
          WHERE oid = i.indcollation[t.i - 1]
        )
        END
      ) || (
        SELECT
          CASE WHEN opcdefault AND attoptions IS NULL
          THEN '{}'::jsonb
          ELSE jsonb_build_object(
            'opclass', opcname || COALESCE('(' || array_to_string(attoptions, ', ') || ')', '')
          )
          END
        FROM pg_opclass
        LEFT JOIN pg_attribute
          ON attrelid = i.indexrelid
         AND attnum = t.i
        WHERE oid = i.indclass[t.i - 1]
      ) || (
        CASE WHEN i.indoption[t.i - 1] = 0
        THEN '{}'::jsonb
        ELSE jsonb_build_object(
          'order',
          CASE
            WHEN i.indoption[t.i - 1] = 1 THEN 'DESC NULLS LAST'
            WHEN i.indoption[t.i - 1] = 2 THEN 'ASC NULLS FIRST'
            WHEN i.indoption[t.i - 1] = 3 THEN 'DESC'
            ELSE NULL
          END
        )
        END
      )
    )
    FROM unnest(i.indkey[:indnkeyatts - 1]) WITH ORDINALITY AS t(e, i)
  ) "columns",
  (
    SELECT json_agg(
      (
        SELECT attname
        FROM pg_catalog.pg_attribute
        WHERE attrelid = i.indrelid
          AND attnum = j.e
      )
    )
    FROM unnest(i.indkey[indnkeyatts:]) AS j(e)
  ) AS "include",
  (to_jsonb(i.*)->'indnullsnotdistinct')::bool AS "nullsNotDistinct",
  NULLIF(pg_catalog.array_to_string(
    ic.reloptions || array(SELECT 'toast.' || x FROM pg_catalog.unnest(tc.reloptions) x),
    ', '
  ), '') AS "with",
  (
    SELECT tablespace
    FROM pg_indexes
    WHERE schemaname = n.nspname
      AND indexname = ic.relname
  ) AS tablespace,
  pg_get_expr(i.indpred, i.indrelid) AS "where"
FROM pg_index i
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_am am ON am.oid = ic.relam
LEFT JOIN pg_catalog.pg_class tc ON (ic.reltoastrelid = tc.oid)
WHERE ${filterSchema('n.nspname')}
  AND NOT i.indisprimary
ORDER BY ic.relname`;

const constraintsSql = `SELECT
  s.nspname AS "schemaName",
  t.relname AS "tableName",
  c.conname AS "name",
  (
    SELECT json_agg(ccu.column_name)
    FROM information_schema.constraint_column_usage ccu
    WHERE contype = 'p'
      AND ccu.constraint_name = c.conname
      AND ccu.table_schema = s.nspname
  ) AS "primaryKey",
  (
    SELECT
      json_build_object(
        'foreignSchema',
        fs.nspname,
        'foreignTable',
        ft.relname,
        'columns',
        (
          SELECT json_agg(ccu.column_name)
          FROM information_schema.key_column_usage ccu
          WHERE ccu.constraint_name = c.conname
            AND ccu.table_schema = cs.nspname
        ),
        'foreignColumns',
        (
          SELECT json_agg(ccu.column_name)
          FROM information_schema.constraint_column_usage ccu
          WHERE ccu.constraint_name = c.conname
            AND ccu.table_schema = cs.nspname
        ),
        'match',
        c.confmatchtype,
        'onUpdate',
        c.confupdtype,
        'onDelete',
        c.confdeltype
      )
    FROM pg_class ft
    JOIN pg_catalog.pg_namespace fs ON fs.oid = ft.relnamespace
    JOIN pg_catalog.pg_namespace cs ON cs.oid = c.connamespace
    WHERE contype = 'f' AND ft.oid = confrelid
  ) AS "references",
  (
    SELECT
      CASE conbin IS NULL
      WHEN false THEN
        json_build_object(
          'columns',
          json_agg(ccu.column_name),
          'expression',
          pg_get_expr(conbin, conrelid)
        )
      END
    FROM information_schema.constraint_column_usage ccu
    WHERE conbin IS NOT NULL
      AND ccu.constraint_name = c.conname
      AND ccu.table_schema = s.nspname
  ) AS "check"
FROM pg_catalog.pg_constraint c
JOIN pg_class t ON t.oid = conrelid
JOIN pg_catalog.pg_namespace s
  ON s.oid = t.relnamespace
 AND contype IN ('p', 'f', 'c')
 AND ${filterSchema('s.nspname')}
ORDER BY c.conname`;

const triggersSql = `SELECT event_object_schema AS "schemaName",
  event_object_table AS "tableName",
  trigger_schema AS "triggerSchema",
  trigger_name AS name,
  json_agg(event_manipulation) AS events,
  action_timing AS activation,
  action_condition AS condition,
  action_statement AS definition
FROM information_schema.triggers
WHERE ${filterSchema('event_object_schema')}
GROUP BY event_object_schema, event_object_table, trigger_schema, trigger_name, action_timing, action_condition, action_statement
ORDER BY trigger_name`;

const extensionsSql = `SELECT
  nspname AS "schemaName",
  extname AS "name",
  extversion AS version
FROM pg_extension
JOIN pg_catalog.pg_namespace n ON n.oid = extnamespace
 AND ${filterSchema('n.nspname')}`;

const enumsSql = `SELECT
  n.nspname as "schemaName",
  t.typname as name,
  json_agg(e.enumlabel) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE ${filterSchema('n.nspname')}
GROUP BY n.nspname, t.typname`;

const domainsSql = `SELECT
  n.nspname AS "schemaName",
  d.typname AS "name",
  t.typname AS "type",
  s.nspname AS "typeSchema",
  d.typnotnull AS "notNull",
  d.typcategory = 'A' AS "isArray",
  character_maximum_length AS "maxChars",
  numeric_precision AS "numericPrecision",
  numeric_scale AS "numericScale",
  datetime_precision AS "dateTimePrecision",
  collation_name AS "collation",
  domain_default AS "default",
  pg_get_expr(conbin, conrelid) AS "expression"
FROM pg_catalog.pg_type d
JOIN pg_catalog.pg_namespace n ON n.oid = d.typnamespace
JOIN information_schema.domains i
  ON i.domain_schema = nspname
 AND i.domain_name = d.typname
JOIN pg_catalog.pg_type t
  ON (
    CASE WHEN d.typcategory = 'A'
      THEN t.typarray
      ELSE t.oid
    END
  ) = d.typbasetype
JOIN pg_catalog.pg_namespace s ON s.oid = t.typnamespace
LEFT JOIN pg_catalog.pg_constraint c ON c.contypid = d.oid
WHERE d.typtype = 'd' AND ${filterSchema('n.nspname')}`;

const collationsSql = `SELECT
  nspname "schema",
  collname "name",
  CASE WHEN collprovider = 'i' THEN 'icu' WHEN collprovider = 'c' THEN 'libc' ELSE collprovider::text END "provider",
  collisdeterministic "deterministic",
  collcollate "lcCollate",
  collctype "lcCType",
  colliculocale "locale",
  collversion "version"
FROM pg_collation
JOIN pg_namespace n on pg_collation.collnamespace = n.oid
WHERE ${filterSchema('n.nspname')}`;

// procedures
// `SELECT
//   n.nspname AS "schemaName",
//   proname AS name,
//   proretset AS "returnSet",
//   (
//     SELECT typname FROM pg_type WHERE oid = prorettype
//   ) AS "returnType",
//   prokind AS "kind",
//   coalesce((
//     SELECT true FROM information_schema.triggers
//     WHERE n.nspname = trigger_schema AND trigger_name = proname
//     LIMIT 1
//   ), false) AS "isTrigger",
//   coalesce((
//     SELECT json_agg(pg_type.typname)
//     FROM unnest(coalesce(proallargtypes, proargtypes)) typeId
//     JOIN pg_type ON pg_type.oid = typeId
//   ), '[]') AS "types",
//   coalesce(to_json(proallargtypes::int[]), to_json(proargtypes::int[])) AS "argTypes",
//   coalesce(to_json(proargmodes), '[]') AS "argModes",
//   to_json(proargnames) AS "argNames"
// FROM pg_proc p
// JOIN pg_namespace n ON p.pronamespace = n.oid
// WHERE ${filterSchema('n.nspname')}`

const sql = `SELECT (${schemasSql}) AS "schemas", ${jsonAgg(
  tablesSql,
  'tables',
)}, ${jsonAgg(viewsSql, 'views')}, ${jsonAgg(indexesSql, 'indexes')}, ${jsonAgg(
  constraintsSql,
  'constraints',
)}, ${jsonAgg(triggersSql, 'triggers')}, ${jsonAgg(
  extensionsSql,
  'extensions',
)}, ${jsonAgg(enumsSql, 'enums')}, ${jsonAgg(domainsSql, 'domains')}, ${jsonAgg(
  collationsSql,
  'collations',
)}`;

export interface IntrospectedStructure {
  schemas: string[];
  tables: DbStructure.Table[];
  views: DbStructure.View[];
  indexes: DbStructure.Index[];
  constraints: DbStructure.Constraint[];
  triggers: DbStructure.Trigger[];
  extensions: DbStructure.Extension[];
  enums: DbStructure.Enum[];
  domains: DbStructure.Domain[];
  collations: DbStructure.Collation[];
}

export async function introspectDbSchema(
  db: Adapter,
): Promise<IntrospectedStructure> {
  const data = await db.query<IntrospectedStructure>(sql);
  return data.rows[0];
}
