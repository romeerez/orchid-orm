import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupTSConfig(config: InitConfig): Promise<void> {
  if (config.hasTsConfig) return;

  const module = config.runner === 'ts-node' ? 'commonjs' : 'esnext';
  const moduleResolution =
    config.runner === 'ts-node'
      ? ''
      : `
    "moduleResolution": "bundler",`;

  const types = config.runner === 'vite-node' ? `["vite/client"]` : undefined;

  const tsConfigPath = join(config.path, 'tsconfig.json');
  await fs.writeFile(
    tsConfigPath,
    `{
  "compilerOptions": {${
    config.runner === 'ts-node'
      ? `
    "outDir": "dist",`
      : ''
  }
    "target": "es2020",
    "module": "${module}",${moduleResolution}
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true${
      types
        ? `,
    "types": ${types}`
        : ''
    }
  }
}
`,
  );
}
