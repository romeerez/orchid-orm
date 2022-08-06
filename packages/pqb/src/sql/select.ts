import { JsonItem, SelectQueryData } from './types';
import { Expression, getRaw, isRaw } from '../common';
import { Query } from '../query';
import { q, quoteFullColumn } from './common';
import { aggregateToSql } from './aggregate';
import { quote } from '../quote';

const jsonColumnOrMethodToSql = (
  column: string | JsonItem,
  quotedAs?: string,
) => {
  return typeof column === 'string'
    ? quoteFullColumn(column, quotedAs)
    : jsonToSql(column, quotedAs);
};

const jsonToSql = (item: JsonItem, quotedAs?: string): string => {
  const json = item.__json;
  if (json[0] === 'pathQuery') {
    const [, , , column, path, options] = json;
    return `jsonb_path_query(${jsonColumnOrMethodToSql(
      column,
      quotedAs,
    )}, ${quote(path)}${options?.vars ? `, ${quote(options.vars)}` : ''}${
      options?.silent ? ', true' : ''
    })`;
  } else if (json[0] === 'set') {
    const [, , , column, path, value, options] = json;
    return `jsonb_set(${jsonColumnOrMethodToSql(
      column,
      quotedAs,
    )}, '{${path.join(', ')}}', ${quote(JSON.stringify(value))}${
      options?.createIfMissing ? ', true' : ''
    })`;
  } else if (json[0] === 'insert') {
    const [, , , column, path, value, options] = json;
    return `jsonb_insert(${jsonColumnOrMethodToSql(
      column,
      quotedAs,
    )}, '{${path.join(', ')}}', ${quote(JSON.stringify(value))}${
      options?.insertAfter ? ', true' : ''
    })`;
  } else if (json[0] === 'remove') {
    const [, , , column, path] = json;
    return `${jsonColumnOrMethodToSql(column, quotedAs)} #- '{${path.join(
      ', ',
    )}}'`;
  }
  return '';
};

export const pushSelectSql = (
  sql: string[],
  select: SelectQueryData['select'],
  quotedAs?: string,
) => {
  if (select) {
    const list: string[] = [];
    select.forEach((item) => {
      if (typeof item === 'object') {
        if ('selectAs' in item) {
          const obj = item.selectAs as Record<string, Expression | Query>;
          for (const as in obj) {
            const value = obj[as];
            if (typeof value === 'object') {
              if (isRaw(value)) {
                list.push(`${getRaw(value)} AS ${q(as)}`);
              } else {
                list.push(`(${(value as Query).json().toSql()}) AS ${q(as)}`);
              }
            } else {
              list.push(`${quoteFullColumn(value, quotedAs)} AS ${q(as)}`);
            }
          }
        } else if ('__json' in item) {
          list.push(`${jsonToSql(item, quotedAs)} AS ${q(item.__json[1])}`);
        } else if (isRaw(item)) {
          list.push(getRaw(item));
        } else {
          list.push(aggregateToSql(item, quotedAs));
        }
      } else {
        list.push(quoteFullColumn(item, quotedAs));
      }
    });
    sql.push(list.join(', '));
  } else {
    sql.push(`${quotedAs}.*`);
  }
};
