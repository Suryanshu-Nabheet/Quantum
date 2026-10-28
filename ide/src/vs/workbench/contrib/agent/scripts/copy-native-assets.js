#!/usr/bin/env node
/**
 * Copies onnxruntime, tokenizers, and workers into out/agent after esbuild.
 */
const { autodetectPlatformAndArch } = require("./util/index");
const { copyAgentRuntimeAssets } = require("./utils");

void (async () => {
  const target =
    process.env.AGENT_BUILD_TARGET ||
    process.env.AGENT_VSCODE_TARGET ||
    process.env.VSCODE_TARGET;
  if (target) {
    await copyAgentRuntimeAssets(target);
    return;
  }
  const [os, arch] = autodetectPlatformAndArch();
  await copyAgentRuntimeAssets(`${os}-${arch}`);
})().catch((e) => {
  console.error("[copy-native-assets] failed:", e);
  process.exit(1);
});
