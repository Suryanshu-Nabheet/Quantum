import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { runHarnessCase } from "./harnessRunner";

vi.mock("../redux/util/getBaseSystemMessage", () => ({
	getBaseSystemMessage: vi.fn(() => "You are a helpful assistant."),
}));

const evalDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(evalDir, "../../../../../../../../..");
const defaultCasesRoot = join(repoRoot, "eval/cases");
const casesRoot = process.env.EVAL_CASES_ROOT ?? defaultCasesRoot;
const filter = process.env.EVAL_CASE_FILTER;
const outDir = process.env.EVAL_OUT_DIR ?? join(repoRoot, "eval/out");

function harnessCaseDirs(): string[] {
	if (!existsSync(casesRoot)) {
		return [];
	}
	return readdirSync(casesRoot, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => join(casesRoot, d.name))
		.filter((dir) => {
			const manifestPath = join(dir, "case.json");
			if (!existsSync(manifestPath)) {
				return false;
			}
			const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as {
				kind?: string;
				id?: string;
			};
			if (raw.kind !== "harness") {
				return false;
			}
			if (filter && raw.id !== filter && !dir.endsWith(`/${filter}`)) {
				return false;
			}
			return existsSync(join(dir, "transcript.json"));
		});
}

const caseDirs = harnessCaseDirs();
const aggregate: Awaited<ReturnType<typeof runHarnessCase>>[] = [];

describe("agent eval harness", () => {
	if (caseDirs.length === 0) {
		it("has at least one harness case", () => {
			expect(caseDirs.length, `No harness cases under ${casesRoot}`).toBeGreaterThan(0);
		});
		return;
	}

	for (const caseDir of caseDirs) {
		const id = caseDir.split(/[/\\]/).pop() ?? caseDir;
		it(`harness: ${id}`, async () => {
			const result = await runHarnessCase(caseDir);
			aggregate.push(result);
			expect(result.ok, result.message).toBe(true);
		});
	}
});

afterAll(() => {
	if (aggregate.length === 0) {
		return;
	}
	mkdirSync(outDir, { recursive: true });
	writeFileSync(
		join(outDir, "harness-results.json"),
		JSON.stringify(aggregate, null, 2),
	);
});
