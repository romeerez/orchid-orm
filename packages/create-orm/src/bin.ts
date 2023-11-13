#!/usr/bin/env node

import { getConfig, init, greetAfterInstall } from './lib';

getConfig().then(
  (config) => config && init(config).then(() => greetAfterInstall(config)),
);
