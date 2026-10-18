import { expect } from "vitest";

export type DispatchedAction = {
	type: string;
	payload?: unknown;
	meta?: Record<string, unknown>;
};

/** RTK actions include unstable `requestId` in meta; strip before snapshot compares. */
export function normalizeDispatchedActions(
	actions: DispatchedAction[],
): DispatchedAction[] {
	return actions.map((action) => {
		if (!action.meta || typeof action.meta !== "object") {
			return action;
		}
		const { requestId: _requestId, ...metaRest } = action.meta;
		return { ...action, meta: metaRest };
	});
}

export function expectDispatchedActions(
	received: DispatchedAction[],
	expected: DispatchedAction[],
): void {
	expect(normalizeDispatchedActions(received)).toEqual(expected);
}

/** Stable checks for streamResponseThunk without brittle full action snapshots. */
export function expectStreamResponseLifecycle(
	actions: DispatchedAction[],
	options: { aborted?: boolean } = {},
): void {
	const types = actions.map((action) => action.type);
	expect(types[0]).toBe("chat/streamResponse/pending");
	expect(types).toContain("session/submitEditorAndInitAtIndex");
	expect(types).toContain("chat/streamModelTurn/pending");
	expect(types).toContain("session/setAgentStepDepth");
	expect(types).toContain("session/setActive");
	if (!options.aborted) {
		expect(types).toContain("session/completeOpenTodos");
	}
	expect(types).toContain("session/setInactive");
	if (!options.aborted) {
		expect(types).toContain("chat/streamModelTurn/fulfilled");
		expect(types).toContain("chat/streamWrapper/fulfilled");
	}
	if (options.aborted) {
		expect(types).toContain("session/abortStream");
		const inactiveIdx = types.lastIndexOf("session/setInactive");
		const abortIdx = types.lastIndexOf("session/abortStream");
		expect(inactiveIdx).toBeGreaterThan(-1);
		expect(abortIdx).toBeGreaterThan(inactiveIdx);
		expect(types).toContain("chat/streamResponse/fulfilled");
	} else {
		expect(types.at(-1)).toBe("chat/streamResponse/fulfilled");
	}
}
