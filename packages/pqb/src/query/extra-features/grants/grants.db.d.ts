export declare namespace Grant {
    type Role = string | [string, ...string[]];
    type TablePrivilege = 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER' | 'MAINTAIN';
    type SequencePrivilege = 'ALL' | 'USAGE' | 'SELECT' | 'UPDATE';
    type RoutinePrivilege = 'ALL' | 'EXECUTE';
    type TypePrivilege = 'ALL' | 'USAGE';
    type DomainPrivilege = 'ALL' | 'USAGE';
    type SchemaPrivilege = 'ALL' | 'USAGE' | 'CREATE';
    type DatabasePrivilege = 'ALL' | 'CREATE' | 'CONNECT' | 'TEMPORARY' | 'TEMP';
    interface SchemaGrant {
        to: Role;
        grantedBy?: string;
        schemas: string[];
        privileges?: SchemaPrivilege[];
        grantablePrivileges?: SchemaPrivilege[];
    }
    interface TableGrant {
        to: Role;
        grantedBy?: string;
        tables: string[];
        privileges?: TablePrivilege[];
        grantablePrivileges?: TablePrivilege[];
    }
    interface TableClassGrant {
        to: Role;
        grantedBy?: string;
        privileges?: TablePrivilege[];
        grantablePrivileges?: TablePrivilege[];
    }
    interface AllTablesInGrant {
        to: Role;
        grantedBy?: string;
        allTablesIn: string[];
        privileges?: TablePrivilege[];
        grantablePrivileges?: TablePrivilege[];
    }
    interface SequenceGrant {
        to: Role;
        grantedBy?: string;
        sequences: string[];
        privileges?: SequencePrivilege[];
        grantablePrivileges?: SequencePrivilege[];
    }
    interface AllSequencesInGrant {
        to: Role;
        grantedBy?: string;
        allSequencesIn: string[];
        privileges?: SequencePrivilege[];
        grantablePrivileges?: SequencePrivilege[];
    }
    interface RoutineGrant {
        to: Role;
        grantedBy?: string;
        routines: string[];
        privileges?: RoutinePrivilege[];
        grantablePrivileges?: RoutinePrivilege[];
    }
    interface AllRoutinesInGrant {
        to: Role;
        grantedBy?: string;
        allRoutinesIn: string[];
        privileges?: RoutinePrivilege[];
        grantablePrivileges?: RoutinePrivilege[];
    }
    interface TypeGrant {
        to: Role;
        grantedBy?: string;
        types: string[];
        privileges?: TypePrivilege[];
        grantablePrivileges?: TypePrivilege[];
    }
    interface DomainGrant {
        to: Role;
        grantedBy?: string;
        domains: string[];
        privileges?: DomainPrivilege[];
        grantablePrivileges?: DomainPrivilege[];
    }
    interface DatabaseGrant {
        to: Role;
        grantedBy?: string;
        databases: string[];
        privileges?: DatabasePrivilege[];
        grantablePrivileges?: DatabasePrivilege[];
    }
    type Privilege = SchemaGrant | TableGrant | AllTablesInGrant | SequenceGrant | AllSequencesInGrant | RoutineGrant | AllRoutinesInGrant | TypeGrant | DomainGrant | DatabaseGrant;
    interface InternalPrivilege {
        to: string[];
        grantedBy?: string;
        schemas?: string[];
        tables?: string[];
        allTablesIn?: string[];
        sequences?: string[];
        allSequencesIn?: string[];
        routines?: string[];
        allRoutinesIn?: string[];
        types?: string[];
        domains?: string[];
        databases?: string[];
        privileges?: string[];
        grantablePrivileges?: string[];
    }
    type IgnoreSelector = string | RegExp | (string | RegExp)[];
    interface Ignore {
        roles?: IgnoreSelector;
        schemas?: IgnoreSelector;
        tables?: IgnoreSelector;
        allTablesIn?: IgnoreSelector;
        sequences?: IgnoreSelector;
        allSequencesIn?: IgnoreSelector;
        routines?: IgnoreSelector;
        allRoutinesIn?: IgnoreSelector;
        types?: IgnoreSelector;
        domains?: IgnoreSelector;
        databases?: IgnoreSelector;
    }
}
