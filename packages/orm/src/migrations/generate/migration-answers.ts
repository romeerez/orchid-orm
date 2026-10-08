import { RakeDbError } from 'rake-db';
import { MigrationDecider, MigrationItemId } from './migration-decider';

type AnswerKind =
  | 'schema'
  | 'role'
  | 'enum'
  | 'table'
  | 'column'
  | 'enum-value';

const pathLengths: { [K in AnswerKind]: number } = {
  schema: 1,
  role: 1,
  enum: 2,
  table: 2,
  column: 3,
  'enum-value': 3,
};

type AnswerAction = MigrationAnswer['action'];

/**
 * Answer to a migration generator question given as a command line flag,
 * such as `--rename table:public.old=public.new`.
 */
export type MigrationAnswer = CreateAnswer | RenameOrRecreateAnswer;

interface AnswerBase {
  /** The answer flag, formatted for messages. */
  flag: string;
  kind: AnswerKind;
  /** Database names of the item in the code. */
  target: string[];
}

interface CreateAnswer extends AnswerBase {
  action: 'create';
}

interface RenameOrRecreateAnswer extends AnswerBase {
  action: 'rename' | 'recreate';
  /** Database names of the existing item. */
  source: string[];
}

export interface GenerateArgs {
  /** Arguments other than the flags: a migration name and `up`. */
  positional: string[];
  nonInteractive: boolean;
  answers: MigrationAnswer[];
}

/**
 * Parses arguments of the generate command, separating the flags that answer
 * the generator questions from the positional arguments.
 */
export const parseGenerateArgs = (args: string[]): GenerateArgs => {
  const positional: string[] = [];
  let nonInteractive = false;
  const answers: MigrationAnswer[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--non-interactive') {
      nonInteractive = true;
      continue;
    }

    // rake-db reads it for every command
    if (arg === '--transaction') {
      i++;
      continue;
    }
    if (arg.startsWith('--transaction=')) continue;

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const match = arg.match(/^--(rename|create|recreate)(?:=(.*))?$/s);
    if (!match) {
      throw new RakeDbError(`Unknown flag ${arg}`);
    }

    const action = match[1] as AnswerAction;
    const value = match[2] ?? args[++i];
    if (value === undefined) {
      throw new RakeDbError(`--${action} requires a value`);
    }

    answers.push(parseAnswer(action, value));
  }

  checkConflictingAnswers(answers);

  return { positional, nonInteractive, answers };
};

const parseAnswer = (action: AnswerAction, value: string): MigrationAnswer => {
  const flag = `--${action} ${value}`;
  const invalid = (reason: string) =>
    new RakeDbError(`Invalid ${flag}: ${reason}`);

  const colon = value.indexOf(':');
  const kind = value.slice(0, colon) as AnswerKind;
  if (colon === -1 || !Object.hasOwn(pathLengths, kind)) {
    throw invalid(
      `expected one of ${Object.keys(pathLengths).join(', ')} followed by a colon`,
    );
  }

  if (action === 'recreate' && kind !== 'column') {
    throw invalid('only a column can be recreated');
  }

  const length = pathLengths[kind];
  const readPath = (start: number) => {
    const { path, end } = parsePath(value, start, invalid);
    if (path.length !== length) {
      throw invalid(
        `${kind} must be given by ${length} dot-separated name${
          length === 1 ? '' : 's'
        }`,
      );
    }
    return { path, end };
  };

  const first = readPath(colon + 1);
  if (action === 'create') {
    if (first.end !== value.length) {
      throw invalid('unexpected text after the name');
    }
    return { flag, action, kind, target: first.path };
  }

  if (value[first.end] !== '=') {
    throw invalid('expected the old name and the new name separated by "="');
  }

  const second = readPath(first.end + 1);
  if (second.end !== value.length) {
    throw invalid('unexpected text after the name');
  }

  return { flag, action, kind, source: first.path, target: second.path };
};

