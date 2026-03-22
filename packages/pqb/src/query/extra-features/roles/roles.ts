import { DefaultPrivileges, RecordOptionalString } from 'pqb';

export interface DbRole {
  name: string;
  super?: boolean;
  inherit?: boolean;
  createRole?: boolean;
  createDb?: boolean;
  canLogin?: boolean;
  replication?: boolean;
  connLimit?: number;
  validUntil?: Date;
  bypassRls?: boolean;
  config?: RecordOptionalString;
  defaultPrivileges?: DefaultPrivileges.SchemaConfig[];
}
