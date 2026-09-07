/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from 'path';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = path.resolve(import.meta.dirname, '..', '..');

function runProcess(command: string, args: ReadonlyArray<string> = []) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
		child.on('exit', err => !err ? resolve() : process.exit(err ?? 1));
		child.on('error', reject);
	});
}

async function exists(subdir: string) {
	try {
		await fs.stat(path.join(rootDir, subdir));
		return true;
	} catch {
		return false;
	}
}

async function ensureNodeModules() {
	if (!(await exists('node_modules'))) {
		await runProcess(npm, ['ci']);
	}
}

async function getElectron() {
	await runProcess(npm, ['run', 'electron']);
}

async function ensureCompiled() {
	const workbenchHtml = path.join(rootDir, 'out/vs/code/electron-browser/workbench/workbench-dev.html');
	try {
		await fs.stat(workbenchHtml);
	} catch {
		await runProcess(npm, ['run', 'transpile-client']);
	}
}

async function ensureAgentCompiled() {
	const requiredFiles = [
		'out/agent/package.json',
		'out/agent/out/extension.js',
		'out/agent/out/llamaTokenizerWorkerPool.mjs',
		'out/agent/out/llamaTokenizer.mjs',
		'out/agent/out/tiktokenWorkerPool.mjs',
		'out/agent/webview/assets/index.js',
		'out/agent/webview/assets/index.css',
		'out/agent/webview/assets/indexConsole.js',
		'out/agent/webview/assets/indexConsole.css',
	];
	const needsCompile = await (async () => {
		try {
			await Promise.all(requiredFiles.map(file => fs.stat(path.join(rootDir, file))));
			return false;
		} catch {
			return true;
		}
	})();
	const needsNativeAssets = !(await exists('out/agent/bin/napi-v3'));
	if (needsCompile || needsNativeAssets) {
		await runProcess(npm, ['run', 'gulp', 'compile-agent']);
	}
}

async function ensureElectronPreloads() {
	const preloadPath = path.join(rootDir, 'out/vs/platform/browserView/electron-browser/preload-browserView.js');
	let needsRecompile = false;
	try {
		const content = await fs.readFile(preloadPath, 'utf-8');
		needsRecompile = /^export\s/m.test(content) || !content.startsWith('"use strict"');
	} catch {
		return;
	}
	if (!needsRecompile) {
		return;
	}

	console.log('[preLaunch] Recompiling Electron preload scripts as CommonJS...');
	const esbuild = await import('esbuild');
	const files = [
		'vs/base/parts/sandbox/electron-browser/preload.ts',
		'vs/base/parts/sandbox/electron-browser/preload-aux.ts',
		'vs/platform/browserView/electron-browser/preload-browserView.ts',
	];
	await Promise.all(files.map(async (file) => {
		const entryPath = path.join(rootDir, 'src', file);
		const outPath = path.join(rootDir, 'out', file.replace(/\.ts$/, '.js'));
		await esbuild.build({
			entryPoints: [entryPath],
			outfile: outPath,
			bundle: false,
			format: 'cjs',
			platform: 'node',
			target: ['es2024'],
			sourcemap: 'inline',
			sourcesContent: false,
			logLevel: 'warning',
		});
	}));
}

async function main() {
	await ensureNodeModules();
	await getElectron();
	await ensureCompiled();
	await ensureElectronPreloads();
	await ensureAgentCompiled();

	// Can't require this until after dependencies are installed
	const { getBuiltInExtensions } = await import('./builtInExtensions.ts');
	await getBuiltInExtensions();
}

if (import.meta.main) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
