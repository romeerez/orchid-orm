export default {
  title: 'PORM & PQB',
  description: 'Postgres ORM & Query Builder',
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/logo.svg" }],
  ],
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
              text: 'Models and Relations',
              link: '/guide/models-and-relations',
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
