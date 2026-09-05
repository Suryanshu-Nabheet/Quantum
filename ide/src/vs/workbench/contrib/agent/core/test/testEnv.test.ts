describe("Test environment", () => {
  test("should have AGENT_GLOBAL_DIR env var set to .agent-test", () => {
    expect(process.env.AGENT_GLOBAL_DIR).toBeDefined();
    expect(process.env.AGENT_GLOBAL_DIR)?.toMatch(/\.agent-test$/);
  });
});
