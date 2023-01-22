import { Adapter } from 'pqb';

export namespace DbStructure {
  export type Table = {
    schemaName: string;
    name: string;
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
  };

  export type Index = {
    schemaName: string;
    tableName: string;
    columnNames: string[];
    name: string;
    isUnique: boolean;
    isPrimary: boolean;
  };

  export type ForeignKey = {
    schemaName: string;
    tableName: string;
    foreignTableSchemaName: string;
    foreignTableName: string;
    name: string;
    columnNames: string[];
    foreignColumnNames: string[];
  };

  export type Constraint = {
    schemaName: string;
    tableName: string;
    name: string;
    type: 'CHECK' | 'FOREIGN KEY' | 'PRIMARY KEY' | 'UNIQUE';
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
  table_schema "schemaName",
  table_name "name"
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND ${filterSchema('table_schema')}
ORDER BY table_name`,
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
      `SELECT table_schema "schemaName",
  table_name "tableName",
  column_name "name",
  udt_name "type",
  character_maximum_length AS "maxChars",
  numeric_precision AS "numericPrecision",
  numeric_scale AS "numericScale",
  datetime_precision AS "dateTimePrecision",
  column_default "default",
  is_nullable::boolean "isNullable"
FROM information_schema.columns
WHERE ${filterSchema('table_schema')}
ORDER BY ordinal_position`,
    );
    return rows;
  }

  async getIndexes() {
    const { rows } = await this.db.query<DbStructure.Index>(
      `SELECT
  nspname "schemaName",
  t.relname "tableName",
  json_agg(attname) "columnNames",
  ic.relname "name",
  indisunique "isUnique",
  indisprimary "isPrimary"
FROM pg_index
JOIN pg_class t ON t.oid = indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_attribute ON attrelid = t.oid AND attnum = any(indkey)
JOIN pg_class ic ON ic.oid = indexrelid
WHERE ${filterSchema('n.nspname')}
GROUP BY "schemaName", "tableName", "name", "isUnique", "isPrimary"
ORDER BY "name"`,
    );
    return rows;
  }

  async getForeignKeys() {
    const { rows } = await this.db.query<DbStructure.ForeignKey>(
      `SELECT tc.table_schema AS "schemaName",
  tc.table_name AS "tableName",
  ccu.table_schema AS "foreignTableSchemaName",
  ccu.table_name AS "foreignTableName",
  tc.constraint_name AS "name",
  (
    SELECT json_agg(kcu.column_name)
    FROM information_schema.key_column_usage kcu
    WHERE kcu.constraint_name = tc.constraint_name
      AND kcu.table_schema = tc.table_schema
  ) AS "columnNames",
  json_agg(ccu.column_name) AS "foreignColumnNames"
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ${filterSchema('tc.table_schema')}
GROUP BY "schemaName", "tableName", "name", "foreignTableSchemaName", "foreignTableName"
ORDER BY "name"`,
    );
    return rows;
  }

  async getConstraints() {
    const { rows } = await this.db.query<DbStructure.Constraint>(
      `SELECT tc.table_schema AS "schemaName",
  tc.table_name AS "tableName",
  tc.constraint_name AS "name",
  tc.constraint_type AS "type",
  json_agg(ccu.column_name) "columnNames"
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type != 'FOREIGN KEY'
  AND ${filterSchema('tc.table_schema')}
GROUP BY "schemaName", "tableName", "name", "type"
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
}
