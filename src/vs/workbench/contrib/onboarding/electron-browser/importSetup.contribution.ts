/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';

type EditorSetupId = 'vscode' | 'cursor' | 'windsurf';

interface IEditorSetupPaths {
	userData: URI;
	extensions: URI;
}

function getEditorSetupPaths(
	id: EditorSetupId,
	environmentService: INativeEnvironmentService,
): IEditorSetupPaths | undefined {
	const home = environmentService.userHome;
	const appData = isMacintosh
		? joinPath(home, 'Library', 'Application Support')
		: isLinux
			? joinPath(home, '.config')
			: isWindows
				? joinPath(home, 'AppData', 'Roaming')
				: undefined;

	if (!appData) {
		return undefined;
	}

	const appDirectory = id === 'vscode' ? 'Code' : id === 'cursor' ? 'Cursor' : 'Windsurf';
	const extensionDirectory = id === 'vscode' ? '.vscode' : `.${id}`;
	return {
		userData: joinPath(appData, appDirectory, 'User'),
		extensions: joinPath(home, extensionDirectory, 'extensions'),
	};
}

async function migrateEditorSetup(
	accessor: ServicesAccessor,
	id: unknown,
): Promise<void> {
	if (id !== 'vscode' && id !== 'cursor' && id !== 'windsurf') {
		throw new Error('Unsupported editor setup source.');
	}

	const fileService = accessor.get(IFileService);
	const environmentService = accessor.get(INativeEnvironmentService);
	const logService = accessor.get(ILogService);
	const source = getEditorSetupPaths(id, environmentService);
	if (!source) {
		throw new Error('Migration paths are not supported on this platform.');
	}

	const target = environmentService.appSettingsHome;
	for (const file of ['settings.json', 'keybindings.json', 'snippets']) {
		const sourceFile = joinPath(source.userData, file);
		if (await fileService.exists(sourceFile)) {
			logService.info(`[Migration] Copying ${file} from ${sourceFile.fsPath}`);
			await fileService.copy(sourceFile, joinPath(target, file), true);
		}
	}

	if (await fileService.exists(source.extensions)) {
		logService.info(`[Migration] Copying extensions from ${source.extensions.fsPath}`);
		await fileService.copy(
			source.extensions,
			URI.file(environmentService.extensionsPath),
			true,
		);
	}
}

CommandsRegistry.registerCommand(
	'workbench.action.importEditorSetup',
	(accessor, id: unknown) => migrateEditorSetup(accessor, id),
);
