#!/usr/bin/env node
/**
 * Watch agent packages/<name>/src and rebuild when sources change.
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
let buildChild;
let stopping = false;

function collectSourceSnapshot() {
  const snapshot = new Map();

  function visit(directory) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filename);
      } else if (entry.isFile() && /\.(?:ts|js|json)$/.test(entry.name)) {
        const stats = fs.statSync(filename);
        snapshot.set(filename, `${stats.mtimeMs}:${stats.size}`);
      }
    }
  }

  for (const name of packageNames) {
    visit(path.join(packagesDir, name, "src"));
  }
  return snapshot;
}

function rebuild() {
  if (stopping) {
    return;
  }
  if (rebuilding) {
    rebuildQueued = true;
    return;
  }
  rebuilding = true;
  rebuildQueued = false;
  console.log("[watch-packages] Rebuilding agent packages...");
  buildChild = spawn(process.execPath, [path.join(__dirname, "build-packages.js")], {
    cwd: agentDir,
    stdio: "inherit",
    env: { ...process.env, SKIP_INSTALLS: "true" },
  });
  buildChild.on("exit", (code) => {
    buildChild = undefined;
    rebuilding = false;
    if (code !== 0) {
      console.error(`[watch-packages] build-packages exited with code ${code ?? "unknown"}`);
    } else {
      console.log("[watch-packages] Packages rebuilt");
    }
    if (rebuildQueued && !stopping) {
      rebuild();
    }
  });
}

function scheduleRebuild() {
  if (stopping) {
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(rebuild, 300);
}

function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  rebuildQueued = false;
  clearTimeout(debounceTimer);
  clearInterval(pollTimer);
  buildChild?.kill("SIGTERM");
  process.exitCode = 0;
}

process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

let previousSnapshot;
try {
  previousSnapshot = collectSourceSnapshot();
} catch (error) {
  console.error("[watch-packages] Could not read package sources:", error);
  process.exit(1);
}

const pollTimer = setInterval(() => {
  try {
    const nextSnapshot = collectSourceSnapshot();
    const changed =
      nextSnapshot.size !== previousSnapshot.size ||
      [...nextSnapshot].some(([filename, fingerprint]) =>
        previousSnapshot.get(filename) !== fingerprint,
      );
    previousSnapshot = nextSnapshot;
    if (changed) {
      scheduleRebuild();
    }
  } catch (error) {
    console.error("[watch-packages] Could not refresh package sources:", error);
  }
}, 1000);

console.log("[watch-packages] Polling packages/*/src for changes");
