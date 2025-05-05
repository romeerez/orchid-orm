---
outline: deep
---

# 编写迁移

如果在 `rakeDb` 选项中将 `snakeCase` 设置为 true，则所有列名将被转换为 snake_case。

使用 `change` 函数更改数据库模式，它接受一个带有 `db` 的回调，并且可以选择使用第二个参数 `up` 来判断是迁移还是回滚。

```ts
import { change } from '../dbScript';

change(async (db, up) => {
  if (up) {
    console.log('迁移被调用');
  } else {
    console.log('回滚被调用');
  }
});
```

单个迁移文件可以包含多个 `change`。

这在创建数据库模式或枚举，然后创建依赖于它的表时非常有用。

当迁移时，`change` 从上到下执行，因此模式和枚举将在表之前创建。

在回滚时，`change` 从下到上执行，因此使用它们的表之后会删除模式和枚举。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createSchema('custom');
  await db.createEnum('yearSeason', ['spring', 'summer', 'fall', 'winter']);
});

change(async (db) => {
  await db.createTable('custom.table', (t) => ({
    id: t.identity().primaryKey(),
    season: t.enum('yearSeason'),
  }));
});
```

`db` 是一个扩展的查询构建器，因此它具有与查询构建器相同的[所有方法](/zh-CN/guide/query-methods)，以及其他特定方法，例如 `createTable`、`changeTable` 等。

创建表并填充值的示例：

```ts
import { change } from '../src';

change(async (db, up) => {
  const { table } = await db.createTable('languages', (t) => ({
    id: t.identity().primaryKey(),
    // `string` 是一个默认限制为 255 的 varchar。
    name: t.string().unique(),
    code: t.string().unique(),
  }));

  // 使用此 `up` 检查以避免在回滚时运行查询
  if (up) {
    // TS 知道列类型，因此这将进行类型检查：
    await table.createMany([
      { name: 'Ukrainian', code: 'ua' },
      { name: 'English', code: 'en' },
      { name: 'Polish', code: 'pl' },
      { name: 'Belarusian', code: 'be' },
      { name: 'French', code: 'fr' },
    ]);

    // 使用 db.query 执行原始 SQL 查询
    const language = 'Ukrainian';
    const { rows } = await db.query`
      SELECT * FROM languages WHERE name = ${language}
    `;
    console.log(rows);
  }
});
```

## default export

在某些设置中，可能需要先加载多个迁移，然后再执行它们。

问题是，`rakeDb` 不知道哪些数据库更改属于哪些迁移文件，您需要执行默认导出来解决它：

```ts
import { change } from '../src';

export default change(async (db, up) => {
  const { table } = await db.createTable('table', (t) => ({
    // ...
  }));
});
```

如果同一文件中有多个更改，请 `export default` 一个数组：

```ts
import { change } from '../src';

export default [
  change(async (db, up) => {
    // change 1
  }),
  change(async (db, up) => {
    // change 2
  }),
];
```

为了避免忘记写默认导出，请在 `rakeDb` 配置中将 `forceDefaultExports` 设置为 `true`。

## createTable, dropTable

[//]: # 'has JSDoc'

`createTable` 接受一个字符串作为表名，可选选项和一个回调来指定列。

`dropTable` 接受相同的参数，它将在迁移时删除表，在回滚时创建表。

要创建一个空表，可以省略带列的回调。

在特定模式中创建表时，请使用模式名称写表名：`'schemaName.tableName'`。

返回对象 `{ table: TableInterface }`，允许在创建表后立即插入记录。

选项为：

```ts
type TableOptions = {
  // 仅在表尚不存在时创建表
  createIfNotExists?: boolean;

  // 仅在表存在时删除表
  dropIfExists?: boolean;

  // 用于还原 `createTable`
  dropMode?: 'CASCADE' | 'RESTRICT';

  // 在表上添加数据库注释
  comment?: string;

  // 默认情况下，当表没有主键时会抛出错误
  // 将 `noPrimaryKey` 设置为 `true` 以绕过它
  noPrimaryKey?: boolean;

  // 仅为此表覆盖 rakeDb `snakeCase` 选项
  snakeCase?: boolean;
};
```

示例：

```ts
import { change } from '../dbScript';

