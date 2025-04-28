export default {
  title: 'Orchid ORM',
  description: 'Postgres ORM & Query Builder',
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
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
              {
                text: 'Compare with Kysely',
                link: '/guide/compare-with-kysely',
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
        title: 'Orchid ORM',
        description:
          'Postgres ORM, query builder, migration tool.<br />First-class TypeScript support.',
        features: [
          '🚀️ productive way to work with models and relations',
          '🧐️ full control over the database with powerful query builder',
          '😎️ <a href="https://github.com/colinhacks/zod" target="_blank" class="link">Zod</a> or <a href="https://valibot.dev/" target="_blank" class="link">Valibot</a> validation schemas can be derived from your tables',
          '⚡ generate table files from an existing database',
          '🛳️ generate migrations from the code changes',
          '💯 100% TypeScript, define a schema and everything else will be inferred',
        ],
        buttons: {
          getStarted: {
            text: 'Get Started',
            link: '/guide',
          },
          starOnGitHub: {
            text: '⭐ Star on GitHub',
            link: 'https://github.com/romeerez/orchid-orm',
          },
        },
      },
    },
    'zh-CN': {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh-CN/',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/zh-CN/guide/', activeMatch: '^/guide/' },
        ],
        search: {
          provider: 'local',
        },
        sidebar: [
          {
            items: [
              {
                text: 'Overview 概述',
                link: '/zh-CN/guide/',
              },
              {
                text: 'Quickstart 快速开始',
                link: '/zh-CN/guide/quickstart',
              },
              {
                text: 'Benchmarks 基准测试',
                link: '/zh-CN/guide/benchmarks',
              },
              {
                text: 'Current status and limitations 当前状态和限制',
                link: '/zh-CN/guide/current-status-and-limitations',
              },
              {
                text: 'Compare with Kysely 与 Kysely 的比较',
                link: '/zh-CN/guide/compare-with-kysely',
              },
            ],
          },
          {
            text: 'ORM and query builder ORM 和查询构建器',
            items: [
              {
                text: 'Setup and overview 设置和概述',
                link: '/zh-CN/guide/orm-and-query-builder',
              },
              {
                text: 'Query methods 查询方法',
                link: '/zh-CN/guide/query-methods',
              },
              {
                text: 'Where conditions 条件查询',
                link: '/zh-CN/guide/where',
              },
              {
                text: 'Join 连接',
                link: '/zh-CN/guide/join',
              },
              {
                text: 'Create, Update, Delete 创建、更新、删除',
                link: '/zh-CN/guide/create-update-delete',
              },
              {
                text: 'Transactions 事务',
                link: '/zh-CN/guide/transactions',
              },
              {
                text: 'SQL expressions SQL 表达式',
                link: '/zh-CN/guide/sql-expressions',
              },
              {
                text: 'Aggregate functions 聚合函数',
                link: '/zh-CN/guide/aggregate',
              },
              {
                text: 'JSON functions JSON 函数',
                link: '/zh-CN/guide/json',
              },
              {
                text: 'Computed columns 计算列',
                link: '/zh-CN/guide/computed-columns',
              },
              {
                text: 'Window functions 窗口函数',
                link: '/zh-CN/guide/window',
              },
              {
                text: 'Full text search 全文搜索',
                link: '/zh-CN/guide/text-search',
              },
              {
                text: 'Advanced methods 高级方法',
                link: '/zh-CN/guide/advanced-queries',
              },
              {
                text: 'Lifecycle hooks 生命周期钩子',
                link: '/zh-CN/guide/hooks',
              },
              {
                text: 'Error handling 错误处理',
                link: '/zh-CN/guide/error-handling',
              },
            ],
          },
          {
            text: 'ORM',
            items: [
              {
                text: 'Modeling relations 建模关系',
                link: '/zh-CN/guide/relations',
              },
              {
                text: 'Relation queries 关系查询',
                link: '/zh-CN/guide/relation-queries',
              },
              {
                text: 'Repository 仓库',
                link: '/zh-CN/guide/repo',
              },
              {
                text: 'Test factories 测试工厂',
                link: '/zh-CN/guide/test-factories',
              },
            ],
          },
          {
            text: 'Columns schema 列模式',
            items: [
              {
                text: 'Overview 概述',
                link: '/zh-CN/guide/columns-overview',
              },
              {
                text: 'Common methods 通用方法',
                link: '/zh-CN/guide/common-column-methods',
              },
              {
                text: 'Validation methods 验证方法',
                link: '/zh-CN/guide/columns-validation-methods',
              },
              {
                text: 'Column types 列类型',
                link: '/zh-CN/guide/columns-types',
              },
            ],
          },
          {
            text: 'Migrations 迁移',
            items: [
              {
                text: 'Setup and Overview 设置和概述',
                link: '/zh-CN/guide/migration-setup-and-overview',
              },
              {
                text: 'Commands 命令',
                link: '/zh-CN/guide/migration-commands',
              },
              {
                text: 'Column methods 列方法',
                link: '/zh-CN/guide/migration-column-methods',
              },
              {
                text: 'Writing a migration 编写迁移',
                link: '/zh-CN/guide/migration-writing',
              },
            ],
          },
        ],
        title: 'Orchid ORM',
        description:
          'Postgres ORM、查询构建器、迁移工具。<br />TypeScript 一流支持。',
        features: [
          '🚀️ 高效处理模型和关系的方式',
          '🧐️ 使用强大的查询构建器完全控制数据库',
          '😎️ <a href="https://github.com/colinhacks/zod" target="_blank" class="link">Zod</a> 或 <a href="https://valibot.dev/" target="_blank" class="link">Valibot</a> 验证模式可以从表中派生',
          '⚡ 从现有数据库生成表文件',
          '🛳️ 从代码更改生成迁移',
          '💯 100% TypeScript，定义模式，其他一切都会被推断',
        ],
        buttons: {
          getStarted: {
            text: '开始使用',
            link: '/zh-CN/guide',
          },
          starOnGitHub: {
            text: '⭐ 在 GitHub 上加星',
            link: 'https://github.com/romeerez/orchid-orm',
          },
        },
      },
    },
  },
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
};
