export declare namespace DefaultPrivileges {
    export type ObjectType = (typeof DEFAULT_PRIVILEGE.OBJECT_TYPES)[number];
    export interface Privilege {
        Table: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.TABLE)[number];
        Sequence: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.SEQUENCE)[number];
        Function: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.FUNCTION)[number];
        Type: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.TYPE)[number];
        Schema: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.SCHEMA)[number];
        LargeObject: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.LARGE_OBJECT)[number];
    }
    interface ObjectSetting<T> {
        privileges?: T[];
        grantablePrivileges?: T[];
    }
    export interface SchemaTargetConfig {
        owner?: string;
        schema: string;
        all?: boolean;
        allGrantable?: boolean;
        tables?: ObjectSetting<Privilege['Table']>;
        sequences?: ObjectSetting<Privilege['Sequence']>;
        functions?: ObjectSetting<Privilege['Function']>;
        types?: ObjectSetting<Privilege['Type']>;
    }
    export interface GlobalTargetConfig {
        owner?: string;
        schema?: never;
        all?: boolean;
        allGrantable?: boolean;
        tables?: ObjectSetting<Privilege['Table']>;
        sequences?: ObjectSetting<Privilege['Sequence']>;
        functions?: ObjectSetting<Privilege['Function']>;
        types?: ObjectSetting<Privilege['Type']>;
        schemas?: ObjectSetting<Privilege['Schema']>;
        largeObjects?: ObjectSetting<Privilege['LargeObject']>;
    }
    export interface SupportedDefaultPrivileges {
        OBJECT_TYPES: string[];
        PRIVILEGES: {
            TABLE: string[];
            SEQUENCE: string[];
            FUNCTION: string[];
            TYPE: string[];
            SCHEMA: string[];
            LARGE_OBJECT?: string[];
        };
    }
    export type SchemaConfig = SchemaTargetConfig | GlobalTargetConfig;
    export {};
}
declare const DEFAULT_PRIVILEGE: {
    OBJECT_TYPES: readonly ['TABLES', 'SEQUENCES', 'FUNCTIONS', 'TYPES', 'SCHEMAS', 'LARGE_OBJECTS'];
    PRIVILEGES: {
        TABLE: readonly ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
        SEQUENCE: readonly ['ALL', 'USAGE', 'SELECT', 'UPDATE'];
        FUNCTION: readonly ['ALL', 'EXECUTE'];
        TYPE: readonly ['ALL', 'USAGE'];
        SCHEMA: readonly ['ALL', 'USAGE', 'CREATE'];
        LARGE_OBJECT: readonly ['ALL', 'SELECT', 'UPDATE'];
    };
};
export declare function getSupportedDefaultPrivileges(version: number): DefaultPrivileges.SupportedDefaultPrivileges;
export {};