change(async (db, up) => {
  // 使用选项调用 `createTable`
  await db.createTable(
    'table',
    {
      comment: 'Table comment',
      dropMode: 'CASCADE',
      noPrimaryKey: true,
    },
    (t) => ({
      // ...
    }),
  );

  // 不带选项调用
  const { table } = await db.createTable('user', (t) => ({
    id: t.identity().primaryKey(),
    email: t.text().unique(),
    name: t.text(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));

  // 仅在迁移时创建记录
  if (up) {
    // table 是一个数据库表接口，所有查询方法都可用
    await table.createMany([...data]);
  }
});
```

## changeTable

[//]: # 'has JSDoc'

`changeTable` 接受一个表名，可选选项和一个带有列更改的特殊回调。

在特定模式中更改表时，请使用模式名称写表名：`'schemaName.tableName'`。

选项为：

```ts
type ChangeTableOptions = {
  comment?:
    | // 在迁移时向表添加注释，在回滚时删除注释
    string // 在迁移时从第一个更改为第二个，在回滚时从第二个更改为第一个
    | [string, string] // 在迁移和回滚时删除注释
    | null;

  // 仅为此表覆盖 rakeDb `snakeCase` 选项
  snakeCase?: boolean;
};
```

`changeTable` 的回调与 `createTable` 的不同之处在于它期望列被包装在更改方法中，例如 `add`、`drop` 和 `change`。

### add, drop

`add` 将在迁移时添加列（或检查），并在回滚时删除它。

`drop` 将在迁移时删除列（或检查），并在回滚时添加它。

`add` 或 `drop` 中的列可以具有与创建表时相同的所有方法，例如 `index`、`unique`、`exclude` 和 `foreignKey`。

支持添加复合主键、外键、索引、排除 - 与创建表时相同。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // 添加列
    column1: t.add(t.text()),

    // 删除列
    column2: t.drop(t.boolean()),

    // 向列添加检查
    column3: t.add(t.check(t.sql`column3 > 5`)),

    // 从列中删除检查
    column4: t.drop(t.check(t.sql`column4 > 5`)),

    // 添加复合主键：
    ...t.add(t.primaryKey(['foo', 'bar'])),

    // 添加复合索引：
    ...t.add(t.index(['foo', 'bar'])),

    // 添加复合唯一索引：
    ...t.add(t.unique(['foo', 'bar'])),

    // 在两列上添加排除约束
    ...t.add(
      t.exclude(
        [
          { column: 'column1', with: '=' },
          { column: 'column2', with: '<>' },
        ],
        { using: 'GIST' },
      ),
    ),

    // 添加复合外键：
    ...t.add(
      t.foreignKey(['foo', 'bar'], 'otherTable', ['otherFoo', 'otherBar']),
    ),

    // 添加表检查
    ...t.add(t.check(t.sql`column3 > column4`)),

    // 添加约束
    ...t.add(
      t.constraint({
        name: 'constraintName',
        check: t.sql`column3 < 20`,
        foreignKey: [['foo', 'bar'], 'otherTable', ['otherFoo', 'otherBar']],
      }),
    ),

    // 添加时间戳：
    ...t.add(t.timestamps()),
  }));
});
```

在 `changeTable` 中可以省略 `t.add`：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // 在迁移时添加列，在回滚时删除它
    column: t.text(),
  }));
});
```

### change

接受一个包含两个列（或检查）的数组。
在迁移时，它会将列更改为第二个元素，
在回滚时会将列更改为第一个元素。

允许在多个列上删除或创建主键。

索引选项列在[这里](/zh-CN/guide/migration-column-methods#index)。

排除约束选项列在[这里](/zh-CN/guide/migration-column-methods#exclude)。

外键选项列在[这里](/zh-CN/guide/migration-column-methods#foreignkey)。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // 将列类型从整数更改为 varchar(255)
    column1: t.change(t.integer(), t.string()),

    // 使用 SQL 表达式更改列类型以转换数据
    column2: t.change(t.integer(), t.string(), {
      usingUp: t.sql`column2::text`,
      usingDown: t.sql`column2::integer`,
    }),

    // 更改列默认值
    column3: t.change(t.default(1), t.default(2)),

    // 我们希望值被正确序列化时，重要的是指定列类型（json）：
    // t.json().default([]) 将使用 JSON.stringify 序列化，
    // t.default([]) 不会。
    column4: t.change(t.json(), t.json().default([])),

    // 使用原始 SQL 更改列默认值
    column5: t.change(t.default(t.sql`2 + 2`), t.default(t.sql`3 + 3`)),

    // 更改列为可为空或不可为空
    column6: t.change(t.nonNullable(), t.nullable()),
    column7: t.change(t.nullable(), t.nonNullable()),

    // 更改列注释
    column8: t.change(t.comment('from comment'), t.comment('to comment')),

    // 添加索引
    column9: t.change(t.integer(), t.integer().index()),

    // 删除索引
    column10: t.change(t.integer().index(), t.integer()),

    // 更改索引
    column11: t.change(
      t.integer().index({
        // 在回滚时应用的索引选项
      }),
      t.integer().index({
        // 在迁移时应用的索引选项
      }),
    ),

    // 添加主键
    column12: t.change(t.integer(), t.integer().primaryKey()),

    // 删除主键
    column13: t.change(t.integer().primaryKey(), t.integer()),

    // 添加外键
    column14: t.change(
      t.integer(),
      t.integer().foreignKey('otherTable', 'otherTableId'),
    ),

    // 删除外键
    column15: t.change(
      t.integer().foreignKey('otherTable', 'otherTableId'),
      t.integer(),
    ),

    // 更改外键
    column16: t.change(
      t.integer().foreignKey('oneTable', 'oneColumn', {
        // 在迁移时应用的外键选项
        name: 'oneForeignKeyName',
        match: 'PARTIAL',
        onUpdate: 'RESTRICT',
        onDelete: 'SET DEFAULT',
      }),
      t.integer().foreignKey('otherTable', 'otherColumn', {
        // 在回滚时应用的外键选项
        name: 'otherForeignKeyName',
        match: 'FULL',
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      }),
    ),

    // 添加排除
    column17: t.change(t.integer(), t.integer().exclude('=')),

    // 删除排除
    column18: t.change(t.integer().exclude('='), t.integer()),

    // 更改排除
    column19: t.change(
      t.integer().exclude('=', {
        // 在回滚时应用的排除选项
      }),
      t.integer().exclude('=', {
        // 在迁移时应用的排除选项
      }),
    ),

    // 一次更改各种列属性
    column20: t.change(
      t
        .integer()
        .collate('de_DE')
        .default(123)
        .comprssion('pglz')
        .comment('from comment')
        .index({ name: 'oneIndexName' })
        .foreignKey('oneTable', 'oneColumn', {
          name: 'oneForeignKeyName',
        }),
      t
        .text()
        .collate('es_ES')
        .default('123')
        .compression('lz4')
        .comment('to comment')
        .nullable()
        .index({ name: 'otherIndexName' })
        .foreignKey('otherTable', 'otherColumn', {
          name: 'otherForeignKeyName',
        }),
    ),

    column21: t.change(
      // 从此检查更改：
      t.check(t.sql`column17 > 5`),
      // 更改为此检查：
      t.check(t.sql`column17 < 10`),
    ),
  }));
});
```

