import { JSONType } from './jsonType';
import { jsonTypeToCode } from './code';
import { addCode, Code } from '../code';
import { toArray } from '../../utils';

// intersection of two JSON types
export class JSONIntersection<
  Left extends JSONType,
  Right extends JSONType,
> extends JSONType<Left['type'] & Right['type'], { left: Left; right: Right }> {
  declare kind: 'intersection';

  constructor(left: Left, right: Right) {
    super();
    this.data.left = left;
    this.data.right = right;
  }

  toCode(t: string): Code {
    const code = [...toArray(this.data.left.toCode(t))];
    addCode(code, '.and(');
    const right = this.data.right.toCode(t);
    if (typeof right === 'string') {
      addCode(code, right);
    } else {
      code.push(right);
    }
    addCode(code, ')');

    return jsonTypeToCode(this, t, code);
  }
}

JSONType.prototype.and = function (type) {
  return new JSONIntersection(this, type);
};
