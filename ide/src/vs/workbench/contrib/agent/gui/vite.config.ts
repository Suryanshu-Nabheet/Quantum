/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react-swc";
import { createReadStream, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, normalize, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);
const watching = process.env.AGENT_COPY_WEBVIEW === "1";

const quantumFileIconsRoot = resolve(
  __dirname,
  "../../../../../../extensions/quantum-theme/file-icons",
);

/** Dev server only. The built webview copies these icons next to the bundle. */
function quantumFileIconsPlugin(): Plugin {
  return {
    name: "quantum-file-icons",
    configureServer(server) {
      server.middlewares.use("/quantum-file-icons", (req, res, next) => {
        const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(
          /^\/+/,
          "",
        );
        const file = normalize(join(quantumFileIconsRoot, urlPath));
        const rootWithSep = quantumFileIconsRoot.endsWith(sep)
          ? quantumFileIconsRoot
          : quantumFileIconsRoot + sep;
        if (!file.startsWith(rootWithSep) || !existsSync(file)) {
          next();
          return;
        }
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Access-Control-Allow-Origin", "*");
        createReadStream(file).pipe(res);
      });
    },
  };
}

function agentCopyWebviewPlugin(): Plugin {
  return {
    name: "agent-copy-webview",
    closeBundle() {
      if (process.env.AGENT_COPY_WEBVIEW !== "1") {
        return;
      }
      require("../scripts/utils").copyGuiDistToWebview();
      console.log("[watch-gui] Copied out/agent-gui to out/agent/webview/");
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), quantumFileIconsPlugin(), agentCopyWebviewPlugin()],
  resolve: {
    alias: {
      yaml: require.resolve("yaml"),
      // uri-js is CJS-only (no module/exports entry); core imports it directly.
      "uri-js": require.resolve("uri-js"),
    },
  },
  build: {
    outDir: resolve(__dirname, "../../../../../../out/agent-gui"),
    emptyOutDir: !watching,
    sourcemap: !watching,
    minify: watching ? false : "esbuild",
    reportCompressedSize: !watching,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, "../../../../../..")],
    },
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["*", "Content-Type", "Authorization"],
      credentials: true,
    },
    sourcemapIgnoreList(sourcePath) {
      return (
        sourcePath.includes("node_modules") ||
        sourcePath.includes("/packages/") ||
        sourcePath.includes("\\packages\\")
      );
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/util/test/setupTests.ts",
    onConsoleLog(log, type) {
      if (type === "stderr") {
        if (
          [
            "contentEditable",
            "An update to Chat inside a test was not wrapped in act",
            "An update to TipTapEditor inside a test was not wrapped in act",
            "An update to ThinkingIndicator inside a test was not wrapped in act",
            "The current testing environment is not configured to support act",
            "target.getClientRects is not a function",
            "prosemirror",
          ].some((text) => log.includes(text))
        ) {
          return false;
        }
      }
      return true;
    },
  },
});
