import { QueryColumns } from '../columns';

export interface WithDataItem {
  table: string;
  shape: QueryColumns;
}

export interface WithDataItems {
  [K: string]: WithDataItem;
}
