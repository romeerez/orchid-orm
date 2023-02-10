import { ColumnType } from './columnType';
import { Operators } from './operators';
import { Query } from '../query';
import { CreateCtx, UpdateCtx } from '../queryMethods';

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
