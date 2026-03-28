export namespace DefaultPrivileges {
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
      LARGE_OBJECT: string[];
    };
  }

  export type SchemaConfig = SchemaTargetConfig | GlobalTargetConfig;
}

// Default privileges constants grouped under DEFAULT_PRIVILEGE
const DEFAULT_PRIVILEGE = {
  OBJECT_TYPES: [
    'TABLES',
    'SEQUENCES',
    'FUNCTIONS',
    'TYPES',
    'SCHEMAS',
    'LARGE_OBJECTS',
  ] as const,
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
      'MAINTAIN', // Supported starting with PostgreSQL 17
    ] as const,
    SEQUENCE: ['ALL', 'USAGE', 'SELECT', 'UPDATE'] as const,
    FUNCTION: ['ALL', 'EXECUTE'] as const,
    TYPE: ['ALL', 'USAGE'] as const,
    SCHEMA: ['ALL', 'USAGE', 'CREATE'] as const,
    LARGE_OBJECT: ['ALL', 'SELECT', 'UPDATE'] as const,
  },
};

const supportedPrivilegesCache = new Map<
  number,
  DefaultPrivileges.SupportedDefaultPrivileges
>();

export function getSupportedDefaultPrivileges(
  version: number,
): DefaultPrivileges.SupportedDefaultPrivileges {
  const cached = supportedPrivilegesCache.get(version);
  if (cached) return cached;

  let result: DefaultPrivileges.SupportedDefaultPrivileges;
  if (version >= 17) {
    result =
      DEFAULT_PRIVILEGE as unknown as DefaultPrivileges.SupportedDefaultPrivileges;
  } else {
    result = {
      OBJECT_TYPES: [...DEFAULT_PRIVILEGE.OBJECT_TYPES],
      PRIVILEGES: {
        TABLE: DEFAULT_PRIVILEGE.PRIVILEGES.TABLE.filter(
          (p) => p !== 'MAINTAIN',
        ),
        SEQUENCE: [...DEFAULT_PRIVILEGE.PRIVILEGES.SEQUENCE],
        FUNCTION: [...DEFAULT_PRIVILEGE.PRIVILEGES.FUNCTION],
        TYPE: [...DEFAULT_PRIVILEGE.PRIVILEGES.TYPE],
        SCHEMA: [...DEFAULT_PRIVILEGE.PRIVILEGES.SCHEMA],
        LARGE_OBJECT: [...DEFAULT_PRIVILEGE.PRIVILEGES.LARGE_OBJECT],
      },
    };
  }

  supportedPrivilegesCache.set(version, result);
  return result;
}
