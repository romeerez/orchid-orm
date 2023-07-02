import { JSONType } from './jsonType';
import { jsonTypeToCode } from './code';
import { Code, numberDataToCode, stringDataToCode } from '../code';
import {
  NumberTypeData,
  numberTypeMethods,
  NumberTypeMethods,
  stringTypeMethods,
  StringTypeMethods,
} from '../commonMethods';
import { StringTypeData } from '../columnDataTypes';
import { assignMethodsToClass } from '../../utils';

// JSON type for unknown data
export class JSONUnknown extends JSONType {
  declare kind: 'unknown';

  toCode(t: string): Code {
    return jsonTypeToCode(this, t, `${t}.unknown()`);
  }
}

// JSON boolean type
export class JSONBoolean extends JSONType<boolean> {
  declare kind: 'boolean';

  toCode(t: string): Code {
    return jsonTypeToCode(this, t, `${t}.boolean()`);
  }
}

// JSON null type
export class JSONNull extends JSONType<null> {
  declare kind: 'null';

  toCode(t: string): Code {
    return jsonTypeToCode(this, t, `${t}.null()`);
  }
}

export interface JSONNumber
  extends JSONType<number, NumberTypeData>,
    NumberTypeMethods {}

// JSON number type: it has the same validation methods as the numeric column type.
export class JSONNumber extends JSONType<number, NumberTypeData> {
  declare kind: 'number';

  toCode(t: string): Code {
    return jsonTypeToCode(
      this,
      t,
      `${t}.number()${numberDataToCode(this.data)}`,
    );
  }
}

assignMethodsToClass(JSONNumber, numberTypeMethods);

export interface JSONString
  extends JSONType<string, StringTypeData>,
    StringTypeMethods {}

// JSON string type: it has the same validation methods as the text column type.
export class JSONString extends JSONType<string, StringTypeData> {
  declare kind: 'string';

  toCode(t: string): Code {
    return jsonTypeToCode(
      this,
      t,
      `${t}.string()${stringDataToCode(this.data)}`,
    );
  }
}

assignMethodsToClass(JSONString, stringTypeMethods);
