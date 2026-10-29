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
const agentChildProcesses = new Set<cp.ChildProcess>();
const agentWatchRestartTimers = new Set<NodeJS.Timeout>();
let agentWatchStopping = false;
let agentWatchShutdownCode: number | undefined;

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

async function removeLegacyAgentBuildOutput(): Promise<void> {
	await Promise.all([
		path.join(root, 'out/agent/package.json'),
		path.join(root, 'out/agent/out/extension.js'),
		path.join(root, 'out/agent/out/extension.js.map'),
		path.join(root, 'out/agent/runtime/AgentRuntime.js.map'),
		path.join(root, 'out/agent/runtime/agentRuntimeWorker.js.map'),
		path.join(root, 'out/agent/runtime/agentRuntime.js'),
		path.join(root, 'out/agent/runtime/agentRuntime.js.map'),
		path.join(root, 'out/agent/out/node_modules/@vscode/ripgrep'),
		path.join(root, 'out/agent/out/node_modules/workerpool'),
	].map(output => fs.promises.rm(output, { force: true, recursive: true })));
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
		agentChildProcesses.add(child);

		child.on('error', reject);
		child.once('close', () => {
			agentChildProcesses.delete(child);
			finishAgentWatchShutdown();
		});
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

function finishAgentWatchShutdown(): void {
	if (agentWatchShutdownCode !== undefined && agentChildProcesses.size === 0) {
		process.exit(agentWatchShutdownCode);
	}
}

function stopAgentWatchers(signal: NodeJS.Signals, exitCode?: number): void {
	if (agentWatchStopping) {
		if (exitCode !== undefined) {
			agentWatchShutdownCode = exitCode;
			finishAgentWatchShutdown();
		}
		return;
	}

	agentWatchStopping = true;
	agentWatchShutdownCode = exitCode;
	for (const timer of agentWatchRestartTimers) {
		clearTimeout(timer);
	}
	agentWatchRestartTimers.clear();
	for (const child of agentChildProcesses) {
		if (child.exitCode === null && child.signalCode === null) {
			child.kill(signal);
		}
	}

	const forceStopTimer = setTimeout(() => {
		for (const child of agentChildProcesses) {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill('SIGKILL');
			}
		}
		finishAgentWatchShutdown();
	}, 4_000);
	forceStopTimer.unref();
	finishAgentWatchShutdown();
}

process.once('SIGINT', () => stopAgentWatchers('SIGINT', 130));
process.once('SIGTERM', () => stopAgentWatchers('SIGTERM', 143));

/**
 * Keep Agent build watchers alive with backoff, and retain ownership of their
 * processes so the IDE watch task can shut them down cleanly.
 */
function keepWatchProcessAlive(scriptName: string, label: string, args: string[] = []): void {
	let delayMs = 1_000;
	const maxDelayMs = 30_000;

	const launch = () => {
		if (agentWatchStopping) {
			return;
		}

		const child = spawnWatchProcess(scriptName, label, args);
		agentChildProcesses.add(child);
		let stableTimer: NodeJS.Timeout | undefined;
		child.on('error', err => {
			fancyLog.error(`[agent] ${label} watch failed to start: ${err}`);
		});
		child.once('close', (code, signal) => {
			agentChildProcesses.delete(child);
			if (agentWatchStopping) {
				finishAgentWatchShutdown();
				return;
			}
			if (stableTimer) {
				clearTimeout(stableTimer);
			}
			const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
			fancyLog.warn(`[agent] ${label} watch exited (${reason}); restarting in ${delayMs}ms`);
			scheduleRestart();
		});
		stableTimer = setTimeout(() => {
			delayMs = 1_000;
		}, 15_000);
		stableTimer.unref();
	};

	const scheduleRestart = () => {
		const wait = delayMs;
		delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.5));
		const timer = setTimeout(() => {
			agentWatchRestartTimers.delete(timer);
			launch();
		}, wait);
		timer.unref();
		agentWatchRestartTimers.add(timer);
	};

	launch();
}

export async function compileAgentRuntime(): Promise<void> {
	await removeLegacyAgentBuildOutput();
	if (!agentPackagesBuilt()) {
		await runNodeScript('build-packages.js');
	}
	await runNodeScript('ensure-webview.js');
	await runNodeScript('esbuild.js', ['--minify'], { SKIP_INSTALLS: 'true' });
	await runNodeScript('copy-native-assets.js');
	await cleanAgentSourceGeneratedArtifacts();
}

function watchAgentRuntime(): NodeJS.ReadWriteStream {
	const stream = es.through();
	agentWatchStopping = false;
	agentWatchShutdownCode = undefined;
	stream.once('close', () => stopAgentWatchers('SIGTERM'));

	void (async () => {
		try {
			await removeLegacyAgentBuildOutput();
			if (!agentPackagesBuilt()) {
				await runNodeScript('build-packages.js');
			}
			await runNodeScript('ensure-webview.js');
			await runNodeScript('copy-native-assets.js');

			fancyLog('[agent] watching native runtime (esbuild) + GUI (typecheck and Vite build) + packages + native assets');

			keepWatchProcessAlive('esbuild.js', 'native runtime', ['--sourcemap', '--watch']);
			keepWatchProcessAlive('watch-gui.js', 'GUI');
			keepWatchProcessAlive('watch-packages.js', 'packages');
		} catch (err) {
			stream.emit('error', err);
		}
	})();

	return stream;
}

const compileAgentTask = task.define('compile-agent', () => compileAgentRuntime());
gulp.task(compileAgentTask);

const watchAgentTask = task.define('watch-agent', () => watchAgentRuntime());
gulp.task(watchAgentTask);

export { compileAgentTask, watchAgentTask };
