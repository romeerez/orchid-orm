import llmstxt, {
  copyOrDownloadAsMarkdownButtons,
} from "vitepress-plugin-llms";

export default {
  title: "Orchid ORM",
  description: "Postgres ORM & Query Builder",
  head: [
    [
      "script",
      {
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=G-PV4PL9TK79",
      },
    ],
  ],
  markdown: {
    theme: "one-dark-pro",
    config(md: { use(arg: unknown): unknown }) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },
  vite: {
    ssr: {
      noExternal: ["monaco-editor"],
    },
    plugins: [
      llmstxt({
        ignoreFiles: ["guide/compare-with-kysely.md", "guide/benchmarks.md"],
      }),
    ],
  },
  themeConfig: {
    nav: [{ text: "Guide", link: "/guide/", activeMatch: "^/guide/" }],
    search: {
      provider: "local",
    },
    sidebar: [
      {
        items: [
          {
            text: "Overview",
            link: "/guide/",
          },
          {
            text: "Quickstart",
            link: "/guide/quickstart",
          },
          {
            text: "Benchmarks",
            link: "/guide/benchmarks",
          },
          {
            text: "Current status and limitations",
            link: "/guide/current-status-and-limitations",
          },
          {
            text: "Compare with Kysely",
            link: "/guide/compare-with-kysely",
          },
        ],
      },
      {
        text: "ORM and query builder",
        items: [
          {
            text: "Setup and Overview",
            collapsed: true,
            items: [
              {
                text: "ORM setup",
                link: "/guide/orm-setup",
              },
              {
                text: "Base Table",
                link: "/guide/base-table",
              },
              {
                text: "Define Tables",
                link: "/guide/define-tables",
              },
              {
                text: "Generate Migrations",
                link: "/guide/generate-migrations",
              },
              {
                text: "ORM Methods",
                link: "/guide/orm-methods",
              },
              {
                text: "Customize db adapter",
                link: "/guide/customize-db-adapter",
              },
              {
                text: "Standalone query builder",
                link: "/guide/query-builder-standalone",
              },
            ],
          },
          {
            text: "Features",
            collapsed: true,
            items: [
              {
                text: "Computed columns",
                link: "/guide/computed-columns",
              },
              {
                text: "Lifecycle hooks",
                link: "/guide/hooks",
              },
              {
                text: "Scopes",
                link: "/guide/scopes",
              },
              {
                text: "Soft delete",
                link: "/guide/soft-delete",
              },
              {
                text: "Repository",
                link: "/guide/repo",
              },
              {
                text: "Full text search",
                link: "/guide/text-search",
              },
              {
                text: "Row Level Security",
                link: "/guide/row-level-security",
              },
            ],
          },
          {
            text: "Query Builder",
            collapsed: true,
            items: [
              {
                text: "Query Methods",
                link: "/guide/query-methods",
              },
              {
                text: "Where Conditions",
                link: "/guide/where",
              },
              {
                text: "Join",
                link: "/guide/join",
              },
              {
                text: "Create",
                link: "/guide/create",
              },
              {
                text: "Update",
                link: "/guide/update",
              },
              {
                text: "Delete",
                link: "/guide/delete",
              },
              {
                text: "Transactions",
                link: "/guide/transactions",
              },
              {
                text: "SQL Expressions",
                link: "/guide/sql-expressions",
              },
              {
                text: "Aggregate Functions",
                link: "/guide/aggregate",
              },
              {
                text: "JSON Functions",
                link: "/guide/json",
              },
              {
                text: "Window Functions",
                link: "/guide/window",
              },
            ],
          },
          {
            text: "Columns",
            collapsed: true,
            items: [
              {
                text: "Overview",
                link: "/guide/columns-overview",
              },
              {
                text: "Common Methods",
                link: "/guide/common-column-methods",
              },
              {
                text: "Validation Methods",
                link: "/guide/columns-validation-methods",
              },
              {
                text: "Column Types",
                link: "/guide/columns-types",
              },
            ],
          },
          {
            text: "Advanced Methods",
            link: "/guide/advanced-queries",
          },
          {
            text: "Test Factories",
            link: "/guide/test-factories",
          },
          {
            text: "Error Handling",
            link: "/guide/error-handling",
          },
        ],
      },
      {
        text: "Relations",
        items: [
          {
            text: "Modeling Relations",
            link: "/guide/relations",
          },
          {
            text: "Relation Queries",
            link: "/guide/relation-queries",
          },
        ],
      },
      {
        text: "Migrations",
        items: [
          {
            text: "Setup and Overview",
            link: "/guide/migration-setup-and-overview",
          },
          {
            text: "Programmatic use",
            link: "/guide/migration-programmatic-use",
          },
          {
            text: "Commands",
            link: "/guide/migration-commands",
          },
          {
            text: "Column methods",
            link: "/guide/migration-column-methods",
          },
          {
            text: "Writing a migration",
            link: "/guide/migration-writing",
          },
        ],
      },
    ],
  },
};
