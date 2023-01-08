import { ColumnsShape, NoPrimaryKeyOption, TableData } from 'pqb';
import { DropMode } from './migration/migration';

export type RakeDbAst = RakeDbAst.Table;

export namespace RakeDbAst {
  export type Table = {
    type: 'table';
    action: 'create' | 'drop';
    name: string;
    shape: ColumnsShape;
    noPrimaryKey: NoPrimaryKeyOption;
    dropMode?: DropMode;
    comment?: string;
  } & TableData;
}
