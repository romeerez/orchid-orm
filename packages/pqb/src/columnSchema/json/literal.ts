import { constructType, JSONType, Primitive } from './typeBase';

export interface JSONLiteral<T extends Primitive>
  extends JSONType<T, 'literal'> {
  value: Primitive;
}

export const literal = <T extends Primitive>(value: T) =>
  constructType<JSONLiteral<T>>({
    dataType: 'literal',
    value,
  });
