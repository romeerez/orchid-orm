const assert = require('node:assert/strict');
const test = require('node:test');

const {
  listTopOptimizations,
  meanStats,
  parseOptimizations,
  topOptimizationsFile,
} = require('./top-type-optims.js');

const sample = `### 1. Small Trick

**stats**: {
  "0-100": 2
}

**when**: small case

### 2. Large Trick

**stats**: {
  "1001-2000": 1
}

**when**: large case

### 3. No Data

**stats**: {}

**when**: unknown case
`;

test('meanStats uses bucket midpoints weighted by counts', () => {
  assert.equal(meanStats({ '0-100': 1, '101-200': 1 }), 100.25);
});

test('meanStats supports negative regression buckets', () => {
  assert.equal(meanStats({ '-0-100': 1, '-101-200': 1 }), -100.25);
});

test('parseOptimizations extracts numbers, titles, and stats', () => {
  assert.deepEqual(parseOptimizations(sample), [
    { number: 1, title: 'Small Trick', stats: { '0-100': 2 } },
    { number: 2, title: 'Large Trick', stats: { '1001-2000': 1 } },
    { number: 3, title: 'No Data', stats: {} },
  ]);
});

test('listTopOptimizations sorts by descending mean stats and keeps empty stats last', () => {
  assert.deepEqual(listTopOptimizations(sample), [
    '2. Large Trick',
    '1. Small Trick',
    '3. No Data',
  ]);
});

test('topOptimizationsFile reads through injected fs methods', () => {
  const fsMock = {
    readFileSync(path, encoding) {
      assert.equal(path, '/tmp/type-optim.md');
      assert.equal(encoding, 'utf8');
      return sample;
    },
  };

  assert.equal(
    topOptimizationsFile({ fs: fsMock, filePath: '/tmp/type-optim.md' }),
    '2. Large Trick\n1. Small Trick\n3. No Data',
  );
});
