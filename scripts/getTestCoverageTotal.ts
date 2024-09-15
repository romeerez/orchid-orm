import fs from 'fs';
import readline from 'readline';

const getFirstLine = async (path: string) => {
  const readable = fs.createReadStream(path);
  const reader = readline.createInterface({ input: readable });
  const line = await new Promise((resolve) => {
    reader.on('line', (line) => {
      reader.close();
      resolve(line);
    });
  });
  readable.close();
  return line;
};

const calculatePackageCoverage = async (name: string) => {
  const path = `packages/${name}/coverage/coverage-summary.json`;
  const data = JSON.parse(`${await getFirstLine(path)}}`);
  return data.total.statements.pct;
};

const main = async () => {
  const values = await Promise.all(
    [
      'core',
      'create-orm',
      'orm',
      'qb/pqb',
      'rake-db',
      'schemaConfigs/zod',
      'schemaConfigs/valibot',
      'test-factory',
    ].map(calculatePackageCoverage),
  );
  const value = values.reduce((acc, value) => acc + value, 0) / values.length;
  process.stdout.write(`${Math.floor(value * 100) / 100}%`);
};

main();