### rename

[//]: # 'has JSDoc'

重命名列：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    oldColumnName: t.rename('newColumnName'),
  }));
});
```

请注意，重命名 `ALTER TABLE` 在其他更改之前执行，
因此如果您还在同一个 `changeTable` 中为此列添加新的约束，
请使用新名称引用它。

## renameTable

[//]: # 'has JSDoc'

重命名表：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameTable('oldTableName', 'newTableName');
});
```

为表名添加模式前缀以设置不同的模式：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameTable('fromSchema.oldTable', 'toSchema.newTable');
});
```

## changeTableSchema

[//]: # 'has JSDoc'

为表设置不同的模式：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.changeTableSchema('tableName', 'fromSchema', 'toSchema');
});
```

## addColumn, dropColumn

[//]: # 'has JSDoc'

在迁移时向表添加列，并在回滚时删除它。

`dropColumn` 接受相同的参数，在迁移时删除列，在回滚时添加它。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.addColumn('tableName', 'columnName', (t) =>
    t.integer().index().nullable(),
  );
});
```

## addIndex, dropIndex

[//]: # 'has JSDoc'

在迁移时向表添加索引，并在回滚时删除它。

`dropIndex` 接受相同的参数，在迁移时删除索引，在回滚时添加它。

第一个参数是表名，其他参数与[复合索引](#composite-index)相同。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.addIndex(
    'tableName',
    ['column1', { column: 'column2', order: 'DESC' }],
    {
      name: 'indexName',
    },
  );
});
```

