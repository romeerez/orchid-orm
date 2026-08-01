const assert = require('node:assert/strict');
const test = require('node:test');

const {
  bucketForDiff,
  updateOptimizationStats,
  updateStatsFile,
} = require('./update-type-optim-stats.js');

const sample = `### 1. First Trick

**stats**: {}

**when**: first case

### 2. Second Trick

**stats**: {
  "0-100": 1
}

**when**: second case
`;

test('bucketForDiff creates granular low buckets and growing higher buckets', () => {
  assert.equal(bucketForDiff(0), '0-100');
  assert.equal(bucketForDiff(100), '0-100');
  assert.equal(bucketForDiff(101), '101-200');
  assert.equal(bucketForDiff(450), '201-500');
  assert.equal(bucketForDiff(1200), '1001-2000');
  assert.equal(bucketForDiff(6200), '5001-10000');
});

test('bucketForDiff supports negative regression buckets', () => {
  assert.equal(bucketForDiff(-1), '-0-100');
  assert.equal(bucketForDiff(-450), '-201-500');
  assert.equal(bucketForDiff(-6200), '-5001-10000');
});

test('updateOptimizationStats updates only the selected optimization stats', () => {
  const updated = updateOptimizationStats(sample, 2, 450);

  assert.match(updated, /\*\*stats\*\*: \{\}/);
  assert.match(
    updated,
    /### 2\. Second Trick[\s\S]*\*\*stats\*\*: \{\n  "0-100": 1,\n  "201-500": 1\n\}/,
  );
});

test('updateOptimizationStats records negative diffs', () => {
  const updated = updateOptimizationStats(sample, 2, -450);

  assert.match(
    updated,
    /### 2\. Second Trick[\s\S]*\*\*stats\*\*: \{\n  "0-100": 1,\n  "-201-500": 1\n\}/,
  );
});

test('updateStatsFile reads and writes through injected fs methods', () => {
  const writes = [];
  const fsMock = {
    readFileSync(path, encoding) {
      assert.equal(path, '/tmp/type-optim.md');
      assert.equal(encoding, 'utf8');
      return sample;
    },
    writeFileSync(path, contents) {
      writes.push([path, contents]);
    },
  };

  updateStatsFile({
    fs: fsMock,
    filePath: '/tmp/type-optim.md',
    optimizationNumber: 1,
    diff: 64,
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/tmp/type-optim.md');
  assert.match(
    writes[0][1],
    /### 1\. First Trick[\s\S]*\*\*stats\*\*: \{\n  "0-100": 1\n\}/,
  );
});
