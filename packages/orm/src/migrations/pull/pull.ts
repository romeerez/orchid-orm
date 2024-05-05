import { Adapter, AdapterOptions, DbExtension } from 'pqb';
import {
  AnyRakeDbConfig,
  makeStructureToAstCtx,
  RakeDbAst,
  structureToAst,
} from 'rake-db';
import { pathToLog } from 'orchid-core';
import fs from 'fs/promises';
import path from 'node:path';
import {
  AppCodeGenTable,
  appCodeGenTable,
  AppCodeGenTables,
  getTableInfosAndFKeys,
} from './appCodeGenerators/tables.appCodeGenerator';
import { appCodeGenUpdateDbFile } from './appCodeGenerators/dbFile.appCodeGenerator';
import { generate } from '../generate/generate';

export const pull = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
) => {
  if (!config.dbPath || !config.baseTable) {
    throw new Error(
      `\`${
        config.dbPath ? 'baseTable' : 'dbPath'
      }\` setting must be set in the migrations config for pull command`,
    );
  }

  const baseTablePath = config.baseTable.getFilePath();
  const baseTableExportedAs = config.baseTable.exportAs;

  const adapter = new Adapter(options[0]);
  const currentSchema = adapter.schema || 'public';

  const ctx = makeStructureToAstCtx(config, currentSchema);

  const asts = await structureToAst(ctx, adapter);

  const { tableInfos, fkeys } = getTableInfosAndFKeys(asts, config);

  const exclusiveWriteOptions = { flag: 'wx' as const };
  const pendingFileWrites: [
    path: string,
    content: string,
    options?: { flag: 'wx' },
  ][] = [];

  const tables: AppCodeGenTables = {};
  const extensions: DbExtension[] = [];
  const domains: RakeDbAst.Domain[] = [];

  let firstTable: undefined | AppCodeGenTable;
  for (const ast of asts) {
    switch (ast.type) {
      case 'table': {
        const table = appCodeGenTable(
          tableInfos,
          fkeys,
          ast,
          baseTablePath,
          baseTableExportedAs,
        );
        tables[table.key] = table;
        if (!firstTable) firstTable = table;
        pendingFileWrites.push([
          table.path,
          table.content,
          exclusiveWriteOptions,
        ]);
        break;
      }
      case 'extension': {
        extensions.push({
          name: ast.schema ? `${ast.schema}.${ast.name}` : ast.name,
          version: ast.version,
        });
        break;
      }
      case 'domain': {
        domains.push(ast);
        break;
      }
    }
  }

  if (!firstTable && !extensions.length && !domains.length) {
    await adapter.close();
    return;
  }

  let dbPath = path.resolve(config.basePath, config.dbPath);
  if (!dbPath.endsWith('.ts')) dbPath += '.ts';
  const content = await appCodeGenUpdateDbFile(
    dbPath,
    tables,
    extensions,
    domains,
  );
  if (content) pendingFileWrites.push([dbPath, content]);

  if (firstTable) {
    await fs.mkdir(path.dirname(firstTable.path), { recursive: true });
  }

  await Promise.all(
    pendingFileWrites.map(([path, content, options]) =>
      fs.writeFile(path, content, options).then(() => {
        config.logger?.log(`Created ${pathToLog(path)}`);
      }),
    ),
  );

  await generate(options, config, ['pull'], { adapter });
};