## renameIndex

[//]: # 'has JSDoc'

重命名索引：

```ts
import { change } from '../dbScript';

change(async (db) => {
  // tableName 可以添加模式前缀
  await db.renameIndex('tableName', 'oldIndexName', 'newIndexName');
});
```

## addForeignKey, dropForeignKey

[//]: # 'has JSDoc'

在迁移时向表添加外键，并在回滚时删除它。

`dropForeignKey` 接受相同的参数，在迁移时删除外键，在回滚时添加它。

参数：

- 表名
- 表中的列名
- 其他表名
- 其他表中的列名
- 选项：
  - `name`：约束名称
  - `match`：'FULL'、'PARTIAL' 或 'SIMPLE'
  - `onUpdate` 和 `onDelete`：'NO ACTION'、'RESTRICT'、'CASCADE'、'SET NULL' 或 'SET DEFAULT'

第一个参数是表名，其他参数与[复合外键](#composite-foreign-key)相同。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.addForeignKey(
    'tableName',
    ['id', 'name'],
    'otherTable',
    ['foreignId', 'foreignName'],
    {
      name: 'constraintName',
      match: 'FULL',
      onUpdate: 'RESTRICT',
      onDelete: 'CASCADE',
    },
  );
});
```

## addPrimaryKey, dropPrimaryKey

[//]: # 'has JSDoc'

在迁移时向表添加主键，并在回滚时删除它。

`dropPrimaryKey` 接受相同的参数，在迁移时删除主键，在回滚时添加它。

第一个参数是表名，第二个参数是列数组。
可选的第三个参数可以为主键约束设置名称。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.addPrimaryKey('tableName', ['id', 'name'], {
    name: 'tablePkeyName',
  });
});
```

## addCheck, dropCheck

[//]: # 'has JSDoc'

为多列添加或删除检查。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.addCheck('tableName', t.sql`column > 123`);
});
```

## renameConstraint

[//]: # 'has JSDoc'

重命名表约束，例如主键或数据库检查

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameConstraint(
    'tableName', // 可以包含模式：'schema.table'
    'oldConstraintName',
    'newConstraintName',
  );
});
```

## renameColumn

[//]: # 'has JSDoc'

重命名列：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameColumn('tableName', 'oldColumnName', 'newColumnName');
});
```

## createEnum, dropEnum

[//]: # 'has JSDoc'

`createEnum` 在迁移时创建枚举，在回滚时删除它。

`dropEnum` 执行相反操作。

第三个选项参数是可选的。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createEnum('numbers', ['one', 'two', 'three']);

  // 使用 `schemaName.enumName` 格式指定模式
  await db.createEnum('customSchema.mood', ['sad', 'ok', 'happy'], {
    // 以下选项用于删除枚举时
    dropIfExists: true,
    cascade: true,
  });
});
```

## addEnumValues, dropEnumValues

