import { Adapter } from 'pqb';

export namespace DbStructure {
  export type Table = {
    schemaName: string;
    name: string;
    comment?: string;
  };

  export type View = {
    schemaName: string;
    name: string;
  };

  export type Procedure = {
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
  };

  export type Column = {
    schemaName: string;
    tableName: string;
    name: string;
    type: string;
    maxChars?: number;
    numericPrecision?: number;
    numericScale?: number;
    dateTimePrecision?: number;
    default?: string;
    isNullable: boolean;
    collation?: string;
    compression?: 'p' | 'l'; // p for pglz, l for lz4
    comment?: string;
  };

  export type Index = {
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
    with?: string;
    tablespace?: string;
    where?: string;
  };

  // a = no action, r = restrict, c = cascade, n = set null, d = set default
  type ForeignKeyAction = 'a' | 'r' | 'c' | 'n' | 'd';

  export type ForeignKey = {
    schemaName: string;
    tableName: string;
    foreignTableSchemaName: string;
    foreignTableName: string;
    name: string;
    columnNames: string[];
    foreignColumnNames: string[];
    match: 'f' | 'p' | 's'; // FULL | PARTIAL | SIMPLE
    onUpdate: ForeignKeyAction;
    onDelete: ForeignKeyAction;
  };

  export type PrimaryKey = {
    schemaName: string;
    tableName: string;
    name: string;
    columnNames: string[];
  };

  export type Trigger = {
    schemaName: string;
    tableName: string;
    triggerSchema: string;
    name: string;
    events: string[];
    activation: string;
    condition?: string;
    definition: string;
  };

  export type Extension = {
    schemaName: string;
    name: string;
    version?: string;
  };

  export type Enum = {
    schemaName: string;
    name: string;
    values: string[];
  };
}

const filterSchema = (table: string) =>
  `${table} !~ '^pg_' AND ${table} != 'information_schema'`;

export class DbStructure {
  constructor(private db: Adapter) {}

  async getSchemas(): Promise<string[]> {
    const { rows } = await this.db.arrays<[string]>(
      `SELECT n.nspname "name"
FROM pg_catalog.pg_namespace n
WHERE ${filterSchema('n.nspname')}
ORDER BY "name"`,
    );
    return rows.flat();
  }

  async getTables() {
    const { rows } = await this.db.query<DbStructure.Table>(
      `SELECT
  nspname AS "schemaName",
  relname AS "name",
  obj_description(c.oid) AS comment
FROM pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = relnamespace
WHERE relkind = 'r'
  AND ${filterSchema('nspname')}
ORDER BY relname`,
    );
    return rows;
  }

  async getViews() {
    const { rows } = await this.db.query<DbStructure.View[]>(
      `SELECT
  table_schema "schemaName",
  table_name "name"
FROM information_schema.tables
WHERE table_type = 'VIEW'
  AND ${filterSchema('table_schema')}
ORDER BY table_name`,
    );
    return rows;
  }

  async getProcedures() {
    const { rows } = await this.db.query<DbStructure.Procedure[]>(
      `SELECT
  n.nspname AS "schemaName",
  proname AS name,
  proretset AS "returnSet",
  (
    SELECT typname FROM pg_type WHERE oid = prorettype
  ) AS "returnType",
  prokind AS "kind",
  coalesce((
    SELECT true FROM information_schema.triggers
    WHERE n.nspname = trigger_schema AND trigger_name = proname
    LIMIT 1
  ), false) AS "isTrigger",
  coalesce((
    SELECT json_agg(pg_type.typname)
    FROM unnest(coalesce(proallargtypes, proargtypes)) typeId
    JOIN pg_type ON pg_type.oid = typeId
  ), '[]') AS "types",
  coalesce(to_json(proallargtypes::int[]), to_json(proargtypes::int[])) AS "argTypes",
  coalesce(to_json(proargmodes), '[]') AS "argModes",
  to_json(proargnames) AS "argNames"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE ${filterSchema('n.nspname')}`,
    );
    return rows;
  }

