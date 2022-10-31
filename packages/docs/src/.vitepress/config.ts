export default {
  title: 'PORM & PQB',
  description: 'Postgres ORM & Query Builder',
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/logo.svg" }],
    ["script", { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-PV4PL9TK79' }],
  ],
  markdown: {
    theme: 'one-dark-pro',
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
    ],
    sidebar: [
      {
        items: [
          {
            text: 'Overview',
            link: '/guide/'
          },
          {
            text: 'Building example app',
            link: '/guide/building-example-app'
          }
        ]
      },
      {
        text: 'Query builder',
        items: [
          {
            text: 'Setup and overview',
            link: '/guide/query-builder-setup'
          },
          {
            text: 'Query methods',
            link: '/guide/query-builder'
          },
          {
            text: 'Callbacks',
            link: '/guide/query-builder-callbacks'
          },
        ]
      },
      {
        text: 'ORM',
        items: [
          {
            text: 'Setup and overview',
            link: '/guide/orm-setup-and-overview'
          },
          {
            text: 'Modeling relations',
            link: '/guide/orm-relations'
          },
          {
            text: 'Relation queries',
            link: '/guide/orm-relation-queries'
          }
        ]
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
            text: 'Column types',
            link: '/guide/columns-types',
          },
          {
            text: 'JSON types',
            link: '/guide/columns-json-types',
          },
        ]
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
        ]
      }
    ],
  },
}
