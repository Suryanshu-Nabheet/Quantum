/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vi } from 'vitest';
import * as vscode from 'vscode';

type ProgressTask = <R>(progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<R>;

let $password: string = '';
let $warningAnswer: string | undefined = undefined;
let $config: Record<string, unknown> = {};
let $rootDir: string | undefined = undefined;

function setRootDir(path: string) {
    $rootDir = path;
}

const DEFAULT_CONFIG: Record<string, unknown> = {
    verifyKnownHosts: 'accept',
    verifyUnknownHosts: 'accept',
};

const commands = {
    executeCommand: vi.fn(),
};

const env = {
    get appRoot(): string {
        if ($rootDir) {
            return `${$rootDir}/quantum/app`;
        }
        return '/bin/quantum/app';
    }
};

class Uri {
    private constructor(
        private path: string
    ) {}

    static file(path: string): Uri {
        return new Uri(path);
    }

    get fsPath(): string {
        return this.path;
    }
}

class ExtensionContext {
    get extensionPath(): string {
        if ($rootDir) {
            return `${$rootDir}/quantum/extensions/quantum-ssh`;
        }
        return '/data/quantum/extensions/quantum-ssh';
    }

    get globalStorageUri(): Uri {
        if ($rootDir) {
            return Uri.file(`${$rootDir}/quantum/config/user/quantum-ssh`);
        }
        return Uri.file('/data/quantum/config/user/quantum-ssh');
    }

    extension = {
        id: 'quantum.quantum-ssh',
        packageJSON: {
            name: 'quantum-ssh',
            version: '0.5.2',
            publisher: 'quantum',
        }
    };

    environmentVariableCollection = {
        persistent: false,
        replace: vi.fn(),
    };
}

enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15
}

class RemoteAuthorityResolverContext {
    resolveAttempt = 0;
}

class RemoteAuthorityResolverError extends Error {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static NotAvailable(message?: string, _handled?: boolean): RemoteAuthorityResolverError {
        return new RemoteAuthorityResolverError(message ?? 'NotAvailable');
    }

    static TemporarilyNotAvailable(message?: string): RemoteAuthorityResolverError {
        return new RemoteAuthorityResolverError(message ?? 'TemporarilyNotAvailable');
    }

    constructor(message?: string) {
        super(message);
    }
}

class ResolvedAuthority {
    constructor(readonly host: string, readonly port: number, readonly connectionToken?: string) {
    }
}

const version = '1.126.04524';

const window = {
    createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        show: vi.fn(),
        dispose: vi.fn()
    })),
    setPassword: (password: string) => {
        $password = password;
    },
    setWarningAnswer: (answer: string | undefined) => {
        $warningAnswer = answer;
    },
    showWarningMessage: vi.fn(async (_message: string, _options?: vscode.MessageOptions, ...items: string[]) => {
        return $warningAnswer !== undefined && items.includes($warningAnswer) ? $warningAnswer : undefined;
    }),
    showErrorMessage: vi.fn(async () => undefined),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    showInputBox: async (options?: vscode.InputBoxOptions, _token?: vscode.CancellationToken) => {
        if(options?.title?.startsWith('Enter password for') || options?.title?.startsWith('SSH Authentication')) {
            return $password;
        }

        return undefined;
    },

    withProgress: (_options: vscode.ProgressOptions, task: ProgressTask) => {
        const mockProgressReporter = {
            report: vi.fn(),
            then: vi.fn(),
        };

        return task(mockProgressReporter, {} as unknown) as Promise<unknown>;
    },
};

const workspace = {
    getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, defaultValue?: unknown) => (key in $config ? $config[key] : DEFAULT_CONFIG[key] ?? defaultValue)),
        update: vi.fn(() => Promise.resolve())
    })),
    registerResourceLabelFormatter: vi.fn(),
    resetConfiguration: () => {
        $config = {};
    },
    setConfiguration: (key: string, value: unknown) => {
        $config[key] = value;
    },
};

export {
    commands,
    env,
    ExtensionContext,
    ProgressLocation,
    RemoteAuthorityResolverContext,
    RemoteAuthorityResolverError,
    ResolvedAuthority,
    window,
    version,
    workspace,
    setRootDir
};
