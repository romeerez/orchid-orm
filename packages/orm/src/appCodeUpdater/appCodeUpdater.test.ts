jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

// const updater = appCodeUpdater({
//   tablePath: (tableName) => `tables/${tableName}.ts`,
//   mainFilePath: 'db.ts',
// });

describe('appCodeUpdater', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // describe('table', () => {
  // it.only('should add table', async () => {
  //   const ast: RakeDbAst.Table = {
  //     type: 'table',
  //     action: 'create',
  //     name: 'table',
  //     shape: {
  //       id: columnTypes.serial().primaryKey(),
  //     },
  //     noPrimaryKey: 'ignore',
  //     indexes: [],
  //     foreignKeys: [],
  //   };
  //
  //   await updater(ast);
  // });
  // });
});
