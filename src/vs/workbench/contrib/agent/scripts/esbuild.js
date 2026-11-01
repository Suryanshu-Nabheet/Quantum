const path = require("path");
const fs = require("fs");

const { agentDistPath } = require("./utils");

const esbuild = require("esbuild");

const flags = process.argv.slice(2);
const agentRoot = path.join(__dirname, "..");
// agent → contrib → workbench → vs → src → ide root
const ideRoot = path.resolve(agentRoot, "../../../../../");
const packageNames = [
  "config-types",
  "fetch",
  "llm-info",
  "agent-config",
  "openai-adapters",
  "terminal-security",
];

// Local packages publish `main` as a relative path into ide/out/agent-packages.
// npm installs them as symlinks under core/node_modules and gui/node_modules;
// resolving `main` from the symlink path (not the realpath) misses the build
// output and breaks watch-agent esbuild. Alias to absolute built entrypoints.
const localPackageAliases = Object.fromEntries(
  packageNames.map((name) => [
    name,
    path.join(ideRoot, "out/agent-packages", name, "index.js"),
  ]),
);

const baseConfig = {
  bundle: true,
  absWorkingDir: __dirname + "/..",
  external: ["esbuild", "./xhr-sync-worker.js"],
  format: "cjs",
  platform: "node",
  // Deduplicate dependencies that each local package (openai-adapters, fetch,
  // agent-config, config-types) vendors its own copy of under packages/*/node_modules.
  // All copies are the same version (verified), so resolve them to the
  // single hoisted copy in agent/node_modules to avoid bundling 2-4x.
  alias: {
    ...localPackageAliases,
    "zod": path.join(agentRoot, "node_modules/zod"),
    "web-streams-polyfill": path.join(
      agentRoot,
      "node_modules/web-streams-polyfill",
    ),
    "bignumber.js": path.join(agentRoot, "node_modules/bignumber.js"),
  },
  nodePaths: [
    path.join(agentRoot, "node_modules"),
    path.join(agentRoot, "packages"),
    ...packageNames.map((name) => path.join(agentRoot, "packages", name, "node_modules")),
  ],
  minify: flags.includes("--minify"),
  sourcemap: flags.includes("--sourcemap"),
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },

  // To allow import.meta.path for transformers.js
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: { "import.meta.url": "importMetaUrl" },
  supported: { "dynamic-import": false },
  plugins: [],
};

const nativeRuntimeConfig = {
  ...baseConfig,
  entryPoints: ["workbench/runtime/AgentRuntime.ts"],
  outfile: agentDistPath("runtime", "AgentRuntime.js"),
};

const nativeRuntimeWorkerConfig = {
  ...baseConfig,
  entryPoints: ["workbench/runtime/agentRuntimeWorker.ts"],
  outfile: agentDistPath("runtime", "agentRuntimeWorker.js"),
  external: [...baseConfig.external, "./AgentRuntime"],
  plugins: [],
};

// The IDE package is ESM, while esbuild emits this native Node worker as CJS.
// Give the bundled runtime its own explicit package boundary so Node does not
// reinterpret the worker and its shared runtime as ESM at startup.
const runtimePackagePath = agentDistPath("runtime", "package.json");
fs.mkdirSync(path.dirname(runtimePackagePath), { recursive: true });
fs.writeFileSync(runtimePackagePath, JSON.stringify({ type: "commonjs" }, null, 2) + "\n");

void (async () => {
  // Build the native workbench runtime only. Agent is not an extension host
  // entry point and must never emit an extension.js or extension manifest.
  if (flags.includes("--watch")) {
    const contexts = await Promise.all([
      esbuild.context(nativeRuntimeConfig),
      esbuild.context(nativeRuntimeWorkerConfig),
    ]);
    await Promise.all(contexts.map((context) => context.watch()));
  } else {
    await Promise.all([
      esbuild.build(nativeRuntimeConfig),
      esbuild.build(nativeRuntimeWorkerConfig),
    ]);
  }
})();
