import { RecordOptionalString } from '../../../utils';
import { DefaultPrivileges } from '../default-privileges/default-privileges';
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
