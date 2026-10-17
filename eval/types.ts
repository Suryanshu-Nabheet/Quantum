export type EvalLane = 'harness' | 'fixture' | 'live';

export interface ToolExpectation {
	name: string;
	min_calls?: number;
	max_calls?: number;
}

export interface VerifySpec {
	command: string[];
	cwd?: string;
}

export interface EvalCaseManifest {
	id: string;
	description?: string;
	kind: EvalLane;
	prompt?: string;
	lanes?: EvalLane[];
	verify?: VerifySpec;
	expect_tools?: ToolExpectation[];
	timeout_ms?: number;
}

export interface CaseResult {
	id: string;
	kind: EvalLane;
	ok: boolean;
	durationMs: number;
	message?: string;
	toolCalls?: Record<string, number>;
}

export interface EvalReport {
	startedAt: string;
	finishedAt: string;
	lane: string;
	total: number;
	passed: number;
	failed: number;
	passRate: number;
	durationMs: number;
	p50Ms: number;
	p95Ms: number;
	toolAccuracy?: number;
	cases: CaseResult[];
}
