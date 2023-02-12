import { BaseOperators } from './operators';
import { Code } from './code';

export type ColumnOutput<T extends ColumnTypeBase> = T['type'];
export type ColumnInput<T extends ColumnTypeBase> = T['inputType'];

export type ColumnShapeBase = Record<string, ColumnTypeBase>;

export type ColumnShapeOutput<Shape extends ColumnShapeBase> = {
  [K in keyof Shape]: ColumnOutput<Shape[K]>;
};

export type ColumnDataBase = {
  isNullable?: boolean;
};

export abstract class ColumnTypeBase<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
  Data extends ColumnDataBase = ColumnDataBase,
> {
  abstract dataType: string;
  abstract operators: Ops;
  abstract toCode(t: string): Code;

  type!: Type;
  inputType!: InputType;
  isNullable!: boolean;
  data = {} as Data;
  isPrimaryKey = false;
  isHidden = false;
  hasDefault = false;
}
