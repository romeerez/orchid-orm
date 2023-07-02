import { JSONType } from './jsonType';
import {
  addCode,
  Code,
  columnChainToCode,
  columnErrorMessagesToCode,
} from '../code';
import { emptyArray, toArray } from '../../utils';

/**
 * Generate code for a JSON type
 *
 * @param type - JSON type to generate code for
 * @param t - types object name
 * @param code - generated for the JSON type without common methods
 */
export const jsonTypeToCode = (type: JSONType, t: string, code: Code): Code => {
  const c = toArray(code);

  const { data } = type;
  if (data.nullable && data.optional) {
    addCode(c, '.nullish()');
  } else if (data.nullable) {
    addCode(c, '.nullable()');
  } else if (data.optional) {
    addCode(c, '.optional()');
  }

  if (data.isDeepPartial) {
    addCode(c, '.deepPartial()');
  }

  if (data.isNonEmpty) {
    addCode(c, '.nonEmpty()');
  }

  if (data.errors) {
    for (const part of columnErrorMessagesToCode(data.errors)) {
      addCode(c, part);
    }
  }

  if (data.default) {
    addCode(c, `.default(${JSON.stringify(data.default)})`);
  }

  return columnChainToCode(type.data.chain || emptyArray, t, c);
};
