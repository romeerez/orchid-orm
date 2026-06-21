const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');

interface PackageInfo {
  path: string;
  folderName: string;
  name: string;
  workspaceDependencies: string[];
}

interface AffectedPackages {
  changed: string[];
  dependents: string[];
}

type AdapterName = 'postgres-js' | 'node-postgres' | 'bun';

interface CommandSpec {
  label: string;
  type?: 'tests' | 'types';
  adapter?: AdapterName;
  packages: CommandPackage[];
  args: string[];
  env?: Record<string, string>;
}

interface CommandPackage {
  name: string;
  folderName: string;
  role: 'changed' | 'dependent';
}

interface CommandResult {
  command: CommandSpec;
  exitCode: number;
  output: string;
}

interface PackageOutputBlock {
  pkg: CommandPackage;
  output: string;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const packagePaths = [
  'packages/create-orm',
  'packages/orm',
  'packages/pqb',
  'packages/rake-db',
  'packages/schemaConfigs/zod',
  'packages/schemaConfigs/valibot',
  'packages/test-factory',
];

const workspaceDependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const testAdapters: {
  name: AdapterName;
  script: 'check' | 'bun:check';
  env?: Record<string, string>;
}[] = [
  { name: 'postgres-js', script: 'check' },
  {
    name: 'node-postgres',
    script: 'check',
    env: { ADAPTER: 'node-postgres' },
  },
  { name: 'bun', script: 'bun:check', env: { ADAPTER: 'bun' } },
];

const adapterTestPackageNames = new Set([
  'orchid-orm',
  'pqb',
  'rake-db',
  'orchid-orm-test-factory',
]);

const consideredExtensions = new Set([
  '.js',
  '.ts',
  '.mjs',
  '.mts',
  '.cjs',
  '.cts',
  '.json',
]);

interface BuildCommandsOptions {
  allAdapters?: boolean;
}

interface CliOptions {
  debug: boolean;
}

const getPackageInfos = async (): Promise<PackageInfo[]> => {
  const packages = await Promise.all(
    packagePaths.map(async (path) => {
      const packageJson = JSON.parse(
        await readFile(`${path}/package.json`, 'utf8'),
      ) as PackageJson;

      if (!packageJson.name) {
        throw new Error(`${path}/package.json is missing name`);
      }

      return {
        path,
        folderName: getFolderName(path),
        name: packageJson.name,
        workspaceDependencies: getWorkspaceDependencies(packageJson),
      };
    }),
  );

  return packages;
};

const getChangedFiles = async (): Promise<string[]> => {
  const result = await runCommand({
    label: 'git status',
    packages: [],
    args: ['git', 'status', '--porcelain', '--untracked-files=all'],
  });

  if (result.exitCode) {
    throw new Error(result.output || 'git status failed');
  }

  return result.output
    .split('\n')
    .map(parseGitStatusLine)
    .filter((path): path is string => Boolean(path));
};

const getChangedPackages = (
  changedFiles: string[],
  packages: PackageInfo[],
): AffectedPackages => {
  const changed = new Set<string>();
  let hasGlobalImpactChange = false;

  for (const file of changedFiles) {
    if (shouldIgnoreChangedFile(file)) continue;

    const changedPackage = packages.find((pkg) => isInPackage(file, pkg.path));
    if (changedPackage) {
      changed.add(changedPackage.name);
    } else {
      hasGlobalImpactChange = true;
    }
  }

  if (hasGlobalImpactChange) {
    for (const pkg of packages) {
      changed.add(pkg.name);
    }
  }

  const dependents = getDependents(changed, packages);
  const affectedDependents = hasGlobalImpactChange
    ? packages.map((pkg) => pkg.name)
    : packages
        .filter((pkg) => dependents.has(pkg.name) && !changed.has(pkg.name))
        .map((pkg) => pkg.name);

  return {
    changed: packages
      .filter((pkg) => !hasGlobalImpactChange && changed.has(pkg.name))
      .map((pkg) => pkg.name),
    dependents: affectedDependents,
  };
};

const buildCommands = (
  affected: AffectedPackages,
  options: BuildCommandsOptions = {},
): CommandSpec[] => {
  const commands: CommandSpec[] = [];

  if (affected.changed.length) {
    commands.push(
      ...buildTestCommands(affected.changed, 'changed', options.allAdapters),
    );
  }

  if (affected.dependents.length) {
    commands.push(
      ...buildTestCommands(
        affected.dependents,
        'dependent',
        options.allAdapters,
      ),
    );
  }

  const typePackages = [...affected.changed, ...affected.dependents];
  if (typePackages.length) {
    const commandPackages = [
      ...getCommandPackages(affected.changed, 'changed'),
      ...getCommandPackages(affected.dependents, 'dependent'),
    ];
    commands.push({
      label: 'types',
      type: 'types',
      packages: commandPackages,
      args: ['pnpm', ...pnpmFilters(typePackages), 'types'],
    });
  }

  return commands;
};

const runCommands = async (
  commands: CommandSpec[],
  onFailure?: (result: CommandResult) => void,
): Promise<CommandResult[]> => {
  const commandGroups = getCommandGroups(commands);
  const groupResults = await Promise.all(
    commandGroups.map((group) => runCommandGroup(group, onFailure)),
  );

  return groupResults.flat();
};

const getCommandGroups = (commands: CommandSpec[]): CommandSpec[][] => {
  const groups: CommandSpec[][] = [];
  const packageGroups = new Map<string, CommandSpec[]>();

  for (const command of commands) {
    const key = getSequentialPackageKey(command);
    if (!key) {
      groups.push([command]);
      continue;
    }

    const group = packageGroups.get(key);
    if (group) {
      group.push(command);
    } else {
      const nextGroup = [command];
      packageGroups.set(key, nextGroup);
      groups.push(nextGroup);
    }
  }

  return groups;
};

const getSequentialPackageKey = (command: CommandSpec): string | undefined => {
  if (command.type !== 'tests' || !command.adapter) return;
  if (command.packages.length !== 1) return;

  return command.packages[0].name;
};

const runCommandGroup = async (
  commands: CommandSpec[],
  onFailure?: (result: CommandResult) => void,
): Promise<CommandResult[]> => {
  const results: CommandResult[] = [];

  for (const command of commands) {
    const result = await runCommand(command);
    if (result.exitCode) {
      onFailure?.(result);
    }
    results.push(result);
  }

  return results;
};

const formatResult = (results: CommandResult[]): string => {
  const typesPackages = new Set<string>();
  const testsPackages = new Set<string>();
  const changedTypeFailures = new Set<string>();
  const changedTestFailures = new Set<string>();
  const dependentTypeFailures = new Set<string>();
  const dependentTestFailures = new Set<string>();
  const allTypeFailures = new Set<string>();
  const allTestFailures = new Set<string>();

  for (const result of results) {
    let allPackages: Set<string> | undefined;
    let changedFailures: Set<string> | undefined;
    let dependentFailures: Set<string> | undefined;

    if (result.command.type === 'types') {
      allPackages = typesPackages;
      changedFailures = changedTypeFailures;
      dependentFailures = dependentTypeFailures;
      addFailures(allTypeFailures, result);
    } else if (result.command.type === 'tests') {
      allPackages = testsPackages;
      changedFailures = changedTestFailures;
      dependentFailures = dependentTestFailures;
      addFailures(allTestFailures, result);
    }

    if (!allPackages || !changedFailures || !dependentFailures) continue;

    for (const pkg of result.command.packages) {
      allPackages.add(pkg.folderName);
    }

    if (!result.exitCode) continue;

    for (const pkg of getFailedPackages(result)) {
      if (pkg.role === 'changed') {
        changedFailures.add(pkg.folderName);
      } else {
        dependentFailures.add(pkg.folderName);
      }
    }
  }

  const failedTypesPackages = getReportableFailurePackages(
    results,
    'types',
    changedTypeFailures,
  );
  const multiAdapterTests = hasMultiAdapterTests(results);
  const failedTestsPackages = getReportableFailurePackages(
    results,
    'tests',
    changedTestFailures,
  );
  const failedOutput = getReportableFailedOutput(
    results,
    changedTypeFailures,
    changedTestFailures,
  );
  const verifiedTypes = getVerifiedPackages(
    typesPackages,
    mergeSets(allTypeFailures, failedTypesPackages),
  );
  const verifiedTests = getVerifiedPackages(
    testsPackages,
    mergeSets(allTestFailures, failedTestsPackages),
  );
  const lines: string[] = [];

  if (verifiedTypes.length) {
    lines.push(`Verified types: ${verifiedTypes.join(', ')}`);
  }

  if (verifiedTests.length) {
    lines.push(`Verified tests: ${verifiedTests.join(', ')}`);
  }

  if (failedTypesPackages.size) {
    lines.push(`Failed types: ${[...failedTypesPackages].join(', ')}`);
  }

  if (failedTestsPackages.size) {
    if (multiAdapterTests) {
      lines.push(...getAdapterFailureLines(results, changedTestFailures));
    } else {
      lines.push(`Failed tests: ${[...failedTestsPackages].join(', ')}`);
    }
  }

  if (!lines.length) {
    lines.push('Verified: no packages affected');
  }

  return [...failedOutput, lines.join('\n')].filter(Boolean).join('\n\n');
};

const main = async (): Promise<void> => {
  const options = parseCliOptions(process.argv.slice(2));
  const packages = await getPackageInfos();
  const changedFiles = await getChangedFiles();
  const affected = getChangedPackages(changedFiles, packages);
  const commands = buildCommands(affected, {
    allAdapters: hasAdapterChange(changedFiles),
  });

  if (options.debug) {
    process.stdout.write(
      `${formatDebugInfo(changedFiles, packages, affected)}\n\n`,
    );
  }

  const results = await runCommands(commands);

  const summary = formatResult(results);
  if (summary) {
    process.stdout.write(`${summary}\n`);
  }

  if (results.some((result) => result.exitCode)) {
    process.exitCode = 1;
  }
};

const getWorkspaceDependencies = (packageJson: PackageJson): string[] => {
  const dependencies = new Set<string>();

  for (const field of workspaceDependencyFields) {
    const dependencyRecord = packageJson[field];
    if (!dependencyRecord) continue;

    for (const [name, version] of Object.entries(dependencyRecord)) {
      if (version === 'workspace:*') {
        dependencies.add(name);
      }
    }
  }

  return [...dependencies];
};

const shouldIgnoreChangedFile = (file: string): boolean => {
  return (
    !hasConsideredExtension(file) ||
    file.endsWith('.md') ||
    file.endsWith('/package.json') ||
    file === 'package.json' ||
    file.endsWith('/rolldown.config.mjs') ||
    file === 'rolldown.config.mjs' ||
    file === 'rolldown.utils.mjs' ||
    file === 'pnpm-lock.yaml' ||
    file === 'turbo.json' ||
    file === 'scripts/verify.ts' ||
    file === 'scripts/verify.test.ts'
  );
};

const hasConsideredExtension = (file: string): boolean => {
  return consideredExtensions.has(getFileExtension(file));
};

const getFileExtension = (file: string): string => {
  const fileName = file.split('/').at(-1) || file;
  const extensionStart = fileName.lastIndexOf('.');
  return extensionStart === -1 ? '' : fileName.slice(extensionStart);
};

const parseCliOptions = (args: string[]): CliOptions => {
  return { debug: args.includes('--debug') };
};

const formatDebugInfo = (
  changedFiles: string[],
  packages: PackageInfo[],
  affected: AffectedPackages,
): string => {
  const lines = ['Debug:'];
  const consideredFiles = changedFiles.filter(
    (file) => !shouldIgnoreChangedFile(file),
  );
  const ignoredFiles = changedFiles.filter(shouldIgnoreChangedFile);

  if (consideredFiles.length) {
    lines.push('  Changed files considered:');
    for (const file of consideredFiles) {
      lines.push(`    ${file} -> ${getChangedFileReason(file, packages)}`);
    }
  } else {
    lines.push('  Changed files considered: none');
  }

  if (ignoredFiles.length) {
    lines.push(`  Ignored changed files: ${ignoredFiles.length}`);
    for (const file of ignoredFiles.slice(0, 5)) {
      lines.push(`    ${file}`);
    }
    if (ignoredFiles.length > 5) {
      lines.push(`    ...and ${ignoredFiles.length - 5} more`);
    }
  }

  const adapterFile = consideredFiles.find((file) =>
    file.split('/').includes('adapters'),
  );
  lines.push(
    adapterFile
      ? `  Adapter matrix: enabled by ${adapterFile}`
      : '  Adapter matrix: disabled',
  );
  lines.push('  Packages:');
  lines.push(...getDebugPackageLines(affected, packages));

  return lines.join('\n');
};

const getChangedFileReason = (
  file: string,
  packages: PackageInfo[],
): string => {
  const changedPackage = packages.find((pkg) => isInPackage(file, pkg.path));
  if (changedPackage) {
    return `changed package ${changedPackage.folderName}`;
  }

  return 'global change outside tracked packages';
};

const getDebugPackageLines = (
  affected: AffectedPackages,
  packages: PackageInfo[],
): string[] => {
  if (!affected.changed.length && !affected.dependents.length) {
    return ['    none'];
  }

  if (
    !affected.changed.length &&
    affected.dependents.length === packages.length
  ) {
    return [
      `    global: ${affected.dependents.map(getFolderNameByPackageName).join(', ')}`,
    ];
  }

  const lines: string[] = [];
  if (affected.changed.length) {
    lines.push(
      `    changed: ${affected.changed.map(getFolderNameByPackageName).join(', ')}`,
    );
  }

  if (affected.dependents.length) {
    lines.push(
      `    dependent: ${affected.dependents.map(getFolderNameByPackageName).join(', ')}`,
    );
  }

  return lines;
};

const hasAdapterChange = (changedFiles: string[]): boolean => {
  return changedFiles.some((file) => {
    if (shouldIgnoreChangedFile(file)) return false;

    return file.split('/').includes('adapters');
  });
};

const parseGitStatusLine = (line: string): string | undefined => {
  if (!line) return;

  const path = line.slice(3);
  const renamedPath = path.split(' -> ').at(-1);
  return renamedPath || path;
};

const isInPackage = (file: string, packagePath: string): boolean => {
  return file === packagePath || file.startsWith(`${packagePath}/`);
};

const getDependents = (
  changed: Set<string>,
  packages: PackageInfo[],
): Set<string> => {
  const dependents = new Set<string>();
  let foundMore = true;

  while (foundMore) {
    foundMore = false;

    for (const pkg of packages) {
      if (changed.has(pkg.name) || dependents.has(pkg.name)) continue;

      const hasChangedDependency = pkg.workspaceDependencies.some(
        (dependency) => changed.has(dependency) || dependents.has(dependency),
      );

      if (hasChangedDependency) {
        dependents.add(pkg.name);
        foundMore = true;
      }
    }
  }

  return dependents;
};

const pnpmFilters = (packages: string[]): string[] => {
  return packages.flatMap((pkg) => ['--filter', pkg]);
};

const buildTestCommands = (
  packages: string[],
  role: CommandPackage['role'],
  allAdapters?: boolean,
): CommandSpec[] => {
  const label = role === 'changed' ? 'changed checks' : 'dependent checks';

  if (!allAdapters) {
    return [
      {
        label,
        type: 'tests',
        packages: getCommandPackages(packages, role),
        args: [
          'pnpm',
          ...pnpmFilters(packages),
          'check',
          ...(role === 'changed' ? ['-o'] : []),
        ],
      },
    ];
  }

  const commands: CommandSpec[] = [];
  const adapterPackages = packages.filter((pkg) =>
    adapterTestPackageNames.has(pkg),
  );
  const defaultPackages = packages.filter(
    (pkg) => !adapterTestPackageNames.has(pkg),
  );

  if (defaultPackages.length) {
    commands.push(...buildTestCommands(defaultPackages, role));
  }

  for (const pkg of getCommandPackages(adapterPackages, role)) {
    for (const adapter of testAdapters) {
      commands.push({
        label:
          adapter.name === 'postgres-js' ? label : `${label} ${adapter.name}`,
        type: 'tests',
        adapter: adapter.name,
        ...(adapter.env ? { env: adapter.env } : {}),
        packages: [pkg],
        args: [
          'pnpm',
          '--filter',
          pkg.name,
          adapter.script,
          ...(role === 'changed' ? ['-o'] : []),
        ],
      });
    }
  }

  return commands;
};

const getCommandPackages = (
  packages: string[],
  role: CommandPackage['role'],
): CommandPackage[] => {
  return packages.map((name) => ({
    name,
    folderName: getFolderNameByPackageName(name),
    role,
  }));
};

const getFolderNameByPackageName = (name: string): string => {
  const packagePath = packagePaths.find((path) => path.endsWith(`/${name}`));
  if (packagePath) {
    return getFolderName(packagePath);
  }

  if (name === 'create-orchid-orm') {
    return 'create-orm';
  }

  if (name === 'orchid-orm') {
    return 'orm';
  }

  if (name === 'orchid-orm-schema-to-zod') {
    return 'zod';
  }

  if (name === 'orchid-orm-valibot') {
    return 'valibot';
  }

  if (name === 'orchid-orm-test-factory') {
    return 'test-factory';
  }

  return name;
};

const getFolderName = (path: string): string => {
  return path.split('/').at(-1) || path;
};

const getVerifiedPackages = (
  allPackages: Set<string>,
  failedPackages: Set<string>,
): string[] => {
  return [...allPackages].filter((pkg) => !failedPackages.has(pkg));
};

const mergeSets = <T>(...sets: Set<T>[]): Set<T> => {
  const result = new Set<T>();

  for (const set of sets) {
    for (const item of set) {
      result.add(item);
    }
  }

  return result;
};

const getReportableFailurePackages = (
  results: CommandResult[],
  type: 'tests' | 'types',
  changedFailures: Set<string>,
): Set<string> => {
  const failures = new Set<string>();

  for (const result of results) {
    if (!result.exitCode || result.command.type !== type) continue;

    const packages = getReportablePackages(result, changedFailures);
    for (const pkg of packages) {
      failures.add(pkg.folderName);
    }
  }

  return failures;
};

const hasMultiAdapterTests = (results: CommandResult[]): boolean => {
  const adapters = new Set<AdapterName>();

  for (const result of results) {
    if (result.command.type === 'tests' && result.command.adapter) {
      adapters.add(result.command.adapter);
    }
  }

  return adapters.size > 1;
};

const getAdapterFailureLines = (
  results: CommandResult[],
  changedFailures: Set<string>,
): string[] => {
  const failures = new Map<AdapterName, Set<string>>();

  for (const result of results) {
    if (
      !result.exitCode ||
      result.command.type !== 'tests' ||
      !result.command.adapter
    ) {
      continue;
    }

    const packages = getReportablePackages(result, changedFailures);
    if (!packages.length) continue;

    const adapterFailures =
      failures.get(result.command.adapter) || new Set<string>();
    failures.set(result.command.adapter, adapterFailures);

    for (const pkg of packages) {
      adapterFailures.add(pkg.folderName);
    }
  }

  return testAdapters.flatMap((adapter) => {
    const packages = failures.get(adapter.name);
    if (!packages?.size) return [];

    return `Failed under ${adapter.name} adapter: ${[...packages].join(', ')}`;
  });
};

const addFailures = (target: Set<string>, result: CommandResult): void => {
  if (!result.exitCode) return;

  for (const pkg of getFailedPackages(result)) {
    target.add(pkg.folderName);
  }
};

const getReportableFailedOutput = (
  results: CommandResult[],
  changedTypeFailures: Set<string>,
  changedTestFailures: Set<string>,
): string[] => {
  const failedOutput: string[] = [];

  for (const result of results) {
    if (!result.exitCode || !result.output) continue;
    const shouldReport = shouldReportFailedOutput(
      result,
      changedTypeFailures,
      changedTestFailures,
    );
    if (!shouldReport) {
      continue;
    }

    failedOutput.push(getReportableOutput(result, getBlockedRole(result)));
  }

  return failedOutput;
};

const shouldReportFailedOutput = (
  result: CommandResult,
  changedTypeFailures: Set<string>,
  changedTestFailures: Set<string>,
): boolean => {
  if (result.command.packages.some((pkg) => pkg.role === 'changed')) {
    return true;
  }

  if (result.command.type === 'types') {
    return !changedTypeFailures.size;
  }

  if (result.command.type === 'tests') {
    return !changedTestFailures.size;
  }

  return true;
};

const getBlockedRole = (
  result: CommandResult,
): CommandPackage['role'] | undefined => {
  return result.command.packages.some((pkg) => pkg.role === 'changed')
    ? 'dependent'
    : undefined;
};

const getReportablePackages = (
  result: CommandResult,
  changedFailures: Set<string>,
): CommandPackage[] => {
  const blockedRole = changedFailures.size ? 'dependent' : undefined;
  const blocks = getPackageOutputBlocks(result).filter(
    (block) => block.pkg.role !== blockedRole,
  );

  if (blocks.length) {
    return [getShortestBlock(blocks).pkg];
  }

  return result.command.packages.filter((pkg) => pkg.role !== blockedRole);
};

const getReportableOutput = (
  result: CommandResult,
  blockedRole?: CommandPackage['role'],
): string => {
  const blocks = getPackageOutputBlocks(result).filter(
    (block) => block.pkg.role !== blockedRole,
  );

  if (blocks.length) {
    return compactPackageOutput(getShortestBlock(blocks));
  }

  return result.output;
};

const getFailedPackages = (result: CommandResult): CommandPackage[] => {
  const blocks = getPackageOutputBlocks(result);
  if (blocks.length) {
    return blocks.map((block) => block.pkg);
  }

  return result.command.packages;
};

const getShortestBlock = (blocks: PackageOutputBlock[]): PackageOutputBlock => {
  return blocks.reduce((shortest, block) =>
    block.output.length < shortest.output.length ? block : shortest,
  );
};

const compactPackageOutput = (block: PackageOutputBlock): string => {
  const lines = block.output.split('\n');
  const commandLine = lines.find((line) => line.includes(' check$ '));
  const failureSections = getFailureSections(lines, block.pkg);

  if (!failureSections.length) {
    return block.output;
  }

  const shortestSection = failureSections.reduce((shortest, section) =>
    section.length < shortest.length ? section : shortest,
  );

  return [commandLine, shortestSection].filter(Boolean).join('\n');
};

const getFailureSections = (lines: string[], pkg: CommandPackage): string[] => {
  const sections: string[] = [];
  let currentSection: string[] | undefined;
  const prefix = `${getPackagePathByPackageName(pkg.name)} `;

  for (const line of lines) {
    if (line.startsWith(prefix) && line.includes(': FAIL ')) {
      if (currentSection) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [line];
    } else if (currentSection && line.startsWith(prefix)) {
      if (isPackageSummaryLine(line)) {
        sections.push(currentSection.join('\n'));
        currentSection = undefined;
      } else {
        currentSection.push(line);
      }
    } else if (currentSection) {
      currentSection.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection.join('\n'));
  }

  return sections;
};

const isPackageSummaryLine = (line: string): boolean => {
  return (
    line.includes(': Test Suites:') ||
    line.includes(': Tests:') ||
    line.includes(': Snapshots:') ||
    line.includes(': Time:') ||
    line.includes(': Ran all test suites.') ||
    line.endsWith(': Failed')
  );
};

const getPackageOutputBlocks = (
  result: CommandResult,
): PackageOutputBlock[] => {
  const blocks = new Map<string, PackageOutputBlock>();
  let currentBlock: PackageOutputBlock | undefined;

  for (const line of result.output.split('\n')) {
    const pkg = result.command.packages.find((item) =>
      isPackageOutputLine(line, item),
    );

    if (pkg) {
      currentBlock = blocks.get(pkg.name);
      if (currentBlock) {
        currentBlock.output += `\n${line}`;
      } else {
        currentBlock = { pkg, output: line };
        blocks.set(pkg.name, currentBlock);
      }
    } else if (currentBlock) {
      currentBlock.output += `\n${line}`;
    }
  }

  const packageBlocks = [...blocks.values()];
  const failedBlocks = packageBlocks.filter(isFailedOutputBlock);
  return failedBlocks.length ? failedBlocks : packageBlocks;
};

const isFailedOutputBlock = (block: PackageOutputBlock): boolean => {
  return /(^|\s)(FAIL|Failed|ERR_PNPM|Exit status|error TS\d*)\b/.test(
    block.output,
  );
};

const isPackageOutputLine = (line: string, pkg: CommandPackage): boolean => {
  const packagePath = getPackagePathByPackageName(pkg.name);
  return (
    line.startsWith(`${packagePath} `) || line.startsWith(`${packagePath}:`)
  );
};

const getPackagePathByPackageName = (name: string): string => {
  if (name === 'create-orchid-orm') {
    return 'packages/create-orm';
  }

  if (name === 'orchid-orm') {
    return 'packages/orm';
  }

  if (name === 'orchid-orm-schema-to-zod') {
    return 'packages/schemaConfigs/zod';
  }

  if (name === 'orchid-orm-valibot') {
    return 'packages/schemaConfigs/valibot';
  }

  if (name === 'orchid-orm-test-factory') {
    return 'packages/test-factory';
  }

  return `packages/${name}`;
};

const runCommand = (command: CommandSpec): Promise<CommandResult> => {
  const [executable, ...args] = command.args;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: command.env ? { ...process.env, ...command.env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      output += chunk;
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      output += chunk;
    });

    child.on('error', reject);
    child.on('close', (exitCode: number | null) => {
      resolve({
        command,
        exitCode: exitCode ?? 1,
        output: output.trimEnd(),
      });
    });
  });
};

module.exports = {
  buildCommands,
  formatDebugInfo,
  formatResult,
  getChangedFiles,
  getChangedPackages,
  hasAdapterChange,
  getPackageInfos,
  runCommands,
};

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
