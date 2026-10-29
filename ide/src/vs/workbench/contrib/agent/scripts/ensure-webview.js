#!/usr/bin/env node
/**
 * Ensures webview/assets exist for bundled GUI mode.
 * Builds out/agent-gui when needed, then copies it to out/agent/webview/.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const {
  agentDistPath,
  agentGuiDistDir,
  copyGuiDistToWebview,
} = require("./utils");

const root = path.join(__dirname, "..");
const distDir = agentGuiDistDir;
const webviewDir = agentDistPath("webview");
const requiredAssets = [
  "index.js",
  "index.css",
];
const guiInputs = [
  "src",
  "public",
  "index.html",
  "vite.config.ts",
  "package.json",
  "package-lock.json",
  "postcss.config.cjs",
  "tailwind.config.cjs",
  "tsconfig.json",
  "tsconfig.node.json",
];
const agentPackageOutputs = ["agent-config", "terminal-security"].map((name) =>
  path.join(root, "../../../../../out/agent-packages", name, "index.js"),
);

function assetPath(rootDir, asset) {
  return path.join(rootDir, "assets", asset);
}

function assetsExist(rootDir) {
  return requiredAssets.every((asset) => fs.existsSync(assetPath(rootDir, asset)));
}

function newestMtime(target) {
  if (!fs.existsSync(target)) {
    return 0;
  }

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  let newest = stat.mtimeMs;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === "node_modules") {
      continue;
    }
    newest = Math.max(newest, newestMtime(path.join(target, entry.name)));
  }
  return newest;
}

function guiBuildIsStale() {
  if (!assetsExist(distDir)) {
    return true;
  }

  const sourceTime = Math.max(
    ...[
      ...guiInputs.map((input) => path.join(root, "gui", input)),
      ...agentPackageOutputs,
    ].map(newestMtime),
  );
  const oldestOutputTime = Math.min(
    ...requiredAssets.map((asset) => fs.statSync(assetPath(distDir, asset)).mtimeMs),
  );
  return sourceTime > oldestOutputTime;
}

function assetsNeedCopy() {
  if (!assetsExist(webviewDir)) {
    return true;
  }
  return requiredAssets.some((asset) => {
    const distAsset = assetPath(distDir, asset);
    const webviewAsset = assetPath(webviewDir, asset);
    return fs.statSync(distAsset).mtimeMs > fs.statSync(webviewAsset).mtimeMs;
  });
}

function buildGui() {
  console.log("[ensure-webview] Building GUI (out/agent-gui)...");
  // shell:true is required on Windows so npm.cmd resolves; harmless elsewhere.
  const result = spawnSync("npm", ["run", "build", "--prefix", "gui"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error("GUI build failed");
  }
}

async function main() {
  if (guiBuildIsStale()) {
    buildGui();
  }

  if (!assetsExist(distDir)) {
    throw new Error(
      "out/agent/webview/ is missing and out/agent-gui could not be built. Run `npm run compile` from the repo root or `npx gulp compile-agent`.",
    );
  }

  if (assetsNeedCopy()) {
    copyGuiDistToWebview();
  }
}

main().catch((e) => {
  console.error("[ensure-webview] Failed:", e);
  process.exit(1);
});
