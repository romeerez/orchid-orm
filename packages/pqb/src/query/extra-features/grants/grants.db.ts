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
    tables: string[];
    privileges?: TablePrivilege[];
    grantablePrivileges?: TablePrivilege[];
  }

  export interface AllTablesInGrant {
    to: Role;
    allTablesIn: string[];
    privileges?: TablePrivilege[];
    grantablePrivileges?: TablePrivilege[];
  }

  export interface SequenceGrant {
    to: Role;
    sequences: string[];
    privileges?: SequencePrivilege[];
    grantablePrivileges?: SequencePrivilege[];
  }

  export interface AllSequencesInGrant {
    to: Role;
    allSequencesIn: string[];
    privileges?: SequencePrivilege[];
    grantablePrivileges?: SequencePrivilege[];
  }

  export interface RoutineGrant {
    to: Role;
    routines: string[];
    privileges?: RoutinePrivilege[];
    grantablePrivileges?: RoutinePrivilege[];
  }

  export interface AllRoutinesInGrant {
    to: Role;
    allRoutinesIn: string[];
    privileges?: RoutinePrivilege[];
    grantablePrivileges?: RoutinePrivilege[];
  }

  export interface TypeGrant {
    to: Role;
    types: string[];
    privileges?: TypePrivilege[];
    grantablePrivileges?: TypePrivilege[];
  }

  export interface DomainGrant {
    to: Role;
    domains: string[];
    privileges?: DomainPrivilege[];
    grantablePrivileges?: DomainPrivilege[];
  }

  export interface DatabaseGrant {
    to: Role;
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
