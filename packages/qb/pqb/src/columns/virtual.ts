import { ColumnType } from './columnType';
import { Query } from '../query/query';
import { CreateCtx, UpdateCtx } from '../queryMethods';
import { Operators } from './operators';

export abstract class VirtualColumn extends ColumnType<
  unknown,
  typeof Operators.any
> {
  dataType = '';
  operators = Operators.any;

  toCode(): never {
    throw new Error(`toCode is not implemented for virtual column`);
  }

  create?(
    q: Query,
    ctx: CreateCtx,
    item: Record<string, unknown>,
    rowIndex: number,
  ): void;

  update?(q: Query, ctx: UpdateCtx, set: Record<string, unknown>): void;
}
