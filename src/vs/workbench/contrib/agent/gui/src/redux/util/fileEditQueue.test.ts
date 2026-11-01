import { describe, expect, it } from "vitest";
import { enqueueFileEdit, isSerialAgentTool } from "./index";

describe("file edit queue", () => {
  it("runs queued file edits one after another", async () => {
    const order: string[] = [];
    const first = enqueueFileEdit(async () => {
      order.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("first-end");
    });
    const second = enqueueFileEdit(async () => {
      order.push("second");
    });

    await Promise.all([first, second]);

    expect(order).toEqual(["first-start", "first-end", "second"]);
  });

  it("treats edits and terminal commands as ordered work", () => {
    expect(isSerialAgentTool("single_find_and_replace")).toBe(true);
    expect(isSerialAgentTool("run_terminal_command")).toBe(true);
    expect(isSerialAgentTool("read_file")).toBe(false);
    expect(isSerialAgentTool("grep_search")).toBe(false);
  });
});
