/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 100;

import glob from 'glob';
import gulp from 'gulp';
import { createRequire } from 'node:module';
import path from 'path';
import { promises as fs } from 'fs';
import { monacoTypecheckTask /* , monacoTypecheckWatchTask */ } from './gulpfile.editor.ts';
import { compileExtensionMediaTask, compileExtensionsTask, watchExtensionsTask } from './gulpfile.extensions.ts';
import { compileAgentTask, watchAgentTask } from './gulpfile.agent.ts';
import * as compilation from './lib/compilation.ts';
import * as task from './lib/task.ts';
import * as util from './lib/util.ts';
import { runEsbuildTranspile } from './lib/esbuild.ts';

// Extension point names
gulp.task(compilation.compileExtensionPointNamesTask);

const require = createRequire(import.meta.url);
const root = path.dirname(import.meta.dirname);

async function rimrafOutPreservingAgent(): Promise<void> {
	const outPath = path.join(root, 'out');
	const preservedPaths = ['agent', 'agent-packages'].map(name => {
		return {
			name,
			source: path.join(outPath, name),
			preserved: path.join(root, `.preserve-${name}-${process.pid}-${Date.now()}`)
		};
	});

	for (const entry of preservedPaths) {
		try {
			await fs.rename(entry.source, entry.preserved);
		} catch (error) {
			const code = (error as { code?: string } | undefined)?.code;
			if (code !== 'ENOENT') {
				throw error;
			}
		}
	}

	await util.rimraf('out')();
	await fs.mkdir(outPath, { recursive: true });
	for (const entry of preservedPaths) {
		try {
			await fs.rename(entry.preserved, entry.source);
		} catch (error) {
			const code = (error as { code?: string } | undefined)?.code;
			if (code !== 'ENOENT') {
				throw error;
			}
		}
	}
}

// API proposal names
gulp.task(compilation.compileApiProposalNamesTask);
gulp.task(compilation.watchApiProposalNamesTask);

// Client Transpile
gulp.task(task.define('transpile-client-esbuild', task.series(
	compilation.copyCodiconsTask,
	task.define('esbuild-out-build', () => runEsbuildTranspile('out', false)),
)));

// Fast compile for development time
const compileClientTask = task.define('compile-client', task.series(rimrafOutPreservingAgent, compilation.copyCodiconsTask, compilation.compileApiProposalNamesTask, compilation.compileExtensionPointNamesTask, compilation.compileTask('src', 'out', false), compilation.compileElectronPreloadsTask));
gulp.task(compileClientTask);

// Transpile only
const transpileClientTask = task.define('transpile-client', task.series(rimrafOutPreservingAgent, compilation.transpileTask('src', 'out'), compilation.compileElectronPreloadsTask));
gulp.task(transpileClientTask);

const watchClientTask = task.define('watch-client', task.parallel(compilation.watchTypeCheckTask('src'), compilation.watchApiProposalNamesTask, compilation.watchExtensionPointNamesTask, compilation.watchCodiconsTask));
gulp.task(watchClientTask);

// All
const _compileTask = task.define('compile', task.series(
	compileClientTask,
	task.parallel(monacoTypecheckTask, compileExtensionsTask, compileExtensionMediaTask, compileAgentTask)
));
gulp.task(_compileTask);

gulp.task(task.define('watch', task.parallel(/* monacoTypecheckWatchTask, */ watchClientTask, watchExtensionsTask, watchAgentTask)));

// Default
gulp.task('default', _compileTask);

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
	process.exit(1);
});

// Load all the gulpfiles only if running tasks other than the editor tasks
glob.sync('gulpfile.*.ts', { cwd: import.meta.dirname })
	.forEach(f => {
		return require(`./${f}`);
	});