[//]: # 'has JSDoc'

使用这些方法从现有枚举中添加或删除一个或多个值。

`addEnumValues` 在回滚迁移时将删除值。

删除值在内部分多个步骤进行：

1. 从数据库中选择所有依赖于枚举的列；
2. 更改所有这些列的类型为文本；
3. 删除枚举；
4. 重新创建没有给定值的枚举；
5. 将第一步中的所有列更改为枚举类型；

如果值被某些表使用，
迁移 `dropEnumValue` 或回滚 `addEnumValue` 将抛出带有描述性消息的错误，
在这种情况下，您需要通过删除具有该值的行或更改这些值来手动解决问题。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.addEnumValue('numbers', 'four');

  // 您可以传递选项
  await db.addEnumValue('numbers', 'three', {
    // 插入位置
    before: 'four',
    // 如果已存在则跳过
    ifNotExists: true,
  });

  // 枚举名称可以添加模式前缀
  await db.addEnumValue('public.numbers', 'five', {
    after: 'four',
  });
});
```

## changeEnumValues

[//]: # 'has JSDoc'

删除枚举并使用新值集重新创建它。
在删除之前，将所有相关列类型更改为文本，创建后将类型更改回枚举，
与[dropEnumValues](/zh-CN/guide/migration-writing#addenumvalues,-dropenumvalues)的工作方式相同。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.changeEnumValues(
    // 可以添加模式前缀：'public.numbers'
    'numbers',
    // 从以下值更改：
    ['one', 'two'],
    // 更改为以下值：
    ['three', 'four'],
  );
});
```

## renameEnumValues

[//]: # 'has JSDoc'

使用此方法重命名一个或多个枚举值：

```ts
import { change } from '../dbScript';

change(async (db) => {
  // 将值 "from" 重命名为 "to"
  await db.rename('numbers', { from: 'to' });

  // 枚举名称可以添加模式前缀
  await db.rename('public.numbers', { from: 'to' });
});
```

## renameType

[//]: # 'has JSDoc'

重命名类型（例如枚举）：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameType('oldTypeName', 'newTypeName');
});
```

为类型名称添加模式前缀以设置不同的模式：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameType('fromSchema.oldType', 'toSchema.newType');
});
```

## changeTypeSchema

为类型（例如枚举）设置不同的模式：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.changeTypeSchema('typeName', 'fromSchema', 'toSchema');
});
```

## createSchema, dropSchema

[//]: # 'has JSDoc'

`createSchema` 创建数据库模式，并在回滚时删除它。

`dropSchema` 接受相同的参数，在迁移时删除模式，在回滚时添加它。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createSchema('schemaName');
});
```

## renameSchema

[//]: # 'has JSDoc'

重命名数据库模式，在回滚时向后重命名。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');
});
```

## createExtension, dropExtension

[//]: # 'has JSDoc'

`createExtension` 创建数据库扩展，并在回滚时删除它。

`dropExtension` 接受相同的参数，在迁移时删除扩展，在回滚时添加它。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createExtension('pg_trgm');
});
```

## createDomain, dropDomain

