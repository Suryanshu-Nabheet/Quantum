/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import es from 'event-stream';
import * as fs from 'fs';
import * as path from 'path';
import gulp from 'gulp';
import fancyLog from 'fancy-log';
import * as task from './lib/task.ts';

const root = path.dirname(import.meta.dirname);
const agentRoot = path.join(root, 'src/vs/workbench/contrib/agent');
const agentPackagesOutRoot = path.join(root, 'out/agent-packages');
const requiredAgentPackages = ['config-types', 'fetch', 'llm-info', 'agent-config', 'openai-adapters', 'terminal-security'];

function newestMtime(pathToCheck: string): number {
	const stat = fs.statSync(pathToCheck);
	if (!stat.isDirectory()) {
		return stat.mtimeMs;
	}

	let newest = stat.mtimeMs;
	for (const entry of fs.readdirSync(pathToCheck, { withFileTypes: true })) {
		if (entry.name === 'node_modules') {
			continue;
		}
		newest = Math.max(newest, newestMtime(path.join(pathToCheck, entry.name)));
	}
	return newest;
}

function agentPackagesBuilt(): boolean {
	for (const name of requiredAgentPackages) {
		const builtIndex = path.join(agentPackagesOutRoot, name, 'index.js');
		if (!fs.existsSync(builtIndex)) {
			return false;
		}
		if (!fs.existsSync(path.join(agentPackagesOutRoot, name, 'node_modules'))) {
			return false;
		}
		const packageRoot = path.join(agentRoot, 'packages', name);
		const newestSource = Math.max(
			newestMtime(path.join(packageRoot, 'src')),
			newestMtime(path.join(packageRoot, 'package.json')),
			newestMtime(path.join(packageRoot, 'tsconfig.json'))
		);
		if (newestSource > fs.statSync(builtIndex).mtimeMs) {
			return false;
		}
	}
	return true;
}

async function cleanAgentSourceGeneratedArtifacts(): Promise<void> {
	const generatedPaths = [
		'build',
		'bin',
		'out',
		'webview',
		'gui/dist',
		'core/dist',
		'packages/config-types/dist',
		'packages/fetch/dist',
		'packages/llm-info/dist',
		'packages/agent-config/dist',
		'packages/openai-adapters/dist',
		'packages/terminal-security/dist'
	];
	const repoGeneratedPaths = [
		path.join(root, 'out/agent/meta'),
	];

	await Promise.all(generatedPaths.map(async relativePath => {
		await fs.promises.rm(path.join(agentRoot, relativePath), { recursive: true, force: true });
	}));
	await Promise.all(repoGeneratedPaths.map(async absolutePath => {
		await fs.promises.rm(absolutePath, { recursive: true, force: true });
	}));
}

function runNodeScript(scriptName: string, args: string[] = [], env: NodeJS.ProcessEnv = {}): Promise<void> {
	return new Promise((resolve, reject) => {
		const scriptPath = path.join(agentRoot, 'scripts', scriptName);
		if (!fs.existsSync(scriptPath)) {
			reject(new Error(`Agent script not found: ${scriptPath}`));
			return;
		}

		fancyLog(`[agent] node scripts/${scriptName} ${args.join(' ')}`.trim());

		const child = cp.spawn(process.execPath, [scriptPath, ...args], {
			cwd: agentRoot,
			stdio: 'inherit',
			env: { ...process.env, ...env },
		});

		child.on('error', reject);
		child.on('exit', code => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Agent script ${scriptName} exited with code ${code ?? 'unknown'}`));
			}
		});
	});
}

function spawnWatchProcess(scriptName: string, label: string, args: string[] = []): cp.ChildProcess {
	const scriptPath = path.join(agentRoot, 'scripts', scriptName);
	fancyLog(`[agent] watching ${label} (scripts/${scriptName} ${args.join(' ')}`.trim() + ')');
	return cp.spawn(process.execPath, [scriptPath, ...args], {
		cwd: agentRoot,
		stdio: 'inherit',
		env: { ...process.env, SKIP_INSTALLS: 'true' },
	});
}

export async function compileAgentExtension(): Promise<void> {
	if (!agentPackagesBuilt()) {
		await runNodeScript('build-packages.js');
	}
	await runNodeScript('ensure-webview.js');
	await runNodeScript('esbuild.js', ['--sourcemap'], { SKIP_INSTALLS: 'true' });
	await runNodeScript('copy-native-assets.js');
	await cleanAgentSourceGeneratedArtifacts();
}

function watchAgentExtension(): NodeJS.ReadWriteStream {
	const stream = es.through();

	void (async () => {
		try {
			if (!agentPackagesBuilt()) {
				await runNodeScript('build-packages.js');
			}
			await runNodeScript('ensure-webview.js');
			await runNodeScript('copy-native-assets.js');

			fancyLog('[agent] watching extension (esbuild) + GUI (vite) + packages + native assets');

			const esbuildWatch = spawnWatchProcess('esbuild.js', 'extension', ['--sourcemap', '--watch']);
			const guiChild = spawnWatchProcess('watch-gui.js', 'GUI');
			const packagesChild = spawnWatchProcess('watch-packages.js', 'packages');

			const onChildExit = (name: string, code: number | null) => {
				if (code !== 0 && code !== null) {
					stream.emit('error', new Error(`Agent ${name} watch exited with code ${code}`));
				}
			};

			esbuildWatch.on('error', err => stream.emit('error', err));
			guiChild.on('error', err => stream.emit('error', err));
			packagesChild.on('error', err => stream.emit('error', err));
			esbuildWatch.on('exit', code => onChildExit('extension', code));
			guiChild.on('exit', code => onChildExit('GUI', code));
			packagesChild.on('exit', code => onChildExit('packages', code));
		} catch (err) {
			stream.emit('error', err);
		}
	})();

	return stream;
}

const compileAgentTask = task.define('compile-agent', () => compileAgentExtension());
gulp.task(compileAgentTask);

const watchAgentTask = task.define('watch-agent', () => watchAgentExtension());
gulp.task(watchAgentTask);

export { compileAgentTask, watchAgentTask };
