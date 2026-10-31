const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const agentRoot = path.resolve(__dirname, "..");
const esbuildPlatform = `@esbuild/${process.platform}-${process.arch}`;
const esbuildExecutable = process.platform === "win32" ? "esbuild.exe" : "esbuild";
const checks = [
  ["packages/fetch", "test"],
  ["packages/terminal-security", "test"],
  ["packages/openai-adapters", "test"],
  ["gui", "tsc:check"],
  ["gui", "test"],
  ["packages/agent-config", "test"],
];

for (const [packagePath, script] of checks) {
  const packageRoot = path.join(agentRoot, packagePath);
  const esbuildPath = path.join(
    packageRoot,
    "node_modules",
    esbuildPlatform,
    "bin",
    esbuildExecutable,
  );

  if (!fs.existsSync(esbuildPath)) {
    console.error(`Missing package-local esbuild binary: ${esbuildPath}`);
    process.exit(1);
  }

  console.log(`Verifying ${packagePath}: ${script}`);
  const result = spawnSync(
    "npm",
    ["--prefix", packageRoot, "run", script],
    {
      cwd: agentRoot,
      env: { ...process.env, ESBUILD_BINARY_PATH: esbuildPath },
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
