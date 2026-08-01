#!/usr/bin/env -S node --experimental-strip-types

const fs = require('node:fs');
const path = require('node:path');

function bucketMean(bucket) {
  const match = /^(-?)(\d+)-(\d+)$/.exec(bucket);

  if (!match) {
    throw new Error(`Invalid bucket: ${bucket}`);
  }

  const sign = match[1] ? -1 : 1;

  return sign * ((Number(match[2]) + Number(match[3])) / 2);
}

function meanStats(stats) {
  let sum = 0;
  let count = 0;

  for (const [bucket, bucketCount] of Object.entries(stats)) {
    sum += bucketMean(bucket) * bucketCount;
    count += bucketCount;
  }

  return count ? sum / count : Number.NEGATIVE_INFINITY;
}

function parseOptimizations(contents) {
  const pattern =
    /^###\s*(\d+)\.\s*([^\n]+)[\s\S]*?\n\*\*stats\*\*:\s*({[\s\S]*?})/gm;
  const optimizations = [];

  for (const match of contents.matchAll(pattern)) {
    optimizations.push({
      number: Number(match[1]),
      title: match[2].trim(),
      stats: JSON.parse(match[3]),
    });
  }

  return optimizations;
}

function listTopOptimizations(contents) {
  return parseOptimizations(contents)
    .map((optimization, index) => ({
      ...optimization,
      index,
      mean: meanStats(optimization.stats),
    }))
    .sort((a, b) => b.mean - a.mean || a.index - b.index)
    .map(({ number, title }) => `${number}. ${title}`);
}

function topOptimizationsFile({
  fs: fsModule = fs,
  filePath = path.join(__dirname, 'type-optim.md'),
} = {}) {
  return listTopOptimizations(fsModule.readFileSync(filePath, 'utf8')).join(
    '\n',
  );
}

function main() {
  process.stdout.write(`${topOptimizationsFile()}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  bucketMean,
  listTopOptimizations,
  meanStats,
  parseOptimizations,
  topOptimizationsFile,
};