const parsePath = (
  value: string,
  start: number,
  invalid: (reason: string) => Error,
): { path: string[]; end: number } => {
  const path: string[] = [];
  let i = start;

  for (;;) {
    let segment = '';
    if (value[i] === '"') {
      for (i++; ; i++) {
        if (i === value.length) throw invalid('unterminated quoted name');

        if (value[i] === '"') {
          // a doubled quote stands for a quote inside the name
          if (value[i + 1] !== '"') break;
          i++;
        }

        segment += value[i];
      }
      i++;
    } else {
      while (i < value.length && !'.="'.includes(value[i])) {
        segment += value[i++];
      }
      if (!segment) throw invalid('expected a name');
    }

    path.push(segment);

    if (value[i] !== '.') return { path, end: i };
    i++;
  }
};

// rename and create answer the same question, recreate answers another one
type AnswerGroup = 'createOrRename' | 'recreate';

const answerGroup = (answer: MigrationAnswer): AnswerGroup =>
  answer.action === 'recreate' ? 'recreate' : 'createOrRename';

const answerKey = (group: AnswerGroup, kind: AnswerKind, path: string[]) =>
  `${group} ${kind}:${formatPath(path)}`;

const checkConflictingAnswers = (answers: MigrationAnswer[]) => {
  const targets = new Map<string, MigrationAnswer>();
  const sources = new Map<string, MigrationAnswer>();

  for (const answer of answers) {
    const group = answerGroup(answer);
    const conflict = (other: MigrationAnswer) =>
      new RakeDbError(`${answer.flag} conflicts with ${other.flag}`);

    const targetKey = answerKey(group, answer.kind, answer.target);
    const sameTarget = targets.get(targetKey);
    if (sameTarget) throw conflict(sameTarget);
    targets.set(targetKey, answer);

    if (answer.action !== 'create') {
      const sourceKey = answerKey(group, answer.kind, answer.source);
      const sameSource = sources.get(sourceKey);
      if (sameSource) throw conflict(sameSource);
      sources.set(sourceKey, answer);
    }
  }
};

/**
 * Formats database names as they are given in the answer flags:
 * separated by dots, quoting the names that cannot be read otherwise.
 */
