/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  oxc: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      vscode: resolve(__dirname, './test/mocks/vscode.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['./test/**/*.test.ts'],
    reporters: 'dot',
    typecheck: {
      enabled: true,
    },
    coverage: {
      reporter: ['html'],
      reportsDirectory: './coverage',
    },
  },
});
