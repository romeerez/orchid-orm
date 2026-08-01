#!/usr/bin/env -S node --experimental-strip-types

const fs = require('node:fs');
const path = require('node:path');

function bucketForDiff(diff) {
  const value = Number(diff);

  if (!Number.isFinite(value)) {
    throw new Error('Diff must be a finite number');
  }

  const prefix = value < 0 ? '-' : '';
  const absolute = Math.abs(value);

  if (absolute <= 100) {
    return `${prefix}0-100`;
  }

  let previous = 100;
  let power = 100;

  while (true) {
    for (const multiplier of [2, 5, 10]) {
      const upper = multiplier * power;

      if (absolute <= upper) {
        return `${prefix}${previous + 1}-${upper}`;
      }

      previous = upper;
    }

    power *= 10;
  }
}

function formatStats(stats) {
  const entries = Object.entries(stats);

  if (!entries.length) {
    return '{}';
  }

  return `{\n${entries.map(([bucket, count]) => `  ${JSON.stringify(bucket)}: ${count}`).join(',\n')}\n}`;
}

function updateOptimizationStats(contents, optimizationNumber, diff) {
  const bucket = bucketForDiff(diff);
  const number = Number(optimizationNumber);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error('Optimization number must be a positive integer');
  }

  const pattern = new RegExp(
    `(^###\\s*${number}\\.\\s*[\\s\\S]*?\\n\\*\\*stats\\*\\*:\\s*)({[\\s\\S]*?})`,
    'm',
  );

  let found = false;

  const updated = contents.replace(pattern, (match, prefix, statsJson) => {
    found = true;
    const stats = JSON.parse(statsJson);
    stats[bucket] = (stats[bucket] || 0) + 1;

    return `${prefix}${formatStats(stats)}`;
  });

  if (!found) {
    throw new Error(`Optimization ${number} not found`);
  }

  return updated;
}

function updateStatsFile({
  fs: fsModule = fs,
  filePath = path.join(__dirname, 'type-optim.md'),
  optimizationNumber,
  diff,
}) {
  const contents = fsModule.readFileSync(filePath, 'utf8');
  const updated = updateOptimizationStats(contents, optimizationNumber, diff);
  fsModule.writeFileSync(filePath, updated);
}

function main() {
  const [, , optimizationNumber, diff] = process.argv;

  if (!optimizationNumber || !diff) {
    console.error(
      'Usage: update-type-optim-stats.js <optimization-number> <instantiations-diff>',
    );
    process.exitCode = 1;
    return;
  }

  updateStatsFile({ optimizationNumber, diff });
}

if (require.main === module) {
  main();
}

module.exports = {
  bucketForDiff,
  updateOptimizationStats,
  updateStatsFile,
};
