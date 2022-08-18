import { JsonItem, SelectQueryData } from './types';
import { Expression, getRaw, isRaw } from '../common';
import { Query } from '../query';
import { addValue, q, quoteFullColumn } from './common';
import { aggregateToSql } from './aggregate';

const jsonColumnOrMethodToSql = (
  column: string | JsonItem,
  values: unknown[],
  quotedAs?: string,
) => {
  return typeof column === 'string'
    ? quoteFullColumn(column, quotedAs)
    : jsonToSql(column, values, quotedAs);
};

const jsonToSql = (
  item: JsonItem,
  values: unknown[],
  quotedAs?: string,
): string => {
  const json = item.__json;
  if (json[0] === 'pathQuery') {
    const [, , , column, path, options] = json;
    return `jsonb_path_query(${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )}, ${addValue(values, path)}${
      options?.vars ? `, ${addValue(values, options.vars)}` : ''
    }${options?.silent ? ', true' : ''})`;
  } else if (json[0] === 'set') {
    const [, , , column, path, value, options] = json;
    return `jsonb_set(${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )}, '{${path.join(', ')}}', ${addValue(values, JSON.stringify(value))}${
      options?.createIfMissing ? ', true' : ''
    })`;
  } else if (json[0] === 'insert') {
    const [, , , column, path, value, options] = json;
    return `jsonb_insert(${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )}, '{${path.join(', ')}}', ${addValue(values, JSON.stringify(value))}${
      options?.insertAfter ? ', true' : ''
    })`;
  } else if (json[0] === 'remove') {
    const [, , , column, path] = json;
    return `${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )} #- '{${path.join(', ')}}'`;
  }
  return '';
};

export const pushSelectSql = (
  sql: string[],
  model: Pick<Query, 'shape'>,
  select: SelectQueryData['select'],
  values: unknown[],
  quotedAs?: string,
) => {
  sql.push(selectToSql(model, select, values, quotedAs));
};

export const selectToSql = (
  model: Pick<Query, 'shape'>,
  select: SelectQueryData['select'],
  values: unknown[],
  quotedAs?: string,
): string => {
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
                list.push(`${getRaw(value, values)} AS ${q(as)}`);
              } else {
                const sql = (value as Query).json().toSql(values);
                list.push(`(${sql.text}) AS ${q(as)}`);
              }
            } else {
              list.push(`${quoteFullColumn(value, quotedAs)} AS ${q(as)}`);
            }
          }
        } else if ('__json' in item) {
          list.push(
            `${jsonToSql(item, values, quotedAs)} AS ${q(item.__json[1])}`,
          );
        } else if (isRaw(item)) {
          list.push(getRaw(item, values));
        } else if ('arguments' in item) {
          list.push(
            `${item.function}(${selectToSql(
              model,
              item.arguments,
              values,
              quotedAs,
            )})${item.as ? ` AS ${q(item.as)}` : ''}`,
          );
        } else {
          list.push(aggregateToSql(model, values, item, quotedAs));
        }
      } else {
        list.push(quoteFullColumn(item, quotedAs));
      }
    });
    return list.join(', ');
  } else {
    return `${quotedAs}.*`;
  }
};
