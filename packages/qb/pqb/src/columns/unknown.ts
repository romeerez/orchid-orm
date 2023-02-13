import { VirtualColumn } from './virtual';

// unknown column is used for the case of raw SQL when user doesn't specify a column
export class UnknownColumn extends VirtualColumn {}
