export namespace Grant {
  export type Role = string | [string, ...string[]];

  export type TablePrivilege =
    | 'ALL'
    | 'SELECT'
    | 'INSERT'
    | 'UPDATE'
    | 'DELETE'
    | 'TRUNCATE'
    | 'REFERENCES'
    | 'TRIGGER'
    | 'MAINTAIN';

  export type SequencePrivilege = 'ALL' | 'USAGE' | 'SELECT' | 'UPDATE';
  export type RoutinePrivilege = 'ALL' | 'EXECUTE';
  export type TypePrivilege = 'ALL' | 'USAGE';
  export type DomainPrivilege = 'ALL' | 'USAGE';
  export type SchemaPrivilege = 'ALL' | 'USAGE' | 'CREATE';
  export type DatabasePrivilege =
    | 'ALL'
    | 'CREATE'
    | 'CONNECT'
    | 'TEMPORARY'
    | 'TEMP';

  export interface SchemaGrant {
    to: Role;
    grantedBy?: string;
    schemas: string[];
    privileges?: SchemaPrivilege[];
    grantablePrivileges?: SchemaPrivilege[];
  }

  export interface TableGrant {
    to: Role;
    grantedBy?: string;
    tables: string[];
    privileges?: TablePrivilege[];
    grantablePrivileges?: TablePrivilege[];
  }

  export interface AllTablesInGrant {
    to: Role;
    grantedBy?: string;
    allTablesIn: string[];
    privileges?: TablePrivilege[];
    grantablePrivileges?: TablePrivilege[];
  }

  export interface SequenceGrant {
    to: Role;
    grantedBy?: string;
    sequences: string[];
    privileges?: SequencePrivilege[];
    grantablePrivileges?: SequencePrivilege[];
  }

  export interface AllSequencesInGrant {
    to: Role;
    grantedBy?: string;
    allSequencesIn: string[];
    privileges?: SequencePrivilege[];
    grantablePrivileges?: SequencePrivilege[];
  }

  export interface RoutineGrant {
    to: Role;
    grantedBy?: string;
    routines: string[];
    privileges?: RoutinePrivilege[];
    grantablePrivileges?: RoutinePrivilege[];
  }

  export interface AllRoutinesInGrant {
    to: Role;
    grantedBy?: string;
    allRoutinesIn: string[];
    privileges?: RoutinePrivilege[];
    grantablePrivileges?: RoutinePrivilege[];
  }

  export interface TypeGrant {
    to: Role;
    grantedBy?: string;
    types: string[];
    privileges?: TypePrivilege[];
    grantablePrivileges?: TypePrivilege[];
  }

  export interface DomainGrant {
    to: Role;
    grantedBy?: string;
    domains: string[];
    privileges?: DomainPrivilege[];
    grantablePrivileges?: DomainPrivilege[];
  }

  export interface DatabaseGrant {
    to: Role;
    grantedBy?: string;
    databases: string[];
    privileges?: DatabasePrivilege[];
    grantablePrivileges?: DatabasePrivilege[];
  }

  // Union of target-specific grant declaration shapes.
  export type Privilege =
    | SchemaGrant
    | TableGrant
    | AllTablesInGrant
    | SequenceGrant
    | AllSequencesInGrant
    | RoutineGrant
    | AllRoutinesInGrant
    | TypeGrant
    | DomainGrant
    | DatabaseGrant;

  export interface InternalPrivilege {
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

  export type IgnoreSelector = string | RegExp | (string | RegExp)[];

  export interface Ignore {
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
