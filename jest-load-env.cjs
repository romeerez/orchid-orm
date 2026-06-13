const path = require('path');
const dotenv = require('dotenv');
const { TextDecoder, TextEncoder } = require('node:util');
const { webcrypto } = require('node:crypto');
const { URL, URLSearchParams } = require('node:url');

dotenv.config({
  path: path.resolve(__dirname, '.env'),
});

// Bun exposes these APIs in the process global scope, but they are missing from
// Jest's VM when running tests with `bun --bun jest`. Keep this in `setupFiles`
// so dependencies that read globals during top-level imports, such as `pg`, see
// the same runtime APIs they have in Node.js.
if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder;
}

if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = TextDecoder;
}

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

if (!globalThis.URL) {
  globalThis.URL = URL;
}

if (!globalThis.URLSearchParams) {
  globalThis.URLSearchParams = URLSearchParams;
}

if (!globalThis.queueMicrotask) {
  globalThis.queueMicrotask = (callback) => {
    Promise.resolve()
      .then(callback)
      .catch((error) => {
        setTimeout(() => {
          throw error;
        }, 0);
      });
  };
}
