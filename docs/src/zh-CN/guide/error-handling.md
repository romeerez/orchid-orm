# 错误处理

`Orchid ORM` 和查询构建器 `pqb` 可能会抛出两类错误（可以从 `orchid-orm` 导入）：

`OrchidOrmError` - 可以暴露给用户，目前只有 `NotFoundError` 继承自它。

`OrchidOrmInternalError` - 不应暴露给用户，包含以下子类：

- `QueryError` - 包装数据库错误，参见[下文](#数据库错误)。
- `MoreThanOneRowError` - 可能由 `upsert` 和 `orCreate` 方法抛出，因为它们期望找到 0 或 1 条记录。
- `UnhandledTypeError` - 内部错误，不应发生，表示库中存在 bug。

## 全局错误处理

当使用 `find`、`findBy`、`take`、`get` 时，如果未找到记录，ORM 将抛出 `NotFoundError`。

这是唯一可以安全暴露给用户的 ORM 错误。

以下是集中式错误处理器的示例：

```ts
import { ZodError } from 'zod';
import { ValiError } from 'valibot';
import { NotFoundError } from 'orchid-orm';

// 通用错误类，应用程序代码将使用它来抛出错误
export class AppError extends Error {
  constructor(message?: string) {
    super(message);
  }
}

// 更具体的错误类继承自 AppError
export class SomeSpecificError extends AppError {
  message = '发生了一些具体错误';
}

export const performSomeAction = () => {
  // 当错误可以暴露给用户时，使用 AppError
  throw new AppError('哎呀');

  // 否则，使用标准 Error
  throw new Error('内部错误');
};

// express.js 错误处理器
app.use((err, req, res, next) => {
  // 记录错误
  console.error(err);

  // 如果是 AppError，则可以暴露给用户
  if (err instanceof AppError) {
    // 客户端不关心错误状态，统一返回 400
    return res.status(400).send({
      error: err.message,
    });
  }

  // 默认消息为：记录未找到
  if (err instanceof NotFoundError) {
    return res.status(400).send({
      error: err.message,
    });
  }

  // 捕获 Zod 错误
  if (err instanceof ZodError) {
    return res.status(400).send({
      // 序列化验证错误
    });
  }

  if (err instanceof ValiError) {
    return res.status(400).send({
      error: err.issues.map((iss) => iss.message).join('. '),
    });
  }

  res.status(500).send('服务器内部错误！');
});
```

::: info
给 express.js 用户的提示：

express.js 仍然不支持异步错误处理，因此你需要安装类似 [这个](https://www.npmjs.com/package/express-async-errors) 的包，
或者编写自定义的辅助函数/包装器来捕获异步路由的错误，或者在每个路由中编写样板式的 try-catch。

或者切换到现代框架 😅
:::

## 数据库错误

查询错误的堆栈跟踪指向库的内部实现，此外它们还有一个 `cause` 属性 -
这是一个嵌套错误，堆栈跟踪指向启动查询的代码位置。

错误类具有与 `pg` 模块错误相同的属性，以及一些额外的属性，具体如下。

执行查询时抛出的所有错误都包装在特定于表的错误类中。

所有表都有一个 `error` 属性，可以用来判断错误是否属于该表。

假设我们要保存一个新用户，并希望处理可能的唯一性冲突。

我们可以为此执行 4 个数据库查询：

- 开始事务（以避免竞争条件）
- 查询是否已存在该用户
- 保存用户
- 提交事务

或者，只需一个查询即可，我们只需要处理错误：

```ts
try {
  await db.table.create(...data);
} catch (error) {
  if (error instanceof db.table.error) {
    // 如果是唯一性冲突错误
    // 当唯一列的值已存在时
    if (error.isUnique) {
      // columns 的类型为 { [列名]?: true }
      // 使用它来确定哪些列违反了唯一性
      if (error.columns.username) {
        throw new Error('用户名已被占用');
      }
      if (error.columns.email) {
        throw new Error('邮箱已被占用');
      }
    }
  }

  // 如果错误未被识别，则重新抛出
  throw error;
}
```

表接口上的错误类继承自通用的 `QueryError`，
它具有与 `pg` 的 `DatabaseError` 相同的所有属性。
