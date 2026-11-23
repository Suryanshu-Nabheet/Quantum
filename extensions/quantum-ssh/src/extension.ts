/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as os from 'os';
import { Log } from './common/logger';
import { RemoteSSHResolver, REMOTE_SSH_AUTHORITY } from './authResolver';
import { openSSHConfigFile, promptOpenSshWindow } from './commands';
import { HostTreeDataProvider } from './hostTreeView';
import { getRemoteWorkspaceLocationData, RemoteLocationHistory } from './remoteLocationHistory';

export async function activate(context: vscode.ExtensionContext) {
    const extensionId = context.extension.id;
    const packageJSON = context.extension.packageJSON;

    const logger = new Log('Quantum SSH');
    context.subscriptions.push(logger);

    logger.info(`${extensionId}/${packageJSON.version} (${os.release()} ${os.platform()} ${os.arch()}) Quantum/${vscode.version} (${vscode.env.appName})`);

    const remoteSSHResolver = new RemoteSSHResolver(context, logger);
    context.subscriptions.push(vscode.workspace.registerRemoteAuthorityResolver(REMOTE_SSH_AUTHORITY, remoteSSHResolver));
    context.subscriptions.push(remoteSSHResolver);

    const locationHistory = new RemoteLocationHistory(context);
    const locationData = getRemoteWorkspaceLocationData();
    if (locationData) {
        await locationHistory.addLocation(locationData[0], locationData[1]);
    }

    const hostTreeDataProvider = new HostTreeDataProvider(locationHistory);
    context.subscriptions.push(vscode.window.createTreeView('quantumSshHosts', { treeDataProvider: hostTreeDataProvider }));
    context.subscriptions.push(hostTreeDataProvider);

    context.subscriptions.push(vscode.commands.registerCommand('quantum.ssh.openEmptyWindow', () => promptOpenSshWindow(false)));
    context.subscriptions.push(vscode.commands.registerCommand('quantum.ssh.openEmptyWindowInCurrentWindow', () => promptOpenSshWindow(true)));
    context.subscriptions.push(vscode.commands.registerCommand('quantum.ssh.openConfigFile', () => openSSHConfigFile()));
    context.subscriptions.push(vscode.commands.registerCommand('quantum.ssh.showLog', () => logger.show()));
}

export function deactivate() {
}