[//]: # 'has JSDoc'

域是基于其他类型的自定义数据库类型，可以包括 `NOT NULL` 和 `CHECK`（请参阅[postgres 教程](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)）。

使用 ORM 的迁移生成器时，请遵循[此处](/zh-CN/guide/orm-and-query-builder.html#postgres-domains)。

在函数中构造列类型作为第二个参数。

说明符[nullable](/zh-CN/guide/common-column-methods#nullable)、[default](/zh-CN/guide/common-column-methods#default)、[check](/zh-CN/guide/migration-column-methods#check)、[collate](/zh-CN/guide/migration-column-methods#collate)
将保存到数据库级别的域类型。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createDomain('domainName', (t) =>
    t.integer().check(t.sql`value = 42`),
  );

  // 使用 `schemaName.domainName` 格式指定模式
  await db.createDomain('schemaName.domainName', (t) =>
    t
      .text()
      .nullable()
      .collate('C')
      .default('default text')
      .check(t.sql`length(value) > 10`),
  );
});
```

## renameDomain

[//]: # 'has JSDoc'

重命名域：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.renameDomain('oldName', 'newName');

  // 将域移动到不同的模式
  await db.renameDomain('oldSchema.domain', 'newSchema.domain');
});
```

## createCollation, dropCollation

[//]: # 'has JSDoc'

创建和删除数据库排序规则（请参阅[Postgres 文档](https://www.postgresql.org/docs/current/sql-createcollation.html)）。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createCollation('myCollation', {
    // 这是同时设置 lcCollate 和 lcCType 的快捷方式。
    locale: 'en-u-kn-true',

    // 仅在未设置 `locale` 时设置 `lcType` 和 `lcCType`。
    // lcType: 'C',
    // lcCType: 'C',

    // 提供者可以是 'icu' 或 'libc'。 'libc' 是默认值。
    provider: 'icu',

    // 默认为 true，仅支持 'icu' 提供者的 false。
    deterministic: true,

    // 旨在由 `pg_upgrade` 使用。通常应省略。
    version: '1.2.3',

    // 创建时用于 `CREATE IF NOT EXISTS`。
    createIfNotExists: true,

    // 删除时用于 `DROP IF EXISTS`。
    dropIfExists: true,

    // 删除时用于 `DROP ... CASCADE`。
    cascase: true,
  });
});
```

您可以指定一个排序规则以从中复制选项，而不是指定排序规则选项。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createCollation('myCollation', {
    fromExisting: 'otherCollation',
  });
});
```

要在特定数据库模式中创建排序规则，请将其添加到排序规则名称之前：

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createCollation('schemaName.myCollation', {
    // `fromExisting` 也可以接受带有模式的排序规则名称。
    fromExisting: 'schemaName.otherCollation',
  });
});
```

## createView, dropView

[//]: # 'has JSDoc'

创建和删除数据库视图。

提供 SQL 作为字符串或通过可以接受变量的 `t.sql`。

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createView(
    'simpleView',
    `
    SELECT a.one, b.two
    FROM a
    JOIN b ON b."aId" = a.id
  `,
  );

  // 视图可以接受 t.sql 和变量：
  const value = 'some value';
  await db.createView(
    'viewWithVariables',
    t.sql`
      SELECT * FROM a WHERE key = ${value}
    `,
  );

  // 带选项的视图
  await db.createView(
    'schemaName.recursiveView',
    {
      // createOrReplace 在创建视图时有效
      createOrReplace: true,

      // dropIfExists 和 dropMode 在删除视图时有效
      dropIfExists: true,
      dropMode: 'CASCADE',

      // 有关详细信息，请查看 Postgres 文档中的 CREATE VIEW，
      // 这些选项与 CREATE VIEW 选项匹配
      temporary: true,
      recursive: true,
      columns: ['n'],
      with: {
        checkOption: 'LOCAL', // 或 'CASCADED'
        securityBarrier: true,
        securityInvoker: true,
      },
    },
    `
      VALUES (1)
      UNION ALL
      SELECT n + 1 FROM "schemaName"."recursiveView" WHERE n < 100;
    `,
  );
});
```

## tableExists

[//]: # 'has JSDoc'

返回布尔值以了解表是否存在：

```ts
import { change } from '../dbScript';

change(async (db) => {
  if (await db.tableExists('tableName')) {
    // ...do something
  }
});
```

## columnExists

[//]: # 'has JSDoc'

返回布尔值以了解列是否存在：

请注意，当 `snakeCase` 选项设置为 true 时，此方法不会将列转换为 snake case，与其他部分不同。

```ts
import { change } from '../dbScript';

change(async (db) => {
  if (await db.columnExists('tableName', 'columnName')) {
    // ...do something
  }
});
```

## constraintExists

[//]: # 'has JSDoc'

返回布尔值以了解约束是否存在：

```ts
import { change } from '../dbScript';

change(async (db) => {
  if (await db.constraintExists('constraintName')) {
    // ...do something
  }
});
```
