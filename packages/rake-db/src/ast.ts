import {
  ColumnsShape,
  ColumnType,
  ForeignKeyOptions,
  NoPrimaryKeyOption,
  RawExpression,
  SingleColumnIndexOptions,
  TableData,
} from 'pqb';
import { DropMode } from './migration/migration';

export type RakeDbAst =
  | RakeDbAst.Table
  | RakeDbAst.ChangeTable
  | RakeDbAst.RenameTable
  | RakeDbAst.Schema
  | RakeDbAst.Extension
  | RakeDbAst.Enum
  | RakeDbAst.ForeignKey;

export namespace RakeDbAst {
  export type Table = {
    type: 'table';
    action: 'create' | 'drop';
    schema?: string;
    name: string;
    shape: ColumnsShape;
    noPrimaryKey: NoPrimaryKeyOption;
    dropMode?: DropMode;
    comment?: string;
  } & TableData;

  export type ChangeTable = {
    type: 'changeTable';
    schema?: string;
    name: string;
    comment?: string | null;
    shape: Record<string, ChangeTableItem>;
    add: TableData;
    drop: TableData;
  };

  export type ChangeTableItem =
    | ChangeTableItem.Column
    | ChangeTableItem.Change
    | ChangeTableItem.Rename;

  export namespace ChangeTableItem {
    export type Column = {
      type: 'add' | 'drop';
      item: ColumnType;
      dropMode?: DropMode;
    };

    export type Change = {
      type: 'change';
      from: ColumnChange;
      to: ColumnChange;
      using?: RawExpression;
    };

    export type Rename = {
      type: 'rename';
      name: string;
    };
  }

  export type ColumnChange = {
    column?: ColumnType;
    type?: string;
    collate?: string;
    default?: unknown | RawExpression;
    nullable?: boolean;
    comment?: string | null;
    compression?: string;
    primaryKey?: boolean;
    foreignKeys?: ({
      table: string;
      columns: string[];
    } & ForeignKeyOptions)[];
    indexes?: Omit<SingleColumnIndexOptions, 'column' | 'expression'>[];
  };

  export type RenameTable = {
    type: 'renameTable';
    fromSchema?: string;
    from: string;
    toSchema?: string;
    to: string;
  };

  export type Schema = {
    type: 'schema';
    action: 'create' | 'drop';
    name: string;
  };

  export type Extension = {
    type: 'extension';
    action: 'create' | 'drop';
    name: string;
    schema?: string;
    version?: string;
    cascade?: boolean;
    createIfNotExists?: boolean;
    dropIfExists?: boolean;
  };

  export type Enum = {
    type: 'enum';
    action: 'create' | 'drop';
    schema?: string;
    name: string;
    values: string[];
    cascade?: boolean;
    dropIfExists?: boolean;
  };

  export type EnumOptions = {
    createIfNotExists?: boolean;
    dropIfExists?: boolean;
  };

  export type ForeignKey = {
    type: 'foreignKey';
    action: 'create';
    tableSchema?: string;
    tableName: string;
  } & TableData.ForeignKey;
}
