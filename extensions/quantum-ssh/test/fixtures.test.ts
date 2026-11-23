/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import fse from '@zokugun/fs-extra-plus/sync';
import { xtryAsync } from '@zokugun/xtry/sync';
import { vol } from 'memfs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RemoteSSHResolver, SSHConfiguration, getRemoteAuthority } from './rewires/remote';
import { Log } from './mocks/logger';
import * as vscode from './mocks/vscode';
import { runDocker } from './utils/run-docker';
import { getMappedPort } from './utils/get-mapped-port';
import { waitForSSHReady } from './utils/wait-for-ssh-ready';
import SSHConfig from 'ssh-config';
import { defaultSSHConfigPath } from '../src/ssh/sshConfig';

const ROOT = fse.join('.', 'test', 'fixtures', 'default');
const SERVER_SETUP_BASH = fse.readFile('./src/scripts/server-setup.sh', 'utf8').value!;
const SERVER_SETUP_POWERSHELL = fse.readFile('./src/scripts/server-setup.ps1', 'utf8').value!;

type TestDocument = {
  name: string;
  client: {
    files: Record<string, string>;
  };
  server: {
    image: string;
    username: string;
    password: string;
    platform?: 'linux' | 'windows';
  };
  run?: {
    onlyInCI?: boolean;
  };
  test?: {
    either?: string[] | string;
    error?: string[] | string;
    // The hosts the SSH config is expected to have.
    hosts?: string[];
    output?: string[] | string;
  };
};

const files = fse.walk(ROOT, {
  absolute: true,
  onlyFiles: true,
  collect: true,
  filter: (item) => item.path.endsWith('.json'),
});

if (files.fails) {
  throw files.error;
}

for (const file of files.value) {
  const content = fse.readFile(file.path, 'utf8');
  if (content.fails) {
    throw content.error;
  }

  const documents = JSON.parse(content.value) as TestDocument[];

  for (const { name, client, server, test, run } of documents) {
    const containerName = `quantum-ssh-test-${randomUUID()}`;

    if (run?.onlyInCI && !process.env.CI) {
      continue;
    }

    if ((server.platform === 'windows') !== (process.platform === 'win32')) {
      continue;
    }

    describe(name, async () => {
      let hostPort: number | undefined;

      beforeAll(async () => {
        vol.reset();

        if(!server.image.startsWith('local-')) {
          runDocker(['pull', server.image]);
        }

        runDocker(['rm', '-f', containerName], true);

        runDocker([
          'run',
          '--detach',
          '--rm',
          '--name',
          containerName,
          '--publish',
          '2222',
          '--env',
          `USER_NAME=${server.username}`,
          '--env',
          `USER_PASSWORD=${server.password}`,
          '--env',
          'PASSWORD_ACCESS=true',
          '--env',
          'SUDO_ACCESS=false',
          '--env',
          'LOG_STDOUT=true',
          server.image,
        ]);

        hostPort = getMappedPort(containerName);

        await waitForSSHReady(server.username, server.password, hostPort, 60_000, containerName);
      }, 120_000);

      afterAll(() => {
        runDocker(['rm', '-f', containerName], true);
      }, 120_000);

      it(`test-${name}`, async () => {
        const sshConfig = SSHConfig.parse(`
  Host *
    Port ${hostPort}
    User ${server.username}
    Password ${server.password}
  `);

        vol.fromJSON({
          ...client.files,
          [defaultSSHConfigPath]: sshConfig.toString(),
          '/data/quantum/extensions/quantum-ssh/out/scripts/server-setup.sh': SERVER_SETUP_BASH,
          '/data/quantum/extensions/quantum-ssh/out/scripts/server-setup.ps1': SERVER_SETUP_POWERSHELL,
        });

        vscode.window.setPassword(server.password);

        if (test?.hosts) {
          const config = await SSHConfiguration.loadFromFS();

          expect(config.getAllConfiguredHosts()).to.eql(test.hosts);
        }

        const logger = new Log('Quantum SSH');
        const extContext = new vscode.ExtensionContext();
        const remoteSSHResolver = new RemoteSSHResolver(extContext, logger);
        const remoteContext = new vscode.RemoteAuthorityResolverContext();
        const authority = getRemoteAuthority('test');
        const expectedMessages = test?.error || test?.output || test?.either;

        if (expectedMessages) {
          logger.capture();
        }

        if (test?.error || test?.either) {
          const result = await xtryAsync(async () => await remoteSSHResolver.resolve(authority, remoteContext));

          if (test?.error) {
            expect(result.fails).toBe(true);
          }
        } else {
          const result = await remoteSSHResolver.resolve(authority, remoteContext);

          expect(result).toBeDefined();
          expect(result.host).to.eql('127.0.0.1');
        }

        if (expectedMessages) {
          const messages = logger.messages();

          if (Array.isArray(expectedMessages)) {
            for (const message of expectedMessages) {
              expect(messages).to.contains(message);
            }
          } else {
            if (!messages.includes(expectedMessages)) {
              console.log(messages);
            }

            expect(messages).to.contains(expectedMessages);
          }
        }
      }, 60_000);
    });
  }
}
