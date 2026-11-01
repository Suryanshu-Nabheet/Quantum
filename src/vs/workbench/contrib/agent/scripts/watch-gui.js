#!/usr/bin/env node
/**
 * Typecheck and rebuild the Agent GUI inside the IDE's watch-agent lifecycle.
 * Completed bundles are copied into the local webview directory used by the
 * workbench; a dev server alone cannot update that local bundle.
 *
 * Started by gulp watch-agent alongside esbuild --watch.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const agentDir = path.join(__dirname, "..");
const guiDir = path.join(agentDir, "gui");
const viteBin = path.join(guiDir, "node_modules", "vite", "bin", "vite.js");
const typeScriptBin = path.join(
  guiDir,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);

if (!fs.existsSync(viteBin) || !fs.existsSync(typeScriptBin)) {
  console.error(
    "[watch-gui] GUI build tools are missing from gui/node_modules — install the Agent GUI dependencies",
  );
  process.exit(1);
}

console.log("[watch-gui] Typechecking and watching Agent GUI bundles");

const children = [];
let shuttingDown = false;
let shutdownCode = 1;
let bundleWatchReady = false;

function childrenHaveExited() {
  return children.every(
    (child) => child.exitCode !== null || child.signalCode !== null,
  );
}

function stop(code, signal = "SIGTERM") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  shutdownCode = code ?? 1;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
  if (childrenHaveExited()) {
    process.exit(shutdownCode);
  }
}

function startWatcher(label, args, env = process.env) {
  const child = spawn(process.execPath, args, {
    cwd: guiDir,
    stdio: ["inherit", "pipe", "pipe"],
    env,
  });
  children.push(child);

  for (const [source, destination] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    source.on("data", (chunk) => {
      destination.write(`[agent-gui ${label}] ${chunk}`);
      if (
        label === "build" &&
        !bundleWatchReady &&
        chunk.toString().includes("watching for file changes")
      ) {
        bundleWatchReady = true;
        console.log(
          "[watch-gui] Ready; reopen the Agent webview after a GUI rebuild.",
        );
      }
    });
  }

  child.on("error", (error) => {
    console.error(`[watch-gui] ${label} watcher failed:`, error);
    stop(1);
  });
  child.on("close", (code, signal) => {
    if (!shuttingDown) {
      console.error(
        `[watch-gui] ${label} watcher exited (${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`})`,
      );
      stop(code === 0 ? 1 : (code ?? 1));
    } else if (childrenHaveExited()) {
      process.exit(shutdownCode);
    }
  });

  return child;
}

startWatcher("typecheck", [
  typeScriptBin,
  "--project",
  "tsconfig.json",
  "--noEmit",
  "--watch",
  "--preserveWatchOutput",
]);
startWatcher(
  "build",
  [viteBin, "build", "--watch"],
  { ...process.env, AGENT_COPY_WEBVIEW: "1" },
);

process.on("SIGINT", () => stop(130, "SIGINT"));
process.on("SIGTERM", () => stop(143, "SIGTERM"));
