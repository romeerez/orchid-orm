import { languages } from 'monaco-editor';

export const fetchText = (url) => fetch(url).then((res) => res.text());

export const fetchJSON = (url) => fetch(url).then((res) => res.json());

export const fetchType = async (name, url) => {
  const code = await fetchText(url);
  languages.typescript.typescriptDefaults.addExtraLib(
    `declare module '${name}' {\n${code}\n}`,
    name,
  );
};

export const fetchTypes = (files) => {
  Object.entries(files).map(([name, url]) => fetchType(name, url));
};

export const mockAdapter = {
  queries: [],
  connection: {},
  release() {},
  query(...args) {
    const [sql, values] =
      typeof args[0] === 'string' ? args : [args[0].text, args[0].values];

    this.queries.push({ sql, values });

    const proxy = new Proxy(
      {},
      {
        get: () => proxy,
      },
    );

    return Promise.resolve({ rows: [proxy] });
  },
};

let stores = [];

const modules = {
  pg: {
    types: {
      builtins: {},
    },
    Pool: class Pool {
      connect() {
        return mockAdapter;
      }
    },
    DatabaseError: class DatabaseError {},
  },
  'node:util': {
    inspect: {},
  },
  'node:async_hooks': {
    AsyncLocalStorage: class AsyncLocalStorage {
      getStore() {
        return stores[stores.length - 1];
      }
      async run(data, cb) {
        stores.push(data);
        await cb();
        stores.pop();
      }
    },
  },
};

const process = {
  versions: {},
};

export const loadLib = (name, path, toCJS) => {
  return fetchText(path).then((code) =>
    execFile(name, toCJS ? esmToCommonjs(code) : code),
  );
};

export const execFile = (name, code, exports = {}) => {
  const fn = new Function('require', 'exports', 'process', code);

  fn(
    (path) => {
      let module = modules[path];
      if (!module) {
        if (path.startsWith('.')) {
          path = new URL(
            name.includes('/')
              ? `file:///${name}/../${path}`
              : `file:///${name}/${path}`,
          ).pathname.slice(1);
          module = modules[path];
        }
      }

      if (!module) {
        path += '.js';
        module = modules[path];
      }

      return module;
    },
    exports,
    process,
  );

  if (name) modules[name] = exports;

  return exports;
};

export const esmToCommonjs = (code) => {
  const exported = [];
  const exportRegex = /export\s+(const|let|var|function|class)\s+(\w+)/g;
  code = code.replace(exportRegex, (_, keyword, id) => {
    exported.push(id);
    return `${keyword} ${id}`;
  });

  code = code.replace(
    /import\s*(\{.*?\}|\*|\{.*? as .*?\}|\w+)\s*from\s*['"](.+?)['"]/g,
    (_, imports, modulePath) => {
      if (imports === '*') {
        return `const ${modulePath} = require('${modulePath}')`;
      } else if (imports.includes('{')) {
        const namedImports = imports
          .replace(/[{}]/g, '')
          .split(',')
          .map((importItem) => {
            const [importName, alias] = importItem.trim().split(' as ');
            return alias
              ? `${importName.trim()}: ${alias.trim()}`
              : importName.trim();
          })
          .join(', ');

        return `const { ${namedImports} } = require('${modulePath}')`;
      } else {
        const [importName, alias] = imports.split(' as ');
        return `const ${
          alias ? alias.trim() : importName.trim()
        } = require('${modulePath}')`;
      }
    },
  );

  code = code.replace(
    /export\s*(\{.*?\}|\*|\{.*? as .*?\})(\s*from\s*(['"].+?['"]))?/g,
    (_, exports, __, modulePath) => {
      return (
        'Object.assign(exports, ({' +
        exports
          .slice(1, -1)
          .split(',')
          .map((exp) => {
            const [prop, as] = exp.split(/ as /);
            return prop && `${as.trim()}: ${prop.trim()}`;
          })
          .join(', ') +
        `}${modulePath ? ` = require(${modulePath})` : ''}));`
      );
    },
  );

  return (
    code +
    '\n' +
    exported.map((name) => `exports.${name} = ${name};`).join('\n')
  );
};
