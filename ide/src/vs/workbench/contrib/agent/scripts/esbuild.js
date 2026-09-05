const fs = require("fs");
const path = require("path");

const {
  copyTokenizers,
  copyExtensionOutAssets,
  agentDistPath,
  ensureGeneratedExtensionManifest,
} = require("./utils");

const esbuild = require("esbuild");

const flags = process.argv.slice(2);
const agentRoot = path.join(__dirname, "..");
const packageNames = [
  "config-types",
  "fetch",
  "llm-info",
  "agent-config",
  "openai-adapters",
  "terminal-security",
];

const esbuildConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: agentDistPath("out", "extension.js"),
  absWorkingDir: __dirname + "/..",
  external: ["vscode", "esbuild", "./xhr-sync-worker.js"],
  format: "cjs",
  platform: "node",
  // Deduplicate dependencies that each local package (openai-adapters, fetch,
  // agent-config, config-types) vendors its own copy of under packages/*/node_modules.
  // All copies are the same version (verified), so resolve them to the
  // single hoisted copy in agent/node_modules to avoid bundling 2-4x.
  alias: {
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
  metafile: true,
  plugins: [
    {
      name: "on-end-plugin",
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length > 0) {
            console.error("Build failed with errors:", result.errors);
            throw new Error(result.errors);
          }

          try {
            copyTokenizers();
            const { autodetectPlatformAndArch } = require("./util/index");
            const target =
              process.env.AGENT_BUILD_TARGET ||
              process.env.AGENT_VSCODE_TARGET ||
              process.env.VSCODE_TARGET;
            if (target) {
              await copyExtensionOutAssets(target);
            } else {
              const [os, arch] = autodetectPlatformAndArch();
              await copyExtensionOutAssets(`${os}-${arch}`);
            }
          } catch (e) {
            console.error("Failed to copy extension runtime assets", e);
            throw e;
          }

          console.log("Agent esbuild complete");
        });
      },
    },
  ],
};

void (async () => {
  ensureGeneratedExtensionManifest();
  // Bundles the extension into one file
  if (flags.includes("--watch")) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();
  } else {
    await esbuild.build(esbuildConfig);
  }
})();
