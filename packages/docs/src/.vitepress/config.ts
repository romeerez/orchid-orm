export default {
  base: 'porm',
  title: 'PORM & PQB',
  description: 'Postgres ORM & Query Builder',
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/logo.svg" }],
  ],
  markdown: {
    theme: 'one-dark-pro',
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            {
              text: 'Overview',
              link: '/guide/',
            },
            {
              text: 'Installation',
              link: '/guide/installation',
            },
            {
              text: 'CRUD Walk-through',
              link: '/guide/crud-walk-through',
            },
            {
              text: 'Query Builder',
              link: '/guide/query-builder',
            },
            {
              text: 'ORM',
              link: '/guide/orm',
            },
            {
              text: 'Columns schema',
              link: '/guide/columns-schema',
            },
            {
              text: 'Migrations',
              link: '/guide/migrations',
            },
          ]
        },
      ],
    },
  },
}
