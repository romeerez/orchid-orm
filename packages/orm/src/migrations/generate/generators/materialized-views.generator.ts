import { Adapter, GeneratorIgnore, raw } from 'pqb/internal';
import { DbStructure, IntrospectedStructure, RakeDbAst } from 'rake-db';
import { CodeView } from '../generate';
import { ComposeMigrationParams } from '../compose-migration';
import {
  CompareViewExpression,
  compareViewsExpressions,
} from './generators.utils';

interface MaterializedViewPair {
  codeView: CodeView;
  dbView: DbStructure.MaterializedView;
}

export const processMaterializedViews = async (
  ast: RakeDbAst[],
  adapter: Adapter,
  dbStructure: IntrospectedStructure,
  {
    codeItems: { views: allViews },
    currentSchema,
    internal: { generatorIgnore },
  }: ComposeMigrationParams,
): Promise<void> => {
  const views = allViews.filter((view) => view.materialized);
  const createViews: CodeView[] = [];
  const changeViews: MaterializedViewPair[] = [];
  const dropViews: DbStructure.MaterializedView[] = [];
  const ignoredViews = makeIgnoredViews(generatorIgnore, currentSchema);

  for (const codeView of views) {
    if (isIgnoredView(ignoredViews, generatorIgnore, currentSchema, codeView)) {
      continue;
    }

    const schemaName = codeView.q.schema ?? currentSchema;
    const dbView = dbStructure.materializedViews?.find(
      (view) => view.schemaName === schemaName && view.name === codeView.name,
    );

    if (dbView) {
      changeViews.push({ codeView, dbView });
    } else {
      createViews.push(codeView);
    }
  }

  for (const dbView of dbStructure.materializedViews ?? []) {
    if (
      generatorIgnore?.schemas?.includes(dbView.schemaName) ||
      ignoredViews.some((ignore) =>
        matchesIgnoredView(ignore, dbView, currentSchema),
      )
    ) {
      continue;
    }

    const codeView = views.find(
      (view) =>
        view.name === dbView.name &&
        (view.q.schema ?? currentSchema) === dbView.schemaName,
    );

    if (!codeView) {
      dropViews.push(dbView);
    }
  }

  for (const codeView of createViews) {
    ast.push(codeViewToAst(codeView, currentSchema, 'create'));
  }

  await applyChangeViews(ast, adapter, changeViews, currentSchema);

  for (const dbView of dropViews) {
    ast.push(dbViewToAst(dbView, currentSchema, 'drop'));
  }
};

const applyChangeViews = async (
  ast: RakeDbAst[],
  adapter: Adapter,
  changeViews: MaterializedViewPair[],
  currentSchema: string,
): Promise<void> => {
  const compare: CompareViewExpression[] = [];

  for (const { codeView, dbView } of changeViews) {
    const from = dbViewToAst(dbView, currentSchema, 'drop');
    const to = codeViewToAst(codeView, currentSchema, 'create');

    if (!isMaterializedViewOptionsEqual(from.options, to.options)) {
      pushRecreateView(ast, from, to);
      continue;
    }

    const codeSql =
      typeof to.sql === 'string' ? to.sql : to.sql.toSQL({ values: [] });

    compare.push({
      inDb: dbView.sql,
      inCode: codeSql,
      ast: to,
      onNotEqual() {
        pushRecreateView(ast, from, to);
      },
    });
  }

  await compareViewsExpressions(adapter, compare);
};

const pushRecreateView = (
  ast: RakeDbAst[],
  from: RakeDbAst.MaterializedView,
  to: RakeDbAst.MaterializedView,
) => {
  ast.push(from, to);
};

const codeViewToAst = (
  view: CodeView,
  currentSchema: string,
  action: RakeDbAst.MaterializedView['action'],
): RakeDbAst.MaterializedView => {
  const schema = view.q.schema ?? currentSchema;
  const sql =
    typeof view.viewData.sql === 'string'
      ? raw({ raw: view.viewData.sql })
      : (view.viewData.sql ?? raw({ raw: '' }));

  return {
    type: 'materializedView',
    action,
    schema: schema === currentSchema ? undefined : schema,
    name: view.name,
    shape: view.shape,
    sql,
    options: {
      columns: Object.keys(view.shape),
      withData: view.viewData.withData,
    },
    deps: [],
  };
};

const dbViewToAst = (
  view: DbStructure.MaterializedView,
  currentSchema: string,
  action: RakeDbAst.MaterializedView['action'],
): RakeDbAst.MaterializedView => {
  return {
    type: 'materializedView',
    action,
    schema: view.schemaName === currentSchema ? undefined : view.schemaName,
    name: view.name,
    shape: {},
    sql: raw({ raw: view.sql }),
    options: dbMaterializedViewOptionsToAst(view),
    deps: view.deps,
  };
};

const dbMaterializedViewOptionsToAst = (
  view: DbStructure.MaterializedView,
): RakeDbAst.MaterializedViewOptions => {
  const options: RakeDbAst.MaterializedViewOptions = {
    columns: view.columns.map((column) => column.name),
  };

  if (!view.isPopulated) {
    options.withData = false;
  }

  return options;
};

const isMaterializedViewOptionsEqual = (
  from: RakeDbAst.MaterializedViewOptions,
  to: RakeDbAst.MaterializedViewOptions,
): boolean => {
  return (
    (from.withData ?? true) === (to.withData ?? true) &&
    isStringArrayEqual(from.columns, to.columns)
  );
};

const isStringArrayEqual = (
  a: string[] | undefined,
  b: string[] | undefined,
): boolean => {
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false;
  if (!a?.length && !b?.length) return true;

  return !!a?.every((item, i) => item === b?.[i]);
};

interface IgnoredView {
  schema?: string;
  name: string | RegExp;
}

const makeIgnoredViews = (
  generatorIgnore: GeneratorIgnore | undefined,
  currentSchema: string,
): IgnoredView[] => {
  const views = generatorIgnore?.views;
  if (!views) return [];

  return views.map((name) => {
    if (typeof name !== 'string') {
      return { name };
    }

    const parts = name.split('.');
    return parts.length === 2
      ? { schema: parts[0], name: parts[1] }
      : { schema: currentSchema, name };
  });
};

const isIgnoredView = (
  ignoredViews: IgnoredView[],
  generatorIgnore: GeneratorIgnore | undefined,
  currentSchema: string,
  codeView: CodeView,
): boolean => {
  const schemaName = codeView.q.schema ?? currentSchema;
  return (
    generatorIgnore?.schemas?.includes(schemaName) === true ||
    ignoredViews.some((ignore) => {
      return matchesIgnoredView(
        ignore,
        {
          schemaName,
          name: codeView.name,
        },
        currentSchema,
      );
    })
  );
};

const matchesIgnoredView = (
  ignore: IgnoredView,
  view: Pick<DbStructure.MaterializedView, 'schemaName' | 'name'>,
  currentSchema: string,
): boolean => {
  return typeof ignore.name === 'string'
    ? ignore.schema === view.schemaName && ignore.name === view.name
    : ignore.name.test(normalizedViewName(view, currentSchema));
};

const normalizedViewName = (
  view: Pick<DbStructure.MaterializedView, 'schemaName' | 'name'>,
  currentSchema: string,
): string => {
  return view.schemaName === currentSchema
    ? view.name
    : `${view.schemaName}.${view.name}`;
};
