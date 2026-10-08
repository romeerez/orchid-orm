import { DbStructure, IntrospectedStructure, promptSelect } from 'rake-db';
import { colors } from 'pqb/internal';
import { AbortSignal } from './generate';

/**
 * Makes the decisions that the migration generator cannot make on its own.
 */
export interface MigrationDecider {
  /**
   * Decides whether a new schema, role, enum, table, or column is created,
   * or one of the dropped `candidates` is renamed to it.
   * Returns the candidate to rename, which must be an item of `candidates`
   * itself rather than a copy, or `undefined` to create a new item.
   */
  createOrRename<T>(
    question: CreateOrRenameQuestion<T>,
  ): Promise<T | undefined>;

  /**
   * Decides whether a new enum value is added,
   * or one of the dropped `candidates` values is renamed to it.
   * Returns the value to rename, or `undefined` to add a new value.
   */
  addOrRenameEnumValue(
    question: AddOrRenameEnumValueQuestion,
  ): Promise<string | undefined>;

  /**
   * Decides what to do with a column whose type cannot be cast to the new one.
   * Returns `true` to recreate the column losing its data,
   * or `false` to stop the generation so the migration is written manually.
   */
  recreateColumn(question: RecreateColumnQuestion): Promise<boolean>;
}

/**
 * Identity of a migrated item by its database names, never by code keys:
 * for an existing item, the names it has in the database before any changes,
 * for an item in the code, the names it is going to have in the database
 * (with `snakeCase` and explicit names applied, and the schema resolved).
 * `schema` is set for enums, tables, and columns, `table` is set for columns.
 */
export interface MigrationItemId {
  schema?: string;
  table?: string;
  name: string;
}

export interface CreateOrRenameQuestion<T> {
  kind: 'schema' | 'role' | 'enum' | 'table' | 'column';
  /** The new item in the code, by its database names. */
  target: MigrationItemId;
  /** The list is changed after the answer, copy what is needed when asked. */
  candidates: T[];
  /** Returns the identity of a candidate in the database before any changes. */
  candidateSource(candidate: T): MigrationItemId;
  /** Name of the new item to display. */
  name: string;
  /** Returns the name of a candidate to display. */
  candidateName(candidate: T): string;
}

export interface AddOrRenameEnumValueQuestion {
  /** The enum in the database before any changes. */
  source: MigrationItemId;
  /** The enum in the code, by its database names. */
  target: MigrationItemId;
  value: string;
  candidates: string[];
  /** Name of the enum to display. */
  enumName: string;
}

export interface RecreateColumnQuestion {
  /** The column in the database before any changes. */
  source: MigrationItemId;
  /** The column in the code, by its database names. */
  target: MigrationItemId;
  fromType: string;
  toType: string;
  /** Name of the table to display. */
  tableName: string;
  /** Name of the column to display. */
  columnName: string;
}

/**
 * Context of the generator questions: the decider together with the source
 * identities of the database items that the generators ask it about.
 */
export interface MigrationDecisionCtx {
  decider: MigrationDecider;
  /**
   * Returns the identity of a table or enum in the database before any
   * changes, regardless of how the generators changed it since then.
   */
  dbSource(item: DbStructure.Table | DbStructure.Enum): MigrationItemId;
}

/**
 * Creates `MigrationDecisionCtx` for the `decider`, remembering the identities
 * of tables and enums in `dbStructure`, so it must be called for every
 * introspection before the generators change it.
 */
export const makeMigrationDecisionCtx = (
  decider: MigrationDecider,
  dbStructure: IntrospectedStructure,
): MigrationDecisionCtx => {
  const sources = new WeakMap<
    DbStructure.Table | DbStructure.Enum,
    MigrationItemId
  >();
  for (const item of [...dbStructure.tables, ...dbStructure.enums]) {
    sources.set(item, { schema: item.schemaName, name: item.name });
  }

  return {
    decider,
    dbSource(item) {
      const source = sources.get(item);
      if (!source) {
        throw new Error(
          `${item.schemaName}.${item.name} is missing in the introspected structure`,
        );
      }
      return source;
    },
  };
};

/**
 * Decider that asks the user in the terminal.
 */
export const interactiveDecider: MigrationDecider = {
  async createOrRename({ kind, name, candidates, candidateName }) {
    const names = candidates.map(candidateName);

    let hintPos = name.length + 4;
    for (const from of names) {
      const value = from.length + 8 + name.length;
      if (value > hintPos) hintPos = value;
    }

    const renameMessage = `rename ${kind}`;

    const i = await promptSelect({
      message: `Create or rename ${colors.blueBold(
        name,
      )} ${kind} from another ${kind}?`,
      options: [
        `${colors.greenBold('+')} ${name}  ${colors.pale(
          `create ${kind}`.padStart(
            hintPos + renameMessage.length - name.length - 4,
            ' ',
          ),
        )}`,
        ...names.map(
          (d) =>
            `${colors.yellowBold('~')} ${d} ${colors.yellowBold(
              '=>',
            )} ${name}  ${colors.pale(
              renameMessage.padStart(
                hintPos + renameMessage.length - d.length - name.length - 8,
                ' ',
              ),
            )}`,
        ),
      ],
    });

    return i ? candidates[i - 1] : undefined;
  },

  async addOrRenameEnumValue({ enumName, value, candidates }) {
    const i = await promptSelect({
      message: `Add or rename ${colors.blueBold(
        value,
      )} enum value in ${colors.blueBold(enumName)}?`,
      options: [
        `${colors.greenBold('+')} ${value}  ${colors.pale('add enum value')}`,
        ...candidates.map(
          (dropValue) =>
            `${colors.yellowBold('~')} ${dropValue} ${colors.yellowBold(
              '=>',
            )} ${value}  ${colors.pale('rename enum value')}`,
        ),
      ],
    });

    return i ? candidates[i - 1] : undefined;
  },

  async recreateColumn({ tableName, columnName, fromType, toType }) {
    const i = await promptSelect({
      message: `Cannot cast type of ${tableName}'s column ${columnName} from ${fromType} to ${toType}`,
      options: [
        `${colors.yellowBold(
          `-/+`,
        )} recreate the column, existing data will be ${colors.red('lost')}`,
        `write migration manually`,
      ],
    });

    return !i;
  },
};

/**
 * Decider for re-generating a migration after applying it: any remaining
 * question means the migration did not bring the database to the code state,
 * so it aborts instead of asking.
 */
export const verifyingDecider: MigrationDecider = {
  createOrRename() {
    throw new AbortSignal();
  },
  addOrRenameEnumValue() {
    throw new AbortSignal();
  },
  recreateColumn() {
    throw new AbortSignal();
  },
};
