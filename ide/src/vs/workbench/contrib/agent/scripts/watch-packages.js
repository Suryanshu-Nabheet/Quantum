#!/usr/bin/env node
/**
 * Watch agent packages/*/src and rebuild when sources change.
 * Started by gulp watch-agent alongside esbuild --watch and watch-gui.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const agentDir = path.join(__dirname, "..");
const packagesDir = path.join(agentDir, "packages");
const packageNames = [
  "config-types",
  "fetch",
  "llm-info",
  "agent-config",
  "openai-adapters",
  "terminal-security",
];

let debounceTimer;
let rebuilding = false;
let rebuildQueued = false;

function rebuild() {
  if (rebuilding) {
    rebuildQueued = true;
    return;
  }
  rebuilding = true;
  rebuildQueued = false;
  console.log("[watch-packages] Rebuilding agent packages...");
  const child = spawn(process.execPath, [path.join(__dirname, "build-packages.js")], {
    cwd: agentDir,
    stdio: "inherit",
    env: { ...process.env, SKIP_INSTALLS: "true" },
  });
  child.on("exit", (code) => {
    rebuilding = false;
    if (code !== 0) {
      console.error(`[watch-packages] build-packages exited with code ${code ?? "unknown"}`);
    } else {
      console.log("[watch-packages] Packages rebuilt");
    }
    if (rebuildQueued) {
      rebuild();
    }
  });
}

function scheduleRebuild() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(rebuild, 300);
}

for (const name of packageNames) {
  const srcDir = path.join(packagesDir, name, "src");
  if (!fs.existsSync(srcDir)) {
    continue;
  }
  fs.watch(srcDir, { recursive: true }, (_event, filename) => {
    if (!filename) {
      return;
    }
    if (filename.endsWith(".ts") || filename.endsWith(".js") || filename.endsWith(".json")) {
      scheduleRebuild();
    }
  });
}

console.log("[watch-packages] Watching packages/*/src");
