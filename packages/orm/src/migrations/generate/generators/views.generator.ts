import { Adapter, GeneratorIgnore, raw } from 'pqb/internal';
import { DbStructure, IntrospectedStructure, RakeDbAst } from 'rake-db';
import { CodeView } from '../generate';
import { ComposeMigrationParams } from '../compose-migration';
import {
  CompareViewExpression,
  compareViewsExpressions,
  viewDataToSql,
} from './generators.utils';

interface ViewPair {
  codeView: CodeView;
  dbView: DbStructure.View;
}

export const processViews = async (
  ast: RakeDbAst[],
  adapter: Adapter,
  dbStructure: IntrospectedStructure,
  {
    codeItems: { views: allViews },
    currentSchema,
    internal: { generatorIgnore },
  }: ComposeMigrationParams,
): Promise<void> => {
  const createViews: CodeView[] = [];
  const changeViews: ViewPair[] = [];
  const dropViews: DbStructure.View[] = [];
  const ignoredViews = makeIgnoredViews(generatorIgnore, currentSchema);
  const views = allViews.filter((view) => !view.materialized);

  for (const codeView of views) {
    if (isIgnoredView(ignoredViews, generatorIgnore, currentSchema, codeView)) {
      continue;
    }

    const schemaName = codeView.q.schema ?? currentSchema;
    const dbView = dbStructure.views?.find(
      (view) => view.schemaName === schemaName && view.name === codeView.name,
    );

    if (dbView) {
      changeViews.push({ codeView, dbView });
    } else {
      createViews.push(codeView);
    }
  }

  for (const dbView of dbStructure.views ?? []) {
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
  changeViews: ViewPair[],
  currentSchema: string,
): Promise<void> => {
  const compare: CompareViewExpression[] = [];

  for (const { codeView, dbView } of changeViews) {
    const from = dbViewToAst(dbView, currentSchema, 'drop');
    const to = codeViewToAst(codeView, currentSchema, 'create');

    if (!isViewOptionsEqual(from.options, to.options)) {
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
  from: RakeDbAst.View,
  to: RakeDbAst.View,
) => {
  ast.push(from, to);
};

const codeViewToAst = (
  view: CodeView,
  currentSchema: string,
  action: RakeDbAst.View['action'],
): RakeDbAst.View => {
  const schema = view.q.schema ?? currentSchema;
  const sql = viewDataToSql(view.viewData, view.name);

  return {
    type: 'view',
    action,
    schema: schema === currentSchema ? undefined : schema,
    name: view.name,
    shape: view.shape,
    sql,
    options: {
      recursive: view.viewData.recursive,
      columns: Object.keys(view.shape),
      checkOption: view.viewData.checkOption,
      securityBarrier: view.viewData.securityBarrier,
      securityInvoker: view.viewData.securityInvoker ?? true,
    },
    deps: [],
  };
};

const dbViewToAst = (
  view: DbStructure.View,
  currentSchema: string,
  action: RakeDbAst.View['action'],
): RakeDbAst.View => {
  return {
    type: 'view',
    action,
    schema: view.schemaName === currentSchema ? undefined : view.schemaName,
    name: view.name,
    shape: {},
    sql: raw({ raw: view.sql }),
    options: dbViewOptionsToAst(view),
    deps: view.deps,
  };
};

const dbViewOptionsToAst = (view: DbStructure.View): RakeDbAst.ViewOptions => {
  const options: RakeDbAst.ViewOptions = {};
  options.columns = view.columns.map((column) => column.name);

  if (view.isRecursive) {
    options.recursive = true;
  }

  if (view.with) {
    for (const pair of view.with) {
      const [key, value] = pair.split('=');
      switch (key) {
        case 'check_option':
          if (value === 'LOCAL' || value === 'CASCADED') {
            options.checkOption = value;
          }
          break;
        case 'security_barrier':
          options.securityBarrier = value === 'true';
          break;
        case 'security_invoker':
          options.securityInvoker = value === 'true';
          break;
      }
    }
  }

  return options;
};

const isViewOptionsEqual = (
  from: RakeDbAst.ViewOptions,
  to: RakeDbAst.ViewOptions,
): boolean => {
  return (
    from.recursive === to.recursive &&
    from.checkOption === to.checkOption &&
    (from.securityBarrier ?? false) === (to.securityBarrier ?? false) &&
    (from.securityInvoker ?? false) === (to.securityInvoker ?? false) &&
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
  view: Pick<DbStructure.View, 'schemaName' | 'name'>,
  currentSchema: string,
): boolean => {
  return typeof ignore.name === 'string'
    ? ignore.schema === view.schemaName && ignore.name === view.name
    : ignore.name.test(normalizedViewName(view, currentSchema));
};

const normalizedViewName = (
  view: Pick<DbStructure.View, 'schemaName' | 'name'>,
  currentSchema: string,
): string => {
  return view.schemaName === currentSchema
    ? view.name
    : `${view.schemaName}.${view.name}`;
};
