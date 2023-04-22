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
  themeConfig: {
    nav: [{ text: 'Guide', link: '/guide/', activeMatch: '^/guide/' }],
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
            text: 'Building a sample app',
            link: '/guide/building-a-sample-app',
          },
          {
            text: 'Benchmarks',
            link: '/guide/benchmarks',
          },
          {
            text: 'Current status and limitations',
            link: '/guide/current-status-and-limitations',
          },
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
            link: '/guide/query-builder-where',
          },
          {
            text: 'Join',
            link: '/guide/join',
          },
          {
            text: 'Create, Update, Delete',
            link: '/guide/query-builder-create-update-delete',
          },
          {
            text: 'Transactions',
            link: '/guide/query-builder-transactions',
          },
          {
            text: 'Aggregate functions',
            link: '/guide/query-builder-aggregate',
          },
          {
            text: 'Advanced methods',
            link: '/guide/query-builder-advanced',
          },
          {
            text: 'Callbacks',
            link: '/guide/query-builder-callbacks',
          },
          {
            text: 'Error handling',
            link: '/guide/query-builder-error-handling',
          },
        ],
      },
      {
        text: 'ORM',
        items: [
          {
            text: 'Modeling relations',
            link: '/guide/orm-relations',
          },
          {
            text: 'Relation queries',
            link: '/guide/orm-relation-queries',
          },
          {
            text: 'Repository',
            link: '/guide/orm-repo',
          },
          {
            text: 'Test factories',
            link: '/guide/orm-test-factories',
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
            link: '/guide/columns-common-methods',
          },
          {
            text: 'Validation methods',
            link: '/guide/columns-validation-methods',
          },
          {
            text: 'Column types',
            link: '/guide/columns-types',
          },
          {
            text: 'JSON types',
            link: '/guide/columns-json-types',
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
