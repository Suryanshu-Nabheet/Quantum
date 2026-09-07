import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "vitest";

import {
  resolveActiveCodexHomeWritePath,
  resolveBaseCodexHomePath,
  resolveCodexHomeAllowlistCandidates,
  resolveQuantumCodexHomeOverlayPath,
} from "./codexHomePaths.ts";

describe("Codex home paths", () => {
  it("resolves the source home using explicit, environment, then default precedence", () => {
    assert.equal(
      resolveBaseCodexHomePath({ CODEX_HOME: "/env/codex" }, "/explicit/codex"),
      "/explicit/codex",
    );
    assert.equal(resolveBaseCodexHomePath({ CODEX_HOME: "/env/codex" }), "/env/codex");
    assert.ok(resolveBaseCodexHomePath({}).endsWith(`${path.sep}.codex`));
  });

  it("anchors the overlay under QUANTUM_HOME", () => {
    assert.equal(
      resolveQuantumCodexHomeOverlayPath({ QUANTUM_HOME: "/quantum/runtime" }, "/users/me/.codex"),
      path.join("/quantum/runtime", "codex-home-overlay"),
    );
  });

  it("derives a default overlay beside the source home", () => {
    assert.equal(
      resolveQuantumCodexHomeOverlayPath({}, "/users/me/.codex"),
      path.join("/users/me", ".quantum", "runtime", "codex-home-overlay"),
    );
  });

  it("uses the isolated overlay as Codex's write home", () => {
    assert.equal(
      resolveActiveCodexHomeWritePath({
        env: { QUANTUM_HOME: "/quantum/runtime" },
        homePath: "/users/me/.codex",
      }),
      path.join("/quantum/runtime", "codex-home-overlay"),
    );
  });

  it("allowlists source and overlay homes when distinct", () => {
    assert.deepEqual(
      resolveCodexHomeAllowlistCandidates({
        env: { QUANTUM_HOME: "/quantum/runtime" },
        homePath: "/users/me/.codex",
      }),
      ["/users/me/.codex", path.join("/quantum/runtime", "codex-home-overlay")],
    );
  });
});
