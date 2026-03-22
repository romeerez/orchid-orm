// Default privileges constants grouped under DEFAULT_PRIVILEGE
export const DEFAULT_PRIVILEGE = {
  OBJECT_TYPES: ['TABLES', 'SEQUENCES', 'FUNCTIONS', 'TYPES'] as const,
  PRIVILEGES: {
    TABLE: [
      'ALL',
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
      'MAINTAIN',
    ] as const,
    SEQUENCE: ['ALL', 'USAGE', 'SELECT', 'UPDATE'] as const,
    FUNCTION: ['ALL', 'EXECUTE'] as const,
    TYPE: ['ALL', 'USAGE'] as const,
  },
};

export namespace DefaultPrivileges {
  export type ObjectType = (typeof DEFAULT_PRIVILEGE.OBJECT_TYPES)[number];

  export interface Privilege {
    Table: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.TABLE)[number];
    Sequence: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.SEQUENCE)[number];
    Function: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.FUNCTION)[number];
    Type: (typeof DEFAULT_PRIVILEGE.PRIVILEGES.TYPE)[number];
  }

  interface ObjectSetting<T> {
    allow?: T[];
    allowGrantable?: T[];
  }

  export interface SchemaConfig {
    schema: string;
    all?: boolean;
    allGrantable?: boolean;
    tables?: ObjectSetting<Privilege['Table']>;
    sequences?: ObjectSetting<Privilege['Sequence']>;
    functions?: ObjectSetting<Privilege['Function']>;
    types?: ObjectSetting<Privilege['Type']>;
  }
}
