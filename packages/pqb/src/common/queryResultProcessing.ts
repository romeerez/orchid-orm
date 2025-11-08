import { QueryData } from '../sql';
import { applyTransforms, QueryReturnType, RecordString } from 'orchid-core';
import { QueryBatchResult } from '../queryMethods';

export const applyBatchTransforms = (
  q: QueryData,
  batches: QueryBatchResult[],
) => {
  if (q.transform) {
    for (const item of batches) {
      item.parent[item.key] = applyTransforms(
        q,
        q.returnType,
        q.transform,
        item.data,
      );
    }
  }
};

export const finalizeNestedHookSelect = (
  batches: QueryBatchResult[],
  returnType: QueryReturnType,
  tempColumns: Set<string> | undefined,
  renames: RecordString | undefined,
  key: string,
) => {
  if (renames) {
    for (const { data } of batches) {
      for (const record of data) {
        if (record) {
          for (const a in renames) {
            record[a] = record[renames[a]];
          }
        }
      }
    }
  }

  if (tempColumns?.size) {
    for (const { data } of batches) {
      for (const record of data) {
        if (record) {
          for (const key of tempColumns) {
            delete record[key];
          }
        }
      }
    }
  }

  if (returnType === 'one' || returnType === 'oneOrThrow') {
    for (const batch of batches) {
      batch.data = batch.data[0];
    }
  } else if (returnType === 'pluck') {
    for (const { data } of batches) {
      for (let i = 0; i < data.length; i++) {
        data[i] = data[i][key];
      }
    }
  } else if (returnType === 'value' || returnType === 'valueOrThrow') {
    for (const item of batches) {
      item.parent[item.key] = item.data[0]?.[key];
    }
  }
};
