#!/usr/bin/env node
/**
 * Remove local Agent dependencies, caches, and generated runtime output.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const repoRoot = path.resolve(root, "../../../../..");

const directories = [
  "node_modules",
  ".npm-cache",
  "core/node_modules",
  "core/dist",
  "gui/node_modules",
  // Legacy source-local GUI output. Vite now writes to repo out/agent-gui.
  "gui/dist",
  // Legacy source-local output folders. Runtime output now lives in repo out/agent.
  "bin",
  "out",
  "webview",
  "build",
  "tmp",
  "extension",
  ".agent-debug",
  "packages/config-types/node_modules",
  "packages/config-types/dist",
  "packages/fetch/node_modules",
  "packages/fetch/dist",
  "packages/llm-info/node_modules",
  "packages/llm-info/dist",
  "packages/agent-config/node_modules",
  "packages/agent-config/dist",
  "packages/openai-adapters/node_modules",
  "packages/openai-adapters/dist",
  "packages/terminal-security/node_modules",
  "packages/terminal-security/dist",
].map((d) => path.join(root, d));

directories.push(path.join(repoRoot, "out", "agent"));
directories.push(path.join(repoRoot, "out", "agent-gui"));
directories.push(path.join(repoRoot, "out", "agent-packages"));

for (const dir of directories) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Removed", path.relative(root, dir));
  }
}

const generatedFiles = [
  "agent_rc_schema.json",
  "agent-config-schema.json",
  "config_schema.json",
].map((f) => path.join(root, f));

for (const file of generatedFiles) {
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
    console.log("Removed", path.relative(root, file));
  }
}

console.log("Clean complete.");
