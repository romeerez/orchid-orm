import { VirtualColumn } from './virtual';
import { RawSQL } from '../sql/rawSql';

// unknown column is used for the case of raw SQL when user doesn't specify a column
export class UnknownColumn extends VirtualColumn {
  static instance = new UnknownColumn();
}

RawSQL.prototype._type = UnknownColumn.instance;
