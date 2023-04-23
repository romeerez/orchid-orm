# Contributing

## Development workflow

```shell
# setup repo
git clone https://github.com/romeerez/orchid-orm.git
cd orchid-orm
pnpm install

# setup environment
cp .env.example .env # change PG_URL and MYSQL_URL in .env

# setup database
cd packages/rake-db
pnpm run db create
pnpm run db migrate

# run test
pnpm run -w check # run test under the workspace root
```
