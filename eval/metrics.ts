import type { CaseResult, EvalReport } from './types.js';

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) {
		return 0;
	}
	const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
	return sorted[Math.max(0, idx)];
}

/** Fraction of expect_tools constraints satisfied across harness cases that define them. */
export function computeToolAccuracy(cases: CaseResult[]): number | undefined {
	const withTools = cases.filter((c) => c.toolCalls && c.ok !== undefined);
	if (withTools.length === 0) {
		return undefined;
	}
	let scored = 0;
	let total = 0;
	for (const c of withTools) {
		if (!c.toolCalls) {
			continue;
		}
		total += 1;
		if (c.ok) {
			scored += 1;
		}
	}
	return total === 0 ? undefined : scored / total;
}

export function buildReport(
	lane: string,
	cases: CaseResult[],
	startedAt: string,
): EvalReport {
	const finishedAt = new Date().toISOString();
	const passed = cases.filter((c) => c.ok).length;
	const durations = cases.map((c) => c.durationMs).sort((a, b) => a - b);
	const totalMs = durations.reduce((a, b) => a + b, 0);

	return {
		startedAt,
		finishedAt,
		lane,
		total: cases.length,
		passed,
		failed: cases.length - passed,
		passRate: cases.length === 0 ? 1 : passed / cases.length,
		durationMs: totalMs,
		p50Ms: percentile(durations, 50),
		p95Ms: percentile(durations, 95),
		toolAccuracy: computeToolAccuracy(cases),
		cases,
	};
}

export function formatReportSummary(report: EvalReport): string {
	const lines = [
		`Suite: ${report.lane}`,
		`Cases: ${report.passed}/${report.total} passed (${(report.passRate * 100).toFixed(1)}%)`,
		`Time: ${report.durationMs.toFixed(0)}ms (p50 ${report.p50Ms.toFixed(0)}ms, p95 ${report.p95Ms.toFixed(0)}ms)`,
	];
	if (report.toolAccuracy !== undefined) {
		lines.push(`Tool accuracy (harness): ${(report.toolAccuracy * 100).toFixed(1)}%`);
	}
	for (const c of report.cases.filter((x) => !x.ok)) {
		lines.push(`  FAIL ${c.id}: ${c.message ?? 'unknown'}`);
	}
	return lines.join('\n');
}
