const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");

// --ignore-scripts: nested packages sit under agent/, so npm prepends
// agent/node_modules/.bin (esbuild@0.17.19) to lifecycle PATH. Newer
// transitive esbuild (via vitest) then fails postinstall version checks.
// Package builds only need tsc — no install scripts required.
const npmInstallCmd =
  process.env.CI === "true" ? "npm ci --ignore-scripts" : "npm install --ignore-scripts";
const repoRoot = path.resolve(__dirname, "../../../../../..");
const agentPackagesOutRoot = path.join(repoRoot, "out", "agent-packages");

function runCommand(command, cwd, packageName) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ${packageName}: ${command}`);

    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, {
      cwd,
      stdio: "pipe",
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`[SUCCESS] ${packageName}: ${command} completed successfully`);
        resolve({ packageName, command, stdout, stderr });
      } else {
        console.error(`[ERROR] ${packageName}: ${command} failed with code ${code}`);
        console.error(`stderr: ${stderr}`);
        console.error(`stdout: ${stdout}`);
        reject(
          new Error(`${packageName} failed: ${command} (exit code ${code})`),
        );
      }
    });

    child.on("error", (error) => {
      console.error(`[ERROR] ${packageName}: Failed to start ${command}:`, error);
      reject(error);
    });
  });
}

// Helper function to build a package (install + build)
async function buildPackage(packageName, cleanNodeModules = false) {
  const packagePath = path.join(__dirname, "..", "packages", packageName);

  if (!fs.existsSync(packagePath)) {
    throw new Error(`Package directory not found: ${packagePath}`);
  }

  if (cleanNodeModules) {
    const nodeModulesPath = path.join(packagePath, "node_modules");
    if (fs.existsSync(nodeModulesPath)) {
      console.log(`[CLEAN] Cleaning node_modules for ${packageName}`);
      await fsPromises.rm(nodeModulesPath, { recursive: true, force: true });
    }
  }

  await runCommand(npmInstallCmd, packagePath, `${packageName} (install)`);

  const result = await runCommand("npm run build", packagePath, `${packageName} (build)`);
  await linkOutputNodeModules(packageName, packagePath);
  return result;
}

async function linkOutputNodeModules(packageName, packagePath) {
  const sourceNodeModules = path.join(packagePath, "node_modules");
  if (!fs.existsSync(sourceNodeModules)) {
    return;
  }

  const outputPackagePath = path.join(agentPackagesOutRoot, packageName);
  const outputNodeModules = path.join(outputPackagePath, "node_modules");
  await fsPromises.mkdir(outputPackagePath, { recursive: true });
  await fsPromises.rm(outputNodeModules, { recursive: true, force: true });
  await fsPromises.symlink(
    sourceNodeModules,
    outputNodeModules,
    process.platform === "win32" ? "junction" : "dir",
  );
}

async function buildPackagesInParallel(packages, cleanNodeModules = false) {
  const buildPromises = packages.map((pkg) =>
    buildPackage(pkg, cleanNodeModules),
  );
  return Promise.all(buildPromises);
}

async function main() {
  try {
    console.log("Starting package builds...\n");

    // Phase 1: Build foundation packages (no local dependencies)
    await buildPackagesInParallel(["config-types", "terminal-security"]);

    // Phase 2: Build packages that depend on config-types
    await buildPackagesInParallel(["fetch", "agent-config", "llm-info"]);

    // Phase 3: Build packages that depend on other local packages
    await buildPackagesInParallel(["openai-adapters"]);

    console.log("All packages built successfully!");
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
