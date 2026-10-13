#!/usr/bin/env node
/**
 * Serve the Agent GUI with Vite's dev server and mark out/agent so the
 * running IDE loads it with hot reload. A production `vite build` still
 * fills out/agent/webview for launches that are not watching.
 *
 * Started by gulp watch-agent alongside esbuild --watch.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const { agentDistPath } = require("./utils");

const agentDir = path.join(__dirname, "..");
const guiDir = path.join(agentDir, "gui");
const viteBin = path.join(guiDir, "node_modules", "vite", "bin", "vite.js");
const sentinel = agentDistPath("gui-dev-server");

function removeSentinel() {
  try {
    fs.rmSync(sentinel, { force: true });
  } catch {
    // The marker is only a hint that the dev server is up.
  }
}

function writeSentinel() {
  fs.mkdirSync(path.dirname(sentinel), { recursive: true });
  fs.writeFileSync(sentinel, "5173\n");
}

if (!fs.existsSync(viteBin)) {
  console.error(
    "[watch-gui] vite not found in gui/node_modules — run npm install at repo root",
  );
  process.exit(1);
}

removeSentinel();

console.log("[watch-gui] GUI dev server on http://localhost:5173");

const child = spawn(
  process.execPath,
  [viteBin, "--host", "localhost", "--port", "5173", "--strictPort"],
  {
    cwd: guiDir,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  },
);

let markedReady = false;

function forward(stream, chunk) {
  stream.write(chunk);
  if (markedReady) {
    return;
  }
  if (chunk.toString().includes("ready in")) {
    markedReady = true;
    writeSentinel();
    console.log(
      "[watch-gui] Hot reload is on. Reload the Quantum window once so the agent panel attaches.",
    );
  }
}

child.stdout.on("data", (chunk) => forward(process.stdout, chunk));
child.stderr.on("data", (chunk) => forward(process.stderr, chunk));

function stop(code) {
  removeSentinel();
  process.exit(code ?? 1);
}

child.on("exit", (code) => stop(code));
process.on("SIGINT", () => {
  removeSentinel();
  child.kill("SIGINT");
});
process.on("SIGTERM", () => {
  removeSentinel();
  child.kill("SIGTERM");
});