export const formatPath = (path: string[]) =>
  path
    .map((name) =>
      /^[^\s."=]+$/.test(name) ? name : `"${name.replaceAll('"', '""')}"`,
    )
    .join('.');

const itemPath = ({ schema, table, name }: MigrationItemId) => [
  ...(schema === undefined ? [] : [schema]),
  ...(table === undefined ? [] : [table]),
  name,
];

const samePath = (a: string[], b: string[]) =>
  a.length === b.length && a.every((name, i) => name === b[i]);

/**
 * Decider that takes the answers given as flags, and for the questions without
 * an answer either asks the given decider, or collects the questions to report
 * them with the flags to answer them.
 */
export interface AnswersDecider extends MigrationDecider {
  /**
   * Returns a message explaining why the migration cannot be written:
   * questions without answers, answers that do not fit the questions,
   * or renames that did not match any question.
   * Call it after the generation, before verifying or writing the migration.
   */
  problems(): string | undefined;
}

/**
 * Creates an `AnswersDecider` for the `answers`.
 * Without the `ask` decider, a question without an answer is collected,
 * and the generation goes on as if the item was created or recreated,
 * so that the following questions are collected as well.
 */
export const makeAnswersDecider = (
  answers: MigrationAnswer[],
  ask?: MigrationDecider,
): AnswersDecider => {
  const answerMap = new Map<string, MigrationAnswer>();
  for (const answer of answers) {
    answerMap.set(
      answerKey(answerGroup(answer), answer.kind, answer.target),
      answer,
    );
  }

  const used = new Set<MigrationAnswer>();
  const takeAnswer = (
    group: AnswerGroup,
    kind: AnswerKind,
    target: string[],
  ) => {
    const answer = answerMap.get(answerKey(group, kind, target));
    if (answer) used.add(answer);
    return answer;
  };

  const errors: string[] = [];
  const questions: string[] = [];

  // questions are formatted when asked, because the generators change the
  // candidate lists after the answer
  const addQuestion = (question: string, options: string[]) => {
    questions.push(
      [question, ...options.map((option) => `  ${option}`)].join('\n'),
    );
  };

  const findCandidate = <T>(
    answer: RenameOrRecreateAnswer,
    kind: AnswerKind,
    target: string[],
    candidates: T[],
    candidatePath: (candidate: T) => string[],
  ): T | undefined => {
    const candidate = candidates.find((candidate) =>
      samePath(candidatePath(candidate), answer.source),
    );
    if (candidate === undefined) {
      errors.push(
        `${answer.flag}: ${formatPath(answer.source)} is not among the ${
          kind
        }s that can be renamed to ${formatPath(target)}: ${candidates
          .map((candidate) => formatPath(candidatePath(candidate)))
          .join(', ')}`,
      );
    }
    return candidate;
  };

  return {
    async createOrRename(question) {
      const { kind, candidates, candidateSource } = question;
      const target = itemPath(question.target);
      const candidatePath = (candidate: (typeof candidates)[number]) =>
        itemPath(candidateSource(candidate));

      const answer = takeAnswer('createOrRename', kind, target);
      if (answer) {
        return answer.action === 'rename'
          ? findCandidate(answer, kind, target, candidates, candidatePath)
          : undefined;
      }

      if (ask) return ask.createOrRename(question);

      addQuestion(`Create or rename ${kind} ${formatPath(target)}?`, [
        formatFlag('create', kind, target),
        ...candidates.map((candidate) =>
          formatFlag('rename', kind, candidatePath(candidate), target),
        ),
      ]);
      return;
    },

    async addOrRenameEnumValue(question) {
      const { value, candidates } = question;
      const kind = 'enum-value';
      const target = [...itemPath(question.target), value];
      const source = itemPath(question.source);
      const candidatePath = (candidate: string) => [...source, candidate];

      const answer = takeAnswer('createOrRename', kind, target);
      if (answer) {
        return answer.action === 'rename'
          ? findCandidate(answer, kind, target, candidates, candidatePath)
          : undefined;
      }

      if (ask) return ask.addOrRenameEnumValue(question);

      addQuestion(`Add or rename enum value ${formatPath(target)}?`, [
        formatFlag('create', kind, target),
        ...candidates.map((candidate) =>
          formatFlag('rename', kind, candidatePath(candidate), target),
        ),
      ]);
      return;
    },

    async recreateColumn(question) {
      const kind = 'column';
      const source = itemPath(question.source);
      const target = itemPath(question.target);

      const answer = takeAnswer('recreate', kind, target);
      if (answer && answer.action === 'recreate') {
        if (!samePath(source, answer.source)) {
          errors.push(
            `${answer.flag}: the column to recreate is ${formatPath(source)}`,
          );
        }
        return true;
      }

      if (ask) return ask.recreateColumn(question);

      addQuestion(
        `Cannot cast column ${formatPath(source)} from ${
          question.fromType
        } to ${question.toType}. Recreate it (existing data will be lost), or write the migration manually?`,
        [formatFlag('recreate', kind, source, target)],
      );
      return true;
    },

    problems() {
      const sections: string[] = [];

      if (errors.length) {
        sections.push(errors.join('\n'));
      }

      if (questions.length) {
        sections.push(
          'Run the command again with one of the suggested flags for each question, keeping the answer flags given before:',
          ...questions,
          'More questions may come up after these are answered.',
        );
      } else {
        // a create or recreate answer that matched no question changes nothing,
        // while an unmatched rename may be an intended rename that did not happen
        const unused = answers.filter(
          (answer) => answer.action === 'rename' && !used.has(answer),
        );
        if (unused.length) {
          sections.push(
            `These renames do not match any question:\n${unused
              .map((answer) => answer.flag)
              .join('\n')}`,
          );
        }
      }

      return sections.length
        ? `Cannot generate the migration.\n\n${sections.join('\n\n')}`
        : undefined;
    },
  };
};

const formatFlag = (
  action: AnswerAction,
  kind: AnswerKind,
  path: string[],
  target?: string[],
) => {
  const value = `${kind}:${formatPath(path)}${
    target ? `=${formatPath(target)}` : ''
  }`;
  return `--${action} ${shellQuote(value)}`;
};

const shellQuote = (value: string) =>
  /^[\w.:=@%+,/-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", `'\\''`)}'`;
