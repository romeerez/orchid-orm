export default {
  title: 'Orchid ORM',
  description: 'Postgres ORM & Query Builder',
  head: [
    [
      'script',
      {
        async: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=G-PV4PL9TK79',
      },
    ],
  ],
  markdown: {
    theme: 'one-dark-pro',
  },
  vite: {
    ssr: {
      noExternal: ['monaco-editor'],
    },
  },
  themeConfig: {
    nav: [{ text: 'Guide', link: '/guide/', activeMatch: '^/guide/' }],
    search: {
      provider: 'local',
    },
    sidebar: [
      {
        items: [
          {
            text: 'Overview',
            link: '/guide/',
          },
          {
            text: 'Quickstart',
            link: '/guide/quickstart',
          },
          {
            text: 'Benchmarks',
            link: '/guide/benchmarks',
          },
          {
            text: 'Current status and limitations',
            link: '/guide/current-status-and-limitations',
          },
          // {
          //   text: 'Compare with Kysely',
          //   link: '/guide/compare-with-kysely',
          // },
        ],
      },
      {
        text: 'ORM and query builder',
        items: [
          {
            text: 'Setup and overview',
            link: '/guide/orm-and-query-builder',
          },
          {
            text: 'Query methods',
            link: '/guide/query-methods',
          },
          {
            text: 'Where conditions',
            link: '/guide/where',
          },
          {
            text: 'Join',
            link: '/guide/join',
          },
          {
            text: 'Create, Update, Delete',
            link: '/guide/create-update-delete',
          },
          {
            text: 'Transactions',
            link: '/guide/transactions',
          },
          {
            text: 'SQL expressions',
            link: '/guide/sql-expressions',
          },
          {
            text: 'Aggregate functions',
            link: '/guide/aggregate',
          },
          {
            text: 'JSON functions',
            link: '/guide/json',
          },
          {
            text: 'Computed columns',
            link: '/guide/computed-columns',
          },
          {
            text: 'Window functions',
            link: '/guide/window',
          },
          {
            text: 'Full text search',
            link: '/guide/text-search',
          },
          {
            text: 'Advanced methods',
            link: '/guide/advanced-queries',
          },
          {
            text: 'Lifecycle hooks',
            link: '/guide/hooks',
          },
          {
            text: 'Error handling',
            link: '/guide/error-handling',
          },
        ],
      },
      {
        text: 'ORM',
        items: [
          {
            text: 'Modeling relations',
            link: '/guide/relations',
          },
          {
            text: 'Relation queries',
            link: '/guide/relation-queries',
          },
          {
            text: 'Repository',
            link: '/guide/repo',
          },
          {
            text: 'Test factories',
            link: '/guide/test-factories',
          },
        ],
      },
      {
        text: 'Columns schema',
        items: [
          {
            text: 'Overview',
            link: '/guide/columns-overview',
          },
          {
            text: 'Common methods',
            link: '/guide/common-column-methods',
          },
          {
            text: 'Validation methods',
            link: '/guide/columns-validation-methods',
          },
          {
            text: 'Column types',
            link: '/guide/columns-types',
          },
        ],
      },
      {
        text: 'Migrations',
        items: [
          {
            text: 'Setup and Overview',
            link: '/guide/migration-setup-and-overview',
          },
          {
            text: 'Commands',
            link: '/guide/migration-commands',
          },
          {
            text: 'Column methods',
            link: '/guide/migration-column-methods',
          },
          {
            text: 'Writing a migration',
            link: '/guide/migration-writing',
          },
        ],
      },
    ],
  },
};
