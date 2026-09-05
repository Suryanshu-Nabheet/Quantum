const fs = require("fs");
const path = require("path");

const ncp = require("ncp").ncp;
const { rimrafSync } = require("rimraf");

const agentDir = path.join(__dirname, "..");
const repoRoot = path.resolve(agentDir, "../../../../..");
const agentDistDir = path.join(repoRoot, "out", "agent");
const agentGuiDistDir = path.join(repoRoot, "out", "agent-gui");

function agentDistPath(...parts) {
  return path.join(agentDistDir, ...parts);
}

function ensureGeneratedExtensionManifest() {
  fs.mkdirSync(agentDistDir, { recursive: true });
  const sourceManifest = JSON.parse(
    fs.readFileSync(path.join(agentDir, "package.json"), "utf8"),
  );
  const runtimeManifest = {
    name: sourceManifest.name,
    displayName: sourceManifest.displayName,
    description: sourceManifest.description,
    version: sourceManifest.version,
    publisher: sourceManifest.publisher,
    author: sourceManifest.author,
    license: sourceManifest.license,
    repository: sourceManifest.repository,
    bugs: sourceManifest.bugs,
    homepage: sourceManifest.homepage,
    extensionKind: sourceManifest.extensionKind,
    engines: sourceManifest.engines,
    categories: sourceManifest.categories,
    keywords: sourceManifest.keywords,
    activationEvents: sourceManifest.activationEvents,
    main: sourceManifest.main,
    contributes: sourceManifest.contributes,
  };
  fs.writeFileSync(
    agentDistPath("package.json"),
    `${JSON.stringify(runtimeManifest, null, 2)}\n`,
  );
}

function copyTokenizers() {
  fs.mkdirSync(agentDistPath("out"), { recursive: true });
  const tokenizerFiles = [
    "../core/llm/llamaTokenizerWorkerPool.mjs",
    "../core/llm/llamaTokenizer.mjs",
    "../core/llm/tiktokenWorkerPool.mjs",
  ];

  for (const relativePath of tokenizerFiles) {
    const basename = path.basename(relativePath);
    fs.copyFileSync(
      path.join(__dirname, relativePath),
      agentDistPath("out", basename),
    );
    console.log(`[info] Copied ${basename}`);
  }
}

function copyGuiDistToWebview() {
  const distDir = agentGuiDistDir;
  const webviewDir = agentDistPath("webview");
  const requiredAssets = [
    "index.js",
    "index.css",
  ];

  for (const asset of requiredAssets) {
    if (!fs.existsSync(path.join(distDir, "assets", asset))) {
      throw new Error(`gui build did not produce out/agent-gui/assets/${asset}`);
    }
  }

  rimrafSync(webviewDir);
  fs.mkdirSync(webviewDir, { recursive: true });
  fs.cpSync(distDir, webviewDir, { recursive: true });
  ensureGeneratedExtensionManifest();
  console.log("[info] Copied out/agent-gui to out/agent/webview/");
}

