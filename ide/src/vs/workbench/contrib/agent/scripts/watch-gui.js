#!/usr/bin/env node
/**
 * Watch Agent GUI (Vite) and copy each build to out/agent/webview/.
 * Started by gulp watch-agent alongside esbuild --watch.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const {
  agentDistPath,
  agentGuiDistDir,
  copyGuiDistToWebview,
} = require("./utils");

const agentDir = path.join(__dirname, "..");
const guiDir = path.join(agentDir, "gui");
const viteBin = path.join(guiDir, "node_modules", "vite", "bin", "vite.js");
const requiredAssets = [
  "index.js",
  "index.css",
];

function assetPath(rootDir, asset) {
  return path.join(rootDir, "assets", asset);
}

function assetsExist(rootDir) {
  return requiredAssets.every((asset) => fs.existsSync(assetPath(rootDir, asset)));
}

function runInitialBuild() {
  const distDir = agentGuiDistDir;
  const webviewDir = agentDistPath("webview");
  if (assetsExist(webviewDir) && assetsExist(distDir)) {
    const needsCopy = requiredAssets.some((asset) => {
      return (
        fs.statSync(assetPath(distDir, asset)).mtimeMs >
        fs.statSync(assetPath(webviewDir, asset)).mtimeMs
      );
    });
    if (!needsCopy) {
      console.log("[watch-gui] out/agent/webview/ is up to date");
      return;
    }
    copyGuiDistToWebview();
    console.log("[watch-gui] Refreshed out/agent/webview/ from out/agent-gui");
    return;
  }

  console.log("[watch-gui] Initial GUI build...");
  const result = require("child_process").spawnSync(
    "npm",
    ["run", "build", "--prefix", "gui"],
    { cwd: agentDir, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error("Initial GUI build failed");
  }
  copyGuiDistToWebview();
}

if (!fs.existsSync(viteBin)) {
  console.error(
    "[watch-gui] vite not found in gui/node_modules — run npm install at repo root",
  );
  process.exit(1);
}

runInitialBuild();

console.log("[watch-gui] Watching gui/ (vite build --watch)");

const child = spawn(process.execPath, [viteBin, "build", "--watch"], {
  cwd: guiDir,
  stdio: "inherit",
  env: { ...process.env, AGENT_COPY_WEBVIEW: "1" },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
