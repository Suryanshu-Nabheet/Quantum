#!/usr/bin/env node
/**
 * Parallel watch orchestrator for Quantum IDE.
 *
 * Why this exists:
 * - npm-run-all2 aborts *all* parallel scripts when one exits non-zero.
 * - gulp watch-agent can fail/exit while leaving orphan esbuild/vite children,
 *   which leaves `npm run watch` looking "alive" while out/ stops updating.
 *
 * This supervisor:
 * - Runs transpile / typecheck / extensions / agent watches in parallel
 * - Restarts any watcher that exits (with backoff)
 * - Never kills siblings because one failed
 * - Tears down the whole tree on Ctrl+C
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COLORS = {
	'watch-client-transpile': '\x1b[36m',
	'watch-client': '\x1b[32m',
	'watch-extensions': '\x1b[35m',
	'watch-agent': '\x1b[33m',
};
const RESET = '\x1b[0m';
const LABEL_WIDTH = 22;

const TASKS = [
	{
		name: 'watch-client-transpile',
		command: process.execPath,
		args: ['build/next/index.ts', 'transpile', '--watch'],
	},
	{
		name: 'watch-client',
		command: process.execPath,
		args: [
			'--experimental-strip-types',
			'--max-old-space-size=8192',
			'./node_modules/gulp/bin/gulp.js',
			'watch-client',
		],
	},
	{
		name: 'watch-extensions',
		command: process.execPath,
		args: [
			'--experimental-strip-types',
			'--max-old-space-size=8192',
			'./node_modules/gulp/bin/gulp.js',
			'watch-extensions',
			'watch-extension-media',
		],
	},
	{
		name: 'watch-agent',
		command: process.execPath,
		args: [
			'--experimental-strip-types',
			'--max-old-space-size=8192',
			'./node_modules/gulp/bin/gulp.js',
			'watch-agent',
		],
	},
];

const MIN_RESTART_MS = 1_000;
const MAX_RESTART_MS = 30_000;
const HEARTBEAT_MS = 60_000;

/** @type {Map<string, { child: import('node:child_process').ChildProcess | null, restarts: number, nextDelay: number, stdoutBuf: string, stderrBuf: string }>} */
const running = new Map();
let shuttingDown = false;

function writePrefixed(name, text, stream) {
	const color = COLORS[name] ?? '';
	const label = `${color}[${name.padEnd(LABEL_WIDTH)}]${RESET} `;
	const parts = text.split('\n');
	for (let i = 0; i < parts.length; i++) {
		const line = parts[i];
		const isLast = i === parts.length - 1;
		if (line.length === 0 && isLast) {
			continue;
		}
		stream.write(`${label}${line}${isLast ? '' : '\n'}`);
	}
}

function attachPrefixedOutput(name, child, state) {
	child.stdout.setEncoding('utf8');
	child.stderr.setEncoding('utf8');

	child.stdout.on('data', (chunk) => {
		state.stdoutBuf += chunk;
		const lines = state.stdoutBuf.split('\n');
		state.stdoutBuf = lines.pop() ?? '';
		if (lines.length > 0) {
			writePrefixed(name, `${lines.join('\n')}\n`, process.stdout);
		}
	});

	child.stderr.on('data', (chunk) => {
		state.stderrBuf += chunk;
		const lines = state.stderrBuf.split('\n');
		state.stderrBuf = lines.pop() ?? '';
		if (lines.length > 0) {
			writePrefixed(name, `${lines.join('\n')}\n`, process.stderr);
		}
	});
}

function startTask(task) {
	if (shuttingDown) {
		return;
	}

	const state = running.get(task.name) ?? {
		child: null,
		restarts: 0,
		nextDelay: MIN_RESTART_MS,
		stdoutBuf: '',
		stderrBuf: '',
	};

	const child = spawn(task.command, task.args, {
		cwd: ROOT,
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	state.child = child;
	state.stdoutBuf = '';
	state.stderrBuf = '';
	running.set(task.name, state);
	attachPrefixedOutput(task.name, child, state);

	child.on('exit', (code, signal) => {
		if (state.stdoutBuf) {
			writePrefixed(task.name, `${state.stdoutBuf}\n`, process.stdout);
			state.stdoutBuf = '';
		}
		if (state.stderrBuf) {
			writePrefixed(task.name, `${state.stderrBuf}\n`, process.stderr);
			state.stderrBuf = '';
		}

		state.child = null;
		if (shuttingDown) {
			return;
		}

		const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
		console.error(`${COLORS[task.name] ?? ''}[${task.name}]${RESET} exited (${reason}); restarting in ${state.nextDelay}ms...`);
		state.restarts += 1;

		const delay = state.nextDelay;
		state.nextDelay = Math.min(MAX_RESTART_MS, Math.round(state.nextDelay * 1.5));

		setTimeout(() => {
			if (shuttingDown) {
				return;
			}
			startTask(task);
			setTimeout(() => {
				const current = running.get(task.name);
				if (current?.child && current.child.exitCode === null) {
					current.nextDelay = MIN_RESTART_MS;
				}
			}, 15_000);
		}, delay);
	});

	child.on('error', (err) => {
		console.error(`[${task.name}] failed to start:`, err);
	});
}

function shutdown(signal) {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	console.log(`\n[watch-supervisor] Shutting down (${signal})...`);

	for (const [name, state] of running) {
		if (state.child && state.child.exitCode === null) {
			try {
				state.child.kill('SIGTERM');
			} catch (err) {
				console.error(`[watch-supervisor] Failed to stop ${name}:`, err);
			}
		}
	}

	setTimeout(() => {
		for (const [, state] of running) {
			if (state.child && state.child.exitCode === null) {
				try {
					state.child.kill('SIGKILL');
				} catch {
					// ignore
				}
			}
		}
		process.exit(0);
	}, 5_000).unref();
}

function heartbeat() {
	if (shuttingDown) {
		return;
	}
	const status = TASKS.map((task) => {
		const state = running.get(task.name);
		const alive = Boolean(state?.child && state.child.exitCode === null);
		return `${task.name}=${alive ? 'up' : 'DOWN'}${state?.restarts ? `(restarts:${state.restarts})` : ''}`;
	}).join(' ');
	console.log(`[watch-supervisor] heartbeat ${status}`);
}

console.log('[watch-supervisor] Starting Quantum watch pipeline...');
for (const task of TASKS) {
	startTask(task);
}

setInterval(heartbeat, HEARTBEAT_MS).unref();
setTimeout(heartbeat, 5_000).unref();

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