async function copyOnnxRuntimeFromNodeModules(target) {
  process.chdir(agentDir);
  const onnxBinCandidates = [
    path.join(__dirname, "../core/node_modules/onnxruntime-node/bin"),
    path.join(__dirname, "../node_modules/onnxruntime-node/bin"),
  ];
  const onnxBin = onnxBinCandidates.find((candidate) =>
    fs.existsSync(candidate),
  );
  if (!onnxBin) {
    console.warn(
      "[info] onnxruntime-node not installed — skipping native copy",
    );
    return;
  }

  const destBin = agentDistPath("bin");
  fs.mkdirSync(destBin, { recursive: true });

  const copyPlatformArch = async (srcPath, destPath) => {
    await new Promise((resolve, reject) => {
      ncp(srcPath, destPath, { dereference: true }, (error) => {
        if (error) {
          console.warn("[info] Error copying onnxruntime-node files", error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  if (target) {
    const [platform, arch] = target.split("-");
    const srcPlatform = path.join(onnxBin, "napi-v3", platform, arch);
    const destPlatform = path.join(destBin, "napi-v3", platform, arch);

    if (!fs.existsSync(srcPlatform)) {
      console.warn(
        `[info] onnxruntime binaries not found for ${target} — skipping native copy`,
      );
      return;
    }

    rimrafSync(path.join(destBin, "napi-v3", platform));
    fs.mkdirSync(path.dirname(destPlatform), { recursive: true });
    await copyPlatformArch(srcPlatform, destPlatform);

    // Also don't want to include cuda/shared/tensorrt binaries, they are too large
    if (target.startsWith("linux")) {
      const filesToRemove = [
        "libonnxruntime_providers_cuda.so",
        "libonnxruntime_providers_shared.so",
        "libonnxruntime_providers_tensorrt.so",
      ];
      filesToRemove.forEach((file) => {
        const filepath = path.join(destPlatform, file);
        if (fs.existsSync(filepath)) {
          fs.rmSync(filepath);
        }
      });
    }
  } else {
    await copyPlatformArch(onnxBin, destBin);
  }

  console.log("[info] Copied onnxruntime-node");
}

async function copyNodeModules() {
  // Copy node_modules for pre-built binaries
  process.chdir(agentDir);

  const NODE_MODULES_TO_COPY = ["@vscode/ripgrep", "workerpool"];
  fs.mkdirSync(agentDistPath("out", "node_modules"), { recursive: true });

  const resolveRuntimeModuleSource = (mod) => {
    const candidates = [
      path.join(agentDir, "node_modules", mod),
      path.join(repoRoot, "node_modules", mod),
    ];
    if (mod === "@vscode/ripgrep") {
      return candidates.find((candidate) =>
        fs.existsSync(path.join(candidate, "bin", process.platform === "win32" ? "rg.exe" : "rg")),
      );
    }
    return candidates.find((candidate) => fs.existsSync(candidate));
  };

  await Promise.all(
    NODE_MODULES_TO_COPY.map(
      (mod) =>
        new Promise((resolve, reject) => {
          const source = resolveRuntimeModuleSource(mod);
          if (!source) {
            console.warn(`[warn] Runtime node module missing, skipping: ${mod}`);
            resolve();
            return;
          }
          fs.mkdirSync(agentDistPath("out", "node_modules", mod), { recursive: true });
          ncp(
            source,
            agentDistPath("out", "node_modules", mod),
            { dereference: true },
            function (error) {
              if (error) {
                console.error(`[error] Error copying ${mod}`, error);
                reject(error);
              } else {
                console.log(`[info] Copied ${mod}`);
                resolve();
              }
            },
          );
        }),
    ),
  );

  console.log(`[info] Copied ${NODE_MODULES_TO_COPY.join(", ")}`);
}

function copyRuntimeWorkerFiles() {
  process.chdir(agentDir);
  fs.mkdirSync(agentDistPath("out"), { recursive: true });

  const xhrWorkerCandidates = [
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
    "core/node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
  ];
  const xhrWorker = xhrWorkerCandidates.find((p) =>
    fs.existsSync(path.join(agentDir, p)),
  );
  if (xhrWorker) {
    fs.cpSync(path.join(agentDir, xhrWorker), agentDistPath("out", "xhr-sync-worker.js"));
    console.log("[info] Copied xhr-sync-worker.js");
  } else {
    console.warn("[warn] jsdom xhr-sync-worker not found — skipping copy");
  }
}

async function copyExtensionOutAssets(target) {
  process.chdir(agentDir);
  ensureGeneratedExtensionManifest();
  fs.mkdirSync(agentDistPath("out"), { recursive: true });
  await copyOnnxRuntimeFromNodeModules(target);
  copyTokenizers();
  await copyNodeModules();
  await copyScripts();
  copyRuntimeWorkerFiles();
}

async function copyScripts() {
  console.log("[info] Copying scripts from core");
  fs.copyFileSync(
    path.join(__dirname, "../core/util/start_ollama.sh"),
    agentDistPath("out", "start_ollama.sh"),
  );
  console.log("[info] Copied script files");
}

module.exports = {
  agentDir,
  agentDistDir,
  agentGuiDistDir,
  agentDistPath,
  ensureGeneratedExtensionManifest,
  copyGuiDistToWebview,
  copyOnnxRuntimeFromNodeModules,
  copyNodeModules,
  copyExtensionOutAssets,
  copyRuntimeWorkerFiles,
  copyTokenizers,
  copyScripts,
};
