import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	AssistantChatMessage,
	ModelDescription,
	PromptLog,
	Tool,
} from "core";
import { serializeTool } from "core/tools";
import { grepSearchTool } from "core/tools/definitions";
import { vi } from "vitest";
import type { RootState } from "../redux/store";
import { runAgentDriver } from "../redux/thunks/streamNormalInput";
import {
	createMockStore,
	getEmptyRootState,
} from "../util/test/mockStore";

export interface HarnessTranscript {
	compileChat?: {
		compiledChatMessages: { role: string; content: string }[];
		didPrune?: boolean;
		contextPercentage?: number;
	};
	turns: Array<{
		chunks: AssistantChatMessage[][];
		completion: string;
	}>;
}

export interface HarnessCaseManifest {
	id: string;
	prompt: string;
	expect_tools?: Array<{ name: string; min_calls?: number; max_calls?: number }>;
}

export interface HarnessCaseResult {
	id: string;
	kind: "harness";
	ok: boolean;
	durationMs: number;
	message?: string;
	toolCalls: Record<string, number>;
}

const claude: ModelDescription = {
	title: "Eval harness model",
	model: "claude-3-5-sonnet-20241022",
	provider: "anthropic",
	underlyingProviderName: "anthropic",
	completionOptions: {},
};

function toolsForManifest(
	expect_tools?: HarnessCaseManifest["expect_tools"],
): Tool[] {
	const names = new Set((expect_tools ?? []).map((t) => t.name));
	const tools: Tool[] = [];
	if (names.has("grep_search")) {
		tools.push(serializeTool(grepSearchTool));
	}
	return tools;
}

function stateWithPrompt(
	prompt: string,
	expect_tools?: HarnessCaseManifest["expect_tools"],
): RootState {
	const state = getEmptyRootState();
	return {
		...state,
		config: {
			...state.config,
			config: {
				...state.config.config,
				tools: toolsForManifest(expect_tools),
				selectedModelByRole: {
					...state.config.config.selectedModelByRole,
					chat: claude,
				},
			},
		},
		session: {
			...state.session,
			id: `eval-${Date.now()}`,
			history: [
				{
					message: { id: "eval-user", role: "user", content: prompt },
					contextItems: [],
				},
			],
		},
	};
}

function turn(
	chunks: AssistantChatMessage[][],
	completion: string,
): AsyncGenerator<AssistantChatMessage[], PromptLog> {
	return (async function* () {
		for (const chunk of chunks) {
			yield chunk;
		}
		return {
			prompt: "eval",
			completion,
			modelProvider: "anthropic",
			modelTitle: claude.title,
		};
	})();
}

function countToolCalls(requestSpy: {
	mock: { calls: ReadonlyArray<readonly unknown[]> };
}): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const call of requestSpy.mock.calls) {
		if (call[0] !== "tools/call") {
			continue;
		}
		const data = call[1] as { toolCall?: { function?: { name?: string } } };
		const name = data?.toolCall?.function?.name;
		if (name) {
			counts[name] = (counts[name] ?? 0) + 1;
		}
	}
	return counts;
}

function checkToolExpectations(
	expectations: HarnessCaseManifest["expect_tools"],
	counts: Record<string, number>,
): string | undefined {
	if (!expectations?.length) {
		return undefined;
	}
	for (const exp of expectations) {
		const n = counts[exp.name] ?? 0;
		if (exp.min_calls !== undefined && n < exp.min_calls) {
			return `Expected >= ${exp.min_calls} calls to ${exp.name}, got ${n}`;
		}
		if (exp.max_calls !== undefined && n > exp.max_calls) {
			return `Expected <= ${exp.max_calls} calls to ${exp.name}, got ${n}`;
		}
	}
	return undefined;
}

export function loadHarnessCase(caseDir: string): {
	manifest: HarnessCaseManifest;
	transcript: HarnessTranscript;
} {
	const manifest = JSON.parse(
		readFileSync(join(caseDir, "case.json"), "utf8"),
	) as HarnessCaseManifest;
	const transcript = JSON.parse(
		readFileSync(join(caseDir, "transcript.json"), "utf8"),
	) as HarnessTranscript;
	return { manifest, transcript };
}

export const GREP_TOOL_NAME = serializeTool(grepSearchTool).function.name;

export async function runHarnessCase(caseDir: string): Promise<HarnessCaseResult> {
	const start = performance.now();
	const { manifest, transcript } = loadHarnessCase(caseDir);
	const mockStore = createMockStore(
		stateWithPrompt(manifest.prompt, manifest.expect_tools) as Partial<RootState>,
	);
	const mockIdeMessenger = mockStore.mockIdeMessenger;

	const compile = transcript.compileChat ?? {
		compiledChatMessages: [{ role: "user", content: manifest.prompt }],
		didPrune: false,
		contextPercentage: 0.5,
	};
	mockIdeMessenger.responses["llm/compileChat"] = compile as any;
	mockIdeMessenger.responses["tools/call"] = {
		contextItems: [
			{
				content: "ok",
				name: "Tool Result",
				description: "eval harness",
				icon: "search",
				hidden: false,
			},
		],
		errorMessage: undefined,
	} as any;

	const streamChat = vi.fn();
	const turns = [...transcript.turns];
	streamChat.mockImplementation(() => {
		const next = turns.shift();
		if (!next) {
			return turn([[{ role: "assistant", content: "" }]], "");
		}
		return turn(next.chunks, next.completion);
	});
	mockIdeMessenger.llmStreamChat = streamChat as any;

	const requestSpy = vi.spyOn(mockIdeMessenger, "request");

	try {
		await runAgentDriver({
			depth: 0,
			dispatch: mockStore.dispatch as any,
			extra: { ideMessenger: mockIdeMessenger } as any,
			getState: mockStore.getState as any,
		});
	} catch (err) {
		return {
			id: manifest.id,
			kind: "harness",
			ok: false,
			durationMs: performance.now() - start,
			message: err instanceof Error ? err.message : String(err),
			toolCalls: countToolCalls(requestSpy),
		};
	}

	const toolCalls = countToolCalls(requestSpy);
	const toolErr = checkToolExpectations(manifest.expect_tools, toolCalls);
	const expectedTurns = transcript.turns.length;
	if (streamChat.mock.calls.length < expectedTurns) {
		return {
			id: manifest.id,
			kind: "harness",
			ok: false,
			durationMs: performance.now() - start,
			message: `Expected ${expectedTurns} LLM turns, got ${streamChat.mock.calls.length}`,
			toolCalls,
		};
	}

	return {
		id: manifest.id,
		kind: "harness",
		ok: !toolErr,
		durationMs: performance.now() - start,
		message: toolErr,
		toolCalls,
	};
}
