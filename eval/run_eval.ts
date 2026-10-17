#!/usr/bin/env bun
/**
 * Agent regression orchestrator — harness (mock LLM driver) + fixture verify.
 * Live model eval: use --lane live (not implemented; requires API keys).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildReport, formatReportSummary } from './metrics.js';
import type { CaseResult, EvalCaseManifest, EvalLane } from './types.js';

const EVAL_ROOT = dirname(import.meta.path);
const REPO_ROOT = resolve(EVAL_ROOT, '..');
const CASES_ROOT = join(EVAL_ROOT, 'cases');
const OUT_DIR = join(EVAL_ROOT, 'out');
const AGENT_GUI = join(
	REPO_ROOT,
	'ide/src/vs/workbench/contrib/agent/gui',
);

function parseArgs(argv: string[]) {
	let lane: EvalLane | 'all' = 'all';
	let caseFilter: string | undefined;
	let live = false;

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--lane' && argv[i + 1]) {
			lane = argv[++i] as EvalLane | 'all';
		} else if (a === '--case' && argv[i + 1]) {
			caseFilter = argv[++i];
		} else if (a === '--live') {
			live = true;
		} else if (a === '-h' || a === '--help') {
			console.log(`Usage: bun run run_eval.ts [--lane harness|fixture|live|all] [--case id] [--live]

  harness  Replay transcripts through runAgentDriver (no API keys).
  fixture  Run verify.command on case workspaces.
  live     Real models (not implemented yet).
`);
			process.exit(0);
		}
	}

	if (live) {
		lane = 'live';
	}
	return { lane, caseFilter };
}

function loadManifest(caseDir: string): EvalCaseManifest {
	const path = join(caseDir, 'case.json');
	const raw = JSON.parse(readFileSync(path, 'utf8')) as EvalCaseManifest;
	if (!raw.id || !raw.kind) {
		throw new Error(`Invalid case.json in ${caseDir}`);
	}
	return raw;
}

function discoverCases(filter?: string): { dir: string; manifest: EvalCaseManifest }[] {
	const entries = readdirSync(CASES_ROOT, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.filter((name) => !filter || name === filter || loadManifest(join(CASES_ROOT, name)).id === filter);

	return entries.map((name) => {
		const dir = join(CASES_ROOT, name);
		return { dir, manifest: loadManifest(dir) };
	});
}

function caseRunsInLane(manifest: EvalCaseManifest, lane: EvalLane | 'all'): boolean {
	if (lane === 'all') {
		return manifest.kind === 'harness' || manifest.kind === 'fixture';
	}
	if (manifest.lanes?.length) {
		return manifest.lanes.includes(lane);
	}
	return manifest.kind === lane;
}

function runHarnessSuite(caseFilter?: string): number {
	const env = {
		...process.env,
		NODE_ENV: 'test',
		EVAL_CASES_ROOT: CASES_ROOT,
		EVAL_OUT_DIR: OUT_DIR,
		...(caseFilter ? { EVAL_CASE_FILTER: caseFilter } : {}),
	};
	const result = spawnSync('npm', ['run', 'eval:harness'], {
		cwd: AGENT_GUI,
		env,
		stdio: 'inherit',
		shell: false,
	});
	return result.status ?? 1;
}

function runFixtureCase(caseDir: string, manifest: EvalCaseManifest): CaseResult {
	const start = performance.now();
	const verify = manifest.verify;
	if (!verify?.command?.length) {
		return {
			id: manifest.id,
			kind: 'fixture',
			ok: false,
			durationMs: performance.now() - start,
			message: 'fixture case missing verify.command',
		};
	}

	const workspaceSrc = join(caseDir, 'workspace');
	if (!existsSync(workspaceSrc)) {
		return {
			id: manifest.id,
			kind: 'fixture',
			ok: false,
			durationMs: performance.now() - start,
			message: 'missing workspace/',
		};
	}

	const tmp = join(OUT_DIR, `workspace-${manifest.id}-${Date.now()}`);
	mkdirSync(OUT_DIR, { recursive: true });
	cpSync(workspaceSrc, tmp, { recursive: true });

	const cwd = verify.cwd ? join(tmp, verify.cwd) : tmp;
	const result = spawnSync(verify.command[0], verify.command.slice(1), {
		cwd,
		stdio: 'pipe',
		encoding: 'utf8',
	});

	const ok = result.status === 0;
	const message = ok
		? undefined
		: (result.stderr || result.stdout || `exit ${result.status}`).slice(0, 500);

	try {
		rmSync(tmp, { recursive: true, force: true });
	} catch {
		// best-effort cleanup
	}

	return {
		id: manifest.id,
		kind: 'fixture',
		ok,
		durationMs: performance.now() - start,
		message,
	};
}

function readHarnessResults(): CaseResult[] {
	const path = join(OUT_DIR, 'harness-results.json');
	if (!existsSync(path)) {
		return [];
	}
	return JSON.parse(readFileSync(path, 'utf8')) as CaseResult[];
}

async function main() {
	const { lane, caseFilter } = parseArgs(process.argv.slice(2));
	const startedAt = new Date().toISOString();
	mkdirSync(OUT_DIR, { recursive: true });

	const discovered = discoverCases(caseFilter);
	if (discovered.length === 0) {
		console.error(`No eval cases found under ${CASES_ROOT}${caseFilter ? ` (filter: ${caseFilter})` : ''}`);
		process.exit(1);
	}

	const results: CaseResult[] = [];
	let harnessExitCode = 0;

	if (lane === 'live') {
		console.error('Live eval (real LLM) is not implemented yet. Use --lane harness or fixture.');
		process.exit(2);
	}

	const runHarness = lane === 'all' || lane === 'harness';
	const runFixture = lane === 'all' || lane === 'fixture';

	const harnessCases = discovered.filter((c) => caseRunsInLane(c.manifest, 'harness'));
	const fixtureCases = discovered.filter((c) => caseRunsInLane(c.manifest, 'fixture'));

	if (runHarness && harnessCases.length > 0) {
		harnessExitCode = runHarnessSuite(caseFilter);
		const harnessResults = readHarnessResults();
		results.push(...harnessResults);
		if (harnessExitCode !== 0 && harnessResults.length === 0) {
			console.error('Harness vitest failed with no result file');
			process.exit(harnessExitCode);
		}
	} else if (runHarness && harnessCases.length === 0) {
		console.error('No harness cases matched the current lane/filter');
		process.exit(1);
	}

	if (runFixture) {
		for (const { dir, manifest } of fixtureCases) {
			results.push(runFixtureCase(dir, manifest));
		}
	}

	const report = buildReport(lane === 'all' ? 'default' : lane, results, startedAt);
	console.log(formatReportSummary(report));
	const outPath = join(OUT_DIR, `report-${Date.now()}.json`);
	await Bun.write(outPath, JSON.stringify(report, null, 2));
	console.log(`Report: ${outPath}`);

	if (report.failed > 0 || harnessExitCode !== 0) {
		process.exit(harnessExitCode !== 0 ? harnessExitCode : 1);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
