import { ColumnsShape, ColumnType, NoPrimaryKeyOption, TableData } from 'pqb';
import { DropMode } from './migration/migration';
import {
  ColumnDataCheckBase,
  MaybeArray,
  RawSQLBase,
  RecordString,
} from 'orchid-core';

export type RakeDbAst =
  | RakeDbAst.Table
  | RakeDbAst.ChangeTable
  | RakeDbAst.RenameType
  | RakeDbAst.Schema
  | RakeDbAst.RenameSchema
  | RakeDbAst.Extension
  | RakeDbAst.Enum
  | RakeDbAst.EnumValues
  | RakeDbAst.RenameEnumValues
  | RakeDbAst.ChangeEnumValues
  | RakeDbAst.Domain
  | RakeDbAst.Collation
  | RakeDbAst.Constraint
  | RakeDbAst.RenameTableItem
  | RakeDbAst.View;

export namespace RakeDbAst {
  export interface Table extends TableData {
    type: 'table';
    action: 'create' | 'drop';
    schema?: string;
    name: string;
    shape: ColumnsShape;
    noPrimaryKey: NoPrimaryKeyOption;
    createIfNotExists?: boolean;
    dropIfExists?: boolean;
    dropMode?: DropMode;
    comment?: string;
  }

  export interface ChangeTable {
    type: 'changeTable';
    schema?: string;
    name: string;
    comment?: string | [string, string] | null;
    shape: ChangeTableShape;
    add: TableData;
    drop: TableData;
  }

  // it can be an array to allow adding and dropping the same column in a single `changeTable`
  export type ChangeTableShape = Record<string, MaybeArray<ChangeTableItem>>;

  export type ChangeTableItem =
    | ChangeTableItem.Column
    | ChangeTableItem.Change
    | ChangeTableItem.Rename;

  export namespace ChangeTableItem {
    export interface Column {
      type: 'add' | 'drop';
      item: ColumnType;
      dropMode?: DropMode;
    }

    export interface Change {
      type: 'change';
      name?: string;
      from: ColumnChange;
      to: ColumnChange;
      using?: ChangeUsing;
    }

    export interface ChangeUsing {
      usingUp?: RawSQLBase;
      usingDown?: RawSQLBase;
    }

    export interface Rename {
      type: 'rename';
      name: string;
    }
  }

  export interface ColumnChange {
    column?: ColumnType;
    type?: string;
    collate?: string;
    default?: unknown | RawSQLBase;
    nullable?: boolean;
    comment?: string | null;
    compression?: string;
    primaryKey?: boolean;
    check?: ColumnDataCheckBase;
    foreignKeys?: TableData.ColumnReferences[];
    indexes?: TableData.ColumnIndex[];
    excludes?: TableData.ColumnExclude[];
    identity?: TableData.Identity;
  }

  export interface RenameType {
    type: 'renameType';
    kind: 'TABLE' | 'TYPE' | 'DOMAIN';
    fromSchema?: string;
    from: string;
    toSchema?: string;
    to: string;
  }

  export interface Schema {
    type: 'schema';
    action: 'create' | 'drop';
    name: string;
  }

  export interface RenameSchema {
    type: 'renameSchema';
    from: string;
    to: string;
  }

  export interface ExtensionArg {
    version?: string;
    cascade?: boolean;
    createIfNotExists?: boolean;
    dropIfExists?: boolean;
  }

  export interface Extension extends ExtensionArg {
    type: 'extension';
    action: 'create' | 'drop';
    schema?: string;
    name: string;
  }

  export interface Enum {
    type: 'enum';
    action: 'create' | 'drop';
    schema?: string;
    name: string;
    values: [string, ...string[]];
    cascade?: boolean;
    dropIfExists?: boolean;
  }

  export interface EnumValues {
    type: 'enumValues';
    action: 'add' | 'drop';
    schema?: string;
    name: string;
    values: string[];
    place?: 'before' | 'after';
    relativeTo?: string;
    ifNotExists?: boolean;
  }

  export interface RenameEnumValues {
    type: 'renameEnumValues';
    schema?: string;
    name: string;
    values: RecordString;
  }

  export interface ChangeEnumValues {
    type: 'changeEnumValues';
    schema?: string;
    name: string;
    fromValues: string[];
    toValues: string[];
  }

  export interface Domain {
    type: 'domain';
    action: 'create' | 'drop';
    schema?: string;
    name: string;
    baseType: ColumnType;
  }

  // Database collation.
  export interface Collation {
    // Type of RakeDb.AST for the collation.
    type: 'collation';
    // Create or drop the collation.
    action: 'create' | 'drop';
    // Specify a schema to create collation in.
    schema?: string;
    // Name of the collation.
    name: string;
    // This is a shortcut for setting lcCollate and lcCType at once. If you specify this, you cannot specify either of those parameters.
    locale?: string;
    // Use the specified operating system locale for the lcCollate locale category.
    lcCollate?: string;
    // Use the specified operating system locale for the lcCType locale category.
    lcCType?: string;
    // Specifies the provider to use for locale services associated with this collation. Possible values are: icu, libc. libc is the default. The available choices depend on the operating system and build options.
    provider?: string;
    // Specifies whether the collation should use deterministic comparisons.
    // The default is true.
    // A deterministic comparison considers strings that are not byte-wise equal to be unequal even if they are considered logically equal by the comparison.
    // PostgreSQL breaks ties using a byte-wise comparison.
    // Comparison that is not deterministic can make the collation be, say, case- or accent-insensitive.
    // For that, you need to choose an appropriate LC_COLLATE setting and set the collation to not deterministic here.
    // Nondeterministic collations are only supported with the ICU provider.
    deterministic?: boolean;
    // Normally, it should be omitted.
    // This option is intended to be used by pg_upgrade for copying the version from an existing installation.
    version?: string;
    // The name of an existing collation to copy. The new collation will have the same properties as the existing one, but it will be an independent object.
    fromExisting?: string;
    // Create only if exists, ignore otherwise.
    createIfNotExists?: boolean;
    // Drop only if exists, throws error otherwise.
    dropIfExists?: boolean;
    // Add CASCADE when dropping a collation.
    cascade?: boolean;
  }

  export interface EnumOptions {
    createIfNotExists?: boolean;
    dropIfExists?: boolean;
  }

  export interface Constraint extends TableData.Constraint {
    type: 'constraint';
    action: 'create' | 'drop';
    tableSchema?: string;
    tableName: string;
  }

  export interface RenameTableItem {
    type: 'renameTableItem';
    kind: 'INDEX' | 'CONSTRAINT';
    tableSchema?: string;
    tableName: string;
    from: string;
    to: string;
  }

  export interface View {
    type: 'view';
    action: 'create' | 'drop';
    schema?: string;
    name: string;
    shape: ColumnsShape;
    sql: RawSQLBase;
    options: ViewOptions;
    deps: { schemaName: string; name: string }[];
  }

  export interface ViewOptions {
    createOrReplace?: boolean;
    dropIfExists?: boolean;
    dropMode?: DropMode;
    temporary?: boolean;
    recursive?: boolean;
    columns?: string[];
    with?: {
      checkOption?: 'LOCAL' | 'CASCADED';
      securityBarrier?: boolean;
      securityInvoker?: boolean;
    };
  }
}