  async getColumns() {
    const { rows } = await this.db.query<DbStructure.Column>(
      `SELECT
  table_schema "schemaName",
  table_name "tableName",
  column_name "name",
  udt_name "type",
  character_maximum_length AS "maxChars",
  numeric_precision AS "numericPrecision",
  numeric_scale AS "numericScale",
  datetime_precision AS "dateTimePrecision",
  column_default "default",
  is_nullable::boolean "isNullable",
  collation_name AS "collation",
  NULLIF(a.attcompression, '') AS compression,
  pgd.description AS "comment"
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables AS st
  ON c.table_schema = st.schemaname
 AND c.table_name = st.relname
LEFT JOIN pg_catalog.pg_description pgd
  ON pgd.objoid = st.relid
 AND pgd.objsubid = c.ordinal_position
LEFT JOIN pg_catalog.pg_attribute a
  ON a.attrelid = st.relid
 AND a.attnum = c.ordinal_position
WHERE ${filterSchema('table_schema')}
ORDER BY c.ordinal_position`,
    );
    return rows;
  }

  async getIndexes() {
    const { rows } = await this.db.query<DbStructure.Index>(
      `SELECT
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
ORDER BY ic.relname`,
    );
    return rows;
  }

  async getForeignKeys() {
    const { rows } = await this.db.query<DbStructure.ForeignKey>(
      `SELECT
  s.nspname AS "schemaName",
  t.relname AS "tableName",
  fs.nspname AS "foreignTableSchemaName",
  ft.relname AS "foreignTableName",
  c.conname AS "name",
  (
    SELECT json_agg(ccu.column_name)
    FROM information_schema.key_column_usage ccu
    WHERE ccu.constraint_name = c.conname
      AND ccu.table_schema = cs.nspname
  ) AS "columnNames",
  (
    SELECT json_agg(ccu.column_name)
    FROM information_schema.constraint_column_usage ccu
    WHERE ccu.constraint_name = c.conname
      AND ccu.table_schema = cs.nspname
  ) AS "foreignColumnNames",
  c.confmatchtype AS match,
  c.confupdtype AS "onUpdate",
  c.confdeltype AS "onDelete"
FROM pg_catalog.pg_constraint c
JOIN pg_class t ON t.oid = conrelid
JOIN pg_catalog.pg_namespace s ON s.oid = t.relnamespace
JOIN pg_class ft ON ft.oid = confrelid
JOIN pg_catalog.pg_namespace fs ON fs.oid = ft.relnamespace
JOIN pg_catalog.pg_namespace cs ON cs.oid = c.connamespace
WHERE contype = 'f'
ORDER BY c.conname`,
    );
    return rows;
  }

  async getPrimaryKeys() {
    const { rows } = await this.db.query<DbStructure.PrimaryKey>(
      `SELECT tc.table_schema AS "schemaName",
  tc.table_name AS "tableName",
  tc.constraint_name AS "name",
  json_agg(ccu.column_name) "columnNames"
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND ${filterSchema('tc.table_schema')}
GROUP BY "schemaName", "tableName", "name"
ORDER BY "name"`,
    );
    return rows;
  }

  async getTriggers() {
    const { rows } = await this.db.query<DbStructure.Trigger>(
      `SELECT event_object_schema AS "schemaName",
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
ORDER BY trigger_name`,
    );
    return rows;
  }

  async getExtensions() {
    const { rows } = await this.db.query<DbStructure.Extension>(
      `SELECT
  nspname AS "schemaName",
  extname AS "name",
  extversion AS version
FROM pg_extension
JOIN pg_catalog.pg_namespace n ON n.oid = extnamespace
 AND ${filterSchema('n.nspname')}`,
    );
    return rows;
  }

  async getEnums() {
    const { rows } = await this.db.query<DbStructure.Enum>(
      `SELECT
  n.nspname as "schemaName",
  t.typname as name,
  json_agg(e.enumlabel) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE ${filterSchema('n.nspname')}
GROUP BY n.nspname, t.typname`,
    );
    return rows;
  }
}
