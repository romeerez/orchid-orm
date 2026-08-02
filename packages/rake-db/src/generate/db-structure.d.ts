import { Adapter, DefaultPrivileges, Grant as PqbGrant, type RlsPolicy, type RecordOptionalString, type SearchWeight } from 'pqb/internal';
import { RakeDbAst } from '../ast';
export declare namespace DbStructure {
    interface TableNameAndSchemaName {
        schemaName: string;
        tableName: string;
    }
    type RlsPolicyMode = RlsPolicy.PolicyMode;
    type RlsPolicyCommand = RlsPolicy.PolicyCommand;
    interface RlsPolicy extends TableNameAndSchemaName {
        name: string;
        mode: RlsPolicyMode;
        command: RlsPolicyCommand;
        roles: string[];
        using?: string;
        withCheck?: string;
    }
    interface TableRls {
        enable: boolean;
        force: boolean;
        policies?: RlsPolicy[];
    }
    interface Table {
        schemaName: string;
        name: string;
        comment?: string;
        rls?: TableRls;
        columns: Column[];
    }
    interface View {
        schemaName: string;
        name: string;
        deps: RakeDbAst.View['deps'];
        isRecursive: boolean;
        with?: string[];
        columns: Column[];
        sql: string;
    }
    interface MaterializedView {
        schemaName: string;
        name: string;
        deps: RakeDbAst.MaterializedView['deps'];
        columns: Column[];
        sql: string;
        isPopulated: boolean;
        tablespace?: string;
    }
    interface Procedure {
        schemaName: string;
        name: string;
        returnSet: boolean;
        returnType: string;
        kind: string;
        isTrigger: boolean;
        types: string[];
        argTypes: string[];
        argModes: ('i' | 'o')[];
        argNames?: string[];
    }
    interface Column extends TableNameAndSchemaName {
        name: string;
        typeSchema: string;
        type: string;
        arrayDims: number;
        maxChars?: number;
        numericPrecision?: number;
        numericScale?: number;
        dateTimePrecision?: number;
        default?: string;
        isNullable: boolean;
        collate?: string;
        compression?: 'pglz' | 'lz4';
        comment?: string;
        identity?: {
            always: boolean;
            start: number;
            increment: number;
            min?: number;
            max?: number;
            cache: number;
            cycle: boolean;
        };
        extension?: string;
        typmod: number;
    }
    interface Index extends TableNameAndSchemaName {
        name: string;
        using: string;
        unique: boolean;
        /** Deferrability mode when the unique index is backed by a constraint. */
        deferrable?: false | 'immediate' | 'deferred';
        columns: (({
            column: string;
        } | {
            expression: string;
        }) & {
            collate?: string;
            opclass?: string;
            order?: string;
            weight?: SearchWeight;
        })[];
        include?: string[];
        nullsNotDistinct?: boolean;
        with?: string;
        tablespace?: string;
        where?: string;
        tsVector?: boolean;
        language?: string;
        languageColumn?: string;
    }
    interface Exclude extends Index {
        exclude: string[];
    }
    type ForeignKeyMatch = 'f' | 'p' | 's';
    type ForeignKeyAction = 'a' | 'r' | 'c' | 'n' | 'd';
    interface Constraint extends TableNameAndSchemaName {
        name: string;
        primaryKey?: string[];
        references?: References;
        check?: Check;
    }
    interface References {
        foreignSchema: string;
        foreignTable: string;
        columns: string[];
        foreignColumns: string[];
        match: ForeignKeyMatch;
        onUpdate: ForeignKeyAction;
        onDelete: ForeignKeyAction;
    }
    interface Check {
        columns?: string[];
        expression: string;
    }
    interface Trigger extends TableNameAndSchemaName {
        triggerSchema: string;
        name: string;
        events: string[];
        activation: string;
        condition?: string;
        definition: string;
    }
    interface Extension {
        schemaName: string;
        name: string;
        version?: string;
    }
    interface Enum {
        schemaName: string;
        name: string;
        values: [string, ...string[]];
    }
    interface Domain {
        schemaName: string;
        name: string;
        type: string;
        typeSchema: string;
        arrayDims: number;
        isNullable: boolean;
        maxChars?: number;
        numericPrecision?: number;
        numericScale?: number;
        dateTimePrecision?: number;
        collate?: string;
        default?: string;
        checks?: string[];
    }
    interface Collation {
        schemaName: string;
        name: string;
        provider: string;
        deterministic: boolean;
        lcCollate?: string;
        lcCType?: string;
        locale?: string;
        version?: string;
    }
    interface Role {
        name: string;
        super: boolean;
        inherit: boolean;
        createRole: boolean;
        createDb: boolean;
        canLogin: boolean;
        replication: boolean;
        connLimit: number;
        validUntil?: Date;
        bypassRls: boolean;
        config?: RecordOptionalString;
    }
    interface DefaultPrivilegeConfig {
        privilege: string;
        isGrantable: boolean;
    }
    interface DefaultPrivilegeObjectConfig {
        object: DefaultPrivileges.ObjectType;
        privilegeConfigs: DefaultPrivilegeConfig[];
    }
    interface DefaultPrivilege {
        owner?: string;
        grantee: string;
        schema?: string;
        objectConfigs: DefaultPrivilegeObjectConfig[];
    }
    type Grant = PqbGrant.InternalPrivilege;
}
export declare namespace RawDbStructure {
    interface RlsPolicy {
        schemaName: string;
        tableName: string;
        name: string;
        mode: RlsPolicy.PolicyMode;
        command: RlsPolicy.PolicyCommand;
        roles: string[];
        using?: string;
        withCheck?: string;
    }
    interface DefaultPrivilege {
        grantor: string;
        grantee: string;
        schema?: string;
        object: 'relation' | 'sequence' | 'function' | 'type' | 'schema' | 'large_object';
        privileges: string[];
        isGrantables: boolean[];
    }
    interface Grant {
        grantor: string;
        grantee: string;
        schema?: string;
        name: string;
        target: 'schemas' | 'tables' | 'sequences' | 'routines' | 'types' | 'domains' | 'databases';
        privileges: string[];
        isGrantables: boolean[];
    }
}
export interface IntrospectedStructure {
    version: number;
    schemas: string[];
    tables: DbStructure.Table[];
    views?: DbStructure.View[];
    materializedViews?: DbStructure.MaterializedView[];
    indexes: DbStructure.Index[];
    excludes: DbStructure.Exclude[];
    constraints: DbStructure.Constraint[];
    triggers: DbStructure.Trigger[];
    extensions: DbStructure.Extension[];
    enums: DbStructure.Enum[];
    domains: DbStructure.Domain[];
    collations: DbStructure.Collation[];
    roles?: DbStructure.Role[];
    defaultPrivileges?: DbStructure.DefaultPrivilege[];
    grants?: DbStructure.Grant[];
    managedRolesSql?: string;
}
interface IntrospectDbStructureParams {
    rls?: boolean;
    roles?: {
        whereSql?: string;
    };
    loadViews?: boolean;
    loadDefaultPrivileges?: boolean;
    loadGrants?: boolean;
}
export declare function getDbVersion(db: Adapter): Promise<number>;
export declare function introspectDbSchema(db: Adapter, params?: IntrospectDbStructureParams): Promise<IntrospectedStructure>;
export {};
